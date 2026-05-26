# System Specification: Vector Storage & Semantic Search

This document outlines the design, prompt schemas, indexing strategies, and database schemas implemented in Syntra OS's RAG-ready Vector Storage module.

---

## 🛠️ Architecture Overview

```text
[PDF Text Input] ──► [Chunker (600 chars/150 overlap)] ──► [Embeddings API (768 dims: BAAI)]
                                                                    │
                                                                    ▼
[Search Queries] ──► [Query Embedding] ──► [pgvector Search] ◄── [PostgreSQL]
                                                   │
                                                   ▼
                                         [Top-K Cosine Matches]
```

---

## 🚀 Model Choice: BAAI BGE-Base vs. OpenAI Text Embeddings

To optimize performance and minimize resource constraints, Syntra OS uses **BAAI bge-base-en-v1.5** (768 dimensions) via OpenRouter rather than standard **OpenAI text-embedding-3-small** (1536 dimensions).

### 1. Cost Efficiency (50% reduction)
* **OpenAI text-embedding-3-small**: Costs **$0.02** per 1M tokens.
* **BAAI bge-base-en-v1.5**: Costs **$0.01** per 1M tokens (50% cheaper).

### 2. Dimension Format & Memory Optimization
The "format" of an embedding vector refers to its dimensionality.
* **768 vs. 1536**: BAAI uses 768 dimensions compared to OpenAI's 1536. 
* **Database & Index Footprint**: 768-dimensional vectors take exactly **50% less storage and RAM** in PostgreSQL than 1536-dimensional ones. This allows the system to scale to millions of chunk records under constrained server hardware resources.

### 3. Execution Speed
Cosine similarity index lookups scale linearly with vector dimensions. By executing lookups on 768 floating point numbers instead of 1536, the similarity calculations (pgvector `<=>` operator) consume less CPU and return top-K matching contexts faster.

---

## 1. Text Chunking Engine
Located in [chunker.py](../../backend/app/services/chunker.py).
- **Strategy**: Slices raw text streams into overlapping windows of roughly 600 characters (~180 words), with a 150-character (~40 words) boundary overlap.
- **Natural Boundary Preservation**: The chunker scans the last 15% of each chunk window for punctuation or paragraph newlines, breaking on natural sentence boundaries rather than splitting words in half.

---

## 2. Vector Database DDL Schema
Enforces vector types and fast search indexes (HNSW) in PostgreSQL.
Located in [create_chunks_table.sql](../../database/migrations/create_chunks_table.sql):
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL, -- Modified from 1536 to support BAAI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_chunks_embedding 
ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## 3. Semantic Similarity Retrieval
Matches queries against document nodes inside [vector_store.py](../../backend/app/services/vector_store.py):
- **Distance Operator**: Uses pgvector's `<=>` operator (Cosine Distance).
- **Similarity Conversion**: Since cosine similarity is represented as `1 - Cosine Distance`, the query translates as:
```sql
SELECT content, 1 - (embedding <=> :query_vector::vector) as similarity
FROM document_chunks
ORDER BY embedding <=> :query_vector::vector
LIMIT :limit;
```
- **HNSW Acceleration**: Enables high-efficiency similarity queries without sequential table scans.
