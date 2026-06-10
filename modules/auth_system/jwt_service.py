import logging
import jwt
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

try:
    from app.config import settings
    SECRET_KEY = getattr(settings, "SECRET_KEY", "syntra_os_super_secure_enterprise_secret_key_12345")
except ImportError:
    import os
    SECRET_KEY = os.getenv("SECRET_KEY", "syntra_os_super_secure_enterprise_secret_key_12345")

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Generates a standard HS256 signed JWT access token.
    """
    payload = data.copy()
    now_ts = int(time.time())
    payload["iat"] = now_ts
    
    if expires_delta:
        expire_ts = now_ts + int(expires_delta.total_seconds())
    else:
        expire_ts = now_ts + 30 * 60
    payload["exp"] = expire_ts
    
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token(token: str) -> dict | None:
    """
    Decodes and verifies a JWT token. Returns payload dict if valid, else None.
    """
    try:
        # Decode and verify token. Standardize to algorithms=['HS256'] to prevent alg-none attack.
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT Service: Token has expired.")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT Service: Token validation failed: {str(e)}")
        return None
