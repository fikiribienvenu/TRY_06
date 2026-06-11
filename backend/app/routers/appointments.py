from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.models.schedule import ScheduleSlot
from app.models.ct_scan import CTScan, ScanStatus, Priority
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import notification_service, audit_service, email_service
from app.models.notification import NotificationType
from app.models.audit_log import AuditAction


class AppointmentConfirm(BaseModel):
    slot_id: str
    notes: Optional[str] = None


class AppointmentReject(BaseModel):
    reason: str
    next_available: Optional[str] = None


def _slot_duration(start: str, end: str) -> int:
    try:
        sh, sm = map(int, start.split(":"))
        eh, em = map(int, end.split(":"))
        return (eh * 60 + em) - (sh * 60 + sm)
    except Exception:
        return 30

router = APIRouter(prefix="/appointments", tags=["Appointments"])


def _to_response(a: Appointment) -> AppointmentResponse:
    return AppointmentResponse(
        id=str(a.id),
        patient_id=a.patient_id,
        doctor_id=a.doctor_id,
        appointment_type=a.appointment_type,
        status=a.status,
        scheduled_at=a.scheduled_at,
        duration_minutes=a.duration_minutes,
        notes=a.notes,
        ct_scan_id=a.ct_scan_id,
        created_at=a.created_at,
    )


@router.post("", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    actor: User = Depends(get_current_active_user),
):
    patient_id = body.patient_id
    # Resolve "me" — patient requesting for themselves
    if patient_id == "me" and actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if not patient:
            raise HTTPException(404, "Patient record not found for your account")
        patient_id = str(patient.id)

    apt = Appointment(
        patient_id=patient_id,
        doctor_id=body.doctor_id,
        appointment_type=body.appointment_type,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
        notes=body.notes,
        requested_by_patient=(actor.role == UserRole.PATIENT),
    )

    if actor.role == UserRole.RECEPTIONIST:
        apt.receptionist_id = str(actor.id)
        apt.status = AppointmentStatus.SCHEDULED
    else:
        apt.status = AppointmentStatus.REQUESTED

    await apt.insert()

    # Notify receptionist if patient requests
    if actor.role == UserRole.PATIENT:
        receptionists = await User.find(User.role == UserRole.RECEPTIONIST, User.is_active == True).to_list()
        for rec in receptionists[:3]:
            await notification_service.create_notification(
                user_id=str(rec.id),
                notification_type=NotificationType.APPOINTMENT_CREATED,
                title="New Appointment Request",
                message=f"Patient has requested a {body.appointment_type.replace('_', ' ')} appointment.",
                metadata={"appointment_id": str(apt.id)},
            )

    await audit_service.log(
        action=AuditAction.APPOINTMENT_CREATED,
        description=f"Appointment created for patient {body.patient_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="appointment",
        resource_id=str(apt.id),
    )

    return _to_response(apt)


