import secrets
import hashlib
import uuid
from fastapi import Header, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from modules.api_gateway.models import ApiKey
from modules.auth_system.models import User
from modules.organizations.tenant_engine import TenantContext

def generate_api_key() -> str:
    """Generates a secure API key string."""
    random_part = secrets.token_hex(24)
    return f"sy_live_{random_part}"

def hash_key(key: str) -> str:
    """Hashes the API key using SHA-256."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

def get_api_key_context(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> ApiKey:
    """
    Validates the API key from the Authorization header (Bearer token or raw key).
    Returns the ApiKey instance.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing."
        )

    # Clean bearer token prefix if present
    token = authorization
    if authorization.lower().startswith("bearer "):
        token = authorization[7:]

    hashed = hash_key(token)
    api_key = db.query(ApiKey).filter(ApiKey.key_hash == hashed, ApiKey.is_active == True).first()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key."
        )

    return api_key

def enforce_api_scope(required_scope: str):
    """
    FastAPI dependency factory to enforce specific API key scopes.
    """
    def check_scope(api_key: ApiKey = Depends(get_api_key_context)):
        if required_scope not in api_key.scopes and "*" not in api_key.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden. Missing required scope: {required_scope}"
            )
        return api_key
    return check_scope
