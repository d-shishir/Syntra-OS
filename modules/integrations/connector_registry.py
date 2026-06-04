import logging

logger = logging.getLogger(__name__)

CONNECTORS = {
    "slack": {
        "name": "Slack",
        "category": "Communication",
        "description": "Post alerts, receive event notifications, and synchronize channel summaries.",
        "icon": "MessageSquare",
        "default_scopes": ["channels:read", "chat:write", "incoming-webhook"]
    },
    "teams": {
        "name": "Microsoft Teams",
        "category": "Communication",
        "description": "Send adaptive cards, message team spaces, and execute workflow notifications.",
        "icon": "MessageSquare",
        "default_scopes": ["Group.ReadWrite.All", "ChatMessage.Send"]
    },
    "gmail": {
        "name": "Gmail",
        "category": "Communication",
        "description": "Read email chains, send summary reports, and trigger workflows on new incoming messages.",
        "icon": "Mail",
        "default_scopes": ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]
    },
    "sheets": {
        "name": "Google Sheets",
        "category": "Productivity",
        "description": "Export rows, append ledger lines, and read transaction sheets in workflow automation.",
        "icon": "Grid",
        "default_scopes": ["https://www.googleapis.com/auth/spreadsheets"]
    },
    "salesforce": {
        "name": "Salesforce",
        "category": "CRM",
        "description": "Synchronize lead accounts, poll deal status changes, and trigger agent outreaches.",
        "icon": "Briefcase",
        "default_scopes": ["api", "refresh_token"]
    },
    "hubspot": {
        "name": "HubSpot",
        "category": "CRM",
        "description": "Ingest contacts metadata, update deal tags, and listen to lead capture webhooks.",
        "icon": "Briefcase",
        "default_scopes": ["contacts", "tickets"]
    },
    "github": {
        "name": "GitHub",
        "category": "Development",
        "description": "Track issue tickets, trigger actions on repository pull requests, and audit code metrics.",
        "icon": "GitBranch",
        "default_scopes": ["repo", "admin:repo_hook"]
    },
    "drive": {
        "name": "Google Drive",
        "category": "Storage",
        "description": "Retrieve document logs, fetch invoice folders, and stream semantic index files.",
        "icon": "HardDrive",
        "default_scopes": ["https://www.googleapis.com/auth/drive.readonly"]
    },
    "rest_api": {
        "name": "Generic REST API",
        "category": "Enterprise",
        "description": "Trigger external web APIs with customizable headers, payloads, and auth configurations.",
        "icon": "Globe",
        "default_scopes": ["custom"]
    },
    "webhook": {
        "name": "Generic Webhook",
        "category": "Enterprise",
        "description": "Receive incoming JSON events from other platforms and pipe them directly to Event Bus.",
        "icon": "Radio",
        "default_scopes": ["incoming"]
    }
}

class ConnectorRegistry:
    def __init__(self):
        self._connectors = CONNECTORS

    def get_connector(self, key: str):
        return self._connectors.get(key)

    def list_connectors(self):
        return [
            {"key": key, **info}
            for key, info in self._connectors.items()
        ]

connector_registry = ConnectorRegistry()
