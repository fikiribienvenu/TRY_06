from fastapi import APIRouter, Depends, Query
from datetime import datetime, timezone, timedelta
from app.core.dependencies import require_role
from app.core.permissions import Role
from app.models.user import User
from app.models.patient import Patient
from app.models.ct_scan import CTScan
from app.models.prediction import Prediction, CancerType
from app.models.report import Report, ReportStatus
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_stats(actor: User = Depends(require_role(Role.DIRECTOR))):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_patients = await Patient.count()
    total_scans = await CTScan.count()
    total_predictions = await Prediction.count()
    total_reports = await Report.count()
    published_reports = await Report.find(Report.status == ReportStatus.PUBLISHED).count()

    cancer_cases = await Prediction.find(
        Prediction.prediction != CancerType.NO_CANCER
    ).count()
    normal_cases = await Prediction.find(
        Prediction.prediction == CancerType.NO_CANCER
    ).count()

    today_scans = await CTScan.find(CTScan.created_at >= today_start).count()
    monthly_scans = await CTScan.find(CTScan.created_at >= month_start).count()

    from app.models.user import UserRole
    junior_docs = await User.find(User.role == UserRole.RADIOLOGIST, User.is_active == True).count()
    senior_docs = await User.find(User.role == UserRole.SENIOR_DOCTOR, User.is_active == True).count()
    receptionists = await User.find(User.role == UserRole.RECEPTIONIST, User.is_active == True).count()

    return {
        "totals": {
            "patients": total_patients,
            "ct_scans": total_scans,
            "cancer_cases": cancer_cases,
            "normal_cases": normal_cases,
            "published_reports": published_reports,
            "total_reports": total_reports,
        },
        "today": {
            "scans": today_scans,
        },
        "monthly": {
            "scans": monthly_scans,
        },
        "staff": {
            "radiologists": junior_docs,
            "senior_doctors": senior_docs,
            "receptionists": receptionists,
        },
        "accuracy": {
            "prediction_accuracy": 94.2,  # static from model evaluation
        },
    }


@router.get("/cancer-distribution")
async def cancer_distribution(actor: User = Depends(require_role(Role.DIRECTOR, Role.SENIOR_DOCTOR))):
    pipeline = [
        {"$group": {"_id": "$prediction", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await Prediction.aggregate(pipeline).to_list()
    return [{"type": r["_id"], "count": r["count"]} for r in results]


@router.get("/monthly-activity")
async def monthly_activity(
    year: int = Query(default=None),
    actor: User = Depends(require_role(Role.DIRECTOR)),
):
    if not year:
        year = datetime.now(timezone.utc).year

    pipeline = [
        {"$match": {"created_at": {
            "$gte": datetime(year, 1, 1, tzinfo=timezone.utc),
            "$lt": datetime(year + 1, 1, 1, tzinfo=timezone.utc),
        }}},
        {"$group": {
            "_id": {"$month": "$created_at"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]

    scan_results = await CTScan.aggregate(pipeline).to_list()
    months = {r["_id"]: r["count"] for r in scan_results}

    patient_pipeline = [
        {"$match": {"created_at": {
            "$gte": datetime(year, 1, 1, tzinfo=timezone.utc),
            "$lt": datetime(year + 1, 1, 1, tzinfo=timezone.utc),
        }}},
        {"$group": {"_id": {"$month": "$created_at"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    patient_results = await Patient.aggregate(patient_pipeline).to_list()
    patient_months = {r["_id"]: r["count"] for r in patient_results}

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    return [
        {
            "month": month_names[i],
            "scans": months.get(i + 1, 0),
            "patients": patient_months.get(i + 1, 0),
        }
        for i in range(12)
    ]


@router.get("/audit-logs")
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    actor: User = Depends(require_role(Role.DIRECTOR)),
):
    total = await AuditLog.count()
    logs = await AuditLog.find().sort("-created_at").skip(
        (page - 1) * page_size
    ).limit(page_size).to_list()

    return {
        "logs": [
            {
                "id": str(l.id),
                "actor_email": l.actor_email,
                "actor_role": l.actor_role,
                "action": l.action,
                "description": l.description,
                "resource_type": l.resource_type,
                "success": l.success,
                "created_at": l.created_at,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
