from typing import Dict, Any

class QueryDecomposer:
    def __init__(self):
        pass

    def decompose(self, sub_task: str) -> Dict[str, Any]:
        """
        Decomposes a sub-task description into structured search parameters.
        """
        task_lower = sub_task.lower().strip()
        
        search_term = sub_task
        filters = {}

        # Heuristically classify filters
        if "payroll" in task_lower or "salary" in task_lower:
            filters["type"] = "payroll"
            search_term = "payroll"
        elif "invoice" in task_lower:
            filters["type"] = "invoice"
            search_term = "invoice"
        elif "crm" in task_lower or "lead" in task_lower or "sales" in task_lower:
            filters["type"] = "lead"
            search_term = "lead"
        elif "workflow" in task_lower or "process" in task_lower:
            filters["type"] = "workflow"
            search_term = "workflow"
        elif "approval" in task_lower or "review" in task_lower:
            filters["type"] = "approval"
            search_term = "approval"
        else:
            # General document search term cleanups
            search_term = sub_task.replace("search documents for terms matching", "").replace("search", "").strip()

        return {
            "search_term": search_term,
            "filters": filters
        }
