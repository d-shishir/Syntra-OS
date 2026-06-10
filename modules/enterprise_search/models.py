import uuid
from sqlalchemy import Column, String, Integer, DateTime, func, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class SearchQueryLog(Base):
    __tablename__ = "search_query_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    query = Column(String(255), nullable=False, index=True)
    user_role = Column(String(50), nullable=True, index=True)
    user_department = Column(String(50), nullable=True, index=True)
    latency_ms = Column(Float, default=0.0)
    result_count = Column(Integer, default=0)
    clicked = Column(Integer, default=0) # Track click-through rates
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "query": self.query,
            "user_role": self.user_role,
            "user_department": self.user_department,
            "latency_ms": self.latency_ms,
            "result_count": self.result_count,
            "clicked": self.clicked,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class RecentSearch(Base):
    __tablename__ = "recent_searches"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id = Column(String(100), nullable=True, index=True)
    query = Column(String(255), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": self.user_id,
            "query": self.query,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
