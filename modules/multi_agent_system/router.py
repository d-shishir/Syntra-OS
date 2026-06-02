from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from pydantic import BaseModel
from typing import Dict, List, Optional
from modules.multi_agent_system.agent_registry import agent_registry
from modules.multi_agent_system.communication_bus import communication_bus
from modules.multi_agent_system.task_coordinator import task_coordinator
from modules.multi_agent_system.models import AgentWorkflowRun, AgentLog
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User

router = APIRouter()

class RunTaskRequest(BaseModel):
    goal: str
    context: Optional[dict] = {}

class RegisterAgentRequest(BaseModel):
    key: str
    name: str
    role: str
    description: str
    capabilities: List[str]
    system_prompt: str

@router.post("/run-task")
def run_agent_task(
    request: RunTaskRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kicks off an autonomous multi-agent operational task loop in the background.
    """
    try:
        # We can run it in a background task or run it synchronously if they want quick return.
        # Running it synchronously for simplicity in checking immediate RAG outputs, or running in background.
        # Let's run it synchronously since we added sleep delays to verify outputs quickly.
        # If it takes too long, we can do it in background, but synchronous is best to return final report directly.
        res = task_coordinator.run_autonomous_workflow(request.goal, request.context, db)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Task orchestration failed: {str(e)}"
        )

@router.get("")
def get_agents(current_user: User = Depends(get_current_user)):
    """
    Lists all registered agents, roles, and capabilities.
    """
    return agent_registry.list_agents()

@router.post("/register")
def register_custom_agent(request: RegisterAgentRequest, current_user: User = Depends(get_current_user)):
    """
    Registers a custom agent with specified capabilities.
    """
    agent_registry.register_agent(
        key=request.key,
        name=request.name,
        role=request.role,
        description=request.description,
        capabilities=request.capabilities,
        system_prompt=request.system_prompt
    )
    return {"status": "success", "message": f"Successfully registered custom agent '{request.key}'"}

@router.get("/logs")
def get_agent_logs(run_id: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetches communication logs for a specific run, or all logs.
    """
    try:
        if run_id:
            logs = db.query(AgentLog).filter(AgentLog.workflow_run_id == run_id).order_by(AgentLog.created_at.asc()).all()
        else:
            logs = db.query(AgentLog).order_by(AgentLog.created_at.desc()).limit(100).all()
        return [l.to_dict() for l in logs]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch logs: {str(e)}"
        )

@router.get("/workflows")
def get_agent_workflows(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Retrieves all multi-agent workflow executions and plans history.
    """
    try:
        runs = db.query(AgentWorkflowRun).order_by(AgentWorkflowRun.started_at.desc()).all()
        return [r.to_dict() for r in runs]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch workflows: {str(e)}"
        )
