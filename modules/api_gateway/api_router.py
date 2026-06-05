import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from modules.auth_system.access_policies import get_current_user
from modules.auth_system.models import User
from modules.api_gateway.models import ApiKey, WebhookSubscription, WebhookAttempt, ApiGatewayLog
from modules.api_gateway.auth_middleware import get_api_key_context, generate_api_key, hash_key, enforce_api_scope
from modules.api_gateway.rate_limiter import enforce_key_rate_limit
from modules.event_system.event_bus import publish_event
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import time

router = APIRouter()

# Schemas
class ApiKeyCreate(BaseModel):
    name: str
    organization_id: str
    workspace_id: str
    scopes: List[str]

class WebhookSubscriptionCreate(BaseModel):
    name: str
    organization_id: str
    workspace_id: str
    target_url: str
    events: List[str]

class PlaygroundExecute(BaseModel):
    endpoint: str
    payload: dict

# ----------------- Developer Portal Routes (User Session JWT Authed) -----------------

@router.get("/keys")
def list_keys(
    organization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all API keys created in this organization."""
    keys = db.query(ApiKey).filter(ApiKey.organization_id == organization_id).all()
    return [k.to_dict() for k in keys]

@router.post("/keys")
def create_key(
    payload: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a new secure hashed API key."""
    raw_key = generate_api_key()
    hashed = hash_key(raw_key)
    
    api_key = ApiKey(
        name=payload.name,
        key_hash=hashed,
        prefix=raw_key[:10],
        organization_id=uuid.UUID(payload.organization_id),
        workspace_id=uuid.UUID(payload.workspace_id),
        user_id=current_user.id,
        scopes=payload.scopes
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    d = api_key.to_dict()
    d["raw_key"] = raw_key # Return only once
    return d

@router.post("/keys/{key_id}/revoke")
def revoke_key(
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Revoke/deactivate an API key."""
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found.")
    key.is_active = False
    db.commit()
    return {"status": "success", "message": "API Key revoked."}

@router.get("/webhooks")
def list_webhooks(
    organization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List webhook subscriptions."""
    subs = db.query(WebhookSubscription).filter(WebhookSubscription.organization_id == organization_id).all()
    return [s.to_dict() for s in subs]

@router.post("/webhooks")
def create_webhook(
    payload: WebhookSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new webhook subscription."""
    sub = WebhookSubscription(
        name=payload.name,
        organization_id=uuid.UUID(payload.organization_id),
        workspace_id=uuid.UUID(payload.workspace_id),
        target_url=payload.target_url,
        secret=f"whsec_{uuid.uuid4().hex[:16]}",
        events=payload.events
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub.to_dict()

@router.get("/webhooks/attempts")
def list_webhook_attempts(
    organization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List recent webhook attempts for auditing."""
    subs = db.query(WebhookSubscription).filter(WebhookSubscription.organization_id == organization_id).all()
    sub_ids = [s.id for s in subs]
    attempts = db.query(WebhookAttempt).filter(WebhookAttempt.subscription_id.in_(sub_ids)).order_by(WebhookAttempt.timestamp.desc()).limit(100).all()
    return [a.to_dict() for a in attempts]

@router.get("/logs")
def get_gateway_logs(
    organization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """View HTTP API logs."""
    logs = db.query(ApiGatewayLog).filter(ApiGatewayLog.organization_id == organization_id).order_by(ApiGatewayLog.timestamp.desc()).limit(100).all()
    return [l.to_dict() for l in logs]

@router.post("/playground")
def run_playground(
    payload: PlaygroundExecute,
    current_user: User = Depends(get_current_user)
):
    """Simulate routing playground execute."""
    # Simulates sandbox gateway query execution
    return {
        "status": "success",
        "mocked": True,
        "endpoint": payload.endpoint,
        "payload": payload.payload,
        "response": {
            "execution_id": str(uuid.uuid4()),
            "message": f"Successfully mock executed {payload.endpoint}",
            "result": {"output": "Playground transaction successful", "code": 200}
        }
    }

@router.get("/sdk")
def get_sdk_snippets():
    """Generates SDK stubs for languages."""
    return {
        "python": """import requests

class SyntraClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.syntraos.com/v1"
        self.headers = {"Authorization": f"Bearer {self.api_key}"}

    def trigger_workflow(self, workflow_id: str, inputs: dict):
        url = f"{self.base_url}/gateway/workflows/{workflow_id}/trigger"
        return requests.post(url, json=inputs, headers=self.headers).json()

client = SyntraClient("sy_live_...")
print(client.trigger_workflow("wf_123", {"action": "validate"}))
""",
        "javascript": """const fetch = require('node-fetch');

class Syntra {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.syntraos.com/v1";
    }

    async invokeAgent(agentId, prompt) {
        const res = await fetch(`${this.baseUrl}/gateway/agents/${agentId}/invoke`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        return res.json();
    }
}
""",
        "go": """package main

import (
	"fmt"
	"net/http"
)

func main() {
	fmt.Println("Syntra Go SDK Stub initialized")
}
"""
    }

# ----------------- Programmatic Core API Gateway Routes (API Key Authed) -----------------

def log_request(db: Session, api_key: ApiKey, path: str, method: str, status_code: int, latency_ms: int, risk_score: int = 0):
    log_entry = ApiGatewayLog(
        api_key_id=api_key.id,
        organization_id=api_key.organization_id,
        workspace_id=api_key.workspace_id,
        path=path,
        method=method,
        status_code=status_code,
        latency_ms=latency_ms,
        risk_score=risk_score
    )
    db.add(log_entry)
    db.commit()

@router.post("/gateway/workflows/{wf_id}/trigger", dependencies=[Depends(enforce_key_rate_limit)])
def trigger_workflow(
    wf_id: uuid.UUID,
    payload: dict,
    api_key: ApiKey = Depends(enforce_api_scope("workflows:write")),
    db: Session = Depends(get_db)
):
    """Programmatic API triggering AI workflow."""
    start_time = time.time()
    publish_event(db, "workflow_triggered", "api_gateway", {"workflow_id": str(wf_id), "api_key_id": str(api_key.id)})

    latency = int((time.time() - start_time) * 1000)
    log_request(db, api_key, f"/gateway/workflows/{wf_id}/trigger", "POST", 200, latency)
    
    return {
        "status": "triggered",
        "workflow_id": str(wf_id),
        "execution_id": str(uuid.uuid4()),
        "timestamp": time.time()
    }

@router.post("/gateway/agents/{agent_id}/invoke", dependencies=[Depends(enforce_key_rate_limit)])
def invoke_agent(
    agent_id: uuid.UUID,
    payload: dict,
    api_key: ApiKey = Depends(enforce_api_scope("agents:write")),
    db: Session = Depends(get_db)
):
    """Programmatic API invoking AI Agent."""
    start_time = time.time()
    publish_event(db, "agent_invoked", "api_gateway", {"agent_id": str(agent_id), "api_key_id": str(api_key.id)})

    latency = int((time.time() - start_time) * 1000)
    log_request(db, api_key, f"/gateway/agents/{agent_id}/invoke", "POST", 200, latency)
    
    return {
        "status": "success",
        "agent_id": str(agent_id),
        "response": f"Mock agent {agent_id} successfully executed API query: '{payload.get('prompt', 'hello')}'"
    }

@router.get("/gateway/documents", dependencies=[Depends(enforce_key_rate_limit)])
def list_gateway_documents(
    api_key: ApiKey = Depends(enforce_api_scope("documents:read")),
    db: Session = Depends(get_db)
):
    """Programmatic API list documents scoped to tenant boundaries."""
    # Strictly isolated query: only lists documents belonging to key organization if documents schema matches
    # Since existing documents table does not contain organization_id yet, we stub isolation rules
    start_time = time.time()
    latency = int((time.time() - start_time) * 1000)
    log_request(db, api_key, "/gateway/documents", "GET", 200, latency)
    
    return {
        "organization_id": str(api_key.organization_id),
        "documents": [
            {"id": str(uuid.uuid4()), "filename": "multi_tenant_financials.pdf", "size": 1024 * 50}
        ]
    }
