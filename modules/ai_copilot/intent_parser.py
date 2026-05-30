import json
import re
import logging
from backend.app.config import settings

logger = logging.getLogger(__name__)

def parse_intent(query: str) -> dict:
    """
    Parses user queries into structured intents and entity parameters.
    """
    query_lower = query.lower().strip()

    # 1. Try to use LLM if configured
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE
            )
            
            system_prompt = (
                "You are the Syntra OS Copilot Command Parser. Convert the user's natural language command "
                "into a structured JSON payload containing: \n"
                "1. 'intent': 'workflow_query' | 'workflow_trigger' | 'crm_query' | 'finance_query' | 'anomaly_check' | 'approval_action' | 'rag_query' | 'agent_delegate' | 'query_graph' | 'graph_impact_analysis'\n"
                "2. 'entities': dictionary of parameters extracted from the text (e.g. 'status', 'workflow_id', 'query', 'action', 'question', 'comments', 'task')\n\n"
                "Return ONLY raw JSON. No markdown backticks."
            )
            
            res = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                temperature=0.0
            )
            
            content = res.choices[0].message.content.strip()
            # Strip backticks if LLM returns them
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            
            return json.loads(content.strip())
        except Exception as e:
            logger.warning(f"LLM Intent Parser failed, falling back to heuristics: {str(e)}")

    # 2. Heuristic Heuristic Fallback Engine
    entities = {}
    
    # Graph & Impact Analysis queries
    if "impact" in query_lower:
        return {"intent": "graph_impact_analysis", "entities": {"query": query}}
    elif "related to" in query_lower or "linked to" in query_lower or "show everything" in query_lower or "graph" in query_lower:
        return {"intent": "query_graph", "entities": {"query": query}}

    # Workflow triggers
    if "run compliance" in query_lower or "compliance check" in query_lower:
        return {"intent": "workflow_trigger", "entities": {"workflow_id": "doc_verification_pipeline"}}
    elif "run payroll validation" in query_lower or "validate payroll" in query_lower:
        return {"intent": "workflow_trigger", "entities": {"workflow_id": "payroll_calculation_sync"}}
    
    # Workflow queries
    elif "failed workflows" in query_lower or "failed workflow" in query_lower:
        return {"intent": "workflow_query", "entities": {"status": "failed"}}
    elif "running workflows" in query_lower or "active workflows" in query_lower:
        return {"intent": "workflow_query", "entities": {"status": "running"}}
    
    # Approval actions
    elif "approve" in query_lower:
        # Extract approval request UUID if present
        uuids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', query_lower)
        req_id = uuids[0] if uuids else "all_low_risk"
        return {"intent": "approval_action", "entities": {"action": "approve", "request_id": req_id}}
    elif "reject" in query_lower:
        uuids = re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', query_lower)
        req_id = uuids[0] if uuids else None
        return {"intent": "approval_action", "entities": {"action": "reject", "request_id": req_id}}

    # Finance queries
    elif "pending invoices" in query_lower or "process pending invoices" in query_lower:
        return {"intent": "finance_query", "entities": {"type": "invoice", "status": "pending"}}
    elif "payroll anomalies" in query_lower or "summarize payroll" in query_lower:
        return {"intent": "finance_query", "entities": {"type": "payroll", "status": "anomaly"}}

    # CRM queries
    elif "crm outreach" in query_lower or "create outreach" in query_lower or "leads" in query_lower:
        return {"intent": "crm_query", "entities": {"action": "outreach", "query": "top"}}

    # Anomaly checks
    elif "observability" in query_lower or "errors" in query_lower or "failed jobs" in query_lower:
        return {"intent": "anomaly_check", "entities": {"status": "failed"}}

    # Agent delegations
    elif "analyze financial risk" in query_lower or "financial risk" in query_lower or "risk across invoices" in query_lower:
        return {"intent": "agent_delegate", "entities": {"task": "analyze_financial_risk"}}

    # Default to RAG query
    return {"intent": "rag_query", "entities": {"question": query}}
