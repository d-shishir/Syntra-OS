import React, { useState, useEffect } from "react";
import {
  Link2, Search, Sliders, Play, Trash2, Shield, AlertTriangle, CheckCircle, RefreshCw, 
  Activity, Server, Key, AlertCircle, Settings, Cable, Plus, Database, Copy, Check, Send, 
  Gauge, PieChart, Sparkles, Network, ArrowRight, ArrowUpRight
} from "lucide-react";
import { apiClient } from "../../services/apiClient";

interface Connector {
  key: string;
  name: string;
  category: string;
  status: string;
  description: string;
  is_oauth: boolean;
  required_fields?: string[];
}

interface Connection {
  key: string;
  name: string;
  status: string;
  connected_at: string;
  last_sync: string;
  permissions: string[];
  owner: string;
  api_calls_count: number;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  target_workflow: string;
  source_service: string;
  created_at: string;
}

interface SyncJob {
  connector_key: string;
  direction: string;
  sync_type: string;
  status: string;
  last_sync: string;
  records_processed: number;
  errors_count: number;
  conflicts_count: number;
}

export const IntegrationsDashboard: React.FC = () => {
  // Navigation Tabs
  const [activeSubTab, setActiveSubTab] = useState<"marketplace" | "connections" | "webhooks" | "builder" | "sync" | "monitoring">("marketplace");
  
  // Data States
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  
  // UI Utilities
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Action modals/states
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [credentialsInput, setCredentialsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // Webhook Form State
  const [webhookName, setWebhookName] = useState("");
  const [webhookWorkflow, setWebhookWorkflow] = useState("");
  const [webhookService, setWebhookService] = useState("Slack");

  // Custom API Builder State
  const [builderName, setBuilderName] = useState("");
  const [builderBaseUrl, setBuilderBaseUrl] = useState("https://api.custom.com/v1");
  const [builderHeaders, setBuilderHeaders] = useState("Authorization: Bearer {{vault_token}}\nContent-Type: application/json");
  const [builderAuthType, setBuilderAuthType] = useState("Bearer Token");
  const [builderEndpoints, setBuilderEndpoints] = useState("/users\n/records\n/invoices");
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);

  // Sync Form State
  const [syncConnectorKey, setSyncConnectorKey] = useState("slack");
  const [syncDirection, setSyncDirection] = useState("two_way");
  const [syncType, setSyncType] = useState("scheduled_1h");

  // Telemetry Observability States
  const [metrics, setMetrics] = useState<any>(null);

  // Copilot Simulation State
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [copilotResponse, setCopilotResponse] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const resConnectors = await apiClient.get("/api/v1/integrations/connectors");
      if (resConnectors.ok) setConnectors(await resConnectors.ok ? await resConnectors.json() : []);

      const resConnections = await apiClient.get("/api/v1/integrations/connections");
      if (resConnections.ok) setConnections(await resConnections.json());

      const resWebhooks = await apiClient.get("/api/v1/integrations/webhooks");
      if (resWebhooks.ok) setWebhooks(await resWebhooks.json());

      const resSync = await apiClient.get("/api/v1/integrations/sync/jobs");
      if (resSync.ok) setSyncJobs(await resSync.json());

      const resMonitoring = await apiClient.get("/api/v1/integrations/monitoring");
      if (resMonitoring.ok) setMetrics(await resMonitoring.json());
    } catch (e) {
      console.error("Error loading integrations hub data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Connect Connector Handler (API keys / oauth sim)
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnector) return;
    
    try {
      setLoading(true);
      if (selectedConnector.is_oauth) {
        // Run simulated OAuth Flow
        const initRes = await apiClient.post("/api/v1/integrations/oauth/initiate", {
          connector_key: selectedConnector.key,
          redirect_uri: window.location.origin + "/oauth/callback"
        });
        if (initRes.ok) {
          const initData = await initRes.json();
          alert(`Redirecting to Simulated OAuth authorization URL:\n${initData.authorization_url}`);
          
          // Complete flow mock call
          const callbackRes = await apiClient.post("/api/v1/integrations/oauth/callback", {
            code: "mock_authorization_code_x821",
            state: "mock_secure_state_token"
          });
          if (callbackRes.ok) {
            alert(`Simulated Authorization Successful! Authorized scopes: ${selectedConnector.name}`);
          }
        }
      } else {
        // REST API keys / tokens flow
        const res = await apiClient.post("/api/v1/integrations/connect", {
          connector_key: selectedConnector.key,
          credentials: credentialsInput || "sk_live_dummy_api_key_for_rest_testing",
          permissions: ["read", "write"]
        });
        if (res.ok) {
          alert(`Successfully connected ${selectedConnector.name}! Credentials stored in Vault.`);
        }
      }
      setSelectedConnector(null);
      setCredentialsInput("");
      fetchData();
    } catch (err) {
      alert("Failed to establish connector connection.");
    } finally {
      setLoading(false);
    }
  };

  // Test Connection
  const handleTestConnection = async (key: string) => {
    setTestingKey(key);
    setTestResult(null);
    try {
      const res = await apiClient.post("/api/v1/integrations/test-connection", { connector_key: key });
      if (res.ok) {
        const data = await res.json();
        setTestResult(`SUCCESS (Ping: ${data.latency_ms}ms): ${data.message}`);
      } else {
        setTestResult("FAILED: Target connection did not respond. Check credentials vault.");
      }
    } catch (e) {
      setTestResult("FAILED: Endpoint unreachable.");
    } finally {
      setTestingKey(null);
    }
  };

  // Disconnect Connection
  const handleDisconnect = async (key: string) => {
    if (!window.confirm(`Are you sure you want to disconnect '${key}'? This will revoke access keys.`)) return;
    try {
      const res = await apiClient.post("/api/v1/integrations/disconnect", { connector_key: key });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      alert("Failed to disconnect service.");
    }
  };

  // Webhook Creation
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookName || !webhookWorkflow) return;
    try {
      setLoading(true);
      const res = await apiClient.post("/api/v1/integrations/webhooks", {
        name: webhookName,
        target_workflow: webhookWorkflow,
        source_service: webhookService
      });
      if (res.ok) {
        setWebhookName("");
        setWebhookWorkflow("");
        fetchData();
      }
    } catch (e) {
      alert("Error creating webhook endpoint.");
    } finally {
      setLoading(false);
    }
  };

  // Custom API Connector Registration
  const handleBuildCustomApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderName || !builderBaseUrl) return;
    try {
      setLoading(true);
      // Simulate registering new custom connector in registry
      const res = await apiClient.post("/api/v1/integrations/connect", {
        connector_key: builderName.toLowerCase().replace(/\s+/g, "_"),
        credentials: "custom_builder_auth_key",
        permissions: ["read", "write"]
      });
      if (res.ok) {
        setBuilderMessage(`Custom API Connector "${builderName}" registered successfully! It is now available as a custom tool.`);
        setBuilderName("");
        setBuilderBaseUrl("https://api.custom.com/v1");
        fetchData();
      }
    } catch (e) {
      setBuilderMessage("Failed to register custom API connector.");
    } finally {
      setLoading(false);
    }
  };

  // Sync configuration trigger
  const handleConfigureSync = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiClient.post("/api/v1/integrations/sync/configure", {
        connector_key: syncConnectorKey,
        direction: syncDirection,
        sync_type: syncType
      });
      if (res.ok) {
        alert("Sync job configured successfully!");
        fetchData();
      }
    } catch (e) {
      alert("Failed to configure synchronization rules.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger Instant Sync
  const handleTriggerSync = async (key: string) => {
    try {
      alert(`Initiating real-time record sweeps for connection: ${key}`);
      const res = await apiClient.post("/api/v1/integrations/sync/trigger", { connector_key: key });
      if (res.ok) {
        const data = await res.json();
        alert(`Sync Sweep Completed! Status: ${data.status}\nRecords Processed: ${data.records_processed}\nConflicts Resolved: ${data.conflicts_count}`);
        fetchData();
      }
    } catch (e) {
      alert("Failed to trigger sync sweep.");
    }
  };

  // Copilot Simulation
  const handleCopilotPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotPrompt.trim()) return;
    setCopilotLoading(true);
    setCopilotResponse(null);
    
    setTimeout(() => {
      const prompt = copilotPrompt.toLowerCase();
      if (prompt.includes("slack")) {
        setCopilotResponse(`**Syntra AI Copilot recommendation generated:**
\`\`\`json
{
  "action": "CREATE_WORKFLOW_NODE",
  "node_type": "SlackNode",
  "config": {
    "channel": "#general",
    "trigger_event": "invoice_uploaded",
    "message_template": "⚠️ Notification: New document \\"{{filename}}\\" has been uploaded and structured."
  }
}
\`\`\`
*To deploy this, click the 'Deploy Integrations Node' button in Workflow Builder.*`);
      } else if (prompt.includes("salesforce") || prompt.includes("crm")) {
        setCopilotResponse(`**Syntra AI Copilot recommendation generated:**
\`\`\`json
{
  "action": "CONFIGURE_DATA_SYNC",
  "connector_key": "salesforce",
  "direction": "two_way",
  "sync_type": "event_based",
  "mapping": {
    "salesforce_lead_id": "crm_entity_id",
    "company_name": "entity_name",
    "annual_revenue": "financial_volume"
  }
}
\`\`\`
*Data Sync rule formulated and synced with the Central Knowledge Graph.*`);
      } else {
        setCopilotResponse(`**Syntra AI Copilot recommendation generated:**
\`\`\`json
{
  "action": "CREATE_GENERIC_WEBHOOK",
  "name": "External webhook trigger",
  "target_workflow": "Auto-Approve Invoices",
  "source_service": "Custom API Builder"
}
\`\`\`
*Webhook registered under Endpoint registry. Endpoint URI generated.*`);
      }
      setCopilotLoading(false);
    }, 1200);
  };

  // Categories
  const categories = ["All", "Communication", "Productivity", "CRM", "Development", "Storage", "Enterprise"];

  // Filter Connectors
  const filteredConnectors = connectors.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 flex-1 flex flex-col">
      {/* Overview stats header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-darkMuted uppercase">Active Connections</span>
            <h3 className="text-2xl font-bold text-gray-100">{connections.length} Services</h3>
          </div>
          <div className="p-3 bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 rounded-xl">
            <Cable className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-darkMuted uppercase">Sync Health Score</span>
            <h3 className="text-2xl font-bold text-emerald-400">{metrics?.health_score || 100}% Health</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
            <Gauge className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-darkMuted uppercase">Webhooks Registered</span>
            <h3 className="text-2xl font-bold text-neonTeal">{webhooks.length} Endpoints</h3>
          </div>
          <div className="p-3 bg-neonTeal/10 text-neonTeal border border-neonTeal/20 rounded-xl">
            <Network className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex items-center justify-between">
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-darkMuted uppercase">Sync Sweep Runs</span>
            <h3 className="text-2xl font-bold text-purple-400">{syncJobs.length} Active Jobs</h3>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Tab bar */}
      <div className="flex border-b border-darkBorder/60 gap-4">
        {[
          { id: "marketplace", label: "Marketplace Hub", icon: Sparkles },
          { id: "connections", label: "Connection Vault", icon: Key },
          { id: "webhooks", label: "Webhook Engine", icon: Network },
          { id: "builder", label: "API Builder", icon: Settings },
          { id: "sync", label: "Sync Engine", icon: RefreshCw },
          { id: "monitoring", label: "Observability Metrics", icon: Activity }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id as any);
                setTestResult(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                isActive 
                  ? "border-neonIndigo text-neonIndigo" 
                  : "border-transparent text-darkMuted hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area Switch */}
      <div className="flex-1 flex flex-col min-h-0">
        
        {/* Marketplace Tab */}
        {activeSubTab === "marketplace" && (
          <div className="space-y-6 flex-1 flex flex-col">
            {/* Search and filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-darkMuted" />
                <input
                  type="text"
                  placeholder="Search connectors catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-darkPanel border border-darkBorder/80 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-[11px] font-semibold font-mono rounded-lg transition-colors border cursor-pointer ${
                      selectedCategory === cat 
                        ? "bg-neonIndigo/10 text-neonIndigo border-neonIndigo/30" 
                        : "bg-darkPanel/40 text-darkMuted border-darkBorder/60 hover:text-gray-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Marketplace Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredConnectors.map(conn => {
                const isConnected = connections.some(c => c.key === conn.key);
                return (
                  <div key={conn.key} className="p-4 bg-darkPanel border border-darkBorder hover:border-darkMuted/40 transition-all rounded-2xl flex flex-col justify-between group relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="w-10 h-10 bg-darkBg border border-darkBorder rounded-xl flex items-center justify-center text-neonIndigo group-hover:scale-105 transition-transform font-bold text-sm uppercase">
                          {conn.name.substring(0, 2)}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold font-mono uppercase border ${
                          isConnected 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-darkPanel text-darkMuted border-darkBorder"
                        }`}>
                          {isConnected ? "Connected" : "Available"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-gray-200">{conn.name}</h4>
                        <p className="text-xs text-darkMuted leading-relaxed">{conn.description}</p>
                      </div>
                    </div>

                    <div className="border-t border-darkBorder/60 pt-4 mt-4 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-darkMuted">{conn.category}</span>
                      <button
                        onClick={() => setSelectedConnector(conn)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
                          isConnected 
                            ? "bg-darkPanel border border-darkBorder hover:bg-darkBorder text-gray-200" 
                            : "bg-neonIndigo hover:bg-neonIndigo/85 text-white"
                        }`}
                      >
                        <span>{isConnected ? "Configure" : "Connect"}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Copilot Config Helper widget */}
            <div className="p-5 bg-darkPanel border border-darkBorder rounded-2xl mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-neonIndigo animate-pulse" />
                <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                  AI Integrations Copilot
                </h4>
              </div>
              <p className="text-xs text-darkMuted leading-relaxed max-w-2xl">
                Tell Syntra Copilot what external workflows you want to wire up (e.g. "Send document upload notifications to Slack channel #ops", "Sync Salesforce Leads table with financial engine").
              </p>
              
              <form onSubmit={handleCopilotPromptSubmit} className="flex gap-2 max-w-3xl">
                <input
                  type="text"
                  placeholder="e.g. Wire up a Slack channel webhook to alert my workflows..."
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  className="flex-1 bg-darkBg border border-darkBorder rounded-xl px-4 py-2 text-xs outline-none focus:border-neonIndigo"
                />
                <button
                  type="submit"
                  disabled={copilotLoading}
                  className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {copilotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Generate Rule</span>
                </button>
              </form>

              {copilotResponse && (
                <div className="p-4 bg-darkBg border border-darkBorder rounded-xl font-mono text-xs leading-relaxed text-gray-300 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{copilotResponse}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credentials Vault / Connections list */}
        {activeSubTab === "connections" && (
          <div className="space-y-6 flex-1">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Credential Vault & Connection Management
              </h4>
              <span className="text-[10px] text-darkMuted font-mono flex items-center gap-1.5 border border-darkBorder px-2.5 py-1 rounded-lg">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                AES-256 XOR Vault Enforced
              </span>
            </div>

            <div className="bg-darkPanel border border-darkBorder rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-darkPanel border-b border-darkBorder text-darkMuted font-mono uppercase tracking-wider text-[10px]">
                    <th className="p-4">Connector</th>
                    <th className="p-4">Authorization State</th>
                    <th className="p-4">Last Sync Swept</th>
                    <th className="p-4">Permissions / Scopes</th>
                    <th className="p-4">API Utilization</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-darkMuted font-mono">
                        No services connected. Visit the Marketplace to link your tools.
                      </td>
                    </tr>
                  ) : (
                    connections.map(conn => (
                      <tr key={conn.key} className="border-b border-darkBorder/40 hover:bg-darkPanel/20 transition-colors">
                        <td className="p-4 font-semibold text-gray-200 flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-darkBg border border-darkBorder flex items-center justify-center text-[10px] font-bold text-neonIndigo font-mono">
                            {conn.key.toUpperCase().substring(0, 2)}
                          </span>
                          <span>{conn.name}</span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1.5 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>Vault Verified</span>
                          </span>
                        </td>
                        <td className="p-4 text-darkMuted font-mono">{conn.last_sync}</td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            {conn.permissions.map(p => (
                              <span key={p} className="px-1.5 py-0.5 rounded bg-darkBg text-darkMuted text-[9px] font-mono border border-darkBorder">
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-gray-300">{conn.api_calls_count} calls</td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleTestConnection(conn.key)}
                            className="px-2.5 py-1 bg-darkBg hover:bg-darkBorder border border-darkBorder rounded text-[11px] font-semibold text-gray-200 transition-colors cursor-pointer"
                          >
                            {testingKey === conn.key ? "Testing..." : "Test Connection"}
                          </button>
                          <button
                            onClick={() => handleTriggerSync(conn.key)}
                            className="px-2.5 py-1 bg-neonIndigo/10 hover:bg-neonIndigo hover:text-white border border-neonIndigo/30 rounded text-[11px] font-semibold text-neonIndigo transition-all cursor-pointer"
                          >
                            Sync Sweep
                          </button>
                          <button
                            onClick={() => handleDisconnect(conn.key)}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 rounded text-[11px] font-semibold text-rose-400 transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {testResult && (
              <div className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex items-center gap-3 text-xs leading-relaxed text-gray-300 font-mono">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}
          </div>
        )}

        {/* Webhooks Engine */}
        {activeSubTab === "webhooks" && (
          <div className="space-y-6 flex-1 flex flex-col md:flex-row gap-6">
            
            {/* Left side form */}
            <div className="w-full md:w-1/3 p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4 h-fit">
              <h4 className="text-xs font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Create Webhook Endpoint
              </h4>
              <p className="text-[11px] text-darkMuted leading-relaxed">
                Wire external event signals directly into Syntra OS workflows without code.
              </p>

              <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Endpoint Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gmail Invoice Alerts"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Target Workflow Trigger</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auto-Approve Invoices"
                    value={webhookWorkflow}
                    onChange={(e) => setWebhookWorkflow(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Source App Service</label>
                  <select
                    value={webhookService}
                    onChange={(e) => setWebhookService(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  >
                    <option value="Slack">Slack</option>
                    <option value="Gmail">Gmail</option>
                    <option value="Salesforce">Salesforce</option>
                    <option value="GitHub">GitHub</option>
                    <option value="Generic REST API">Generic REST API</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Webhook</span>
                </button>
              </form>
            </div>

            {/* Right side list */}
            <div className="flex-1 space-y-4">
              <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Configured Webhook Endpoints
              </h4>

              <div className="space-y-3">
                {webhooks.length === 0 ? (
                  <div className="p-8 text-center text-darkMuted font-mono border border-darkBorder rounded-2xl bg-darkPanel">
                    No webhooks registered. Create one using the form on the left.
                  </div>
                ) : (
                  webhooks.map(wh => (
                    <div key={wh.id} className="p-4 bg-darkPanel border border-darkBorder rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-darkBg text-neonTeal font-mono text-[9px] border border-darkBorder">
                            {wh.source_service}
                          </span>
                          <h5 className="text-xs font-semibold text-gray-200">{wh.name}</h5>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-darkMuted font-mono break-all bg-darkBg/60 px-2 py-1 rounded border border-darkBorder select-all">
                            {wh.url}
                          </span>
                          <button
                            onClick={() => handleCopy(wh.url, wh.id)}
                            className="p-1 rounded hover:bg-darkBorder text-darkMuted hover:text-gray-200 cursor-pointer"
                            title="Copy webhook endpoint url"
                          >
                            {copiedText === wh.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-darkMuted font-mono md:text-right space-y-1">
                        <div>Triggering workflow: <span className="text-neonIndigo">{wh.target_workflow}</span></div>
                        <div className="text-[10px] opacity-70">Created at {wh.created_at}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* API Connector Builder */}
        {activeSubTab === "builder" && (
          <div className="space-y-6 flex-1 flex flex-col md:flex-row gap-6">
            
            {/* Setup API Fields form */}
            <div className="w-full md:w-1/2 p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-neonIndigo" />
                <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                  Generic API Connector Builder
                </h4>
              </div>
              <p className="text-xs text-darkMuted leading-relaxed">
                Connect legacy payroll systems, internal HR tools, or third-party compliance modules by configuring custom endpoints.
              </p>

              <form onSubmit={handleBuildCustomApi} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Connector Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Custom HR Payroll System"
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-gray-300 font-semibold">Authentication Type</label>
                    <select
                      value={builderAuthType}
                      onChange={(e) => setBuilderAuthType(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                    >
                      <option value="Bearer Token">Bearer Token</option>
                      <option value="API Key Header">API Key Header</option>
                      <option value="OAuth2 Simulation">OAuth2 Simulation</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-300 font-semibold">Base API URL</label>
                    <input
                      type="text"
                      required
                      placeholder="https://api.custom.com/v1"
                      value={builderBaseUrl}
                      onChange={(e) => setBuilderBaseUrl(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Custom Headers (YAML/JSON format)</label>
                  <textarea
                    rows={3}
                    value={builderHeaders}
                    onChange={(e) => setBuilderHeaders(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Exposed Endpoints (comma/newline separated)</label>
                  <textarea
                    rows={3}
                    placeholder="/users&#10;/records"
                    value={builderEndpoints}
                    onChange={(e) => setBuilderEndpoints(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors text-xs"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Build Custom Connector Tool</span>
                </button>
              </form>

              {builderMessage && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2 text-xs leading-relaxed">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{builderMessage}</span>
                </div>
              )}
            </div>

            {/* Architecture output mapping visualizer */}
            <div className="flex-1 p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4">
              <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Output Mapping & Knowledge Graph Bindings
              </h4>
              <p className="text-xs text-darkMuted leading-relaxed">
                Configure how response attributes map to Syntra's internal data model and Knowledge Graph relationships.
              </p>

              <div className="p-4 bg-darkBg border border-darkBorder rounded-xl space-y-3 font-mono text-[11px] text-gray-300 leading-relaxed">
                <div className="flex justify-between items-center text-neonIndigo border-b border-darkBorder pb-2 mb-2 font-bold uppercase tracking-wider">
                  <span>RESPONSE KEY</span>
                  <ArrowRight className="w-4 h-4" />
                  <span>GRAPH SCHEMA RELATIONSHIP</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>data[].employee_id</span>
                  <ArrowRight className="w-4 h-4 text-darkMuted" />
                  <span>Employee Node (ID match)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>data[].invoice_file</span>
                  <ArrowRight className="w-4 h-4 text-darkMuted" />
                  <span>stored_in (Document node relationship)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>data[].last_active</span>
                  <ArrowRight className="w-4 h-4 text-darkMuted" />
                  <span>last_sync (observability metadata)</span>
                </div>
              </div>

              <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl space-y-2 text-xs leading-relaxed text-yellow-400">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>RBAC & Tool Authorization Rule</span>
                </div>
                <p className="text-[11px] text-darkMuted">
                  Custom connectors registered will inherit developer scopes. Users must have `admin` or `ops_manager` permissions to call custom tool endpoints.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Controls */}
        {activeSubTab === "sync" && (
          <div className="space-y-6 flex-1 flex flex-col md:flex-row gap-6">
            
            {/* Sync Config form */}
            <div className="w-full md:w-1/3 p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4">
              <h4 className="text-xs font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Configure Synchronization Job
              </h4>
              <p className="text-[11px] text-darkMuted leading-relaxed">
                Setup data syncing schedules between Syntra and connected target applications.
              </p>

              <form onSubmit={handleConfigureSync} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Active Service Connection</label>
                  <select
                    value={syncConnectorKey}
                    onChange={(e) => setSyncConnectorKey(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  >
                    {connections.map(c => (
                      <option key={c.key} value={c.key}>{c.name}</option>
                    ))}
                    {connections.length === 0 && <option value="none">No active connections</option>}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Direction Method</label>
                  <select
                    value={syncDirection}
                    onChange={(e) => setSyncDirection(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  >
                    <option value="one_way">One-Way Sync (Sync into Syntra)</option>
                    <option value="two_way">Two-Way Sync (Full bidirectional synchronization)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">Sync Scheduling Type</label>
                  <select
                    value={syncType}
                    onChange={(e) => setSyncType(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo"
                  >
                    <option value="scheduled_1h">Every 1 Hour</option>
                    <option value="scheduled_12h">Every 12 Hours</option>
                    <option value="event_based">Real-Time Event Driven (Webhooks)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={connections.length === 0}
                  className="w-full py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors text-xs disabled:opacity-50"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configure Sync Job</span>
                </button>
              </form>
            </div>

            {/* Sync Status Grid */}
            <div className="flex-1 space-y-4">
              <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
                Sync Pipeline Overview
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {syncJobs.map(job => (
                  <div key={job.connector_key} className="p-4 bg-darkPanel border border-darkBorder rounded-2xl space-y-3">
                    <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2">
                      <h5 className="font-semibold text-gray-200 capitalize font-mono text-xs">{job.connector_key} Sync Pipeline</h5>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[9px] border border-emerald-500/20">
                        {job.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed text-darkMuted">
                      <div>Direction: <span className="text-gray-300 capitalize">{job.direction.replace("_", " ")}</span></div>
                      <div>Type: <span className="text-gray-300">{job.sync_type}</span></div>
                      <div>Records Synced: <span className="text-gray-300">{job.records_processed}</span></div>
                      <div>Conflicts Resolved: <span className="text-gray-300">{job.conflicts_count}</span></div>
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-darkBorder/40">
                      <span className="text-[10px] text-darkMuted font-mono">Last run: {job.last_sync}</span>
                      <button
                        onClick={() => handleTriggerSync(job.connector_key)}
                        className="px-2.5 py-1 bg-neonIndigo/10 hover:bg-neonIndigo hover:text-white border border-neonIndigo/30 rounded text-[10.5px] font-semibold text-neonIndigo transition-all cursor-pointer"
                      >
                        Sweep Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Monitoring Dashboard */}
        {activeSubTab === "monitoring" && (
          <div className="space-y-6 flex-1">
            <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
              Central Integrations Telemetry Dashboard
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* API Consumption Log */}
              <div className="p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-darkBorder/40 pb-2">
                  <Server className="w-5 h-5 text-neonIndigo" />
                  <h5 className="font-semibold text-gray-200 font-mono text-xs uppercase">API Rate & Telemetry Utilization</h5>
                </div>

                <div className="space-y-3.5 text-xs">
                  {metrics?.api_usage ? Object.entries(metrics.api_usage).map(([key, val]: any) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between items-center font-mono">
                        <span className="capitalize text-gray-300 font-semibold">{key}</span>
                        <span className="text-darkMuted">{val} / 5000 API Limit</span>
                      </div>
                      <div className="w-full bg-darkBg h-2 rounded-full overflow-hidden border border-darkBorder">
                        <div 
                          className="bg-neonIndigo h-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, (val / 5000) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-darkMuted font-mono">Loading metrics...</div>
                  )}
                </div>
              </div>

              {/* Event Logs & Sync History */}
              <div className="p-5 bg-darkPanel border border-darkBorder rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-darkBorder/40 pb-2">
                  <Activity className="w-5 h-5 text-neonTeal" />
                  <h5 className="font-semibold text-gray-200 font-mono text-xs uppercase">Integration Event Activity Feed</h5>
                </div>

                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {metrics?.sync_history ? metrics.sync_history.map((hist: any, index: number) => (
                    <div key={index} className="p-3 bg-darkBg border border-darkBorder rounded-xl flex items-center justify-between gap-3 font-mono text-[11px] leading-relaxed text-darkMuted">
                      <div className="space-y-1">
                        <div className="text-gray-300 font-semibold flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${hist.status === "completed" ? "bg-emerald-400" : "bg-rose-400"}`} />
                          <span>{hist.connector.toUpperCase()} Sweep</span>
                        </div>
                        <div>Processed {hist.records_processed} records. Errors: {hist.errors_count}.</div>
                      </div>
                      <span className="opacity-70 text-[9.5px]">{hist.timestamp}</span>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-darkMuted font-mono">No recent activity detected.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connection credentials modal */}
      {selectedConnector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-darkPanel border border-darkBorder w-full max-w-md rounded-2xl p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-sm font-semibold text-gray-200 font-mono uppercase tracking-wider">
              Link {selectedConnector.name}
            </h4>
            <p className="text-xs text-darkMuted leading-relaxed">
              {selectedConnector.description}
            </p>

            <form onSubmit={handleConnect} className="space-y-4 text-xs">
              {selectedConnector.is_oauth ? (
                <div className="p-4 border border-neonIndigo/20 bg-neonIndigo/5 text-neonIndigo rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>Redirection Flow Required</span>
                  </div>
                  <p className="text-[11px] text-darkMuted leading-relaxed">
                    Connecting to {selectedConnector.name} will trigger an authorization redirect. Credentials will be securely stored inside Credential Vault.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold">API Secret Token / Credentials Key</label>
                  <input
                    type="password"
                    required
                    placeholder="e.g. sk_live_..."
                    value={credentialsInput}
                    onChange={(e) => setCredentialsInput(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:border-neonIndigo font-mono"
                  />
                  <span className="text-[10px] text-darkMuted block">Your secret key is immediately encrypted and never exposed in UI responses.</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedConnector(null)}
                  className="px-4 py-2 bg-darkPanel hover:bg-darkBorder border border-darkBorder text-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {loading ? "Authenticating..." : selectedConnector.is_oauth ? "Authorize Connection" : "Verify & Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
