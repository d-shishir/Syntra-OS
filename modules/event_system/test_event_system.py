import sys
import os
import uuid

# Ensure root of project and backend are in python path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
backend_path = os.path.join(root_path, "backend")
for path in [root_path, backend_path]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app.database import SessionLocal, engine, Base
from modules.event_system.models import EventRecord, EventJob, DeadLetterJob
from modules.event_system.event_bus import publish_event
from modules.event_system.event_registry import event_registry
from modules.event_system.job_queue import enqueue_job, fetch_next_job
from modules.event_system.async_worker import register_job_handler, _execute_job
from modules.event_system.event_subscribers import initialize_subscribers
from modules.event_system.job_handlers import initialize_job_handlers
from modules.observability.models import SystemMetric

def run_tests():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Clear existing tables for test reliability
        db.query(EventRecord).delete()
        db.query(EventJob).delete()
        db.query(DeadLetterJob).delete()
        db.commit()

        print("\n--- 1. Testing Event Registry & Custom Subscriber ---")
        subscriber_triggered = False
        def custom_subscriber(event, db_session):
            nonlocal subscriber_triggered
            subscriber_triggered = True
            print(f"Subscriber callback triggered for event: {event.event_type} with payload {event.payload}")
            assert event.payload["test_key"] == "test_val"

        event_registry.subscribe("test_event_type", custom_subscriber)
        
        # Publish event
        event = publish_event(db, "test_event_type", "test_module", {"test_key": "test_val"}, "high")
        
        # Wait for background dispatch to finish
        import time
        retries = 20
        while not subscriber_triggered and retries > 0:
            time.sleep(0.05)
            retries -= 1

        assert subscriber_triggered, "Subscriber did not trigger!"
        print("✔ Event published and code-level subscribers triggered correctly.")

        print("\n--- 2. Testing Observability Metric Ingest ---")
        metric = db.query(SystemMetric).filter(
            SystemMetric.metric_name == "event_published_count",
            SystemMetric.module == "test_module"
        ).first()
        assert metric is not None, "Observability metric not written!"
        print("✔ Event metrics tracked properly in Observability module.")

        print("\n--- 3. Testing Priority Queuing ---")
        # Enqueue low, critical, and high priority jobs
        job_low = enqueue_job(db, "test_job", {"id": 1}, priority="low")
        job_critical = enqueue_job(db, "test_job", {"id": 2}, priority="critical")
        job_high = enqueue_job(db, "test_job", {"id": 3}, priority="high")

        # Pull next job: should be critical, then high, then low
        first_job = fetch_next_job(db)
        assert first_job.id == job_critical.id, "Expected critical job first"
        first_job.status = "processing"
        db.commit()

        second_job = fetch_next_job(db)
        assert second_job.id == job_high.id, "Expected high job second"
        second_job.status = "processing"
        db.commit()

        third_job = fetch_next_job(db)
        assert third_job.id == job_low.id, "Expected low job third"
        print("✔ Priority queue scheduling works correctly.")

        # Clean jobs for worker testing
        db.query(EventJob).delete()
        db.commit()

        print("\n--- 4. Testing Async Worker Execution ---")
        job_run = False
        def test_job_handler(payload, db_session):
            nonlocal job_run
            job_run = True
            print(f"Executing job handler with payload: {payload}")
            assert payload["task"] == "verify_worker"

        register_job_handler("verify_worker_task", test_job_handler)

        job = enqueue_job(db, "verify_worker_task", {"task": "verify_worker"})
        _execute_job(job.id)

        # Refresh job state
        db.refresh(job)
        assert job.status == "completed", f"Expected job completed, got: {job.status}"
        assert job_run, "Job handler did not execute!"
        print("✔ Async job executed and completed successfully.")

        print("\n--- 5. Testing Retries and Dead Letter Queue ---")
        fail_attempts = 0
        def flakey_job_handler(payload, db_session):
            nonlocal fail_attempts
            fail_attempts += 1
            raise ValueError(f"Simulated handler execution failure count: {fail_attempts}")

        register_job_handler("flakey_job_task", flakey_job_handler)
        
        # Max retries = 2
        f_job = enqueue_job(db, "flakey_job_task", {"foo": "bar"}, max_retries=2)
        
        # Run attempt 1
        _execute_job(f_job.id)
        db.refresh(f_job)
        assert f_job.status == "queued"
        assert f_job.retry_count == 1
        
        # Clear next retry delay for instant processing during test
        f_job.next_retry_at = None
        db.commit()

        # Run attempt 2 (retry 1)
        _execute_job(f_job.id)
        db.refresh(f_job)
        assert f_job.status == "queued"
        assert f_job.retry_count == 2
        
        f_job.next_retry_at = None
        db.commit()

        # Run attempt 3 (retry 2 - goes over max_retries limit)
        _execute_job(f_job.id)
        db.refresh(f_job)
        
        assert f_job.status == "dead_letter", f"Expected dead_letter status, got {f_job.status}"
        
        # Check DLQ entry
        dlq_entry = db.query(DeadLetterJob).filter(DeadLetterJob.job_id == f_job.id).first()
        assert dlq_entry is not None
        assert "Simulated handler execution failure" in dlq_entry.error_message
        print("✔ Exponential backoff retries and Dead Letter Queue capturing work successfully.")

        print("\n--- 6. Testing End-to-End Cascade via Subscribers ---")
        # Initialize default subscribers/handlers
        initialize_subscribers()
        initialize_job_handlers()

        # Publish invoice_uploaded event -> triggers handle_invoice_uploaded -> enqueues invoice_ai_extraction job
        invoice_event = publish_event(db, "invoice_uploaded", "test_agent", {"document_id": "doc-999"}, "high")
        
        # Verify the job is enqueued (with poll waiting)
        import time
        triggered_job = None
        retries = 20
        while retries > 0:
            triggered_job = db.query(EventJob).filter(
                EventJob.event_id == invoice_event.id,
                EventJob.job_type == "invoice_ai_extraction"
            ).first()
            if triggered_job is not None:
                break
            time.sleep(0.05)
            db.rollback()  # Clear identity map cache so it fetches fresh DB state
            retries -= 1

        assert triggered_job is not None
        print("✔ Event-driven pipeline cascade triggers subscribers and enqueues jobs successfully.")

        print("\n✔ ALL EVENT SYSTEM TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
