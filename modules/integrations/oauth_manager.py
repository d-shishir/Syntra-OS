import logging
import secrets
import datetime
from typing import Dict

logger = logging.getLogger(__name__)

# In-memory tracking of pending flow state codes
_pending_states: Dict[str, dict] = {}

def initiate_oauth_flow(connector_key: str, redirect_uri: str) -> str:
    """
    Simulates initiating an OAuth flow by generating an auth URL and recording authorization state.
    """
    state_token = secrets.token_hex(16)
    _pending_states[state_token] = {
        "connector_key": connector_key,
        "redirect_uri": redirect_uri,
        "created_at": datetime.datetime.utcnow()
    }
    
    # Return simulated authorize URL redirect
    auth_url = f"https://auth.syntra.io/oauth/authorize?response_type=code&client_id=syntra_client&state={state_token}"
    logger.info(f"OAuth Flow: Initiated authorization sequence for connector '{connector_key}'")
    return auth_url

def exchange_code_for_token(code: str, state: str) -> dict:
    """
    Simulates code-to-token swap and checks state verification validity.
    """
    if state not in _pending_states:
        logger.warning(f"OAuth Flow Check: Refused authorization state match error (State: {state})")
        return {"status": "error", "message": "Invalid OAuth state verification code."}
    
    flow_info = _pending_states[state]
    del _pending_states[state] # Expire/invalidate state token
    
    connector_key = flow_info["connector_key"]
    
    # Generate mock OAuth token results
    mock_tokens = {
        "status": "success",
        "connector_key": connector_key,
        "access_token": f"oauth_access_token_mock_{secrets.token_hex(12)}",
        "refresh_token": f"oauth_refresh_token_mock_{secrets.token_hex(12)}",
        "expires_in": 3600,
        "scopes": ["read", "write"]
    }
    logger.info(f"OAuth Flow: Exchanged credentials successfully. Authenticated connector '{connector_key}'")
    return mock_tokens
