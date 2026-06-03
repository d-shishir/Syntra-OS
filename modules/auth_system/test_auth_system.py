import sys
import os

# Ensure root of project and backend are in python path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
backend_path = os.path.join(root_path, "backend")
for path in [root_path, backend_path]:
    if path not in sys.path:
        sys.path.insert(0, path)

from app.database import SessionLocal, engine, Base
from modules.auth_system.models import User, UserSession, SecurityAuditLog
from modules.auth_system.auth_manager import authenticate_user, create_user
from modules.auth_system.jwt_service import create_access_token, verify_token
from modules.auth_system.permission_engine import check_permission, can_override_ai_governance
from modules.auth_system.session_manager import is_session_valid
from modules.auth_system.audit_security import log_security_action

def run_tests():
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Clear existing logs for reproducibility
        db.query(User).delete()
        db.query(UserSession).delete()
        db.query(SecurityAuditLog).delete()
        db.commit()

        print("\n--- 1. Testing Password Hashing & Authentication ---")
        user = create_user(
            db=db,
            name="Alice Finance",
            email="alice@syntra.io",
            password="alicepassword",
            role="finance_manager",
            department="finance"
        )
        assert user is not None
        assert user.role == "finance_manager"
        
        # Test authentications
        success_auth = authenticate_user(db, "alice@syntra.io", "alicepassword")
        assert success_auth is not None
        assert success_auth["user"]["email"] == "alice@syntra.io"
        assert success_auth["access_token"] is not None
        
        bad_auth = authenticate_user(db, "alice@syntra.io", "wrongpassword")
        assert bad_auth is None
        print("✔ Secure password hashing and authentication checks pass successfully.")

        print("\n--- 2. Testing JWT Signing & Decoding ---")
        token = success_auth["access_token"]
        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == str(user.id)
        assert payload["role"] == "finance_manager"
        assert payload["department"] == "finance"
        print("✔ JWT token serialization and validation works correctly.")

        print("\n--- 3. Testing RBAC Rules Enforcement ---")
        # Finance manager can read/approve payroll
        assert check_permission("finance_manager", "finance", "payroll_records", "read") is True
        assert check_permission("finance_manager", "finance", "payroll_records", "approve") is True
        # Finance manager cannot access CRM (which is Sales dept)
        assert check_permission("finance_manager", "finance", "crm_records", "read") is False
        
        # Sales representative can read CRM records, but not payroll
        assert check_permission("sales_rep", "sales", "crm_records", "read") is True
        assert check_permission("sales_rep", "sales", "payroll_records", "read") is False
        print("✔ Fine-grained RBAC and department locks enforce correctly.")

        print("\n--- 4. Testing AI Governance Overrides ---")
        assert can_override_ai_governance("admin") is True
        assert can_override_ai_governance("finance_manager") is True
        assert can_override_ai_governance("sales_rep") is False
        print("✔ AI governance controls correctly restrict overrides to authorized roles.")

        print("\n--- 5. Testing Session Lifecycle & Security Audits ---")
        session_active = is_session_valid(db, success_auth["refresh_token"])
        assert session_active is True
        
        # Check failed logins registered in SecurityAuditLog
        audits = db.query(SecurityAuditLog).filter(
            SecurityAuditLog.action == "failed_login_bad_password"
        ).all()
        assert len(audits) >= 1
        print("✔ Security audit log records trace history logs successfully.")

        # Re-seed default users so we don't leave the DB empty after running tests
        from modules.auth_system.router import seed_default_users
        seed_default_users(db)
        print("✔ Restored default seeded users.")

        print("\n✔ ALL IAM ACCESS SYSTEM TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
