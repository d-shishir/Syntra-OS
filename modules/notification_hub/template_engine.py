import logging
from openai import OpenAI
from app.config import settings

logger = logging.getLogger(__name__)

def generate_ai_summary(event_type: str, payload: dict) -> str:
    """
    Invokes the AI model to turn raw operational payloads into concise, 
    human-readable business summaries. Falls back to string formatting if offline.
    """
    if not settings.OPENAI_API_KEY:
        return get_fallback_summary(event_type, payload)

    try:
        client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE
        )
        system_prompt = (
            "You are a helpful operational assistant for Syntra OS. "
            "Convert the following raw JSON payload of an event into a single, concise, "
            "professional, and beginner-friendly sentence. "
            "Do NOT include any extra conversational text or JSON syntax. Just the summary."
        )
        user_message = f"Event Category: {event_type}\nPayload: {str(payload)}"
        
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=80
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"AI Template Engine: failed to generate summary, using fallback. Error: {str(e)}")
        return get_fallback_summary(event_type, payload)

def get_fallback_summary(event_type: str, payload: dict) -> str:
    """
    Generates rule-based notification messages when AI API is unavailable.
    """
    if event_type == "invoice_uploaded":
        return f"New invoice document '{payload.get('filename', 'Unknown')}' was uploaded for processing."
    elif event_type == "payroll_processed":
        return f"Payroll sheets processed for amount ${payload.get('total_amount', '0.00') or '0.00'}."
    elif event_type == "lead_created":
        return f"CRM alert: Lead '{payload.get('contact_name', 'New Lead')}' was successfully registered."
    elif event_type == "anomaly_detected":
        return f"Warning: Financial anomaly check flagged risk score of {payload.get('risk_score', 0)}: {', '.join(payload.get('anomalies', []))}."
    elif event_type == "workflow_failed":
        return f"Workflow execution crash reported for run {payload.get('run_id', 'Unknown')}: {payload.get('error', 'Unknown Error')}"
    elif event_type == "approval_required":
        return f"Human Approval required: {payload.get('reason', 'Verification action needed')}"
    elif event_type == "research_completed":
        return "Swarm update: Research agent finished retrieval and query groundings."
    else:
        return f"System Alert: '{event_type}' event captured with payload values: {str(payload)}."
