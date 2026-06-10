import sys
import os

# Ensure project backend and root folders are resolved
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from fastapi import HTTPException
from app.database import Base, engine, SessionLocal

from modules.ai_copilot.intent_parser import parse_intent
from modules.ai_copilot.safety_guardrails import enforce_safety_guardrails, SecurityViolationException
from modules.ai_copilot.tool_executor import execute_tool
from modules.ai_copilot.context_builder import build_system_context
from modules.ai_copilot.action_router import handle_copilot_query

class TestAiCopilot(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        from app.config import settings
        self.old_api_key = settings.OPENAI_API_KEY
        settings.OPENAI_API_KEY = None

    def tearDown(self):
        from app.config import settings
        settings.OPENAI_API_KEY = self.old_api_key
        self.db.close()

    def test_intent_parser(self):
        print("\n--- 1. Testing Command Intent Parser ---")
        
        # Test workflow trigger commands
        res1 = parse_intent("Run compliance check on documents")
        self.assertEqual(res1["intent"], "workflow_trigger")
        self.assertEqual(res1["entities"]["workflow_id"], "doc_verification_pipeline")

        # Test finance queries
        res2 = parse_intent("Show pending invoices")
        self.assertEqual(res2["intent"], "finance_query")
        self.assertEqual(res2["entities"]["type"], "invoice")

        # Test approval action
        res3 = parse_intent("Approve all low-risk invoices")
        self.assertEqual(res3["intent"], "approval_action")
        self.assertEqual(res3["entities"]["action"], "approve")
        
        print("✔ Natural Language commands successfully parsed into intents.")

    def test_safety_guardrails(self):
        print("\n--- 2. Testing Safety Guardrails (RBAC Constraints) ---")
        
        class MockSalesUser:
            role = "sales_rep"
            department = "sales"
            name = "Sales Specialist"
            
        class MockAdminUser:
            role = "admin"
            department = "system"
            name = "System Administrator"

        # Sales user triggering finance calculate workflow should violate rules
        with self.assertRaises(SecurityViolationException):
            enforce_safety_guardrails(
                intent="workflow_trigger",
                entities={"workflow_id": "payroll_calculation_sync"},
                current_user=MockSalesUser()
            )
            
        # Admin user should execute without violations
        try:
            enforce_safety_guardrails(
                intent="workflow_trigger",
                entities={"workflow_id": "payroll_calculation_sync"},
                current_user=MockAdminUser()
            )
            print("✔ Guardrails permit operations for authorized roles.")
        except SecurityViolationException:
            self.fail("Admin user was blocked unexpectedly by safety guardrails.")

    def test_tool_executor(self):
        print("\n--- 3. Testing Tool Executor Routing ---")
        # Querying workflows should resolve successfully
        res = execute_tool(
            intent="workflow_query",
            entities={"status": "failed"},
            db=self.db
        )
        self.assertTrue(res["success"])
        self.assertEqual(res["type"], "workflow_list")
        self.assertIsInstance(res["data"], list)
        print("✔ Tool Executor routes commands and aggregates lists cleanly.")

    def test_context_builder(self):
        print("\n--- 4. Testing Copilot Context Diagnostics ---")
        ctx = build_system_context(self.db)
        self.assertIn("user", ctx)
        self.assertIn("metrics", ctx)
        self.assertIn("health", ctx)
        print(f"✔ Diagnostic context successfully compiled. Health Score: {ctx['health']}/100")

if __name__ == "__main__":
    unittest.main()
