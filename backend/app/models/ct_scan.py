from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum


class ScanStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    PROCESSING = "processing"
    PREDICTED = "predicted"
    UNDER_REVIEW = "under_review"
    CONFIRMED = "confirmed"
    PUBLISHED = "published"


class Priority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class CTScan(Document):
    patient_id: str
    requested_by: str              # receptionist id
    assigned_doctor_id: Optional[str] = None   # radiologist id
    file_path: str
    file_name: str
    file_type: str
    file_size_kb: float
    priority: Priority = Priority.NORMAL
    status: ScanStatus = ScanStatus.PENDING
    scan_date: Optional[datetime] = None
    notes: Optional[str] = None
    heatmap_path: Optional[str] = None
    prediction_id: Optional[str] = None
    report_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "ct_scans"
        indexes = ["patient_id", "assigned_doctor_id", "status", "priority"]
