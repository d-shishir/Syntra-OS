import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

class ReportGenerator:
    def __init__(self):
        pass

    def generate(self, goal: str, insights: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Builds a structured report dictionary containing executive summaries, risk metrics,
        and markdown blocks.
        """
        # Formulate executive summary
        summary = (
            f"This autonomous research report investigates '{goal}'. "
            f"The system aggregated {len(evidence)} data points across RAG documentation, "
            f"knowledge graph links, and invoice transaction logs to map out trends and trace root causes."
        )
        
        # Format key findings list
        findings = []
        for idx, pattern in enumerate(insights.get("patterns", [])):
            findings.append(f"Finding {idx+1}: {pattern}")
        for idx, anomaly in enumerate(insights.get("anomalies", [])):
            findings.append(f"Anomaly {idx+1}: {anomaly}")

        # Format risks
        risks = insights.get("risks", ["No major operational risks identified."])

        # Format recommendations
        recommendations = insights.get("opportunities", ["No changes suggested for current operational workflows."])

        # Supporting links/citations
        sources = []
        for e in evidence[:5]:
            sources.append({
                "type": e["type"],
                "title": e["title"],
                "description": e["description"][:100] + "..."
            })

        # Assemble markdown text representation
        markdown_body = f"""# Autonomous Research Report: {goal}

## Executive Summary
{summary}

## Key Findings
"""
        for f in findings:
            markdown_body += f"- {f}\n"

        markdown_body += "\n## Risk Analysis\n"
        for r in risks:
            markdown_body += f"- {r}\n"

        markdown_body += "\n## Recommendations\n"
        for rec in recommendations:
            markdown_body += f"- {rec}\n"

        markdown_body += "\n## Supporting Evidence Sources\n"
        for idx, src in enumerate(sources):
            markdown_body += f"{idx+1}. **{src['title']}** ({src['type']})\n"

        return {
            "title": f"Research Report: {goal}",
            "executive_summary": summary,
            "findings": findings,
            "risks": risks,
            "recommendations": recommendations,
            "sources": sources,
            "markdown": markdown_body
        }
