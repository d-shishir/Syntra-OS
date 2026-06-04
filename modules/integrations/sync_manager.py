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

def run_synchronization_sweep(connector_key: str) -> dict:
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
    
    logger.info(f"Sync Manager: Completed sweep for '{connector_key}' (Processed: {records}, Conflicts: {conflicts})")
    return history_entry

def get_sync_jobs() -> List[dict]:
    return list(_sync_jobs.values())

def get_sync_history() -> List[dict]:
    return _sync_history
