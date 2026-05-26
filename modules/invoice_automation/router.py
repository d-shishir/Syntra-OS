from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Document
from .models import Invoice, PayrollRecord, Anomaly, ProcessingLog
from .invoice_service import process_invoice
from .payroll_service import process_payroll
from app.services.extractor import extract_structured_data
from app.services.chunker import split_text_into_chunks
from app.services.embeddings import get_embedding
from app.services.vector_store import save_document_chunks
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/invoices")
def get_invoices(
    vendor: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Retrieves invoices list with filters, sorting, and pagination.
    """
    query = db.query(Invoice)
    if vendor:
        query = query.filter(Invoice.vendor_name.ilike(f"%{vendor}%"))
    if status:
        query = query.filter(Invoice.status == status)
    
    total = query.count()
    offset = (page - 1) * limit
    results = query.order_by(Invoice.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [inv.to_dict() for inv in results]
    }

@router.get("/payroll-records")
def get_payroll_records(
    employee: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Retrieves payroll records list with filters, sorting, and pagination.
    """
    query = db.query(PayrollRecord)
    if employee:
        query = query.filter(PayrollRecord.employee_name.ilike(f"%{employee}%"))
    if status:
        query = query.filter(PayrollRecord.status == status)
        
    total = query.count()
    offset = (page - 1) * limit
    results = query.order_by(PayrollRecord.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [pr.to_dict() for pr in results]
    }

@router.get("/anomalies")
def get_anomalies(
    resolved: bool | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Retrieves anomalies list with severity and resolution filters.
    """
    query = db.query(Anomaly)
    if resolved is not None:
        query = query.filter(Anomaly.resolved == resolved)
    if severity:
        query = query.filter(Anomaly.severity == severity)
        
    results = query.order_by(Anomaly.created_at.desc()).all()
    return [anom.to_dict() for anom in results]

@router.post("/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: str, db: Session = Depends(get_db)):
    """
    Marks an anomaly as resolved and updates parent status if necessary.
    """
    anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anomaly not found"
        )
    anomaly.resolved = True
    db.commit()
    
    # Re-evaluate parent status if all anomalies are now resolved
    if anomaly.invoice_id:
        parent = db.query(Invoice).filter(Invoice.id == anomaly.invoice_id).first()
        if parent:
            active_anom_count = db.query(Anomaly).filter(Anomaly.invoice_id == parent.id, Anomaly.resolved == False).count()
            if active_anom_count == 0:
                parent.status = "validated"
    elif anomaly.payroll_record_id:
        parent = db.query(PayrollRecord).filter(PayrollRecord.id == anomaly.payroll_record_id).first()
        if parent:
            active_anom_count = db.query(Anomaly).filter(Anomaly.payroll_record_id == parent.id, Anomaly.resolved == False).count()
            if active_anom_count == 0:
                parent.status = "validated"
                
    db.commit()
    return {"status": "success", "message": f"Anomaly {anomaly_id} marked as resolved."}

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """
    Aggregates metrics for dashboard indicators.
    """
    # Total invoice metrics
    total_invoiced = db.query(func.sum(Invoice.total_amount)).scalar() or 0.0
    avg_invoice = db.query(func.avg(Invoice.total_amount)).scalar() or 0.0
    invoices_count = db.query(Invoice.id).count()
    
    # Total payroll metrics
    total_payroll = db.query(func.sum(PayrollRecord.net_pay)).scalar() or 0.0
    payroll_count = db.query(PayrollRecord.id).count()
    
    # Anomaly metrics
    total_anomalies = db.query(Anomaly.id).count()
    active_anomalies = db.query(Anomaly.id).filter(Anomaly.resolved == False).count()
    
    # Document totals
    total_docs = db.query(Document.id).count()
    
    # Validation issues by severity
    high_severity_count = db.query(Anomaly.id).filter(Anomaly.resolved == False, Anomaly.severity == "high").count()
    medium_severity_count = db.query(Anomaly.id).filter(Anomaly.resolved == False, Anomaly.severity == "medium").count()
    low_severity_count = db.query(Anomaly.id).filter(Anomaly.resolved == False, Anomaly.severity == "low").count()
    
    # Average anomaly score or risk indicator (0 to 100 score)
    risk_score = 0
    if total_docs > 0:
        risk_score = min(100, int((active_anomalies / total_docs) * 20))
        
    return {
        "invoices": {
            "total_value": float(total_invoiced),
            "average_value": float(avg_invoice),
            "count": invoices_count
        },
        "payroll": {
            "total_value": float(total_payroll),
            "count": payroll_count
        },
        "anomalies": {
            "total": total_anomalies,
            "active": active_anomalies,
            "high": high_severity_count,
            "medium": medium_severity_count,
            "low": low_severity_count
        },
        "risk_score": risk_score,
        "total_documents": total_docs
    }

@router.post("/reprocess/{document_id}")
def reprocess_document(document_id: str, db: Session = Depends(get_db)):
    """
    Manually re-runs structured extraction, validation, and anomaly engines.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
        
    try:
        # Re-run extraction
        extracted_data = extract_structured_data(document.content)
        document.extracted_json = extracted_data
        db.commit()
        
        doc_type = extracted_data.get("document_type", "general")
        
        if doc_type == "invoice":
            process_invoice(db, str(document.id), extracted_data)
        elif doc_type == "payroll":
            process_payroll(db, str(document.id), extracted_data)
            
        # Re-index chunks
        chunks = split_text_into_chunks(document.content)
        if chunks:
            embeddings = [get_embedding(c["chunk_text"]) for c in chunks]
            save_document_chunks(db, str(document.id), chunks, embeddings)
            
        return {"status": "success", "message": f"Successfully reprocessed document {document_id}"}
    except Exception as e:
        logger.exception(f"Failed to reprocess document {document_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
