from beanie import Document
from pydantic import Field
from typing import Optional, Dict
from datetime import datetime, timezone
from enum import Enum


class NotificationType(str, Enum):
    ACCOUNT_CREATED = "account_created"
    PASSWORD_RESET = "password_reset"
    APPOINTMENT_CREATED = "appointment_created"
    APPOINTMENT_UPDATED = "appointment_updated"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    REPORT_APPROVED = "report_approved"
    REPORT_PUBLISHED = "report_published"
    REPORT_REJECTED = "report_rejected"
    SCAN_ASSIGNED = "scan_assigned"
    SCAN_COMPLETED = "scan_completed"
    GENERAL = "general"


class Notification(Document):
    user_id: str
    type: NotificationType
    title: str
    message: str
    is_read: bool = False
    metadata: Dict = {}
    email_sent: bool = False
    email_sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "notifications"
        indexes = ["user_id", "is_read", "type"]
