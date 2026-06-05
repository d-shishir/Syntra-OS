import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class AIPolicy(Base):
    __tablename__ = "ai_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    rule_condition = Column(JSONB, default=dict, nullable=False) # e.g. {"max_amount": 10000, "action": "payment"}
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "rule_condition": self.rule_condition,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class AIAuditLog(Base):
    __tablename__ = "ai_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    agent_name = Column(String(255), nullable=False, index=True)
    user_id = Column(String(100), nullable=True, index=True)
    tool_used = Column(String(255), nullable=False, index=True)
    inputs = Column(JSONB, default=dict, nullable=False)
    outputs = Column(JSONB, default=dict, nullable=False)
    risk_level = Column(String(50), default="low", index=True) # low, medium, high, critical
    status = Column(String(50), default="Allowed", index=True) # Allowed, Blocked, Awaiting Approval

    def to_dict(self):
        return {
            "id": str(self.id),
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "agent_name": self.agent_name,
            "user_id": self.user_id,
            "tool_used": self.tool_used,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "risk_level": self.risk_level,
            "status": self.status
        }

class AIIncident(Base):
    __tablename__ = "ai_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    incident_type = Column(String(100), nullable=False, index=True) # policy_violation, failed_compliance_check, suspicious_agent_behavior
    description = Column(Text, nullable=False)
    severity = Column(String(50), default="medium", index=True) # low, medium, high, critical
    status = Column(String(50), default="Detected", index=True) # Detected, Investigating, Mitigating, Resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    investigations = relationship("AIInvestigation", back_populates="incident", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "incident_type": self.incident_type,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None
        }

class AIInvestigation(Base):
    __tablename__ = "ai_investigations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("ai_incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    investigator_id = Column(String(100), nullable=True, index=True)
    notes = Column(Text, nullable=False)
    status = Column(String(50), default="Open", index=True) # Open, Closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    incident = relationship("AIIncident", back_populates="investigations")

    def to_dict(self):
        return {
            "id": str(self.id),
            "incident_id": str(self.incident_id),
            "investigator_id": self.investigator_id,
            "notes": self.notes,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
