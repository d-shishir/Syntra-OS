import logging
from sqlalchemy.orm import Session
from app.config import settings
from modules.observability.ai_call_tracker import ai_call_tracker

logger = logging.getLogger(__name__)

def generate_copilot_response(intent: str, execution_result: dict, context: dict, db: Session = None) -> dict:
    """
    Formulates a descriptive, natural language answer based on tool outputs.
    """
    success = execution_result.get("success", False)
    message = execution_result.get("message", "")
    res_type = execution_result.get("type", "unknown")
    res_data = execution_result.get("data", {})
    
    user_name = context["user"]["name"]
    user_role = context["user"]["role"]

    prompt = (
        f"You are the Syntra OS Copilot Assistant. Compiles a response for the user '{user_name}' (Role: '{user_role}') "
        f"describing the results of an operation command. \n\n"
        f"Operation details:\n"
        f"- Action Intent: {intent}\n"
        f"- Success status: {success}\n"
        f"- Output Message: {message}\n"
        f"- Payload Data Type: {res_type}\n"
        f"- Payload Data: {res_data}\n\n"
        "Draft a structured, professional corporate control response. Include: \n"
        "1. Explanation of actions taken or queries resolved.\n"
        "2. Reasoning or diagnostics context.\n"
        "3. Next steps suggestion or warnings if any errors occurred.\n"
        "Use bullet points for lists if necessary."
    )

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
                max_tokens=300,
                temperature=0.3
            )
            text_response = res.choices[0].message.content.strip()
            
            # Record token usage
            if db:
                try:
                    approx_tokens = (len(prompt) + len(text_response)) // 4
                    ai_call_tracker.record_token_usage(approx_tokens, "copilot_response_generator", db)
                except Exception as tracker_err:
                    logger.warning(f"Failed to record token usage in generate_copilot_response: {tracker_err}")

            return {
                "text": text_response,
                "type": res_type,
                "data": res_data,
                "success": success
            }
        except Exception as e:
            logger.warning(f"AI response generator failed: {str(e)}")

    # Heuristic Descriptive Builder
    explanation = f"I have processed your command regarding '{intent.replace('_', ' ')}'."
    reasoning = message
    next_steps = "No further actions required. Let me know if you need to trigger additional automation checks."
    warnings = None

    if not success:
        explanation = "I encountered an error executing your operation."
        reasoning = f"The core execution reported: {message}"
        next_steps = "Verify your account permissions or check if database tables contain valid matching rows."
        warnings = "Check the observability logs for complete traceback details."

    if intent == "workflow_trigger":
        next_steps = "You can monitor the workflow execution run directly under the Control Center live feed."
    elif intent == "rag_query":
        explanation = "I have queried the semantic database library."
        reasoning = res_data.get("answer") if isinstance(res_data, dict) else message
        next_steps = "Sources are cited in the metadata context panel."

    text_response = (
        f"**Actions Taken:** {explanation}\n\n"
        f"**Reasoning & Execution:** {reasoning}\n\n"
        f"**Suggested Next Steps:** {next_steps}"
    )
    if warnings:
        text_response += f"\n\n⚠️ **Warning:** {warnings}"

    return {
        "text": text_response,
        "type": res_type,
        "data": res_data,
        "success": success
    }
