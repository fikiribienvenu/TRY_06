from beanie import Document, Indexed
from pydantic import EmailStr, Field
from typing import Optional, List
from datetime import datetime, date, timezone
from enum import Enum


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Patient(Document):
    patient_id: Indexed(str, unique=True)
    user_id: Optional[str] = None          # linked User document id
    first_name: str
    last_name: str
    gender: Gender
    date_of_birth: date
    national_id: Indexed(str, unique=True)
    phone: str
    email: Indexed(EmailStr)
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_type: Optional[str] = None
    allergies: List[str] = []
    assigned_doctor_id: Optional[str] = None   # junior doctor
    registered_by: Optional[str] = None        # receptionist id
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self) -> int:
        today = date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )

    class Settings:
        name = "patients"
        indexes = ["patient_id", "national_id", "email", "phone", "assigned_doctor_id"]
