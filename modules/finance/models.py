import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Boolean, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(50), default="Active", index=True) # Active, On Hold, Suspended
    risk_score = Column(Integer, default=0)
    payment_method = Column(String(100), default="bank_transfer")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "status": self.status,
            "risk_score": self.risk_score,
            "payment_method": self.payment_method,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(50), default="Scheduled", index=True) # Scheduled, Executed, Confirmed, Failed
    transaction_id = Column(String(100), nullable=True)
    payment_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "invoice_id": str(self.invoice_id),
            "amount": float(self.amount),
            "status": self.status,
            "transaction_id": self.transaction_id,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class PayrollBatch(Base):
    __tablename__ = "payroll_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="Draft", index=True) # Draft, Under Review, Approved, Paid
    total_gross = Column(Numeric(12, 2), default=0.0)
    total_deductions = Column(Numeric(12, 2), default=0.0)
    total_net = Column(Numeric(12, 2), default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "status": self.status,
            "total_gross": float(self.total_gross),
            "total_deductions": float(self.total_deductions),
            "total_net": float(self.total_net),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
