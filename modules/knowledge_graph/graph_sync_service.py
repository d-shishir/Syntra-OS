import logging
from sqlalchemy.orm import Session
from modules.event_system.event_registry import event_registry
from modules.knowledge_graph.entity_extractor import EntityExtractor
from modules.knowledge_graph.relationship_builder import RelationshipBuilder
from modules.knowledge_graph.graph_manager import GraphManager

logger = logging.getLogger(__name__)

extractor = EntityExtractor()
builder = RelationshipBuilder()
manager = GraphManager()

def handle_document_uploaded_sync(event, db: Session):
    """
    Triggered when a document is uploaded. Parses text for heuristic relationships.
    """
    logger.info(f"Graph Sync: Received document_uploaded for {event.id}")
    payload = event.payload or {}
    filename = payload.get("filename") or "Unknown Document"
    text_content = payload.get("content") or ""

    if text_content:
        entities = extractor.extract_from_text(text_content)
        # Always add the document entity itself
        entities.append({
            "entity_type": "document",
            "name": filename,
            "properties": {"document_id": payload.get("document_id")}
        })
        relationships = builder.build_text_relationships(entities, filename)
        manager.add_entities_and_relationships(db, entities, relationships)

def handle_invoice_created_sync(event, db: Session):
    """
    Triggered when an invoice is created/uploaded.
    """
    logger.info(f"Graph Sync: Received invoice event for {event.id}")
    payload = event.payload or {}
    entities = extractor.extract_from_invoice(payload)
    relationships = builder.build_invoice_relationships(entities, payload)
    manager.add_entities_and_relationships(db, entities, relationships)

def handle_lead_created_sync(event, db: Session):
    """
    Triggered when a CRM lead is created.
    """
    logger.info(f"Graph Sync: Received lead_created event for {event.id}")
    payload = event.payload or {}
    entities = extractor.extract_from_crm(payload)
    relationships = builder.build_crm_relationships(entities, payload)
    manager.add_entities_and_relationships(db, entities, relationships)

def handle_workflow_completed_sync(event, db: Session):
    """
    Triggered when an AI Workflow completes.
    """
    logger.info(f"Graph Sync: Received workflow_completed event for {event.id}")
    payload = event.payload or {}
    entities = extractor.extract_from_workflow_log(payload)
    relationships = builder.build_workflow_relationships(entities, payload)
    manager.add_entities_and_relationships(db, entities, relationships)

def handle_approval_processed_sync(event, db: Session):
    """
    Triggered when a human reviews/approves a task.
    """
    logger.info(f"Graph Sync: Received approval_processed event for {event.id}")
    payload = event.payload or {}
    entities = extractor.extract_from_approval(payload)
    relationships = builder.build_approval_relationships(entities, payload)
    manager.add_entities_and_relationships(db, entities, relationships)

def register_graph_sync_subscribers():
    """
    Registers the synchronization callbacks to the system event registry.
    """
    event_registry.subscribe("document_uploaded", handle_document_uploaded_sync)
    event_registry.subscribe("invoice_uploaded", handle_invoice_created_sync)
    event_registry.subscribe("lead_created", handle_lead_created_sync)
    event_registry.subscribe("workflow_completed", handle_workflow_completed_sync)
    event_registry.subscribe("approval_processed", handle_approval_processed_sync)
    logger.info("Knowledge Graph Sync: Registered event subscribers successfully.")
