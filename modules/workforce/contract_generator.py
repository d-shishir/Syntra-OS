import logging
import datetime
from sqlalchemy.orm import Session
from modules.workforce.models import Contractor, ContractorAgreement

logger = logging.getLogger(__name__)

def generate_contractor_agreement(db: Session, contractor_id: str, compensation_details: str = "$4,500 USD per month") -> dict:
    """
    Generates contract agreements based on contractor profile details, compensation, and location.
    Saves agreements in the database under contractor's document history.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {"status": "error", "message": "Contractor not found"}

    now_date = datetime.date.today().strftime("%Y-%m-%d")
    
    # Simple boilerplate generation based on country
    content = f"""SYNTRA OS GLOBAL WORKFORCE AGREEMENT
==============================================
Effective Date: {now_date}
Employer: Syntra OS Operations Inc.
Contractor Name: {contractor.name}
Contractor Email: {contractor.email}
Country of Association: {contractor.country}

1. SERVICES AND ENGAGEMENT
The contractor is engaged to perform services as a "{contractor.role}" under the "{contractor.department}" department.

2. COMPENSATIONS AND BILLINGS
The payment structure is set at: {compensation_details}. Billings will clear via {contractor.payment_method.replace('_', ' ').capitalize()}.

3. GOVERNING LAW
This agreement is governed by the laws of {contractor.country} and any disputes shall be settled within local arbitration channels.

4. COMPLIANCE GATES
Onboarding compliance is subject to ID verification, tax forms checklist, and background checks.
"""

    agreement = ContractorAgreement(
        contractor_id=contractor.id,
        version="1.0",
        content=content,
        compensation_details=compensation_details,
        accepted=False
    )
    
    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    
    return {
        "agreement_id": str(agreement.id),
        "contractor_id": str(contractor.id),
        "version": agreement.version,
        "content": agreement.content,
        "compensation_details": agreement.compensation_details,
        "accepted": agreement.accepted
    }
