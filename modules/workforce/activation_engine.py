import logging
from sqlalchemy.orm import Session
from modules.workforce.models import Contractor
from modules.event_system.event_bus import publish_event
from modules.notification_hub.notification_manager import send_notification
from modules.knowledge_graph.graph_manager import GraphManager

logger = logging.getLogger(__name__)

def activate_contractor(db: Session, contractor_id: str) -> dict:
    """
    Activates contractor: updates database status to 'Active', publishes event,
    triggers notification, and registers structural relationships inside the Knowledge Graph.
    """
    contractor = db.query(Contractor).filter(Contractor.id == contractor_id).first()
    if not contractor:
        return {"status": "error", "message": "Contractor not found"}

    # 1. Update DB Status
    contractor.status = "Active"
    db.commit()

    # 2. Publish event to Event Bus
    try:
        publish_event(
            db=db,
            event_type="contractor_activated",
            source_module="workforce",
            payload={"contractor_id": str(contractor.id), "name": contractor.name, "email": contractor.email},
            priority="high"
        )
    except Exception as e:
        logger.error(f"Activation Engine: Failed to publish contractor_activated event: {str(e)}")

    # 3. Send Notification via Notification Hub
    try:
        send_notification(
            db=db,
            type="contractor_activated",
            priority="high",
            recipient="admin_user",
            title="Contractor Onboarding Completed",
            payload={"contractor_id": str(contractor.id), "name": contractor.name, "email": contractor.email},
            module="workforce"
        )
    except Exception as e:
        logger.error(f"Activation Engine: Failed to send activation notification: {str(e)}")

    # 4. Sync Knowledge Graph
    try:
        manager_name = contractor.manager or "General Operations Manager"
        gm = GraphManager()
        
        # Nodes
        contractor_node = gm.get_or_create_node(db, "person", contractor.name, {"role": contractor.role, "email": contractor.email})
        manager_node = gm.get_or_create_node(db, "person", manager_name, {"role": "Manager"})
        dept_node = gm.get_or_create_node(db, "department", contractor.department)
        
        # Edges (Relationships)
        gm.add_relationship(db, contractor_node, manager_node, "reports_to")
        gm.add_relationship(db, contractor_node, dept_node, "works_in")
        
    except Exception as e:
        logger.error(f"Activation Engine: Failed to synchronize Knowledge Graph: {str(e)}")

    return {
        "status": "success",
        "contractor_id": str(contractor.id),
        "name": contractor.name,
        "email": contractor.email,
        "current_status": contractor.status
    }
