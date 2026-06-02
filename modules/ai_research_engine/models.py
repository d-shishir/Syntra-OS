import uuid
from sqlalchemy import Column, String, Float, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.app.database import Base

class ResearchTask(Base):
    __tablename__ = "research_tasks"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    goal = Column(String(555), nullable=False, index=True)
    sub_tasks = Column(JSON, default=list, nullable=False)
    status = Column(String(50), default="pending", index=True) # pending | running | completed | failed
    report_content = Column(JSON, default=dict, nullable=True)
    confidence_score = Column(Float, default=0.0)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "goal": self.goal,
            "sub_tasks": self.sub_tasks,
            "status": self.status,
            "report_content": self.report_content,
            "confidence_score": self.confidence_score,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

class ResearchMemory(Base):
    __tablename__ = "research_memories"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    goal = Column(String(555), nullable=False, index=True)
    summary_findings = Column(String(1000), nullable=False)
    key_metrics = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "goal": self.goal,
            "summary_findings": self.summary_findings,
            "key_metrics": self.key_metrics,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
