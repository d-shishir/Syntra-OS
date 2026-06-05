import logging
from sqlalchemy.orm import Session
from modules.invoice_automation.models import Invoice, Anomaly
from modules.finance.models import Vendor

logger = logging.getLogger(__name__)

def evaluate_financial_anomalies(db: Session) -> dict:
    """
    Evaluates system wide financial invoice transactions for duplicates,
    suspicious amounts, policy breaches, and flags anomalies with risk scores.
    """
    invoices = db.query(Invoice).all()
    
    anomalies = []
    seen_invoices = {}
    
    for inv in invoices:
        # 1. Check Duplicate Invoices
        key = (inv.vendor_name, inv.invoice_number)
        if key in seen_invoices:
            anomalies.append({
                "source_type": "invoice",
                "source_id": str(inv.id),
                "rule_name": "Duplicate Invoice Check",
                "severity": "critical",
                "risk_score": 90,
                "description": f"Duplicate invoice record discovered for vendor {inv.vendor_name} with matching reference #{inv.invoice_number}."
            })
        else:
            seen_invoices[key] = inv.id

        # 2. Check Unusual Payment Volume
        if inv.total_amount and float(inv.total_amount) > 50000.0:
            anomalies.append({
                "source_type": "invoice",
                "source_id": str(inv.id),
                "rule_name": "Unusual Amount Check",
                "severity": "high",
                "risk_score": 75,
                "description": f"Invoice total amount of ${inv.total_amount} exceeds typical business operational guidelines."
            })

    # Save anomalies to DB
    for anom in anomalies:
        db_anom = Anomaly(
            document_id=inv.document_id, # Link to the document
            invoice_id=inv.id,
            rule_name=anom["rule_name"],
            severity=anom["severity"],
            description=anom["description"]
        )
        db.add(db_anom)
    db.commit()

    return {
        "anomalies_count": len(anomalies),
        "anomalies": anomalies
    }
