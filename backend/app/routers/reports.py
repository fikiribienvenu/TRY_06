from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from datetime import datetime, timezone
from typing import Optional, List
from app.models.report import Report, ReportStatus
from app.models.ct_scan import CTScan, ScanStatus
from app.models.prediction import Prediction
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.report import ReportCreate, ReportSubmit, ReportReview, ReportResponse
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import audit_service, notification_service, gemini_service, pdf_service
from app.models.audit_log import AuditAction
from app.models.notification import NotificationType
from app.utils.helpers import generate_report_id
from pathlib import Path

router = APIRouter(prefix="/reports", tags=["Reports"])


def _to_response(r: Report) -> ReportResponse:
    return ReportResponse(
        id=str(r.id),
        patient_id=r.patient_id,
        ct_scan_id=r.ct_scan_id,
        prediction_id=r.prediction_id,
        junior_doctor_id=r.junior_doctor_id,
        senior_doctor_id=r.senior_doctor_id,
        status=r.status,
        junior_notes=r.junior_notes,
        senior_notes=r.senior_notes,
        recommendations=r.recommendations,
        gemini_explanation=r.gemini_explanation,
        pdf_path=r.pdf_path,
        submitted_at=r.submitted_at,
        reviewed_at=r.reviewed_at,
        published_at=r.published_at,
        created_at=r.created_at,
    )


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    body: ReportCreate,
    actor: User = Depends(require_role(Role.JUNIOR_DOCTOR)),
):
    scan = await CTScan.get(body.ct_scan_id)
    if not scan or scan.assigned_doctor_id != str(actor.id):
        raise HTTPException(status_code=403, detail="CT scan not found or not assigned to you")

    existing = await Report.find_one(Report.ct_scan_id == body.ct_scan_id)
    if existing:
        raise HTTPException(status_code=409, detail="Report already exists for this scan")

    report = Report(
        patient_id=scan.patient_id,
        ct_scan_id=body.ct_scan_id,
        prediction_id=body.prediction_id,
        junior_doctor_id=str(actor.id),
        junior_notes=body.junior_notes,
        status=ReportStatus.DRAFT,
    )
    await report.insert()

    scan.report_id = str(report.id)
    scan.status = ScanStatus.UNDER_REVIEW
    await scan.save()

    return _to_response(report)


@router.post("/{report_id}/submit", response_model=ReportResponse)
async def submit_report(
    report_id: str,
    body: ReportSubmit,
    actor: User = Depends(require_role(Role.JUNIOR_DOCTOR)),
):
    report = await Report.get(report_id)
    if not report or report.junior_doctor_id != str(actor.id):
        raise HTTPException(status_code=403, detail="Report not found or not yours")

    report.junior_notes = body.junior_notes
    report.status = ReportStatus.PENDING_REVIEW
    report.submitted_at = datetime.now(timezone.utc)
    report.updated_at = datetime.now(timezone.utc)
    await report.save()

    # Notify senior doctors
    senior_doctors = await User.find(User.role == UserRole.SENIOR_DOCTOR, User.is_active == True).to_list()
    for sd in senior_doctors:
        await notification_service.create_notification(
            user_id=str(sd.id),
            notification_type=NotificationType.REPORT_APPROVED,
            title="New Report Pending Review",
            message=f"A CT scan report from Dr. {actor.full_name} is waiting for your review.",
            metadata={"report_id": str(report.id)},
        )

    return _to_response(report)


@router.get("/queue", response_model=list[ReportResponse])
async def get_review_queue(
    actor: User = Depends(require_role(Role.SENIOR_DOCTOR)),
):
    reports = await Report.find(
        Report.status.in_([ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW])
    ).to_list()
    return [_to_response(r) for r in reports]


