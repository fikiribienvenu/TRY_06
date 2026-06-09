from beanie import Document
from pydantic import Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum


class AuditAction(str, Enum):
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_DISABLED = "user_disabled"
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGED = "password_changed"
    PATIENT_CREATED = "patient_created"
    PATIENT_UPDATED = "patient_updated"
    CT_SCAN_UPLOADED = "ct_scan_uploaded"
    PREDICTION_GENERATED = "prediction_generated"
    REPORT_CREATED = "report_created"
    REPORT_APPROVED = "report_approved"
    REPORT_REJECTED = "report_rejected"
    REPORT_PUBLISHED = "report_published"
    APPOINTMENT_CREATED = "appointment_created"
    APPOINTMENT_UPDATED = "appointment_updated"
    REPORT_EXPORTED = "report_exported"


class AuditLog(Document):
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: AuditAction
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    success: bool = True
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "audit_logs"
        indexes = ["actor_id", "action", "resource_type", "created_at"]
