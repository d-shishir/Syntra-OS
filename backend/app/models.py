import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, func, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base

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
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
