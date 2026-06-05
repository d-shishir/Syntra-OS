import time
import urllib.request
import urllib.error
import json
import threading
import uuid
import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal
from modules.api_gateway.models import WebhookSubscription, WebhookAttempt

logger = logging.getLogger(__name__)

def dispatch_webhook_async(subscription_id: uuid.UUID, event_type: str, payload: dict):
    """
    Spawns a background thread to handle webhook delivery.
    """
    thread = threading.Thread(
        target=dispatch_webhook_sync,
        args=(subscription_id, event_type, payload)
    )
    thread.daemon = True
    thread.start()

def dispatch_webhook_sync(subscription_id: uuid.UUID, event_type: str, payload: dict):
    """
    Sends the webhook HTTP request using urllib and performs retries on failure.
    """
    db = SessionLocal()
    try:
        sub = db.query(WebhookSubscription).filter(WebhookSubscription.id == subscription_id).first()
        if not sub or not sub.is_active:
            return

        headers = {
            "Content-Type": "application/json",
            "X-Syntra-Webhook-Secret": sub.secret,
            "X-Syntra-Event-Type": event_type,
            "User-Agent": "Syntra-Webhook-Agent/1.0"
        }

        data = json.dumps(payload).encode("utf-8")
        max_attempts = 3
        attempt_count = 0
        success = False
        status_code = None
        error_msg = None

        while attempt_count < max_attempts and not success:
            attempt_count += 1
            req = urllib.request.Request(
                sub.target_url,
                data=data,
                headers=headers,
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as response:
                    status_code = response.status
                    if 200 <= status_code < 300:
                        success = True
                    else:
                        error_msg = f"Returned status code {status_code}"
            except urllib.error.HTTPError as e:
                status_code = e.code
                error_msg = f"HTTP Error {e.code}: {e.reason}"
            except urllib.error.URLError as e:
                status_code = 0
                error_msg = f"URL Error: {e.reason}"
            except Exception as e:
                status_code = 0
                error_msg = str(e)

            # Log webhook attempt record
            attempt = WebhookAttempt(
                subscription_id=sub.id,
                event_type=event_type,
                payload=payload,
                status_code=status_code,
                status="Success" if success else ("Retrying" if attempt_count < max_attempts else "Failed"),
                error_message=error_msg,
                attempt_count=attempt_count
            )
            db.add(attempt)
            db.commit()

            if not success and attempt_count < max_attempts:
                # Exponential backoff delay
                time.sleep(attempt_count * 2)

    except Exception as e:
        logger.error(f"Error executing webhook dispatch: {e}")
    finally:
        db.close()

def trigger_webhooks_for_event(org_id: uuid.UUID, event_type: str, payload: dict):
    """
    Dispatches webhooks registered for a specific event type in an organization.
    """
    db = SessionLocal()
    try:
        subs = db.query(WebhookSubscription).filter(
            WebhookSubscription.organization_id == org_id,
            WebhookSubscription.is_active == True
        ).all()

        for sub in subs:
            if event_type in sub.events or "*" in sub.events:
                dispatch_webhook_async(sub.id, event_type, payload)
    except Exception as e:
        logger.error(f"Error querying webhooks: {e}")
    finally:
        db.close()
