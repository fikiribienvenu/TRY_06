from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class AppointmentStatus(str, Enum):
    REQUESTED = "requested"
    SCHEDULED = "scheduled"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class AppointmentType(str, Enum):
    CT_SCAN = "ct_scan"
    FOLLOW_UP = "follow_up"
    CONSULTATION = "consultation"
    NEW_SCAN = "new_scan"


class Appointment(Document):
    patient_id: str
    doctor_id: Optional[str] = None
    receptionist_id: Optional[str] = None
    appointment_type: AppointmentType
    status: AppointmentStatus = AppointmentStatus.REQUESTED
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 30
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    ct_scan_id: Optional[str] = None
    requested_by_patient: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "appointments"
        indexes = ["patient_id", "doctor_id", "status", "scheduled_at"]
