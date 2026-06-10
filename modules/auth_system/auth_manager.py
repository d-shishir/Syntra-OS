import hmac
import hashlib
import secrets
import logging
import bcrypt
from sqlalchemy.orm import Session
from modules.auth_system.models import User
from modules.auth_system.jwt_service import create_access_token
from modules.auth_system.session_manager import create_session
from modules.auth_system.audit_security import log_security_action

logger = logging.getLogger(__name__)

def hash_password(password: str) -> str:
    """
    Hashes a password using the secure bcrypt scheme.
    """
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies a password against a hash, falling back to legacy PBKDF2 for compatibility.
    """
    try:
        # Check if the hash is in our custom legacy pbkdf2 format (contains exactly one '$' and doesn't start with '$')
        is_legacy = hashed_password.count('$') == 1 and not hashed_password.startswith('$')
        if is_legacy:
            salt, key_hex = hashed_password.split('$')
            key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
            return hmac.compare_digest(key.hex(), key_hex)
        
        # Verify using bcrypt
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.warning(f"Password verification failed: {str(e)}")
        return False

def authenticate_user(db: Session, email: str, password: str, ip_address: str | None = None) -> dict | None:
    """
    Authenticates a user, logs security action, and returns Access and Refresh tokens.
    """
    user = db.query(User).filter(User.email == email).first()
    if not user:
        log_security_action(db, email, "failed_login", "user_account", "denied", ip_address)
        return None

    if user.status == "suspended":
        log_security_action(db, str(user.id), "failed_login_suspended", "user_account", "denied", ip_address)
        return None

    if not verify_password(password, user.password_hash):
        log_security_action(db, str(user.id), "failed_login_bad_password", "user_account", "denied", ip_address)
        return None

    # Authentication Success
    access_token = create_access_token({"sub": str(user.id), "role": user.role, "department": user.department})
    refresh_token = secrets.token_hex(32)
    
    create_session(db, str(user.id), refresh_token, ip_address)
    log_security_action(db, str(user.id), "login", "user_session", "success", ip_address)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user.to_dict()
    }

def create_user(db: Session, name: str, email: str, password: str, role: str, department: str) -> User:
    """
    Creates a new user account with hashed password.
    """
    pwd_hash = hash_password(password)
    user = User(
        name=name,
        email=email,
        password_hash=pwd_hash,
        role=role,
        department=department,
        status="active"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
