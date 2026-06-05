import logging
from sqlalchemy.orm import Session
from modules.human_review_system.models import ApprovalRequest, ApprovalAuditTrail
from modules.event_system.event_bus import publish_event

logger = logging.getLogger(__name__)

def create_policy_approval_request(db: Session, policy_name: str, action_name: str, payload: dict) -> ApprovalRequest:
    """
    Creates an approval request when an AI action violates policy checks
    but can be authorized manually.
    """
    req = ApprovalRequest(
        task_type="general_compliance",
        generated_by="agent",
        risk_score=65,
        risk_level="high",
        risk_reason=f"Action '{action_name}' triggered a policy review on rule '{policy_name}'.",
        status="pending",
        recommended_action="Override policy block with manual authorization",
        supporting_context={"policy_name": policy_name, "action_name": action_name, "details": payload},
        assigned_department="Compliance"
    )
    
    db.add(req)
    db.commit()
    db.refresh(req)

    # Audit Trail
    trail = ApprovalAuditTrail(
        approval_request_id=req.id,
        action="created",
        performed_by="AI Policy Engine",
        comments=f"Automated policy exception request generated. Awaiting governance review."
    )
    db.add(trail)
    db.commit()

    # Emit event
    try:
        publish_event(
            db=db,
            event_type="approval_requested",
            source_module="governance",
            payload={"approval_request_id": str(req.id), "policy_name": policy_name},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Approval Policies: Failed to emit approval_requested event: {str(e)}")

    return req
