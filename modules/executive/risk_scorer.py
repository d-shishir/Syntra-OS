from sqlalchemy.orm import Session
from modules.governance.models import AIIncident, AIAuditLog
from modules.api_gateway.models import ApiGatewayLog
from typing import List, Dict

def evaluate_company_risk(db: Session) -> Dict:
    """
    Evaluates system anomalies and assigns a composite risk score (0-100).
    """
    risk_factors = []
    base_score = 10
    
    # 1. Compliance Incident Factor
    active_incidents = db.query(AIIncident).filter(AIIncident.status != "Resolved").all()
    if active_incidents:
        base_score += len(active_incidents) * 20
        risk_factors.append({
            "name": f"{len(active_incidents)} unresolved compliance incidents detected",
            "impact": "High",
            "score_added": len(active_incidents) * 20
        })

    # 2. Audit Violations Factor
    violations = db.query(AIAuditLog).filter(AIAuditLog.risk_level == "critical").count()
    if violations > 0:
        base_score += violations * 15
        risk_factors.append({
            "name": f"{violations} critical audit anomalies recorded",
            "impact": "Medium",
            "score_added": violations * 15
        })

    # 3. API gateway high risk logs
    suspicious_calls = db.query(ApiGatewayLog).filter(ApiGatewayLog.risk_score > 60).count()
    if suspicious_calls > 0:
        base_score += min(25, suspicious_calls * 5)
        risk_factors.append({
            "name": f"{suspicious_calls} suspicious API requests flagged",
            "impact": "Medium",
            "score_added": min(25, suspicious_calls * 5)
        })

    # Cap score at 100
    final_score = min(100, base_score)
    
    severity = "Low"
    if final_score > 70:
        severity = "Critical"
    elif final_score > 40:
        severity = "High"
    elif final_score > 20:
        severity = "Medium"

    return {
        "risk_score": final_score,
        "severity": severity,
        "trend": "Stable" if final_score < 40 else "Increasing",
        "factors": risk_factors
    }
