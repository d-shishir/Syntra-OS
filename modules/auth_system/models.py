import uuid
from sqlalchemy import Column, String, Integer, DateTime, func, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True) # admin, finance_manager, compliance_officer, sales_rep, operations_manager, reviewer, analyst
    department = Column(String(50), nullable=False, index=True) # sales, finance, compliance, operations, system
    status = Column(String(50), default="active", nullable=False, index=True) # active, suspended

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "status": self.status
        }

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token = Column(String(512), nullable=False, index=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_active": self.is_active
        }

class SecurityAuditLog(Base):
    __tablename__ = "security_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(String(100), nullable=True, index=True) # user_id string or "guest"
    action = Column(String(100), nullable=False, index=True) # login, logout, failed_access, perm_change, workflow_execute, approval_override
    resource = Column(String(100), nullable=False, index=True) # resource details
    status = Column(String(50), nullable=False) # success, denied, failed
    ip_address = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": self.user_id,
            "action": self.action,
            "resource": self.resource,
            "status": self.status,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
