import logging
import uuid
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from backend.app.database import get_db
from modules.ai_research_engine.models import ResearchTask, ResearchMemory
from modules.ai_research_engine.research_planner import ResearchPlanner
from modules.ai_research_engine.query_decomposer import QueryDecomposer
from modules.ai_research_engine.data_collector import UnifiedDataCollector
from modules.ai_research_engine.insight_synthesizer import InsightSynthesizer
from modules.ai_research_engine.report_generator import ReportGenerator
from modules.ai_research_engine.evaluation_engine import ResearchEvaluationEngine
from modules.ai_research_engine.research_memory import ResearchMemoryManager
from modules.auth_system.router import get_current_user
from modules.auth_system.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

planner = ResearchPlanner()
decomposer = QueryDecomposer()
collector = UnifiedDataCollector()
synthesizer = InsightSynthesizer()
report_generator = ReportGenerator()
evaluator = ResearchEvaluationEngine()
memory_manager = ResearchMemoryManager()

def run_research_pipeline(task_id: uuid.UUID, goal: str, db_session_factory):
    """
    Executes the autonomous research workflow step-by-step in a background thread.
    """
    db = db_session_factory()
    try:
        task = db.query(ResearchTask).filter(ResearchTask.id == task_id).first()
        if not task:
            logger.error(f"Background Research: Task {task_id} not found in database.")
            return

        task.status = "running"
        db.commit()

        # Step 1: Planning sub-tasks
        sub_tasks = planner.generate_plan(goal, db)
        task.sub_tasks = sub_tasks
        db.commit()

        # Step 2: Data Collection Fusion
        all_evidence = []
        for step in sub_tasks:
            params = decomposer.decompose(step)
            evidence = collector.collect_evidence(db, params["search_term"], params["filters"])
            all_evidence.extend(evidence)

        # Step 3: Insight Synthesis
        insights = synthesizer.synthesize(goal, all_evidence, db)

        # Step 4: Report compilation
        report = report_generator.generate(goal, insights, all_evidence)

        # Step 5: Score Evaluation
        confidence = evaluator.evaluate(sub_tasks, all_evidence, report)

        # Step 6: Commit Memory
        memory_manager.save_to_memory(
            db=db,
            goal=goal,
            findings=report["executive_summary"],
            key_metrics={
                "evidence_count": len(all_evidence),
                "confidence_score": confidence
            }
        )

        # Step 7: Update Task Complete
        task.status = "completed"
        task.report_content = report
        task.confidence_score = confidence
        task.completed_at = datetime.now(timezone.utc)
        db.commit()

        # Trigger workflow if anomalies are found heuristically
        if insights.get("anomalies"):
            try:
                from modules.event_system.event_bus import publish_event
                publish_event(
                    db=db,
                    event_type="anomaly_detected",
                    source_module="ai_research_engine",
                    payload={
                        "risk_score": 0.85,
                        "details": f"Autonomous research detected anomaly: {insights['anomalies'][0]}"
                    },
                    priority="high"
                )
                logger.info("Research Engine: Triggered automated anomaly workflow response.")
            except Exception as ev_err:
                logger.warning(f"Research Engine failed to fire event: {str(ev_err)}")

        logger.info(f"Background Research: Task {task_id} completed successfully.")
    except Exception as e:
        db.rollback()
        logger.error(f"Background Research failed for task {task_id}: {str(e)}", exc_info=True)
        try:
            task = db.query(ResearchTask).filter(ResearchTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.report_content = {"error": str(e)}
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

@router.post("/run")
def trigger_research(payload: Dict[str, Any], background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Submits a new research goal to execute in the background.
    """
    goal = payload.get("goal", "")
    if not goal or not goal.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'goal' parameter."
        )

    task = ResearchTask(goal=goal.strip(), status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)

    # Launch task in background thread
    from backend.app.database import SessionLocal
    background_tasks.add_task(run_research_pipeline, task.id, task.goal, SessionLocal)

    return task.to_dict()

@router.get("/history")
def get_research_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Lists past query findings.
    """
    try:
        tasks = db.query(ResearchTask).order_by(ResearchTask.created_at.desc()).limit(15).all()
        return [t.to_dict() for t in tasks]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/{task_id}")
def get_task_status(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetch active details and progress of a task.
    """
    try:
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format."
        )
        
    task = db.query(ResearchTask).filter(ResearchTask.id == task_uuid).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Research task not found."
        )
    return task.to_dict()

@router.post("/plan")
def generate_draft_plan(payload: Dict[str, Any], current_user: User = Depends(get_current_user)):
    """
    Drafts research steps without launching execution.
    """
    goal = payload.get("goal", "")
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'goal' field."
        )
    steps = planner.generate_plan(goal)
    return {
        "goal": goal,
        "sub_tasks": steps
    }

@router.get("/report/{task_id}")
def get_research_report(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetch final structured markdown output.
    """
    task = get_task_status(task_id, db, current_user=current_user)
    report = task.get("report_content")
    if not report or "markdown" not in report:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report content is not ready or failed."
        )
    return report
