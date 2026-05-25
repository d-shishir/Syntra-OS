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

    class Config:
        from_attributes = True

class DocumentDetailResponse(DocumentResponse):
    content: str
