import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.types import UserDefinedType
from .database import Base

class PGVector(UserDefinedType):
    def get_col_spec(self, **kw):
        return "vector(1536)"

class Document(Base):
    __tablename__ = "documents"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    filename = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    extracted_json = Column(JSONB, nullable=True)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), default="application/pdf")
    is_deleted = Column(Boolean, default=False, nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    workspace_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "filename": self.filename,
            "content": self.content,
            "extracted_json": self.extracted_json,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "is_deleted": self.is_deleted,
            "organization_id": str(self.organization_id) if self.organization_id else None,
            "workspace_id": str(self.workspace_id) if self.workspace_id else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(PGVector, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )
