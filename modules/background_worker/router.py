from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database import get_db
from .models import BackgroundTaskJob

router = APIRouter()

@router.get("/tasks")
def list_tasks(status: str | None = None, limit: int = 50, db: Session = Depends(get_db)):
    """
    List recent background worker jobs with optional status filter.
    """
    try:
        query = db.query(BackgroundTaskJob)
        if status:
            query = query.filter(BackgroundTaskJob.status == status)
        jobs = query.order_by(BackgroundTaskJob.created_at.desc()).limit(limit).all()
        return [job.to_dict() for job in jobs]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tasks: {str(e)}"
        )

@router.get("/metrics")
def get_worker_metrics(db: Session = Depends(get_db)):
    """
    Get aggregated statistics for the background worker queue.
    """
    try:
        # Group by status
        counts = db.query(
            BackgroundTaskJob.status, func.count(BackgroundTaskJob.id)
        ).group_by(BackgroundTaskJob.status).all()
        
        metrics = {
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0,
            "total": 0
        }
        
        for status_val, count in counts:
            if status_val in metrics:
                metrics[status_val] = count
                metrics["total"] += count
                
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile worker metrics: {str(e)}"
        )

@router.post("/tasks/{job_id}/retry")
def retry_task(job_id: str, db: Session = Depends(get_db)):
    """
    Manually re-queue a failed job by resetting status to 'pending'.
    """
    try:
        job = db.query(BackgroundTaskJob).filter(BackgroundTaskJob.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Background job not found."
            )
            
        if job.status not in ["failed", "completed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only completed or failed jobs can be manually retried. Current status: {job.status}"
            )
            
        job.status = "pending"
        job.retry_count = 0
        job.error_message = None
        job.started_at = None
        job.completed_at = None
        db.commit()
        return {"status": "success", "message": "Job re-queued successfully", "job_id": str(job.id)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to re-queue job: {str(e)}"
        )

@router.post("/tasks/clear-completed")
def clear_completed_tasks(db: Session = Depends(get_db)):
    """
    Remove all completed background jobs from DB tracking logs to clean up disk space.
    """
    try:
        deleted_count = db.query(BackgroundTaskJob).filter(
            BackgroundTaskJob.status == "completed"
        ).delete(synchronize_session=False)
        db.commit()
        return {"status": "success", "message": f"Cleared {deleted_count} completed jobs"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear completed jobs: {str(e)}"
        )
