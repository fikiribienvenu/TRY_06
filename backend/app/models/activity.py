from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone


class Activity(Document):
    user_id: str
    user_role: str
    action: str
    description: str
    related_id: Optional[str] = None
    related_type: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "activities"
        indexes = ["user_id", "user_role", "created_at"]
