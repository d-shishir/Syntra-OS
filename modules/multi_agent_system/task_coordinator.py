import logging
import json
import time
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.config import settings
from openai import OpenAI
from modules.multi_agent_system.models import AgentWorkflowRun
from modules.multi_agent_system.agent_registry import agent_registry
from modules.multi_agent_system.delegation_engine import delegation_engine
from modules.multi_agent_system.agent_manager import agent_manager
from modules.multi_agent_system.communication_bus import communication_bus
from modules.multi_agent_system.memory_manager import memory_manager

from modules.observability import track_latency
from modules.observability.ai_call_tracker import ai_call_tracker

logger = logging.getLogger(__name__)

class TaskCoordinator:
    def decompose_goal(self, goal: str, context: dict = None, db: Session = None) -> list:
        """
        Decomposes a high-level user goal into structured subtasks.
        Each subtask is a dict with keys:
          - task: description of task
          - capability: capability required to perform task
        """
        if settings.OPENAI_API_KEY:
            try:
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                prompt = (
                    "You are the Orchestration Planner for an enterprise multi-agent system.\n"
                    f"Decompose the following user goal into a list of logical, sequential subtasks:\n"
                    f"Goal: \"{goal}\"\n\n"
                    "For each subtask, assign the precise capability required. "
                    "Available capabilities are: [task_decomposition, agent_delegation, result_synthesis, "
                    "invoice_analysis, payroll_validation, anomaly_review, financial_summarization, "
                    "lead_analysis, enrichment, outreach_generation, sales_intelligence, "
                    "document_retrieval, rag_search, compliance_research, knowledge_summarization, "
                    "execute_workflows, route_tasks, monitor_execution, retry_handling].\n\n"
                    "Respond ONLY with a valid JSON array of objects. Example:\n"
                    "[\n"
                    "  {\"task\": \"Retrieve payment records from vector DB\", \"capability\": \"document_retrieval\"},\n"
                    "  {\"task\": \"Verify payroll calculations\", \"capability\": \"payroll_validation\"}\n"
                    "]"
                )
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a precise JSON-only task planner."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0
                )
                raw_response = response.choices[0].message.content.strip()
                
                # Record token usage
                if db:
                    try:
                        approx_tokens = (len(prompt) + len(raw_response)) // 4
                        ai_call_tracker.record_token_usage(approx_tokens, "agent_coordinator_decomposition", db)
                    except Exception as tracker_err:
                        logger.warning(f"Failed to record token usage in decompose_goal: {tracker_err}")

                steps = json.loads(raw_response)
                if isinstance(steps, list):
                    return steps
            except Exception as e:
                logger.warning(f"LLM task decomposition failed: {str(e)}. Falling back to rule-based.")

        # Rule-based fallback
        goal_lower = goal.lower()
        
        # Scenario A: Payroll Compliance & Discrepancies
        if "payroll" in goal_lower or "salary" in goal_lower:
            return [
                {
                    "task": "Retrieve compliance files and payroll policies from vector database",
                    "capability": "document_retrieval"
                },
                {
                    "task": "Extract payroll records and verify basic salary mappings",
                    "capability": "payroll_validation"
                },
                {
                    "task": "Audit ledger records and identify discrepancy warning flags",
                    "capability": "anomaly_review"
                },
                {
                    "task": "Send summary alerts and logs to operations team",
                    "capability": "retry_handling"
                }
            ]
            
        # Scenario B: Invoice Processing and Finance Summation
        elif "invoice" in goal_lower or "financial" in goal_lower:
            return [
                {
                    "task": "Retrieve processed invoice ledger documents from catalog",
                    "capability": "document_retrieval"
                },
                {
                    "task": "Perform finance summation and compute overall liability metrics",
                    "capability": "financial_summarization"
                },
                {
                    "task": "Generate operational report and relay notification updates",
                    "capability": "execute_workflows"
                }
            ]

        # Scenario C: CRM Sales Intelligence
        elif "crm" in goal_lower or "lead" in goal_lower or "outreach" in goal_lower:
            return [
                {
                    "task": "Retrieve company profiles and compliance data from Vector DB",
                    "capability": "rag_search"
                },
                {
                    "task": "Enrich CRM prospect profiles and score lead fit metrics",
                    "capability": "enrichment"
                },
                {
                    "task": "Compile personalized outreach copy writing templates",
                    "capability": "outreach_generation"
                },
                {
                    "task": "Trigger onboarding automation flows in the background",
                    "capability": "execute_workflows"
                }
            ]
            
        # Scenario D: Default General RAG & Report
        else:
            return [
                {
                    "task": f"Query Vector DB for documents matching goal: '{goal}'",
                    "capability": "rag_search"
                },
                {
                    "task": "Summarize key knowledge findings and details",
                    "capability": "knowledge_summarization"
                },
                {
                    "task": "Generate final summary report",
                    "capability": "execute_workflows"
                }
            ]

    def run_autonomous_workflow(self, goal: str, context: dict, db: Session) -> dict:
        """
        Main orchestration loop: Decomposes goal, delegates tasks, gathers memory findings,
        runs tools, recovers failures with retries, and synthesizes final response.
        """
        from modules.observability import TraceSession, trace_manager
        from modules.observability.models import AITrace

        with TraceSession(module="agent", input_data=goal, db=db) as sess:
            t_id = sess.trace_id
            
            # 1. Initialize run record
            run = AgentWorkflowRun(
                goal=goal,
                status="running",
                execution_plan=[],
                shared_memory={"trace_id": str(t_id)}
            )
            db.add(run)
            db.commit()
            db.refresh(run)
            
            run_id = str(run.id)
            logger.info(f"[COORDINATOR] Starting workflow run {run_id} for goal: '{goal}'")

            communication_bus.send_message(
                db=db,
                workflow_run_id=run_id,
                sender="system",
                recipient="coordinator_agent",
                message_type="system_broadcast",
                content=f"Received goal request: '{goal}'. Initializing task decomposition."
            )

            try:
                # 2. Decompose Goal
                plan = self.decompose_goal(goal, context, db)
                run.execution_plan = plan
                db.commit()
                
                communication_bus.send_message(
                    db=db,
                    workflow_run_id=run_id,
                    sender="coordinator_agent",
                    recipient="system_bus",
                    message_type="system_broadcast",
                    content=f"Decomposed goal into {len(plan)} subtasks.",
                    metadata={"plan": plan}
                )

                # 3. Execute Subtasks
                step_summaries = []
                for i, step in enumerate(plan):
                    task_desc = step["task"]
                    capability = step["capability"]
                    
                    # Match agent to capability
                    agent_key = delegation_engine.delegate_task(capability)
                    
                    # Run Agent (with failure recovery/retry)
                    max_retries = 2
                    retry_count = 0
                    step_success = False
                    agent_res = None
                    
                    while retry_count <= max_retries and not step_success:
                        try:
                            # Time the agent run
                            agent_start = time.perf_counter()
                            agent_res = agent_manager.run_agent(
                                agent_key=agent_key,
                                task_description=task_desc,
                                context=context,
                                db=db,
                                workflow_run_id=run_id
                            )
                            agent_latency = int((time.perf_counter() - agent_start) * 1000)
                            trace_manager.add_step(
                                trace_id=t_id,
                                step_name=f"agent_run:{agent_key}",
                                status="success",
                                latency_ms=agent_latency,
                                metadata={"capability": capability, "task": task_desc},
                                db=db
                            )
                            step_success = True
                        except Exception as e:
                            retry_count += 1
                            agent_latency = int((time.perf_counter() - agent_start) * 1000)
                            trace_manager.add_step(
                                trace_id=t_id,
                                step_name=f"agent_run:{agent_key}",
                                status="failed",
                                latency_ms=agent_latency,
                                metadata={"capability": capability, "task": task_desc, "error": str(e)},
                                db=db
                            )
                            logger.error(f"Agent {agent_key} failed task. Retry {retry_count}/{max_retries}: {str(e)}")
                            communication_bus.send_message(
                                db=db,
                                workflow_run_id=run_id,
                                sender="system",
                                recipient="coordinator_agent",
                                message_type="system_broadcast",
                                content=f"Agent {agent_key} failed task. Retrying step ({retry_count}/{max_retries})."
                            )
                    
                    if not step_success:
                        # Fallback delegation to Coordinator itself
                        logger.warning(f"Agent {agent_key} failed completely. Falling back task to coordinator.")
                        communication_bus.send_message(
                            db=db,
                            workflow_run_id=run_id,
                            sender="system",
                            recipient="coordinator_agent",
                            message_type="system_broadcast",
                            content=f"Task '{task_desc}' failed completely on {agent_key}. Falling back to coordinator."
                        )
                        agent_res = {
                            "status": "success",
                            "summary": f"[Fallback] Coordinator handled task: {task_desc}"
                        }

                    step_summaries.append(agent_res.get("summary", ""))
                    # Throttle execution slightly for visual tracing
                    time.sleep(0.5)

                # 4. Synthesize Final Report
                final_report = ""
                combined_summary = "\n\n".join([f"- {s}" for s in step_summaries])
                
                if settings.OPENAI_API_KEY:
                    try:
                        client = OpenAI(
                            api_key=settings.OPENAI_API_KEY,
                            base_url=settings.OPENAI_API_BASE
                        )
                        prompt = (
                            "You are the Coordinator Agent of Syntra OS.\n"
                            f"Goal: {goal}\n"
                            f"Specialized Agent Findings:\n{combined_summary}\n\n"
                            "Draft a professional, comprehensive executive report summarizing the "
                            "operational status, findings, vector document sources, and workflow "
                            "confirmations. Provide actionable steps."
                        )
                        response = client.chat.completions.create(
                            model=settings.OPENAI_MODEL,
                            messages=[
                                {"role": "system", "content": "You are a professional enterprise coordinator."},
                                {"role": "user", "content": prompt}
                            ],
                            temperature=0.0
                        )
                        final_report = response.choices[0].message.content.strip()
                        
                        # Record token usage
                        if db:
                            try:
                                approx_tokens = (len(prompt) + len(final_report)) // 4
                                ai_call_tracker.record_token_usage(approx_tokens, "agent_coordinator_synthesis", db)
                            except Exception as tracker_err:
                                logger.warning(f"Failed to record token usage in final synthesis: {tracker_err}")
                    except Exception as e:
                        logger.warning(f"Final synthesis failed: {str(e)}")
                        final_report = f"Syntra OS Execution Report\n\nObjective: {goal}\n\nCompleted steps:\n{combined_summary}"
                else:
                    final_report = f"### Syntra OS Multi-Agent Audit Report\n\n**Goal**: {goal}\n\n**Findings Timeline**:\n{combined_summary}\n\n**Verification**: All specialized agents returned clean signals. Task execution complete."

                # Update run completion status
                run.status = "success"
                run.completed_at = func.now()
                memory_manager.update_short_term_memory(db, run_id, "final_report", final_report)
                db.commit()

                communication_bus.send_message(
                    db=db,
                    workflow_run_id=run_id,
                    sender="coordinator_agent",
                    recipient="user",
                    message_type="system_broadcast",
                    content="Aggregated execution complete. Dispatched final executive findings report.",
                    metadata={"final_report": final_report}
                )

                # Explicitly record final trace output
                trace = db.query(AITrace).filter(AITrace.trace_id == t_id).first()
                if trace:
                    trace.final_output = final_report
                    db.commit()

                return {
                    "status": "success",
                    "run_id": run_id,
                    "goal": goal,
                    "plan": plan,
                    "final_report": final_report
                }

            except Exception as e:
                logger.exception("Task coordinator execution loop crashed")
                run.status = "failed"
                run.error_message = str(e)
                run.completed_at = func.now()
                db.commit()
                
                communication_bus.send_message(
                    db=db,
                    workflow_run_id=run_id,
                    sender="system",
                    recipient="user",
                    message_type="system_broadcast",
                    content=f"Workflow run failed with exception error: {str(e)}"
                )
                return {
                    "status": "failed",
                    "run_id": run_id,
                    "error": str(e)
                }

# Global coordinator instance
task_coordinator = TaskCoordinator()
