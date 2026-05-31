import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from modules.enterprise_search.search_engine import EnterpriseSearchEngine
from modules.enterprise_search.autocomplete import AutocompleteEngine
from modules.enterprise_search.search_indexer import get_index_stats
from modules.enterprise_search.models import RecentSearch
from modules.auth_system.router import get_current_user
from modules.auth_system.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

search_engine = EnterpriseSearchEngine()
autocomplete_engine = AutocompleteEngine()

def get_current_user_optional(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return current_user

@router.post("/")
def unified_search(payload: Dict[str, Any], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Unified global enterprise search endpoint.
    """
    query = payload.get("query", "")
    if not query or not query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'query' parameter."
        )

    # Log query to recent queries
    try:
        recent = RecentSearch(user_id=str(user.id) if user else "guest", query=query.strip())
        db.add(recent)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Failed to record recent search: {str(e)}")

    role = user.role if user else "guest"
    dept = user.department if user else None
    
    return search_engine.search(db, query, user_role=role, user_department=dept)

@router.get("/suggestions")
def get_suggestions(prefix: str = "", db: Session = Depends(get_db)):
    """
    Autocomplete entity-relationship suggestions.
    """
    return autocomplete_engine.get_suggestions(db, prefix)

@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """
    Search usage, latency, and index synchronization stats.
    """
    try:
        metrics = search_engine.analytics.get_analytics(db)
        sync_stats = get_index_stats()
        metrics.update({
            "sync_indexes": sync_stats
        })
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/recent")
def get_recent_searches(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Fetches recent queries made by this user.
    """
    try:
        user_id = str(user.id) if user else "guest"
        recent = db.query(RecentSearch).filter(RecentSearch.user_id == user_id).order_by(RecentSearch.created_at.desc()).limit(5).all()
        return [r.query for r in recent]
    except Exception as e:
        return []

@router.post("/advanced")
def advanced_search(payload: Dict[str, Any], db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """
    Advanced search with explicit date range, status, or type filtering.
    """
    query = payload.get("query", "")
    filters = payload.get("filters", {})
    limit = payload.get("limit", 10)

    role = user.role if user else "guest"
    dept = user.department if user else None

    # Merge explicit payload filters with query parser
    res = search_engine.search(db, query, user_role=role, user_department=dept, limit=limit)
    
    # Overwrite filters with user specific advanced filters if provided
    if filters:
        # Perform manual filtering on ranked list
        filtered = []
        for item in res["results"]:
            match = True
            if "status" in filters and item.get("metadata", {}).get("status") != filters["status"]:
                match = False
            if "type" in filters and item["type"] != filters["type"]:
                match = False
            if match:
                filtered.append(item)
        res["results"] = filtered

    return res
