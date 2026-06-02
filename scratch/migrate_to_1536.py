import sys
import os
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/doc_ingest"

print(f"Connecting to database at: {DATABASE_URL}...")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        with conn.begin():
            print("1. Dropping existing index if it exists...")
            conn.execute(text("DROP INDEX IF EXISTS idx_document_chunks_embedding;"))
            
            print("2. Truncating document_chunks table to avoid dimension casting errors...")
            conn.execute(text("TRUNCATE TABLE document_chunks CASCADE;"))
            
            print("3. Altering embedding column to vector(1536)...")
            conn.execute(text("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1536);"))
            
            print("4. Re-creating HNSW cosine distance index for vector(1536)...")
            conn.execute(text("""
                CREATE INDEX idx_document_chunks_embedding 
                ON document_chunks USING hnsw (embedding vector_cosine_ops);
            """))
            
            print("Migration to 1536 completed successfully!")
            
except Exception as e:
    print(f"Error during migration: {e}")
    sys.exit(1)
