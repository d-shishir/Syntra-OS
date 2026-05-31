import logging
from sqlalchemy.orm import Session
from modules.event_system.event_registry import event_registry

logger = logging.getLogger(__name__)

# Mock index state cache for analytics
index_stats = {
    "documents_indexed": 0,
    "invoices_indexed": 0,
    "leads_indexed": 0,
    "workflows_indexed": 0,
    "approvals_indexed": 0,
    "last_sync_timestamp": None
}

def handle_search_doc_sync(event, db: Session):
    logger.info("Search Indexer: Auto-syncing new document uploaded event.")
    index_stats["documents_indexed"] += 1
    from datetime import datetime, timezone
    index_stats["last_sync_timestamp"] = datetime.now(timezone.utc).isoformat()

def handle_search_invoice_sync(event, db: Session):
    logger.info("Search Indexer: Auto-syncing invoice processed event.")
    index_stats["invoices_indexed"] += 1
    from datetime import datetime, timezone
    index_stats["last_sync_timestamp"] = datetime.now(timezone.utc).isoformat()

def handle_search_lead_sync(event, db: Session):
    logger.info("Search Indexer: Auto-syncing CRM lead created event.")
    index_stats["leads_indexed"] += 1
    from datetime import datetime, timezone
    index_stats["last_sync_timestamp"] = datetime.now(timezone.utc).isoformat()

def handle_search_workflow_sync(event, db: Session):
    logger.info("Search Indexer: Auto-syncing workflow execution event.")
    index_stats["workflows_indexed"] += 1
    from datetime import datetime, timezone
    index_stats["last_sync_timestamp"] = datetime.now(timezone.utc).isoformat()

def handle_search_approval_sync(event, db: Session):
    logger.info("Search Indexer: Auto-syncing approval process event.")
    index_stats["approvals_indexed"] += 1
    from datetime import datetime, timezone
    index_stats["last_sync_timestamp"] = datetime.now(timezone.utc).isoformat()

def register_search_indexer_subscribers():
    """
    Subscribes indexing callbacks to core event bus.
    """
    event_registry.subscribe("document_uploaded", handle_search_doc_sync)
    event_registry.subscribe("invoice_uploaded", handle_search_invoice_sync)
    event_registry.subscribe("lead_created", handle_search_lead_sync)
    event_registry.subscribe("workflow_completed", handle_search_workflow_sync)
    event_registry.subscribe("approval_processed", handle_search_approval_sync)
    logger.info("Enterprise Search Indexer: Subscribed event handlers successfully.")

def get_index_stats() -> dict:
    return index_stats
