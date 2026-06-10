import time
import logging
from sqlalchemy.orm import Session
from ..config import settings
from .query_rewriter import rewrite_query
from .embeddings import get_embedding
from .vector_store import search_similar_chunks
from .reranker import rerank_chunks
from .cache import cache_store

logger = logging.getLogger(__name__)

def optimize_retrieval(db: Session, raw_query: str, organization_id = None, workspace_id = None) -> dict:
    """
    Production retrieval optimizer pipeline:
    1. Query Rewrite (conversational -> keyword search query)
    2. Embedding Generation (with cache check)
    3. Vector Store retrieval (top 10 chunks)
    4. Reranking (scores top 10 -> filters to top 3-5)
    
    Returns:
        dict: {
            "query_rewritten": str,
            "chunks": list[dict],
            "metrics": {
                "rewrite_time_ms": float,
                "embedding_time_ms": float,
                "db_time_ms": float,
                "rerank_time_ms": float,
                "total_retrieval_time_ms": float
            }
        }
    """
    total_start = time.perf_counter()
    
    # 1. Query Rewriting
    rewrite_start = time.perf_counter()
    rewritten_query = rewrite_query(raw_query)
    rewrite_time = (time.perf_counter() - rewrite_start) * 1000
    
    # Check search cache first using the rewritten query as cache key
    cache_key = f"search:{organization_id}:{workspace_id}:{rewritten_query}"
    cached_result = cache_store.get(cache_key)
    
    if cached_result:
        logger.info(f"Search cache HIT for query: '{rewritten_query}'")
        total_time = (time.perf_counter() - total_start) * 1000
        cached_result["metrics"]["total_retrieval_time_ms"] = total_time
        # Add cache marker
        cached_result["cache_hit"] = True
        return cached_result

    # 2. Embedding Generation
    # We wrap embedding retrieval with a sub-cache key as well
    emb_cache_key = f"emb:{rewritten_query}"
    emb_start = time.perf_counter()
    query_vector = cache_store.get(emb_cache_key)
    if not query_vector:
        query_vector = get_embedding(rewritten_query)
        cache_store.set(emb_cache_key, query_vector)
    emb_time = (time.perf_counter() - emb_start) * 1000
    
    # 3. Vector Database Retrieval
    db_start = time.perf_counter()
    raw_results = search_similar_chunks(db, query_vector, limit=settings.VECTOR_SEARCH_LIMIT, organization_id=organization_id, workspace_id=workspace_id)
    db_time = (time.perf_counter() - db_start) * 1000
    
    # 4. Reranking
    rerank_start = time.perf_counter()
    final_results = rerank_chunks(rewritten_query, raw_results, top_k=settings.RERANK_TOP_K)
    rerank_time = (time.perf_counter() - rerank_start) * 1000
    
    total_time = (time.perf_counter() - total_start) * 1000
    
    response = {
        "query_rewritten": rewritten_query,
        "chunks": final_results,
        "cache_hit": False,
        "metrics": {
            "rewrite_time_ms": round(rewrite_time, 2),
            "embedding_time_ms": round(emb_time, 2),
            "db_time_ms": round(db_time, 2),
            "rerank_time_ms": round(rerank_time, 2),
            "total_retrieval_time_ms": round(total_time, 2)
        }
    }
    
    # Cache the retrieval result
    cache_store.set(cache_key, response)
    
    return response
