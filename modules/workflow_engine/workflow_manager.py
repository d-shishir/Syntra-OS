import logging
import json
from sqlalchemy.orm import Session
from .models import Workflow, WorkflowRun
from .workflow_executor import WorkflowExecutor
from openai import OpenAI
from app.config import settings
from .tool_registry import tool_registry

logger = logging.getLogger(__name__)

PLANNER_SYSTEM_INSTRUCTION = """
You are the AI Task Planner for Syntra OS.
Your job is to read a user's natural language goal and determine the correct order of tools to execute to achieve that goal.

Available tools in the registry:
{tools_list}

Rules:
1. Output ONLY a valid JSON object matching this schema:
{{
  "name": "A descriptive workflow name based on the goal",
  "steps": ["step_name_1", "step_name_2", ...]
}}
2. Use only step names mapped to registered tools:
   - "extract_document" (for extracting schema, processing invoices/payroll)
   - "detect_anomalies" (for auditing, validation, risk checks)
   - "summarize_document" (for summarizing document details)
   - "search_vector_db" (for semantic search or querying context documents)
   - "send_email" (for notifications, warnings, sending alerts)
   - "generate_report" (for storing results, generating findings reports)
3. Do NOT include markdown styling or ```json code block wrapping.
"""

class WorkflowManager:
    def __init__(self):
        self.executor = WorkflowExecutor()

    def create_workflow(self, db: Session, name: str, steps: list[str], description: str = None) -> Workflow:
        workflow = Workflow(name=name, steps=steps, description=description)
        db.add(workflow)
        db.commit()
        db.refresh(workflow)
        return workflow

    def list_workflows(self, db: Session) -> list[Workflow]:
        return db.query(Workflow).order_by(Workflow.created_at.desc()).all()

    def get_workflow(self, db: Session, workflow_id: str) -> Workflow | None:
        return db.query(Workflow).filter(Workflow.id == workflow_id).first()

    def trigger_workflow(self, db: Session, workflow_id: str, input_context: dict) -> WorkflowRun:
        workflow = self.get_workflow(db, workflow_id)
        if not workflow:
            raise ValueError(f"Workflow '{workflow_id}' not found.")
        return self.executor.execute_workflow(
            db=db,
            workflow_name=workflow.name,
            steps=workflow.steps,
            input_context=input_context,
            workflow_id=str(workflow.id)
        )

    def trigger_workflow_async(self, db: Session, workflow_id: str, input_context: dict, background_tasks) -> WorkflowRun:
        workflow = self.get_workflow(db, workflow_id)
        if not workflow:
            raise ValueError(f"Workflow '{workflow_id}' not found.")
        
        # 1. Start the run log
        from .workflow_logger import WorkflowLogger
        run = WorkflowLogger.start_run(db, workflow.name, str(workflow.id), input_context)
        
        # 2. Defer step execution to background tasks
        from app.database import SessionLocal
        def bg_executor():
            thread_db = SessionLocal()
            try:
                self.executor.execute_workflow(
                    db=thread_db,
                    workflow_name=workflow.name,
                    steps=workflow.steps,
                    input_context=input_context,
                    workflow_id=str(workflow.id),
                    run_id=str(run.id)
                )
            except Exception as e:
                logger.error(f"Async Workflow step execution failed for run {run.id}: {e}")
            finally:
                thread_db.close()
                
        background_tasks.add_task(bg_executor)
        return run

    def plan_and_execute_workflow(self, db: Session, user_goal: str, input_context: dict) -> WorkflowRun:
        """
        Uses AI (or fallback rule-based planner) to translate a user's goal into steps,
        then executes the planned workflow.
        """
        plan = self._generate_ai_plan(user_goal)
        logger.info(f"Planned workflow structure: {plan}")
        
        # Save the workflow definition for traceability
        saved_wf = self.create_workflow(
            db=db,
            name=plan.get("name", "Ad-hoc AI Workflow"),
            steps=plan.get("steps", []),
            description=f"AI Generated plan for: '{user_goal}'"
        )
        
        # Execute the workflow
        return self.executor.execute_workflow(
            db=db,
            workflow_name=saved_wf.name,
            steps=saved_wf.steps,
            input_context=input_context,
            workflow_id=str(saved_wf.id)
        )

    def plan_and_execute_workflow_async(self, db: Session, user_goal: str, input_context: dict, background_tasks) -> WorkflowRun:
        plan = self._generate_ai_plan(user_goal)
        logger.info(f"Planned workflow structure: {plan}")
        
        # Save the workflow definition for traceability
        saved_wf = self.create_workflow(
            db=db,
            name=plan.get("name", "Ad-hoc AI Workflow"),
            steps=plan.get("steps", []),
            description=f"AI Generated plan for: '{user_goal}'"
        )
        
        # 1. Start the run log
        from .workflow_logger import WorkflowLogger
        run = WorkflowLogger.start_run(db, saved_wf.name, str(saved_wf.id), input_context)
        
        # 2. Defer step execution to background tasks
        from app.database import SessionLocal
        def bg_executor():
            thread_db = SessionLocal()
            try:
                self.executor.execute_workflow(
                    db=thread_db,
                    workflow_name=saved_wf.name,
                    steps=saved_wf.steps,
                    input_context=input_context,
                    workflow_id=str(saved_wf.id),
                    run_id=str(run.id)
                )
            except Exception as e:
                logger.error(f"Async Workflow step execution failed for run {run.id}: {e}")
            finally:
                thread_db.close()
                
        background_tasks.add_task(bg_executor)
        return run

    def _generate_ai_plan(self, goal: str) -> dict:
        """
        Uses OpenAI or falls back to offline heuristic planner.
        """
        tools_desc = "\n".join([f"- {t['name']}: {t['description']}" for t in tool_registry.list_tools()])
        
        if settings.OPENAI_API_KEY:
            try:
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": PLANNER_SYSTEM_INSTRUCTION.format(tools_list=tools_desc)},
                        {"role": "user", "content": f"User Goal:\n{goal}"}
                    ],
                    temperature=0.0
                )
                raw_plan = response.choices[0].message.content.strip()
                # Clean code blocks if present
                if raw_plan.startswith("```"):
                    import re
                    raw_plan = re.sub(r"^```(?:json)?\n", "", raw_plan)
                    raw_plan = re.sub(r"\n```$", "", raw_plan)
                return json.loads(raw_plan)
            except Exception as e:
                logger.warning(f"AI workflow planner failed: {str(e)}. Using fallback rule planner.")
        
        return self._generate_mock_plan(goal)

    def _generate_mock_plan(self, goal: str) -> dict:
        """
        Rule-based heuristic planner for offline or fallback execution.
        """
        goal_lower = goal.lower()
        steps = []
        name = "Automated Document Plan"
        
        if "extract" in goal_lower or "read" in goal_lower or "upload" in goal_lower or "invoice" in goal_lower or "payroll" in goal_lower:
            steps.append("extract_document")
            name = "Document Extraction & Auditing"
        
        if "anomaly" in goal_lower or "risk" in goal_lower or "validate" in goal_lower or "audit" in goal_lower:
            if "extract_document" not in steps:
                steps.append("extract_document")
            steps.append("detect_anomalies")
            name = "Audit & Compliance Risk Review"
            
        if "search" in goal_lower or "find" in goal_lower or "query" in goal_lower or "rag" in goal_lower:
            steps.append("search_vector_db")
            name = "Context Retrieval & Search"
            
        if "summarize" in goal_lower or "describe" in goal_lower or "details" in goal_lower:
            steps.append("summarize_document")
            if "summarize" in name.lower() or name == "Automated Document Plan":
                name = "Document Summarization Workflow"
                
        if "report" in goal_lower or "compile" in goal_lower or "store" in goal_lower:
            steps.append("generate_report")
            
        if "email" in goal_lower or "notify" in goal_lower or "send" in goal_lower or "alert" in goal_lower:
            steps.append("send_email")
            
        # Default step chaining if none matched
        if not steps:
            steps = ["extract_document", "detect_anomalies", "summarize_document"]
            name = "Standard Document Review"
            
        return {
            "name": name,
            "steps": steps
        }

# Create a global instance
workflow_manager = WorkflowManager()
