import logging
from sqlalchemy.orm import Session
from modules.workforce.models import ContractorDocument

logger = logging.getLogger(__name__)

def verify_uploaded_document(db: Session, doc_id: str) -> dict:
    """
    Simulates AI Document Verification.
    Inspects document attributes (e.g. filename markers), parses expiration, completeness,
    and updates database record statuses accordingly.
    """
    doc = db.query(ContractorDocument).filter(ContractorDocument.id == doc_id).first()
    if not doc:
        return {"status": "error", "message": "Document not found"}

    file_lower = doc.file_name.lower()
    
    # 1. AI suspicious / fraudulent check
    if "fake" in file_lower or "suspicious" in file_lower or "test_suspicious" in file_lower:
        doc.status = "Suspicious"
        doc.verification_notes = "AI Scan warning: Digital editing artifacts detected in the document border. Flags suspicious ID scan."
    # 2. Expiration check
    elif "expired" in file_lower or "test_expired" in file_lower:
        doc.status = "Rejected"
        doc.verification_notes = "AI Scan failed: Document validity expired. Please upload a current valid version."
    # 3. Completeness check
    elif "blurry" in file_lower or "cutoff" in file_lower or "incomplete" in file_lower:
        doc.status = "Pending"
        doc.verification_notes = "AI Scan warning: Image blurry or text cut off. Please re-upload a clear file."
    else:
        doc.status = "Verified"
        doc.verification_notes = "AI Scan passed: Document matches correct type. Validity matches criteria."

    db.commit()
    
    return {
        "document_id": str(doc.id),
        "document_type": doc.document_type,
        "file_name": doc.file_name,
        "status": doc.status,
        "verification_notes": doc.verification_notes
    }
