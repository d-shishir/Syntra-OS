from sqlalchemy.orm import Session
from sqlalchemy import or_
from modules.knowledge_graph.models import GraphNode
from modules.crm_intelligence.models import Lead

class AutocompleteEngine:
    def __init__(self):
        self.preset_terms = [
            "payroll anomalies",
            "payroll approvals",
            "payroll reports",
            "compliance checks",
            "invoice processing",
            "unresolved anomalies",
            "sales outreach leads",
            "observability audit log"
        ]

    def get_suggestions(self, db: Session, prefix: str) -> list[str]:
        """
        Calculates suggestions based on matching entity names and preset topics.
        """
        if not prefix or not prefix.strip():
            return []

        prefix_clean = prefix.lower().strip()
        suggestions = set()

        # 1. Match presets
        for term in self.preset_terms:
            if term.startswith(prefix_clean):
                suggestions.add(term)

        # 2. Match graph entity names
        try:
            nodes = db.query(GraphNode).filter(GraphNode.name.ilike(f"{prefix_clean}%")).limit(5).all()
            for n in nodes:
                suggestions.add(n.name)
        except Exception:
            pass

        # 3. Match CRM lead companies
        try:
            leads = db.query(Lead).filter(Lead.company.ilike(f"{prefix_clean}%")).limit(5).all()
            for l in leads:
                suggestions.add(l.company)
        except Exception:
            pass

        # Sort and return top 5
        return sorted(list(suggestions))[:5]
