from typing import Dict, Any

class ApprovalPolicies:
    """
    Evaluates transactional parameters and metadata to assign risk levels,
    risk scores, justifications, and departmental reviewers.
    """
    @staticmethod
    def evaluate_risk(task_type: str, context: Dict[str, Any]) -> Dict[str, Any]:
        risk_score = 10
        risk_level = "low"
        reason = "Standard automated execution. Risk falls within acceptable boundaries."
        department = "General"
        recommended_action = "Execute action automatically"

        task_lower = task_type.lower()
        doc_type = str(context.get("document_type", "")).lower()
        extracted_doc_type = ""
        if isinstance(context.get("extracted_data"), dict):
            extracted_doc_type = str(context.get("extracted_data", {}).get("document_type", "")).lower()
        
        # 1. Invoice Routing & Risk Checks
        if "invoice" in task_lower or doc_type == "invoice" or extracted_doc_type == "invoice":
            department = "Finance"
            amount = float(context.get("amount", context.get("invoice_amount", 0.0)))
            is_duplicate = bool(context.get("is_duplicate", False))
            
            if amount > 10000.0 or is_duplicate:
                risk_score = 90
                risk_level = "high"
                reason = f"High-value invoice (${amount:.2f}) detected" + (" with duplicate warnings." if is_duplicate else ".")
                recommended_action = "Approve payment processing after vendor validation"
            elif amount > 5000.0:
                risk_score = 65
                risk_level = "medium"
                reason = f"Invoice payment amount (${amount:.2f}) exceeds standard auto-approval threshold ($5000.00)."
                recommended_action = "Review invoice line-items and approve payment"
            else:
                risk_score = 25
                risk_level = "low"
                reason = f"Invoice value (${amount:.2f}) is within standard auto-approval limits."
                recommended_action = "Auto-execute invoice capture"

        # 2. Payroll Compliance Checks
        elif "payroll" in task_lower or "salary" in task_lower or doc_type == "payroll" or extracted_doc_type == "payroll":
            department = "Finance"
            anomaly_score = float(context.get("anomaly_score", 0.0))
            variance = float(context.get("variance_percentage", 0.0))
            
            if anomaly_score > 75 or variance > 30:
                risk_score = 95
                risk_level = "high"
                reason = f"Severe payroll anomaly score ({anomaly_score}) with {variance}% salary deviation detected."
                recommended_action = "Decline payroll run, verify ledger, and re-audit compliance documentation"
            elif anomaly_score > 40:
                risk_score = 60
                risk_level = "medium"
                reason = f"Moderate payroll variance warning ({variance}% variation) detected."
                recommended_action = "Approve payroll run after verifying timesheets manually"
            else:
                risk_score = 20
                risk_level = "low"
                reason = "Payroll values align with historical variance bands."
                recommended_action = "Auto-approve payroll disbursement"

        # 3. CRM Sales Outreach Checks
        elif "crm" in task_lower or "outreach" in task_lower or "campaign" in task_lower:
            department = "Sales"
            recipients_count = int(context.get("recipients_count", context.get("leads_count", 1)))
            lead_score = int(context.get("lead_score", 100))
            
            if recipients_count > 20:
                risk_score = 80
                risk_level = "high"
                reason = f"Bulk outbound campaign targeting {recipients_count} leads exceeds spam safety thresholds."
                recommended_action = "Approve outreach dispatch after reviewing copy templates"
            elif recipients_count > 5 or lead_score < 40:
                risk_score = 55
                risk_level = "medium"
                reason = f"Campaign size ({recipients_count}) or low prospect score ({lead_score}) requires campaign verification."
                recommended_action = "Verify outreach template custom fields before launching"
            else:
                risk_score = 15
                risk_level = "low"
                reason = "Individual targeted outreach to qualified prospect."
                recommended_action = "Auto-dispatch sequence email"

        # 4. Compliance Audits
        elif "compliance" in task_lower or "audit" in task_lower:
            department = "Compliance"
            compliance_risk = float(context.get("risk_score", 0.0))
            
            if compliance_risk > 70:
                risk_score = 85
                risk_level = "high"
                reason = f"Compliance check failed. Risk score ({compliance_risk}) exceeds tolerance thresholds."
                recommended_action = "Trigger manual audit process and request legal signoff"
            elif compliance_risk > 40:
                risk_score = 50
                risk_level = "medium"
                reason = "Minor compliance variance detected."
                recommended_action = "Approve check after adding validation notes"
            else:
                risk_score = 15
                risk_level = "low"
                reason = "Compliance guidelines satisfied."
                recommended_action = "Approve compliance pass"

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "reason": reason,
            "assigned_department": department,
            "recommended_action": recommended_action
        }

approval_policies = ApprovalPolicies()
