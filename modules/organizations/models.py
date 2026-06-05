import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    industry = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    subscription_plan = Column(String(50), default="Starter", nullable=False) # Starter, Professional, Enterprise
    status = Column(String(50), default="Active", nullable=False) # Active, Suspended, Archived, Trial
    owner_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    settings = Column(JSONB, default=dict, nullable=False) # branding, theme, logo, domain rules

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "industry": self.industry,
            "country": self.country,
            "subscription_plan": self.subscription_plan,
            "status": self.status,
            "owner_id": str(self.owner_id) if self.owner_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "settings": self.settings
        }

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="Active", nullable=False) # Active, Suspended
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by": str(self.created_by) if self.created_by else None
        }

class Membership(Base):
    __tablename__ = "memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="Guest", nullable=False) # Org Owner, Admin, Finance Manager, Compliance Reviewer, Operations Lead, Analyst, Guest
    department = Column(String(50), default="Engineering", nullable=False) # Finance, Operations, Compliance, Sales, Engineering, Research
    status = Column(String(50), default="Active", nullable=False) # Active, Suspended, Invited, Pending

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "organization_id": str(self.organization_id),
            "role": self.role,
            "department": self.department,
            "status": self.status
        }

class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    membership_id = Column(UUID(as_uuid=True), ForeignKey("memberships.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="Workspace Viewer", nullable=False) # Workspace Owner, Workspace Admin, Workspace Contributor, Workspace Viewer

    def to_dict(self):
        return {
            "id": str(self.id),
            "workspace_id": str(self.workspace_id),
            "membership_id": str(self.membership_id),
            "role": self.role
        }

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(100), nullable=False, index=True)
    role = Column(String(50), default="Guest", nullable=False)
    department = Column(String(50), default="Engineering", nullable=False)
    workspace_assignments = Column(JSONB, default=list, nullable=False) # list of workspace IDs to assign upon joining
    status = Column(String(50), default="Pending", nullable=False) # Pending, Accepted, Expired
    invited_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "organization_id": str(self.organization_id),
            "email": self.email,
            "role": self.role,
            "department": self.department,
            "workspace_assignments": self.workspace_assignments,
            "status": self.status,
            "invited_by": str(self.invited_by) if self.invited_by else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
