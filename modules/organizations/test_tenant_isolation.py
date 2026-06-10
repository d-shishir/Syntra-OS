import sys
import os
import uuid
import pytest
import httpx
from fastapi.testclient import TestClient

# Ensure root paths are in sys.path
dir_path = os.path.dirname(os.path.abspath(__file__))
root_path = os.path.abspath(os.path.join(dir_path, "..", ".."))
backend_path = os.path.abspath(os.path.join(dir_path, "..", "..", "backend"))

if root_path not in sys.path:
    sys.path.insert(0, root_path)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models import Document, DocumentChunk
from modules.auth_system.models import User
from modules.organizations.models import Organization, Membership as OrgMembership
from modules.auth_system.jwt_service import create_access_token

# Create TestClient
client = TestClient(app)

def test_multi_tenant_document_isolation():
    """
    Verifies that documents uploaded under Org A context are isolated
    from Org B and cannot be retrieved, searched, or RAG-queried by Org B.
    """
    db = SessionLocal()
    try:
        # 1. Create two test organizations
        org_a_id = uuid.uuid4()
        org_b_id = uuid.uuid4()
        
        org_a = Organization(id=org_a_id, name="Tenant A Org")
        org_b = Organization(id=org_b_id, name="Tenant B Org")
        db.add_all([org_a, org_b])
        db.commit()

        # 2. Create users and active memberships for each organization
        suffix = uuid.uuid4().hex[:8]
        user_a = User(
            name="Alice Tenant A",
            email=f"alice.a.{suffix}@syntra.io",
            password_hash="dummy_hash",
            role="finance_manager",
            department="finance",
            status="active"
        )
        user_b = User(
            name="Bob Tenant B",
            email=f"bob.b.{suffix}@syntra.io",
            password_hash="dummy_hash",
            role="finance_manager",
            department="finance",
            status="active"
        )
        db.add_all([user_a, user_b])
        db.commit()

        membership_a = OrgMembership(
            user_id=user_a.id,
            organization_id=org_a_id,
            role="manager",
            status="Active"
        )
        membership_b = OrgMembership(
            user_id=user_b.id,
            organization_id=org_b_id,
            role="manager",
            status="Active"
        )
        db.add_all([membership_a, membership_b])
        db.commit()

        # 3. Generate JWT tokens for both users
        token_a = create_access_token({"sub": str(user_a.id), "role": user_a.role, "department": user_a.department})
        token_b = create_access_token({"sub": str(user_b.id), "role": user_b.role, "department": user_b.department})

        # 4. Create document for Org A in DB
        doc_a = Document(
            filename="tenant_a_confidential.pdf",
            content="This content is exclusive to Tenant A organization. Account code A-9876.",
            file_size=120,
            mime_type="application/pdf",
            organization_id=org_a_id
        )
        doc_b = Document(
            filename="tenant_b_confidential.pdf",
            content="This content is exclusive to Tenant B organization. Account code B-1234.",
            file_size=120,
            mime_type="application/pdf",
            organization_id=org_b_id
        )
        db.add_all([doc_a, doc_b])
        db.commit()
        db.refresh(doc_a)
        db.refresh(doc_b)

        # Index chunks for doc_a and doc_b
        chunk_a = DocumentChunk(
            document_id=doc_a.id,
            chunk_index=0,
            content=doc_a.content,
            embedding=[0.01] * 1536
        )
        chunk_b = DocumentChunk(
            document_id=doc_b.id,
            chunk_index=0,
            content=doc_b.content,
            embedding=[0.02] * 1536
        )
        db.add_all([chunk_a, chunk_b])
        db.commit()

        # 5. Fetch documents list as User A
        response_a = client.get(
            "/documents",
            headers={
                "Authorization": f"Bearer {token_a}",
                "X-Org-ID": str(org_a_id)
            }
        )
        assert response_a.status_code == 200
        docs_a = response_a.json()
        # Find doc_a in results
        filenames = [d["filename"] for d in docs_a]
        assert "tenant_a_confidential.pdf" in filenames
        assert "tenant_b_confidential.pdf" not in filenames

        # 6. Fetch documents list as User B
        response_b = client.get(
            "/documents",
            headers={
                "Authorization": f"Bearer {token_b}",
                "X-Org-ID": str(org_b_id)
            }
        )
        assert response_b.status_code == 200
        docs_b = response_b.json()
        # Find doc_b in results
        filenames_b = [d["filename"] for d in docs_b]
        assert "tenant_b_confidential.pdf" in filenames_b
        assert "tenant_a_confidential.pdf" not in filenames_b

        # 7. Try to fetch Doc A details as User B -> Should return 404
        response_detail_b = client.get(
            f"/documents/{doc_a.id}",
            headers={
                "Authorization": f"Bearer {token_b}",
                "X-Org-ID": str(org_b_id)
            }
        )
        assert response_detail_b.status_code == 404

        # 8. Try to search User A's document content as User B -> Should return no results from Tenant A
        response_search_b = client.get(
            "/search?query=exclusive&limit=5",
            headers={
                "Authorization": f"Bearer {token_b}",
                "X-Org-ID": str(org_b_id)
            }
        )
        assert response_search_b.status_code == 200
        search_results = response_search_b.json()
        assert all(res["document_id"] != str(doc_a.id) for res in search_results)

        # 9. Clean up test data
        db.delete(doc_a)
        db.delete(doc_b)
        db.delete(user_a)
        db.delete(user_b)
        db.delete(org_a)
        db.delete(org_b)
        db.commit()

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
