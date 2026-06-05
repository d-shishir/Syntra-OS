import logging
import uuid
import datetime
from sqlalchemy.orm import Session
from modules.invoice_automation.models import Invoice
from modules.finance.models import PaymentRecord
from modules.event_system.event_bus import publish_event
from modules.notification_hub.notification_manager import send_notification

logger = logging.getLogger(__name__)

def schedule_invoice_payment(db: Session, invoice_id: str) -> PaymentRecord:
    """
    Schedules a payment for an approved invoice.
    Transitions invoice status to Approved and creates a Scheduled Payment Record.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise ValueError("Invoice not found")

    # Create Payment Record
    record = PaymentRecord(
        invoice_id=invoice.id,
        amount=invoice.total_amount,
        status="Scheduled",
        payment_date=datetime.datetime.now() + datetime.timedelta(days=3)
    )
    db.add(record)
    
    # Transition invoice status
    invoice.status = "Approved"
    db.commit()
    db.refresh(record)

    # Publish Event
    try:
        publish_event(
            db=db,
            event_type="payment_scheduled",
            source_module="finance",
            payload={"payment_id": str(record.id), "invoice_id": str(invoice.id), "amount": float(record.amount)},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Payment Engine: Failed to publish payment_scheduled: {str(e)}")

    return record

def execute_payment_transaction(db: Session, payment_id: str) -> dict:
    """
    Executes a scheduled payment transaction, creating a mock gateway token.
    Transitions payment record to Executed and invoice status to Paid.
    """
    record = db.query(PaymentRecord).filter(PaymentRecord.id == payment_id).first()
    if not record:
        return {"status": "error", "message": "Payment record not found"}

    # Simulate Gateway execution
    record.status = "Executed"
    record.transaction_id = f"TXN_{uuid.uuid4().hex[:12].upper()}"
    record.payment_date = datetime.datetime.now()
    
    # Update parent invoice status
    invoice = db.query(Invoice).filter(Invoice.id == record.invoice_id).first()
    if invoice:
        invoice.status = "Paid"

    db.commit()

    # 1. Publish Event
    try:
        publish_event(
            db=db,
            event_type="payment_completed",
            source_module="finance",
            payload={"payment_id": str(record.id), "transaction_id": record.transaction_id, "amount": float(record.amount)},
            priority="high"
        )
    except Exception as e:
        logger.error(f"Payment Engine: Failed to publish payment_completed event: {str(e)}")

    # 2. Trigger notification
    try:
        send_notification(
            db=db,
            type="payment_completed",
            priority="high",
            recipient="finance_officer",
            title="Invoice Payment Executed",
            payload={"payment_id": str(record.id), "amount": float(record.amount), "transaction_id": record.transaction_id},
            module="finance"
        )
    except Exception as e:
        logger.error(f"Payment Engine: Failed to send payment notification: {str(e)}")

    return {
        "status": "success",
        "payment_id": str(record.id),
        "transaction_id": record.transaction_id,
        "payment_status": record.status
    }
