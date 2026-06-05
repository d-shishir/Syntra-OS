import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class ExecutiveAlert(Base):
    __tablename__ = "executive_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    severity = Column(String(50), default="Medium", nullable=False, index=True) # Low, Medium, High, Critical
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    source_module = Column(String(100), nullable=False, index=True) # Finance, Workflows, Governance, etc.
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_resolved = Column(Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
            "source_module": self.source_module,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "is_resolved": self.is_resolved
        }

class DecisionTrace(Base):
    __tablename__ = "executive_decision_traces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    root_cause = Column(Text, nullable=True)
    suggestions = Column(JSONB, default=list, nullable=False) # list of text suggestions
    impact_score = Column(Integer, default=0, nullable=False) # estimated automation cost/time savings
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "question": self.question,
            "answer": self.answer,
            "root_cause": self.root_cause,
            "suggestions": self.suggestions,
            "impact_score": self.impact_score,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
