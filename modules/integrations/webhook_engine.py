import logging
import uuid
import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from modules.event_system.event_bus import publish_event

logger = logging.getLogger(__name__)

# Simulated in-memory webhook endpoint configurations
_webhooks: Dict[str, dict] = {}
# Webhook invocation metrics log
_webhook_activity = []

def create_webhook_endpoint(name: str, target_workflow: str, source_service: str) -> dict:
    webhook_id = str(uuid.uuid4())
    endpoint = {
        "id": webhook_id,
        "name": name,
        "target_workflow": target_workflow,
        "source_service": source_service,
        "url": f"http://localhost:8000/api/v1/integrations/webhooks/receive/{webhook_id}",
        "status": "active",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    _webhooks[webhook_id] = endpoint
    logger.info(f"Webhook Engine: Registered webhook endpoint '{name}' -> URL: {endpoint['url']}")
    return endpoint

def receive_webhook_event(db: Session, webhook_id: str, payload: dict) -> dict:
    """
    Receives incoming webhook request payloads, logs the activity,
    and publishes a corresponding event to the central Day 13 Event Bus.
    """
    if webhook_id not in _webhooks:
        logger.warning(f"Webhook Engine: Blocked request on unregistered ID '{webhook_id}'")
        return {"status": "error", "message": "Webhook endpoint not found."}
    
    endpoint = _webhooks[webhook_id]
    
    # Log webhook activity metrics
    activity_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "webhook_id": webhook_id,
        "name": endpoint["name"],
        "payload": payload,
        "status": "success"
    }
    _webhook_activity.append(activity_entry)
    
    # 1. Publish Event to Event Bus (e.g. integrations_webhook_event)
    event_type = f"webhook_{endpoint['source_service']}_event"
    event_payload = {
        "webhook_id": webhook_id,
        "endpoint_name": endpoint["name"],
        "target_workflow": endpoint["target_workflow"],
        "service": endpoint["source_service"],
        "data": payload
    }
    
    logger.info(f"Webhook Engine: Received event on '{endpoint['name']}'. Piping to Event Bus...")
    publish_event(db, event_type=event_type, source_module="integrations_hub", payload=event_payload)
    
    return {"status": "success", "event_type": event_type, "message": "Event published to Event Bus."}

def list_webhooks() -> List[dict]:
    return list(_webhooks.values())

def get_webhook_activity() -> List[dict]:
    return _webhook_activity
