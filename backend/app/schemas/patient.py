from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from app.models.patient import Gender


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date
    national_id: str
    phone: str
    email: EmailStr
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_type: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    assigned_doctor_id: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    patient_id: str
    first_name: str
    last_name: str
    full_name: str
    gender: Gender
    date_of_birth: date
    age: int
    national_id: str
    phone: str
    email: str
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_type: Optional[str] = None
    assigned_doctor_id: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    patients: list[PatientResponse]
    total: int
    page: int
    page_size: int
