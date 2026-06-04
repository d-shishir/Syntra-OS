import logging
import base64
import datetime
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Simulated secure vault storage
_vault_storage: Dict[str, bytes] = {}
# Simulated audit logs
_audit_logs = []

def _obfuscate(text: str) -> bytes:
    # Symm key XOR obfuscation
    key = b"SYNTRA_SECRET_KEY"
    text_bytes = text.encode("utf-8")
    obfuscated = bytearray(len(text_bytes))
    for i in range(len(text_bytes)):
        obfuscated[i] = text_bytes[i] ^ key[i % len(key)]
    return bytes(obfuscated)

def _deobfuscate(data: bytes) -> str:
    key = b"SYNTRA_SECRET_KEY"
    decrypted = bytearray(len(data))
    for i in range(len(data)):
        decrypted[i] = data[i] ^ key[i % len(key)]
    return decrypted.decode("utf-8")

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

def store_secret(user_id: str, connector_key: str, secret: str) -> bool:
    """
    Encrypts and stores a connection credential.
    """
    try:
        obfuscated = _obfuscate(secret)
        _vault_storage[connector_key] = obfuscated
        log_vault_access(user_id, "store_secret", f"connector:{connector_key}", "success")
        return True
    except Exception as e:
        logger.error(f"Vault failed to store secret: {str(e)}")
        log_vault_access(user_id, "store_secret", f"connector:{connector_key}", f"failed: {str(e)}")
        return False

def get_secret(user_id: str, user_role: str, connector_key: str) -> Optional[str]:
    """
    Decrypts and retrieves a secret. Enforces RBAC clearance check.
    """
    # Enforce RBAC validation
    allowed_roles = ["admin", "finance_manager", "compliance_officer"]
    if user_role not in allowed_roles:
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "denied")
        return None

    if connector_key not in _vault_storage:
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "not_found")
        return None

    try:
        obfuscated = _vault_storage[connector_key]
        cleartext = _deobfuscate(obfuscated)
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", "success")
        return cleartext
    except Exception as e:
        log_vault_access(user_id, "retrieve_secret", f"connector:{connector_key}", f"failed_decrypt: {str(e)}")
        return None

def delete_secret(user_id: str, connector_key: str):
    if connector_key in _vault_storage:
        del _vault_storage[connector_key]
        log_vault_access(user_id, "delete_secret", f"connector:{connector_key}", "success")

def get_vault_audit_logs(user_role: str):
    if user_role not in ["admin", "compliance_officer"]:
        return []
    return _audit_logs
