from beanie import Document
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class ReportStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"
    RE_EVALUATION = "re_evaluation"


class Report(Document):
    patient_id: str
    ct_scan_id: str
    prediction_id: str
    junior_doctor_id: str
    senior_doctor_id: Optional[str] = None
    status: ReportStatus = ReportStatus.DRAFT
    junior_notes: Optional[str] = None
    senior_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    recommendations: List[str] = []
    gemini_explanation: Optional[str] = None
    gemini_generated_at: Optional[datetime] = None
    pdf_path: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "reports"
        indexes = ["patient_id", "ct_scan_id", "junior_doctor_id", "senior_doctor_id", "status"]
