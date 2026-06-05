import logging
from sqlalchemy.orm import Session
from modules.invoice_automation.models import Invoice

logger = logging.getLogger(__name__)

def transition_invoice_status(db: Session, invoice_id: str, new_status: str) -> dict:
    """
    Manages state transitions for invoices: Draft, Submitted, Under Review, Approved, Rejected, Paid, Archived.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return {"status": "error", "message": "Invoice not found"}

    allowed_statuses = ["Draft", "Submitted", "Under Review", "Approved", "Rejected", "Paid", "Archived"]
    if new_status not in allowed_statuses:
        return {"status": "error", "message": f"Invalid status: {new_status}"}

    invoice.status = new_status
    db.commit()
    db.refresh(invoice)

    return {
        "status": "success",
        "invoice_id": str(invoice.id),
        "current_status": invoice.status
    }

def process_ai_invoice_extraction(db: Session, invoice_id: str, extracted_payload: dict) -> dict:
    """
    Wraps document processing data, mapping invoice values and generating extraction confidence scores.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return {"status": "error", "message": "Invoice not found"}

    # Simulate extraction confidence rating
    vendor = extracted_payload.get("vendor_name", invoice.vendor_name)
    total = extracted_payload.get("total_amount", float(invoice.total_amount) if invoice.total_amount else 0.0)
    
    confidence = 0.95
    if not vendor or total == 0.0:
        confidence = 0.45

    return {
        "invoice_id": str(invoice.id),
        "vendor_name": vendor,
        "total_amount": total,
        "confidence_score": confidence,
        "extraction_status": "Successful" if confidence > 0.7 else "Needs Review"
    }
