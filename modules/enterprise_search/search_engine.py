import time
import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.config import settings

from modules.enterprise_search.query_parser import QueryParser
from modules.enterprise_search.hybrid_search import HybridSearchExecutor
from modules.enterprise_search.ranking_engine import SearchRankingEngine
from modules.enterprise_search.search_analytics import SearchAnalyticsTracker

logger = logging.getLogger(__name__)

class EnterpriseSearchEngine:
    def __init__(self):
        self.parser = QueryParser()
        self.executor = HybridSearchExecutor()
        self.ranking_engine = SearchRankingEngine()
        self.analytics = SearchAnalyticsTracker()

    def search(self, db: Session, query: str, user_role: str = "guest", user_department: str = None, limit: int = 10) -> Dict[str, Any]:
        """
        Executes unified hybrid search, ranks results, applies RBAC constraints,
        generates AI-summarized answer, and records metrics.
        """
        start_time = time.perf_counter()
        
        # 1. Parse Query
        parsed_res = self.parser.parse(query)
        search_term = parsed_res["search_term"]
        filters = parsed_res["filters"]

        # 2. Execute Hybrid Searches
        kw_results = self.executor.search_keywords(db, search_term, filters)
        vec_results = self.executor.search_vectors(db, search_term, limit=limit)
        graph_results = self.executor.search_graph(db, search_term)

        # 3. Rerank and Merge Results
        ranked_results = self.ranking_engine.rerank_and_merge(
            keyword_results=kw_results,
            vector_results=vec_results,
            graph_results=graph_results,
            user_role=user_role,
            user_department=user_department
        )

        # 4. Enforce RBAC Role-Aware Filters
        role_lower = str(user_role).lower() if user_role else "guest"
        dept_lower = str(user_department).lower() if user_department else ""
        
        filtered_results = []
        for item in ranked_results:
            is_permitted = True
            
            # Gating Finance / Invoices / Payroll
            if item["type"] in ["invoice", "payroll"]:
                if role_lower not in ["admin", "finance_manager"] and dept_lower != "finance":
                    is_permitted = False
            
            # Gating CRM Leads
            elif item["type"] in ["lead", "crm_lead"]:
                if role_lower not in ["admin", "sales_rep"] and dept_lower != "sales":
                    is_permitted = False

            if is_permitted:
                filtered_results.append(item)

        # Truncate to limit
        final_results = filtered_results[:limit]

        # 5. Generate AI Search Answer
        ai_answer = self._generate_ai_answer(query, final_results)

        # 6. Record query stats and latency
        latency_ms = (time.perf_counter() - start_time) * 1000
        self.analytics.log_query(
            db=db,
            query=query,
            role=user_role,
            dept=user_department,
            latency_ms=latency_ms,
            result_count=len(final_results)
        )

        return {
            "query": query,
            "parsed_filters": filters,
            "answer": ai_answer,
            "results": final_results,
            "metrics": {
                "latency_ms": round(latency_ms, 2),
                "total_results": len(final_results)
            }
        }

    def _generate_ai_answer(self, query: str, results: List[Dict[str, Any]]) -> str:
        """
        Generates contextual AI summary statement from retrieved results.
        """
        if not results:
            return "No matching documents, invoices, CRM leads, or workflows were found on the platform."

        top_results_desc = []
        for idx, r in enumerate(results[:4]):
            top_results_desc.append(f"[{idx+1}] Type: {r['type'].upper()} | Title: {r['title']} | Desc: {r['description']}")

        context_str = "\n".join(top_results_desc)

        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                client = OpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_API_BASE
                )
                system_prompt = (
                    "You are Syntra OS Enterprise Search assistant. Read the user search query "
                    "and top retrieved results, and generate a concise, grounded explanation of the findings. "
                    "Include inline citation markers like [1], [2] to reference findings. "
                    "If the results do not help answer the query, explain that context."
                )
                res = client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Query: {query}\n\nRetrieved Search Results:\n{context_str}"}
                    ],
                    temperature=0.0
                )
                return res.choices[0].message.content.strip()
            except Exception as e:
                logger.warning(f"LLM AI Answer generation failed. Falling back: {str(e)}")

        # Fallback Mock Generator
        top_item = results[0]
        return (
            f"Based on your search for '{query}', the most relevant result is "
            f"'{top_item['title']}' ({top_item['type']}), which states: '{top_item['description']}'. "
            f"There are {len(results)} total matching records found across your department workspace."
        )
