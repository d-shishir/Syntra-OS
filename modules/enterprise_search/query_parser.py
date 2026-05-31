import re
from typing import Dict, Any

class QueryParser:
    def __init__(self):
        self.timeframes = ["today", "yesterday", "this week", "last week", "this month"]
        self.types = ["invoice", "workflow", "approval", "document", "lead", "crm", "notification", "log"]
        self.statuses = ["pending", "completed", "failed", "approved", "rejected", "running", "success"]

    def parse(self, query_str: str) -> Dict[str, Any]:
        """
        Parses raw text queries into search keys and filter dictionaries.
        """
        query_lower = query_str.lower().strip()
        filters = {}
        
        # 1. Parse timeframes
        for tf in self.timeframes:
            if tf in query_lower:
                filters["timeframe"] = tf
                # Strip timeframe from core search query term
                query_lower = query_lower.replace(tf, "")

        # 2. Parse document / transaction types
        for ty in self.types:
            if ty in query_lower:
                filters["type"] = ty
                # Keep it in core text so we can also query matches
                if ty == "crm":
                    filters["type"] = "lead"

        # 3. Parse status constraints
        for st in self.statuses:
            if st in query_lower:
                filters["status"] = st

        # 4. Parse entity markers (names or countries)
        # E.g. "approved by Sarah", "from Nepal"
        by_match = re.search(r'\bby\s+([a-zA-Z]+)\b', query_lower)
        if by_match:
            filters["assigned_to"] = by_match.group(1).title()
            
        from_match = re.search(r'\bfrom\s+([a-zA-Z\s]+)\b', query_lower)
        if from_match:
            loc = from_match.group(1).strip().title()
            if loc not in ["This", "Yesterday", "Last"]:
                filters["location"] = loc

        # Clean core search term
        cleaned_query = re.sub(r'\b(?:show|find|search|get|list|all|by|from|in|with)\b', '', query_lower)
        cleaned_query = re.sub(r'\s+', ' ', cleaned_query).strip()

        return {
            "original_query": query_str,
            "search_term": cleaned_query or query_str,
            "filters": filters
        }
