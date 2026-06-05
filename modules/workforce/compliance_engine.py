import logging
from sqlalchemy.orm import Session
from modules.workforce.models import Contractor
from modules.workforce.country_rules import get_rules_for_country

logger = logging.getLogger(__name__)

def evaluate_contractor_compliance(db: Session, contractor_id: str) -> dict:
    """
    Checks contractor's uploaded documents against country-specific rules.
    Verifies that all required files are present, verified, and not marked suspicious.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {
            "status": "Failed",
            "reason": "Contractor not found",
            "checks": []
        }

    rules = get_rules_for_country(contractor.country)
    required_docs = rules["required_documents"]
    
    # Fetch contractor's documents
    uploaded = {doc.document_type: doc for doc in contractor.documents}
    
    checks = []
    compliance_passed = True
    missing_docs = []
    suspicious_docs = []
    
    for doc_type in required_docs:
        doc = uploaded.get(doc_type)
        if not doc:
            checks.append({
                "rule": f"{doc_type} Presence Check",
                "status": "Failed",
                "message": f"Required document '{doc_type}' has not been uploaded."
            })
            compliance_passed = False
            missing_docs.append(doc_type)
        else:
            if doc.status == "Verified":
                checks.append({
                    "rule": f"{doc_type} Status Check",
                    "status": "Passed",
                    "message": f"Document '{doc_type}' is verified."
                })
            elif doc.status == "Suspicious":
                checks.append({
                    "rule": f"{doc_type} Status Check",
                    "status": "Warning",
                    "message": f"Document '{doc_type}' is flagged as suspicious."
                })
                compliance_passed = False
                suspicious_docs.append(doc_type)
            else: # Pending or Rejected
                checks.append({
                    "rule": f"{doc_type} Status Check",
                    "status": "Failed",
                    "message": f"Document '{doc_type}' has status '{doc.status}'."
                })
                compliance_passed = False
                if doc.status == "Rejected":
                    suspicious_docs.append(doc_type)

    status = "Passed" if compliance_passed else "Failed"
    
    return {
        "contractor_id": str(contractor.id),
        "country": contractor.country,
        "status": status,
        "compliance_notes": rules["compliance_notes"],
        "checks": checks,
        "missing_documents": missing_docs,
        "suspicious_documents": suspicious_docs
    }
