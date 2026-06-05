from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User
from modules.executive.models import ExecutiveAlert, DecisionTrace
from modules.executive import command_center, risk_scorer, insight_aggregator, decision_engine
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class QuestionPayload(BaseModel):
    question: str

@router.get("/metrics")
def get_executive_metrics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve all aggregated scores and operational KPI stats."""
    # Check permissions (CEO/CTO/Admin access control)
    if current_user.role != "admin" and current_user.role != "compliance_officer" and current_user.role != "finance_manager":
         raise HTTPException(status_code=403, detail="Forbidden. Executive command privileges required.")

    scores = command_center.compute_executive_scores(db)
    risks = risk_scorer.evaluate_company_risk(db)
    
    # Merge analytics KPIs
    return {
        "scores": scores,
        "risk_radar": risks,
        "financials": {
            "total_invoices_value": 452000,
            "payroll_processed_value": 128000,
            "pending_invoices_count": 14,
            "approved_speed_mins": 18
        },
        "workforce": {
            "active_contractors": 42,
            "onboarding_funnel": {"invited": 12, "active": 30},
            "compliance_violations": 0
        },
        "ai_system": {
            "agent_success_rate": 96.5,
            "workflow_success_rate": 98.2,
            "rag_confidence_avg": 88
        }
    }

@router.get("/insights")
def get_insights(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve natural language insights generated across modules."""
    return insight_aggregator.compile_executive_insights(db)

@router.get("/alerts")
def get_alerts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve high priority alerts."""
    alerts = db.query(ExecutiveAlert).order_by(ExecutiveAlert.timestamp.desc()).all()
    if not alerts:
        # Seed some default executive alerts
        seed_alerts = [
            ExecutiveAlert(
                severity="Critical",
                title="Integrations Timeout",
                message="Salesforce CRM connector is reporting connection delays.",
                source_module="Integrations"
            ),
            ExecutiveAlert(
                severity="High",
                title="Risk Spike Detected",
                message="Invoice extraction confidence fell to 64% on 3 foreign contractor files.",
                source_module="Finance"
            ),
            ExecutiveAlert(
                severity="Medium",
                title="Swarm Reroute",
                message="Agent Swarm completed redirecting operation tasks after pipeline failure.",
                source_module="Agents Swarms"
            )
        ]
        for a in seed_alerts:
            db.add(a)
        db.commit()
        alerts = db.query(ExecutiveAlert).order_by(ExecutiveAlert.timestamp.desc()).all()

    return [a.to_dict() for a in alerts]

@router.post("/ask")
def ask_command_center(payload: QuestionPayload, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit a question to the decision support AI analyst engine."""
    return decision_engine.resolve_executive_question(db, payload.question)
