import uuid
from sqlalchemy.orm import Session
from modules.organizations.models import Organization, Workspace, Membership, WorkspaceMembership, Invitation
from modules.auth_system.models import User
from modules.auth_system.auth_manager import hash_password

def create_organization(db: Session, name: str, industry: str, country: str, subscription_plan: str, owner_id: uuid.UUID) -> Organization:
    org = Organization(
        name=name,
        industry=industry,
        country=country,
        subscription_plan=subscription_plan,
        status="Active",
        owner_id=owner_id,
        settings={
            "branding": {
                "logo": "",
                "primary_color": "#0ea5e9",
                "theme": "dark"
            },
            "security": {
                "allowed_domains": [],
                "require_mfa": False
            }
        }
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    # Bind owner as Org Owner membership
    membership = Membership(
        user_id=owner_id,
        organization_id=org.id,
        role="Org Owner",
        department="Operations",
        status="Active"
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    # Create a default general workspace
    workspace = create_workspace(db, org.id, "General Workspace", "Default workspace for the organization", owner_id)
    
    # Bind owner to default workspace membership
    ws_mem = WorkspaceMembership(
        workspace_id=workspace.id,
        membership_id=membership.id,
        role="Workspace Owner"
    )
    db.add(ws_mem)
    db.commit()

    return org

def create_workspace(db: Session, org_id: uuid.UUID, name: str, description: str, created_by: uuid.UUID) -> Workspace:
    ws = Workspace(
        organization_id=org_id,
        name=name,
        description=description,
        status="Active",
        created_by=created_by
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws

def invite_member(db: Session, org_id: uuid.UUID, email: str, role: str, department: str, workspace_ids: list, invited_by: uuid.UUID) -> Invitation:
    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()
    # Create invitation
    invitation = Invitation(
        organization_id=org_id,
        email=email,
        role=role,
        department=department,
        workspace_assignments=workspace_ids,
        status="Pending",
        invited_by=invited_by
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation

def accept_invitation(db: Session, invitation_id: uuid.UUID, password: str, name: str) -> Membership:
    inv = db.query(Invitation).filter(Invitation.id == invitation_id, Invitation.status == "Pending").first()
    if not inv:
        raise ValueError("Invitation not found or already processed.")

    # Check if user already has an account; otherwise create one
    user = db.query(User).filter(User.email == inv.email).first()
    if not user:
        user = User(
            name=name,
            email=inv.email,
            password_hash=hash_password(password),
            role="reviewer", # fallback mapped role
            department="operations",
            status="active"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Create membership
    membership = Membership(
        user_id=user.id,
        organization_id=inv.organization_id,
        role=inv.role,
        department=inv.department,
        status="Active"
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    # Assign workspace memberships
    for ws_id_str in inv.workspace_assignments:
        try:
            ws_id = uuid.UUID(str(ws_id_str))
            ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
            if ws:
                ws_mem = WorkspaceMembership(
                    workspace_id=ws.id,
                    membership_id=membership.id,
                    role="Workspace Contributor"
                )
                db.add(ws_mem)
        except Exception:
            continue

    inv.status = "Accepted"
    db.commit()

    return membership
