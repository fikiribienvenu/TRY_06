from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime, timezone
from typing import Optional
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.core.dependencies import require_role, get_current_active_user
from app.core.security import hash_password, generate_random_password
from app.core.permissions import CREATABLE_ROLES_BY, Role
from app.services import email_service, audit_service
from app.models.audit_log import AuditAction
from beanie.operators import In, RegEx

router = APIRouter(prefix="/users", tags=["Users"])


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        must_change_password=user.must_change_password,
        phone=user.phone,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    actor: User = Depends(require_role(Role.DIRECTOR, Role.RECEPTIONIST)),
):
    actor_role = Role(actor.role)
    allowed = CREATABLE_ROLES_BY.get(actor_role, [])
    if Role(body.role) not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You cannot create users with role '{body.role}'",
        )

    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    temp_password = generate_random_password()
    user = User(
        email=body.email,
        hashed_password=hash_password(temp_password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=body.role,
        phone=body.phone,
        must_change_password=True,
        created_by=str(actor.id),
    )
    await user.insert()

    await email_service.send_credentials_email(
        to=body.email,
        full_name=user.full_name,
        email=body.email,
        password=temp_password,
        role=body.role,
    )

    await audit_service.log(
        action=AuditAction.USER_CREATED,
        description=f"{actor.email} created user {body.email} with role {body.role}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="user",
        resource_id=str(user.id),
    )

    return _user_to_response(user)


@router.get("/junior-doctors/list")
async def list_junior_doctors(
    actor: User = Depends(require_role(Role.DIRECTOR, Role.RECEPTIONIST)),
):
    """Public-ish endpoint — Receptionists need this to assign patients to doctors."""
    doctors = await User.find(
        User.role == UserRole.JUNIOR_DOCTOR,
        User.is_active == True,
    ).to_list()
    return {"users": [_user_to_response(d) for d in doctors]}


@router.get("", response_model=UserListResponse)
async def list_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(require_role(Role.DIRECTOR)),
):
    query = User.find()
    if role:
        query = User.find(User.role == role)
    if is_active is not None:
        query = query.find(User.is_active == is_active)

    total = await query.count()
    users = await query.skip((page - 1) * page_size).limit(page_size).to_list()

    return UserListResponse(
        users=[_user_to_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, actor: User = Depends(require_role(Role.DIRECTOR))):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_to_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    actor: User = Depends(require_role(Role.DIRECTOR)),
):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    before = {"first_name": user.first_name, "last_name": user.last_name, "is_active": user.is_active}
    update_data = body.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(user, k, v)
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    await audit_service.log(
        action=AuditAction.USER_UPDATED,
        description=f"{actor.email} updated user {user.email}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="user",
        resource_id=str(user.id),
        before_state=before,
        after_state=update_data,
    )
    return _user_to_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, actor: User = Depends(require_role(Role.DIRECTOR))):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(actor.id):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await user.delete()
    await audit_service.log(
        action=AuditAction.USER_DELETED,
        description=f"{actor.email} deleted user {user.email}",
        actor_id=str(actor.id),
        actor_email=actor.email,
        actor_role=actor.role,
        resource_type="user",
        resource_id=user_id,
    )


@router.post("/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(user_id: str, actor: User = Depends(require_role(Role.DIRECTOR))):
    user = await User.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    user.updated_at = datetime.now(timezone.utc)
    await user.save()
    action = AuditAction.USER_UPDATED
    return _user_to_response(user)
