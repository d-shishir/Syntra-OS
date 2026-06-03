import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.models import User, UserSession, SecurityAuditLog
from modules.auth_system.auth_manager import authenticate_user, create_user
from modules.auth_system.session_manager import invalidate_session, invalidate_all_user_sessions
from modules.auth_system.access_policies import get_current_user, PermissionGuard
from modules.auth_system.jwt_service import create_access_token
from modules.auth_system.audit_security import log_security_action

router = APIRouter()
logger = logging.getLogger(__name__)

def seed_default_users(db: Session):
    """
    Seeds default user credentials to ease testing.
    """
    default_users = [
        {"name": "Admin Director", "email": "admin@syntra.io", "password": "adminpassword", "role": "admin", "department": "system"},
        {"name": "Finance Specialist", "email": "finance@syntra.io", "password": "financepassword", "role": "finance_manager", "department": "finance"},
        {"name": "Sales Specialist", "email": "sales@syntra.io", "password": "salespassword", "role": "sales_rep", "department": "sales"},
        {"name": "Compliance Specialist", "email": "compliance@syntra.io", "password": "compliancepassword", "role": "compliance_officer", "department": "compliance"}
    ]
    for u_data in default_users:
        existing = db.query(User).filter(User.email == u_data["email"]).first()
        if not existing:
            create_user(
                db=db,
                name=u_data["name"],
                email=u_data["email"],
                password=u_data["password"],
                role=u_data["role"],
                department=u_data["department"]
            )
            logger.info(f"Auth System: Seeded default user '{u_data['email']}' (Role: {u_data['role']})")

@router.post("/login")
def login(payload: dict, request: Request, db: Session = Depends(get_db)):
    # Ensure default users are seeded in the DB
    seed_default_users(db)
    
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password are required.")
    
    ip_addr = request.client.host if request.client else None
    result = authenticate_user(db, email, password, ip_addr)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    return result

@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ip_addr = request.client.host if request.client else None
    invalidate_all_user_sessions(db, str(current_user.id))
    log_security_action(db, str(current_user.id), "logout", "user_session", "success", ip_addr)
    return {"status": "success", "message": "Successfully logged out from all devices."}

@router.post("/refresh")
def refresh_token(payload: dict, db: Session = Depends(get_db)):
    refresh_token_str = payload.get("refresh_token")
    if not refresh_token_str:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Refresh token is required.")

    from modules.auth_system.session_manager import is_session_valid
    if not is_session_valid(db, refresh_token_str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session refresh token.")

    session = db.query(UserSession).filter(UserSession.refresh_token == refresh_token_str).first()
    user = db.query(User).filter(User.id == session.user_id).first()
    
    new_access_token = create_access_token({"sub": str(user.id), "role": user.role, "department": user.department})
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }

@router.get("/users")
def get_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrator accounts can view user directory.")
    users = db.query(User).all()
    return [u.to_dict() for u in users]

@router.post("/permissions/assign")
def assign_role_status(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can modify user security roles.")
        
    user_id = payload.get("user_id")
    new_role = payload.get("role")
    new_status = payload.get("status")
    
    import uuid
    try:
        u_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid User ID format")

    user = db.query(User).filter(User.id == u_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if new_role:
        user.role = new_role
    if new_status:
        user.status = new_status
        
    db.commit()
    log_security_action(db, str(current_user.id), "perm_change", f"user:{user.id}", "success")
    return {"status": "success", "user": user.to_dict()}

@router.get("/audit/security")
def get_security_audit(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in ["admin", "compliance_officer"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. You lack compliance auditing rights.")
    logs = db.query(SecurityAuditLog).order_by(SecurityAuditLog.timestamp.desc()).limit(100).all()
    return [l.to_dict() for l in logs]
