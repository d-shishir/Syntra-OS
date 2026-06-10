# System Specification: Vector Storage & Semantic Search

This document outlines the design, prompt schemas, indexing strategies, and database schemas implemented in Syntra OS's RAG-ready Vector Storage module.

---

## 🛠️ Architecture Overview

```text
[PDF Text Input] ──► [Chunker (600 chars/150 overlap)] ──► [Embeddings API (1536 dims: OpenAI)]
                                                                     │
                                                                     ▼
[Search Queries] ──► [Query Embedding] ──► [pgvector Search] ◄── [PostgreSQL]
                                                   │
                                                   ▼
                                         [Top-K Cosine Matches]
```

---

## 🚀 Model Choice: OpenAI Text Embeddings (1536 dimensions)

To optimize retrieval performance and ensure maximum semantic accuracy, Syntra OS uses **OpenAI text-embedding-3-small** (1536 dimensions) or compatible models.

### 1. Dimension Format & Semantic Precision
* **1536 dimensions**: The 1536-dimensional vector space provides higher fidelity semantic capture, enabling more precise similarity matching for complex financial documents, payroll records, and invoices.
* **Database & Index Footprint**: 1536-dimensional vectors are stored efficiently in PostgreSQL using pgvector's optimized data types and index strategies.

### 2. Execution Speed
* **HNSW (Hierarchical Navigable Small World) Indexing**: Enables high-efficiency similarity queries without sequential table scans. 
* **Cosine Similarity**: Cosine similarity is calculated directly in the database using pgvector's `<=>` distance operator.

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
    embedding vector(1536) NOT NULL,
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
