import logging
from sqlalchemy.orm import Session
from app.config import settings

from modules.dashboard_aggregator.metrics_aggregator import get_dashboard_metrics, calculate_health_score

logger = logging.getLogger(__name__)

def generate_ai_summary(db: Session) -> str:
    """
    Assembles operations context and prompts the AI model to generate a dense,
    professional summary of system performance, anomalies, and active tasks.
    """
    metrics = get_dashboard_metrics(db)
    health = calculate_health_score(db)
    
    context = (
        f"Active Workflows: {metrics['active_workflows']}\n"
        f"Running AI Agents: {metrics['running_agents']}\n"
        f"Pending Human Reviews: {metrics['pending_approvals']}\n"
        f"Failed Job Queue Tasks: {metrics['failed_jobs']}\n"
        f"CRM Ingested Leads: {metrics['crm_leads']}\n"
        f"Finance Anomalies Logged: {metrics['finance_alerts']}\n"
        f"Overall System Health Score: {health['health_score']}/100 ({health['status']})\n"
        f"Average Latency: {health['metrics']['avg_api_latency_ms']}ms\n"
        f"Workflow Success Rate: {health['metrics']['workflow_success_rate']}%\n"
        f"Agent Success Rate: {health['metrics']['agent_success_rate']}%\n"
    )

    prompt = (
        "You are the Syntra OS Director AI. Write a dense, professional, single-paragraph executive summary "
        "describing the operational status of the monorepo platform based on the following telemetry statistics. "
        "Highlight if any approvals or anomalies need attention. Keep the tone concise and enterprise-grade.\n\n"
        f"Metrics Context:\n{context}"
    )

    # Trigger LLM call if configured
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE
            )
            res = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=250,
                temperature=0.3
            )
            summary = res.choices[0].message.content.strip()
            return summary
        except Exception as e:
            logger.warning(f"AI summary failed, returning fallback template: {str(e)}")
            
    # Fallback template
    return (
        f"Syntra OS is operating in a {health['status'].upper()} state (Health Score: {health['health_score']}/100). "
        f"Currently, there are {metrics['active_workflows']} active workflows running and {metrics['running_agents']} active AI agents coordinating tasks. "
        f"A total of {metrics['pending_approvals']} pending approval request(s) require manual reviewer signature, and "
        f"{metrics['finance_alerts']} active payroll/invoice compliance anomalies have been flagged. "
        f"Workflow completion rate is averaging {health['metrics']['workflow_success_rate']}% with an API latency of {health['metrics']['avg_api_latency_ms']}ms."
    )
