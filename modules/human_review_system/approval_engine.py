import uuid
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from .models import ApprovalRequest
from .approval_policies import approval_policies
from .reviewer_assignment import reviewer_assignment
from .audit_trail import audit_trail

class ApprovalEngine:
    """
    Core engine handling transactional approval gating, pauses/resumes,
    and review decision execution.
    """
    @staticmethod
    def evaluate_and_gate_task(
        task_type: str, 
        context: Dict[str, Any], 
        db: Session, 
        workflow_run_id: Optional[uuid.UUID] = None,
        generated_by: str = "workflow"
    ) -> Dict[str, Any]:
        eval_res = approval_policies.evaluate_risk(task_type, context)
        
        # If medium or high risk, we gate execution
        if eval_res["risk_level"] in ["medium", "high"]:
            reviewer = reviewer_assignment.assign_reviewer(
                eval_res["assigned_department"], 
                eval_res["risk_level"]
            )
            
            # Create review request record
            req = ApprovalRequest(
                task_type=task_type,
                generated_by=generated_by,
                risk_score=eval_res["risk_score"],
                risk_level=eval_res["risk_level"],
                risk_reason=eval_res["reason"],
                status="pending",
                recommended_action=eval_res["recommended_action"],
                supporting_context=context,
                workflow_run_id=workflow_run_id,
                assigned_reviewer=reviewer,
                assigned_department=eval_res["assigned_department"],
                escalation_level=0
            )
            db.add(req)
            db.commit()
            db.refresh(req)
            
            # Log creation in audit trail
            audit_trail.log_action(
                request_id=req.id,
                action="created",
                performed_by="system_approval_engine",
                comments=f"Approval request initialized for task '{task_type}'. Gated by policy reason: {eval_res['reason']}",
                changes=req.to_dict(),
                db=db
            )
            
            return {
                "needs_approval": True,
                "request_id": req.id,
                "risk": eval_res
            }
            
        return {
            "needs_approval": False,
            "risk": eval_res
        }

    @staticmethod
    def is_step_approved(db: Session, workflow_run_id: str, step_name: str) -> bool:
        """
        Verifies if an approval request for this workflow run has already been approved.
        """
        try:
            wf_uuid = uuid.UUID(workflow_run_id)
        except ValueError:
            return False
            
        req = db.query(ApprovalRequest).filter(
            ApprovalRequest.workflow_run_id == wf_uuid,
            ApprovalRequest.status == "approved"
        ).first()
        return req is not None

    @staticmethod
    def approve_request(request_id: uuid.UUID, reviewer_name: str, comments: str, db: Session) -> ApprovalRequest:
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not req:
            raise ValueError(f"Approval request {request_id} not found.")

        req.status = "approved"
        req.reviewer_comments = comments
        req.reviewed_at = func_now_workaround(db)
        db.commit()

        # Log action to audit trail
        audit_trail.log_action(
            request_id=req.id,
            action="approved",
            performed_by=reviewer_name,
            comments=comments or "Approved without comments.",
            changes={"status": "approved", "reviewer_comments": comments},
            db=db
        )

        # Resume paused workflow in background or synchronously
        if req.workflow_run_id:
            try:
                from modules.workflow_engine.workflow_executor import WorkflowExecutor
                executor = WorkflowExecutor()
                # Execute remaining steps
                executor.resume_workflow(db, str(req.workflow_run_id))
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to resume workflow run {req.workflow_run_id}: {str(e)}")

        return req

    @staticmethod
    def reject_request(request_id: uuid.UUID, reviewer_name: str, comments: str, db: Session) -> ApprovalRequest:
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == request_id).first()
        if not req:
            raise ValueError(f"Approval request {request_id} not found.")

        req.status = "rejected"
        req.reviewer_comments = comments
        req.reviewed_at = func_now_workaround(db)
        db.commit()

        # Log action to audit trail
        audit_trail.log_action(
            request_id=req.id,
            action="rejected",
            performed_by=reviewer_name,
            comments=comments or "Rejected by human reviewer.",
            changes={"status": "rejected", "reviewer_comments": comments},
            db=db
        )

        # Mark workflow run as failed
        if req.workflow_run_id:
            try:
                from modules.workflow_engine.models import WorkflowRun
                run = db.query(WorkflowRun).filter(WorkflowRun.id == req.workflow_run_id).first()
                if run:
                    run.status = "failed"
                    run.error = f"Rejected by human reviewer: {reviewer_name}. Comments: {comments}"
                    db.commit()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to fail workflow run {req.workflow_run_id}: {str(e)}")

        return req

def func_now_workaround(db: Session):
    from sqlalchemy import func
    return db.query(func.now()).scalar()

approval_engine = ApprovalEngine()
