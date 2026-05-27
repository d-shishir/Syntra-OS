import sys
import os

# Ensure workspace root is in sys.path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from modules.background_worker.test_worker import (
    setup_db, test_task_success_execution, test_task_retry_and_failure_flow
)

if __name__ == "__main__":
    print("Running background worker tests...")
    
    # Run test 1
    teardown = setup_db()
    try:
        test_task_success_execution()
        print("✅ test_task_success_execution passed")
    finally:
        teardown()
            
    # Run test 2
    teardown = setup_db()
    try:
        test_task_retry_and_failure_flow()
        print("✅ test_task_retry_and_failure_flow passed")
    finally:
        teardown()
            
    print("All tests completed successfully!")
