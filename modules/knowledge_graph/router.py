import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from modules.knowledge_graph.graph_manager import GraphManager
from modules.knowledge_graph.graph_query_engine import GraphQueryEngine
from modules.knowledge_graph.models import GraphNode, GraphEdge
from modules.auth_system.router import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

manager = GraphManager()
query_engine = GraphQueryEngine()

@router.get("/entity/{entity_id}")
def get_entity(entity_id: str, db: Session = Depends(get_db)):
    """
    Retrieve details of a single entity and its immediate relationships.
    """
    data = query_engine.get_entity_by_id(db, entity_id)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entity not found."
        )
    return data

@router.get("/relationships/{entity_id}")
def get_relationships(entity_id: str, db: Session = Depends(get_db)):
    """
    Run BFS traversal from a node to obtain connected sub-graphs.
    """
    try:
        return query_engine.traverse_from_node(db, entity_id, max_depth=2)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/query")
def query_graph(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Submit a keyword query or traversal criteria to return matching sub-graphs.
    """
    query_text = payload.get("query", "")
    if not query_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'query' field."
        )

    # Check if user requested an impact analysis
    # E.g. "impact analysis of workflow X" or "impact of Y"
    if "impact" in query_text.lower():
        # Heuristically parse name
        name = query_text.replace("impact", "").replace("analysis", "").replace("of", "").replace(":", "").strip()
        etype = "workflow"
        if "dept" in query_text.lower() or "department" in query_text.lower():
            etype = "department"
            name = name.replace("dept", "").replace("department", "").strip()
        elif "invoice" in query_text.lower():
            etype = "invoice"
            name = name.replace("invoice", "").strip()
        
        # Fallback to general keyword search if parse failed
        if not name:
            name = "Payroll Validation"
        
        result = query_engine.run_impact_analysis(db, name, etype)
        return {
            "type": "impact_analysis",
            "data": result
        }

    # Default to keyword search sub-graph
    result = query_engine.query_graph_by_keyword(db, query_text)
    return {
        "type": "subgraph",
        "data": result
    }

@router.get("/visualization")
def get_visualization(db: Session = Depends(get_db)):
    """
    Returns the complete list of nodes and edges for frontend D3/Network graph rendering.
    """
    try:
        return manager.get_all_graph(db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Computes graph metrics: highly connected entities (degree centrality),
    workflow bottlenecks, and active departments.
    """
    try:
        nodes = db.query(GraphNode).all()
        edges = db.query(GraphEdge).all()

        # Compute degree centrality
        degree_map = {}
        for edge in edges:
            src_str = str(edge.source_id)
            tgt_str = str(edge.target_id)
            degree_map[src_str] = degree_map.get(src_str, 0) + 1
            degree_map[tgt_str] = degree_map.get(tgt_str, 0) + 1

        centrality_list = []
        for node in nodes:
            nid = str(node.id)
            centrality_list.append({
                "id": nid,
                "name": node.name,
                "entity_type": node.entity_type,
                "degree": degree_map.get(nid, 0)
            })
        
        # Sort by degree centrality
        centrality_list.sort(key=lambda x: x["degree"], reverse=True)

        # Bottlenecks (workflows or reviews that are highly linked but pending/failed)
        bottlenecks = []
        for node in nodes:
            if node.entity_type in ["workflow", "approval"]:
                status_val = node.properties.get("status", "").lower()
                if status_val in ["failed", "pending", "rejected"]:
                    bottlenecks.append({
                        "name": node.name,
                        "entity_type": node.entity_type,
                        "status": status_val,
                        "degree": degree_map.get(str(node.id), 0)
                    })

        # Most involved departments
        dept_counts = {}
        for node in nodes:
            if node.entity_type == "department":
                dept_counts[node.name] = degree_map.get(str(node.id), 0)

        return {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "degree_centrality": centrality_list[:5],
            "workflow_bottlenecks": bottlenecks[:5],
            "involved_departments": [{"name": k, "degree": v} for k, v in dept_counts.items()]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/seed")
def seed_knowledge_graph(db: Session = Depends(get_db)):
    """
    Seeds initial organizational relationship structures to make the explorer dashboard immediately usable.
    """
    try:
        entities = [
            {"entity_type": "person", "name": "John Smith", "properties": {"email": "john.smith@acmecorp.com"}},
            {"entity_type": "company", "name": "Acme Corp", "properties": {"domain": "acmecorp.com"}},
            {"entity_type": "invoice", "name": "INV-500", "properties": {"amount": 25000, "status": "pending"}},
            {"entity_type": "workflow", "name": "Payroll Validation", "properties": {"status": "running"}},
            {"entity_type": "person", "name": "Sarah Manager", "properties": {"role": "Finance Director"}},
            {"entity_type": "department", "name": "Finance", "properties": {}},
            {"entity_type": "approval", "name": "Approval-100", "properties": {"status": "pending", "target_type": "invoice"}},
            {"entity_type": "crm_lead", "name": "Jane Lead", "properties": {"status": "qualified"}},
            {"entity_type": "person", "name": "Alice Representative", "properties": {"role": "Sales Owner"}}
        ]

        relationships = [
            {"source_type": "person", "source_name": "John Smith", "target_type": "company", "target_name": "Acme Corp", "relationship_type": "works_for"},
            {"source_type": "person", "source_name": "John Smith", "target_type": "invoice", "target_name": "INV-500", "relationship_type": "submitted"},
            {"source_type": "invoice", "source_name": "INV-500", "target_type": "company", "target_name": "Acme Corp", "relationship_type": "belongs_to"},
            {"source_type": "invoice", "source_name": "INV-500", "target_type": "workflow", "target_name": "Payroll Validation", "relationship_type": "processed_by"},
            {"source_type": "workflow", "source_name": "Payroll Validation", "target_type": "approval", "target_name": "Approval-100", "relationship_type": "references"},
            {"source_type": "person", "source_name": "Sarah Manager", "target_type": "approval", "target_name": "Approval-100", "relationship_type": "reviewed_by"},
            {"source_type": "person", "source_name": "Sarah Manager", "target_type": "department", "target_name": "Finance", "relationship_type": "works_for"},
            {"source_type": "invoice", "source_name": "INV-500", "target_type": "department", "target_name": "Finance", "relationship_type": "belongs_to"},
            {"source_type": "person", "source_name": "Jane Lead", "target_type": "company", "target_name": "Acme Corp", "relationship_type": "works_for"},
            {"source_type": "person", "source_name": "Alice Representative", "target_type": "person", "target_name": "Jane Lead", "relationship_type": "owns"}
        ]

        nodes, edges = manager.add_entities_and_relationships(db, entities, relationships)
        return {
            "status": "success",
            "nodes_seeded": len(nodes),
            "edges_seeded": len(edges)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Seeding failed: {str(e)}"
        )
