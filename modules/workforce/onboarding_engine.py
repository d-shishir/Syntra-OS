import logging
from sqlalchemy.orm import Session
from modules.workforce.models import Contractor, ContractorDocument, ContractorAgreement
from modules.workforce.document_verification import verify_uploaded_document
from modules.workforce.compliance_engine import evaluate_contractor_compliance
from modules.workforce.activation_engine import activate_contractor
from modules.event_system.event_bus import publish_event
from modules.human_review_system.models import ApprovalRequest, ApprovalAuditTrail

logger = logging.getLogger(__name__)

def submit_onboarding_document(db: Session, contractor_id: str, document_type: str, file_name: str) -> dict:
    """
    Submits a contractor document, launches document verification,
    and publishes the documents_uploaded event.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {"status": "error", "message": "Contractor not found"}

    # Upsert document record
    doc = db.query(ContractorDocument).filter(
        ContractorDocument.contractor_id == contractor.id,
        ContractorDocument.document_type == document_type
    ).first()
    
    if not doc:
        doc = ContractorDocument(
            contractor_id=contractor.id,
            document_type=document_type,
            file_name=file_name,
            status="Pending"
        )
        db.add(doc)
    else:
        doc.file_name = file_name
        doc.status = "Pending"
        doc.verification_notes = None
        
    db.commit()
    db.refresh(doc)

    # 1. Publish Event documents_uploaded
    try:
        publish_event(
            db=db,
            event_type="documents_uploaded",
            source_module="workforce",
            payload={"contractor_id": str(contractor.id), "document_id": str(doc.id), "document_type": document_type},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Onboarding Engine: Failed to publish documents_uploaded: {str(e)}")

    # 2. Run document AI verification
    verify_res = verify_uploaded_document(db, doc.id)
    
    # 3. Publish Event verification_completed
    try:
        publish_event(
            db=db,
            event_type="verification_completed",
            source_module="workforce",
            payload={"contractor_id": str(contractor.id), "document_id": str(doc.id), "status": verify_res["status"]},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Onboarding Engine: Failed to publish verification_completed: {str(e)}")

    # Update status to Compliance Review or Pending Documents
    contractor.status = "Compliance Review"
    db.commit()

    return {
        "status": "success",
        "document": doc.to_dict(),
        "verification": verify_res
    }

def run_compliance_check(db: Session, contractor_id: str) -> dict:
    """
    Evaluates compliance rules. If compliance passes, transitions status
    to 'Approval Pending' and registers a Human Review approval request.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {"status": "error", "message": "Contractor not found"}

    comp_res = evaluate_contractor_compliance(db, contractor.id)
    
    if comp_res["status"] == "Passed":
        contractor.status = "Approval Pending"
        db.commit()
        
        # Trigger Approval request
        try:
            req = ApprovalRequest(
                task_type="general_compliance",
                generated_by="workflow",
                risk_score=15,
                risk_level="low",
                risk_reason="Standard global contractor compliance onboarding verification check.",
                status="pending",
                recommended_action="Approve global contractor activation",
                supporting_context={"contractor_id": str(contractor.id), "name": contractor.name, "country": contractor.country},
                assigned_department="Compliance"
            )
            db.add(req)
            db.commit()
            db.refresh(req)
            
            # Audit trail
            trail = ApprovalAuditTrail(
                approval_request_id=req.id,
                action="created",
                performed_by="Onboarding Engine",
                comments="Compliance evaluation passed. Human verification checklist queued."
            )
            db.add(trail)
            db.commit()
            
            publish_event(
                db=db,
                event_type="approval_required",
                source_module="workforce",
                payload={"approval_request_id": str(req.id), "contractor_id": str(contractor.id)},
                priority="medium"
            )
        except Exception as e:
            logger.error(f"Onboarding Engine: Failed to trigger Human Review request: {str(e)}")
            
    else:
        contractor.status = "Pending Documents"
        db.commit()
        
    return {
        "compliance": comp_res,
        "current_status": contractor.status
    }

def grant_onboarding_approval(db: Session, contractor_id: str, reviewer_role: str, comments: str = None) -> dict:
    """
    Simulates compliance or manager approval. If final approval is met,
    calls activation engine to activate the contractor.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {"status": "error", "message": "Contractor not found"}

    # Update approval request status in human review
    req = db.query(ApprovalRequest).filter(
        ApprovalRequest.supporting_context["contractor_id"].astext == str(contractor.id),
        ApprovalRequest.status == "pending"
    ).first()
    
    if req:
        req.status = "approved"
        req.reviewer_comments = comments or f"Approved by {reviewer_role}"
        
        trail = ApprovalAuditTrail(
            approval_request_id=req.id,
            action="approved",
            performed_by=reviewer_role,
            comments=comments or "Reviewed and approved contractor credentials."
        )
        db.add(trail)
        db.commit()

    # Publish approval_granted
    try:
        publish_event(
            db=db,
            event_type="approval_granted",
            source_module="workforce",
            payload={"contractor_id": str(contractor.id), "approved_by": reviewer_role},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Onboarding Engine: Failed to publish approval_granted event: {str(e)}")

    # Transition to Active using activation engine
    act_res = activate_contractor(db, contractor.id)
    return {
        "status": "success",
        "activation": act_res
    }
