import json

def validate_invoice(extracted_data: dict) -> list[dict]:
    """
    Validates invoice structural and calculation consistency.
    """
    warnings = []
    
    # 1. Missing Required Fields
    required = ["vendor_name", "total_amount", "due_date"]
    for field in required:
        val = extracted_data.get(field)
        if not val or str(val).strip() == "":
            warnings.append({
                "rule_name": "missing_required_field",
                "severity": "high",
                "description": f"Invoice is missing required field: {field}"
            })
            
    # 2. Inconsistent Totals
    try:
        subtotal = float(extracted_data.get("subtotal") or 0)
        tax_amount = float(extracted_data.get("tax_amount") or 0)
        total_amount = float(extracted_data.get("total_amount") or 0)
        
        if total_amount > 0 and abs(subtotal + tax_amount - total_amount) >= 0.05:
            warnings.append({
                "rule_name": "inconsistent_totals",
                "severity": "medium",
                "description": f"Invoice totals are inconsistent. Subtotal ({subtotal:.2f}) + Tax ({tax_amount:.2f}) = {(subtotal + tax_amount):.2f}, but Total Amount = {total_amount:.2f}."
            })
    except (ValueError, TypeError):
        warnings.append({
            "rule_name": "invalid_numerical_values",
            "severity": "medium",
            "description": "Invoice contains non-numeric subtotal, tax_amount or total_amount."
        })

    # 3. Suspicious Values
    try:
        total_amount = float(extracted_data.get("total_amount") or 0)
        if total_amount < 0:
            warnings.append({
                "rule_name": "suspicious_negative_amount",
                "severity": "high",
                "description": f"Invoice has a negative total amount: {total_amount:.2f}"
            })
        elif total_amount > 100000:
            warnings.append({
                "rule_name": "suspicious_high_amount",
                "severity": "medium",
                "description": f"Invoice amount exceeds standard operational threshold ($100,000): {total_amount:.2f}"
            })
    except (ValueError, TypeError):
        pass

    return warnings

def validate_payroll(extracted_data: dict) -> list[dict]:
    """
    Validates payroll consistency, calculations, and boundaries.
    """
    warnings = []
    
    # 1. Missing Required Fields
    required = ["employee_name", "salary", "net_pay", "payment_date"]
    for field in required:
        val = extracted_data.get(field)
        if not val or str(val).strip() == "":
            warnings.append({
                "rule_name": "missing_required_field",
                "severity": "high",
                "description": f"Payroll record is missing required field: {field}"
            })

    # 2. Invalid Payroll Calculations
    try:
        salary = float(extracted_data.get("salary") or 0)
        net_pay = float(extracted_data.get("net_pay") or 0)
        
        deductions_list = extracted_data.get("deductions") or []
        if isinstance(deductions_list, str):
            try:
                deductions_list = json.loads(deductions_list)
            except json.JSONDecodeError:
                deductions_list = []
                
        total_deductions = 0.0
        if isinstance(deductions_list, list):
            for d in deductions_list:
                if isinstance(d, dict):
                    total_deductions += float(d.get("amount") or 0)
                else:
                    total_deductions += float(d or 0)
                    
        calculated_net = salary - total_deductions
        if abs(calculated_net - net_pay) >= 0.05:
            warnings.append({
                "rule_name": "invalid_payroll_calculation",
                "severity": "high",
                "description": f"Payroll calculations are inconsistent. Salary ({salary:.2f}) - Deductions ({total_deductions:.2f}) = {calculated_net:.2f}, but Net Pay = {net_pay:.2f}."
            })
    except (ValueError, TypeError) as e:
        warnings.append({
            "rule_name": "invalid_numerical_values",
            "severity": "medium",
            "description": f"Payroll record contains invalid numeric values: {str(e)}"
        })

    # 3. Suspicious Values
    try:
        salary = float(extracted_data.get("salary") or 0)
        net_pay = float(extracted_data.get("net_pay") or 0)
        if salary < 0 or net_pay < 0:
            warnings.append({
                "rule_name": "suspicious_negative_salary",
                "severity": "high",
                "description": f"Payroll record has a negative salary or net pay: Salary={salary:.2f}, Net={net_pay:.2f}"
            })
        if net_pay > salary:
            warnings.append({
                "rule_name": "suspicious_net_pay_exceeds_salary",
                "severity": "high",
                "description": f"Net pay ({net_pay:.2f}) is greater than basic salary ({salary:.2f})"
            })
        if salary > 50000:
            warnings.append({
                "rule_name": "suspicious_high_salary",
                "severity": "medium",
                "description": f"Employee monthly salary exceeds standard threshold ($50,000): {salary:.2f}"
            })
    except (ValueError, TypeError):
        pass

    return warnings
