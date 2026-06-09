from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: UserRole
    is_active: bool
    must_change_password: bool
    phone: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    page_size: int
