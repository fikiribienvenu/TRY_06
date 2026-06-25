from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, date as date_type
from typing import Optional
from pydantic import BaseModel
from app.models.schedule import ScheduleSlot
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import email_service, notification_service, audit_service
from app.models.audit_log import AuditAction

router = APIRouter(prefix="/schedule", tags=["Schedule"])


# ── Schemas ────────────────────────────────────────────────────────────

class SlotCreate(BaseModel):
    date:          str   # "YYYY-MM-DD"
    start_time:    str   # "HH:MM"
    end_time:      str   # "HH:MM"
    max_patients:  int = 1
    notes:         Optional[str] = None


class SlotUpdate(BaseModel):
    start_time:    Optional[str] = None
    end_time:      Optional[str] = None
    max_patients:  Optional[int] = None
    is_active:     Optional[bool] = None
    notes:         Optional[str] = None


class BookSlotRequest(BaseModel):
    slot_id:          str
    patient_id:       str
    appointment_type: str = "ct_scan"
    notes:            Optional[str] = None


def _slot_out(s: ScheduleSlot) -> dict:
    return {
        "id":            str(s.id),
        "doctor_id":     s.doctor_id,
        "doctor_name":   s.doctor_name,
        "date":          s.date,
        "start_time":    s.start_time,
        "end_time":      s.end_time,
        "max_patients":  s.max_patients,
        "booked_count":  s.booked_count,
        "available":     s.max_patients - s.booked_count,
        "is_active":     s.is_active,
        "is_full":       s.booked_count >= s.max_patients,
        "notes":         s.notes,
        "created_at":    s.created_at,
    }


# ── Radiologist — manage own slots ──────────────────────────────────

@router.get("/my-slots")
async def get_my_slots(
    include_past: bool = Query(False),
    actor: User = Depends(require_role(Role.RADIOLOGIST))
):
    today = date_type.today().isoformat()
    query = [ScheduleSlot.doctor_id == str(actor.id)]
    if not include_past:
        query.append(ScheduleSlot.date >= today)

    slots = await ScheduleSlot.find(*query).sort("date").to_list()

    # Also attach booked patients per slot
    result = []
    for s in slots:
        slot_dict = _slot_out(s)
        # Get appointments for this slot
        apts = await Appointment.find(
            Appointment.doctor_id == str(actor.id),
            Appointment.scheduled_at != None,
        ).to_list()
        # Match by date+time
        slot_datetime_prefix = f"{s.date}T{s.start_time}"
        booked_patients = []
        for a in apts:
            if a.scheduled_at and a.scheduled_at.isoformat().startswith(slot_datetime_prefix[:16]):
                patient = await Patient.get(a.patient_id)
                if patient:
                    booked_patients.append({
                        "appointment_id": str(a.id),
                        "patient_id":     str(patient.id),
                        "patient_name":   patient.full_name,
                        "patient_pid":    patient.patient_id,
                        "status":         a.status,
                        "notes":          a.notes,
                    })
        slot_dict["booked_patients"] = booked_patients
        result.append(slot_dict)

    return {"slots": result}


@router.post("/my-slots", status_code=201)
async def create_slot(
    body: SlotCreate,
    actor: User = Depends(require_role(Role.RADIOLOGIST)),
):
    # Validate date is not in the past
    if body.date < date_type.today().isoformat():
        raise HTTPException(400, "Cannot create slots in the past")

    # Prevent duplicate
    existing = await ScheduleSlot.find_one(
        ScheduleSlot.doctor_id == str(actor.id),
        ScheduleSlot.date == body.date,
        ScheduleSlot.start_time == body.start_time,
        ScheduleSlot.is_active == True,
    )
    if existing:
        raise HTTPException(400, "A slot for this date and start time already exists")

    slot = ScheduleSlot(
        doctor_id=str(actor.id),
        doctor_name=actor.full_name,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        max_patients=body.max_patients,
        notes=body.notes,
    )
    await slot.insert()
    return _slot_out(slot)


@router.patch("/my-slots/{slot_id}")
async def update_slot(
    slot_id: str,
    body: SlotUpdate,
    actor: User = Depends(require_role(Role.RADIOLOGIST)),
):
    slot = await ScheduleSlot.get(slot_id)
    if not slot or slot.doctor_id != str(actor.id):
        raise HTTPException(404, "Slot not found")
    if slot.booked_count > 0 and body.is_active is False:
        raise HTTPException(400, "Cannot deactivate a slot that already has bookings")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(slot, k, v)
    slot.updated_at = datetime.now(timezone.utc)
    await slot.save()
    return _slot_out(slot)


@router.delete("/my-slots/{slot_id}", status_code=204)
async def delete_slot(
    slot_id: str,
    actor: User = Depends(require_role(Role.RADIOLOGIST)),
):
    slot = await ScheduleSlot.get(slot_id)
    if not slot or slot.doctor_id != str(actor.id):
        raise HTTPException(404, "Slot not found")
    if slot.booked_count > 0:
        raise HTTPException(400, "Cannot delete a slot that already has bookings. Deactivate it instead.")
    await slot.delete()


# ── Receptionist — view availability ──────────────────────────────────

