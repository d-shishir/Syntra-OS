import json
import logging
from typing import List, Dict, Any
from backend.app.config import settings

logger = logging.getLogger(__name__)

class ResearchPlanner:
    def __init__(self):
        pass

    def generate_plan(self, goal: str) -> List[str]:
        """
        Formulates a list of sub-tasks/questions to research from a primary goal statement.
        """
        goal_lower = goal.lower().strip()
        
        # 1. LLM-based planning
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                system_prompt = (
                    "You are the Syntra OS Research Director. Break the user's primary research goal "
                    "into a structured JSON list of 3-5 sequential, concrete, search/analysis sub-tasks. "
                    "Return ONLY raw JSON list of strings. Example: ['gather payroll logs', 'analyze anomalies']"
                )
                res = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": goal}
                    ],
                    temperature=0.0
                )
                content = res.choices[0].message.content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                return json.loads(content.strip())
            except Exception as e:
                logger.warning(f"LLM planner failed. Falling back to rules: {str(e)}")

        # 2. Heuristic planner fallback
        if "payroll" in goal_lower or "anomaly" in goal_lower:
            return [
                "collect payroll transactions and financial invoices",
                "detect anomalies in payroll transactions",
                "correlate anomalies with recent system workflows",
                "identify root causes of approval bottlenecks"
            ]
        elif "onboarding" in goal_lower or "crm" in goal_lower or "lead" in goal_lower:
            return [
                "gather CRM leads and conversion metrics",
                "filter leads by region and scoring ranges",
                "cross-reference conversion delays with sales outreach records",
                "recommend outreach optimizations"
            ]
        else:
            # General default research steps
            return [
                f"search documents for terms matching {goal}",
                "extract key findings and document citations",
                "map related graph entities and dependencies",
                "compile executive recommendations"
            ]
