import uuid
from sqlalchemy.orm import Session
from .models import ApprovalRequest
from .reviewer_assignment import reviewer_assignment
from .audit_trail import audit_trail

class EscalationManager:
    """
    Manages review request escalations, increasing priorities, reassignment,
    and recording audit logs.
    """
    @staticmethod
    def escalate(request_id: uuid.UUID, db: Session, performed_by: str = "system", comments: str = None) -> ApprovalRequest:
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not req:
            raise ValueError(f"Approval request {request_id} not found.")

        # Update fields
        req.escalation_level += 1
        req.status = "escalated"
        req.risk_level = "high"
        
        # Reassign to high-level reviewer
        new_reviewer = reviewer_assignment.assign_reviewer(req.assigned_department, "high")
        old_reviewer = req.assigned_reviewer
        req.assigned_reviewer = new_reviewer
        
        db.commit()

        # Log action to audit trail
        audit_trail.log_action(
            request_id=req.id,
            action="escalated",
            performed_by=performed_by,
            comments=comments or f"Escalated from level {req.escalation_level - 1} to {req.escalation_level}. Reassigned from {old_reviewer} to {new_reviewer}.",
            changes={
                "escalation_level": req.escalation_level,
                "status": "escalated",
                "risk_level": "high",
                "assigned_reviewer": new_reviewer
            },
            db=db
        )

        return req

escalation_manager = EscalationManager()
