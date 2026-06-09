from app.models.notification import Notification, NotificationType
from app.services import email_service
from loguru import logger
from typing import Optional


async def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    message: str,
    metadata: dict = None,
    send_email_to: Optional[str] = None,
    email_subject: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        metadata=metadata or {},
    )
    await notif.insert()

    if send_email_to and email_subject:
        html = f"""
        <html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a3c5e;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">PulmoScan AI</h1>
        </div>
        <div style="padding:30px;">
            <h2>{title}</h2>
            <p>{message}</p>
        </div>
        </body></html>
        """
        sent = await email_service.send_email(send_email_to, email_subject, html)
        if sent:
            from datetime import datetime, timezone
            notif.email_sent = True
            notif.email_sent_at = datetime.now(timezone.utc)
            await notif.save()

    return notif


async def mark_read(notification_id: str, user_id: str) -> bool:
    notif = await Notification.get(notification_id)
    if notif and notif.user_id == user_id:
        notif.is_read = True
        await notif.save()
        return True
    return False


async def get_unread_count(user_id: str) -> int:
    return await Notification.find(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).count()
