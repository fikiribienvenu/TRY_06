from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.core.dependencies import require_role, get_current_active_user
from app.core.permissions import Role
from app.services import notification_service, audit_service
from app.models.notification import NotificationType
from app.models.audit_log import AuditAction

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
        created_at=a.created_at,
    )


@router.post("", response_model=AppointmentResponse, status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    actor: User = Depends(get_current_active_user),
):
    apt = Appointment(
        patient_id=body.patient_id,
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
    apts = await query.skip((page - 1) * page_size).limit(page_size).to_list()

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
