from fastapi import APIRouter, Depends, Query
from app.models.notification import Notification
from app.core.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    unread_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor: User = Depends(get_current_active_user),
):
    filters = [Notification.user_id == str(actor.id)]
    if unread_only:
        filters.append(Notification.is_read == False)

    query = Notification.find(*filters).sort("-created_at")
    total = await query.count()
    notifs = await query.skip((page - 1) * page_size).limit(page_size).to_list()

    return {
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in notifs
        ],
        "total": total,
        "unread_count": await Notification.find(
            Notification.user_id == str(actor.id),
            Notification.is_read == False,
        ).count(),
    }


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, actor: User = Depends(get_current_active_user)):
    notif = await Notification.get(notif_id)
    if notif and notif.user_id == str(actor.id):
        notif.is_read = True
        await notif.save()
    return {"message": "Marked as read"}


@router.post("/read-all")
async def mark_all_read(actor: User = Depends(get_current_active_user)):
    await Notification.find(
        Notification.user_id == str(actor.id),
        Notification.is_read == False,
    ).update({"$set": {"is_read": True}})
    return {"message": "All notifications marked as read"}
