import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class ResearchEvaluationEngine:
    def __init__(self):
        pass

    def evaluate(self, sub_tasks: List[str], evidence: List[Dict[str, Any]], report_content: Dict[str, Any]) -> float:
        """
        Validates the completeness and confidence score of the generated research report.
        Returns a confidence score between 0.0 and 1.0.
        """
        if not evidence:
            return 0.1 # Very low confidence if no evidence was gathered

        # 1. Completeness Score (how many sub-tasks have matching evidence source types)
        covered_tasks = 0
        task_types = ["invoice", "payroll", "lead", "workflow", "approval"]
        
        evidence_types = {e["type"] for e in evidence}
        
        for task in sub_tasks:
            task_lower = task.lower()
            # If the task requests a type, check if we fetched that type
            matched = False
            for t_type in task_types:
                if t_type in task_lower and t_type in evidence_types:
                    matched = True
            if matched or not any(x in task_lower for x in task_types):
                covered_tasks += 1

        completeness_ratio = covered_tasks / (len(sub_tasks) or 1)

        # 2. Source Coverage Score (variety of sources, e.g. both database search and graph nodes)
        sources = {e["source"] for e in evidence}
        coverage_score = 0.5
        if len(sources) >= 2:
            coverage_score = 1.0

        # Calculate final combined confidence
        confidence = (completeness_ratio * 0.6) + (coverage_score * 0.4)
        
        # Clip to [0.1, 1.0]
        return round(max(0.1, min(1.0, confidence)), 2)
