import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.database import get_db
from .models import ApprovalRequest, ApprovalAuditTrail
from .approval_engine import approval_engine
from .review_queue import review_queue
from .escalation_manager import escalation_manager
from app.services.rag_pipeline import ask_question_rag

router = APIRouter()

class ReviewDecisionRequest(BaseModel):
    reviewer_name: str
    comments: Optional[str] = ""

class ReassignRequest(BaseModel):
    reviewer_name: str
    performed_by: Optional[str] = "system"

@router.get("")
def get_all_reviews(
    department: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Retrieves review items in the queue with optional filters.
    """
    try:
        requests = review_queue.list_requests(db, department, status_filter, limit)
        return [r.to_dict() for r in requests]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch review queue: {str(e)}"
        )

@router.get("/audit-trails")
def get_audit_trails(
    approval_request_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Returns audit trail records for compliance analysis.
    """
    try:
        query = db.query(ApprovalAuditTrail)
        if approval_request_id:
            query = query.filter(ApprovalAuditTrail.approval_request_id == uuid.UUID(approval_request_id))
        
        trails = query.order_by(ApprovalAuditTrail.timestamp.desc()).limit(limit).all()
        return [t.to_dict() for t in trails]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch audit trails: {str(e)}"
        )

@router.post("/{id}/approve")
def approve_request(
    id: str,
    payload: ReviewDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Approves a gated task and resumes workflow execution.
    """
    try:
        req_id = uuid.UUID(id)
        req = approval_engine.approve_request(req_id, payload.reviewer_name, payload.comments, db)
        return {"status": "success", "message": f"Request {id} approved.", "data": req.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{id}/reject")
def reject_request(
    id: str,
    payload: ReviewDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Rejects the request, stopping the linked workflow execution.
    """
    try:
        req_id = uuid.UUID(id)
        req = approval_engine.reject_request(req_id, payload.reviewer_name, payload.comments, db)
        return {"status": "success", "message": f"Request {id} rejected.", "data": req.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{id}/escalate")
def escalate_request(
    id: str,
    payload: ReviewDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Escalates approval review, raising priorities and reassigning to executives.
    """
    try:
        req_id = uuid.UUID(id)
        req = escalation_manager.escalate(req_id, db, payload.reviewer_name, payload.comments)
        return {"status": "success", "message": f"Request {id} escalated.", "data": req.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/{id}/reassign")
def reassign_request(
    id: str,
    payload: ReassignRequest,
    db: Session = Depends(get_db)
):
    """
    Manually reassigns the item to a different human reviewer.
    """
    try:
        req_id = uuid.UUID(id)
        req = review_queue.assign_request(req_id, payload.reviewer_name, db, payload.performed_by)
        return {"status": "success", "message": f"Request {id} reassigned.", "data": req.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/risk-analysis/{id}")
def get_risk_analysis_with_rag(id: str, db: Session = Depends(get_db)):
    """
    Generates AI explanations and queries RAG to find related policy guidelines
    to aid reviewers.
    """
    try:
        req_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid request ID format")
        
    req = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval request not found")

    # Run RAG lookup to retrieve policies matching task type
    rag_query = f"policy guidelines regarding {req.task_type} compliance rules and exceptions"
    try:
        rag_res = ask_question_rag(db, rag_query)
        policy_explanation = rag_res.get("answer", "No compliance policy retrieved from vector database.")
        policy_sources = rag_res.get("sources", [])
    except Exception as e:
        policy_explanation = f"Could not retrieve policy from RAG database: {str(e)}"
        policy_sources = []

    return {
        "request_id": str(req.id),
        "task_type": req.task_type,
        "risk_score": req.risk_score,
        "risk_level": req.risk_level,
        "risk_reason": req.risk_reason,
        "ai_explanation": {
            "recommendation": req.recommended_action or "Review suggested action details",
            "reasoning": f"Flagged by Syntra OS Guardrails due to policy: {req.risk_reason}. Risk classification determined as {req.risk_level} (Score: {req.risk_score}/100).",
            "confidence_score": 0.95
        },
        "rag_retrieved_policy": {
            "query": rag_query,
            "explanation": policy_explanation,
            "sources": policy_sources
        }
    }
