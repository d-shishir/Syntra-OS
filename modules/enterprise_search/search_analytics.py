import logging
from sqlalchemy.orm import Session
from sqlalchemy import func
from modules.enterprise_search.models import SearchQueryLog

logger = logging.getLogger(__name__)

class SearchAnalyticsTracker:
    def __init__(self):
        pass

    def log_query(self, db: Session, query: str, role: str, dept: str, latency_ms: float, result_count: int) -> SearchQueryLog:
        """
        Persists a search query event to database search logs.
        """
        try:
            log = SearchQueryLog(
                query=query.strip(),
                user_role=role,
                user_department=dept,
                latency_ms=latency_ms,
                result_count=result_count
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            return log
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to log search query analytics: {str(e)}")
            return None

    def get_analytics(self, db: Session) -> dict:
        """
        Compiles performance metrics and search latency averages.
        """
        try:
            total_queries = db.query(SearchQueryLog).count()
            avg_latency = db.query(func.avg(SearchQueryLog.latency_ms)).scalar() or 0.0
            
            # Most popular queries
            popular = db.query(
                SearchQueryLog.query,
                func.count(SearchQueryLog.id).label("count")
            ).group_by(SearchQueryLog.query).order_by(func.count(SearchQueryLog.id).desc()).limit(5).all()

            # Failed searches (result count == 0)
            failed_count = db.query(SearchQueryLog).filter(SearchQueryLog.result_count == 0).count()
            success_rate = ((total_queries - failed_count) / (total_queries or 1)) * 100

            return {
                "total_queries": total_queries,
                "average_latency_ms": round(avg_latency, 2),
                "success_rate": round(success_rate, 1),
                "failed_queries_count": failed_count,
                "popular_queries": [{"query": p[0], "count": p[1]} for p in popular]
            }
        except Exception as e:
            logger.error(f"Failed to load search analytics: {str(e)}")
            return {
                "total_queries": 0,
                "average_latency_ms": 0.0,
                "success_rate": 100.0,
                "failed_queries_count": 0,
                "popular_queries": []
            }
