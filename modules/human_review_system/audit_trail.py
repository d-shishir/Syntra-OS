import uuid
from sqlalchemy.orm import Session
from .models import ApprovalAuditTrail

class AuditTrail:
    """
    Immutable logging manager for capturing all human-in-the-loop actions.
    """
    @staticmethod
    def log_action(
        request_id: uuid.UUID,
        action: str,
        performed_by: str,
        comments: str,
        changes: dict,
        db: Session
    ) -> ApprovalAuditTrail:
        trail = ApprovalAuditTrail(
            approval_request_id=request_id,
            action=action,
            performed_by=performed_by,
            comments=comments,
            changes_made=changes
        )
        db.add(trail)
        db.commit()
        db.refresh(trail)
        return trail

audit_trail = AuditTrail()
