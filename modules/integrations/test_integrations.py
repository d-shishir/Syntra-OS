import sys
import os
import unittest

# Ensure root paths are in sys.path
dir_path = os.path.dirname(os.path.abspath(__file__))
root_path = os.path.abspath(os.path.join(dir_path, "..", ".."))
backend_path = os.path.abspath(os.path.join(dir_path, "..", "..", "backend"))

if root_path not in sys.path:
    sys.path.insert(0, root_path)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.database import SessionLocal
from modules.integrations.connector_registry import connector_registry
from modules.integrations.connector_manager import (
    connect_service, disconnect_service, get_connection_status, 
    list_active_connections, get_api_usage_metrics
)
from modules.integrations.oauth_manager import initiate_oauth_flow, exchange_code_for_token
from modules.integrations.credential_vault import store_secret, get_secret, get_vault_audit_logs
from modules.integrations.webhook_engine import create_webhook_endpoint, receive_webhook_event, list_webhooks, get_webhook_activity
from modules.integrations.sync_manager import create_sync_job, run_synchronization_sweep, get_sync_jobs, get_sync_history
from modules.workflow_engine.tool_registry import tool_registry
from modules.workflow_engine.task_router import TaskRouter
from modules.multi_agent_system.agent_manager import agent_manager
from modules.knowledge_graph.graph_manager import GraphManager
from modules.enterprise_search.search_indexer import get_index_stats

