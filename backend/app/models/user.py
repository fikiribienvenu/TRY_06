from beanie import Document, Indexed
from pydantic import EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class UserRole(str, Enum):
    DIRECTOR = "director"
    SENIOR_DOCTOR = "senior_doctor"
    RADIOLOGIST = "radiologist"
    RECEPTIONIST = "receptionist"
    PATIENT = "patient"


class User(Document):
    email: Indexed(EmailStr, unique=True)
    hashed_password: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool = True
    must_change_password: bool = True
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    created_by: Optional[str] = None
    last_login: Optional[datetime] = None
    login_count: int = 0
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    class Settings:
        name = "users"
        indexes = ["email", "role", "is_active"]
