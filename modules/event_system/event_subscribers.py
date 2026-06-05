import logging
from sqlalchemy.orm import Session
from modules.event_system.event_registry import event_registry
from modules.event_system.job_queue import enqueue_job

logger = logging.getLogger(__name__)

def handle_invoice_uploaded(event, db: Session):
    logger.info(f"Subscriber: Received 'invoice_uploaded' event: {event.id}")
    payload = event.payload or {}
    enqueue_job(
        db=db,
        job_type="invoice_ai_extraction",
        payload=payload,
        priority="high",
        event_id=event.id
    )

def handle_payroll_processed(event, db: Session):
    logger.info(f"Subscriber: Received 'payroll_processed' event: {event.id}")
    payload = event.payload or {}
    enqueue_job(
        db=db,
        job_type="payroll_audit",
        payload=payload,
        priority="critical",
        event_id=event.id
    )

def handle_lead_created(event, db: Session):
    logger.info(f"Subscriber: Received 'lead_created' event: {event.id}")
    payload = event.payload or {}
    enqueue_job(
        db=db,
        job_type="crm_enrichment",
        payload=payload,
        priority="medium",
        event_id=event.id
    )

def handle_anomaly_detected(event, db: Session):
    logger.info(f"Subscriber: Received 'anomaly_detected' event: {event.id}")
    payload = event.payload or {}
    risk_score = payload.get("risk_score", 0.0)
    
    if risk_score > 0.7:
        logger.info(f"High risk anomaly detected ({risk_score}). Triggering approval_required event.")
        from modules.event_system.event_bus import publish_event
        publish_event(
            db=db,
            event_type="approval_required",
            source_module="finance_audit",
            payload={"reason": f"High risk anomaly detected ({risk_score})", "details": payload},
            priority="high"
        )

def handle_approval_required(event, db: Session):
    logger.info(f"Subscriber: Received 'approval_required' event: {event.id}")
    payload = event.payload or {}
    enqueue_job(
        db=db,
        job_type="human_approval_gate",
        payload=payload,
        priority="high",
        event_id=event.id
    )

def handle_research_completed(event, db: Session):
    logger.info(f"Subscriber: Received 'research_completed' event: {event.id}")
    payload = event.payload or {}
    enqueue_job(
        db=db,
        job_type="finance_agent_analysis",
        payload=payload,
        priority="medium",
        event_id=event.id
    )

def handle_webhook_event(event, db: Session):
    logger.info(f"Subscriber: Received integrations webhook event: {event.id}")
    payload = event.payload or {}
    target_workflow = payload.get("target_workflow")
    service = payload.get("service")
    logger.info(f"Subscriber Webhook: Routing to target workflow '{target_workflow}' from service '{service}'")
    enqueue_job(
        db=db,
        job_type="webhook_workflow_trigger",
        payload=payload,
        priority="medium",
        event_id=event.id
    )

def initialize_subscribers():
    """
    Registers code-level subscriptions.
    """
    event_registry.subscribe("invoice_uploaded", handle_invoice_uploaded)
    event_registry.subscribe("payroll_processed", handle_payroll_processed)
    event_registry.subscribe("lead_created", handle_lead_created)
    event_registry.subscribe("anomaly_detected", handle_anomaly_detected)
    event_registry.subscribe("approval_required", handle_approval_required)
    event_registry.subscribe("research_completed", handle_research_completed)
    event_registry.subscribe("webhook_Slack_event", handle_webhook_event)
    event_registry.subscribe("webhook_Gmail_event", handle_webhook_event)
    event_registry.subscribe("webhook_Salesforce_event", handle_webhook_event)
    event_registry.subscribe("webhook_GitHub_event", handle_webhook_event)
    event_registry.subscribe("webhook_Generic_REST_API_event", handle_webhook_event)
    logger.info("Event System: Initialized subscribers successfully.")
