import sys
import os
import uuid

# Ensure workspace root and backend root are in sys.path
dir_path = os.path.dirname(os.path.abspath(__file__))
root_path = os.path.abspath(os.path.join(dir_path, "..", ".."))
backend_path = os.path.abspath(os.path.join(dir_path, "..", "..", "backend"))

if root_path not in sys.path:
    sys.path.insert(0, root_path)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.database import SessionLocal, engine, Base
import modules.human_review_system.models
import modules.workflow_engine.models

# Auto-create tables for testing
Base.metadata.create_all(bind=engine)

from modules.human_review_system import approval_engine, review_queue, escalation_manager, approval_policies
from modules.human_review_system.models import ApprovalRequest, ApprovalAuditTrail
from modules.workflow_engine.models import WorkflowRun, Workflow
from modules.workflow_engine.workflow_executor import WorkflowExecutor

def test_human_review_system():
    print("🧪 Running Human-in-the-Loop Approval & Review System Tests...")
    db = SessionLocal()
    try:
        # Test 1: Evaluate Policy Rules
        print("1. Testing risk evaluation rules...")
        context_invoice = {"amount": 6500.0}
        risk_res = approval_policies.evaluate_risk("invoice_payment", context_invoice)
        assert risk_res["risk_level"] == "medium", f"Expected 'medium', got {risk_res['risk_level']}"
        assert risk_res["assigned_department"] == "Finance"
        print("✔ Risk scoring policies evaluated successfully.")

        # Test 2: Gate high-risk action
        print("2. Testing review queue gating...")
        gate_res = approval_engine.evaluate_and_gate_task(
            task_type="invoice_payment",
            context=context_invoice,
            db=db,
            generated_by="workflow"
        )
        assert gate_res["needs_approval"] is True, "High-value invoice should be gated"
        req_id = gate_res["request_id"]
        
        # Verify approval request
        req = db.query(ApprovalRequest).filter(ApprovalRequest.id == req_id).first()
        assert req is not None
        assert req.status == "pending"
        assert req.assigned_reviewer == "finance_manager"
        print("✔ Queue gating and assignment working.")

        # Test 3: Reassign reviewer
        print("3. Testing manual reassignment...")
        req = review_queue.assign_request(req_id, "specialist_reviewer", db, performed_by="admin")
        assert req.assigned_reviewer == "specialist_reviewer"
        
        # Check audit trail
        trail = db.query(ApprovalAuditTrail).filter(
            ApprovalAuditTrail.approval_request_id == req_id,
            ApprovalAuditTrail.action == "reassigned"
        ).first()
        assert trail is not None
        assert "specialist_reviewer" in trail.comments
        print("✔ Reassignment and audit trail logged.")

        # Test 4: Escalation
        print("4. Testing escalation protocol...")
        req = escalation_manager.escalate(req_id, db, performed_by="system", comments="Timeout reached")
        assert req.status == "escalated"
        assert req.risk_level == "high"
        assert req.assigned_reviewer == "cfo_executive", f"Expected cfo_executive, got {req.assigned_reviewer}"
        print("✔ Escalation reassigned to senior executive successfully.")

        # Test 5: Pause and Resume Workflow Gate
        print("5. Testing Workflow Pause/Resume checkpoint...")
        # Create a mock workflow and run
        from modules.workflow_engine.workflow_manager import workflow_manager
        
        saved_wf = workflow_manager.create_workflow(
            db=db,
            name="Compliance Payment Flow",
            steps=["extract_document", "detect_anomalies", "send_email"]
        )
        
        # Create a dummy Document in the DB so that the extract_document tool succeeds
        from app.models import Document
        doc_id = uuid.uuid4()
        dummy_doc = Document(
            id=doc_id,
            filename="test_invoice.pdf",
            content="invoice total amount: 7500.00 vendor: Acme Corp",
            file_size=200,
            mime_type="application/pdf"
        )
        db.add(dummy_doc)
        db.commit()

        # We invoke execution with a high-value invoice context to trigger approval gate
        run = workflow_manager.trigger_workflow(
            db=db,
            workflow_id=str(saved_wf.id),
            input_context={"amount": 7500.0, "document_id": str(doc_id)}
        )
        
        # Since amount is $7500.0, the workflow should PAUSE on the first step ("extract_document" or "detect_anomalies")
        # In our policy, detect_anomalies evaluates risk. But wait, detect_anomalies has anomaly score or compliance check.
        # Wait, in workflow_executor, we gate after EACH step execution.
        # Let's verify that the run is paused!
        assert run.status == "paused", f"Expected workflow run status 'paused', got '{run.status}'"
        paused_data = run.output_context
        assert paused_data is not None
        app_req_id = uuid.UUID(paused_data["approval_request_id"])
        
        # Check approval request exists
        app_req = db.query(ApprovalRequest).filter(ApprovalRequest.id == app_req_id).first()
        assert app_req is not None
        assert app_req.status == "pending"
        print("✔ Workflow paused successfully at checkpoint gate.")

        # Test 6: Approve and Resume
        print("6. Testing approval review and workflow resume loop...")
        # Approve the request. This should resume the workflow execution!
        approved_req = approval_engine.approve_request(
            request_id=app_req_id,
            reviewer_name="ops_compliance_director",
            comments="Verified supplier ledger details.",
            db=db
        )
        assert approved_req.status == "approved"
        
        # Verify that the workflow has resumed and finished successfully!
        db.refresh(run)
        assert run.status == "success", f"Expected workflow run to finish as 'success' after resume, got '{run.status}'"
        print("✔ Workflow resumed and executed successfully to completion.")

        print("\n🎉 ALL HUMAN REVIEW SYSTEM TESTS PASSED SUCCESSFULLY! 🎉")
    except Exception as e:
        print(f"❌ TEST FAILED: {str(e)}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test_human_review_system()
