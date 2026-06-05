import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Contractor(Base):
    __tablename__ = "contractors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    country = Column(String(100), nullable=False, index=True)
    role = Column(String(255), nullable=False)
    department = Column(String(255), nullable=False)
    status = Column(String(50), default="Invited", index=True) # Invited, Pending Documents, Compliance Review, Approval Pending, Active, Suspended, Archived
    start_date = Column(DateTime(timezone=True), nullable=True)
    manager = Column(String(255), nullable=True)
    payment_method = Column(String(100), default="bank_transfer")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    documents = relationship("ContractorDocument", back_populates="contractor", cascade="all, delete-orphan")
    agreements = relationship("ContractorAgreement", back_populates="contractor", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "email": self.email,
            "country": self.country,
            "role": self.role,
            "department": self.department,
            "status": self.status,
            "start_date": self.start_date.strftime("%Y-%m-%d") if self.start_date else None,
            "manager": self.manager,
            "payment_method": self.payment_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class ContractorDocument(Base):
    __tablename__ = "contractor_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    contractor_id = Column(UUID(as_uuid=True), ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False, index=True)
    document_type = Column(String(100), nullable=False) # Government ID, Tax Form, Proof of Address, Signed Agreement
    file_name = Column(String(255), nullable=False)
    status = Column(String(50), default="Pending", index=True) # Pending, Verified, Suspicious, Rejected
    verification_notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    contractor = relationship("Contractor", back_populates="documents")

    def to_dict(self):
        return {
            "id": str(self.id),
            "contractor_id": str(self.contractor_id),
            "document_type": self.document_type,
            "file_name": self.file_name,
            "status": self.status,
            "verification_notes": self.verification_notes,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None
        }

class ContractorAgreement(Base):
    __tablename__ = "contractor_agreements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    contractor_id = Column(UUID(as_uuid=True), ForeignKey("contractors.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(String(50), default="1.0")
    content = Column(Text, nullable=False)
    compensation_details = Column(String(255), nullable=True)
    accepted = Column(Boolean, default=False)
    signed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    contractor = relationship("Contractor", back_populates="agreements")

    def to_dict(self):
        return {
            "id": str(self.id),
            "contractor_id": str(self.contractor_id),
            "version": self.version,
            "content": self.content,
            "compensation_details": self.compensation_details,
            "accepted": self.accepted,
            "signed_at": self.signed_at.isoformat() if self.signed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
