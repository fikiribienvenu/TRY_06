from fastapi import APIRouter, HTTPException, status, Request, Depends
from datetime import datetime, timezone
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ChangePasswordRequest, ForgotPasswordRequest,
)
from app.models.user import User
from app.core.security import (
    verify_password, hash_password, create_token_pair,
    decode_refresh_token,
)
from app.core.dependencies import get_current_active_user
from app.models.audit_log import AuditAction
from app.services import audit_service
from app.services.notification_service import create_notification
from app.models.notification import NotificationType
import re

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _validate_password_strength(password: str) -> bool:
    return (
        len(password) >= 8
        and re.search(r"[A-Z]", password)
        and re.search(r"[a-z]", password)
        and re.search(r"\d", password)
        and re.search(r"[!@#$%^&*]", password)
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    user = await User.find_one(User.email == body.email)
    ip = request.client.host if request.client else "unknown"

    if not user or not verify_password(body.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            await user.save()
        await audit_service.log(
            action=AuditAction.LOGIN_FAILED,
            description=f"Failed login for {body.email}",
            actor_email=body.email,
            ip_address=ip,
            success=False,
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user.last_login = datetime.now(timezone.utc)
    user.login_count += 1
    user.failed_login_attempts = 0
    await user.save()

    access, refresh = create_token_pair(str(user.id), user.role, user.must_change_password)

    await audit_service.log(
        action=AuditAction.LOGIN_SUCCESS,
        description=f"User {user.email} logged in",
        actor_id=str(user.id),
        actor_email=user.email,
        actor_role=user.role,
        ip_address=ip,
    )

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        must_change_password=user.must_change_password,
        role=user.role,
        user_id=str(user.id),
        full_name=user.full_name,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await User.get(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access, refresh = create_token_pair(str(user.id), user.role, user.must_change_password)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        must_change_password=user.must_change_password,
        role=user.role,
        user_id=str(user.id),
        full_name=user.full_name,
    )


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_active_user),
):
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if not _validate_password_strength(body.new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must be 8+ chars with uppercase, lowercase, digit, and special character (!@#$%^&*)",
        )

    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = False
    user.updated_at = datetime.now(timezone.utc)
    await user.save()

    await audit_service.log(
        action=AuditAction.PASSWORD_CHANGED,
        description=f"User {user.email} changed their password",
        actor_id=str(user.id),
        actor_email=user.email,
        actor_role=user.role,
    )

    return {"message": "Password changed successfully"}


@router.get("/me")
async def get_me(user: User = Depends(get_current_active_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "must_change_password": user.must_change_password,
        "last_login": user.last_login,
    }


@router.post("/logout")
async def logout(user: User = Depends(get_current_active_user)):
    await audit_service.log(
        action=AuditAction.LOGOUT,
        description=f"User {user.email} logged out",
        actor_id=str(user.id),
        actor_email=user.email,
        actor_role=user.role,
    )
    return {"message": "Logged out successfully"}
