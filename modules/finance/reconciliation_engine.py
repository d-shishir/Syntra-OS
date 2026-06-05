import logging
from sqlalchemy.orm import Session
from modules.invoice_automation.models import Invoice
from modules.finance.models import PaymentRecord

logger = logging.getLogger(__name__)

def execute_bank_reconciliation(db: Session) -> dict:
    """
    Compares local Invoices against recorded payment receipts to identify
    unreconciled entries or price differences.
    """
    invoices = db.query(Invoice).all()
    payments = db.query(PaymentRecord).all()
    
    payments_by_invoice = {str(p.invoice_id): p for p in payments}
    
    mismatches = []
    reconciled_count = 0
    mismatch_count = 0
    
    for inv in invoices:
        p = payments_by_invoice.get(str(inv.id))
        
        if not p:
            # Mismatch: unpaid invoice
            mismatches.append({
                "type": "Unpaid Ledger Mismatch",
                "reference_id": str(inv.id),
                "details": f"Invoice #{inv.invoice_number} from vendor '{inv.vendor_name}' for ${inv.total_amount} has no matching payment record."
            })
            mismatch_count += 1
        else:
            inv_amt = float(inv.total_amount) if inv.total_amount else 0.0
            pay_amt = float(p.amount)
            
            if inv_amt != pay_amt:
                mismatches.append({
                    "type": "Discrepancy In Amount",
                    "reference_id": str(inv.id),
                    "details": f"Invoice #{inv.invoice_number} total (${inv_amt}) does not reconcile with paid amount (${pay_amt})."
                })
                mismatch_count += 1
            else:
                reconciled_count += 1

    # Add orphan payments check
    invoices_ids = {str(inv.id) for inv in invoices}
    for p in payments:
        if str(p.invoice_id) not in invoices_ids:
            mismatches.append({
                "type": "Orphan Payment Mismatch",
                "reference_id": str(p.id),
                "details": f"Payment of ${p.amount} exists with no matching ledger invoice in DB."
            })
            mismatch_count += 1

    status = "Unbalanced" if mismatch_count > 0 else "Balanced"
    
    return {
        "reconciliation_status": status,
        "total_records_processed": len(invoices) + len(payments),
        "reconciled_count": reconciled_count,
        "mismatches_count": mismatch_count,
        "mismatches": mismatches
    }
