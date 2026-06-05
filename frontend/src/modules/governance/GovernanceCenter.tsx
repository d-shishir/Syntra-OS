import React, { useEffect, useState, useCallback } from "react";
import {
  Shield, ShieldAlert, FileText, Activity, AlertTriangle, Check, X,
  Search, Sliders, RefreshCw, Sparkles, Clock, Globe, Settings, Eye,
  Layers, Lock, Cpu, Play, CheckCircle2, TrendingUp, Send
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface AIPolicy {
  id: string;
  name: string;
  description: string;
  rule_condition: Record<string, any>;
  is_active: boolean;
}

interface AIAuditLog {
  id: string;
  timestamp: string;
  agent_name: string;
  user_id: string;
  tool_used: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  risk_level: string;
  status: string;
}

interface AIIncident {
  id: string;
  incident_type: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  resolved_at?: string;
}

interface ComplianceData {
  overall_compliance_score: number;
  active_violations_count: number;
  resolved_violations_count: number;
  domain_coverage: Record<string, {
    score: number;
    status: string;
    policy_rules_count: number;
  }>;
}

interface GovernanceStats {
  total_policy_evaluations: number;
  blocked_actions_count: number;
  policy_violations_count: number;
  open_incidents_count: number;
  active_rules_count: number;
  compliance_health_score: number;
  incident_response_avg_hours: number;
}

export const GovernanceCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "policies" | "audits" | "incidents" | "compliance">("dashboard");
  
  // API States
  const [policies, setPolicies] = useState<AIPolicy[]>([]);
  const [auditLogs, setAuditLogs] = useState<AIAuditLog[]>([]);
  const [incidents, setIncidents] = useState<AIIncident[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [stats, setStats] = useState<GovernanceStats | null>(null);

  // Focus States
  const [selectedAuditLog, setSelectedAuditLog] = useState<AIAuditLog | null>(null);
  const [auditTrace, setAuditTrace] = useState<any | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<AIIncident | null>(null);

  // Forms / Actions States
  const [newPolicy, setNewPolicy] = useState({ name: "", description: "", action: "payment", max_amount: 5000 });
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [investigatorNotes, setInvestigatorNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGovernanceData = useCallback(async () => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    setRefreshing(true);
    const headers = { "Authorization": `Bearer ${token}` };

    try {
      const [polRes, audRes, incRes, comRes, staRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/governance/policies`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/governance/audit-logs`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/governance/incidents`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/governance/compliance`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/governance/analytics`, { headers })
      ]);

      if (polRes.ok) setPolicies(await polRes.json());
      if (audRes.ok) setAuditLogs(await audRes.json());
      if (incRes.ok) setIncidents(await incRes.json());
      if (comRes.ok) setCompliance(await comRes.json());
      if (staRes.ok) setStats(await staRes.json());

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGovernanceData();
  }, [fetchGovernanceData]);

  const handleTogglePolicy = async (policyId: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/governance/policies/${policyId}/toggle`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        fetchGovernanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/governance/policies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newPolicy.name,
          description: newPolicy.description,
          rule_condition: { action: newPolicy.action, max_amount: newPolicy.max_amount }
        })
      });
      if (res.ok) {
        setShowAddPolicy(false);
        setNewPolicy({ name: "", description: "", action: "payment", max_amount: 5000 });
        alert("Compliance policy rule registered successfully!");
        fetchGovernanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditTrace = async (logId: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/governance/audit-logs/${logId}/trace`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setAuditTrace(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBeginInvestigation = async (incidentId: string) => {
    if (!investigatorNotes.trim()) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/governance/incidents/${incidentId}/investigate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ investigator_id: "sec_officer", notes: investigatorNotes })
      });
      if (res.ok) {
        setInvestigatorNotes("");
        alert("Investigation timeline updated!");
        fetchGovernanceData();
        // Reload details
        const refreshedIncidents = await (await fetch(`${BACKEND_URL}/api/v1/governance/incidents`, { headers: { "Authorization": `Bearer ${token}` } })).json();
        const matching = refreshedIncidents.find((i: any) => i.id === incidentId);
        if (matching) setSelectedIncident(matching);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/governance/incidents/${incidentId}/resolve`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Incident marked resolved. Policy boundaries validated.");
        fetchGovernanceData();
        setSelectedIncident(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "high": return "text-amber-400 border-amber-500/20 bg-amber-500/10";
      case "medium": return "text-purple-400 border-purple-500/20 bg-purple-500/10";
      default: return "text-gray-400 border-gray-500/20 bg-gray-500/10";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-neonIndigo animate-spin mx-auto" />
          <p className="text-xs text-darkMuted">Auditing AI Governance Guards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-darkBorder/60 pb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display font-black text-gray-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-neonIndigo" />
            AI Governance, Compliance & Risk Center
          </h2>
          <p className="text-xs text-darkMuted mt-1">
            Corporate control tower for AI safety, audit logs, policy enforcement checks, and incident response investigation.
          </p>
        </div>

        <button
          onClick={fetchGovernanceData}
          disabled={refreshing}
          className="p-2 border border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-200 rounded-lg flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="text-xs">Reprocess Audits</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-darkBorder/60 text-xs font-semibold gap-1">
        {(["dashboard", "policies", "audits", "incidents", "compliance"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize transition-all border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === tab 
                ? "border-neonIndigo text-neonIndigo" 
                : "border-transparent text-darkMuted hover:text-gray-200"
            }`}
          >
            {tab === "dashboard" ? "Risk Dashboard" : tab === "policies" ? "AI Policies Center" : tab === "audits" ? "Action Audit Explorer" : tab === "incidents" ? "SOC Incidents Workspace" : "Compliance Framework"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6 animate-fadeIn">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-[9px] font-mono uppercase text-darkMuted block">Policy Evaluations</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-gray-200">{stats.total_policy_evaluations}</span>
                <Cpu className="w-4 h-4 text-neonIndigo" />
              </div>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-[9px] font-mono uppercase text-darkMuted block">Blocked AI Actions</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-rose-400">{stats.blocked_actions_count}</span>
                <Lock className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-[9px] font-mono uppercase text-darkMuted block">Open Incidents</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-amber-400">{stats.open_incidents_count}</span>
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-[9px] font-mono uppercase text-darkMuted block">Active Policy Rules</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-sky-400">{stats.active_rules_count}</span>
                <Sliders className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-[9px] font-mono uppercase text-darkMuted block">Governance Score</span>
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-neonTeal">{stats.compliance_health_score}%</span>
                <CheckCircle2 className="w-4 h-4 text-neonTeal" />
              </div>
            </div>
          </div>

          {/* Core Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Violations */}
            <div className="lg:col-span-2 p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Recent System Policy Violations</h3>
              
              <div className="space-y-3">
                {incidents.filter(i => i.incident_type === "policy_violation").slice(0, 4).map(violation => (
                  <div key={violation.id} className="p-3 bg-darkBg border border-darkBorder rounded-lg flex items-start gap-3 text-xs font-mono">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-200 capitalize">{violation.incident_type.replace(/_/g, " ")}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getRiskColor(violation.severity)}`}>
                          {violation.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-darkMuted font-sans leading-relaxed">{violation.description}</p>
                      <span className="text-[9px] text-darkMuted block">Detected at: {new Date(violation.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {incidents.filter(i => i.incident_type === "policy_violation").length === 0 && (
                  <div className="text-center py-10 text-darkMuted text-xs">No recent policy breaches recorded.</div>
                )}
              </div>
            </div>

            {/* Risk Index Summary */}
            <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Executive Risk Metrics</h3>
              
              <div className="space-y-4 text-xs font-mono">
                <div className="p-4 bg-darkBg border border-darkBorder/60 rounded-lg space-y-1.5">
                  <span className="text-darkMuted block">Total Action Risk Score</span>
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-black text-gray-200">15.4</span>
                    <span className="text-[10px] text-emerald-400">✓ Nominal limits</span>
                  </div>
                </div>
                
                <p className="text-darkMuted font-sans text-[11px] leading-relaxed">
                  All active swarms, research routines, and document extraction workflows run under policy evaluations. Payments above $10,000 are blocked automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "policies" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Main List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Active Governance Rules</span>
              <button
                onClick={() => setShowAddPolicy(true)}
                className="px-2.5 py-1 text-xs bg-neonIndigo text-white rounded-lg font-semibold hover:bg-neonIndigo/85 cursor-pointer transition-all"
              >
                Create Policy
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {policies.map(p => (
                <div key={p.id} className="p-4 border border-darkBorder/60 bg-darkPanel/10 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-200">{p.name}</span>
                    <button
                      onClick={() => handleTogglePolicy(p.id)}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer ${
                        p.is_active 
                          ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-400" 
                          : "bg-gray-500/15 border-gray-500/20 text-darkMuted"
                      }`}
                    >
                      {p.is_active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </div>
                  <p className="text-darkMuted font-sans leading-relaxed text-[11px]">{p.description}</p>
                  <div className="p-2 bg-darkBg/60 border border-darkBorder/40 rounded text-[9px] font-mono text-darkMuted">
                    Condition: {JSON.stringify(p.rule_condition)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "audits" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Audit Logs list */}
          <div className="lg:col-span-3 space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 block">AI Agent Action Log History</span>
            
            <div className="border border-darkBorder rounded-xl overflow-hidden bg-darkPanel/15">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-darkBorder bg-darkBg/60 text-darkMuted font-mono">
                    <th className="p-3">Agent / Tool</th>
                    <th className="p-3">Risk Level</th>
                    <th className="p-3">Action Status</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-darkMuted">No audit logs recorded in database.</td>
                    </tr>
                  ) : (
                    auditLogs.map(l => (
                      <tr 
                        key={l.id}
                        onClick={() => { setSelectedAuditLog(l); fetchAuditTrace(l.id); }}
                        className={`border-b border-darkBorder/60 hover:bg-darkBorder/10 cursor-pointer transition-colors ${
                          selectedAuditLog?.id === l.id ? "bg-darkBorder/20" : ""
                        }`}
                      >
                        <td className="p-3 font-semibold text-gray-200">
                          <div>{l.agent_name}</div>
                          <div className="text-[10px] text-darkMuted font-mono font-normal">{l.tool_used}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold border capitalize ${getRiskColor(l.risk_level)}`}>
                            {l.risk_level}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`font-mono text-[10px] ${l.status === "Block" ? "text-rose-400" : "text-emerald-400"}`}>{l.status}</span>
                        </td>
                        <td className="p-3 text-darkMuted">{new Date(l.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3">
                          <Eye className="w-4 h-4 text-darkMuted" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trace Drawer */}
          <div>
            {selectedAuditLog && auditTrace ? (
              <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4 animate-fadeIn text-xs">
                <div className="flex justify-between items-center border-b border-darkBorder/50 pb-3">
                  <h3 className="font-bold text-gray-100 font-mono">Decision Trace Map</h3>
                  <button onClick={() => { setSelectedAuditLog(null); setAuditTrace(null); }} className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 font-mono">
                  <div className="space-y-1">
                    <span className="text-[9px] text-darkMuted uppercase block">Retrieval Context Documents</span>
                    {auditTrace.trace.retrieved_documents.map((d: any, idx: number) => (
                      <div key={idx} className="p-2 bg-darkBg/60 border border-darkBorder/40 rounded text-[10px] flex justify-between">
                        <span className="truncate text-gray-200">{d.filename}</span>
                        <span className="text-emerald-400 font-bold">{(d.confidence * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-darkMuted uppercase block">Reasoning Chain</span>
                    <div className="space-y-1 text-[10px] text-darkMuted leading-relaxed">
                      {auditTrace.trace.reasoning_steps.map((step: string, idx: number) => (
                        <div key={idx}>{step}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl bg-darkPanel/5">
                Select an audit trace log row to evaluate retrieval documents and agent reasoning step trails.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "incidents" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* List */}
          <div className="lg:col-span-3 space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 block">Security Incidents Timeline</span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incidents.map(inc => (
                <div 
                  key={inc.id}
                  onClick={() => { setSelectedIncident(inc); }}
                  className={`p-4 border rounded-xl bg-darkPanel/10 space-y-3 cursor-pointer hover:border-darkBorder transition-all ${
                    selectedIncident?.id === inc.id ? "border-neonIndigo" : "border-darkBorder/60"
                  }`}
                >
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-semibold text-gray-200 capitalize text-xs">{inc.incident_type.replace(/_/g, " ")}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      inc.status === "Resolved" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {inc.status.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-xs text-darkMuted leading-normal">{inc.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Operations */}
          <div>
            {selectedIncident ? (
              <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4 animate-fadeIn text-xs">
                <div className="flex justify-between items-center border-b border-darkBorder/50 pb-3">
                  <h3 className="font-bold text-gray-100 font-mono">SOC Investigation</h3>
                  <button onClick={() => setSelectedIncident(null)} className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-darkMuted block">Investigator Notes</label>
                    <textarea
                      value={investigatorNotes}
                      onChange={(e) => setInvestigatorNotes(e.target.value)}
                      placeholder="Add compliance audit updates..."
                      className="w-full bg-darkBg border border-darkBorder rounded p-2 text-xs text-gray-200 focus:outline-none min-h-[80px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBeginInvestigation(selectedIncident.id)}
                      className="flex-1 py-1.5 bg-darkBorder text-gray-200 hover:bg-darkBorder/80 rounded font-semibold text-[11px] cursor-pointer"
                    >
                      Update Investigation
                    </button>
                    {selectedIncident.status !== "Resolved" && (
                      <button
                        onClick={() => handleResolveIncident(selectedIncident.id)}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-500/85 text-white rounded font-semibold text-[11px] cursor-pointer"
                      >
                        Resolve Breach
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl bg-darkPanel/5">
                Select an incident card to log investigator file entries or resolve active policy violations.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "compliance" && compliance && (
        <div className="space-y-6 animate-fadeIn text-xs font-mono">
          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Regulatory Framework Coverage Rates</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(compliance.domain_coverage).map(([domName, domData]) => (
                <div key={domName} className="p-4 bg-darkBg border border-darkBorder/60 rounded-lg space-y-2">
                  <span className="text-neonTeal capitalize font-bold block">{domName.replace(/_/g, " ")}</span>
                  <div className="flex justify-between items-end mt-1">
                    <span className="text-xl font-bold text-gray-200">{domData.score}%</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      domData.status === "Nominal" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {domData.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Policy Modal */}
      {showAddPolicy && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn text-xs">
          <div className="max-w-md w-full p-6 border border-darkBorder rounded-2xl bg-darkPanel/100 space-y-4">
            <div className="flex justify-between items-center border-b border-darkBorder/60 pb-3">
              <h3 className="font-bold text-gray-200 font-mono">Create AI Policy</h3>
              <button onClick={() => setShowAddPolicy(false)} className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicySubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Policy Name</label>
                <input
                  type="text"
                  required
                  value={newPolicy.name}
                  onChange={(e) => setNewPolicy(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  placeholder="e.g. Limit AI Payment Clearances"
                />
              </div>

              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Description</label>
                <textarea
                  required
                  value={newPolicy.description}
                  onChange={(e) => setNewPolicy(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none min-h-[60px]"
                  placeholder="Write description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Action Type</label>
                  <select
                    value={newPolicy.action}
                    onChange={(e) => setNewPolicy(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  >
                    <option value="payment">Payment Approval</option>
                    <option value="payroll_change">Payroll Modification</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Limit Amount ($)</label>
                  <input
                    type="number"
                    value={newPolicy.max_amount}
                    onChange={(e) => setNewPolicy(prev => ({ ...prev, max_amount: parseInt(e.target.value) }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-neonIndigo text-white font-semibold rounded cursor-pointer transition-colors text-center"
              >
                Register AI Policy
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
