import sys
import os

# Ensure workspace root is in sys.path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# Ensure app is in sys.path
sys.path.insert(0, os.path.join(root_path, "backend"))

from app.database import SessionLocal
from modules.auth_system.models import User
from modules.auth_system.auth_manager import hash_password, create_user

def check_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Total users found: {len(users)}")
        for u in users:
            print(f"- ID: {u.id}, Name: {u.name}, Email: {u.email}, Role: {u.role}, Status: {u.status}")
            
        # Let's reset the default users passwords to ensure they are hashed correctly
        default_users = [
            {"email": "admin@syntra.io", "password": "adminpassword", "name": "Admin Director", "role": "admin", "department": "system"},
            {"email": "finance@syntra.io", "password": "financepassword", "name": "Finance Specialist", "role": "finance_manager", "department": "finance"},
            {"email": "sales@syntra.io", "password": "salespassword", "name": "Sales Specialist", "role": "sales_rep", "department": "sales"},
            {"email": "compliance@syntra.io", "password": "compliancepassword", "name": "Compliance Specialist", "role": "compliance_officer", "department": "compliance"}
        ]
        for du in default_users:
            u = db.query(User).filter(User.email == du["email"]).first()
            if u:
                u.password_hash = hash_password(du["password"])
                u.status = "active"
                db.commit()
                print(f"Reset password for {du['email']}")
            else:
                create_user(db, du["name"], du["email"], du["password"], du["role"], du["department"])
                print(f"Created missing user {du['email']}")
    except Exception as e:
        print(f"Error checking/resetting users: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_users()
