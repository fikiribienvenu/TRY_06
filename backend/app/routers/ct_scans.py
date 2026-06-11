from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from datetime import datetime, timezone
from typing import Optional
from app.models.ct_scan import CTScan, ScanStatus, Priority
from app.models.user import User, UserRole
from app.models.prediction import Prediction, CancerType
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import audit_service
from app.models.audit_log import AuditAction
from app.utils.file_handler import save_ct_scan
from app.ai.predictor import predict_ct_scan

router = APIRouter(prefix="/ct-scans", tags=["CT Scans"])


@router.post("/request")
async def request_ct_scan(
    patient_id: str = Form(...),
    priority: Priority = Form(Priority.NORMAL),
    notes: Optional[str] = Form(None),
    doctor_id: Optional[str] = Form(None),
    scan_date: Optional[str] = Form(None),
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    from app.models.patient import Patient
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    assigned_doctor_id = doctor_id or patient.assigned_doctor_id

    scan = CTScan(
        patient_id=patient_id,
        requested_by=str(actor.id),
        assigned_doctor_id=assigned_doctor_id,
        priority=priority,
        notes=notes,
        scan_date=datetime.fromisoformat(scan_date) if scan_date else None,
        file_path="",
        file_name="",
        file_type="",
        file_size_kb=0,
        status=ScanStatus.ASSIGNED if assigned_doctor_id else ScanStatus.PENDING,
    )
    await scan.insert()
    return {"scan_id": str(scan.id), "status": scan.status}


@router.post("/{scan_id}/upload")
async def upload_ct_scan(
    scan_id: str,
    file: UploadFile = File(...),
    actor: User = Depends(require_role(Role.JUNIOR_DOCTOR)),
):
    scan = await CTScan.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="CT scan request not found")
    if scan.assigned_doctor_id and scan.assigned_doctor_id != str(actor.id):
        raise HTTPException(status_code=403, detail="This scan is not assigned to you")

    file_info = await save_ct_scan(file, scan.patient_id)
    scan.file_path = file_info["file_path"]
    scan.file_name = file_info["file_name"]
    scan.file_type = file_info["file_type"]
    scan.file_size_kb = file_info["file_size_kb"]
    scan.assigned_doctor_id = str(actor.id)
    scan.status = ScanStatus.PROCESSING
    scan.updated_at = datetime.now(timezone.utc)
    await scan.save()

    await audit_service.log(
        action=AuditAction.CT_SCAN_UPLOADED,
        description=f"Dr. {actor.email} uploaded CT scan for patient {scan.patient_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="ct_scan",
        resource_id=str(scan.id),
    )

    return {"scan_id": str(scan.id), "file_name": file_info["file_name"], "status": scan.status}


@router.post("/{scan_id}/predict")
async def run_prediction(
    scan_id: str,
    actor: User = Depends(require_role(Role.JUNIOR_DOCTOR)),
):
    scan = await CTScan.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="CT scan not found")
    if not scan.file_path:
        raise HTTPException(status_code=400, detail="No CT image uploaded yet")
    if scan.assigned_doctor_id != str(actor.id):
        raise HTTPException(status_code=403, detail="Not assigned to you")

    label, confidence, probs, heatmap_path = predict_ct_scan(scan.file_path)

    prediction = Prediction(
        ct_scan_id=str(scan.id),
        patient_id=scan.patient_id,
        performed_by=str(actor.id),
        prediction=label,
        confidence=confidence,
        class_probabilities=probs,
        heatmap_generated=heatmap_path is not None,
        heatmap_path=heatmap_path,
    )
    await prediction.insert()

    scan.prediction_id = str(prediction.id)
    scan.heatmap_path = heatmap_path
    scan.status = ScanStatus.PREDICTED
    scan.updated_at = datetime.now(timezone.utc)
    await scan.save()

    await audit_service.log(
        action=AuditAction.PREDICTION_GENERATED,
        description=f"Prediction: {label} ({confidence:.1f}%) for scan {scan_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="prediction",
        resource_id=str(prediction.id),
    )

    heatmap_url = None
    if heatmap_path:
        heatmap_url = "/" + heatmap_path.replace("\\", "/")

    return {
        "prediction_id": str(prediction.id),
        "prediction": label,
        "confidence": confidence,
        "class_probabilities": probs,
        "heatmap_generated": heatmap_path is not None,
        "heatmap_url": heatmap_url,
        "timestamp": datetime.now(timezone.utc).date().isoformat(),
    }


@router.get("")
async def list_scans(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(get_current_active_user),
):
    filters = []
    if actor.role == UserRole.JUNIOR_DOCTOR:
        filters.append(CTScan.assigned_doctor_id == str(actor.id))
    elif patient_id:
        filters.append(CTScan.patient_id == patient_id)

    if status:
        filters.append(CTScan.status == status)

    query = CTScan.find(*filters)
    total = await query.count()
    scans = await query.skip((page - 1) * page_size).limit(page_size).to_list()

    return {
        "scans": [
            {
                "id": str(s.id),
                "patient_id": s.patient_id,
                "status": s.status,
                "priority": s.priority,
                "file_name": s.file_name,
                "prediction_id": s.prediction_id,
                "created_at": s.created_at,
            }
            for s in scans
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{scan_id}")
async def get_scan(scan_id: str, actor: User = Depends(get_current_active_user)):
    scan = await CTScan.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Not found")
    return scan
