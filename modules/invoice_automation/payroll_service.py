import logging
import json
from datetime import datetime
from sqlalchemy.orm import Session
from .models import PayrollRecord, Anomaly, ProcessingLog
from .validator import validate_payroll
from .anomaly_detector import detect_payroll_anomalies

logger = logging.getLogger(__name__)

def process_payroll(db: Session, document_id: str, extracted_json: dict) -> PayrollRecord:
    """
    Handles mapping extracted JSON data to PostgreSQL models, triggers
    validation and anomaly engines, and persists results.
    """
    logger.info(f"Processing payroll for document: {document_id}")
    
    employee_name = extracted_json.get("employee_name") or "Unknown Employee"
    
    try:
        salary = float(extracted_json.get("salary") or 0)
    except (ValueError, TypeError):
        salary = 0.0
        
    try:
        net_pay = float(extracted_json.get("net_pay") or 0)
    except (ValueError, TypeError):
        net_pay = 0.0

    deductions = extracted_json.get("deductions") or []
    if isinstance(deductions, str):
        try:
            deductions = json.loads(deductions)
        except json.JSONDecodeError:
            deductions = []

    payment_date_str = extracted_json.get("payment_date") or extracted_json.get("date")
    payment_date = None
    if payment_date_str:
        # Check different date string formats
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%B %d, %Y"):
            try:
                payment_date = datetime.strptime(str(payment_date_str).strip(), fmt)
                break
            except ValueError:
                continue

    # Clean existing payroll records for this document (supports re-runs)
    existing_payroll = db.query(PayrollRecord).filter(PayrollRecord.document_id == document_id).first()
    if existing_payroll:
        db.delete(existing_payroll)
        db.commit()

    # Create new payroll record
    payroll = PayrollRecord(
        document_id=document_id,
        employee_name=employee_name,
        salary=salary,
        deductions=deductions,
        net_pay=net_pay,
        payment_date=payment_date,
        status="pending"
    )
    db.add(payroll)
    db.commit()
    db.refresh(payroll)

    # Perform validation checks
    validation_warnings = validate_payroll(extracted_json)
    
    # Perform anomaly detection checks
    anomalies = detect_payroll_anomalies(db, extracted_json, current_record_id=payroll.id)
    
    # Combine issues
    all_issues = validation_warnings + anomalies
    
    status = "validated"
    if all_issues:
        status = "anomaly"
        for issue in all_issues:
            anomaly = Anomaly(
                document_id=document_id,
                payroll_record_id=payroll.id,
                rule_name=issue["rule_name"],
                severity=issue["severity"],
                description=issue["description"],
                resolved=False
            )
            db.add(anomaly)
            
    payroll.status = status
    db.commit()
    db.refresh(payroll)

    # Log action to processing_logs
    log = ProcessingLog(
        document_id=document_id,
        action="payroll_processing",
        status="warning" if all_issues else "success",
        message=f"Payroll processed. Salary: {salary:.2f}, Net Pay: {net_pay:.2f}. Issues found: {len(all_issues)}",
        details={
            "employee_name": employee_name,
            "salary": salary,
            "net_pay": net_pay,
            "issues_count": len(all_issues),
            "issues": all_issues
        }
    )
    db.add(log)
    db.commit()

    logger.info(f"Successfully processed payroll record {payroll.id} with status {status}")
    return payroll
