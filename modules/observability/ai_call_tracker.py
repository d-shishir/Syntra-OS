import logging
from sqlalchemy.orm import Session
from .models import SystemMetric
from .trace_manager import trace_manager

logger = logging.getLogger(__name__)

class AICallTracker:
    """
    Tracks LLM request token usages, recording metadata and prompt parameters.
    """
    @staticmethod
    def record_token_usage(tokens: int, module: str, db: Session):
        try:
            metric = SystemMetric(
                metric_name="token_usage",
                metric_value=float(tokens),
                module=module
            )
            db.add(metric)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to record token usage metric: {str(e)}")

ai_call_tracker = AICallTracker()
