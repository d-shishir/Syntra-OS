import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    task_type = Column(String(100), nullable=False, index=True)  # invoice_payment, payroll_discrepancy, crm_bulk_outreach, general_compliance
    generated_by = Column(String(100), default="workflow", index=True)  # workflow, agent
    risk_score = Column(Integer, default=0)
    risk_level = Column(String(50), default="low", index=True)  # low, medium, high
    risk_reason = Column(Text, nullable=True)
    status = Column(String(50), default="pending", index=True)  # pending, approved, rejected, escalated
    recommended_action = Column(String(255), nullable=True)
    supporting_context = Column(JSONB, nullable=True, default=dict)
    workflow_run_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    assigned_reviewer = Column(String(100), nullable=True, index=True)
    assigned_department = Column(String(100), default="General", index=True)  # Finance, Compliance, Sales
    escalation_level = Column(Integer, default=0)
    reviewer_comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    audit_trails = relationship("ApprovalAuditTrail", back_populates="approval_request", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "task_type": self.task_type,
            "generated_by": self.generated_by,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "risk_reason": self.risk_reason,
            "status": self.status,
            "recommended_action": self.recommended_action,
            "supporting_context": self.supporting_context,
            "workflow_run_id": str(self.workflow_run_id) if self.workflow_run_id else None,
            "assigned_reviewer": self.assigned_reviewer,
            "assigned_department": self.assigned_department,
            "escalation_level": self.escalation_level,
            "reviewer_comments": self.reviewer_comments,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None
        }

class ApprovalAuditTrail(Base):
    __tablename__ = "approval_audit_trails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    approval_request_id = Column(UUID(as_uuid=True), ForeignKey("approval_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # created, approved, rejected, escalated, reassigned
    performed_by = Column(String(150), nullable=False)  # user name, agent name, system
    comments = Column(Text, nullable=True)
    changes_made = Column(JSONB, nullable=True, default=dict)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    approval_request = relationship("ApprovalRequest", back_populates="audit_trails")

    def to_dict(self):
        return {
            "id": str(self.id),
            "approval_request_id": str(self.approval_request_id),
            "action": self.action,
            "performed_by": self.performed_by,
            "comments": self.comments,
            "changes_made": self.changes_made,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
