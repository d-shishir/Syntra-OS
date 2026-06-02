import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from backend.app.config import settings
from modules.observability.ai_call_tracker import ai_call_tracker

logger = logging.getLogger(__name__)

class InsightSynthesizer:
    def __init__(self):
        pass

    def synthesize(self, goal: str, collected_evidence: List[Dict[str, Any]], db: Session = None) -> Dict[str, Any]:
        """
        Processes multi-source records to extract patterns, anomalies, risks, and options.
        """
        # If OpenAI key exists, run LLM synthesis
        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                import json
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                
                evidence_summary = "\n".join([
                    f"- Source: {e['source']} | Title: {e['title']} | Content: {e['description']}"
                    for e in collected_evidence[:10]
                ])

                system_prompt = (
                    "You are a Senior Corporate Intelligence Analyst. Synthesize the provided corporate evidence "
                    "for the goal. You must output a structured JSON containing: \n"
                    "1. 'patterns': List of general business trends observed.\n"
                    "2. 'anomalies': List of anomalies or metrics out of bounds.\n"
                    "3. 'risks': List of operational risks detected.\n"
                    "4. 'opportunities': List of action optimizations."
                )
                
                res = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Goal: {goal}\n\nEvidence Collected:\n{evidence_summary}"}
                    ],
                    temperature=0.0
                )
                
                content = res.choices[0].message.content.strip()
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                
                # Record token usage
                if db:
                    try:
                        approx_tokens = (len(system_prompt) + len(goal) + len(evidence_summary) + len(content)) // 4
                        ai_call_tracker.record_token_usage(approx_tokens, "research_insight_synthesis", db)
                    except Exception as tracker_err:
                        logger.warning(f"Failed to record token usage in synthesize: {tracker_err}")

                return json.loads(content.strip())
            except Exception as e:
                logger.warning(f"LLM synthesis failed. Falling back: {str(e)}")

        # Fallback Heuristics
        patterns = []
        anomalies = []
        risks = []
        opportunities = []

        # Heuristic rules matching terms in evidence
        has_anomalies = False
        has_failures = False
        
        for item in collected_evidence:
            desc = item["description"].lower()
            title = item["title"].lower()
            
            if "anomaly" in desc or "anomaly" in title:
                anomalies.append(f"Detected compliance anomaly in: '{item['title']}'. Details: {item['description']}")
                has_anomalies = True
            if "failed" in desc or "failed" in title:
                risks.append(f"Workflow execution failure reported on: '{item['title']}'")
                has_failures = True
            if "invoice" in title or "invoice" in desc:
                patterns.append("High volume of financial invoice transactions registered across current quarter.")

        if not patterns:
            patterns.append(f"Retrieved {len(collected_evidence)} historical data checkpoints relating to target research goal.")
        if not anomalies:
            anomalies.append("No critical threshold violations detected in primary audit logs.")
        if has_anomalies or has_failures:
            risks.append("Degraded system health score due to outstanding review approvals or execution bottlenecks.")
            opportunities.append("Configure automated notification escalation rules to resolve outstanding review tasks.")
        else:
            opportunities.append("Optimize dataset tracking by establishing additional causal relation links in the knowledge graph.")

        return {
            "patterns": patterns,
            "anomalies": anomalies,
            "risks": risks,
            "opportunities": opportunities
        }
