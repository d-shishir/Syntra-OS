from sqlalchemy import func
from sqlalchemy.orm import Session
from .models import Invoice, PayrollRecord

def detect_invoice_anomalies(db: Session, invoice_data: dict, current_invoice_id=None) -> list[dict]:
    """
    Scans the database and current fields for suspicious patterns in invoices.
    """
    anomalies = []
    vendor_name = invoice_data.get("vendor_name")
    invoice_number = invoice_data.get("invoice_number")
    
    try:
        total_amount = float(invoice_data.get("total_amount") or 0)
        subtotal = float(invoice_data.get("subtotal") or 0)
        tax_amount = float(invoice_data.get("tax_amount") or 0)
    except (ValueError, TypeError):
        total_amount, subtotal, tax_amount = 0.0, 0.0, 0.0

    # 1. Duplicate Invoice Numbers (same vendor + invoice number)
    if vendor_name and invoice_number:
        query = db.query(Invoice).filter(
            func.lower(Invoice.vendor_name) == vendor_name.lower(),
            Invoice.invoice_number == invoice_number
        )
        if current_invoice_id:
            query = query.filter(Invoice.id != current_invoice_id)
        
        duplicate = query.first()
        if duplicate:
            anomalies.append({
                "rule_name": "duplicate_invoice_number",
                "severity": "high",
                "description": f"Invoice number '{invoice_number}' already exists in the system for vendor '{vendor_name}' (First seen in invoice ID {duplicate.id})."
            })

    # 2. Abnormal Payment Amounts (compared to vendor average)
    if vendor_name and total_amount > 0:
        query = db.query(func.avg(Invoice.total_amount), func.count(Invoice.id)).filter(
            func.lower(Invoice.vendor_name) == vendor_name.lower()
        )
        if current_invoice_id:
            query = query.filter(Invoice.id != current_invoice_id)
            
        avg_amount, count = query.first()
        
        if count and count >= 1 and avg_amount:
            avg_amount = float(avg_amount)
            if total_amount > 2.0 * avg_amount:
                anomalies.append({
                    "rule_name": "abnormal_payment_amount",
                    "severity": "medium",
                    "description": f"Invoice total amount ({total_amount:.2f}) is abnormally high. It is more than 2x the historical average for vendor '{vendor_name}' ({avg_amount:.2f} over {count} invoices)."
                })

    # 3. Inconsistent Tax Calculations
    if subtotal > 0 and tax_amount > 0:
        tax_rate = tax_amount / subtotal
        if tax_rate < 0.02 or tax_rate > 0.35:
            anomalies.append({
                "rule_name": "inconsistent_tax_calculations",
                "severity": "low",
                "description": f"Detected an unusual tax rate of {tax_rate * 100:.1f}% (Tax: {tax_amount:.2f}, Subtotal: {subtotal:.2f}). Standard rates are between 2% and 35%."
            })
    elif total_amount > 0 and subtotal > 0 and tax_amount == 0:
        if abs(total_amount - subtotal) >= 0.05:
            anomalies.append({
                "rule_name": "inconsistent_tax_calculations",
                "severity": "medium",
                "description": f"Tax amount is reported as 0.00, but Total ({total_amount:.2f}) differs from Subtotal ({subtotal:.2f})."
            })

    return anomalies

def detect_payroll_anomalies(db: Session, payroll_data: dict, current_record_id=None) -> list[dict]:
    """
    Scans the database and current fields for suspicious patterns in payroll records.
    """
    anomalies = []
    employee_name = payroll_data.get("employee_name")
    
    try:
        salary = float(payroll_data.get("salary") or 0)
        net_pay = float(payroll_data.get("net_pay") or 0)
    except (ValueError, TypeError):
        salary, net_pay = 0.0, 0.0

    # 1. Suspicious Payroll Spikes
    if employee_name and net_pay > 0:
        query = db.query(func.avg(PayrollRecord.net_pay), func.count(PayrollRecord.id)).filter(
            func.lower(PayrollRecord.employee_name) == employee_name.lower()
        )
        if current_record_id:
            query = query.filter(PayrollRecord.id != current_record_id)
            
        avg_net, count = query.first()
        
        if count and count >= 1 and avg_net:
            avg_net = float(avg_net)
            if net_pay > 1.5 * avg_net:
                anomalies.append({
                    "rule_name": "suspicious_payroll_spike",
                    "severity": "high",
                    "description": f"Net pay of {net_pay:.2f} represents a spike of over 50% compared to employee's historical average ({avg_net:.2f} over {count} payroll statements)."
                })

    return anomalies
