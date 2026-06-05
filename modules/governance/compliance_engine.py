import logging
from sqlalchemy.orm import Session
from modules.governance.models import AIPolicy, AIIncident

logger = logging.getLogger(__name__)

def evaluate_compliance_coverage(db: Session) -> dict:
    """
    Groups compliance coverage scores across key organizational branches:
    AI Governance, Security, Workforce, and Finance.
    """
    # Active policies count
    active_policies = db.query(AIPolicy).filter(AIPolicy.is_active == True).count()
    
    # Incident counts
    open_incidents = db.query(AIIncident).filter(AIIncident.status != "Resolved").count()
    resolved_incidents = db.query(AIIncident).filter(AIIncident.status == "Resolved").count()
    
    # Mocking standard operational audit matrices
    coverage = {
        "ai_governance": {
            "score": min(100, int((active_policies / 3.0) * 100)),
            "status": "Nominal",
            "policy_rules_count": active_policies
        },
        "security": {
            "score": 98,
            "status": "Nominal",
            "policy_rules_count": 5
        },
        "workforce": {
            "score": 95,
            "status": "Nominal",
            "policy_rules_count": 4
        },
        "finance": {
            "score": 92,
            "status": "Warning" if open_incidents > 0 else "Nominal",
            "policy_rules_count": 6
        }
    }
    
    overall_health = sum(d["score"] for d in coverage.values()) // len(coverage)

    return {
        "overall_compliance_score": overall_health,
        "active_violations_count": open_incidents,
        "resolved_violations_count": resolved_incidents,
        "domain_coverage": coverage
    }
