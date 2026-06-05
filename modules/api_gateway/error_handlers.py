import uuid
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)

class SyntraException(Exception):
    """Base exception for all custom Syntra OS errors."""
    def __init__(self, error_code: str, message: str, module: str, severity: str = "High", status_code: int = 400):
        self.error_code = error_code
        self.message = message
        self.module = module
        self.severity = severity
        self.status_code = status_code
        super().__init__(self.message)

def register_error_handlers(app):
    """
    Registers global exception handler overrides in FastAPI application.
    """
    @app.exception_handler(SyntraException)
    async def syntra_exception_handler(request: Request, exc: SyntraException):
        trace_id = str(uuid.uuid4())
        logger.error(f"[{exc.module}] {exc.error_code} (Severity: {exc.severity}, Trace: {trace_id}): {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": exc.error_code,
                "message": exc.message,
                "module": exc.module,
                "severity": exc.severity,
                "trace_id": trace_id
            }
        )

    @app.exception_handler(HTTPException)
    async def fastapi_http_exception_handler(request: Request, exc: HTTPException):
        trace_id = str(uuid.uuid4())
        logger.error(f"[FastAPI HTTP] (Trace: {trace_id}): Status {exc.status_code} - {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": "FASTAPI_HTTP_ERROR",
                "message": str(exc.detail),
                "module": "FastAPI",
                "severity": "Medium" if exc.status_code < 500 else "High",
                "trace_id": trace_id
            }
        )

    @app.exception_handler(SQLAlchemyError)
    async def database_exception_handler(request: Request, exc: SQLAlchemyError):
        trace_id = str(uuid.uuid4())
        logger.critical(f"[Database Critical] (Trace: {trace_id}): {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "DATABASE_TRANSACTION_FAILED",
                "message": "A critical database persistence operation failed.",
                "module": "Database Engine",
                "severity": "Critical",
                "trace_id": trace_id
            }
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        trace_id = str(uuid.uuid4())
        logger.critical(f"[System Unhandled] (Trace: {trace_id}): {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error_code": "SYSTEM_UNHANDLED_CRASH",
                "message": "An unexpected server crash occurred.",
                "module": "System Core",
                "severity": "Critical",
                "trace_id": trace_id
            }
        )
