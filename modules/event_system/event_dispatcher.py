import logging
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor
from app.database import SessionLocal
from modules.event_system.models import EventRecord
from modules.event_system.event_registry import event_registry

logger = logging.getLogger(__name__)

# Thread pool for non-blocking asynchronous event callbacks
_executor = ThreadPoolExecutor(max_workers=4)

def _run_callback_async(callback, event_id, callback_name):
    """
    Invokes callback synchronously in a background thread using a fresh DB session.
    """
    db = SessionLocal()
    try:
        from modules.event_system.models import EventRecord
        event = db.query(EventRecord).filter(EventRecord.id == event_id).first()
        if not event:
            logger.warning(f"Event Dispatcher Async: Event {event_id} not found in database for callback {callback_name}")
            return
            
        logger.info(f"Event Dispatcher Async: invoking callback '{callback_name}' for event '{event.event_type}'")
        callback(event, db)
    except Exception as e:
        logger.error(f"Event Dispatcher Async: error executing callback '{callback_name}' for event: {str(e)}", exc_info=True)
        try:
            from modules.observability.error_tracker import error_tracker
            import traceback
            error_tracker.capture_error(
                module="event_dispatcher",
                error_message=f"Callback failed: {str(e)}",
                stack_trace=traceback.format_exc(),
                input_context={"event_id": str(event_id), "callback": callback_name},
                db=db
            )
        except Exception as inner:
            logger.error(f"Event Dispatcher Async: failed to log error in observability: {str(inner)}")
    finally:
        db.close()

def dispatch_event(db: Session, event: EventRecord):
    """
    Finds all subscriber callbacks registered for this event type and executes them.
    Each subscriber runs in a safe execution block.
    """
    try:
        from modules.dashboard_aggregator.activity_feed import feed_manager
        payload = event.payload or {}
        msg = f"System event '{event.event_type}' published."
        if isinstance(payload, dict):
            msg = payload.get("message") or payload.get("description") or payload.get("title") or msg
        feed_manager.broadcast({
            "event_type": event.event_type,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "source": event.source_module,
            "message": msg,
            "severity": event.priority if event.priority in ["low", "medium", "high", "critical"] else "medium"
        })
    except Exception as e:
        logger.warning(f"Event Dispatcher: Failed to broadcast event: {str(e)}")
    
    subscribers = event_registry.get_subscribers(event.event_type)
    if not subscribers:
        logger.info(f"Event Dispatcher: no subscribers registered for event '{event.event_type}'")
        return

    logger.info(f"Event Dispatcher: dispatching event '{event.event_type}' to {len(subscribers)} subscribers in thread pool")
    
    for callback in subscribers:
        callback_name = callback.__name__ if hasattr(callback, '__name__') else str(callback)
        _executor.submit(_run_callback_async, callback, event.id, callback_name)
