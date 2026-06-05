import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    prefix = Column(String(16), nullable=False) # e.g. "sy_" or "sk_"
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scopes = Column(JSONB, default=list, nullable=False) # e.g. ["workflows:read", "workflows:write", "agents:read"]
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "prefix": self.prefix,
            "organization_id": str(self.organization_id),
            "workspace_id": str(self.workspace_id),
            "user_id": str(self.user_id),
            "scopes": self.scopes,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None
        }

class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    target_url = Column(String(512), nullable=False)
    secret = Column(String(100), nullable=False)
    events = Column(JSONB, default=list, nullable=False) # e.g. ["invoice_paid", "member_joined", "workflow_completed"]
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "organization_id": str(self.organization_id),
            "workspace_id": str(self.workspace_id),
            "target_url": self.target_url,
            "events": self.events,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class WebhookAttempt(Base):
    __tablename__ = "webhook_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("webhook_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    status_code = Column(Integer, nullable=True)
    status = Column(String(50), default="Pending", nullable=False) # Success, Failed, Retrying
    error_message = Column(Text, nullable=True)
    attempt_count = Column(Integer, default=1, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "subscription_id": str(self.subscription_id),
            "event_type": self.event_type,
            "payload": self.payload,
            "status_code": self.status_code,
            "status": self.status,
            "error_message": self.error_message,
            "attempt_count": self.attempt_count,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }

class ApiGatewayLog(Base):
    __tablename__ = "api_gateway_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    api_key_id = Column(UUID(as_uuid=True), ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    path = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False, index=True)
    latency_ms = Column(Integer, nullable=False)
    ip_address = Column(String(50), nullable=True)
    risk_score = Column(Integer, default=0, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "api_key_id": str(self.api_key_id) if self.api_key_id else None,
            "organization_id": str(self.organization_id),
            "workspace_id": str(self.workspace_id),
            "path": self.path,
            "method": self.method,
            "status_code": self.status_code,
            "latency_ms": self.latency_ms,
            "ip_address": self.ip_address,
            "risk_score": self.risk_score,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
