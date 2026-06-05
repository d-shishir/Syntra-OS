import logging
import datetime
import random
from typing import Dict, List

logger = logging.getLogger(__name__)

# Simulated in-memory sync jobs
_sync_jobs: Dict[str, dict] = {}
# Sync execution telemetry logs
_sync_history = []

def create_sync_job(connector_key: str, direction: str, sync_type: str) -> dict:
    """
    Creates a new synchronization task mapping.
    """
    job_id = f"sync_{connector_key}_{random.randint(100, 999)}"
    job = {
        "id": job_id,
        "connector_key": connector_key,
        "direction": direction, # one-way, two-way
        "sync_type": sync_type, # scheduled, event-based
        "status": "active",
        "last_sync": "Never",
        "records_processed": 0,
        "conflicts_detected": 0,
        "errors_count": 0
    }
    _sync_jobs[connector_key] = job
    logger.info(f"Sync Manager: Set up sync task '{job_id}' for connector '{connector_key}'")
    return job

from sqlalchemy.orm import Session

def run_synchronization_sweep(connector_key: str, db: Session = None) -> dict:
    """
    Simulates a sync sweep between Syntra and an external service.
    """
    if connector_key not in _sync_jobs:
        return {"status": "error", "message": "No active sync job configured."}
    
    job = _sync_jobs[connector_key]
    
    # Generate mock sync results
    records = random.randint(15, 85)
    conflicts = random.choice([0, 0, 0, 1, 0])
    errors = random.choice([0, 0, 0, 0, 2])
    
    job["last_sync"] = datetime.datetime.utcnow().isoformat()
    job["records_processed"] += records
    job["conflicts_detected"] += conflicts
    job["errors_count"] += errors
    
    history_entry = {
        "timestamp": job["last_sync"],
        "connector_key": connector_key,
        "records_processed": records,
        "conflicts": conflicts,
        "errors": errors,
        "outcome": "success" if errors == 0 else "degraded"
    }
    _sync_history.append(history_entry)

    # Knowledge Graph Integration
    if db is not None:
        try:
            from modules.knowledge_graph.graph_manager import GraphManager
            gm = GraphManager()
            
            # Create/retrieve nodes
            slack_node = gm.get_or_create_node(db, "System", "Slack")
            employee_node = gm.get_or_create_node(db, "Employee", "Developer Team")
            gm.add_relationship(db, employee_node, slack_node, "uses")
            
            workflow_node = gm.get_or_create_node(db, "Workflow", f"{connector_key}_sync_workflow")
            webhook_node = gm.get_or_create_node(db, "Webhook", f"{connector_key}_trigger")
            gm.add_relationship(db, workflow_node, webhook_node, "triggers")
            
            invoice_node = gm.get_or_create_node(db, "Invoice", "Sync-Ledger-Invoice")
            sheet_node = gm.get_or_create_node(db, "Spreadsheet", "Airtable-Database")
            gm.add_relationship(db, invoice_node, sheet_node, "stored_in")
            
            logger.info("Sync Manager: Synchronized graph relationships successfully.")
        except Exception as graph_err:
            logger.warning(f"Sync Manager: Graph relationships update failed: {str(graph_err)}")
            db.rollback()

    # Enterprise Search Integration (Publish document_uploaded event)
    if db is not None:
        try:
            from modules.event_system.event_bus import publish_event
            publish_event(
                db=db,
                event_type="document_uploaded",
                source_module="integrations_hub",
                payload={"title": f"Synced metadata for {connector_key}", "records_synced": records}
            )
            logger.info("Sync Manager: Published search index sync event successfully.")
        except Exception as search_err:
            logger.warning(f"Sync Manager: Search index sync failed: {str(search_err)}")
    
    logger.info(f"Sync Manager: Completed sweep for '{connector_key}' (Processed: {records}, Conflicts: {conflicts})")
    return history_entry

def get_sync_jobs() -> List[dict]:
    return list(_sync_jobs.values())

def get_sync_history() -> List[dict]:
    return _sync_history
