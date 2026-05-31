import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from backend.app.models import Document
from backend.app.services.vector_store import search_similar_chunks
from backend.app.services.embeddings import get_embedding
from modules.invoice_automation.models import Invoice
from modules.workflow_engine.models import WorkflowRun
from modules.human_review_system.models import ApprovalRequest
from modules.crm_intelligence.models import Lead
from modules.knowledge_graph.models import GraphNode
from modules.knowledge_graph.graph_query_engine import GraphQueryEngine
from modules.observability.models import AITrace
from modules.notification_hub.models import Notification

logger = logging.getLogger(__name__)

class HybridSearchExecutor:
    def __init__(self):
        self.graph_engine = GraphQueryEngine()

    def search_keywords(self, db: Session, term: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Runs text keyword scans over multiple databases tables.
        """
        results = []
        if not term:
            return results

        filter_type = filters.get("type") if filters else None
        term_ilike = f"%{term}%"

        # 1. Documents
        if not filter_type or filter_type == "document":
            try:
                docs = db.query(Document).filter(
                    or_(Document.filename.ilike(term_ilike), Document.content.ilike(term_ilike))
                ).limit(5).all()
                for doc in docs:
                    results.append({
                        "id": str(doc.id),
                        "type": "document",
                        "title": doc.filename,
                        "description": doc.content[:150] + "...",
                        "score": 0.7,
                        "metadata": {"mime_type": doc.mime_type}
                    })
            except Exception as e:
                logger.warning(f"Keyword Document scan skipped: {str(e)}")

        # 2. Invoices
        if not filter_type or filter_type == "invoice":
            try:
                invoices = db.query(Invoice).filter(
                    or_(
                        Invoice.invoice_number.ilike(term_ilike),
                        Invoice.vendor.ilike(term_ilike),
                        Invoice.status.ilike(term_ilike)
                    )
                ).limit(5).all()
                for inv in invoices:
                    results.append({
                        "id": str(inv.id),
                        "type": "invoice",
                        "title": f"Invoice {inv.invoice_number}",
                        "description": f"Vendor: {inv.vendor} | Amount: ${inv.amount} | Status: {inv.status}",
                        "score": 0.8,
                        "metadata": {"amount": inv.amount, "status": inv.status}
                    })
            except Exception as e:
                logger.warning(f"Keyword Invoice scan skipped: {str(e)}")

        # 3. Workflows
        if not filter_type or filter_type == "workflow":
            try:
                runs = db.query(WorkflowRun).filter(
                    or_(WorkflowRun.workflow_id.ilike(term_ilike), WorkflowRun.status.ilike(term_ilike))
                ).limit(5).all()
                for run in runs:
                    results.append({
                        "id": str(run.id),
                        "type": "workflow",
                        "title": f"Workflow run: {run.workflow_id}",
                        "description": f"Status: {run.status} | Steps: {run.steps_completed}/{run.total_steps}",
                        "score": 0.75,
                        "metadata": {"status": run.status}
                    })
            except Exception as e:
                logger.warning(f"Keyword Workflow scan skipped: {str(e)}")

        # 4. Approvals
        if not filter_type or filter_type == "approval":
            try:
                approvals = db.query(ApprovalRequest).filter(
                    or_(
                        ApprovalRequest.module.ilike(term_ilike),
                        ApprovalRequest.status.ilike(term_ilike),
                        ApprovalRequest.risk_level.ilike(term_ilike)
                    )
                ).limit(5).all()
                for app in approvals:
                    results.append({
                        "id": str(app.id),
                        "type": "approval",
                        "title": f"Approval request: {app.module}",
                        "description": f"Status: {app.status} | Risk Level: {app.risk_level} | Comments: {app.comments}",
                        "score": 0.75,
                        "metadata": {"status": app.status, "risk": app.risk_level}
                    })
            except Exception as e:
                logger.warning(f"Keyword Approval scan skipped: {str(e)}")

        # 5. CRM Leads
        if not filter_type or filter_type == "lead":
            try:
                leads = db.query(Lead).filter(
                    or_(
                        Lead.name.ilike(term_ilike),
                        Lead.company.ilike(term_ilike),
                        Lead.status.ilike(term_ilike),
                        Lead.country.ilike(term_ilike)
                    )
                ).limit(5).all()
                for lead in leads:
                    results.append({
                        "id": str(lead.id),
                        "type": "lead",
                        "title": f"CRM Lead: {lead.name}",
                        "description": f"Company: {lead.company} | Country: {lead.country} | Status: {lead.status} | Score: {lead.lead_score}",
                        "score": 0.85,
                        "metadata": {"company": lead.company, "country": lead.country, "score": lead.lead_score}
                    })
            except Exception as e:
                logger.warning(f"Keyword CRM Lead scan skipped: {str(e)}")

        return results

    def search_vectors(self, db: Session, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Executes semantic vector searches over text chunks.
        """
        results = []
        try:
            query_vector = get_embedding(query)
            chunks = search_similar_chunks(db, query_vector, limit=limit)
            for chunk in chunks:
                results.append({
                    "id": chunk["document_id"],
                    "type": "document",
                    "title": chunk["filename"],
                    "description": chunk["content"],
                    "score": chunk.get("similarity", 0.65),
                    "metadata": {"chunk_index": chunk.get("chunk_index")}
                })
        except Exception as e:
            logger.warning(f"Semantic Vector search skipped: {str(e)}")
        return results

    def search_graph(self, db: Session, query: str) -> List[Dict[str, Any]]:
        """
        Fetches related nodes and adjacent entities from the Knowledge Graph.
        """
        results = []
        try:
            # Match entities
            nodes_data = self.graph_engine.query_graph_by_keyword(db, query)
            for node in nodes_data.get("nodes", []):
                results.append({
                    "id": node["id"],
                    "type": "graph_entity",
                    "title": node["name"],
                    "description": f"Knowledge entity of type '{node['entity_type']}'",
                    "score": 0.9, # High score due to exact semantic graph match
                    "metadata": {"entity_type": node["entity_type"], "properties": node["properties"]}
                })
        except Exception as e:
            logger.warning(f"Knowledge Graph search skipped: {str(e)}")
        return results
