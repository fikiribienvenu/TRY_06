from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.appointment import AppointmentStatus, AppointmentType


class AppointmentCreate(BaseModel):
    patient_id: str
    doctor_id: Optional[str] = None
    appointment_type: AppointmentType
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 30
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    doctor_id: Optional[str] = None
    status: Optional[AppointmentStatus] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    appointment_type: AppointmentType
    status: AppointmentStatus
    scheduled_at: Optional[datetime] = None
    duration_minutes: int
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
