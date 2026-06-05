import logging

logger = logging.getLogger(__name__)

def evaluate_action_risk(action_name: str, payload: dict) -> dict:
    """
    Computes risk score and severity classifications dynamically based on AI action parameters.
    - Search Query / QA -> Low Risk
    - Document Classification -> Medium Risk
    - Payroll Modification / Enriches -> High Risk
    - Bank Payment Authorization -> Critical Risk
    """
    action_lower = action_name.lower()
    
    if "payment" in action_lower or "payout" in action_lower or "transfer" in action_lower:
        amount = payload.get("amount", 0.0)
        risk_score = 85 if amount < 5000 else 99
        severity = "critical"
        explanation = f"Critical risk assigned: Action involves banking funds execution of ${amount}."
    elif "payroll" in action_lower or "salary" in action_lower or "wage" in action_lower:
        risk_score = 75
        severity = "high"
        explanation = "High risk assigned: Action modifies global payroll compensation structures."
    elif "enrich" in action_lower or "compliance" in action_lower or "verify" in action_lower:
        risk_score = 45
        severity = "medium"
        explanation = "Medium risk assigned: Action processes personal identity or financial records metadata."
    else: # Search/Query/Chat/Analysis
        risk_score = 15
        severity = "low"
        explanation = "Low risk assigned: Action is read-only information retrieval or semantic indexing search."

    return {
        "action": action_name,
        "risk_score": risk_score,
        "severity": severity,
        "explanation": explanation
    }
