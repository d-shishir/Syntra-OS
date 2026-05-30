import logging
import uuid
from typing import List, Dict, Any, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from modules.knowledge_graph.models import GraphNode, GraphEdge

logger = logging.getLogger(__name__)

class GraphQueryEngine:
    def __init__(self):
        pass

    def get_entity_by_id(self, db: Session, entity_id: str) -> Dict[str, Any]:
        """
        Fetch node and its immediate relationships.
        """
        entity_uuid = uuid.UUID(entity_id) if isinstance(entity_id, str) else entity_id
        node = db.query(GraphNode).filter(GraphNode.id == entity_uuid).first()
        if not node:
            return {}
        
        # Immediate outbound and inbound edges
        out_edges = db.query(GraphEdge).filter(GraphEdge.source_id == node.id).all()
        in_edges = db.query(GraphEdge).filter(GraphEdge.target_id == node.id).all()

        return {
            "entity": node.to_dict(),
            "outbound_relationships": [e.to_dict() for e in out_edges],
            "inbound_relationships": [e.to_dict() for e in in_edges]
        }

    def traverse_from_node(self, db: Session, start_node_id: str, max_depth: int = 3) -> Dict[str, Any]:
        """
        Runs a BFS traversal starting from a specific node up to max_depth.
        Returns all visited nodes and edges traversed.
        """
        start_uuid = uuid.UUID(start_node_id) if isinstance(start_node_id, str) else start_node_id
        visited_node_ids = {start_uuid}
        traversed_edges = []
        queue = [(start_uuid, 0)]

        # Map to quickly fetch nodes at the end
        while queue:
            curr_id, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            # Fetch edges involving this node
            edges = db.query(GraphEdge).filter(
                or_(
                    GraphEdge.source_id == curr_id,
                    GraphEdge.target_id == curr_id
                )
            ).all()

            for edge in edges:
                if edge.to_dict() not in traversed_edges:
                    traversed_edges.append(edge.to_dict())
                
                # Check next nodes
                next_id = edge.target_id if edge.source_id == curr_id else edge.source_id
                if next_id not in visited_node_ids:
                    visited_node_ids.add(next_id)
                    queue.append((next_id, depth + 1))

        # Retrieve all visited node objects
        nodes = db.query(GraphNode).filter(GraphNode.id.in_(list(visited_node_ids))).all()

        return {
            "nodes": [n.to_dict() for n in nodes],
            "edges": traversed_edges
        }

    def run_impact_analysis(self, db: Session, start_entity_name: str, entity_type: str) -> Dict[str, Any]:
        """
        Identifies downstream dependencies (the blast radius) if a node (e.g. workflow or department) fails.
        Traces outbound edges or related connections to find impacted invoices, approvals, users, etc.
        """
        node = db.query(GraphNode).filter(
            and_(
                GraphNode.name.ilike(f"%{start_entity_name}%"),
                GraphNode.entity_type == entity_type
            )
        ).first()

        if not node:
            return {"status": "error", "message": f"Entity '{start_entity_name}' of type '{entity_type}' not found."}

        # BFS downstream traversal
        node_uuid = node.id
        visited_nodes = {node_uuid: node.to_dict()}
        traversed_edges = []
        queue = [node_uuid]
        depth_map = {node_uuid: 0}

        while queue:
            curr_id = queue.pop(0)
            curr_depth = depth_map[curr_id]
            if curr_depth >= 3: # Limit impact depth
                continue

            # For impact analysis, we look at outbound flows primarily, or relationships indicating ownership/dependency
            # E.g. source_id -> target_id (Workflow -> references -> Invoice, Invoice -> belongs_to -> Company)
            edges = db.query(GraphEdge).filter(GraphEdge.source_id == curr_id).all()
            for edge in edges:
                tgt_id = edge.target_id
                if tgt_id not in visited_nodes:
                    tgt_node = db.query(GraphNode).filter(GraphNode.id == edge.target_id).first()
                    if tgt_node:
                        visited_nodes[tgt_id] = tgt_node.to_dict()
                        depth_map[tgt_id] = curr_depth + 1
                        queue.append(tgt_id)
                    traversed_edges.append(edge.to_dict())

        return {
            "target_entity": node.to_dict(),
            "impacted_nodes": [n for nid, n in visited_nodes.items() if nid != node_uuid],
            "edges": traversed_edges
        }

    def find_relationships_context(self, db: Session, query: str) -> str:
        """
        Looks for keywords in the user query that match entity names in our graph.
        Returns a descriptive text mapping relationships for RAG prompts.
        """
        nodes = db.query(GraphNode).all()
        matching_nodes = []
        for n in nodes:
            if n.name.lower() in query.lower():
                matching_nodes.append(n)

        if not matching_nodes:
            return ""

        context_statements = []
        for match in matching_nodes:
            # Load relationships
            edges = db.query(GraphEdge).filter(
                or_(
                    GraphEdge.source_id == match.id,
                    GraphEdge.target_id == match.id
                )
            ).all()

            for edge in edges:
                # Resolve source and target names
                src = db.query(GraphNode).filter(GraphNode.id == edge.source_id).first()
                tgt = db.query(GraphNode).filter(GraphNode.id == edge.target_id).first()
                if src and tgt:
                    stmt = f"- Entity '{src.name}' ({src.entity_type}) {edge.relationship_type} Entity '{tgt.name}' ({tgt.entity_type})"
                    if stmt not in context_statements:
                        context_statements.append(stmt)

        if context_statements:
            header = "\n[ORGANIZATIONAL KNOWLEDGE GRAPH CONTEXT]\n"
            return header + "\n".join(context_statements[:10]) + "\n"
        return ""

    def query_graph_by_keyword(self, db: Session, keyword: str) -> Dict[str, Any]:
        """
        Search for entities matching keyword and returns sub-graph of matching and neighboring nodes.
        """
        nodes = db.query(GraphNode).filter(GraphNode.name.ilike(f"%{keyword}%")).all()
        if not nodes:
            return {"nodes": [], "edges": []}

        visited_ids = set()
        edges = []

        for node in nodes:
            visited_ids.add(node.id)
            # Grab adjacent edges
            adj_edges = db.query(GraphEdge).filter(
                or_(
                    GraphEdge.source_id == node.id,
                    GraphEdge.target_id == node.id
                )
            ).all()

            for edge in adj_edges:
                edges.append(edge.to_dict())
                visited_ids.add(edge.source_id)
                visited_ids.add(edge.target_id)

        full_nodes = db.query(GraphNode).filter(GraphNode.id.in_(list(visited_ids))).all()
        return {
            "nodes": [n.to_dict() for n in full_nodes],
            "edges": edges
        }

