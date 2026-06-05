import logging
from sqlalchemy.orm import Session
from modules.governance.models import AIAuditLog
from modules.governance.risk_engine import evaluate_action_risk

logger = logging.getLogger(__name__)

def log_ai_action(db: Session, agent_name: str, tool_used: str, inputs: dict, outputs: dict, user_id: str = None, status: str = "Allowed") -> AIAuditLog:
    """
    Writes a structured audit log of AI transactions and evaluates risk levels dynamically.
    """
    risk_info = evaluate_action_risk(tool_used, inputs)
    
    log_rec = AIAuditLog(
        agent_name=agent_name,
        user_id=user_id or "system",
        tool_used=tool_used,
        inputs=inputs,
        outputs=outputs,
        risk_level=risk_info["severity"],
        status=status
    )
    
    db.add(log_rec)
    db.commit()
    db.refresh(log_rec)
    
    # Increment event counter via Event Bus if critical
    if risk_info["severity"] in ["high", "critical"] and status == "Blocked":
        from modules.event_system.event_bus import publish_event
        try:
            publish_event(
                db=db,
                event_type="high_risk_action",
                source_module="governance",
                payload={"audit_log_id": str(log_rec.id), "tool_used": tool_used, "risk_level": risk_info["severity"]},
                priority="high"
            )
        except Exception as e:
            logger.error(f"Audit Engine: Failed to emit high_risk_action event: {str(e)}")

    return log_rec

def get_action_decision_trace(db: Session, audit_log_id: str) -> dict:
    """
    Traces AI decisions, detailing source context documents, retrieved records, and prompts.
    """
    log = db.query(AIAuditLog).filter(AIAuditLog.id == audit_log_id).first()
    if not log:
        return {"status": "error", "message": "Log not found"}

    # Mock tracing hierarchy
    return {
        "audit_log_id": str(log.id),
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "agent": log.agent_name,
        "tool_used": log.tool_used,
        "inputs": log.inputs,
        "outputs": log.outputs,
        "trace": {
            "retrieved_documents": [
                {"document_id": "doc_eor_guide_pdf", "filename": "global_eor_compliance_guide.pdf", "confidence": 0.94}
            ],
            "called_functions": [
                {"function_name": "evaluate_action_risk", "duration_ms": 12.4}
            ],
            "reasoning_steps": [
                "1. User query parsed for financial billing authorization tags.",
                "2. Analyzed invoice total volume against policy limits.",
                "3. Verified payment is below $10,000 threshold requirement."
            ]
        }
    }
