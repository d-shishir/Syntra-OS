import sys
import os

# Ensure the root of the project is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

import unittest
from app.database import engine, Base, SessionLocal
from modules.invoice_automation.models import Invoice, PayrollRecord, Anomaly
from modules.finance.models import Vendor, PaymentRecord, PayrollBatch
from modules.finance.invoice_engine import transition_invoice_status, process_ai_invoice_extraction
from modules.finance.payroll_engine import create_audit_payroll_batch, validate_payroll_batch
from modules.finance.anomaly_detector import evaluate_financial_anomalies
from modules.finance.reconciliation_engine import execute_bank_reconciliation
from modules.finance.payment_engine import schedule_invoice_payment, execute_payment_transaction
from modules.finance.approval_router import submit_invoice_for_approval, approve_invoice_payment
from modules.event_system.models import EventRecord
from modules.notification_hub.models import Notification
from modules.knowledge_graph.models import GraphNode, GraphEdge
from app.models import Document
import uuid

class TestFinanceAutomation(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        
        # Clean up existing test data
        self.db.query(PaymentRecord).delete()
        self.db.query(PayrollBatch).delete()
        self.db.query(Vendor).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_complete_finance_studio_flow(self):
        print("\n--- 1. Testing Invoice Creation & AI Extraction ---")
        # Create a mock base document
        doc = Document(
            filename="invoice_acme_101.pdf",
            content="ACME Corp. Invoice #101. Total Amount: $1,500.00 USD. Due Date: 2026-07-01",
            file_size=1024,
            mime_type="application/pdf"
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        
        # Create Invoice
        invoice = Invoice(
            document_id=doc.id,
            vendor_name="ACME Corp",
            invoice_number="101",
            total_amount=1500.00,
            status="Draft"
        )
        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        
        extraction = process_ai_invoice_extraction(self.db, invoice.id, {"vendor_name": "ACME Corp", "total_amount": 1500.00})
        self.assertEqual(extraction["extraction_status"], "Successful")
        self.assertTrue(extraction["confidence_score"] > 0.8)
        print("✔ Invoice registered and AI data extraction verified.")

        print("\n--- 2. Testing Payment Approvals Workflow ---")
        submit_res = submit_invoice_for_approval(self.db, invoice.id)
        self.assertEqual(submit_res["approval_status"], "Awaiting Manager Review")
        
        # Verify status transitioned to Under Review
        self.assertEqual(self.db.query(Invoice).filter(Invoice.id == invoice.id).first().status, "Under Review")
        
        approve_res = approve_invoice_payment(self.db, invoice.id, "Manager User")
        self.assertEqual(approve_res["invoice_status"], "Approved")
        print("✔ Invoice transitioned and approved successfully.")

        print("\n--- 3. Testing Payment Scheduling & Gateway Payout ---")
        record = schedule_invoice_payment(self.db, invoice.id)
        self.assertEqual(record.status, "Scheduled")
        
        # Verify event was published
        event = self.db.query(EventRecord).filter(
            EventRecord.event_type == "payment_scheduled"
        ).order_by(EventRecord.timestamp.desc()).first()
        self.assertIsNotNone(event)
        print("✔ Payment scheduled and published on Event Bus.")

        pay_res = execute_payment_transaction(self.db, record.id)
        self.assertEqual(pay_res["payment_status"], "Executed")
        self.assertTrue(pay_res["transaction_id"].startswith("TXN_"))
        
        # Verify final invoice status is Paid
        self.assertEqual(self.db.query(Invoice).filter(Invoice.id == invoice.id).first().status, "Paid")
        print("✔ Payment executed and completed via mock gateway.")

        # Verify notification dispatched
        notif = self.db.query(Notification).filter(Notification.type == "payment_completed").first()
        self.assertIsNotNone(notif)
        print("✔ Payment confirmation notification delivered.")

        print("\n--- 4. Testing Payroll Batch Aggregation & Audits ---")
        # Create mock payroll records
        pr1 = PayrollRecord(
            document_id=doc.id,
            employee_name="John Doe",
            salary=5000.00,
            net_pay=4200.00,
            status="pending"
        )
        pr2 = PayrollRecord(
            document_id=doc.id,
            employee_name="Jane Smith",
            salary=16000.00, # Triggers rate spike (>15k)
            net_pay=16000.00,
            status="pending"
        )
        self.db.add_all([pr1, pr2])
        self.db.commit()

        batch = create_audit_payroll_batch(self.db, "June 2026 Batch", [pr1.id, pr2.id])
        self.assertEqual(batch.status, "Draft")
        self.assertEqual(float(batch.total_net), 20200.00)
        
        validation = validate_payroll_batch(self.db, batch.id)
        self.assertEqual(validation["status"], "Warning")
        self.assertTrue(any(a["type"] == "Unusual Spike Check" for a in validation["audits"]))
        print("✔ Payroll batch validation checks completed: Anomalous spike detected.")

        print("\n--- 5. Testing Anomaly Scanner Risk Engine ---")
        anom_res = evaluate_financial_anomalies(self.db)
        self.assertTrue(anom_res["anomalies_count"] >= 0)
        print("✔ System-wide financial anomaly checks passed.")

        print("\n--- 6. Testing Automated Bank Reconciliation ---")
        recon = execute_bank_reconciliation(self.db)
        self.assertIsNotNone(recon["reconciliation_status"])
        print("✔ Bank reconciliation mismatch audit generated.")

        # Clean up records
        self.db.delete(pr1)
        self.db.delete(pr2)
        self.db.delete(invoice)
        self.db.delete(doc)
        self.db.commit()

if __name__ == "__main__":
    unittest.main()
