import sys
import os

# Ensure the root of the project is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from app.database import engine, Base, SessionLocal
from modules.governance.models import AIPolicy, AIAuditLog, AIIncident, AIInvestigation
from modules.governance.policy_engine import evaluate_action_policies, seed_default_governance_policies
from modules.governance.risk_engine import evaluate_action_risk
from modules.governance.audit_engine import log_ai_action, get_action_decision_trace
from modules.governance.compliance_engine import evaluate_compliance_coverage
from modules.governance.investigation_center import create_security_incident, start_incident_investigation, resolve_incident
from modules.event_system.models import EventRecord
from modules.human_review_system.models import ApprovalRequest
from modules.knowledge_graph.models import GraphNode, GraphEdge
from modules.knowledge_graph.graph_manager import GraphManager

class TestAIGovernance(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        
        # Clean up existing test data
        self.db.query(AIPolicy).delete()
        self.db.query(AIAuditLog).delete()
        self.db.query(AIIncident).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_complete_governance_flow(self):
        print("\n--- 1. Testing Policy Seeding & Evaluation ---")
        seed_default_governance_policies(self.db)
        policies = self.db.query(AIPolicy).all()
        self.assertTrue(len(policies) > 0)
        
        # Evaluate standard payment below limit
        res_allow = evaluate_action_policies(self.db, "approve_payment", {"amount": 5000.0})
        self.assertEqual(res_allow["result"], "Allow")
        
        # Evaluate payment violating policy (>10k)
        res_block = evaluate_action_policies(self.db, "approve_payment", {"amount": 15000.0})
        self.assertEqual(res_block["result"], "Block")
        self.assertIn("exceeds AI clearance limits", res_block["reason"])
        print("✔ Policies evaluate and block correctly on limit breaches.")

        print("\n--- 2. Testing Risk Grading Engine ---")
        risk_low = evaluate_action_risk("search_documents", {})
        self.assertEqual(risk_low["severity"], "low")
        
        risk_crit = evaluate_action_risk("approve_payment", {"amount": 12000.0})
        self.assertEqual(risk_crit["severity"], "critical")
        print("✔ Risk scoring grades action thresholds consistently.")

        print("\n--- 3. Testing Action Audit Logging & Tracing ---")
        log = log_ai_action(
            db=self.db,
            agent_name="RoboAdvisor",
            tool_used="modify_payroll",
            inputs={"employee": "John", "raise": 500.0},
            outputs={"result": "Approval Required"},
            status="Awaiting Approval"
        )
        self.assertIsNotNone(log.id)
        self.assertEqual(log.risk_level, "high")
        
        trace = get_action_decision_trace(self.db, log.id)
        self.assertEqual(trace["audit_log_id"], str(log.id))
        self.assertTrue(len(trace["trace"]["reasoning_steps"]) > 0)
        print("✔ Action audits and tracing logs capture details.")

        print("\n--- 4. Testing Incident Lifecycle Workspace ---")
        incident = create_security_incident(
            db=self.db,
            incident_type="failed_compliance_check",
            description="Agent failed structural identity check for EOR contractor.",
            severity="high"
        )
        self.assertEqual(incident.status, "Detected")
        
        invest = start_incident_investigation(
            db=self.db,
            incident_id=incident.id,
            investigator_id="compliance_officer_1",
            notes="Opening investigation case file. Reviewing ID upload scans."
        )
        self.assertEqual(invest.status, "Open")
        self.assertEqual(self.db.query(AIIncident).filter(AIIncident.id == incident.id).first().status, "Investigating")
        
        resolved = resolve_incident(self.db, incident.id)
        self.assertEqual(resolved.status, "Resolved")
        self.assertEqual(self.db.query(AIInvestigation).filter(AIInvestigation.id == invest.id).first().status, "Closed")
        print("✔ Incident transitions open/close functions correctly.")

        print("\n--- 5. Testing Compliance Coverage Analytics ---")
        coverage = evaluate_compliance_coverage(self.db)
        self.assertTrue(coverage["overall_compliance_score"] > 0)
        print("✔ Domain-specific compliance coverage compiled.")

        print("\n--- 6. Testing Knowledge Graph Relationships ---")
        # Node and relationships creation
        gm = GraphManager()
        agent_node = gm.get_or_create_node(self.db, "agent", "RoboAdvisor", {"version": "v1.0"})
        workflow_node = gm.get_or_create_node(self.db, "workflow", "Payroll Calculation Sync")
        policy_node = gm.get_or_create_node(self.db, "policy", "Mandatory Payroll Human Sign-off")
        
        gm.add_relationship(self.db, policy_node, workflow_node, "governs")
        
        rel = self.db.query(GraphEdge).filter(
            GraphEdge.source_id == policy_node.id,
            GraphEdge.relationship_type == "governs"
        ).first()
        self.assertIsNotNone(rel)
        print("✔ Governance metadata synced to Knowledge Graph.")

if __name__ == "__main__":
    unittest.main()
