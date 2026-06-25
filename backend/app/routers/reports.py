from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response, StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import io
import csv
from app.models.report import Report, ReportStatus
from app.models.ct_scan import CTScan, ScanStatus
from app.models.prediction import Prediction
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.report import ReportCreate, ReportSubmit, ReportReview, ReportResponse, ActivitySummaryCreate
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import audit_service, notification_service, gemini_service, pdf_service, email_service
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
        radiologist_id=r.radiologist_id,
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
    actor: User = Depends(require_role(Role.RADIOLOGIST)),
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
        radiologist_id=str(actor.id),
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
    actor: User = Depends(require_role(Role.RADIOLOGIST)),
):
    report = await Report.get(report_id)
    if not report or report.radiologist_id != str(actor.id):
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


@router.post("/activity-summary")
async def submit_activity_summary(
    body: ActivitySummaryCreate,
    actor: User = Depends(require_role(Role.SENIOR_DOCTOR)),
):
    """Senior Doctor submits a personal activity summary to all Directors."""
    from beanie.operators import In

    total      = await Report.find(Report.senior_doctor_id == str(actor.id)).count()
    approved   = await Report.find(
        Report.senior_doctor_id == str(actor.id),
        In(Report.status, [ReportStatus.APPROVED, ReportStatus.PUBLISHED]),
    ).count()
    published  = await Report.find(
        Report.senior_doctor_id == str(actor.id),
        Report.status == ReportStatus.PUBLISHED,
    ).count()
    rejected   = await Report.find(
        Report.senior_doctor_id == str(actor.id),
        Report.status == ReportStatus.REJECTED,
    ).count()
    re_eval    = await Report.find(
        Report.senior_doctor_id == str(actor.id),
        Report.status == ReportStatus.RE_EVALUATION,
    ).count()

    summary = (
        f"Dr. {actor.full_name} — Activity Report ({body.period}): "
        f"Total reviewed: {total} | Approved: {approved} | Published: {published} | "
        f"Rejected: {rejected} | Re-evaluated: {re_eval}."
    )
    if body.notes:
        summary += f" Doctor's notes: {body.notes}"

    directors = await User.find(User.role == UserRole.DIRECTOR, User.is_active == True).to_list()
    for d in directors:
        await notification_service.create_notification(
            user_id=str(d.id),
            notification_type=NotificationType.GENERAL,
            title=f"Activity Report — Dr. {actor.full_name}",
            message=summary,
            metadata={
                "senior_doctor_id": str(actor.id),
                "senior_doctor_name": actor.full_name,
                "period": body.period,
                "total_reviewed": total,
                "approved": approved,
                "published": published,
                "rejected": rejected,
                "re_evaluated": re_eval,
            },
        )

    await audit_service.log(
        action=AuditAction.REPORT_PUBLISHED,
        description=f"Dr. {actor.email} submitted activity summary to Director",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="activity_summary",
        resource_id=str(actor.id),
    )

    return {
        "message": f"Activity summary submitted to {len(directors)} director(s)",
        "stats": {
            "total_reviewed": total,
            "approved": approved,
            "published": published,
            "rejected": rejected,
            "re_evaluated": re_eval,
        },
    }


