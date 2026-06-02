import logging
from sqlalchemy.orm import Session

from modules.ai_copilot.intent_parser import parse_intent
from modules.ai_copilot.safety_guardrails import enforce_safety_guardrails, SecurityViolationException
from modules.ai_copilot.tool_executor import execute_tool
from modules.ai_copilot.context_builder import build_system_context
from modules.ai_copilot.response_generator import generate_copilot_response

logger = logging.getLogger(__name__)

def handle_copilot_query(query: str, db: Session, current_user = None) -> dict:
    """
    Executes a natural language copilot query by coordinating intent parsing,
    safety checks, tool execution, and response compilation.
    """
    # 1. Parse intent
    parsed = parse_intent(query, db)
    intent = parsed.get("intent", "rag_query")
    entities = parsed.get("entities", {})

    # 2. Check safety / RBAC rules
    try:
        enforce_safety_guardrails(intent, entities, current_user)
    except SecurityViolationException as err:
        logger.warning(f"Copilot Security Violation: {err.message}")
        return {
            "text": f"⚠️ **Security Restriction:** {err.message}",
            "type": "security_restriction",
            "data": {"intent": intent, "entities": entities},
            "success": False
        }

    # 3. Assemble system context
    context = build_system_context(db, current_user)

    # 4. Execute tool
    execution_result = execute_tool(intent, entities, db, current_user)

    # 5. Compile response statement
    compiled_res = generate_copilot_response(intent, execution_result, context, db)
    return compiled_res
