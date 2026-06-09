from app.models.audit_log import AuditLog, AuditAction
from typing import Optional, Dict, Any
from loguru import logger


async def log(
    action: AuditAction,
    description: str,
    actor_id: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    before_state: Optional[Dict[str, Any]] = None,
    after_state: Optional[Dict[str, Any]] = None,
    success: bool = True,
    error_message: Optional[str] = None,
):
    try:
        entry = AuditLog(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            before_state=before_state,
            after_state=after_state,
            success=success,
            error_message=error_message,
        )
        await entry.insert()
    except Exception as e:
        logger.error(f"Audit log failed: {e}")
