import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import get_db
from .models import AITrace, TraceStep, SystemErrorLog, StructuredLog, RAGQualityMetric, ToolCallMetric
from .metrics_collector import metrics_collector
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User

router = APIRouter()

@router.get("/traces")
def get_all_traces(
    module: Optional[str] = Query(None, description="Filter by module"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists recent execution traces with optional filters.
    """
    try:
        query = db.query(AITrace)
        if module:
            query = query.filter(AITrace.module == module)
        if status_filter:
            query = query.filter(AITrace.status == status_filter)
        
        traces = query.order_by(AITrace.created_at.desc()).limit(limit).all()
        return [t.to_dict() for t in traces]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch traces: {str(e)}"
        )

@router.get("/traces/{trace_id}")
def get_trace_details(trace_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves deep trace profiling logs, steps, metrics, tool calls, and errors.
    """
    try:
        t_uuid = uuid.UUID(trace_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format for trace_id"
        )
        
    trace = db.query(AITrace).filter(AITrace.trace_id == t_uuid).first()
    if not trace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trace with ID {trace_id} not found"
        )
        
    steps = db.query(TraceStep).filter(TraceStep.trace_id == t_uuid).order_by(TraceStep.created_at.asc()).all()
    rag = db.query(RAGQualityMetric).filter(RAGQualityMetric.trace_id == t_uuid).all()
    tools = db.query(ToolCallMetric).filter(ToolCallMetric.trace_id == t_uuid).order_by(ToolCallMetric.created_at.asc()).all()
    errors = db.query(SystemErrorLog).filter(SystemErrorLog.trace_id == t_uuid).all()
    logs = db.query(StructuredLog).filter(StructuredLog.trace_id == t_uuid).order_by(StructuredLog.timestamp.asc()).all()
    
    return {
        "trace": trace.to_dict(),
        "steps": [s.to_dict() for s in steps],
        "rag": [r.to_dict() for r in rag],
        "tools": [tl.to_dict() for tl in tools],
        "errors": [err.to_dict() for err in errors],
        "logs": [log.to_dict() for log in logs]
    }

@router.get("/metrics/system")
def get_system_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Compiles system success ratios, token usages, latencies, and tool failures.
    """
    try:
        return metrics_collector.get_system_metrics(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile system metrics: {str(e)}"
        )

@router.get("/errors")
def get_system_errors(limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Lists caught system crash tracebacks and modules.
    """
    try:
        errors = db.query(SystemErrorLog).order_by(SystemErrorLog.created_at.desc()).limit(limit).all()
        return [err.to_dict() for err in errors]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch errors: {str(e)}"
        )

@router.get("/logs")
def get_all_logs(
    severity: Optional[str] = Query(None, description="INFO, WARNING, ERROR, DEBUG"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves latest structured logs from database.
    """
    try:
        query = db.query(StructuredLog)
        if severity:
            query = query.filter(StructuredLog.severity == severity)
        
        logs = query.order_by(StructuredLog.timestamp.desc()).limit(limit).all()
        return [log.to_dict() for log in logs]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch structured logs: {str(e)}"
        )
