from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID

class DocumentBase(BaseModel):
    filename: str
    file_size: int
    mime_type: str = "application/pdf"

class DocumentCreate(DocumentBase):
    content: str

class DocumentResponse(DocumentBase):
    id: UUID
    extracted_json: dict | None = None
    created_at: datetime
    is_vectorized: bool = False
    document_type: str = "unclassified"

    class Config:
        from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    content: str

class SearchResultResponse(BaseModel):
    content: str
    chunk_index: int
    document_id: UUID
    filename: str
    similarity: float

class ChatRequest(BaseModel):
    query: str

class SourceCitation(BaseModel):
    document_id: UUID
    chunk_text: str
    score: float
    filename: str

class ChatMetrics(BaseModel):
    rewrite_time_ms: float
    embedding_time_ms: float
    db_time_ms: float
    rerank_time_ms: float
    generation_time_ms: float
    total_time_ms: float
    cache_hit: bool

class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    metrics: ChatMetrics
    query_rewritten: str | None = None

class SystemMetricsResponse(BaseModel):
    documents_indexed: int
    total_chunks: int
    avg_query_time_ms: float
    cache_hit_rate: float


