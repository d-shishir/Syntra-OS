import sys
import os

# Ensure the root of the project is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from app.database import engine, Base, SessionLocal
from modules.governance.models import AIIncident, AIPolicy
from modules.executive.models import ExecutiveAlert, DecisionTrace
from modules.executive import command_center, risk_scorer, insight_aggregator, decision_engine

class TestExecutiveCommandCenter(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        
        # Clean up existing test data
        self.db.query(ExecutiveAlert).delete()
        self.db.query(DecisionTrace).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_executive_suite(self):
        print("\n--- 1. Testing Health Score Aggregations ---")
        scores = command_center.compute_executive_scores(self.db)
        self.assertIn("company_health", scores)
        self.assertIn("ai_system_health", scores)
        self.assertIn("governance_compliance", scores)
        print("✔ Executive health scores compiled successfully.")

        print("\n--- 2. Testing Risk Scoring Engine ---")
        risks = risk_scorer.evaluate_company_risk(self.db)
        self.assertIn("risk_score", risks)
        self.assertIn("severity", risks)
        self.assertTrue(isinstance(risks["factors"], list))
        print("✔ Threat index and risk factors calculated successfully.")

        print("\n--- 3. Testing Natural Language Insights ---")
        insights = insight_aggregator.compile_executive_insights(self.db)
        self.assertTrue(len(insights) > 0)
        self.assertTrue(any("ROI" in ins or "Automation" in ins for ins in insights))
        print("✔ Executive natural language insights generated.")

        print("\n--- 4. Testing Decision Support Q&A ---")
        trace = decision_engine.resolve_executive_question(
            self.db, 
            "what is slowing down finance approvals?"
        )
        self.assertIsNotNone(trace["id"])
        self.assertEqual(trace["question"], "what is slowing down finance approvals?")
        self.assertTrue(len(trace["suggestions"]) > 0)
        self.assertTrue(trace["impact_score"] > 0)
        print("✔ Decision Support compiled root cause and logged audit trace.")

if __name__ == "__main__":
    unittest.main()
