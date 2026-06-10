import logging
import base64
import datetime
import hashlib
import os
from typing import Dict, Optional
from cryptography.fernet import Fernet
from app.database import Base, engine, SessionLocal
from modules.integrations.models import VaultSecret

logger = logging.getLogger(__name__)

# Auto-create table for VaultSecret
Base.metadata.create_all(bind=engine)

# Simulated audit logs
_audit_logs = []

def _get_fernet_key() -> bytes:
    # Try environment variable or settings
    key_str = os.getenv("VAULT_ENCRYPTION_KEY")
    if not key_str:
        try:
            from app.config import settings
            key_str = getattr(settings, "VAULT_ENCRYPTION_KEY", None)
            if not key_str:
                key_str = getattr(settings, "SECRET_KEY", None)
        except ImportError:
            key_str = os.getenv("SECRET_KEY")
            
    if not key_str:
        key_str = "syntra_os_super_secure_enterprise_secret_key_12345"
        
    hashed = hashlib.sha256(key_str.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(hashed)

def _encrypt(text: str) -> bytes:
    key = _get_fernet_key()
    fernet = Fernet(key)
    return fernet.encrypt(text.encode("utf-8"))

def _decrypt(data: bytes) -> str:
    key = _get_fernet_key()
    fernet = Fernet(key)
    return fernet.decrypt(data).decode("utf-8")

def _obfuscate(text: str) -> bytes:
    return _encrypt(text)

def _deobfuscate(data: bytes) -> str:
    return _decrypt(data)

def log_vault_access(user_id: str, action: str, resource: str, status: str):
    log_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "status": status
    }
    _audit_logs.append(log_entry)
    logger.info(f"Credential Vault: [{status.upper()}] User '{user_id}' performed '{action}' on '{resource}'")

def store_secret(user_id: str, connector_key: str, secret: str, db=None) -> bool:
    """
    Encrypts and stores a connection credential.
    """
    db_created = False
    if db is None:
        db = SessionLocal()
        db_created = True
    try:
        encrypted_value = _encrypt(secret)
        existing = db.query(VaultSecret).filter(VaultSecret.connector_key == connector_key).first()
        if existing:
            existing.encrypted_value = encrypted_value
        else:
            new_secret = VaultSecret(connector_key=connector_key, encrypted_value=encrypted_value)
            db.add(new_secret)
        db.commit()
        log_vault_access(user_id, "store_secret", f"connector:{connector_key}", "success")
        return True
    except Exception as e:
        if db_created:
            db.rollback()
        logger.error(f"Vault failed to store secret: {str(e)}")
        log_vault_access(user_id, "store_secret", f"connector:{connector_key}", f"failed: {str(e)}")
        return False
    finally:
        if db_created:
            db.close()

def get_secret(user_id: str, user_role: str, connector_key: str, db=None) -> Optional[str]:
    """
    Decrypts and retrieves a secret. Enforces RBAC clearance check.
    """
    # Enforce RBAC validation
    allowed_roles = ["admin", "finance_manager", "compliance_officer"]
    if user_role not in allowed_roles:
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "denied")
        return None

    db_created = False
    if db is None:
        db = SessionLocal()
        db_created = True
    try:
        secret_record = db.query(VaultSecret).filter(VaultSecret.connector_key == connector_key).first()
        if not secret_record:
            log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "not_found")
            return None
        cleartext = _decrypt(secret_record.encrypted_value)
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "success")
        return cleartext
    except Exception as e:
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", f"failed_decrypt: {str(e)}")
        return None
    finally:
        if db_created:
            db.close()

def delete_secret(user_id: str, connector_key: str, db=None):
    db_created = False
    if db is None:
        db = SessionLocal()
        db_created = True
    try:
        secret_record = db.query(VaultSecret).filter(VaultSecret.connector_key == connector_key).first()
        if secret_record:
            db.delete(secret_record)
            db.commit()
            log_vault_access(user_id, "delete_secret", f"connector:{connector_key}", "success")
    except Exception as e:
        if db_created:
            db.rollback()
        logger.error(f"Vault failed to delete secret: {str(e)}")
        log_vault_access(user_id, "delete_secret", f"connector:{connector_key}", f"failed: {str(e)}")
    finally:
        if db_created:
            db.close()

def get_vault_audit_logs(user_role: str):
    if user_role not in ["admin", "compliance_officer"]:
        return []
    return _audit_logs