@router.post("/{report_id}/review", response_model=ReportResponse)
async def review_report(
    report_id: str,
    body: ReportReview,
    actor: User = Depends(require_role(Role.SENIOR_DOCTOR)),
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.senior_doctor_id = str(actor.id)
    report.reviewed_at = datetime.now(timezone.utc)
    report.senior_notes = body.senior_notes
    report.updated_at = datetime.now(timezone.utc)

    if body.action == "approve":
        report.status = ReportStatus.APPROVED
        if body.recommendations:
            report.recommendations = body.recommendations

        # Generate Gemini explanation
        prediction = await Prediction.get(report.prediction_id)
        patient = await Patient.get(report.patient_id)
        if prediction and patient:
            recs = report.recommendations or []
            if not recs:
                recs = await gemini_service.generate_treatment_recommendations(
                    prediction=prediction.prediction,
                    confidence=prediction.confidence,
                    patient_age=patient.age,
                    patient_gender=patient.gender,
                    junior_notes=report.junior_notes or "",
                    senior_notes=body.senior_notes or "",
                )
                report.recommendations = recs

            explanation = await gemini_service.generate_patient_explanation(
                prediction=prediction.prediction,
                confidence=prediction.confidence,
                patient_age=patient.age,
                patient_gender=patient.gender,
                recommendations=recs,
            )
            report.gemini_explanation = explanation
            report.gemini_generated_at = datetime.now(timezone.utc)

    elif body.action == "reject":
        report.status = ReportStatus.REJECTED
        report.rejection_reason = body.rejection_reason
    elif body.action == "re_evaluate":
        report.status = ReportStatus.RE_EVALUATION

    await report.save()

    await audit_service.log(
        action=AuditAction.REPORT_APPROVED if body.action == "approve" else AuditAction.REPORT_REJECTED,
        description=f"Senior Dr. {actor.email} {body.action}d report {report_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="report",
        resource_id=report_id,
    )

    return _to_response(report)


@router.post("/{report_id}/publish", response_model=ReportResponse)
async def publish_report(
    report_id: str,
    actor: User = Depends(require_role(Role.SENIOR_DOCTOR)),
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != ReportStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Report must be approved before publishing")

    report.status = ReportStatus.PUBLISHED
    report.published_at = datetime.now(timezone.utc)
    report.updated_at = datetime.now(timezone.utc)

    # Generate PDF
    try:
        await _generate_pdf(report)
    except Exception:
        pass

    await report.save()

    # Notify patient
    patient = await Patient.get(report.patient_id)
    if patient and patient.user_id:
        prediction = await Prediction.get(report.prediction_id)
        await notification_service.create_notification(
            user_id=patient.user_id,
            notification_type=NotificationType.REPORT_PUBLISHED,
            title="Your CT Scan Report is Ready",
            message="Your report has been approved and is ready to view.",
            metadata={"report_id": str(report.id)},
            send_email_to=patient.email,
            email_subject="PulmoScan AI - Your Report is Ready",
        )

    await audit_service.log(
        action=AuditAction.REPORT_PUBLISHED,
        description=f"Report {report_id} published by {actor.email}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="report",
        resource_id=report_id,
    )
    return _to_response(report)


async def _generate_pdf(report: Report):
    from app.models.prediction import Prediction as Pred
    from app.models.user import User as UserModel
    prediction = await Pred.get(report.prediction_id)
    patient = await Patient.get(report.patient_id)
    junior = await UserModel.get(report.junior_doctor_id)
    senior = await UserModel.get(report.senior_doctor_id) if report.senior_doctor_id else None
    scan = await CTScan.get(report.ct_scan_id)

    pdf_bytes = pdf_service.generate_report_pdf(
        patient_name=patient.full_name if patient else "Unknown",
        patient_id=patient.patient_id if patient else "",
        patient_age=patient.age if patient else 0,
        patient_gender=patient.gender if patient else "",
        ct_scan_date=scan.scan_date.strftime("%Y-%m-%d") if scan and scan.scan_date else "N/A",
        prediction=prediction.prediction if prediction else "Unknown",
        confidence=prediction.confidence if prediction else 0,
        junior_doctor=junior.full_name if junior else "Unknown",
        senior_doctor=senior.full_name if senior else "Unknown",
        recommendations=report.recommendations,
        gemini_explanation=report.gemini_explanation,
        ct_image_path=scan.file_path if scan else None,
        report_id=str(report.id),
        published_at=report.published_at.strftime("%Y-%m-%d %H:%M") if report.published_at else "",
    )

    pdf_dir = Path("uploads/reports")
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = str(pdf_dir / f"report_{report.id}.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
    report.pdf_path = pdf_path


@router.get("/{report_id}/pdf")
async def download_pdf(report_id: str, actor: User = Depends(get_current_active_user)):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if not patient or report.patient_id != str(patient.id):
            raise HTTPException(status_code=403, detail="Access denied")

    if not report.pdf_path or not Path(report.pdf_path).exists():
        raise HTTPException(status_code=404, detail="PDF not generated yet")

    with open(report.pdf_path, "rb") as f:
        pdf_bytes = f.read()

    await audit_service.log(
        action=AuditAction.REPORT_EXPORTED,
        description=f"Report {report_id} PDF downloaded by {actor.email}",
        actor_id=str(actor.id),
        resource_type="report",
        resource_id=report_id,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_{report_id}.pdf"'},
    )


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(get_current_active_user),
):
    filters = []
    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if patient:
            filters.append(Report.patient_id == str(patient.id))
        filters.append(Report.status == ReportStatus.PUBLISHED)
    elif actor.role == UserRole.JUNIOR_DOCTOR:
        filters.append(Report.junior_doctor_id == str(actor.id))
    elif patient_id:
        filters.append(Report.patient_id == patient_id)

    if status:
        filters.append(Report.status == status)

    reports = await Report.find(*filters).skip((page - 1) * page_size).limit(page_size).to_list()
    return [_to_response(r) for r in reports]
