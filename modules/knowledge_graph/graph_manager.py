import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy import and_
from modules.knowledge_graph.models import GraphNode, GraphEdge

logger = logging.getLogger(__name__)

class GraphManager:
    def __init__(self):
        pass

    def get_or_create_node(self, db: Session, entity_type: str, name: str, properties: Dict[str, Any] = None) -> GraphNode:
        """
        Gets a node by name and entity_type. If it does not exist, creates it.
        """
        clean_name = name.strip()
        node = db.query(GraphNode).filter(
            and_(
                GraphNode.entity_type == entity_type,
                GraphNode.name == clean_name
            )
        ).first()

        if not node:
            node = GraphNode(
                entity_type=entity_type,
                name=clean_name,
                properties=properties or {}
            )
            db.add(node)
            db.commit()
            db.refresh(node)
        else:
            # Update properties if needed
            if properties:
                updated_props = dict(node.properties or {})
                updated_props.update(properties)
                node.properties = updated_props
                db.commit()
                db.refresh(node)
        return node

    def add_relationship(self, db: Session, source_node: GraphNode, target_node: GraphNode, relationship_type: str, properties: Dict[str, Any] = None) -> GraphEdge:
        """
        Adds a directed relationship (edge) between source and target nodes.
        Avoids duplicates by checking for unique combinations of source, target, and type.
        """
        edge = db.query(GraphEdge).filter(
            and_(
                GraphEdge.source_id == source_node.id,
                GraphEdge.target_id == target_node.id,
                GraphEdge.relationship_type == relationship_type
            )
        ).first()

        if not edge:
            edge = GraphEdge(
                source_id=source_node.id,
                target_id=target_node.id,
                relationship_type=relationship_type,
                properties=properties or {}
            )
            try:
                db.add(edge)
                db.commit()
                db.refresh(edge)
            except Exception as e:
                db.rollback()
                # Re-query in case of concurrent insert race condition
                edge = db.query(GraphEdge).filter(
                    and_(
                        GraphEdge.source_id == source_node.id,
                        GraphEdge.target_id == target_node.id,
                        GraphEdge.relationship_type == relationship_type
                    )
                ).first()
                if not edge:
                    raise e
        else:
            if properties:
                updated_props = dict(edge.properties or {})
                updated_props.update(properties)
                edge.properties = updated_props
                db.commit()
                db.refresh(edge)
        return edge

    def add_entities_and_relationships(self, db: Session, entities: List[Dict[str, Any]], relationships: List[Dict[str, Any]]) -> Tuple[List[GraphNode], List[GraphEdge]]:
        """
        Processes lists of entities and relationships, upserts them into the database, and returns the records.
        """
        nodes_map = {}
        saved_nodes = []
        for ent in entities:
            node = self.get_or_create_node(
                db, 
                entity_type=ent["entity_type"], 
                name=ent["name"], 
                properties=ent.get("properties")
            )
            nodes_map[(ent["entity_type"], ent["name"])] = node
            saved_nodes.append(node)

        saved_edges = []
        for rel in relationships:
            src_key = (rel["source_type"], rel["source_name"])
            tgt_key = (rel["target_type"], rel["target_name"])

            src_node = nodes_map.get(src_key) or self.get_or_create_node(db, rel["source_type"], rel["source_name"])
            tgt_node = nodes_map.get(tgt_key) or self.get_or_create_node(db, rel["target_type"], rel["target_name"])

            edge = self.add_relationship(
                db,
                source_node=src_node,
                target_node=tgt_node,
                relationship_type=rel["relationship_type"],
                properties=rel.get("properties")
            )
            saved_edges.append(edge)

        return saved_nodes, saved_edges

    def get_all_graph(self, db: Session) -> Dict[str, Any]:
        """
        Loads the entire graph structure.
        """
        nodes = db.query(GraphNode).all()
        edges = db.query(GraphEdge).all()

        return {
            "nodes": [n.to_dict() for n in nodes],
            "edges": [e.to_dict() for e in edges]
        }
