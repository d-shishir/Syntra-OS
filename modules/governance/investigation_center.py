import logging
import datetime
from sqlalchemy.orm import Session
from modules.governance.models import AIIncident, AIInvestigation
from modules.event_system.event_bus import publish_event

logger = logging.getLogger(__name__)

def create_security_incident(db: Session, incident_type: str, description: str, severity: str = "medium") -> AIIncident:
    """
    Registers a new security or compliance breach incident.
    """
    incident = AIIncident(
        incident_type=incident_type,
        description=description,
        severity=severity,
        status="Detected"
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    try:
        publish_event(
            db=db,
            event_type="incident_created",
            source_module="governance",
            payload={"incident_id": str(incident.id), "incident_type": incident_type, "severity": severity},
            priority="high"
        )
    except Exception as e:
        logger.error(f"Investigation Center: Failed to publish incident_created event: {str(e)}")

    return incident

def start_incident_investigation(db: Session, incident_id: str, investigator_id: str, notes: str) -> AIInvestigation:
    """
    Enters the investigation stage, adding investigator records.
    Updates incident status to 'Investigating'.
    """
    incident = db.query(AIIncident).filter(AIIncident.id == incident_id).first()
    if not incident:
        raise ValueError("Incident not found")

    incident.status = "Investigating"
    
    invest = AIInvestigation(
        incident_id=incident.id,
        investigator_id=investigator_id,
        notes=notes,
        status="Open"
    )
    db.add(invest)
    db.commit()
    db.refresh(invest)

    try:
        publish_event(
            db=db,
            event_type="investigation_started",
            source_module="governance",
            payload={"incident_id": str(incident.id), "investigation_id": str(invest.id)},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Investigation Center: Failed to publish investigation_started: {str(e)}")

    return invest

def resolve_incident(db: Session, incident_id: str) -> AIIncident:
    """
    Marks the target incident resolved.
    """
    incident = db.query(AIIncident).filter(AIIncident.id == incident_id).first()
    if not incident:
        raise ValueError("Incident not found")

    incident.status = "Resolved"
    incident.resolved_at = datetime.datetime.now()
    
    # Close related investigations
    investigations = db.query(AIInvestigation).filter(AIInvestigation.incident_id == incident.id).all()
    for inv in investigations:
        inv.status = "Closed"
        
    db.commit()
    db.refresh(incident)

    try:
        publish_event(
            db=db,
            event_type="incident_resolved",
            source_module="governance",
            payload={"incident_id": str(incident.id)},
            priority="medium"
        )
    except Exception as e:
        logger.error(f"Investigation Center: Failed to publish incident_resolved event: {str(e)}")

    return incident
