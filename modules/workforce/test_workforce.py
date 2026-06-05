import sys
import os

# Ensure the root of the project is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from app.database import engine, Base, SessionLocal
from modules.workforce.models import Contractor, ContractorDocument, ContractorAgreement
from modules.workforce.contractor_service import invite_contractor, list_contractors
from modules.workforce.onboarding_engine import submit_onboarding_document, run_compliance_check, grant_onboarding_approval
from modules.workforce.contract_generator import generate_contractor_agreement
from modules.workforce.compliance_engine import evaluate_contractor_compliance
from modules.workforce.activation_engine import activate_contractor
from modules.event_system.models import EventRecord
from modules.notification_hub.models import Notification
from modules.knowledge_graph.models import GraphNode, GraphEdge
from modules.human_review_system.models import ApprovalRequest

class TestWorkforceAutomation(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        
        # Clean up existing test contractor to avoid unique email constraint issues
        test_email = "tony.stark@starkindustries.com"
        existing = self.db.query(Contractor).filter(Contractor.email == test_email).first()
        if existing:
            self.db.delete(existing)
            self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_complete_onboarding_flow(self):
        print("\n--- 1. Testing Contractor Invitation ---")
        contractor = invite_contractor(
            db=self.db,
            name="Tony Stark",
            email="tony.stark@starkindustries.com",
            country="United States",
            role="AI Robotics Engineer",
            department="R&D",
            manager="Pepper Potts"
        )
        self.assertIsNotNone(contractor.id)
        self.assertEqual(contractor.status, "Invited")
        print("✔ Contractor invited successfully.")

        # Verify notification was sent
        notif = self.db.query(Notification).filter(Notification.recipient == contractor.email).first()
        self.assertIsNotNone(notif)
        self.assertIn("Invitation to Onboard", notif.title)
        print("✔ Invitation notification sent successfully.")

        # Verify event was published
        event = self.db.query(EventRecord).filter(
            EventRecord.event_type == "contractor_invited"
        ).order_by(EventRecord.timestamp.desc()).first()
        self.assertIsNotNone(event)
        self.assertEqual(event.payload["contractor_id"], str(contractor.id))
        print("✔ Event 'contractor_invited' registered on the Event Bus.")

        print("\n--- 2. Testing Contract Generation & Signing ---")
        agreement_res = generate_contractor_agreement(self.db, contractor.id, "$10,000 USD per month")
        self.assertIsNotNone(agreement_res["agreement_id"])
        
        # Simulating signing contract
        agreement = self.db.query(ContractorAgreement).filter(ContractorAgreement.id == agreement_res["agreement_id"]).first()
        agreement.accepted = True
        self.db.commit()
        print("✔ Agreement generated and signed successfully.")

        print("\n--- 3. Testing Document Upload & AI Verification ---")
        # Upload Address Proof
        doc_res_1 = submit_onboarding_document(
            db=self.db,
            contractor_id=contractor.id,
            document_type="Proof of Address",
            file_name="utility_bill_stark_tower.pdf"
        )
        self.assertEqual(doc_res_1["verification"]["status"], "Verified")
        print("✔ Address proof uploaded and AI scan verified.")

        # Upload ID
        doc_res_2 = submit_onboarding_document(
            db=self.db,
            contractor_id=contractor.id,
            document_type="Government ID",
            file_name="passport_scan_verified.jpg"
        )
        self.assertEqual(doc_res_2["verification"]["status"], "Verified")
        print("✔ Government ID uploaded and AI scan verified.")

        # Upload suspicious W-9 to test AI warning system
        doc_res_3 = submit_onboarding_document(
            db=self.db,
            contractor_id=contractor.id,
            document_type="W-9 Tax Form",
            file_name="w9_fake_scan.pdf"
        )
        self.assertEqual(doc_res_3["verification"]["status"], "Suspicious")
        print("✔ W-9 uploaded and suspicious scan flagged.")

        # Re-upload valid W-9
        doc_res_3_valid = submit_onboarding_document(
            db=self.db,
            contractor_id=contractor.id,
            document_type="W-9 Tax Form",
            file_name="w9_stark_industries_valid.pdf"
        )
        self.assertEqual(doc_res_3_valid["verification"]["status"], "Verified")
        print("✔ Valid W-9 uploaded and verified.")

        # Simulate Signed Agreement upload (this is normally auto-created during sign-agreement endpoint)
        doc_res_4 = submit_onboarding_document(
            db=self.db,
            contractor_id=contractor.id,
            document_type="Signed Agreement",
            file_name="Signed_Agreement_v1.0.pdf"
        )
        self.assertEqual(doc_res_4["verification"]["status"], "Verified")

        print("\n--- 4. Testing Compliance Rules Evaluation ---")
        compliance = evaluate_contractor_compliance(self.db, contractor.id)
        self.assertEqual(compliance["status"], "Passed")
        self.assertEqual(len(compliance["missing_documents"]), 0)
        print("✔ Compliance engine evaluated successfully: Passed.")

        print("\n--- 5. Testing Human Review Approval request ---")
        run_res = run_compliance_check(self.db, contractor.id)
        self.assertEqual(run_res["current_status"], "Approval Pending")
        
        # Verify approval request was queued in human review queue
        req = self.db.query(ApprovalRequest).filter(
            ApprovalRequest.supporting_context["contractor_id"].astext == str(contractor.id)
        ).first()
        self.assertIsNotNone(req)
        self.assertEqual(req.status, "pending")
        print("✔ Compliance check succeeded and Human review request created.")

        print("\n--- 6. Testing Final Approval & Activation ---")
        approve_res = grant_onboarding_approval(self.db, contractor.id, "Compliance Officer", "All documentation checks passed.")
        self.assertEqual(approve_res["activation"]["current_status"], "Active")
        print("✔ Onboarding approved and Contractor marked active.")

        # Verify Knowledge Graph relations
        contractor_node = self.db.query(GraphNode).filter(GraphNode.name == contractor.name).first()
        self.assertIsNotNone(contractor_node)
        self.assertEqual(contractor_node.entity_type, "person")

        works_in_edge = self.db.query(GraphEdge).filter(
            GraphEdge.source_id == contractor_node.id,
            GraphEdge.relationship_type == "works_in"
        ).first()
        self.assertIsNotNone(works_in_edge)
        print("✔ Knowledge Graph synchronized: Relationships established.")

        # Verify enterprise search integration by query lookup
        search_results = list_contractors(self.db, query="Stark")
        self.assertTrue(len(search_results) > 0)
        self.assertEqual(search_results[0].name, "Tony Stark")
        print("✔ Enterprise Search indexed search queries successfully.")

        # Verify metrics analytics aggregations
        from modules.workforce.router import get_workforce_analytics_endpoint
        stats = get_workforce_analytics_endpoint(db=self.db, current_user=None)
        self.assertTrue(stats["total_contractors"] > 0)
        self.assertTrue(stats["active_contractors"] > 0)
        print("✔ Workforce analytics telemetry compiled correctly.")

if __name__ == "__main__":
    unittest.main()
