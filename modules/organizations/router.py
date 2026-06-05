import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User
from modules.organizations.models import Organization, Workspace, Membership, WorkspaceMembership, Invitation
from modules.organizations import organization_service
from pydantic import BaseModel, EmailStr
from typing import List, Optional

router = APIRouter()

# Schema definitions
class OrganizationCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    country: Optional[str] = None
    subscription_plan: Optional[str] = "Starter"

class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None

class InvitationCreate(BaseModel):
    email: EmailStr
    role: str
    department: str
    workspace_ids: List[str]

class InvitationAccept(BaseModel):
    name: str
    password: str

class OrganizationSettingsUpdate(BaseModel):
    settings: dict

@router.get("/")
def get_user_organizations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve all organizations the current user belongs to."""
    if current_user.role == "admin":
        orgs = db.query(Organization).all()
        return [o.to_dict() for o in orgs]

    memberships = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.status == "Active"
    ).all()
    org_ids = [m.organization_id for m in memberships]
    orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
    return [o.to_dict() for o in orgs]

@router.post("/")
def create_org(payload: OrganizationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new organization."""
    return organization_service.create_organization(
        db=db,
        name=payload.name,
        industry=payload.industry,
        country=payload.country,
        subscription_plan=payload.subscription_plan,
        owner_id=current_user.id
    ).to_dict()

@router.get("/{org_id}/workspaces")
def get_workspaces(org_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all workspaces within an organization."""
    # Check membership
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied. Not a member of this organization.")

    workspaces = db.query(Workspace).filter(Workspace.organization_id == org_id).all()
    return [w.to_dict() for w in workspaces]

@router.post("/{org_id}/workspaces")
def create_ws(org_id: uuid.UUID, payload: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new workspace inside an organization."""
    # Check admin or membership roles
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership or membership.role not in ["Org Owner", "Admin"]:
            raise HTTPException(status_code=403, detail="Access denied. Administrator privileges required.")

    return organization_service.create_workspace(
        db=db,
        org_id=org_id,
        name=payload.name,
        description=payload.description,
        created_by=current_user.id
    ).to_dict()

@router.get("/{org_id}/members")
def get_members(org_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve membership directory of the organization."""
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied.")

    members = db.query(Membership).filter(Membership.organization_id == org_id).all()
    res = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            d = m.to_dict()
            d["name"] = user.name
            d["email"] = user.email
            res.append(d)
    return res

@router.post("/{org_id}/invitations")
def invite_user(org_id: uuid.UUID, payload: InvitationCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invite a new user to join the organization."""
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership or membership.role not in ["Org Owner", "Admin"]:
            raise HTTPException(status_code=403, detail="Access denied. Admin required.")

    inv = organization_service.invite_member(
        db=db,
        org_id=org_id,
        email=payload.email,
        role=payload.role,
        department=payload.department,
        workspace_ids=payload.workspace_ids,
        invited_by=current_user.id
    )
    return inv.to_dict()

@router.get("/invitations/{inv_id}")
def get_invitation(inv_id: uuid.UUID, db: Session = Depends(get_db)):
    """Inspect invitation details before account setup."""
    inv = db.query(Invitation).filter(Invitation.id == inv_id, Invitation.status == "Pending").first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found or inactive.")
    org = db.query(Organization).filter(Organization.id == inv.organization_id).first()
    d = inv.to_dict()
    d["organization_name"] = org.name if org else "Unknown Organization"
    return d

@router.post("/invitations/{inv_id}/accept")
def accept_inv(inv_id: uuid.UUID, payload: InvitationAccept, db: Session = Depends(get_db)):
    """Accept invitation and activate membership."""
    try:
        membership = organization_service.accept_invitation(
            db=db,
            invitation_id=inv_id,
            password=payload.password,
            name=payload.name
        )
        return {"status": "success", "membership": membership.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{org_id}/settings")
def update_settings(org_id: uuid.UUID, payload: OrganizationSettingsUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update settings configurations for the organization."""
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership or membership.role not in ["Org Owner", "Admin"]:
            raise HTTPException(status_code=403, detail="Access denied. Admin privileges required.")

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    org.settings = payload.settings
    db.commit()
    return org.to_dict()

@router.get("/{org_id}/analytics")
def get_org_analytics(org_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get isolated metrics for organizations and workspaces."""
    if current_user.role != "admin":
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Access denied.")

    workspaces = db.query(Workspace).filter(Workspace.organization_id == org_id).all()
    ws_count = len(workspaces)
    members_count = db.query(Membership).filter(Membership.organization_id == org_id).count()
    invitations_count = db.query(Invitation).filter(Invitation.organization_id == org_id, Invitation.status == "Pending").count()

    # Stub metric values for Enterprise plans
    return {
        "workspaces": ws_count,
        "members": members_count,
        "pending_invitations": invitations_count,
        "workflow_runs": 1240,
        "agent_executions": 874,
        "storage_bytes": 1024 * 1024 * 342, # 342 MB
        "latency_avg_ms": 128,
        "error_rate": 0.02
    }
