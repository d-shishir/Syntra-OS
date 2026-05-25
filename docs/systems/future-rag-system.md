# Future System Specification: RAG System

This document outlines the blueprints and development plan for integrating a Retrieval-Augmented Generation (RAG) system with our existing ingestion architecture.

---

## 🏗️ Future Architecture

```text
[Ingested PDF Content]
         │
         ▼
 1. [Chunking Engine] ──> (Recursive Character Splitter, Size: 800 chars, Overlap: 100)
         │
         ▼
 2. [Embeddings Model] ──> (OpenAI text-embedding-3-small or local HuggingFace)
         │
         ▼
 3. [Vector Database] ──> (PostgreSQL pgvector or Pinecone Cloud)
         │
         ▼
 4. [Query Retriever] ──> (Cosine Similarity Search top_k = 5)
         │
         ▼
 5. [LLM orchestrator] ──> (Claude-3.5 or GPT-4o Prompt Context Injection)
```

---

## 1. Data Schema Evolution
We will register a `document_chunks` table containing our high-dimensional embedding values. The SQL specification is pre-drafted in the project database folder:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL
);

CREATE INDEX idx_document_chunks_embedding 
ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 2. API Extensions
New endpoints to be created in the FastAPI backend:
1. **`POST /documents/{id}/embed`**: Generates and stores embeddings for the specified document text.
2. **`POST /search`**: Accept a query string, convert it to an embedding vector, perform a similarity search against `document_chunks`, and return matching snippets.
3. **`POST /query`**: Core RAG endpoint. Executes similarity search, constructs the context prompt, feeds it to an LLM, and streams back the generated response.