@router.get("")
async def list_appointments(
    patient_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(get_current_active_user),
):
    filters = []
    if actor.role == UserRole.PATIENT:
        patient = await Patient.find_one(Patient.user_id == str(actor.id))
        if patient:
            filters.append(Appointment.patient_id == str(patient.id))
    elif actor.role == UserRole.JUNIOR_DOCTOR:
        filters.append(Appointment.doctor_id == str(actor.id))
    elif patient_id:
        filters.append(Appointment.patient_id == patient_id)

    if status:
        filters.append(Appointment.status == status)

    query = Appointment.find(*filters)
    total = await query.count()
    apts = await query.sort(-Appointment.created_at).skip((page - 1) * page_size).limit(page_size).to_list()

    # Enrich for Receptionist and Director with names
    if actor.role in (UserRole.RECEPTIONIST, UserRole.DIRECTOR):
        result = []
        for a in apts:
            patient = await Patient.get(a.patient_id)
            item = _to_response(a).model_dump()
            item["patient_name"]  = patient.full_name if patient else None
            item["patient_code"]  = patient.patient_id if patient else None
            item["patient_email"] = patient.email if patient else None
            if a.doctor_id:
                doctor = await User.get(a.doctor_id)
                item["doctor_name"] = doctor.full_name if doctor else None
            result.append(item)
        return {"appointments": result, "total": total, "page": page, "page_size": page_size}

    return {
        "appointments": [_to_response(a) for a in apts],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/{apt_id}", response_model=AppointmentResponse)
async def update_appointment(
    apt_id: str,
    body: AppointmentUpdate,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    apt = await Appointment.get(apt_id)
    if not apt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(apt, k, v)
    apt.updated_at = datetime.now(timezone.utc)
    await apt.save()

    # Notify patient
    patient = await Patient.get(apt.patient_id)
    if patient and patient.user_id:
        await notification_service.create_notification(
            user_id=patient.user_id,
            notification_type=NotificationType.APPOINTMENT_UPDATED,
            title="Appointment Updated",
            message=f"Your appointment status is now: {apt.status}",
        )

    await audit_service.log(
        action=AuditAction.APPOINTMENT_UPDATED,
        description=f"Appointment {apt_id} updated to status {apt.status}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="appointment",
        resource_id=apt_id,
    )
    return _to_response(apt)


@router.post("/{apt_id}/confirm")
async def confirm_appointment(
    apt_id: str,
    body: AppointmentConfirm,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    apt = await Appointment.get(apt_id)
    if not apt:
        raise HTTPException(404, "Appointment not found")
    if apt.status != AppointmentStatus.REQUESTED:
        raise HTTPException(400, "Only pending (requested) appointments can be confirmed")

    slot = await ScheduleSlot.get(body.slot_id)
    if not slot:
        raise HTTPException(404, "Schedule slot not found")
    if not slot.is_active:
        raise HTTPException(400, "This slot is no longer active")
    if slot.booked_count >= slot.max_patients:
        raise HTTPException(400, "This slot is fully booked")

    slot_dt = datetime.fromisoformat(f"{slot.date}T{slot.start_time}:00")

    apt.status        = AppointmentStatus.SCHEDULED
    apt.doctor_id     = slot.doctor_id
    apt.receptionist_id = str(actor.id)
    apt.scheduled_at  = slot_dt
    apt.duration_minutes = _slot_duration(slot.start_time, slot.end_time)
    if body.notes:
        apt.notes = body.notes
    apt.updated_at = datetime.now(timezone.utc)
    await apt.save()

    slot.booked_count += 1
    slot.updated_at = datetime.now(timezone.utc)
    await slot.save()

    patient = await Patient.get(apt.patient_id)
    doctor  = await User.get(slot.doctor_id)
    doctor_name = doctor.full_name if doctor else slot.doctor_name

    if patient:
        patient.assigned_doctor_id = slot.doctor_id
        await patient.save()

        if patient.email:
            await email_service.send_appointment_email(
                to=patient.email,
                patient_name=patient.full_name,
                appointment_type=apt.appointment_type.replace("_", " ").title(),
                scheduled_at=f"{slot.date}  {slot.start_time} – {slot.end_time}",
                status="confirmed",
                doctor_name=doctor_name,
            )

        if patient.user_id:
            await notification_service.create_notification(
                user_id=patient.user_id,
                notification_type=NotificationType.APPOINTMENT_CREATED,
                title="Appointment Confirmed",
                message=f"Your appointment with Dr. {doctor_name} is confirmed for {slot.date} at {slot.start_time}.",
                metadata={"appointment_id": apt_id},
            )

    # Create a CT scan request assigned to the confirmed doctor
    # so it appears in their scan queue immediately
    ct_scan = CTScan(
        patient_id=apt.patient_id,
        requested_by=str(actor.id),
        assigned_doctor_id=slot.doctor_id,
        file_path="",
        file_name="",
        file_type="",
        file_size_kb=0,
        priority=Priority.NORMAL,
        status=ScanStatus.ASSIGNED,
        scan_date=slot_dt,
        notes=body.notes or apt.notes,
    )
    await ct_scan.insert()

    # Link the scan back to the appointment
    apt.ct_scan_id = str(ct_scan.id)
    await apt.save()

    if doctor:
        patient_name = patient.full_name if patient else "A patient"
        await notification_service.create_notification(
            user_id=slot.doctor_id,
            notification_type=NotificationType.APPOINTMENT_CREATED,
            title="New Patient Assigned — CT Scan Ready",
            message=f"{patient_name} is scheduled for {slot.date} at {slot.start_time}. A CT scan has been created in your queue.",
            metadata={"appointment_id": apt_id, "ct_scan_id": str(ct_scan.id)},
        )

    await audit_service.log(
        action=AuditAction.APPOINTMENT_UPDATED,
        description=f"{actor.email} confirmed appointment {apt_id} into slot {slot.date} {slot.start_time}, CT scan {ct_scan.id} created",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="appointment",
        resource_id=apt_id,
    )

    return {
        "appointment_id": apt_id,
        "ct_scan_id":     str(ct_scan.id),
        "patient_name":   patient.full_name if patient else None,
        "doctor_name":    doctor_name,
        "date":           slot.date,
        "start_time":     slot.start_time,
        "end_time":       slot.end_time,
        "status":         apt.status,
    }


@router.post("/{apt_id}/reject")
async def reject_appointment(
    apt_id: str,
    body: AppointmentReject,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    apt = await Appointment.get(apt_id)
    if not apt:
        raise HTTPException(404, "Appointment not found")
    if apt.status not in [AppointmentStatus.REQUESTED, AppointmentStatus.SCHEDULED]:
        raise HTTPException(400, "Cannot reject this appointment in its current state")

    apt.status = AppointmentStatus.CANCELLED
    apt.cancellation_reason = body.reason
    apt.updated_at = datetime.now(timezone.utc)
    await apt.save()

    patient = await Patient.get(apt.patient_id)
    if patient:
        if patient.email:
            await email_service.send_appointment_rejection_email(
                to=patient.email,
                patient_name=patient.full_name,
                appointment_type=apt.appointment_type.replace("_", " ").title(),
                reason=body.reason,
                next_available=body.next_available,
            )

        if patient.user_id:
            next_msg = f" Next available: {body.next_available}." if body.next_available else ""
            await notification_service.create_notification(
                user_id=patient.user_id,
                notification_type=NotificationType.APPOINTMENT_CANCELLED,
                title="Appointment Request Not Confirmed",
                message=f"Your {apt.appointment_type.replace('_', ' ')} request was not confirmed. Reason: {body.reason}.{next_msg}",
                metadata={
                    "appointment_id": apt_id,
                    "next_available": body.next_available,
                },
            )

    await audit_service.log(
        action=AuditAction.APPOINTMENT_UPDATED,
        description=f"{actor.email} rejected appointment {apt_id}: {body.reason}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="appointment",
        resource_id=apt_id,
    )

    return {"message": "Appointment rejected", "appointment_id": apt_id}
