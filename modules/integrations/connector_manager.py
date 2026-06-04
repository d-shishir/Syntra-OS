import logging
import datetime
from typing import Dict, List, Optional
from modules.integrations.connector_registry import connector_registry
from modules.integrations.credential_vault import store_secret, delete_secret

logger = logging.getLogger(__name__)

# Active connection instances state
_active_connections: Dict[str, dict] = {}
# Telemetry tracking for API consumption
_api_usage_metrics: Dict[str, int] = {
    "Slack": 12,
    "Microsoft Teams": 4,
    "Gmail": 8,
    "Google Sheets": 19,
    "HubSpot": 6,
    "Salesforce": 2,
    "GitHub": 14,
    "Google Drive": 32,
    "Generic REST API": 5,
    "Generic Webhook": 44
}

def connect_service(user_id: str, connector_key: str, credentials_secret: str, permissions: list) -> dict:
    """
    Connects a connector service, stores credentials in vault, and sets connection state.
    """
    registry_info = connector_registry.get_connector(connector_key)
    if not registry_info:
        return {"status": "error", "message": f"Connector '{connector_key}' not found in registry."}
    
    # Store credentials in the secure vault
    store_secret(user_id, connector_key, credentials_secret)
    
    connection = {
        "key": connector_key,
        "name": registry_info["name"],
        "category": registry_info["category"],
        "status": "connected",
        "last_sync": datetime.datetime.utcnow().isoformat(),
        "owner": user_id,
        "permissions": permissions
    }
    _active_connections[connector_key] = connection
    logger.info(f"Connector Manager: Service '{connector_key}' successfully connected by operator '{user_id}'")
    return connection

def disconnect_service(user_id: str, connector_key: str) -> bool:
    if connector_key in _active_connections:
        del _active_connections[connector_key]
        delete_secret(user_id, connector_key)
        logger.info(f"Connector Manager: Disconnected service connection '{connector_key}'")
        return True
    return False

def get_connection_status(connector_key: str) -> Optional[dict]:
    return _active_connections.get(connector_key)

def list_active_connections() -> List[dict]:
    return list(_active_connections.values())

def get_api_usage_metrics() -> Dict[str, int]:
    return _api_usage_metrics

def increment_api_usage(connector_name: str):
    if connector_name in _api_usage_metrics:
        _api_usage_metrics[connector_name] += 1

# Reusable Agent / Workflow Tools
def invoke_slack_message(user_id: str, channel: str, message: str) -> dict:
    increment_api_usage("Slack")
    logger.info(f"Integration Tool: Sending Slack message to '{channel}' by user '{user_id}'")
    return {
        "status": "success",
        "connector": "slack",
        "message": f"Message dispatched to channel '{channel}' successfully.",
        "payload": {"channel": channel, "content": message}
    }

def invoke_read_spreadsheet(user_id: str, doc_name: str, sheet_range: str) -> dict:
    increment_api_usage("Google Sheets")
    logger.info(f"Integration Tool: Reading Google Sheet '{doc_name}' range '{sheet_range}'")
    return {
        "status": "success",
        "connector": "sheets",
        "rows_retrieved": 5,
        "data": [
            {"Employee ID": "101", "Name": "Alice Smith", "Gross Pay": "5000"},
            {"Employee ID": "102", "Name": "Bob Johnson", "Gross Pay": "6200"},
            {"Employee ID": "103", "Name": "Charlie Brown", "Gross Pay": "4800"}
        ]
    }

def invoke_fetch_crm_data(user_id: str, limit: int = 5) -> dict:
    increment_api_usage("Salesforce")
    logger.info(f"Integration Tool: Ingesting recent accounts from Salesforce (Limit: {limit})")
    return {
        "status": "success",
        "connector": "salesforce",
        "records": [
            {"id": "sf_91", "company": "Stark Industries", "value": "$1,200,000"},
            {"id": "sf_92", "company": "Wayne Enterprises", "value": "$850,000"}
        ]
    }
