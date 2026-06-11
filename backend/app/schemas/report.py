from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.report import ReportStatus


class ActivitySummaryCreate(BaseModel):
    notes: Optional[str] = None
    period: str = "Overall"


class ReportCreate(BaseModel):
    ct_scan_id: str
    prediction_id: str
    junior_notes: Optional[str] = None


class ReportSubmit(BaseModel):
    junior_notes: str


class ReportReview(BaseModel):
    action: str                     # approve | reject | re_evaluate
    senior_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    recommendations: Optional[List[str]] = None


class ReportResponse(BaseModel):
    id: str
    patient_id: str
    ct_scan_id: str
    prediction_id: str
    junior_doctor_id: str
    senior_doctor_id: Optional[str] = None
    status: ReportStatus
    junior_notes: Optional[str] = None
    senior_notes: Optional[str] = None
    recommendations: List[str]
    gemini_explanation: Optional[str] = None
    pdf_path: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
