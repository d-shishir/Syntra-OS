import sys
import os
import unittest

# Ensure workspace root is in sys.path
root_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from modules.integrations.connector_registry import connector_registry
from modules.integrations.credential_vault import store_secret, get_secret, _obfuscate, _deobfuscate
from modules.integrations.oauth_manager import initiate_oauth_flow, exchange_code_for_token
from modules.integrations.webhook_engine import create_webhook_endpoint, receive_webhook_event
from modules.integrations.sync_manager import create_sync_job, run_synchronization_sweep
from modules.integrations.connector_manager import connect_service, get_connection_status

class TestEnterpriseIntegrationsHub(unittest.TestCase):
    def test_connectors_registry(self):
        # 1. Connectors list
        connectors = connector_registry.list_connectors()
        self.assertGreater(len(connectors), 0)
        slack_conn = connector_registry.get_connector("slack")
        self.assertEqual(slack_conn["name"], "Slack")

    def test_credential_vault_encryption(self):
        # 2. Test mock secure encryption
        secret = "super_secret_token_123"
        encrypted = _obfuscate(secret)
        self.assertNotEqual(secret, encrypted)
        
        # Test access logs
        store_secret("user_1", "slack", secret)
        decrypted = get_secret("user_1", "admin", "slack")
        self.assertEqual(secret, decrypted)

    def test_oauth_simulation_flow(self):
        # 3. Test OAuth Simulation state
        auth_url = initiate_oauth_flow("slack", "https://localhost/callback")
        self.assertIn("state=", auth_url)
        self.assertIn("https://auth.syntra.io/oauth/authorize", auth_url)

        # Retrieve state token from URL to correctly pass to callback
        state_token = auth_url.split("state=")[-1]

        res = exchange_code_for_token("code_123", state_token)
        self.assertEqual(res["status"], "success")
        self.assertIn("access_token", res)

    def test_webhook_triggers(self):
        # 4. Test Webhooks creating & event payload routing
        wh = create_webhook_endpoint("Test Webhook", "Approval Flow", "GitHub")
        self.assertEqual(wh["source_service"], "GitHub")
        self.assertEqual(wh["target_workflow"], "Approval Flow")
        self.assertIn("/webhooks/receive/", wh["url"])

    def test_sync_sweeps(self):
        # 5. Sync jobs creation and monitoring sweeps
        job = create_sync_job("sheets", "one_way", "scheduled_1h")
        self.assertEqual(job["connector_key"], "sheets")
        self.assertEqual(job["status"], "active")
        
        sweep = run_synchronization_sweep("sheets")
        self.assertIn(sweep["outcome"], ["success", "degraded"])
        self.assertGreaterEqual(sweep["records_processed"], 0)

if __name__ == '__main__':
    unittest.main()
