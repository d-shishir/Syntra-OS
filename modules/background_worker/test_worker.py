import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from .models import BackgroundTaskJob
from .worker_engine import register_handler, _run_job, start_worker, stop_worker

# Use temporary memory database for tests
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Mock handler state tracking
mock_runs = []
fail_runs = 0

def mock_success_handler(payload: dict, db):
    mock_runs.append(payload)

def mock_failure_handler(payload: dict, db):
    global fail_runs
    fail_runs += 1
    raise RuntimeError("Simulated task exception")

def setup_db():
    Base.metadata.create_all(bind=engine)
    # Patch SessionLocal inside worker_engine to use our testing engine
    import modules.background_worker.worker_engine as we
    original_session = we.SessionLocal
    we.SessionLocal = TestingSessionLocal
    
    def teardown():
        Base.metadata.drop_all(bind=engine)
        we.SessionLocal = original_session
        
    return teardown

def test_task_success_execution():
    db = TestingSessionLocal()
    register_handler("test_success_task", mock_success_handler)
    
    # 1. Enqueue job
    job = BackgroundTaskJob(
        task_type="test_success_task",
        payload={"param": "hello_world"}
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    assert job.status == "pending"
    
    # 2. Trigger worker run
    _run_job(job.id)
    
    db.refresh(job)
    assert job.status == "completed"
    assert job.completed_at is not None
    assert len(mock_runs) == 1
    assert mock_runs[0] == {"param": "hello_world"}
    db.close()

def test_task_retry_and_failure_flow():
    global fail_runs
    fail_runs = 0
    db = TestingSessionLocal()
    register_handler("test_failure_task", mock_failure_handler)
    
    # 1. Enqueue job with max_retries = 2
    job = BackgroundTaskJob(
        task_type="test_failure_task",
        payload={"data": "test_failure"},
        max_retries=2
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    # 2. Trigger first run -> should retry
    _run_job(job.id)
    db.refresh(job)
    
    assert job.status == "pending"  # status reset to pending for retry
    assert job.retry_count == 1
    assert fail_runs == 1
    
    # 3. Trigger second run -> should fail permanently (hits max_retries 2)
    _run_job(job.id)
    db.refresh(job)
    
    assert job.status == "failed"
    assert job.retry_count == 2
    assert "Simulated task exception" in job.error_message
    assert fail_runs == 2
    db.close()
