from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from .models import Workflow, WorkflowRun, StepExecutionLog
from .workflow_manager import workflow_manager
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from modules.auth_system.access_policies import PermissionGuard

router = APIRouter()

# Schema definitions
class WorkflowCreateSchema(BaseModel):
    name: str
    steps: List[str]
    description: Optional[str] = None

class WorkflowRunRequestSchema(BaseModel):
    workflow_id: Optional[str] = None
    user_goal: Optional[str] = None
    input_context: Dict[str, Any] = {}

@router.post("/create", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreateSchema, db: Session = Depends(get_db), _ = Depends(PermissionGuard("workflow", "execute"))):
    """
    Creates a new configured workflow definition.
    """
    try:
        wf = workflow_manager.create_workflow(
            db=db,
            name=payload.name,
            steps=payload.steps,
            description=payload.description
        )
        return wf.to_dict()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workflow: {str(e)}"
        )

@router.get("", response_model=List[Dict[str, Any]])
def list_workflows(db: Session = Depends(get_db), _ = Depends(PermissionGuard("workflow", "execute"))):
    """
    List all configured workflows.
    """
    try:
        workflows = workflow_manager.list_workflows(db)
        return [w.to_dict() for w in workflows]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/runs", response_model=List[Dict[str, Any]])
def list_workflow_runs(db: Session = Depends(get_db), _ = Depends(PermissionGuard("workflow", "execute"))):
    """
    List history of all workflow executions.
    """
    try:
        runs = db.query(WorkflowRun).order_by(WorkflowRun.started_at.desc()).all()
        return [r.to_dict() for r in runs]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/runs/{run_id}", response_model=Dict[str, Any])
def get_workflow_run_details(run_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("workflow", "execute"))):
    """
    Get detailed metrics and step execution logs for a specific run.
    """
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow run not found"
        )
    steps = db.query(StepExecutionLog).filter(StepExecutionLog.workflow_run_id == run_id).order_by(StepExecutionLog.created_at.asc()).all()
    
    result = run.to_dict()
    result["steps"] = [s.to_dict() for s in steps]
    return result

@router.get("/{workflow_id}", response_model=Dict[str, Any])
def get_workflow_definition(workflow_id: str, db: Session = Depends(get_db), _ = Depends(PermissionGuard("workflow", "execute"))):
    """
    Retrieve specific workflow configuration details.
    """
    wf = workflow_manager.get_workflow(db, workflow_id)
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow definition not found"
        )
    return wf.to_dict()

@router.post("/run", response_model=Dict[str, Any])
def run_workflow(
    payload: WorkflowRunRequestSchema, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    _ = Depends(PermissionGuard("workflow", "execute"))
):
    """
    Runs a saved workflow, or dynamically routes and executes an AI planned workflow based on user goal.
    """
    try:
        if payload.user_goal:
            # Trigger dynamic task planner execution
            run = workflow_manager.plan_and_execute_workflow_async(
                db=db,
                user_goal=payload.user_goal,
                input_context=payload.input_context,
                background_tasks=background_tasks
            )
        elif payload.workflow_id:
            # Trigger standard execution
            run = workflow_manager.trigger_workflow_async(
                db=db,
                workflow_id=payload.workflow_id,
                input_context=payload.input_context,
                background_tasks=background_tasks
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either 'workflow_id' or 'user_goal' prompt must be provided."
            )
        
        # Build response with step status details
        steps = db.query(StepExecutionLog).filter(StepExecutionLog.workflow_run_id == run.id).order_by(StepExecutionLog.created_at.asc()).all()
        res = run.to_dict()
        res["steps"] = [s.to_dict() for s in steps]
        return res
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Execution failed: {str(e)}"
        )
