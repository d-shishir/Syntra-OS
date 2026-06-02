import logging
from typing import List
from sqlalchemy.orm import Session
from modules.ai_research_engine.models import ResearchMemory

logger = logging.getLogger(__name__)

class ResearchMemoryManager:
    def __init__(self):
        pass

    def save_to_memory(self, db: Session, goal: str, findings: str, key_metrics: dict) -> ResearchMemory:
        """
        Saves a summary of a completed research task to the memory tables.
        """
        try:
            mem = ResearchMemory(
                goal=goal,
                summary_findings=findings[:900] + "..." if len(findings) > 900 else findings,
                key_metrics=key_metrics
            )
            db.add(mem)
            db.commit()
            db.refresh(mem)
            return mem
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save research summary to memory table: {str(e)}")
            return None

    def get_recent_history(self, db: Session, limit: int = 5) -> List[ResearchMemory]:
        """
        Retrieves the most recent research studies.
        """
        try:
            return db.query(ResearchMemory).order_by(ResearchMemory.created_at.desc()).limit(limit).all()
        except Exception:
            return []
