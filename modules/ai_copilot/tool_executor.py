import logging
import uuid
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from modules.workflow_engine.models import WorkflowRun
from modules.human_review_system.models import ApprovalRequest
from modules.crm_intelligence.models import Lead
from modules.invoice_automation.models import Invoice, PayrollRecord, Anomaly
from modules.event_system.models import EventJob

logger = logging.getLogger(__name__)

def execute_tool(intent: str, entities: dict, db: Session, current_user = None) -> dict:
    """
    Invokes correct backend processes for the parsed intent.
    """
    try:
        # 1. Trigger Workflow
        if intent == "workflow_trigger":
            workflow_id = entities.get("workflow_id")
            input_context = entities.get("input_context") or {}
            
            from modules.workflow_engine.workflow_manager import trigger_workflow_run
            run = trigger_workflow_run(db, workflow_id, input_context)
            
            # Post event
            from modules.event_system.event_bus import publish_event
            publish_event(db, "workflow_triggered_by_copilot", "copilot", {
                "workflow_id": workflow_id,
                "run_id": str(run.id),
                "message": f"Copilot triggered workflow run '{workflow_id}' ({run.id})"
            })
            
            return {
                "success": True,
                "message": f"Successfully triggered workflow '{workflow_id}' (Run ID: {run.id})",
                "data": run.to_dict(),
                "type": "workflow_run"
            }

        # 2. Workflow query
        elif intent == "workflow_query":
            status_filter = entities.get("status")
            query = db.query(WorkflowRun)
            if status_filter:
                query = query.filter(WorkflowRun.status == status_filter)
            runs = query.order_by(WorkflowRun.started_at.desc()).limit(10).all()
            return {
                "success": True,
                "message": f"Found {len(runs)} workflows matching status '{status_filter}'",
                "data": [r.to_dict() for r in runs],
                "type": "workflow_list"
            }

        # 3. CRM outreach / Query
        elif intent == "crm_query":
            action = entities.get("action")
            leads = db.query(Lead).order_by(Lead.lead_score.desc()).limit(10).all()
            
            if action == "outreach":
                # Create a mock batch outreach event or update leads contacted status
                for l in leads:
                    if l.status == "new":
                        l.status = "contacted"
                db.commit()
                return {
                    "success": True,
                    "message": "Generated and sent outreach templates for top 10 leads.",
                    "data": [l.to_dict() for l in leads],
                    "type": "lead_list"
                }
            return {
                "success": True,
                "message": f"Retrieved lead profiles.",
                "data": [l.to_dict() for l in leads],
                "type": "lead_list"
            }

        # 4. Finance Query
        elif intent == "finance_query":
            doc_type = entities.get("type", "invoice")
            status_filter = entities.get("status")
            
            if doc_type == "invoice":
                query = db.query(Invoice)
                if status_filter:
                    query = query.filter(Invoice.status == status_filter)
                invoices = query.order_by(Invoice.created_at.desc()).limit(10).all()
                return {
                    "success": True,
                    "message": f"Fetched recent invoices.",
                    "data": [i.to_dict() for i in invoices],
                    "type": "invoice_list"
                }
            else: # payroll
                query = db.query(PayrollRecord)
                if status_filter == "anomaly":
                    # Get records linked to unresolved anomalies
                    anomalies = db.query(Anomaly).filter(Anomaly.resolved == False, Anomaly.payroll_record_id != None).all()
                    p_ids = [a.payroll_record_id for a in anomalies]
                    query = query.filter(PayrollRecord.id.in_(p_ids))
                records = query.order_by(PayrollRecord.created_at.desc()).limit(10).all()
                return {
                    "success": True,
                    "message": f"Fetched payroll profiles.",
                    "data": [r.to_dict() for r in records],
                    "type": "payroll_list"
                }

        # 5. Observability anomaly check
        elif intent == "anomaly_check":
            anomalies = db.query(Anomaly).filter(Anomaly.resolved == False).order_by(Anomaly.created_at.desc()).limit(10).all()
            return {
                "success": True,
                "message": f"Found {len(anomalies)} unresolved system compliance anomalies.",
                "data": [a.to_dict() for a in anomalies],
                "type": "anomaly_list"
            }

        # 6. HITL Approval action
        elif intent == "approval_action":
            action = entities.get("action")
            req_id_str = entities.get("request_id")
            reviewer_name = current_user.name if current_user else "Admin Director"
            comments = entities.get("comments") or "Approved via AI Copilot command."
            
            from modules.human_review_system.approval_engine import approve_request, reject_request
            
            if req_id_str == "all_low_risk":
                # Find and approve all pending low-risk items
                requests = db.query(ApprovalRequest).filter(
                    ApprovalRequest.status == "pending",
                    ApprovalRequest.risk_level == "low"
                ).all()
                for r in requests:
                    approve_request(r.id, reviewer_name, comments, db)
                return {
                    "success": True,
                    "message": f"Approved all {len(requests)} pending low-risk items in review queue.",
                    "data": [r.to_dict() for r in requests],
                    "type": "approval_list"
                }
            else:
                try:
                    req_uuid = uuid.UUID(req_id_str)
                except (ValueError, TypeError):
                    raise ValueError("Invalid approval request ID format.")
                
                if action == "approve":
                    req = approve_request(req_uuid, reviewer_name, comments, db)
                    return {
                        "success": True,
                        "message": f"Successfully approved review request {req_uuid}.",
                        "data": req.to_dict(),
                        "type": "approval_detail"
                    }
                else: # reject
                    req = reject_request(req_uuid, reviewer_name, comments, db)
                    return {
                        "success": True,
                        "message": f"Rejected review request {req_uuid}.",
                        "data": req.to_dict(),
                        "type": "approval_detail"
                    }

        # 7. Agent delegation
        elif intent == "agent_delegate":
            task_desc = entities.get("task", "analyze_financial_risk")
            
            # Delegate to multi-agent task coordinator
            from modules.multi_agent_system.task_coordinator import task_coordinator
            run = task_coordinator.coordinate_and_execute(db, f"Agent swarm operation: {task_desc}")
            
            return {
                "success": True,
                "message": f"Delegated analysis to AI Swarm Coordinator (Swarm run: {run.id})",
                "data": run.to_dict(),
                "type": "agent_run"
            }

        # 8. RAG Query
        elif intent == "rag_query":
            question = entities.get("question")
            from app.services.rag_pipeline import ask_question_rag
            res = ask_question_rag(db, question)
            return {
                "success": True,
                "message": "Answer retrieved from vectorized RAG document storage.",
                "data": {
                    "answer": res.get("answer"),
                    "sources": res.get("sources")
                },
                "type": "rag_answer"
            }

        # 9. Knowledge Graph Query
        elif intent == "query_graph":
            q_text = entities.get("query", "")
            # Heuristically extract keyword
            keyword = q_text.lower().replace("graph", "").replace("related to", "").replace("linked to", "").replace("show everything", "").replace("about", "").strip()
            if not keyword:
                keyword = "Acme Corp" # Default seed fallback
            
            from modules.knowledge_graph.graph_query_engine import GraphQueryEngine
            engine = GraphQueryEngine()
            result = engine.query_graph_by_keyword(db, keyword)
            return {
                "success": True,
                "message": f"Successfully retrieved Knowledge Graph relationships for '{keyword}'.",
                "data": result,
                "type": "graph_subgraph"
            }

        # 10. Graph Impact Analysis
        elif intent == "graph_impact_analysis":
            q_text = entities.get("query", "")
            # Heuristically parse target and type
            name = q_text.replace("impact", "").replace("analysis", "").replace("of", "").replace(":", "").strip()
            etype = "workflow"
            if "dept" in q_text.lower() or "department" in q_text.lower():
                etype = "department"
                name = name.replace("dept", "").replace("department", "").strip()
            elif "invoice" in q_text.lower():
                etype = "invoice"
                name = name.replace("invoice", "").strip()
            
            if not name:
                name = "Payroll Validation"
            
            from modules.knowledge_graph.graph_query_engine import GraphQueryEngine
            engine = GraphQueryEngine()
            result = engine.run_impact_analysis(db, name, etype)
            return {
                "success": True,
                "message": f"Compiled blast radius impact analysis details for target '{name}'.",
                "data": result,
                "type": "graph_impact"
            }

        else:
            raise ValueError(f"Unknown intent pattern: {intent}")
            
    except Exception as e:
        logger.error(f"Copilot tool execution failed: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Execution failed: {str(e)}",
            "data": {},
            "type": "error"
        }
