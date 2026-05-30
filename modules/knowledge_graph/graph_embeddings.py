import logging
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.services.embeddings import get_embedding
from modules.knowledge_graph.models import GraphNode, GraphEdge

logger = logging.getLogger(__name__)

class GraphEmbeddingsHelper:
    def __init__(self):
        pass

    def compute_node_embedding(self, db: Session, node: GraphNode) -> List[float]:
        """
        Creates a text representation of the node and its immediate relationships,
        then calls the default embedding service to generate a vector.
        """
        # Get neighbors
        edges = db.query(GraphEdge).filter(
            or_(
                GraphEdge.source_id == node.id,
                GraphEdge.target_id == node.id
            )
        ).all()

        relations_desc = []
        for edge in edges:
            src = db.query(GraphNode).filter(GraphNode.id == edge.source_id).first()
            tgt = db.query(GraphNode).filter(GraphNode.id == edge.target_id).first()
            if src and tgt:
                relations_desc.append(f"{src.name} ({src.entity_type}) is connected to {tgt.name} ({tgt.entity_type}) via {edge.relationship_type}")

        # Construct final text snippet
        desc_text = f"Entity Name: {node.name}. Type: {node.entity_type}."
        if node.properties:
            desc_text += f" Properties: {str(node.properties)}."
        if relations_desc:
            desc_text += " Relationships: " + "; ".join(relations_desc)

        logger.info(f"Generating graph embedding for node {node.name} using text: {desc_text}")
        return get_embedding(desc_text)
