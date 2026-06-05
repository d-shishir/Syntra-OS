import time
from fastapi import Request, HTTPException, Depends, status
from modules.api_gateway.auth_middleware import get_api_key_context
from modules.api_gateway.models import ApiKey

# Dictionary to hold request records: { identifier: [timestamps] }
_request_records = {}

# Rate limit configs (requests, window_seconds)
LIMITS = {
    "api_key_default": (100, 60), # 100 requests per minute
    "ip_default": (200, 60),      # 200 requests per minute
}

def clean_old_requests(identifier: str, window: int):
    """Prunes timestamps older than the window."""
    now = time.time()
    if identifier in _request_records:
        _request_records[identifier] = [t for t in _request_records[identifier] if now - t < window]

def check_rate_limit(identifier: str, limit: int, window: int) -> bool:
    """
    Validates if a request violates rate limits.
    Returns True if allowed, False if throttled.
    """
    clean_old_requests(identifier, window)
    now = time.time()
    
    if identifier not in _request_records:
        _request_records[identifier] = []
        
    if len(_request_records[identifier]) >= limit:
        return False
        
    _request_records[identifier].append(now)
    return True

def enforce_key_rate_limit(
    request: Request,
    api_key: ApiKey = Depends(get_api_key_context)
):
    """
    Throttles request rate by Api Key.
    """
    key_id = str(api_key.id)
    limit, window = LIMITS["api_key_default"]
    
    if not check_rate_limit(key_id, limit, window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many requests for this API key."
        )

def enforce_ip_rate_limit(request: Request):
    """
    Throttles request rate by IP address.
    """
    ip = request.client.host if request.client else "unknown"
    limit, window = LIMITS["ip_default"]
    
    if not check_rate_limit(ip, limit, window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many requests from this IP address."
        )
