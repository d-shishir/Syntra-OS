import uuid
from sqlalchemy.orm import Session
from typing import List, Optional
from .models import ApprovalRequest
from .audit_trail import audit_trail

class ReviewQueue:
    """
    Manages querying, filtering, and reassigning requests in the human review queue.
    """
    @staticmethod
    def list_requests(
        db: Session, 
        department: Optional[str] = None, 
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[ApprovalRequest]:
        query = db.query(ApprovalRequest)
        if department:
            query = query.filter(ApprovalRequest.assigned_department == department)
        if status:
            query = query.filter(ApprovalRequest.status == status)
            
        return query.order_by(ApprovalRequest.created_at.desc()).limit(limit).all()

    @staticmethod
    def assign_request(request_id: uuid.UUID, reviewer_name: str, db: Session, performed_by: str = "system") -> ApprovalRequest:
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not req:
            raise ValueError(f"Approval request {request_id} not found.")

        old_reviewer = req.assigned_reviewer
        req.assigned_reviewer = reviewer_name
        db.commit()

        # Log assignment to audit trail
        audit_trail.log_action(
            request_id=req.id,
            action="reassigned",
            performed_by=performed_by,
            comments=f"Reassigned from {old_reviewer} to {reviewer_name}.",
            changes={"assigned_reviewer": reviewer_name},
            db=db
        )

        return req

review_queue = ReviewQueue()
