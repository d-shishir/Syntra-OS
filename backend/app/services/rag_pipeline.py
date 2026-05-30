import logging
import time
import re
from openai import OpenAI
from sqlalchemy.orm import Session
from ..config import settings
from .embeddings import get_embedding
from .vector_store import search_similar_chunks
from .prompt_builder import build_prompt_payload
from .retrieval_optimizer import optimize_retrieval
from .cache import cache_store
from .metrics import metrics_tracker

logger = logging.getLogger(__name__)

def execute_live_rag(system_prompt: str, user_content: str) -> str:
    """
    Sends the compiled context prompt payload to OpenAI.
    """
    client = OpenAI(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_API_BASE
    )
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        temperature=0.0
    )
    return response.choices[0].message.content.strip()

def execute_mock_rag(query: str, chunks: list[dict]) -> str:
    """
    Simulates a grounded RAG engine using keyword similarity in Python.
    Strictly answers ONLY using sentences from chunks that overlap with query terms.
    If no overlaps are found, replies "Not found in documents".
    """
    logger.info("Executing Q&A in MOCK RAG mode.")
    
    # Extract keywords from query
    query_words = set(re.findall(r'\b\w{3,12}\b', query.lower()))
    # Remove common filler words
    fillers = {"what", "when", "where", "how", "who", "why", "whom", "which", "this", "that", "the", "for", "are", "you", "and", "invoice", "document"}
    keywords = query_words - fillers
    
    if not keywords:
        keywords = query_words
        
    matched_sentences = []
    
    for chunk in chunks:
        # Support both 'content' (from raw search) and 'chunk_text' structures
        content = chunk.get("content", chunk.get("chunk_text", ""))
        if not content:
            continue
            
        # Split chunk into sentences
        sentences = re.split(r'(?<=[.!?])\s+', content)
        for sentence in sentences:
            sentence_words = set(re.findall(r'\b\w{3,12}\b', sentence.lower()))
            # If the sentence matches any keyword
            if keywords & sentence_words:
                cleaned_sentence = sentence.strip()
                if cleaned_sentence and cleaned_sentence not in matched_sentences:
                    matched_sentences.append(cleaned_sentence)
                    
    if matched_sentences:
        # Return matched sentences assembled as a paragraph
        return " ".join(matched_sentences[:3])
    else:
        return "Not found in documents"

