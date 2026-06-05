import logging
from sqlalchemy.orm import Session
from modules.invoice_automation.models import Invoice
from modules.finance.models import PayrollBatch
from modules.human_review_system.models import ApprovalRequest, ApprovalAuditTrail
from modules.event_system.event_bus import publish_event

logger = logging.getLogger(__name__)

def submit_invoice_for_approval(db: Session, invoice_id: str) -> dict:
    """
    Submits an invoice for manager approval.
    Creates a Human Review approval record and triggers the workflow.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return {"status": "error", "message": "Invoice not found"}

    invoice.status = "Under Review"
    db.commit()

    # Trigger Human Review
    try:
        req = ApprovalRequest(
            task_type="invoice_payment",
            generated_by="workflow",
            risk_score=25,
            risk_level="medium",
            risk_reason="Standard invoice payment verification check.",
            status="pending",
            recommended_action="Authorize invoice payment",
            supporting_context={"invoice_id": str(invoice.id), "vendor": invoice.vendor_name, "amount": float(invoice.total_amount) if invoice.total_amount else 0.0},
            assigned_department="Finance"
        )
        db.add(req)
        db.commit()
        db.refresh(req)

        # Audit log
        trail = ApprovalAuditTrail(
            approval_request_id=req.id,
            action="created",
            performed_by="Finance Studio",
            comments="Invoice submitted for approval. Transaction cleared to review queue."
        )
        db.add(trail)
        db.commit()

        publish_event(
            db=db,
            event_type="approval_required",
            source_module="finance",
            payload={"approval_request_id": str(req.id), "invoice_id": str(invoice.id)},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Finance Approval Router: Failed to create review request: {str(e)}")

    return {
        "status": "success",
        "invoice_id": str(invoice.id),
        "approval_status": "Awaiting Manager Review"
    }

def approve_invoice_payment(db: Session, invoice_id: str, reviewer: str) -> dict:
    """
    Approves invoice payment, transitions status to Approved, and updates the approval requests.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return {"status": "error", "message": "Invoice not found"}

    invoice.status = "Approved"
    db.commit()

    # Update approval request status
    req = db.query(ApprovalRequest).filter(
        ApprovalRequest.supporting_context["invoice_id"].astext == str(invoice.id),
        ApprovalRequest.status == "pending"
    ).first()

    if req:
        req.status = "approved"
        req.reviewer_comments = f"Approved by {reviewer} via Finance Studio"
        
        trail = ApprovalAuditTrail(
            approval_request_id=req.id,
            action="approved",
            performed_by=reviewer,
            comments="Payment authorized. Handed off to payment scheduler."
        )
        db.add(trail)
        db.commit()

    try:
        publish_event(
            db=db,
            event_type="invoice_approved",
            source_module="finance",
            payload={"invoice_id": str(invoice.id), "vendor": invoice.vendor_name, "total_amount": float(invoice.total_amount) if invoice.total_amount else 0.0},
            priority="high"
        )
    except Exception as e:
        logger.error(f"Finance Approval Router: Failed to emit invoice_approved: {str(e)}")

    return {
        "status": "success",
        "invoice_id": str(invoice.id),
        "invoice_status": invoice.status
    }
