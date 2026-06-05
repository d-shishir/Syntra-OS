import React, { useState, useEffect } from "react";
import { 
  Key, Cpu, Terminal, RefreshCw, Send, CheckCircle, Plus, 
  Trash2, Globe, Layers, Activity, Copy, Check, Eye, EyeOff
} from "lucide-react";
import { apiClient } from "../../services/apiClient";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
  target_url: string;
  events: string[];
  is_active: boolean;
}

interface WebhookLog {
  id: string;
  event_type: string;
  payload: any;
  status_code: number;
  status: string;
  attempt_count: number;
  timestamp: string;
}

interface GatewayLog {
  id: string;
  path: string;
  method: string;
  status_code: number;
  latency_ms: number;
  risk_score: number;
  timestamp: string;
}

export const DeveloperPortal: React.FC = () => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [attempts, setAttempts] = useState<WebhookLog[]>([]);
  const [gatewayLogs, setGatewayLogs] = useState<GatewayLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Playground State
  const [playEndpoint, setPlayEndpoint] = useState("/gateway/workflows/wf_123/trigger");
  const [playPayload, setPlayPayload] = useState('{\n  "action": "validate",\n  "amount": 25000\n}');
  const [playResponse, setPlayResponse] = useState<any>(null);
  const [playLoading, setPlayLoading] = useState(false);

  // Form inputs
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["workflows:read"]);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);

  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(["invoice_paid"]);

  const [activeSubTab, setActiveSubTab] = useState<"keys" | "webhooks" | "playground" | "logs">("keys");
  const [sdkLang, setSdkLang] = useState<"python" | "javascript" | "go">("python");
  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Stub org / ws ids for mock setups
  const activeOrgId = "d87ad52a-9e12-4fc4-8e10-38827da23a2a"; 
  const activeWsId = "602d1d0e-2be2-442b-b6fb-cfa23e5927ad";

  useEffect(() => {
    fetchDevData();
  }, []);

  const fetchDevData = async () => {
    setLoading(true);
    try {
      const [keysRes, whRes, logsRes, attemptsRes] = await Promise.all([
        apiClient.get(`/developer/keys?organization_id=${activeOrgId}`),
        apiClient.get(`/developer/webhooks?organization_id=${activeOrgId}`),
        apiClient.get(`/developer/logs?organization_id=${activeOrgId}`),
        apiClient.get(`/developer/webhooks/attempts?organization_id=${activeOrgId}`)
      ]);
      setKeys(keysRes || []);
      setWebhooks(whRes || []);
      setGatewayLogs(logsRes || []);
      setAttempts(attemptsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    try {
      const newKey = await apiClient.post("/developer/keys", {
        name: keyName,
        organization_id: activeOrgId,
        workspace_id: activeWsId,
        scopes: keyScopes
      });
      setKeys([...keys, newKey]);
      setNewRawKey(newKey.raw_key);
      setKeyName("");
      setToast("API Key created! Please copy it immediately.");
    } catch (err) {
      setToast("Failed to create key.");
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await apiClient.post(`/developer/keys/${id}/revoke`);
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: false } : k));
      setToast("API key revoked.");
    } catch (err) {
      setToast("Failed to revoke key.");
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName || !whUrl) return;
    try {
      const newSub = await apiClient.post("/developer/webhooks", {
        name: whName,
        organization_id: activeOrgId,
        workspace_id: activeWsId,
        target_url: whUrl,
        events: whEvents
      });
      setWebhooks([...webhooks, newSub]);
      setWhName("");
      setWhUrl("");
      setToast("Webhook subscription established.");
    } catch (err) {
      setToast("Failed to create webhook.");
    }
  };

  const handleRunPlayground = async () => {
    setPlayLoading(true);
    try {
      let payloadParsed = {};
      try {
        payloadParsed = JSON.parse(playPayload);
      } catch (err) {
        setToast("Malformed JSON payload.");
        setPlayLoading(false);
        return;
      }
      const res = await apiClient.post("/developer/playground", {
        endpoint: playEndpoint,
        payload: payloadParsed
      });
      setPlayResponse(res.response);
      setToast("Playground call processed.");
    } catch (err) {
      setPlayResponse({ error: "Failed to connect to playground endpoint sandbox." });
    } finally {
      setPlayLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const sdkSnippets = {
    python: `import requests\n\n# Call Syntra OS Programmatic Gateway\nurl = "https://api.syntraos.com/v1${playEndpoint}"\nheaders = {\n  "Authorization": "Bearer ${newRawKey || 'sy_live_...'}",\n  "Content-Type": "application/json"\n}\n\nresponse = requests.post(url, json=${playPayload}, headers=headers)\nprint(response.json())`,
    javascript: `// Call Syntra OS Programmatic Gateway\nfetch("https://api.syntraos.com/v1${playEndpoint}", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ${newRawKey || 'sy_live_...'}",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${playPayload})\n})\n.then(res => res.json())\n.then(data => console.log(data));`,
    go: `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\tfmt.Println("Syntra Go SDK Stub loaded")\n}`
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-200">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border bg-darkPanel border-neonTeal/30 text-neonTeal flex items-center gap-2.5 z-50">
          <CheckCircle className="w-4 h-4" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-darkBorder/60 bg-gradient-to-r from-darkPanel via-darkPanel/80 to-neonTeal/5 p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-neonTeal font-mono text-xs uppercase tracking-widest mb-1.5">
              <Cpu className="w-3.5 h-3.5" />
              <span>Platform Services</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-100">
              Developer Ecosystem & API Gateway
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Build custom integrations, programmatically invoke AI agents, register webhook listeners, and observe API metrics.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Sub Tab switch */}
      <div className="flex gap-2 border-b border-darkBorder/40 pb-2.5">
        {[
          { id: "keys", label: "API Credentials", icon: Key },
          { id: "webhooks", label: "Webhooks Integration", icon: Globe },
          { id: "playground", label: "Developer Playground", icon: Terminal },
          { id: "logs", label: "API Logs Explorer", icon: Activity }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? "bg-neonTeal/10 text-neonTeal border-neonTeal/20"
                  : "bg-transparent border-transparent text-darkMuted hover:text-gray-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left pane: Subtab Details */}
        <div className="lg:col-span-2 space-y-6">
          {activeSubTab === "keys" && (
            <div className="space-y-6">
              {/* Credentials list */}
              <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                  Active Developer Credentials
                </h3>

                <div className="space-y-3">
                  {keys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3.5 bg-darkBg/60 border border-darkBorder/40 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-gray-200">{k.name}</h4>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            k.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {k.is_active ? "ACTIVE" : "REVOKED"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-darkMuted font-mono mt-1">
                          <span>Prefix: {k.prefix}</span>
                          <span>•</span>
                          <span>Scopes: {k.scopes.join(", ")}</span>
                        </div>
                      </div>
                      {k.is_active && (
                        <button
                          onClick={() => handleRevokeKey(k.id)}
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded px-2.5 py-1.5 cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                  {keys.length === 0 && (
                    <p className="text-xs text-darkMuted text-center py-4">No API keys registered yet.</p>
                  )}
                </div>
              </div>

              {/* Created Key Reveal Callout */}
              {newRawKey && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 space-y-3 animate-fadeIn">
                  <h4 className="text-xs font-bold text-emerald-400">API Key Generated Successfully</h4>
                  <p className="text-[11px] text-gray-300">
                    Copy this key now. For your security, it will not be displayed again.
                  </p>
                  <div className="flex items-center gap-2 bg-darkBg p-3 rounded-lg border border-darkBorder/60 font-mono text-xs">
                    <span className="text-emerald-300 flex-1 truncate">{newRawKey}</span>
                    <button
                      onClick={() => copyToClipboard(newRawKey)}
                      className="p-1 text-darkMuted hover:text-white transition-colors"
                      title="Copy Key"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Generate Credential Form */}
              <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-semibold text-gray-200">Initialize API Credentials</h4>
                <form onSubmit={handleCreateKey} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Key Label Name</label>
                      <input
                        type="text"
                        placeholder="Production Webhook ERP API"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Scoped Access Boundaries</label>
                      <select
                        multiple
                        value={keyScopes}
                        onChange={(e) => setKeyScopes(Array.from(e.target.selectedOptions, option => option.value))}
                        className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonTeal h-20"
                      >
                        <option value="*">Full Access (*)</option>
                        <option value="workflows:read">workflows:read</option>
                        <option value="workflows:write">workflows:write</option>
                        <option value="agents:write">agents:write</option>
                        <option value="documents:read">documents:read</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="bg-neonTeal hover:bg-neonTeal/80 text-darkBg rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Generate Credentials Key
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Webhooks Section */}
          {activeSubTab === "webhooks" && (
            <div className="space-y-6">
              {/* Configured webhooks */}
              <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                  Webhook Subscriptions
                </h3>
                <div className="space-y-3">
                  {webhooks.map((w) => (
                    <div key={w.id} className="p-3.5 bg-darkBg/60 border border-darkBorder/40 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-200">{w.name}</h4>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400">
                          LISTENING
                        </span>
                      </div>
                      <div className="text-[10px] text-darkMuted font-mono">
                        <p className="truncate">Url: {w.target_url}</p>
                        <p className="mt-1">Events: {w.events.join(", ")}</p>
                      </div>
                    </div>
                  ))}
                  {webhooks.length === 0 && (
                    <p className="text-xs text-darkMuted text-center py-4">No active webhook endpoints.</p>
                  )}
                </div>
              </div>

              {/* Webhook form */}
              <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-semibold text-gray-200">Register Webhook Target URL</h4>
                <form onSubmit={handleCreateWebhook} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Target Description</label>
                      <input
                        type="text"
                        placeholder="Billing Sync Endpoint"
                        value={whName}
                        onChange={(e) => setWhName(e.target.value)}
                        className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Endpoint URL</label>
                      <input
                        type="url"
                        placeholder="https://yourserver.com/webhooks"
                        value={whUrl}
                        onChange={(e) => setWhUrl(e.target.value)}
                        className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Event Triggers</label>
                    <div className="flex gap-4 text-xs mt-1">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" defaultChecked className="rounded border-darkBorder bg-darkBg text-neonTeal" />
                        <span>invoice_paid</span>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" className="rounded border-darkBorder bg-darkBg text-neonTeal" />
                        <span>member_joined</span>
                      </label>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="bg-neonTeal hover:bg-neonTeal/80 text-darkBg rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Register Endpoint
                  </button>
                </form>
              </div>

              {/* Webhook Delivery Attempts Audit */}
              <div className="bg-darkPanel/40 border border-darkBorder/40 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-darkBorder/40">
                  <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                    Webhook Attempts Audit Logs
                  </h3>
                </div>
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-darkPanel/80 text-darkMuted border-b border-darkBorder/40 uppercase tracking-widest text-[9px] font-mono">
                    <tr>
                      <th className="p-4">Event</th>
                      <th className="p-4">Target</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Retries</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/20">
                    {attempts.map((att) => (
                      <tr key={att.id} className="hover:bg-darkPanel/20 transition-colors">
                        <td className="p-4 font-mono font-semibold text-gray-200">{att.event_type}</td>
                        <td className="p-4 font-mono text-darkMuted text-[10px] truncate max-w-xs">https://httpbin.org/post</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            att.status_code === 200 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                          }`}>
                            {att.status_code} {att.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-darkMuted">{att.attempt_count}</td>
                        <td className="p-4 text-darkMuted text-[10px]">Just now</td>
                      </tr>
                    ))}
                    {attempts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-darkMuted">No webhook delivery logs.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Playground Section */}
          {activeSubTab === "playground" && (
            <div className="space-y-6">
              <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-200">API Playground Sandbox</h4>
                    <p className="text-xs text-darkMuted mt-0.5">Test endpoints against isolated tenant database.</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={playEndpoint}
                      onChange={(e) => setPlayEndpoint(e.target.value)}
                      className="bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                    >
                      <option value="/gateway/workflows/wf_123/trigger">POST /gateway/workflows/{"{id}"}/trigger</option>
                      <option value="/gateway/agents/ag_88/invoke">POST /gateway/agents/{"{id}"}/invoke</option>
                      <option value="/gateway/documents">GET /gateway/documents</option>
                    </select>
                    <button
                      onClick={handleRunPlayground}
                      disabled={playLoading}
                      className="bg-neonTeal hover:bg-neonTeal/80 text-darkBg px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      {playLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Send Request</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Body JSON Payload</label>
                    <textarea
                      value={playPayload}
                      onChange={(e) => setPlayPayload(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none focus:border-neonTeal h-52 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Response Payload</label>
                    <div className="w-full bg-darkBg border border-darkBorder/60 rounded-lg p-3 text-xs font-mono text-emerald-400 h-52 overflow-y-auto whitespace-pre">
                      {playResponse ? JSON.stringify(playResponse, null, 2) : "// Awaiting sandbox API trigger response..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeSubTab === "logs" && (
            <div className="bg-darkPanel/40 border border-darkBorder/40 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-darkBorder/40">
                <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                  Request Telemetry Logs
                </h3>
              </div>
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-darkPanel/80 text-darkMuted border-b border-darkBorder/40 uppercase tracking-widest text-[9px] font-mono">
                  <tr>
                    <th className="p-4">Method</th>
                    <th className="p-4">Path</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Latency</th>
                    <th className="p-4">Risk Score</th>
                    <th className="p-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-darkBorder/20">
                  {gatewayLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-darkPanel/20 transition-colors">
                      <td className="p-4 font-mono font-semibold text-neonTeal">{l.method}</td>
                      <td className="p-4 font-mono text-gray-200 truncate max-w-xs">{l.path}</td>
                      <td className="p-4 font-mono text-emerald-400">{l.status_code}</td>
                      <td className="p-4 font-mono text-darkMuted">{l.latency_ms}ms</td>
                      <td className="p-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          l.risk_score > 50 ? "bg-rose-500/10 text-rose-400" : "bg-darkBorder/60 text-darkMuted"
                        }`}>
                          {l.risk_score}
                        </span>
                      </td>
                      <td className="p-4 text-darkMuted text-[10px]">Just now</td>
                    </tr>
                  ))}
                  {gatewayLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-darkMuted">No request logs registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right pane: SDK snippet docs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                SDK Generator Snippets
              </h3>
              <div className="flex gap-1.5 bg-darkBg/60 p-1 rounded border border-darkBorder/40">
                {(["python", "javascript", "go"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSdkLang(lang)}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-all ${
                      sdkLang === lang ? "bg-neonTeal/10 text-neonTeal" : "text-darkMuted hover:text-gray-200"
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-darkBg rounded-lg p-3 border border-darkBorder/60 overflow-x-auto">
              <pre className="text-[10px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">
                {sdkSnippets[sdkLang]}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
