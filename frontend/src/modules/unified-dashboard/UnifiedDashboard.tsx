import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Activity, Cpu, ShieldAlert, AlertTriangle, CheckCircle2, 
  Workflow, Users, RefreshCw, Send, Search, Sparkles, 
  ArrowUpRight, Sliders, Server, Zap, Check, X, Shield, Lock, Bell
} from "lucide-react";

interface OverviewWidgets {
  active_workflows: number;
  running_agents: number;
  pending_approvals: number;
  failed_jobs: number;
  crm_leads: number;
  finance_alerts: number;
}

interface ActivityEvent {
  event_type: string;
  timestamp: string;
  source: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}

interface HealthMetrics {
  health_score: number;
  status: "healthy" | "degraded" | "critical";
  deductions: Record<string, number>;
  metrics: {
    avg_api_latency_ms: number;
    workflow_success_rate: number;
    agent_success_rate: number;
    error_frequency_24h: number;
    queue_backlog: number;
  };
}

interface InboxItem {
  id: string;
  type: "approval" | "alert";
  title: string;
  message: string;
  priority: string;
  created_at: string;
  metadata: Record<string, any>;
}

const BACKEND_URL = "http://localhost:8000";

export const UnifiedDashboard: React.FC = () => {
  const [widgets, setWidgets] = useState<OverviewWidgets>({
    active_workflows: 0,
    running_agents: 0,
    pending_approvals: 0,
    failed_jobs: 0,
    crm_leads: 0,
    finance_alerts: 0
  });
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active User Context
  const [token, setToken] = useState<string | null>(localStorage.getItem("syntra_token"));
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Quick Action States
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchCrmQuery, setSearchCrmQuery] = useState("");
  const [crmResults, setCrmResults] = useState<any[] | null>(null);
  const [ragQuestion, setRagQuestion] = useState("");
  const [ragAnswer, setRagAnswer] = useState<any | null>(null);

  // Manual Credentials Login State
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Decode base64url encoded JWT payload locally in guest/simulation sandbox environment
  const decodeJwt = (activeToken: string) => {
    try {
      const base64Url = activeToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  // Extract active user context from local JWT token
  const fetchUserContext = useCallback((activeToken: string) => {
    const payload = decodeJwt(activeToken);
    if (payload) {
      setCurrentUser({
        id: payload.sub,
        name: payload.role === "admin" 
          ? "Admin Director" 
          : payload.role.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        role: payload.role,
        department: payload.department
      });
    } else {
      localStorage.removeItem("syntra_token");
      setToken(null);
      setCurrentUser(null);
    }
  }, []);

  // Fetch all aggregated logs
  const fetchDashboardData = useCallback(async () => {
    const activeToken = localStorage.getItem("syntra_token");
    if (!activeToken) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const headers = { "Authorization": `Bearer ${activeToken}` };

    try {
      const [overRes, healthRes, inboxRes, sumRes, histRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/dashboard/overview`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/dashboard/health`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/dashboard/inbox`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/dashboard/summary`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/dashboard/activity-feed/history`, { headers })
      ]);

      if (overRes.ok) {
        const data = await overRes.json();
        setWidgets(data.widgets);
      }
      if (healthRes.ok) setHealth(await healthRes.json());
      if (inboxRes.ok) setInbox(await inboxRes.json());
      if (sumRes.ok) {
        const data = await sumRes.json();
        setSummary(data.summary);
      }
      if (histRes.ok) setActivityFeed(await histRes.json());

    } catch (e) {
      console.error("Error loading dashboard aggregation:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Set up SSE Event Stream
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchUserContext(token);
    fetchDashboardData();

    // Poll overview stats and inbox every 6 seconds to capture background metrics updates
    const pollInterval = setInterval(() => {
      fetchDashboardData();
    }, 6000);

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sse = new EventSource(`${BACKEND_URL}/api/v1/dashboard/activity-feed/stream`);
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.ping) return; // Keep-alive ping

          setActivityFeed(prev => {
            // Check if matches, else insert at top and keep maximum 40 entries
            const list = [parsed, ...prev];
            return list.slice(0, 40);
          });
        } catch (err) {
          console.error("Error parsing SSE feed event:", err);
        }
      };

      sse.onerror = () => {
        sse.close();
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      clearInterval(pollInterval);
    };
  }, [token, fetchDashboardData, fetchUserContext]);

  // Handle manual login trigger
  const handleLoginSubmit = async (e: React.FormEvent | string, manualPassword?: string) => {
    if (typeof e !== "string") {
      e.preventDefault();
    }
    setLoginError(null);
    setLoginLoading(true);

    const email = typeof e === "string" ? e : emailInput;
    const password = typeof e === "string" ? manualPassword : passwordInput;

    console.log("UnifiedDashboard: Attempting login for", email, "with password", password);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        console.log("UnifiedDashboard: Login success. Token acquired.");
        localStorage.setItem("syntra_token", data.access_token);
        setToken(data.access_token);
        setLoading(true);
      } else {
        const errData = await res.json();
        console.error("UnifiedDashboard: Login failed", errData);
        setLoginError(errData.detail || "Authentication rejected.");
      }
    } catch (err) {
      console.error("UnifiedDashboard: Network error during login", err);
      setLoginError("Failed to reach security authentication service.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Execute Quick-Action call helper
  const handleQuickAction = async (actionName: string, params: Record<string, any>) => {
    setActionLoading(actionName);
    const activeToken = localStorage.getItem("syntra_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/dashboard/quick-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: actionName, parameters: params })
      });

      if (res.ok) {
        const result = await res.json();
        alert(result.message || "Action executed successfully!");
        fetchDashboardData();
        return result;
      } else {
        const errData = await res.json();
        alert(`Action Failed: ${errData.detail || "Unauthorized execution."}`);
      }
    } catch (e) {
      alert("Network error sending operation command.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCrmSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCrmQuery.trim()) return;
    const token = localStorage.getItem("syntra_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/dashboard/quick-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "search_leads", parameters: { query: searchCrmQuery } })
      });
      if (res.ok) {
        const data = await res.json();
        setCrmResults(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRagQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuestion.trim()) return;
    const token = localStorage.getItem("syntra_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/dashboard/quick-action`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "query_rag", parameters: { question: ragQuestion } })
      });
      if (res.ok) {
        const data = await res.json();
        setRagAnswer(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case "critical": return "border-l-rose-500 bg-rose-500/5 text-rose-400";
      case "high": return "border-l-amber-500 bg-amber-500/5 text-amber-400";
      case "medium": return "border-l-neonTeal bg-neonTeal/5 text-neonTeal";
      default: return "border-l-gray-600 bg-darkPanel/10 text-darkMuted";
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "critical": return <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      case "high": return <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">HIGH</span>;
      default: return <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-gray-500/20 text-gray-400 border border-gray-500/35">MEDIUM</span>;
    }
  };

  // RBAC Gating parameters
  const userRole = currentUser?.role || "admin";
  const userDept = currentUser?.department || "system";

  const isFinanceVisible = userRole === "admin" || userDept === "finance";
  const isCrmVisible = userRole === "admin" || userDept === "sales";
  const isOpsVisible = userRole === "admin" || userDept === "operations" || userDept === "system";

  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 border border-darkBorder rounded-2xl bg-darkPanel/15 space-y-6 animate-scaleUp">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-200">Authenticate Syntra Session</h3>
          <p className="text-xs text-darkMuted">Enter your enterprise credentials or quick-select a profile to access the Control Center.</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="text-darkMuted font-semibold">Email Address</label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
              placeholder="e.g. admin@syntra.io"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-darkMuted font-semibold">Password</label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {loginError && (
            <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-400 rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            {loginLoading ? "Authenticating..." : "Sign In to Platform"}
          </button>
        </form>


      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-xl font-display font-extrabold text-gray-200 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neonIndigo" />
            Syntra Operations Control Center
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Real-time corporate metrics summary, AI swarm coordinator, CRM lead signals, and compliance approvals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-darkMuted flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            LIVE EVENTS GATEWAY CONNECTED
          </span>

          {currentUser && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-darkPanel/60 border border-darkBorder px-2.5 py-1.5 rounded text-gray-200">
                {currentUser.name} ({currentUser.role.toUpperCase()})
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem("syntra_token");
                  setToken(null);
                  setCurrentUser(null);
                }}
                className="p-1.5 rounded-lg bg-darkPanel/40 hover:bg-rose-500/20 text-darkMuted hover:text-rose-400 border border-darkBorder hover:border-rose-500/35 transition-all text-xs cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}

          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="p-2 rounded-lg bg-darkPanel/40 hover:bg-darkPanel border border-darkBorder hover:border-darkBorder/100 transition-all text-darkMuted hover:text-gray-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Hero AI Insights Overview Panel */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-neonIndigo/10 to-neonTeal/5 border border-neonIndigo/20 flex flex-col sm:flex-row items-start gap-4 animate-fadeIn">
        <div className="p-3 rounded-xl bg-neonIndigo/20 border border-neonIndigo/30 text-neonIndigo mt-1">
          <Sparkles className="w-5 h-5 fill-current" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-mono font-bold text-neonIndigo uppercase tracking-widest">Executive AI Operations digest</h3>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">{summary || "Generating system overview digest..."}</p>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Columns (3 span): Widgets, Quick Actions, Charts */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Widget Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Health Score */}
            <div className="p-4 rounded-xl border border-darkBorder bg-darkPanel/10 space-y-2 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">System Health</span>
              <div className="flex items-end justify-between">
                <span className={`text-3xl font-display font-black leading-none ${
                  health?.status === "healthy" ? "text-emerald-400" : health?.status === "degraded" ? "text-amber-400" : "text-rose-500"
                }`}>
                  {health?.health_score ?? "100"}
                </span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                  health?.status === "healthy" ? "bg-emerald-500/10 text-emerald-400" : health?.status === "degraded" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {(health?.status || "HEALTHY").toUpperCase()}
                </span>
              </div>
            </div>

            {/* Active Workflows */}
            <div className="p-4 rounded-xl border border-darkBorder bg-darkPanel/10 space-y-2 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">Active Workflows</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-display font-black text-gray-200 leading-none">{widgets.active_workflows}</span>
                <Workflow className="w-5 h-5 text-neonIndigo opacity-60" />
              </div>
            </div>

            {/* AI Swarm Agents */}
            <div className="p-4 rounded-xl border border-darkBorder bg-darkPanel/10 space-y-2 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">Swarm Agents</span>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-display font-black text-gray-200 leading-none">{widgets.running_agents}</span>
                <Users className="w-5 h-5 text-neonTeal opacity-60" />
              </div>
            </div>

            {/* Pending Approvals */}
            <div className="p-4 rounded-xl border border-darkBorder bg-darkPanel/10 space-y-2 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">Pending Approvals</span>
              <div className="flex items-end justify-between">
                <span className={`text-3xl font-display font-black leading-none ${widgets.pending_approvals > 0 ? "text-amber-400" : "text-gray-200"}`}>
                  {widgets.pending_approvals}
                </span>
                <ShieldAlert className="w-5 h-5 text-amber-500 opacity-60" />
              </div>
            </div>

          </div>

          {/* Quick Action Center */}
          <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/15 space-y-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-neonIndigo" />
              Quick Action Control Center
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Trigger & Ops Actions */}
              {isOpsVisible && (
                <div className="p-4 bg-darkBg border border-darkBorder/60 rounded-lg space-y-3">
                  <span className="text-[10px] font-mono font-bold text-darkMuted block">Workflow & Jobs Dispatch</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={() => handleQuickAction("trigger_workflow", { workflow_id: "doc_verification_pipeline" })}
                      disabled={actionLoading !== null}
                      className="py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded transition-colors cursor-pointer text-[11px] disabled:opacity-50 text-center"
                    >
                      Verify Invoice Doc
                    </button>
                    <button
                      onClick={() => handleQuickAction("trigger_workflow", { workflow_id: "payroll_calculation_sync" })}
                      disabled={actionLoading !== null}
                      className="py-2 bg-neonTeal hover:bg-neonTeal/85 text-white font-semibold rounded transition-colors cursor-pointer text-[11px] disabled:opacity-50 text-center"
                    >
                      Sync Payroll calculations
                    </button>
                  </div>
                </div>
              )}

              {/* RAG Query Field */}
              <div className="p-4 bg-darkBg border border-darkBorder/60 rounded-lg space-y-2">
                <span className="text-[10px] font-mono font-bold text-darkMuted block">Quick RAG Knowledge Search</span>
                <form onSubmit={handleRagQuery} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask standard library questions..."
                    value={ragQuestion}
                    onChange={(e) => setRagQuestion(e.target.value)}
                    className="flex-1 bg-darkPanel border border-darkBorder rounded px-3 py-1 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                  />
                  <button type="submit" className="p-1.5 rounded bg-neonTeal text-white hover:bg-neonTeal/85 transition-colors cursor-pointer">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </form>
                {ragAnswer && (
                  <div className="p-2 bg-darkPanel/50 rounded border border-darkBorder/50 text-[10px] text-gray-300 font-mono mt-1 whitespace-pre-wrap select-all max-h-[80px] overflow-y-auto">
                    {ragAnswer.answer}
                  </div>
                )}
              </div>

              {/* CRM Search Field */}
              {isCrmVisible && (
                <div className="p-4 bg-darkBg border border-darkBorder/60 rounded-lg space-y-2 md:col-span-2">
                  <span className="text-[10px] font-mono font-bold text-darkMuted block">Query CRM Lead Records</span>
                  <form onSubmit={handleCrmSearch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search company names or contacts..."
                      value={searchCrmQuery}
                      onChange={(e) => setSearchCrmQuery(e.target.value)}
                      className="flex-1 bg-darkPanel border border-darkBorder rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none"
                    />
                    <button type="submit" className="px-4 bg-darkBorder text-gray-200 hover:bg-darkBorder/100 border border-darkBorder rounded transition-colors cursor-pointer text-xs">
                      Search CRM
                    </button>
                  </form>
                  {crmResults && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {crmResults.length === 0 ? (
                        <div className="text-[10px] text-darkMuted py-1">No CRM profiles matched query.</div>
                      ) : (
                        crmResults.map((lead: any) => (
                          <div key={lead.id} className="p-2 bg-darkPanel/60 rounded border border-darkBorder/50 text-[10px]">
                            <span className="font-semibold block text-gray-200">{lead.name} ({lead.company})</span>
                            <span className="text-darkMuted font-mono text-[9px] mt-0.5 block">{lead.email} | Status: <span className="capitalize">{lead.status}</span></span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Business Intelligence Summary Snapshots & Custom SVG Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Snap 1: Lead Conversion Trend */}
            <div className="p-4 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block">Lead Conversion (BI)</span>
              <div className="h-20 w-full flex items-end gap-1.5">
                {[34, 45, 55, 67, 89, 78, 92].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col justify-end items-center h-full">
                    <div className="w-full rounded bg-neonTeal/30 hover:bg-neonTeal transition-colors" style={{ height: `${val}%` }}></div>
                    <span className="text-[8px] font-mono text-darkMuted mt-1">D{idx+1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Snap 2: Revenue Pipeline (Mock) */}
            <div className="p-4 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block">Revenue Signals (Invoices total)</span>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-display font-black text-gray-200">$48,250.00</span>
                <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  +12.4%
                </span>
              </div>
              <p className="text-[10px] text-darkMuted">Simulated total value of approved, active transactions processed via modules.</p>
            </div>

            {/* Snap 3: Workflow Completion Efficiency */}
            <div className="p-4 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block">Workflow Throughput</span>
              <div className="h-16 w-full flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#222" strokeWidth="4" />
                  <circle cx="32" cy="32" r="28" fill="transparent" stroke="#00f3ff" strokeWidth="4" 
                    strokeDasharray={175} strokeDashoffset={175 * (1 - (health?.metrics?.workflow_success_rate ?? 100.0) / 100.0)} 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xs font-bold text-gray-200">{health?.metrics?.workflow_success_rate ?? "100"}%</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Right Side Column (1 span): Live SSE activity feed & Unified Alerts Inbox */}
        <div className="space-y-6">
          
          {/* Unified Alerts & Approvals Inbox */}
          <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/15 space-y-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-neonIndigo" />
              Security & Approval Inbox
            </h3>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {inbox.length === 0 ? (
                <div className="text-[10px] text-darkMuted py-8 text-center border border-dashed border-darkBorder rounded-lg">No pending approvals or critical security alerts.</div>
              ) : (
                inbox.map(item => (
                  <div key={item.id} className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-2 text-[11px] relative">
                    <div className="flex justify-between items-start">
                      <span className={`font-semibold block text-gray-200 ${item.type === "approval" ? "text-amber-400" : "text-rose-400"}`}>
                        {item.title}
                      </span>
                      {getPriorityBadge(item.priority)}
                    </div>
                    <p className="text-darkMuted leading-normal text-[10px]">{item.message}</p>
                    
                    {item.type === "approval" && (
                      <div className="flex gap-1.5 pt-1.5 justify-end">
                        <button
                          onClick={() => handleQuickAction("approve_request", { request_id: item.id, comments: "Approved via dashboard quick action." })}
                          disabled={actionLoading !== null}
                          className="px-2 py-1 text-[9px] font-bold bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-500 rounded transition-all cursor-pointer flex items-center gap-0.5"
                        >
                          <Check className="w-2.5 h-2.5" /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Real-time Activity Feed */}
          <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/15 space-y-4">
            <h3 className="text-xs font-mono font-bold text-gray-200 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-neonTeal" />
              Live Operations Feed
            </h3>
            
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {activityFeed.length === 0 ? (
                <div className="text-[10px] text-darkMuted py-8 text-center">Listening for monorepo activity logs...</div>
              ) : (
                activityFeed.map((event, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-lg border-l-2 text-[10px] transition-all duration-300 font-mono ${getSeverityStyle(event.severity)}`}
                  >
                    <div className="flex justify-between text-[8px] opacity-65 mb-1 flex-wrap">
                      <span className="font-bold uppercase tracking-wider">{event.source}</span>
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="leading-relaxed select-all">{event.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
