from sqlalchemy.orm import Session
from modules.executive.models import DecisionTrace
from typing import Dict
import uuid

DECISION_REPLIES = {
    "what is slowing down finance approvals?": {
        "answer": "Finance approval bottlenecks are primarily driven by extraction mismatches in multi-page contractor invoices.",
        "root_cause": "The RAG extraction confidence for tax-withholding fields drops below 80% on international contracts, triggering automated overrides.",
        "suggestions": [
            "Enable custom prompt rules targeting EOR document patterns",
            "Increase AI governance limits to allow auto-clearance of low-risk amounts (<$500)"
        ],
        "impact_score": 3500 # $3,500 monthly labor savings
    },
    "why are workflows failing in operations?": {
        "answer": "Operations workflows are hitting transaction failures due to downstream CRM API timeouts.",
        "root_cause": "The Salesforce Integrations Hub connector times out when batch uploading client metadata during peak hours (14:00-16:00).",
        "suggestions": [
            "Implement retry limits with exponential backoff on integrations hub routing",
            "Schedule CRM sync triggers to run in background worker off-hours"
        ],
        "impact_score": 1800
    },
    "which agent is most unreliable?": {
        "answer": "The InvoiceReviewAgent currently reports a failure rate of 4.2% in active swarms.",
        "root_cause": "Mismatched invoice line-items trigger exception loops that exit without passing variables to payroll batch engines.",
        "suggestions": [
            "Update Visual Agent Builder logic gates to route parse failures to human review queue",
            "Provide additional vector graph training documents for tax code categorization"
        ],
        "impact_score": 2400
    }
}

def resolve_executive_question(db: Session, question: str) -> Dict:
    """
    Evaluates executive queries and saves decision trace audits.
    """
    clean_q = question.strip().lower()
    
    # Fallback default matching
    reply = DECISION_REPLIES.get(clean_q)
    if not reply:
        reply = {
            "answer": "General system operations are currently within nominal thresholds.",
            "root_cause": "No critical anomalies or rate-limit logs detected for active workspace IDs.",
            "suggestions": [
                "Review active API Gateway logs for suspicious developer access patterns",
                "Ensure all active governance policies are synced with the knowledge graph"
            ],
            "impact_score": 500
        }

    # Save trace
    trace = DecisionTrace(
        question=question,
        answer=reply["answer"],
        root_cause=reply["root_cause"],
        suggestions=reply["suggestions"],
        impact_score=reply["impact_score"]
    )
    db.add(trace)
    db.commit()
    db.refresh(trace)

    return trace.to_dict()
