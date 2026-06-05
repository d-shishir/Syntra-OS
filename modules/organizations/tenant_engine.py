import uuid
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User
from modules.organizations.models import Membership, WorkspaceMembership

class TenantContext:
    def __init__(self, organization_id: uuid.UUID = None, workspace_id: uuid.UUID = None):
        self.organization_id = organization_id
        self.workspace_id = workspace_id

def get_tenant_context(
    x_org_id: str = Header(None, alias="X-Org-ID"),
    x_workspace_id: str = Header(None, alias="X-Workspace-ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> TenantContext:
    """
    Dependency to resolve the current organization and workspace contexts.
    Verifies membership constraints.
    """
    # Parse Organization ID
    org_id = None
    if x_org_id:
        try:
            org_id = uuid.UUID(x_org_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Org-ID format. Must be a valid UUID."
            )

    # Parse Workspace ID
    workspace_id = None
    if x_workspace_id:
        try:
            workspace_id = uuid.UUID(x_workspace_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Workspace-ID format. Must be a valid UUID."
            )

    # If no Org ID is provided, look up the user's memberships
    if not org_id:
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.status == "Active"
        ).first()
        if membership:
            org_id = membership.organization_id

    # If we have an Org ID, check if user is a member
    if org_id:
        membership = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_id,
            Membership.status == "Active"
        ).first()
        if not membership and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. User is not a member of this organization."
            )

        # If Workspace ID is provided, check if user belongs to this workspace
        if workspace_id and membership:
            ws_membership = db.query(WorkspaceMembership).filter(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.membership_id == membership.id
            ).first()
            if not ws_membership and current_user.role != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. User is not a member of this workspace."
                )

    return TenantContext(organization_id=org_id, workspace_id=workspace_id)
