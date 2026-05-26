-- Schema for AI Document Ingestion System

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table to store raw ingested documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Full extracted text
    file_size INTEGER NOT NULL, -- File size in bytes
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CREATE INDEX for fast retrieval by filename and date
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- =========================================================================
-- FUTURE RAG & VECTOR SEARCH READY SCHEMA
-- =========================================================================
-- When evolving this system into a full RAG pipeline, uncomment/run the following:
--
-- 1. Enable pgvector extension (ensure pgvector is installed in postgres server)
-- CREATE EXTENSION IF NOT EXISTS vector;
--
-- 2. Table to store document chunks
-- CREATE TABLE IF NOT EXISTS document_chunks (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
--     chunk_index INTEGER NOT NULL,
--     content TEXT NOT NULL, -- Text segment
--     embedding vector(768) NOT NULL, -- BAAI bge-base-en-v1.5 format (or 1536 for OpenAI text-embedding-3-small)
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
--
-- 3. Create HNSW or IVFFlat index on embeddings for fast semantic similarity search
-- CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
-- ON document_chunks USING hnsw (embedding vector_cosine_ops);
