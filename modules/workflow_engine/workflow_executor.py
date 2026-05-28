import time
import logging
from sqlalchemy.orm import Session
from .workflow_logger import WorkflowLogger
from .task_router import TaskRouter
from .retry_handler import RetryHandler
from .models import WorkflowRun

logger = logging.getLogger(__name__)

class WorkflowExecutor:
    def __init__(self, max_retries: int = 3, backoff_factor: float = 0.5):
        self.router = TaskRouter()
        self.retry_handler = RetryHandler(max_retries=max_retries, backoff_factor=backoff_factor)

    def execute_workflow(
        self,
        db: Session,
        workflow_name: str,
        steps: list[str],
        input_context: dict,
        workflow_id: str | None = None
    ) -> WorkflowRun:
        """
        Executes a workflow pipeline step-by-step.
        """
        # 1. Initialize the run log
        run = WorkflowLogger.start_run(db, workflow_name, workflow_id, input_context)
        context = input_context.copy()
        
        logger.info(f"Starting execution of workflow '{workflow_name}' (Run ID: {run.id})")
        
        current_status = "success"
        run_error = None
        
        # Wrapper to rollback database transaction on step failure
        def run_step_with_rollback(db_session, step_name, run_context):
            try:
                # Run the actual tool
                return self.router.route_and_execute(db_session, step_name, run_context)
            except Exception as e:
                logger.warning(f"Step '{step_name}' failed database operation. Rolling back transaction: {str(e)}")
                db_session.rollback()
                raise e

        try:
            for idx, step in enumerate(steps):
                logger.info(f"Processing step '{step}' in workflow run {run.id}")
                start_time = time.perf_counter()
                
                # Use retry handler to run the step
                result, attempts, err_msg = self.retry_handler.execute_with_retry(
                    step,
                    run_step_with_rollback,
                    db,
                    step,
                    context
                )
                
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                if err_msg:
                    # Step failed after all retries
                    logger.error(f"Step '{step}' failed in run {run.id}: {err_msg}")
                    try:
                        WorkflowLogger.log_step(
                            db=db,
                            run_id=str(run.id),
                            step_name=step,
                            status="failed",
                            input_data=context,
                            output_data=None,
                            execution_time_ms=duration_ms,
                            retry_count=attempts,
                            error=err_msg
                        )
                    except Exception as log_err:
                        logger.error(f"Failed to write step log to database: {str(log_err)}")
                        db.rollback()
                        
                    current_status = "failed"
                    run_error = f"Step '{step}' failed: {err_msg}"
                    break
                else:
                    # Step succeeded
                    logger.info(f"Step '{step}' succeeded in run {run.id}")
                    
                    # Merge step output back into context for downstream steps
                    if isinstance(result, dict):
                        context.update(result)
                    
                    try:
                        WorkflowLogger.log_step(
                            db=db,
                            run_id=str(run.id),
                            step_name=step,
                            status="success",
                            input_data=context,
                            output_data=result,
                            execution_time_ms=duration_ms,
                            retry_count=attempts
                        )
                    except Exception as log_err:
                        logger.error(f"Failed to write step log to database: {str(log_err)}")
                        db.rollback()

                    # Check if human review approval gate is required
                    from modules.human_review_system.approval_engine import approval_engine
                    
                    already_approved = approval_engine.is_step_approved(db, str(run.id), step)
                    if not already_approved:
                        gate_res = approval_engine.evaluate_and_gate_task(
                            task_type=step,
                            context=context,
                            db=db,
                            workflow_run_id=run.id,
                            generated_by="workflow"
                        )
                        if gate_res.get("needs_approval"):
                            run.status = "paused"
                            run.output_context = {
                                "remaining_steps": steps[idx + 1:],
                                "current_context": context,
                                "paused_at_step": step,
                                "approval_request_id": str(gate_res["request_id"])
                            }
                            db.commit()
                            logger.info(f"Workflow run {run.id} PAUSED for approval review at step '{step}'")
                            return run
        except Exception as execution_err:
            logger.exception(f"Unhandled error during workflow execution: {str(execution_err)}")
            db.rollback()
            current_status = "failed"
            run_error = f"Unhandled execution error: {str(execution_err)}"

        # 2. Finalize the run log
        try:
            completed_run = WorkflowLogger.complete_run(db, str(run.id), current_status, context, run_error)
            return completed_run
        except Exception as final_err:
            logger.error(f"Failed to complete workflow run logging: {str(final_err)}")
            db.rollback()
            # Try once more with a rolled-back session to mark as failed
            try:
                run.status = "failed"
                run.error = f"Failed to log completion: {str(final_err)}"
                db.commit()
            except:
                pass
            return run

    def resume_workflow(self, db: Session, run_id: str) -> WorkflowRun:
        """
        Resumes a paused workflow run, executing the remaining steps.
        """
        import uuid
        run = db.query(WorkflowRun).filter(WorkflowRun.id == uuid.UUID(run_id)).first()
        if not run or run.status != "paused":
            logger.warning(f"Workflow run {run_id} is not paused. Cannot resume.")
            return run

        # Set status back to running
        run.status = "running"
        db.commit()

        # Retrieve paused context and remaining steps
        paused_data = run.output_context or {}
        remaining_steps = paused_data.get("remaining_steps", [])
        context = paused_data.get("current_context", run.input_context).copy()

        logger.info(f"Resuming workflow run {run.id} with steps: {remaining_steps}")

        current_status = "success"
        run_error = None

        def run_step_with_rollback(db_session, step_name, run_context):
            try:
                return self.router.route_and_execute(db_session, step_name, run_context)
            except Exception as e:
                db_session.rollback()
                raise e

        try:
            for idx, step in enumerate(remaining_steps):
                logger.info(f"Processing resumed step '{step}' in workflow run {run.id}")
                start_time = time.perf_counter()
                
                result, attempts, err_msg = self.retry_handler.execute_with_retry(
                    step,
                    run_step_with_rollback,
                    db,
                    step,
                    context
                )
                
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                if err_msg:
                    logger.error(f"Step '{step}' failed in run {run.id}: {err_msg}")
                    WorkflowLogger.log_step(
                        db=db,
                        run_id=str(run.id),
                        step_name=step,
                        status="failed",
                        input_data=context,
                        output_data=None,
                        execution_time_ms=duration_ms,
                        retry_count=attempts,
                        error=err_msg
                    )
                    current_status = "failed"
                    run_error = f"Step '{step}' failed: {err_msg}"
                    break
                else:
                    logger.info(f"Step '{step}' succeeded in run {run.id}")
                    if isinstance(result, dict):
                        context.update(result)
                    
                    WorkflowLogger.log_step(
                        db=db,
                        run_id=str(run.id),
                        step_name=step,
                        status="success",
                        input_data=context,
                        output_data=result,
                        execution_time_ms=duration_ms,
                        retry_count=attempts
                    )

                    # Check approval gate again
                    from modules.human_review_system.approval_engine import approval_engine
                    already_approved = approval_engine.is_step_approved(db, str(run.id), step)
                    if not already_approved:
                        gate_res = approval_engine.evaluate_and_gate_task(
                            task_type=step,
                            context=context,
                            db=db,
                            workflow_run_id=run.id,
                            generated_by="workflow"
                        )
                        if gate_res.get("needs_approval"):
                            run.status = "paused"
                            run.output_context = {
                                "remaining_steps": remaining_steps[idx + 1:],
                                "current_context": context,
                                "paused_at_step": step,
                                "approval_request_id": str(gate_res["request_id"])
                            }
                            db.commit()
                            return run
        except Exception as execution_err:
            logger.exception(f"Unhandled error during workflow resume: {str(execution_err)}")
            db.rollback()
            current_status = "failed"
            run_error = f"Unhandled execution error: {str(execution_err)}"

        WorkflowLogger.complete_run(db, str(run.id), current_status, context, run_error)
        return run
