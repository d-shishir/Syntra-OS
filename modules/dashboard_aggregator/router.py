import logging
import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db

from modules.dashboard_aggregator.metrics_aggregator import get_dashboard_metrics, calculate_health_score
from modules.dashboard_aggregator.activity_feed import get_historical_activity, feed_manager
from modules.dashboard_aggregator.alert_collector import get_unified_inbox
from modules.dashboard_aggregator.system_summary import generate_ai_summary

from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/overview")
def get_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returns high-level status counts for widgets. Filters or marks access based on user role.
    """
    metrics = get_dashboard_metrics(db)
    
    # Add role context if user is authenticated
    role = current_user.role if current_user else "admin"
    department = current_user.department if current_user else "system"
    
    # Custom dashboard formatting based on roles
    return {
        "role": role,
        "department": department,
        "widgets": metrics
    }

@router.get("/health")
def get_health(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves system health scoring diagnostic parameters.
    """
    return calculate_health_score(db)

@router.get("/inbox")
def get_inbox(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves consolidated alert + approval queue items.
    """
    return get_unified_inbox(db)

@router.get("/summary")
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Compiles AI operations summary paragraph.
    """
    summary = generate_ai_summary(db)
    return {"summary": summary}

@router.get("/activity-feed/history")
def get_feed_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetches historical activity logs list.
    """
    return get_historical_activity(db)

@router.get("/activity-feed/stream")
async def stream_activity_feed(request: Request, current_user: User = Depends(get_current_user)):
    """
    SSE stream endpoint pushing real-time activity events.
    """
    async def event_generator():
        q = feed_manager.add_listener()
        try:
            while True:
                # Check client connection
                if await request.is_disconnected():
                    logger.info("SSE Stream disconnected by client.")
                    break
                
                try:
                    # Non-blocking wait for next event
                    event = await asyncio.wait_for(q.get(), timeout=2.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send keep-alive ping
                    yield "data: {\"ping\": true}\n\n"
        except Exception as e:
            logger.error(f"SSE Event Stream error: {str(e)}")
        finally:
            feed_manager.remove_listener(q)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/quick-action")
def execute_quick_action(action_payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Dispatches operational quick-actions requested directly from dashboard.
    """
    action = action_payload.get("action")
    params = action_payload.get("parameters") or {}
    
    # Enforce RBAC context on actions
    user_role = current_user.role if current_user else "admin"
    user_dept = current_user.department if current_user else "system"
    
    logger.info(f"Dashboard Quick-Action: '{action}' invoked by Role '{user_role}'")
    
    # 1. Trigger Workflow
    if action == "trigger_workflow":
        if user_role not in ["admin", "operations_manager"]:
            raise HTTPException(status_code=403, detail="Unauthorized action: Operations access required.")
            
        workflow_id = params.get("workflow_id")
        input_data = params.get("input_context") or {}
        
        try:
            from modules.workflow_engine.workflow_manager import workflow_manager as wf_mgr
            
            # Check if workflow_id is a real UUID for an existing workflow
            existing_wf = None
            if workflow_id:
                try:
                    import uuid
                    uuid.UUID(workflow_id)
                    existing_wf = wf_mgr.get_workflow(db, workflow_id)
                except (ValueError, TypeError):
                    pass
            
            if existing_wf:
                run = wf_mgr.trigger_workflow(db, workflow_id, input_data)
            else:
                goal = workflow_id.replace('_', ' ').title() if workflow_id else 'Standard Document Review'
                run = wf_mgr.plan_and_execute_workflow(db, goal, input_data)
            
            return {"status": "success", "message": f"Workflow run {run.id} started successfully.", "data": run.to_dict()}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to start workflow: {str(e)}")
            
    # 2. Retry Failed Job
    elif action == "retry_job":
        if user_role not in ["admin", "operations_manager"]:
            raise HTTPException(status_code=403, detail="Unauthorized action: Operations access required.")
            
        job_id = params.get("job_id")
        try:
            from modules.event_system.models import EventJob
            import uuid
            job = db.query(EventJob).filter(EventJob.id == uuid.UUID(job_id)).first()
            if not job:
                raise HTTPException(status_code=404, detail="Background job not found.")
            
            job.status = "queued"
            job.retry_count = 0
            db.commit()
            
            # Publish event
            from modules.event_system.event_bus import publish_event
            publish_event(db, "job_retried", "dashboard", {"job_id": job_id, "message": f"Job {job_id} re-enqueued for execution."})
            
            return {"status": "success", "message": f"Job {job_id} successfully re-enqueued."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to retry job: {str(e)}")

    # 3. Approve Review Request
    elif action == "approve_request":
        if user_role not in ["admin", "finance_manager", "compliance_officer"]:
            raise HTTPException(status_code=403, detail="Unauthorized action: Financial or compliance rights required.")
            
        request_id = params.get("request_id")
        reviewer_name = current_user.name if current_user else "Admin Director"
        comments = params.get("comments") or "Approved via Quick Actions control center."
        
        try:
            from modules.human_review_system.approval_engine import approval_engine
            req = approval_engine.approve_request(request_id, reviewer_name, comments, db)
            return {"status": "success", "message": f"Request {request_id} approved.", "data": req.to_dict()}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Approval action failed: {str(e)}")

    # 4. Search CRM Leads
    elif action == "search_leads":
        query = params.get("query")
        try:
            from modules.crm_intelligence.models import Lead
            leads = db.query(Lead).filter(Lead.name.ilike(f"%{query}%") | Lead.company.ilike(f"%{query}%")).all()
            return {"status": "success", "data": [l.to_dict() for l in leads]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

    # 5. Query RAG System
    elif action == "query_rag":
        question = params.get("question")
        try:
            from app.services.rag_pipeline import ask_question_rag
            response = ask_question_rag(db, question)
            return {"status": "success", "answer": response.get("answer"), "sources": response.get("sources")}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail=f"Unknown quick action: '{action}'")
