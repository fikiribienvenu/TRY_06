from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime, timezone
from typing import Optional
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse, PatientListResponse
from app.core.dependencies import require_role, get_current_active_user
from app.core.security import hash_password, generate_random_password
from app.core.permissions import Role
from app.services import email_service, audit_service
from app.models.audit_log import AuditAction
from app.utils.helpers import generate_patient_id
from beanie.operators import Or, RegEx

router = APIRouter(prefix="/patients", tags=["Patients"])


def _to_response(p: Patient) -> PatientResponse:
    return PatientResponse(
        id=str(p.id),
        patient_id=p.patient_id,
        first_name=p.first_name,
        last_name=p.last_name,
        full_name=p.full_name,
        gender=p.gender,
        date_of_birth=p.date_of_birth,
        age=p.age,
        national_id=p.national_id,
        phone=p.phone,
        email=p.email,
        address=p.address,
        emergency_contact_name=p.emergency_contact_name,
        emergency_contact_phone=p.emergency_contact_phone,
        blood_type=p.blood_type,
        assigned_doctor_id=p.assigned_doctor_id,
        is_active=p.is_active,
        created_at=p.created_at,
    )


@router.post("", response_model=PatientResponse, status_code=201)
async def register_patient(
    body: PatientCreate,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    existing = await Patient.find_one(Patient.national_id == body.national_id)
    if existing:
        raise HTTPException(status_code=409, detail="Patient with this National ID already exists")

    patient = Patient(
        patient_id=generate_patient_id(),
        registered_by=str(actor.id),
        **body.model_dump(),
    )
    await patient.insert()

    # Create patient user account
    temp_password = generate_random_password()
    patient_user = User(
        email=body.email,
        hashed_password=hash_password(temp_password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=UserRole.PATIENT,
        phone=body.phone,
        must_change_password=True,
        created_by=str(actor.id),
    )
    await patient_user.insert()

    patient.user_id = str(patient_user.id)
    await patient.save()

    await email_service.send_credentials_email(
        to=body.email,
        full_name=patient.full_name,
        email=body.email,
        password=temp_password,
        role="patient",
    )

    await audit_service.log(
        action=AuditAction.PATIENT_CREATED,
        description=f"Receptionist {actor.email} registered patient {patient.patient_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="patient",
        resource_id=str(patient.id),
    )

    return _to_response(patient)


@router.get("", response_model=PatientListResponse)
async def list_patients(
    search: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(require_role(
        Role.DIRECTOR, Role.RECEPTIONIST, Role.JUNIOR_DOCTOR, Role.SENIOR_DOCTOR
    )),
):
    query_filter = []

    if actor.role == UserRole.JUNIOR_DOCTOR:
        query_filter.append(Patient.assigned_doctor_id == str(actor.id))
    elif doctor_id:
        query_filter.append(Patient.assigned_doctor_id == doctor_id)

    if search:
        search_filter = Or(
            RegEx(Patient.first_name, search, "i"),
            RegEx(Patient.last_name, search, "i"),
            RegEx(Patient.patient_id, search, "i"),
            RegEx(Patient.national_id, search, "i"),
            RegEx(Patient.phone, search, "i"),
            RegEx(Patient.email, search, "i"),
        )
        query_filter.append(search_filter)

    query = Patient.find(*query_filter)
    total = await query.count()
    patients = await query.skip((page - 1) * page_size).limit(page_size).to_list()

    return PatientListResponse(
        patients=[_to_response(p) for p in patients],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: str,
    actor: User = Depends(get_current_active_user),
):
    patient = await Patient.get(patient_id)
    if not patient:
        patient = await Patient.find_one(Patient.patient_id == patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if actor.role == UserRole.PATIENT and patient.user_id != str(actor.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return _to_response(patient)


@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: str,
    body: PatientUpdate,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for k, v in body.model_dump(exclude_none=True).items():
        setattr(patient, k, v)
    patient.updated_at = datetime.now(timezone.utc)
    await patient.save()

    await audit_service.log(
        action=AuditAction.PATIENT_UPDATED,
        description=f"{actor.email} updated patient {patient.patient_id}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="patient",
        resource_id=str(patient.id),
    )
    return _to_response(patient)


@router.post("/{patient_id}/assign-doctor")
async def assign_doctor(
    patient_id: str,
    doctor_id: str,
    actor: User = Depends(require_role(Role.RECEPTIONIST, Role.DIRECTOR)),
):
    patient = await Patient.get(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = await User.get(doctor_id)
    if not doctor or doctor.role != UserRole.JUNIOR_DOCTOR:
        raise HTTPException(status_code=404, detail="Junior doctor not found")

    patient.assigned_doctor_id = doctor_id
    patient.updated_at = datetime.now(timezone.utc)
    await patient.save()
    return {"message": f"Patient assigned to Dr. {doctor.full_name}"}
