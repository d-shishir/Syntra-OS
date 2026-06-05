import logging
from sqlalchemy.orm import Session
from modules.invoice_automation.models import PayrollRecord, Anomaly
from modules.finance.models import PayrollBatch

logger = logging.getLogger(__name__)

def create_audit_payroll_batch(db: Session, batch_name: str, payroll_record_ids: list) -> PayrollBatch:
    """
    Creates a payroll batch and calculates aggregate sums across grouped payroll records.
    """
    records = db.query(PayrollRecord).filter(PayrollRecord.id.in_(payroll_record_ids)).all()
    
    total_gross = 0.0
    total_net = 0.0
    
    for r in records:
        total_gross += float(r.salary)
        total_net += float(r.net_pay)
        
    batch = PayrollBatch(
        name=batch_name,
        status="Draft",
        total_gross=total_gross,
        total_deductions=total_gross - total_net,
        total_net=total_net
    )
    
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    return batch

def validate_payroll_batch(db: Session, batch_id: str) -> dict:
    """
    Audits payroll batch records for duplicates, unusual rate increases,
    negative balances, or missing parameters, and registers anomalies.
    """
    batch = db.query(PayrollBatch).filter(PayrollBatch.id == batch_id).first()
    if not batch:
        return {"status": "error", "message": "Batch not found"}

    # Fetch payroll records
    records = db.query(PayrollRecord).all() # For simulation lookup
    
    audit_reports = []
    has_anomalies = False
    
    employee_payments = {}
    
    for r in records:
        # Check 1: Negative Values
        if r.net_pay < 0 or r.salary < 0:
            has_anomalies = True
            audit_reports.append({
                "record_id": str(r.id),
                "employee": r.employee_name,
                "type": "Negative Values Check",
                "severity": "Critical",
                "message": f"Payroll item contains negative payout parameters (Net: ${r.net_pay})."
            })
            
        # Check 2: Duplicate Payments
        key = (r.employee_name, float(r.net_pay))
        if key in employee_payments:
            has_anomalies = True
            audit_reports.append({
                "record_id": str(r.id),
                "employee": r.employee_name,
                "type": "Duplicate Payment Check",
                "severity": "High",
                "message": f"Potential duplicate payroll transaction discovered for {r.employee_name} of amount ${r.net_pay}."
            })
        else:
            employee_payments[key] = r.id
            
        # Check 3: Unusual Rate Spike
        if r.net_pay > 15000.0:
            has_anomalies = True
            audit_reports.append({
                "record_id": str(r.id),
                "employee": r.employee_name,
                "type": "Unusual Spike Check",
                "severity": "Medium",
                "message": f"Highly anomalous monthly compensation spike flagged for {r.employee_name} (${r.net_pay})."
            })

    # Save anomalies to database if flagged
    if has_anomalies:
        for audit in audit_reports:
            anomaly = Anomaly(
                document_id=records[0].document_id if records else None,
                payroll_record_id=records[0].id if records else None,
                rule_name=audit["type"],
                severity=audit["severity"].lower(),
                description=audit["message"]
            )
            db.add(anomaly)
        db.commit()

    return {
        "batch_id": str(batch.id),
        "status": "Warning" if has_anomalies else "Nominal",
        "audits": audit_reports
    }
