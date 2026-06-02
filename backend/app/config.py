import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Document Ingestion API"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5433/doc_ingest"
    OPENAI_API_KEY: str | None = None
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # Advanced RAG Configurations
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 100
    RERANK_TOP_K: int = 3
    VECTOR_SEARCH_LIMIT: int = 10
    CACHE_TTL_SECONDS: int = 300
    ENABLE_CACHE: bool = True
    
    # CORS settings
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",  # default Vite React port
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
