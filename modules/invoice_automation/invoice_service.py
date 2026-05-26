import logging
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Invoice, Anomaly, ProcessingLog
from .validator import validate_invoice
from .anomaly_detector import detect_invoice_anomalies

logger = logging.getLogger(__name__)

def process_invoice(db: Session, document_id: str, extracted_json: dict) -> Invoice:
    """
    Handles mapping extracted JSON data to PostgreSQL models, triggers
    validation and anomaly engines, and persists results.
    """
    logger.info(f"Processing invoice for document: {document_id}")
    
    # Map extracted JSON fields (supporting both original and extended schemas)
    vendor_name = extracted_json.get("vendor_name") or extracted_json.get("vendor") or "Unknown Vendor"
    invoice_number = extracted_json.get("invoice_number")
    currency = extracted_json.get("currency") or "USD"
    
    try:
        subtotal = float(extracted_json.get("subtotal")) if extracted_json.get("subtotal") else None
    except (ValueError, TypeError):
        subtotal = None
        
    try:
        tax_amount = float(extracted_json.get("tax_amount")) if extracted_json.get("tax_amount") else None
    except (ValueError, TypeError):
        tax_amount = None
        
    try:
        total_amount = float(extracted_json.get("total_amount") or extracted_json.get("amount") or 0)
    except (ValueError, TypeError):
        total_amount = 0.0

    due_date_str = extracted_json.get("due_date") or extracted_json.get("date")
    due_date = None
    if due_date_str:
        # Check different date string formats
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%B %d, %Y"):
            try:
                due_date = datetime.strptime(str(due_date_str).strip(), fmt)
                break
            except ValueError:
                continue

    payment_terms = extracted_json.get("payment_terms")

    # Clean existing invoice records for this document (supports re-runs)
    existing_invoice = db.query(Invoice).filter(Invoice.document_id == document_id).first()
    if existing_invoice:
        db.delete(existing_invoice)
        db.commit()

    # Create new invoice record
    invoice = Invoice(
        document_id=document_id,
        vendor_name=vendor_name,
        invoice_number=invoice_number,
        currency=currency,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        due_date=due_date,
        payment_terms=payment_terms,
        status="pending"
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    # Perform validation checks
    validation_warnings = validate_invoice(extracted_json)
    
    # Perform anomaly detection checks
    anomalies = detect_invoice_anomalies(db, extracted_json, current_invoice_id=invoice.id)
    
    # Combine issues
    all_issues = validation_warnings + anomalies
    
    status = "validated"
    if all_issues:
        status = "anomaly"
        for issue in all_issues:
            anomaly = Anomaly(
                document_id=document_id,
                invoice_id=invoice.id,
                rule_name=issue["rule_name"],
                severity=issue["severity"],
                description=issue["description"],
                resolved=False
            )
            db.add(anomaly)
            
    invoice.status = status
    db.commit()
    db.refresh(invoice)

    # Log action to processing_logs
    log = ProcessingLog(
        document_id=document_id,
        action="invoice_processing",
        status="warning" if all_issues else "success",
        message=f"Invoice processed. Total: {total_amount:.2f} {currency}. Issues found: {len(all_issues)}",
        details={
            "vendor_name": vendor_name,
            "total_amount": total_amount,
            "issues_count": len(all_issues),
            "issues": all_issues
        }
    )
    db.add(log)
    db.commit()

    logger.info(f"Successfully processed invoice {invoice.id} with status {status}")
    return invoice
