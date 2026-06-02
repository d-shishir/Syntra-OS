import json
import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from modules.notification_hub.models import Notification, UserNotificationPreference, NotificationHistory
from modules.notification_hub.notification_manager import send_notification
from modules.notification_hub.preference_manager import save_preferences, get_preferences
from modules.notification_hub.escalation_notifier import escalate_notification
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/send", status_code=status.HTTP_201_CREATED)
def api_send_notification(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notif_type = payload.get("type")
    priority = payload.get("priority", "medium")
    recipient = payload.get("recipient")
    title = payload.get("title")
    body_payload = payload.get("payload", {})
    module = payload.get("module", "system")

    if not notif_type or not recipient or not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fields 'type', 'recipient', and 'title' are required."
        )

    try:
        notif = send_notification(db, notif_type, priority, recipient, title, body_payload, module)
        return {"status": "success", "notification": notif.to_dict()}
    except Exception as e:
        logger.exception("API: failed to dispatch notification")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("", response_model=list[dict])
def get_notifications(recipient: str | None = None, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Notification)
    if recipient:
        query = query.filter(Notification.recipient == recipient)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [n.to_dict() for n in notifications]

@router.get("/history", response_model=list[dict])
def get_notification_history(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    history = db.query(NotificationHistory).order_by(NotificationHistory.sent_at.desc()).limit(limit).all()
    return [h.to_dict() for h in history]

@router.get("/preferences/{recipient}", response_model=dict)
def get_user_preferences(recipient: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pref = get_preferences(db, recipient)
    return pref.to_dict()

@router.post("/preferences", response_model=dict)
def save_user_preferences(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recipient = payload.get("recipient")
    if not recipient:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Field 'recipient' is required.")
    pref = save_preferences(db, recipient, payload)
    return {"status": "success", "preferences": pref.to_dict()}

@router.post("/{id}/escalate", response_model=dict)
def api_escalate_notification(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        notif = escalate_notification(db, id)
        return {"status": "success", "message": "Notification escalated successfully", "notification": notif.to_dict()}
    except Exception as e:
        logger.exception("API: failed to escalate notification")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/stream")
async def notifications_stream(current_user: User = Depends(get_current_user)):
    """
    SSE endpoint for live notifications.
    Creates an asyncio queue and registers it with the Realtime Gateway.
    """
    queue = asyncio.Queue()
    from modules.notification_hub.realtime_gateway import register_listener, unregister_listener
    register_listener(queue)
    
    async def sse_generator():
        try:
            while True:
                # Wait for a new broadcasted notification
                notif_dict = await queue.get()
                yield f"data: {json.dumps(notif_dict)}\n\n"
        except asyncio.CancelledError:
            logger.info("SSE Stream: Client disconnected.")
        finally:
            unregister_listener(queue)
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.get("/{id}", response_model=dict)
def get_notification_by_id(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import uuid
    try:
        n_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid notification ID format.")
    notif = db.query(Notification).filter(Notification.id == n_uuid).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return notif.to_dict()
