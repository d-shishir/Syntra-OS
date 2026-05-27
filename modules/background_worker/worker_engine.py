import time
import traceback
import threading
import logging
from sqlalchemy import func
from backend.app.database import SessionLocal
from .models import BackgroundTaskJob

logger = logging.getLogger(__name__)

# Global registry of task handlers
_handlers = {}
_worker_thread = None
_stop_event = threading.Event()

def register_handler(task_type: str, handler_func):
    """
    Registers a function to handle tasks of type task_type.
    handler_func should accept: (payload: dict, db_session)
    """
    _handlers[task_type] = handler_func
    logger.info(f"Registered background worker handler for task type: {task_type}")

def _run_job(job_id: str):
    """
    Runs a single job by its ID.
    """
    db = SessionLocal()
    try:
        # Fetch job and mark as processing
        job = db.query(BackgroundTaskJob).filter(BackgroundTaskJob.id == job_id).first()
        if not job:
            return

        job.status = "processing"
        job.started_at = func.now()
        db.commit()

        handler = _handlers.get(job.task_type)
        if not handler:
            raise ValueError(f"No registered handler for task type: {job.task_type}")

        # Execute handler
        logger.info(f"Worker executing job {job.id} (Type: {job.task_type})")
        handler(job.payload or {}, db)

        # Mark as completed
        job = db.query(BackgroundTaskJob).filter(BackgroundTaskJob.id == job_id).first()
        job.status = "completed"
        job.completed_at = func.now()
        db.commit()
        logger.info(f"Worker successfully completed job {job.id}")

    except Exception as e:
        db.rollback()
        err_msg = f"{str(e)}\n\n{traceback.format_exc()}"
        logger.error(f"Worker encountered error running job {job_id}: {err_msg}")
        
        # Reload job in a fresh session state to write failure metadata
        try:
            job = db.query(BackgroundTaskJob).filter(BackgroundTaskJob.id == job_id).first()
            if job:
                job.retry_count += 1
                job.completed_at = func.now()
                if job.retry_count < job.max_retries:
                    job.status = "pending"
                    logger.info(f"Re-queueing job {job.id} for retry attempt {job.retry_count}/{job.max_retries}")
                else:
                    job.status = "failed"
                    job.error_message = err_msg
                    logger.info(f"Job {job.id} has failed permanently after {job.max_retries} attempts")
                db.commit()
        except Exception as inner_ex:
            logger.exception(f"Failed to save job execution failure metadata for {job_id}: {str(inner_ex)}")
    finally:
        db.close()

def _worker_loop():
    """
    Polling loop for pending tasks.
    """
    logger.info("Background worker loop started.")
    while not _stop_event.is_set():
        db = SessionLocal()
        job_id = None
        try:
            # Query for oldest pending job
            try:
                # Try postgres skip locked to prevent race conditions
                job = db.query(BackgroundTaskJob).filter(
                    BackgroundTaskJob.status == "pending"
                ).order_by(
                    BackgroundTaskJob.created_at.asc()
                ).with_for_update(skip_locked=True).first()
            except Exception:
                # Fallback for SQLite or databases that do not support select for update skip locked
                db.rollback()
                job = db.query(BackgroundTaskJob).filter(
                    BackgroundTaskJob.status == "pending"
                ).order_by(
                    BackgroundTaskJob.created_at.asc()
                ).first()

            if job:
                job_id = job.id
        except Exception as e:
            logger.error(f"Worker poll query failed: {str(e)}")
        finally:
            db.close()

        if job_id:
            # Run job synchronously in the worker thread
            _run_job(job_id)
        else:
            # Sleep if no jobs are pending
            _stop_event.wait(timeout=2.0)

    logger.info("Background worker loop stopped.")

def start_worker():
    """
    Starts the daemon worker thread.
    """
    global _worker_thread
    if _worker_thread is not None and _worker_thread.is_alive():
        logger.warning("Background worker thread is already running.")
        return

    _stop_event.clear()
    _worker_thread = threading.Thread(target=_worker_loop, name="SyntraWorkerThread", daemon=True)
    _worker_thread.start()
    logger.info("Background worker thread started as daemon.")

def stop_worker():
    """
    Stops the background worker thread.
    """
    global _worker_thread
    if _worker_thread is None:
        return
    _stop_event.set()
    _worker_thread.join(timeout=5.0)
    logger.info("Background worker thread shut down.")
