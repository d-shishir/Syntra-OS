import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class SearchRankingEngine:
    def __init__(self):
        pass

    def rerank_and_merge(self, keyword_results: List[Dict[str, Any]], vector_results: List[Dict[str, Any]], graph_results: List[Dict[str, Any]], user_role: str = None, user_department: str = None) -> List[Dict[str, Any]]:
        """
        Deduplicates results across keyword, vector, and graph search systems,
        and applies relevance boosts based on user role and department context.
        """
        merged = {}

        # 1. Merge and aggregate base scores
        for res in keyword_results:
            key = (res["type"], res["id"])
            merged[key] = {
                "id": res["id"],
                "type": res["type"],
                "title": res["title"],
                "description": res["description"],
                "score": res["score"],
                "metadata": res.get("metadata", {}),
                "sources": ["keyword"]
            }

        for res in vector_results:
            key = (res["type"], res["id"])
            if key in merged:
                # Boost score if found in multiple search engines
                merged[key]["score"] = max(merged[key]["score"], res["score"]) + 0.1
                merged[key]["sources"].append("vector")
            else:
                merged[key] = {
                    "id": res["id"],
                    "type": res["type"],
                    "title": res["title"],
                    "description": res["description"],
                    "score": res["score"],
                    "metadata": res.get("metadata", {}),
                    "sources": ["vector"]
                }

        for res in graph_results:
            key = (res["type"], res["id"])
            if key in merged:
                merged[key]["score"] = max(merged[key]["score"], res["score"]) + 0.15
                merged[key]["sources"].append("graph")
            else:
                merged[key] = {
                    "id": res["id"],
                    "type": res["type"],
                    "title": res["title"],
                    "description": res["description"],
                    "score": res["score"],
                    "metadata": res.get("metadata", {}),
                    "sources": ["graph"]
                }

        # Convert to list
        ranked_list = list(merged.values())

        # 2. Apply Role-Aware Relevance Boosts
        role_lower = str(user_role).lower() if user_role else ""
        dept_lower = str(user_department).lower() if user_department else ""

        for item in ranked_list:
            boost = 0.0
            
            # Finance boost
            if "finance" in role_lower or "finance" in dept_lower:
                if item["type"] in ["invoice", "payroll"]:
                    boost += 0.15
                    
            # Sales/CRM boost
            elif "sales" in role_lower or "sales" in dept_lower or "crm" in role_lower:
                if item["type"] in ["lead", "crm_lead", "company"]:
                    boost += 0.15
                    
            # Compliance/Admin boost
            elif "compliance" in role_lower or "admin" in role_lower or "compliance" in dept_lower:
                if item["type"] in ["approval", "document"]:
                    boost += 0.1
            
            # Apply boost
            item["score"] = round(item["score"] + boost, 3)

        # 3. Sort by score in descending order
        ranked_list.sort(key=lambda x: x["score"], reverse=True)
        return ranked_list
