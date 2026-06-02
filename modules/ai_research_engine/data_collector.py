import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from modules.enterprise_search.search_engine import EnterpriseSearchEngine
from modules.knowledge_graph.graph_query_engine import GraphQueryEngine

logger = logging.getLogger(__name__)

class UnifiedDataCollector:
    def __init__(self):
        self.search_engine = EnterpriseSearchEngine()
        self.graph_engine = GraphQueryEngine()

    def collect_evidence(self, db: Session, search_term: str, filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Queries RAG, Enterprise Search, and Knowledge Graphs, fusing results into a raw context list.
        """
        evidence = []
        
        # 1. Fetch from Enterprise Search (using Admin privileges to compile comprehensive research details)
        try:
            search_res = self.search_engine.search(db, search_term, user_role="admin", limit=5)
            for res in search_res.get("results", []):
                evidence.append({
                    "source": "enterprise_search",
                    "type": res["type"],
                    "title": res["title"],
                    "description": res["description"],
                    "metadata": res.get("metadata", {})
                })
        except Exception as e:
            logger.warning(f"Research Data Collection: Enterprise Search failed: {str(e)}")

        # 2. Fetch from Knowledge Graph
        try:
            graph_res = self.graph_engine.query_graph_by_keyword(db, search_term)
            for node in graph_res.get("nodes", []):
                evidence.append({
                    "source": "knowledge_graph",
                    "type": "graph_node",
                    "title": node["name"],
                    "description": f"Entity type '{node['entity_type']}' linked in organizational structure.",
                    "metadata": node.get("properties", {})
                })
        except Exception as e:
            logger.warning(f"Research Data Collection: Graph traversal failed: {str(e)}")

        return evidence
