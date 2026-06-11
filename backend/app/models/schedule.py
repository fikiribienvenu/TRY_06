from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum


class DayOfWeek(str, Enum):
    MONDAY    = "monday"
    TUESDAY   = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY  = "thursday"
    FRIDAY    = "friday"
    SATURDAY  = "saturday"
    SUNDAY    = "sunday"


class ScheduleSlot(Document):
    """
    A specific date+time slot set by a Junior Doctor.
    Each slot has a capacity (max_patients). When a patient is booked,
    booked_count is incremented. Full slots are hidden from the receptionist.
    """
    doctor_id:     str
    doctor_name:   str
    # Specific calendar date  e.g. "2026-06-15"
    date:          str        # "YYYY-MM-DD"
    start_time:    str        # "HH:MM"  e.g. "09:30"
    end_time:      str        # "HH:MM"  e.g. "10:30"
    max_patients:  int = 1
    booked_count:  int = 0
    is_active:     bool = True
    notes:         Optional[str] = None
    created_at:    datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at:    datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_full(self) -> bool:
        return self.booked_count >= self.max_patients

    @property
    def is_available(self) -> bool:
        return self.is_active and not self.is_full

    class Settings:
        name = "schedule_slots"
        indexes = ["doctor_id", "date", "is_active"]
