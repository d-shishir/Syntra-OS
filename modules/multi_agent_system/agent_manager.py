import logging
import json
from sqlalchemy.orm import Session
from app.config import settings
from openai import OpenAI
from modules.multi_agent_system.agent_registry import agent_registry
from modules.multi_agent_system.communication_bus import communication_bus
from modules.multi_agent_system.memory_manager import memory_manager
from modules.workflow_engine.tool_registry import tool_registry

logger = logging.getLogger(__name__)

class AgentManager:
    def run_agent(
        self,
        agent_key: str,
        task_description: str,
        context: dict,
        db: Session,
        workflow_run_id: str
    ) -> dict:
        """
        Executes a task using a specified agent. Matches capabilities, retrieves
        grounded RAG context if needed, runs the appropriate tool, and returns findings.
        """
        agent = agent_registry.get_agent(agent_key)
        if not agent:
            raise ValueError(f"Agent '{agent_key}' not found in registry.")

        communication_bus.send_message(
            db=db,
            workflow_run_id=workflow_run_id,
            sender="coordinator_agent",
            recipient=agent_key,
            message_type="task_assignment",
            content=f"Execute: {task_description}",
            metadata={"context": context}
        )

        logger.info(f"[AGENT] Running '{agent_key}' for task: '{task_description}'")

        # Select tool matching capability
        import time
        from modules.observability import trace_manager
        
        t_id = trace_manager.get_current_trace_id()
        tool_start = time.perf_counter()
        tool_status = "success"
        result = None
        tool_executed = None
        
        try:
            # 1. RAG Research Tool matching
            if agent_key == "research_agent" or "rag_search" in agent.get("capabilities", []):
                query = context.get("query") or task_description
                limit = context.get("limit", 3)
                communication_bus.send_message(
                    db=db,
                    workflow_run_id=workflow_run_id,
                    sender=agent_key,
                    recipient="system_bus",
                    message_type="system_broadcast",
                    content=f"Research agent querying Vector DB for context: '{query}'"
                )
                result = tool_registry.execute_tool("search_vector_db", db, context, query=query, limit=limit)
                tool_executed = "search_vector_db"

            # 2. Finance Tool matching
            elif agent_key == "finance_agent":
                doc_id = context.get("document_id")
                if doc_id:
                    if "anomaly_review" in task_description.lower() or "anomaly" in task_description.lower():
                        communication_bus.send_message(
                            db=db,
                            workflow_run_id=workflow_run_id,
                            sender=agent_key,
                            recipient="system_bus",
                            message_type="system_broadcast",
                            content=f"Finance agent auditing document {doc_id} for discrepancies."
                        )
                        result = tool_registry.execute_tool("detect_anomalies", db, context, document_id=doc_id)
                        tool_executed = "detect_anomalies"
                    else:
                        communication_bus.send_message(
                            db=db,
                            workflow_run_id=workflow_run_id,
                            sender=agent_key,
                            recipient="system_bus",
                            message_type="system_broadcast",
                            content=f"Finance agent running structural extraction on doc {doc_id}."
                        )
                        result = tool_registry.execute_tool("extract_document", db, context, document_id=doc_id)
                        tool_executed = "extract_document"
                else:
                    # If no doc_id, perform generic financial calculation simulation
                    result = {
                        "status": "success",
                        "analysis": "No document provided. Running aggregate financial simulation.",
                        "stats": {"total_invoices": 12, "active_warnings": 2}
                    }

            # 3. CRM Tool matching
            elif agent_key == "crm_agent":
                lead_id = context.get("lead_id")
                # If lead context is provided, enrich or score lead
                if lead_id:
                    communication_bus.send_message(
                        db=db,
                        workflow_run_id=workflow_run_id,
                        sender=agent_key,
                        recipient="system_bus",
                        message_type="system_broadcast",
                        content=f"CRM Agent enriching lead fit metrics for prospect ID: {lead_id}"
                    )
                    
                    # Retrieve lead
                    from modules.crm_intelligence.models import Lead
                    lead = db.query(Lead).filter(Lead.id == lead_id).first()
                    
                    if lead:
                        # Mock lead fit score calculation & outreach template compilation
                        outreach = {
                            "email": f"Subject: Evolving Syntra OS at {lead.company}\n\nHi {lead.name},\n\nI noticed you manage operations. Let's automate your pipelines.",
                            "linkedin": f"Hi {lead.name}, let's connect on enterprise AI consolidation."
                        }
                        lead.outreach_templates = outreach
                        lead.lead_score = 85
                        lead.scoring_reasoning = "Enriched by Multi-Agent CRM pipeline."
                        db.commit()
                        result = {
                            "status": "success",
                            "lead_score": 85,
                            "outreach_templates": outreach
                        }
                        tool_executed = "generate_outreach"
                    else:
                        result = {"status": "failed", "error": f"Lead {lead_id} not found."}
                else:
                    # Default text/outreach template generator
                    result = {
                        "status": "success",
                        "outreach_templates": {
                            "email": "Subject: Automate payables with Syntra OS\n\nHi Team,\n\nLet's integrate our invoicing pipelines today."
                        }
                    }

            # 4. Workflow Agent matching
            elif agent_key == "workflow_agent":
                # Run named workflow if specified
                workflow_id = context.get("workflow_id")
                if workflow_id:
                    communication_bus.send_message(
                        db=db,
                        workflow_run_id=workflow_run_id,
                        sender=agent_key,
                        recipient="system_bus",
                        message_type="system_broadcast",
                        content=f"Workflow Agent executing run pipeline: {workflow_id}"
                    )
                    # Simulated execution
                    result = {
                        "status": "success",
                        "workflow_id": workflow_id,
                        "execution_time_ms": 420,
                        "steps_completed": ["extract_document", "detect_anomalies"]
                    }
                    tool_executed = "execute_workflows"
                else:
                    # Fallback notify alert
                    recipient = context.get("recipient", "ops@syntra.os")
                    subject = context.get("subject", "Agent Workflow Alert")
                    body = context.get("body", "Notification sent from automated agent.")
                    result = tool_registry.execute_tool("send_email", db, context, recipient=recipient, subject=subject, body=body)
                    tool_executed = "send_email"

        except Exception as e:
            tool_status = "failed"
            tool_latency = int((time.perf_counter() - tool_start) * 1000)
            if t_id and tool_executed:
                try:
                    trace_manager.add_tool_call(
                        trace_id=t_id,
                        tool_name=tool_executed,
                        input_params=context,
                        output_result={"error": str(e)},
                        latency_ms=tool_latency,
                        status="failed",
                        db=db
                    )
                except Exception:
                    pass
            raise e

        # At the end of successful tool call:
        tool_latency = int((time.perf_counter() - tool_start) * 1000)
        if t_id and tool_executed:
            try:
                trace_manager.add_tool_call(
                    trace_id=t_id,
                    tool_name=tool_executed,
                    input_params=context,
                    output_result=result if isinstance(result, dict) else {"output": str(result)},
                    latency_ms=tool_latency,
                    status=tool_status,
                    db=db
                )
                trace_manager.add_step(
                    trace_id=t_id,
                    step_name=f"agent_tool:{tool_executed}",
                    status=tool_status,
                    latency_ms=tool_latency,
                    metadata={"agent": agent_key},
                    db=db
                )
            except Exception:
                pass

        # 5. Fallback LLM / Mock aggregation
        if not result:
            result = {
                "status": "success",
                "summary": f"Executed capability flow for {agent_key}."
            }

        # Call OpenAI to summarize findings if API Key is configured
        summary = ""
        if settings.OPENAI_API_KEY:
            try:
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                prompt = (
                    f"You are the {agent['name']} ({agent['role']}).\n"
                    f"Task: {task_description}\n"
                    f"Raw Tool Output ({tool_executed}): {json.dumps(result)}\n\n"
                    f"Summarize your findings in a clear, concise bulleted report for the Coordinator Agent."
                )
                response = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": agent["system_prompt"]},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0
                )
                summary = response.choices[0].message.content.strip()
            except Exception as e:
                logger.warning(f"OpenAI agent summary generation failed: {str(e)}")
                summary = f"Agent {agent['name']} completed task. Tool output: {result}"
        else:
            # Fallback mock summary
            if agent_key == "research_agent":
                summary = f"🔍 Research Findings: Grounded context retrieved. Found matching policy guidelines in Vector DB. Reference matches score similarity: {result.get('answer', 'Clean compliance ledger.')}"
            elif agent_key == "finance_agent":
                anom_count = result.get("anomalies_found", 0)
                summary = f"💰 Financial Audit completed. Extracted fields verified. Found {anom_count} compliance anomalies or warning flags."
            elif agent_key == "crm_agent":
                summary = f"🤝 CRM Outreach drafted. Fit score rated at 85/100. Outreach email generated with custom copy templates."
            elif agent_key == "workflow_agent":
                summary = f"⚙️ Automation task executed successfully. Notification email dispatched and background logging completed."
            else:
                summary = f"Agent {agent['name']} successfully processed data: {result}"

        # Write results to shared memory
        memory_manager.update_short_term_memory(db, workflow_run_id, f"{agent_key}_result", result)
        memory_manager.update_short_term_memory(db, workflow_run_id, f"{agent_key}_summary", summary)

        communication_bus.send_message(
            db=db,
            workflow_run_id=workflow_run_id,
            sender=agent_key,
            recipient="coordinator_agent",
            message_type="task_result",
            content=summary,
            metadata={"result": result}
        )

        return {
            "status": "success",
            "agent": agent_key,
            "tool_executed": tool_executed,
            "summary": summary,
            "result": result
        }

# Global agent manager instance
agent_manager = AgentManager()
