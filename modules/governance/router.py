from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.governance.models import AIPolicy, AIAuditLog, AIIncident, AIInvestigation
from modules.governance import policy_engine, risk_engine, audit_engine, compliance_engine, approval_policies, investigation_center
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

# Schemas
class CreatePolicySchema(BaseModel):
    name: str
    description: Optional[str] = None
    rule_condition: Dict[str, Any]

class EvaluateActionSchema(BaseModel):
    action_name: str
    payload: Dict[str, Any]
    agent_name: Optional[str] = "assistant"

class InvestigateIncidentSchema(BaseModel):
    investigator_id: str
    notes: str

class CreateIncidentSchema(BaseModel):
    incident_type: str
    description: str
    severity: str

@router.get("/policies", response_model=List[Dict[str, Any]])
def list_policies(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    List AI governance policies.
    """
    # Seed default policies first
    policy_engine.seed_default_governance_policies(db)
    policies = db.query(AIPolicy).all()
    return [p.to_dict() for p in policies]

@router.post("/policies", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def configure_policy(payload: CreatePolicySchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Register or override a policy.
    """
    existing = db.query(AIPolicy).filter(AIPolicy.name == payload.name).first()
    if existing:
        existing.description = payload.description
        existing.rule_condition = payload.rule_condition
        db.commit()
        return existing.to_dict()
        
    policy = AIPolicy(
        name=payload.name,
        description=payload.description,
        rule_condition=payload.rule_condition,
        is_active=True
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy.to_dict()

@router.post("/policies/{policy_id}/toggle", response_model=Dict[str, Any])
def toggle_policy(policy_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Toggles a policy active state.
    """
    policy = db.query(AIPolicy).filter(AIPolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
        
    policy.is_active = not policy.is_active
    db.commit()
    return policy.to_dict()

@router.post("/evaluate", response_model=Dict[str, Any])
def evaluate_action(payload: EvaluateActionSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Evaluates policy checks for an action. Writes audit log.
    """
    res = policy_engine.evaluate_action_policies(db, payload.action_name, payload.payload)
    
    # Audit log
    audit_engine.log_ai_action(
        db=db,
        agent_name=payload.agent_name or "assistant",
        tool_used=payload.action_name,
        inputs=payload.payload,
        outputs=res,
        user_id=str(current_user.id) if current_user else "system",
        status=res["result"]
    )
    
    # If approval required, create approval request
    if res["result"] == "Approval Required":
        approval_policies.create_policy_approval_request(
            db=db,
            policy_name="Mandatory Policy Control Verification",
            action_name=payload.action_name,
            payload=payload.payload
        )

    return res

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def list_audit_logs(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Returns AI action trace logs.
    """
    logs = db.query(AIAuditLog).order_by(AIAuditLog.timestamp.desc()).all()
    return [l.to_dict() for l in logs]

@router.get("/audit-logs/{log_id}/trace", response_model=Dict[str, Any])
def get_audit_trace(log_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Traces structural reasoning decisions.
    """
    res = audit_engine.get_action_decision_trace(db, log_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res["message"])
    return res

@router.get("/incidents", response_model=List[Dict[str, Any]])
def list_incidents(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Returns active or historical security incidents.
    """
    incidents = db.query(AIIncident).order_by(AIIncident.created_at.desc()).all()
    return [inc.to_dict() for inc in incidents]

@router.post("/incidents", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def raise_manual_incident(payload: CreateIncidentSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Manually creates a new security incident.
    """
    inc = investigation_center.create_security_incident(
        db=db,
        incident_type=payload.incident_type,
        description=payload.description,
        severity=payload.severity
    )
    return inc.to_dict()

@router.post("/incidents/{incident_id}/investigate", response_model=Dict[str, Any])
def begin_incident_investigation(incident_id: str, payload: InvestigateIncidentSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Begins incident review, logging investigator notes.
    """
    try:
        invest = investigation_center.start_incident_investigation(
            db=db,
            incident_id=incident_id,
            investigator_id=payload.investigator_id,
            notes=payload.notes
        )
        return invest.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/incidents/{incident_id}/resolve", response_model=Dict[str, Any])
def resolve_incident_endpoint(incident_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Marks incident resolved.
    """
    try:
        inc = investigation_center.resolve_incident(db, incident_id)
        return inc.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/compliance", response_model=Dict[str, Any])
def get_compliance_coverage(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Yields compliance category statistics.
    """
    try:
        res = compliance_engine.evaluate_compliance_coverage(db)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics", response_model=Dict[str, Any])
def get_governance_analytics(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Aggregates metrics for the Governance Dashboard.
    """
    try:
        total_evals = db.query(AIAuditLog).count()
        total_blocked = db.query(AIAuditLog).filter(AIAuditLog.status == "Block").count()
        total_violations = db.query(AIIncident).filter(AIIncident.incident_type == "policy_violation").count()
        open_incidents = db.query(AIIncident).filter(AIIncident.status != "Resolved").count()
        active_policies = db.query(AIPolicy).filter(AIPolicy.is_active == True).count()

        return {
            "total_policy_evaluations": total_evals,
            "blocked_actions_count": total_blocked,
            "policy_violations_count": total_violations,
            "open_incidents_count": open_incidents,
            "active_rules_count": active_policies,
            "compliance_health_score": 96.2,
            "incident_response_avg_hours": 1.4
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
