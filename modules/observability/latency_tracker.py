import time
import functools
from typing import Optional, Any
from sqlalchemy.orm import Session
from .trace_manager import trace_manager
from .logger import logger

def track_latency(step_name: str, module: Optional[str] = None):
    """
    Decorator to measure function latency and record it as a sub-step under the current trace.
    Expects a `db: Session` parameter to be passed to the decorated function.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Attempt to extract SQL Session
            db = kwargs.get("db")
            if not db:
                for arg in args:
                    if isinstance(arg, Session):
                        db = arg
                        break

            trace_id = trace_manager.get_current_trace_id()
            start_time = time.time()
            status = "success"
            try:
                return func(*args, **kwargs)
            except Exception as e:
                status = "failed"
                raise e
            finally:
                end_time = time.time()
                latency_ms = int((end_time - start_time) * 1000)
                
                if trace_id and db:
                    try:
                        trace_manager.add_step(
                            trace_id=trace_id,
                            step_name=step_name,
                            status=status,
                            latency_ms=latency_ms,
                            metadata={
                                "function_name": func.__name__,
                                "module": module or "latency_tracker"
                            },
                            db=db
                        )
                    except Exception as e:
                        logger.warning(
                            message=f"Failed to write latency trace step to DB: {str(e)}",
                            module=module or "latency_tracker",
                            trace_id=trace_id,
                            db=db
                        )
                
                # Log structured timing details
                logger.info(
                    message=f"[{step_name}] took {latency_ms}ms (status: {status})",
                    module=module or "latency_tracker",
                    trace_id=trace_id,
                    metadata={"latency_ms": latency_ms, "status": status},
                    db=db
                )
        return wrapper
    return decorator
