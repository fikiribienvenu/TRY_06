from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_access_token
from app.models.user import User
from app.core.permissions import Role

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await User.get(payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


def require_role(*roles: Role):
    async def _check(user: User = Depends(get_current_active_user)) -> User:
        if user.role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}",
            )
        return user
    return _check


def require_password_changed():
    async def _check(user: User = Depends(get_current_active_user)) -> User:
        if user.must_change_password:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must change your password before accessing this resource",
            )
        return user
    return _check
