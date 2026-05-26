# Syntra OS: AI & RAG Orchestration Engine

This directory holds blueprints, strategies, and implementation details for the Retrieval-Augmented Generation (RAG) knowledge pipeline powering **Syntra OS**.

---

## 🧠 Core RAG Architecture

```text
[PDF Document Ingest] ──► [pdfplumber Parser] ──► [Recursive Sentence Chunker]
                                                          │
                                                          ▼
[Cosine Sim Search] ◄── [pgvector Index HNSW] ◄── [Embeddings API (1536-dim)]
         │
         ▼
[Context-Rich Payload] ──► [LLM Generation Engine] ──► [Grounded Citation Answer]
```

---

## 1. Document Chunking Strategy
Located in [chunker.py](../backend/app/services/chunker.py):
*   **Segment Size**: 500-600 characters (~150 words).
*   **Window Overlap**: 100-150 characters (~30 words) to prevent cutting sentences in half.
*   **Sentence Preservation**: Splitting logic respects punctuation marks (`.`, `?`, `!`) and newlines `\n` to maintain semantic coherence.

---

## 2. Generating Embeddings
Located in [embeddings.py](../backend/app/services/embeddings.py):
*   **Dimensions**: 1536.
*   **Default Engine**: `text-embedding-3-small` (or equivalent on OpenRouter).
*   **Offline Fallback**: Returns zero vectors or dummy dimensions to ensure offline tests do not crash if API key is not configured.

---

## 3. Similarity Search & Vector DB
Located in [vector_store.py](../backend/app/services/vector_store.py):
*   **Storage Provider**: PostgreSQL `pgvector` extension.
*   **Cosine Similarity**: Queries match using the `<=>` operator (1 - Cosine Distance).
*   **Query Performance**: Accelerated using Hierarchical Navigable Small World (HNSW) indexes (`idx_document_chunks_embedding`).

---

## 4. Contextual prompt & Grounding
Located in [rag_pipeline.py](../backend/app/services/rag_pipeline.py):
*   **System Prompts**: Instructs the LLM to strictly answer questions using *only* the retrieved context chunks. If details are not present, it must reply "Not found in documents".
*   **Citations**: Displays chunk snippets and matching similarity scores directly on the frontend dashboard.
*   **Search Optimizations**: Implements query rewriting and reranking to improve accuracy.
