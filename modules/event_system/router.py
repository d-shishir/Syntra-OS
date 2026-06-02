import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from modules.event_system.models import EventRecord, EventJob, DeadLetterJob
from modules.event_system.event_bus import publish_event
from modules.event_system.dead_letter_queue import retry_dlq_job
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/publish", status_code=status.HTTP_201_CREATED)
def api_publish_event(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event_type = payload.get("event_type")
    source_module = payload.get("source_module")
    event_payload = payload.get("payload", {})
    priority = payload.get("priority", "medium")

    if not event_type or not source_module:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fields 'event_type' and 'source_module' are required."
        )

    try:
        event = publish_event(db, event_type, source_module, event_payload, priority)
        return {"status": "success", "event": event.to_dict()}
    except Exception as e:
        logger.exception("API: Failed to publish event")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish event: {str(e)}"
        )

@router.get("", response_model=list[dict])
def get_events(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    events = db.query(EventRecord).order_by(EventRecord.timestamp.desc()).limit(limit).all()
    return [e.to_dict() for e in events]

@router.get("/jobs", response_model=list[dict])
def get_jobs(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    jobs = db.query(EventJob).order_by(EventJob.created_at.desc()).limit(limit).all()
    return [j.to_dict() for j in jobs]

@router.get("/jobs/{job_id}", response_model=dict)
def get_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import uuid
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID format.")
    
    job = db.query(EventJob).filter(EventJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return job.to_dict()

@router.post("/jobs/{job_id}/retry", response_model=dict)
def retry_job(job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    import uuid
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID format.")
        
    # Check if in DLQ first
    dlq_job = db.query(DeadLetterJob).filter(DeadLetterJob.job_id == job_uuid).first()
    if dlq_job:
        try:
            new_job = retry_dlq_job(db, str(dlq_job.id))
            return {"status": "success", "message": "Job re-enqueued from Dead Letter Queue", "job": new_job.to_dict()}
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
            
    # If in standard jobs as failed
    job = db.query(EventJob).filter(EventJob.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
        
    if job.status not in ["failed", "dead_letter"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only failed or dead-lettered jobs can be retried.")
        
    job.status = "queued"
    job.retry_count = 0
    job.next_retry_at = None
    job.error_message = None
    db.commit()
    db.refresh(job)
    return {"status": "success", "message": "Job re-enqueued successfully", "job": job.to_dict()}

@router.get("/dead-letter-queue", response_model=list[dict])
def get_dead_letter_queue(limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dlq_jobs = db.query(DeadLetterJob).order_by(DeadLetterJob.failed_at.desc()).limit(limit).all()
    return [d.to_dict() for d in dlq_jobs]

@router.get("/stream")
async def event_stream(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    SSE stream of live operational metrics, events, and jobs.
    """
    async def sse_generator():
        # Keep track of last timestamps queried to only pull new logs
        last_event_time = datetime.utcnow() - timedelta(seconds=1)
        last_job_time = datetime.utcnow() - timedelta(seconds=1)
        
        while True:
            # Query recent items inside generator using a local session
            from app.database import SessionLocal
            session = SessionLocal()
            try:
                # Query new events
                new_events = session.query(EventRecord).filter(EventRecord.timestamp > last_event_time).order_by(EventRecord.timestamp.asc()).all()
                if new_events:
                    last_event_time = new_events[-1].timestamp
                    
                # Query new or modified jobs
                new_jobs = session.query(EventJob).filter(EventJob.created_at > last_job_time).order_by(EventJob.created_at.asc()).all()
                if new_jobs:
                    last_job_time = new_jobs[-1].created_at
                
                # Fetch overall metrics to push
                event_count = session.query(EventRecord).count()
                job_count = session.query(EventJob).count()
                failed_job_count = session.query(EventJob).filter(EventJob.status == "failed").count()
                dlq_count = session.query(DeadLetterJob).count()
                active_workers = 2
                
                metrics = {
                    "event_count": event_count,
                    "job_count": job_count,
                    "failed_job_count": failed_job_count,
                    "dlq_count": dlq_count,
                    "active_workers": active_workers
                }
                
                data = {
                    "new_events": [e.to_dict() for e in new_events],
                    "new_jobs": [j.to_dict() for j in new_jobs],
                    "metrics": metrics
                }
                
                yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                logger.error(f"SSE stream generator error: {str(e)}")
            finally:
                session.close()
                
            await asyncio.sleep(1.5)

    return StreamingResponse(sse_generator(), media_type="text/event-stream")
