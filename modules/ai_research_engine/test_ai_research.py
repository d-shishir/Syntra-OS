import unittest
import os
import sys

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from modules.ai_research_engine.models import ResearchTask, ResearchMemory
from modules.ai_research_engine.research_planner import ResearchPlanner
from modules.ai_research_engine.query_decomposer import QueryDecomposer
from modules.ai_research_engine.insight_synthesizer import InsightSynthesizer
from modules.ai_research_engine.report_generator import ReportGenerator
from modules.ai_research_engine.evaluation_engine import ResearchEvaluationEngine
from modules.ai_research_engine.research_memory import ResearchMemoryManager

class TestAIResearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Setup in-memory SQLite database
        cls.engine = create_engine("sqlite:///:memory:")
        ResearchTask.__table__.create(cls.engine)
        ResearchMemory.__table__.create(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        self.planner = ResearchPlanner()
        self.decomposer = QueryDecomposer()
        self.synthesizer = InsightSynthesizer()
        self.report_generator = ReportGenerator()
        self.evaluator = ResearchEvaluationEngine()
        self.memory_manager = ResearchMemoryManager()

    def tearDown(self):
        self.db.query(ResearchTask).delete()
        self.db.query(ResearchMemory).delete()
        self.db.commit()
        self.db.close()

    def test_research_planner(self):
        print("\n--- 1. Testing Research Planner ---")
        goal = "Analyze payroll anomalies across Q1"
        plan = self.planner.generate_plan(goal)
        self.assertGreater(len(plan), 0)
        self.assertIn("payroll", plan[0].lower() + plan[1].lower())
        print("✔ Research sub-tasks generated correctly.")

    def test_query_decomposer(self):
        print("\n--- 2. Testing Query Decomposer ---")
        task = "detect anomalies in payroll transactions"
        params = self.decomposer.decompose(task)
        self.assertEqual(params["filters"].get("type"), "payroll")
        self.assertEqual(params["search_term"], "payroll")
        print("✔ Sub-task decomposed to correct search params.")

    def test_insight_synthesis(self):
        print("\n--- 3. Testing Insight Synthesizer ---")
        evidence = [
            {"source": "enterprise_search", "type": "invoice", "title": "INV-100", "description": "High compliance anomaly found yesterday in invoice processing."},
            {"source": "knowledge_graph", "type": "workflow", "title": "Payroll Validation", "description": "This workflow execution failed during validations."}
        ]
        insights = self.synthesizer.synthesize("Check financial risks", evidence)
        self.assertGreater(len(insights["anomalies"]), 0)
        self.assertGreater(len(insights["risks"]), 0)
        print("✔ Anomalies and operational risks synthesized correctly.")

    def test_report_generation_and_evaluation(self):
        print("\n--- 4. Testing Report Generation & Scoring Evaluation ---")
        sub_tasks = ["collect payroll data", "detect anomalies"]
        evidence = [
            {"source": "enterprise_search", "type": "payroll", "title": "Payroll Q1", "description": "Aggregated records for Q1."},
            {"source": "knowledge_graph", "type": "invoice", "title": "Invoice Details", "description": "Linked transactions."}
        ]
        insights = {
            "patterns": ["Consistent invoice matching"],
            "anomalies": ["Out of bounds invoice INV-200"],
            "risks": ["Pending approval deadlines"],
            "opportunities": ["Automate notification triggers"]
        }
        
        report = self.report_generator.generate("Analyze Q1 anomalies", insights, evidence)
        self.assertIn("Executive Summary", report["markdown"])
        self.assertIn("Out of bounds invoice INV-200", report["findings"][1])
        
        confidence = self.evaluator.evaluate(sub_tasks, evidence, report)
        self.assertGreater(confidence, 0.4)
        print("✔ Structured report drafted and evaluation confidence computed.")

    def test_research_memory(self):
        print("\n--- 5. Testing Research Memory Store ---")
        goal = "Analyze onboarding success rate"
        findings = "Onboarding dropped 12% due to contact latency"
        
        mem = self.memory_manager.save_to_memory(self.db, goal, findings, {"loss": 12.0})
        self.assertIsNotNone(mem)
        
        history = self.memory_manager.get_recent_history(self.db)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].goal, goal)
        print("✔ Research findings saved and retrieved from memory tables.")

if __name__ == "__main__":
    unittest.main()