@router.get("/queue")
async def get_review_queue(
    actor: User = Depends(require_role(Role.SENIOR_DOCTOR)),
):
    from beanie.operators import In
    reports = await Report.find(
        In(Report.status, [ReportStatus.PENDING_REVIEW, ReportStatus.UNDER_REVIEW, ReportStatus.RE_EVALUATION])
    ).sort("-created_at").to_list()

    result = []
    for r in reports:
        patient = await Patient.get(r.patient_id)
        junior = await User.get(r.radiologist_id)
        prediction = await Prediction.get(r.prediction_id) if r.prediction_id else None

        item = _to_response(r).model_dump()
        item.update({
            "patient_name": patient.full_name if patient else "Unknown",
            "patient_code": patient.patient_id if patient else r.patient_id[-8:],
            "radiologist_name": junior.full_name if junior else "Unknown",
            "prediction_label": prediction.prediction if prediction else None,
            "prediction_confidence": round(prediction.confidence, 1) if prediction else None,
        })
        result.append(item)

    return result


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
        # Send rich email with Gemini explanation
        if patient.email:
            await email_service.send_report_published_email(
                to=patient.email,
                patient_name=patient.full_name,
                prediction=prediction.prediction if prediction else "See report",
                confidence=prediction.confidence if prediction else 0,
                gemini_explanation=report.gemini_explanation,
                recommendations=report.recommendations,
            )
        await notification_service.create_notification(
            user_id=patient.user_id,
            notification_type=NotificationType.REPORT_PUBLISHED,
            title="Your CT Scan Report is Ready",
            message=f"Your report has been reviewed and published. Log in to view your results.",
            metadata={"report_id": str(report.id)},
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
    junior = await UserModel.get(report.radiologist_id)
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
        radiologist=junior.full_name if junior else "Unknown",
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


def _apply_date_filter(filters: list, date_filter: Optional[str]):
    if not date_filter or date_filter == "all":
        return
    now = datetime.now(timezone.utc)
    if date_filter == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif date_filter == "week":
        start = now - timedelta(days=7)
    elif date_filter == "month":
        start = now - timedelta(days=30)
    elif date_filter == "year":
        start = now - timedelta(days=365)
    else:
        return
    filters.append(Report.created_at >= start)


async def _enrich_report(r: Report) -> dict:
    patient = await Patient.get(r.patient_id)
    junior = await User.get(r.radiologist_id)
    senior = await User.get(r.senior_doctor_id) if r.senior_doctor_id else None
    prediction = await Prediction.get(r.prediction_id) if r.prediction_id else None
    item = _to_response(r).model_dump()
    item.update({
        "patient_name": patient.full_name if patient else None,
        "patient_code": patient.patient_id if patient else None,
        "radiologist_name": junior.full_name if junior else None,
        "senior_doctor_name": senior.full_name if senior else None,
        "prediction_label": prediction.prediction if prediction else None,
        "prediction_confidence": round(prediction.confidence, 1) if prediction else None,
    })
    return item


@router.get("/export-csv")
async def export_reports_csv(
    date_filter: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    radiologist_id: Optional[str] = Query(None),
    senior_doctor_id: Optional[str] = Query(None),
    actor: User = Depends(require_role(Role.DIRECTOR)),
):
    filters: list = []
    _apply_date_filter(filters, date_filter)
    if status:
        filters.append(Report.status == status)
    if radiologist_id:
        filters.append(Report.radiologist_id == radiologist_id)
    if senior_doctor_id:
        filters.append(Report.senior_doctor_id == senior_doctor_id)

    reports = await Report.find(*filters).sort("-created_at").limit(5000).to_list()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Report ID", "Patient Name", "Patient Code",
        "AI Prediction", "Confidence (%)",
        "Radiologist", "Senior Doctor",
        "Status", "Submitted Date", "Reviewed Date", "Published Date",
    ])

    for r in reports:
        patient = await Patient.get(r.patient_id)
        junior = await User.get(r.radiologist_id)
        senior = await User.get(r.senior_doctor_id) if r.senior_doctor_id else None
        prediction = await Prediction.get(r.prediction_id) if r.prediction_id else None
        writer.writerow([
            str(r.id)[-8:].upper(),
            patient.full_name if patient else "N/A",
            patient.patient_id if patient else "N/A",
            prediction.prediction if prediction else "N/A",
            f"{prediction.confidence:.1f}" if prediction else "N/A",
            junior.full_name if junior else "N/A",
            senior.full_name if senior else "N/A",
            r.status,
            r.submitted_at.strftime("%Y-%m-%d") if r.submitted_at else "N/A",
            r.reviewed_at.strftime("%Y-%m-%d") if r.reviewed_at else "N/A",
            r.published_at.strftime("%Y-%m-%d") if r.published_at else "N/A",
        ])

    output.seek(0)
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="pulmoscan_reports_{ts}.csv"'},
    )


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    actor: User = Depends(get_current_active_user),
):
    report = await Report.get(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if not patient or report.patient_id != str(patient.id):
            raise HTTPException(status_code=403, detail="Access denied")
        if report.status != ReportStatus.PUBLISHED:
            raise HTTPException(status_code=403, detail="Report not published yet")

    result = _to_response(report).model_dump()

    if actor.role != UserRole.PATIENT:
        junior = await User.get(report.radiologist_id)
        result["radiologist_name"] = junior.full_name if junior else None
        if report.senior_doctor_id:
            senior = await User.get(report.senior_doctor_id)
            result["senior_doctor_name"] = senior.full_name if senior else None

    return result


@router.get("")
async def list_reports(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    my_reviews: bool = Query(False),
    date_filter: Optional[str] = Query(None),
    radiologist_id: Optional[str] = Query(None),
    senior_doctor_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    actor: User = Depends(get_current_active_user),
):
    filters: list = []
    director_base_filters: list = []  # filters before status — used for per-status counts

    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if patient:
            filters.append(Report.patient_id == str(patient.id))
        filters.append(Report.status == ReportStatus.PUBLISHED)
    elif actor.role == UserRole.RADIOLOGIST:
        filters.append(Report.radiologist_id == str(actor.id))
    elif actor.role == UserRole.SENIOR_DOCTOR and my_reviews:
        filters.append(Report.senior_doctor_id == str(actor.id))
    elif actor.role == UserRole.DIRECTOR:
        _apply_date_filter(filters, date_filter)
        if radiologist_id:
            filters.append(Report.radiologist_id == radiologist_id)
        if senior_doctor_id:
            filters.append(Report.senior_doctor_id == senior_doctor_id)
        director_base_filters = list(filters)  # snapshot before status filter
    elif patient_id:
        filters.append(Report.patient_id == patient_id)

    if status:
        filters.append(Report.status == status)

    base_query = Report.find(*filters).sort("-created_at")
    total = await base_query.count()
    reports = await base_query.skip((page - 1) * page_size).limit(page_size).to_list()

    if actor.role == UserRole.SENIOR_DOCTOR:
        result = []
        for r in reports:
            item = await _enrich_report(r)
            result.append(item)
        return {"reports": result, "total": total, "page": page, "page_size": page_size}

    if actor.role == UserRole.DIRECTOR:
        # Per-status counts using the same date/radiologist/senior_doctor filters
        # but without the status filter — so the cards always show global totals
        status_counts = {}
        for st in ReportStatus:
            status_counts[st.value] = await Report.find(*director_base_filters, Report.status == st).count()

        result = []
        for r in reports:
            item = await _enrich_report(r)
            result.append(item)
        return {
            "reports": result,
            "total": total,
            "page": page,
            "page_size": page_size,
            "status_counts": status_counts,
        }

    return [_to_response(r) for r in reports]