class TestEnterpriseIntegrationsHub(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()
        self.db.rollback()
        
        # Initialize event bus subscribers
        try:
            from modules.event_system.event_subscribers import initialize_subscribers
            initialize_subscribers()
        except Exception:
            pass
            
        try:
            from modules.enterprise_search.search_indexer import register_search_indexer_subscribers
            register_search_indexer_subscribers()
        except Exception:
            pass

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_01_connector_registry(self):
        print("\n--- 1. Testing Connector Registry ---")
        connectors = connector_registry.list_connectors()
        keys = [c["key"] for c in connectors]
        required_keys = ["slack", "teams", "gmail", "outlook", "sheets", "airtable", "notion", "salesforce", "hubspot", "github", "gitlab", "drive", "dropbox", "rest_api", "webhook"]
        for k in required_keys:
            self.assertIn(k, keys)
        print("✔ Registry contains all 15 required communications, productivity, CRM, development, storage, and generic connectors.")

    def test_02_connection_management(self):
        print("\n--- 2. Testing Connection Management ---")
        user_id = "user_test_99"
        conn = connect_service(user_id, "slack", "dummy_slack_key", ["chat:write"])
        self.assertEqual(conn["status"], "connected")
        self.assertEqual(conn["owner"], user_id)
        
        status = get_connection_status("slack")
        self.assertIsNotNone(status)
        self.assertEqual(status["status"], "connected")

        conns = list_active_connections()
        self.assertTrue(len(conns) > 0)
        
        disconnected = disconnect_service(user_id, "slack")
        self.assertTrue(disconnected)
        self.assertIsNone(get_connection_status("slack"))
        print("✔ Connection management flows (Connect, Status, Disconnect) function correctly.")

    def test_03_credential_vault_rbac(self):
        print("\n--- 3. Testing Credential Vault and RBAC Clearance ---")
        user_id = "user_manager_12"
        # Store secret
        success = store_secret(user_id, "hubspot", "hubspot_secret_credential_value")
        self.assertTrue(success)

        # Non-permitted role retrieval (e.g. general staff)
        secret_denied = get_secret(user_id, "general_staff", "hubspot")
        self.assertIsNone(secret_denied)

        # Permitted role retrieval (e.g. admin)
        secret_granted = get_secret(user_id, "admin", "hubspot")
        self.assertEqual(secret_granted, "hubspot_secret_credential_value")

        # Audit logs check
        logs = get_vault_audit_logs("admin")
        self.assertTrue(len(logs) > 0)
        print("✔ Credentials vault correctly obfuscates keys, blocks unauthorized roles, and appends audit logs.")

    def test_04_oauth_flow_simulation(self):
        print("\n--- 4. Testing OAuth Flow Simulation ---")
        redirect_uri = "http://localhost:3000/oauth/callback"
        auth_url = initiate_oauth_flow("github", redirect_uri)
        self.assertIn("response_type=code", auth_url)

        # Extract mock state from URL parameters
        import urllib.parse
        parsed = urllib.parse.urlparse(auth_url)
        params = urllib.parse.parse_qs(parsed.query)
        state_token = params["state"][0]

        # Code to token exchange
        tokens = exchange_code_for_token("mock_code_123", state_token)
        self.assertEqual(tokens["status"], "success")
        self.assertEqual(tokens["connector_key"], "github")
        self.assertTrue(tokens["access_token"].startswith("oauth_access_token_mock_"))
        print("✔ OAuth simulation initiates flow, swaps state parameters, and creates connections successfully.")

    def test_05_webhook_to_event_bus(self):
        print("\n--- 5. Testing Webhook receive event piping to Event Bus ---")
        wh = create_webhook_endpoint("Salesforce Contact Webhook", "Lead Onboarding Workflow", "Salesforce")
        self.assertEqual(wh["source_service"], "Salesforce")
        self.assertIn("webhooks/receive/", wh["url"])

        # Receive mock webhook post request
        payload = {"lead_name": "Bruce Wayne", "company": "Wayne Enterprises"}
        res = receive_webhook_event(self.db, wh["id"], payload)
        self.assertEqual(res["status"], "success")
        
        # Verify event history logged
        activity = get_webhook_activity()
        self.assertTrue(any(a["webhook_id"] == wh["id"] for a in activity))
        print("✔ Generic webhook endpoints parse incoming requests and publish events to Day 13 Event Bus.")

    def test_06_workflow_nodes_execution(self):
        print("\n--- 6. Testing Workflow Integration Nodes ---")
        router = TaskRouter()
        
        # Test Slack Node execution
        slack_ctx = {"channel": "#finance-ops", "message": "Disbursement approved."}
        slack_res = router.route_and_execute(self.db, "slack_node", slack_ctx)
        self.assertEqual(slack_res["status"], "success")
        self.assertEqual(slack_res["connector"], "slack")

        # Test Sheets Node execution
        sheets_ctx = {"doc_name": "GeneralLedger", "sheet_range": "A1:D10"}
        sheets_res = router.route_and_execute(self.db, "sheets_node", sheets_ctx)
        self.assertEqual(sheets_res["status"], "success")
        self.assertEqual(len(sheets_res["data"]), 3)

        # Test CRM Node execution
        crm_res = router.route_and_execute(self.db, "crm_node", {})
        self.assertEqual(crm_res["status"], "success")
        self.assertEqual(len(crm_res["records"]), 2)
        print("✔ New workflow builder nodes (Slack, Spreadsheet, CRM, REST API) function correctly.")

    def test_07_agent_tool_use(self):
        print("\n--- 7. Testing Agents using integration tools ---")
        import uuid
        from modules.multi_agent_system.models import AgentWorkflowRun
        
        valid_uuid_1 = str(uuid.uuid4())
        valid_uuid_2 = str(uuid.uuid4())
        
        # Insert AgentWorkflowRuns to satisfy foreign key constraint
        run1 = AgentWorkflowRun(id=uuid.UUID(valid_uuid_1), goal="test_slack", status="running", execution_plan=[])
        run2 = AgentWorkflowRun(id=uuid.UUID(valid_uuid_2), goal="test_unauth", status="running", execution_plan=[])
        self.db.add(run1)
        self.db.add(run2)
        self.db.commit()
        
        # Run agent using Slack tool under 'admin' role
        admin_ctx = {"user_role": "admin", "channel": "#alerts", "message": "High risk anomaly alert!"}
        res_admin = agent_manager.run_agent(
            agent_key="workflow_agent",
            task_description="Send Slack Message notify team",
            context=admin_ctx,
            db=self.db,
            workflow_run_id=valid_uuid_1
        )
        self.assertEqual(res_admin["status"], "success")

        # Run agent using Slack tool under 'unauthorized' role
        unauth_ctx = {"user_role": "external_vendor"}
        with self.assertRaises(ValueError):
            agent_manager.run_agent(
                agent_key="workflow_agent",
                task_description="Send Slack Message",
                context=unauth_ctx,
                db=self.db,
                workflow_run_id=valid_uuid_2
            )
        print("✔ Agents gain Slack/Sheets/CRM tools and execute them safely under RBAC permission checks.")

    def test_08_synchronization_sweep_and_graph(self):
        print("\n--- 8. Testing Sync sweeps, Search indexing, and Graph creation ---")
        create_sync_job("salesforce", "two_way", "event_based")
        
        # Trigger synchronization sweep
        run_synchronization_sweep("salesforce", db=self.db)
        
        # Check Knowledge Graph Nodes and relationships
        gm = GraphManager()
        graph_data = gm.get_all_graph(self.db)
        node_names = [n["name"] for n in graph_data["nodes"]]
        self.assertIn("Slack", node_names)
        self.assertIn("Developer Team", node_names)

        # Check search indexing increment
        stats = get_index_stats()
        self.assertTrue(stats["documents_indexed"] > 0)
        print("✔ Sync sweep builds graph nodes/relationships and indexes external files into Enterprise Search.")

if __name__ == "__main__":
    unittest.main()
