import uuid
from sqlalchemy import Column, String, Text, Integer, DateTime, Numeric, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    vendor_name = Column(String(255), nullable=False, index=True)
    invoice_number = Column(String(100), nullable=True)
    currency = Column(String(10), default="USD")
    subtotal = Column(Numeric(12, 2), nullable=True)
    tax_amount = Column(Numeric(12, 2), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    payment_terms = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    anomalies = relationship("Anomaly", back_populates="invoice", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "vendor_name": self.vendor_name,
            "invoice_number": self.invoice_number,
            "currency": self.currency,
            "subtotal": float(self.subtotal) if self.subtotal is not None else None,
            "tax_amount": float(self.tax_amount) if self.tax_amount is not None else None,
            "total_amount": float(self.total_amount) if self.total_amount is not None else None,
            "due_date": self.due_date.strftime("%Y-%m-%d") if self.due_date else None,
            "payment_terms": self.payment_terms,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class PayrollRecord(Base):
    __tablename__ = "payroll_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_name = Column(String(255), nullable=False, index=True)
    salary = Column(Numeric(12, 2), nullable=False)
    deductions = Column(JSONB, default=list)
    net_pay = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    anomalies = relationship("Anomaly", back_populates="payroll_record", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "employee_name": self.employee_name,
            "salary": float(self.salary) if self.salary is not None else None,
            "deductions": self.deductions,
            "net_pay": float(self.net_pay) if self.net_pay is not None else None,
            "payment_date": self.payment_date.strftime("%Y-%m-%d") if self.payment_date else None,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=True, index=True)
    payroll_record_id = Column(UUID(as_uuid=True), ForeignKey("payroll_records.id", ondelete="CASCADE"), nullable=True, index=True)
    rule_name = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    invoice = relationship("Invoice", back_populates="anomalies")
    payroll_record = relationship("PayrollRecord", back_populates="anomalies")

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "invoice_id": str(self.invoice_id) if self.invoice_id else None,
            "payroll_record_id": str(self.payroll_record_id) if self.payroll_record_id else None,
            "rule_name": self.rule_name,
            "severity": self.severity,
            "description": self.description,
            "resolved": self.resolved,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class ProcessingLog(Base):
    __tablename__ = "processing_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    message = Column(Text, nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": str(self.id),
            "document_id": str(self.document_id) if self.document_id else None,
            "action": self.action,
            "status": self.status,
            "message": self.message,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