@router.get("/doctors")
async def get_all_doctors_availability(
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    """Returns all active radiologists with their future available slots."""
    today = date_type.today().isoformat()
    doctors = await User.find(
        User.role == UserRole.RADIOLOGIST,
        User.is_active == True,
    ).to_list()

    result = []
    for doc in doctors:
        slots = await ScheduleSlot.find(
            ScheduleSlot.doctor_id == str(doc.id),
            ScheduleSlot.is_active == True,
            ScheduleSlot.date >= today,
        ).sort("date").to_list()

        # Only include slots that still have capacity
        available_slots = [s for s in slots if s.booked_count < s.max_patients]

        result.append({
            "doctor_id":        str(doc.id),
            "doctor_name":      doc.full_name,
            "email":            doc.email,
            "total_slots":      len(slots),
            "available_slots":  len(available_slots),
            "slots":            [_slot_out(s) for s in slots],
        })

    return {"doctors": result}


@router.get("/doctors/{doctor_id}/slots")
async def get_doctor_slots(
    doctor_id: str,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    """Get available (not full) future slots for a specific doctor."""
    today = date_type.today().isoformat()
    doctor = await User.get(doctor_id)
    if not doctor or doctor.role != UserRole.RADIOLOGIST:
        raise HTTPException(404, "Radiologist not found")

    slots = await ScheduleSlot.find(
        ScheduleSlot.doctor_id == doctor_id,
        ScheduleSlot.is_active == True,
        ScheduleSlot.date >= today,
    ).sort("date").to_list()

    return {
        "doctor_id":   str(doctor.id),
        "doctor_name": doctor.full_name,
        "slots":       [_slot_out(s) for s in slots],
    }


# ── Book a slot (Receptionist assigns patient to a slot) ──────────────

@router.post("/book", status_code=201)
async def book_slot(
    body: BookSlotRequest,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    # 1. Get slot
    slot = await ScheduleSlot.get(body.slot_id)
    if not slot:
        raise HTTPException(404, "Slot not found")
    if not slot.is_active:
        raise HTTPException(400, "This slot is no longer active")
    if slot.booked_count >= slot.max_patients:
        raise HTTPException(400, "This slot is fully booked")

    # 2. Get patient
    patient = await Patient.get(body.patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")

    # 3. Check patient not already booked in this slot
    slot_dt_str = f"{slot.date}T{slot.start_time}:00"
    slot_dt = datetime.fromisoformat(slot_dt_str)

    existing_apt = await Appointment.find_one(
        Appointment.patient_id == body.patient_id,
        Appointment.doctor_id == slot.doctor_id,
        Appointment.scheduled_at == slot_dt,
    )
    if existing_apt:
        raise HTTPException(400, "Patient already has an appointment at this time")

    # 4. Create appointment
    apt = Appointment(
        patient_id=body.patient_id,
        doctor_id=slot.doctor_id,
        receptionist_id=str(actor.id),
        appointment_type=body.appointment_type,
        scheduled_at=slot_dt,
        duration_minutes=_duration(slot.start_time, slot.end_time),
        notes=body.notes,
        status=AppointmentStatus.SCHEDULED,
    )
    await apt.insert()

    # 5. Increment slot booked_count
    slot.booked_count += 1
    slot.updated_at = datetime.now(timezone.utc)
    await slot.save()

    # 6. Assign doctor to patient record
    patient.assigned_doctor_id = slot.doctor_id
    await patient.save()

    # 7. Send email to patient
    if patient.email:
        scheduled_display = f"{slot.date}  {slot.start_time} – {slot.end_time}"
        doctor = await User.get(slot.doctor_id)
        doctor_name = doctor.full_name if doctor else slot.doctor_name
        await email_service.send_appointment_email(
            to=patient.email,
            patient_name=patient.full_name,
            appointment_type=body.appointment_type.replace("_", " ").title(),
            scheduled_at=scheduled_display,
            status="scheduled",
            doctor_name=doctor_name,
        )

    # 8. Notify patient in-app
    if patient.user_id:
        await notification_service.create_notification(
            user_id=patient.user_id,
            notification_type=NotificationType.APPOINTMENT_CREATED,
            title="Appointment Scheduled",
            message=f"Your appointment with Dr. {slot.doctor_name} is on {slot.date} at {slot.start_time}.",
            metadata={"appointment_id": str(apt.id), "slot_id": body.slot_id},
        )

    # 9. Notify radiologist in-app
    await notification_service.create_notification(
        user_id=slot.doctor_id,
        notification_type=NotificationType.APPOINTMENT_CREATED,
        title="New Patient Assigned",
        message=f"{patient.full_name} has been scheduled for {slot.date} at {slot.start_time}.",
        metadata={"appointment_id": str(apt.id), "patient_id": body.patient_id},
    )

    # 10. Audit
    await audit_service.log(
        action=AuditAction.APPOINTMENT_CREATED,
        description=f"{actor.email} booked slot {slot.date} {slot.start_time} for patient {patient.patient_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="appointment",
        resource_id=str(apt.id),
    )

    return {
        "appointment_id": str(apt.id),
        "patient_name":   patient.full_name,
        "doctor_name":    slot.doctor_name,
        "date":           slot.date,
        "start_time":     slot.start_time,
        "end_time":       slot.end_time,
        "status":         apt.status,
    }


def _duration(start: str, end: str) -> int:
    """Calculate duration in minutes between HH:MM strings."""
    try:
        sh, sm = map(int, start.split(":"))
        eh, em = map(int, end.split(":"))
        return (eh * 60 + em) - (sh * 60 + sm)
    except Exception:
        return 60
