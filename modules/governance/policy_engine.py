import logging
from sqlalchemy.orm import Session
from modules.governance.models import AIPolicy, AIIncident
from modules.event_system.event_bus import publish_event

logger = logging.getLogger(__name__)

def seed_default_governance_policies(db: Session):
    """
    Seeds organization compliance and AI security policies.
    """
    default_policies = [
        {
            "name": "Limit AI Payment Clearances",
            "description": "No AI agent may approve payment invoice amounts above $10,000.",
            "rule_condition": {"max_amount": 10000, "action": "payment"}
        },
        {
            "name": "Mandatory Human Payroll Sign-off",
            "description": "Any change to payroll gross compensation or adding entries requires direct human reviews.",
            "rule_condition": {"requires_human": True, "action": "payroll_change"}
        },
        {
            "name": "AI Report Verification Check",
            "description": "AI autonomous research or compliance filings must be reviewed before external routing.",
            "rule_condition": {"review_required": True, "action": "publish_report"}
        }
    ]

    for p in default_policies:
        existing = db.query(AIPolicy).filter(AIPolicy.name == p["name"]).first()
        if not existing:
            policy = AIPolicy(
                name=p["name"],
                description=p["description"],
                rule_condition=p["rule_condition"],
                is_active=True
            )
            db.add(policy)
    db.commit()

def evaluate_action_policies(db: Session, action_name: str, payload: dict) -> dict:
    """
    Checks if an action violates active policies.
    Returns: 'Allow', 'Block', or 'Approval Required'.
    """
    seed_default_governance_policies(db)
    
    policies = db.query(AIPolicy).filter(AIPolicy.is_active == True).all()
    
    for policy in policies:
        cond = policy.rule_condition
        
        # Payment Check
        if cond.get("action") == "payment" and action_name == "approve_payment":
            amount = payload.get("amount", 0.0)
            if amount > cond.get("max_amount", 10000):
                # Trigger Policy Violation Event & Incident
                trigger_policy_violation(db, policy.name, f"Blocked AI attempt to clear payment of ${amount} (Max threshold: ${cond['max_amount']})")
                return {"result": "Block", "reason": f"Action violates policy '{policy.name}': Payment amount of ${amount} exceeds AI clearance limits."}
                
        # Payroll Check
        if cond.get("action") == "payroll_change" and action_name == "modify_payroll":
            # Requires human approval
            return {"result": "Approval Required", "reason": f"Action requires Human Review check: '{policy.name}' policy rules check failed."}

        # Publish check
        if cond.get("action") == "publish_report" and action_name == "distribute_compliance":
            return {"result": "Approval Required", "reason": f"Distribution requires officer verification: '{policy.name}' rules constraint."}

    return {"result": "Allow", "reason": "Action evaluated successfully. Policy boundaries nominal."}

def trigger_policy_violation(db: Session, policy_name: str, detail: str):
    """
    Registers a policy violation incident and emits event signals.
    """
    try:
        incident = AIIncident(
            incident_type="policy_violation",
            description=f"Policy violation on rule '{policy_name}': {detail}",
            severity="high",
            status="Detected"
        )
        db.add(incident)
        db.commit()

        publish_event(
            db=db,
            event_type="policy_violation",
            source_module="governance",
            payload={"policy_name": policy_name, "incident_id": str(incident.id), "detail": detail},
            priority="high"
        )
    except Exception as e:
        logger.error(f"Policy Engine: Failed to register policy violation incident: {str(e)}")
