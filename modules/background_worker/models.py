import uuid
from sqlalchemy import Column, String, Integer, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from backend.app.database import Base

class BackgroundTaskJob(Base):
    __tablename__ = "background_task_jobs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    task_type = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True)  # pending, processing, completed, failed
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    error_message = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "task_type": self.task_type,
            "payload": self.payload,
            "status": self.status,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }
