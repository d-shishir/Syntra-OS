import traceback
import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from .models import SystemErrorLog
from .logger import logger

class ErrorTracker:
    """
    Standardized utility to parse and log exceptions, stack traces,
    and associated parameters directly into error log tables.
    """
    @staticmethod
    def capture_error(
        module: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        input_context: Optional[Dict[str, Any]] = None,
        trace_id: Optional[uuid.UUID] = None,
        db: Optional[Session] = None
    ):
        st = stack_trace or traceback.format_exc()
        
        # Log structured error record
        logger.error(
            message=f"Exception caught in {module}: {error_message}",
            module=module,
            trace_id=trace_id,
            metadata={"error": error_message, "stack_trace_snippet": st[:400]},
            db=db
        )
        
        # Write crash records to DB
        if db:
            try:
                err_record = SystemErrorLog(
                    trace_id=trace_id,
                    module=module,
                    error_message=error_message,
                    stack_trace=st,
                    input_context=input_context or {}
                )
                db.add(err_record)
                db.commit()
            except Exception as ex:
                db.rollback()
                logger.error(f"Error persisting error log: {str(ex)}")

error_tracker = ErrorTracker()