def ask_question_rag(db: Session, query: str) -> dict:
    """
    Full RAG Pipeline Orchestrator:
    1. Check RAG Answer cache.
    2. Retrieve and rerank chunks via Retrieval Optimizer.
    3. Construct strict prompt payload.
    4. Call LLM (OpenAI) or Mock fallback.
    5. Record execution timing and cache performance metrics.
    6. Record observability traces, steps, and RAG quality metrics.
    """
    from modules.observability import trace_manager, TraceSession, logger
    from modules.observability.models import AITrace
    
    query_str = query.strip()
    active_trace_id = trace_manager.get_current_trace_id()

    def _execute_rag_logic():
        total_start = time.perf_counter()
        
        # 1. RAG Cache Lookup
        chat_cache_key = f"chat:{query_str}"
        cached_response = cache_store.get(chat_cache_key)
        if cached_response:
            logger.info(f"RAG answer cache HIT for query: '{query_str}'", module="rag", db=db)
            total_time_ms = (time.perf_counter() - total_start) * 1000
            
            # Log to global metrics
            metrics_tracker.record_query(total_time_ms)
            
            response = cached_response.copy()
            response["metrics"] = cached_response["metrics"].copy()
            response["metrics"]["total_time_ms"] = round(total_time_ms, 2)
            response["metrics"]["cache_hit"] = True
            
            # If tracing, add a step for cache hit
            t_id = trace_manager.get_current_trace_id()
            if t_id:
                trace_manager.add_step(t_id, "rag_cache_hit", "success", int(total_time_ms), {}, db)
            return response

        # 2. Optimized Retrieval
        retrieval_res = optimize_retrieval(db, query_str)
        rewritten_query = retrieval_res["query_rewritten"]
        chunks = retrieval_res["chunks"]
        ret_metrics = retrieval_res["metrics"]
        
        if not chunks:
            answer = "Not found in documents"
            total_time_ms = (time.perf_counter() - total_start) * 1000
            metrics_tracker.record_query(total_time_ms)
            
            response = {
                "answer": answer,
                "sources": [],
                "metrics": {
                    "rewrite_time_ms": ret_metrics["rewrite_time_ms"],
                    "embedding_time_ms": ret_metrics["embedding_time_ms"],
                    "db_time_ms": ret_metrics["db_time_ms"],
                    "rerank_time_ms": ret_metrics["rerank_time_ms"],
                    "generation_time_ms": 0.0,
                    "total_time_ms": round(total_time_ms, 2),
                    "cache_hit": False
                },
                "query_rewritten": rewritten_query
            }
            cache_store.set(chat_cache_key, response)
            
            # Observability metrics for empty retrieval
            t_id = trace_manager.get_current_trace_id()
            if t_id:
                trace_manager.add_rag_metric(
                    trace_id=t_id,
                    query=query_str,
                    top_k=0,
                    similarity_scores=[],
                    context_relevance=0.0,
                    hallucination_score=0.0,
                    answer_confidence=0.0,
                    retrieved_chunks=[],
                    db=db
                )
                trace_manager.add_step(t_id, "rag_rewrite", "success", int(ret_metrics["rewrite_time_ms"]), {}, db)
                trace_manager.add_step(t_id, "rag_empty_retrieval", "success", int(ret_metrics["db_time_ms"]), {}, db)
            return response

        # 3. Format context chunks
        formatted_chunks = [
            {"filename": c["filename"], "content": c["content"]}
            for c in chunks
        ]
        
        # Build prompt payload with grounding instructions
        system_prompt, user_content = build_prompt_payload(query_str, formatted_chunks)
        
        # Inject Knowledge Graph relationships context (Graph-Enhanced RAG)
        try:
            from modules.knowledge_graph.graph_query_engine import GraphQueryEngine
            graph_engine = GraphQueryEngine()
            graph_context = graph_engine.find_relationships_context(db, query_str)
            if graph_context:
                logger.info(f"RAG: Found graph context for query, prepending to user prompt content.")
                user_content = graph_context + "\n" + user_content
        except Exception as ge_error:
            logger.warning(f"RAG: Failed to retrieve graph relationships context: {str(ge_error)}")
        
        # 4. LLM Generation
        gen_start = time.perf_counter()
        if settings.OPENAI_API_KEY:
            try:
                answer = execute_live_rag(system_prompt, user_content)
                # Estimate token usage
                from modules.observability.ai_call_tracker import ai_call_tracker
                approx_tokens = len(system_prompt + user_content + answer) // 4
                ai_call_tracker.record_token_usage(approx_tokens, "rag", db)
            except Exception as e:
                logger.error(f"Live RAG query failed. Falling back to Mock RAG. Error: {str(e)}", module="rag", db=db)
                answer = execute_mock_rag(query_str, chunks)
        else:
            answer = execute_mock_rag(query_str, chunks)
        gen_time_ms = (time.perf_counter() - gen_start) * 1000
        
        total_time_ms = (time.perf_counter() - total_start) * 1000
        metrics_tracker.record_query(total_time_ms)
        
        # 5. Extract ground sources / citations
        sources = []
        if "not found in documents" not in answer.lower():
            sources = [
                {
                    "document_id": c["document_id"],
                    "chunk_text": c["content"],
                    "score": c.get("rerank_score", c.get("similarity", 0.0)),
                    "filename": c["filename"]
                }
                for c in chunks
            ]

        response = {
            "answer": answer,
            "sources": sources,
            "metrics": {
                "rewrite_time_ms": ret_metrics["rewrite_time_ms"],
                "embedding_time_ms": ret_metrics["embedding_time_ms"],
                "db_time_ms": ret_metrics["db_time_ms"],
                "rerank_time_ms": ret_metrics["rerank_time_ms"],
                "generation_time_ms": round(gen_time_ms, 2),
                "total_time_ms": round(total_time_ms, 2),
                "cache_hit": False
            },
            "query_rewritten": rewritten_query
        }
        
        cache_store.set(chat_cache_key, response)

        # 6. Trace steps and quality metrics
        t_id = trace_manager.get_current_trace_id()
        if t_id:
            try:
                # Gather similarity scores & details
                scores = [float(c.get("rerank_score", c.get("similarity", 0.0))) for c in chunks]
                retrieved_chunks = [
                    {
                        "chunk_id": str(c.get("document_id", "")),
                        "content": c.get("content", ""),
                        "filename": c.get("filename", ""),
                        "score": float(c.get("rerank_score", c.get("similarity", 0.0)))
                    }
                    for c in chunks
                ]
                
                # Check hallucination signals (e.g. if the answer is "Not found in documents" but chunks were returned)
                is_not_found = "not found" in answer.lower()
                hallucination_score = 1.0 if is_not_found and len(chunks) > 0 else 0.0
                confidence = 0.0 if is_not_found else 0.95

                trace_manager.add_rag_metric(
                    trace_id=t_id,
                    query=query_str,
                    top_k=len(chunks),
                    similarity_scores=scores,
                    context_relevance=1.0 if len(chunks) > 0 else 0.0,
                    hallucination_score=hallucination_score,
                    answer_confidence=confidence,
                    retrieved_chunks=retrieved_chunks,
                    db=db
                )
                
                trace_manager.add_step(t_id, "rag_rewrite", "success", int(ret_metrics["rewrite_time_ms"]), {}, db)
                trace_manager.add_step(t_id, "rag_embedding", "success", int(ret_metrics["embedding_time_ms"]), {}, db)
                trace_manager.add_step(t_id, "rag_db_search", "success", int(ret_metrics["db_time_ms"]), {}, db)
                trace_manager.add_step(t_id, "rag_generation", "success", int(gen_time_ms), {}, db)
            except Exception as ex:
                logger.error(f"Failed to record RAG metrics: {str(ex)}", module="rag", db=db)

        return response

    if not active_trace_id:
        # Standalone RAG invocation: Create a new TraceSession
        with TraceSession(module="rag", input_data=query_str, db=db) as sess:
            res = _execute_rag_logic()
            # Update final output
            trace = db.query(AITrace).filter(AITrace.trace_id == sess.trace_id).first()
            if trace:
                trace.final_output = res.get("answer", "")
                db.commit()
            return res
    else:
        return _execute_rag_logic()
