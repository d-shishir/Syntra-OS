from typing import Optional

class ReviewerAssignment:
    """
    Assigns appropriate human reviewers based on department, risk levels, and expertise.
    """
    @staticmethod
    def assign_reviewer(department: str, risk_level: str) -> str:
        dept = department.lower()
        risk = risk_level.lower()

        if dept == "finance":
            if risk == "high":
                return "cfo_executive"
            return "finance_manager"
            
        elif dept == "compliance":
            if risk == "high":
                return "chief_compliance_officer"
            return "compliance_auditor"
            
        elif dept == "sales":
            if risk == "high":
                return "sales_vp"
            return "sales_lead"
            
        else:
            if risk == "high":
                return "operations_director"
            return "ops_coordinator"

reviewer_assignment = ReviewerAssignment()
