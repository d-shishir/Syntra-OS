import logging
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from modules.workforce.models import Contractor, ContractorDocument
from modules.event_system.event_bus import publish_event
from modules.notification_hub.notification_manager import send_notification

logger = logging.getLogger(__name__)

def invite_contractor(db: Session, name: str, email: str, country: str, role: str, department: str, manager: str = None) -> Contractor:
    """
    Creates a new contractor invitation with status 'Invited'.
    Publishes an event and triggers invitation notifications.
    """
    # Check if contractor exists
    existing = db.query(Contractor).filter(Contractor.email == email).first()
    if existing:
        return existing
        
    contractor = Contractor(
        name=name,
        email=email,
        country=country,
        role=role,
        department=department,
        status="Invited",
        start_date=datetime.date.today() + datetime.timedelta(days=14),
        manager=manager or "Operations Director",
        payment_method="bank_transfer"
    )
    db.add(contractor)
    db.commit()
    db.refresh(contractor)

    # 1. Publish Event contractor_invited
    try:
        publish_event(
            db=db,
            event_type="contractor_invited",
            source_module="workforce",
            payload={"contractor_id": str(contractor.id), "name": contractor.name, "email": contractor.email},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Contractor Service: Failed to publish contractor_invited: {str(e)}")

    # 2. Trigger notification via notification manager
    try:
        send_notification(
            db=db,
            type="contractor_invited",
            priority="medium",
            recipient=contractor.email,
            title="Invitation to Onboard: Syntra OS",
            payload={"name": contractor.name, "onboarding_link": f"/onboard/{contractor.id}"},
            module="workforce"
        )
    except Exception as e:
        logger.error(f"Contractor Service: Failed to dispatch invitation notification: {str(e)}")

    return contractor

def list_contractors(db: Session, query: str = None, status: str = None) -> list:
    """
    Lists contractor profiles with query and status filters.
    """
    q = db.query(Contractor)
    if status:
        q = q.filter(Contractor.status == status)
    if query:
        keyword = f"%{query}%"
        q = q.filter(or_(
            Contractor.name.ilike(keyword),
            Contractor.email.ilike(keyword),
            Contractor.role.ilike(keyword),
            Contractor.country.ilike(keyword)
        ))
    return q.order_by(Contractor.created_at.desc()).all()

def update_contractor_profile(db: Session, contractor_id: str, updates: dict) -> Contractor:
    """
    Updates profile details of a contractor.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        raise ValueError("Contractor not found")
        
    for k, v in updates.items():
        if hasattr(contractor, k) and k != "id":
            setattr(contractor, k, v)
            
    db.commit()
    db.refresh(contractor)
    return contractor
