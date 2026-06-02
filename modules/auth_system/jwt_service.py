import base64
import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

try:
    from backend.app.config import settings
    SECRET_KEY = getattr(settings, "SECRET_KEY", "syntra_os_super_secure_enterprise_secret_key_12345")
except ImportError:
    import os
    SECRET_KEY = os.getenv("SECRET_KEY", "syntra_os_super_secure_enterprise_secret_key_12345")

def _base64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').replace('=', '')

def _base64_decode(data: str) -> bytes:
    padded = data + '=' * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Generates a standard HS256 signed JWT access token.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    
    payload = data.copy()
    now = datetime.utcnow()
    payload["iat"] = int(now.timestamp())
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=30)
    payload["exp"] = int(expire.timestamp())
    
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    
    header_b64 = _base64_encode(header_json)
    payload_b64 = _base64_encode(payload_json)
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def verify_token(token: str) -> dict | None:
    """
    Decodes and verifies a JWT token. Returns payload dict if valid, else None.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
            
        header_b64, payload_b64, signature_b64 = parts
        
        # Verify signature
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        expected_sig_b64 = _base64_encode(expected_sig)
        
        # Constant-time comparison
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            logger.warning("JWT Service: Token signature mismatch.")
            return None
            
        # Parse payload
        payload_bytes = _base64_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Verify expiration
        exp = payload.get("exp")
        if exp and exp < int(datetime.utcnow().timestamp()):
            logger.warning("JWT Service: Token has expired.")
            return None
            
        return payload
    except Exception as e:
        logger.error(f"JWT Service: Verification failed with exception: {str(e)}")
        return None
