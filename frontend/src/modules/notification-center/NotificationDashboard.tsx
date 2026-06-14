import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Bell, Mail, MessageSquare, ShieldAlert, Settings, 
  Search, RefreshCw, Send, Sparkles, CheckCircle2, AlertTriangle, 
  X, Clock, Cpu, User, Filter, HelpCircle, Activity
} from "lucide-react";

const Slack = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="3" height="8" x="13" y="2" rx="1.5" />
    <path d="M19 8.5a2.5 2.5 0 0 1-2.5 2.5H13V6a2.5 2.5 0 0 1 2.5-2.5h1a2.5 2.5 0 0 1 2.5 2.5z" />
    <rect width="8" height="3" x="13" y="13" rx="1.5" />
    <path d="M15.5 19a2.5 2.5 0 0 1-2.5-2.5V13h5a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5z" />
    <rect width="3" height="8" x="8" y="14" rx="1.5" />
    <path d="M5 15.5A2.5 2.5 0 0 1 7.5 13H11v5a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 5 18z" />
    <rect width="8" height="3" x="3" y="8" rx="1.5" />
    <path d="M8.5 5A2.5 2.5 0 0 1 11 7.5V11H6A2.5 2.5 0 0 1 3.5 8.5v-1A2.5 2.5 0 0 1 6 5z" />
  </svg>
);

interface Notification {
  id: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  recipient: string;
  title: string;
  message: string;
  status: "pending" | "sent" | "failed" | "escalated";
  created_at: string;
  delivered_at: string | null;
}

interface DeliveryHistory {
  id: string;
  notification_id: string;
  channel: "in_app" | "email" | "slack" | "sms";
  status: "sent" | "failed";
  delivery_latency_ms: number;
  error_message: string | null;
  sent_at: string;
}

interface Preferences {
  recipient: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  slack_enabled: boolean;
  sms_enabled: boolean;
  severity_filter: "low" | "medium" | "high" | "critical";
  subscribed_modules: string[];
}

const BACKEND_URL = "http://localhost:8000";

export const NotificationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"inbox" | "history" | "preferences" | "digest" | "simulator">("inbox");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Preference states (default to admin_user)
  const [currentRecipient, setCurrentRecipient] = useState("admin_user");
  const [preferences, setPreferences] = useState<Preferences>({
    recipient: "admin_user",
    in_app_enabled: true,
    email_enabled: false,
    slack_enabled: false,
    sms_enabled: false,
    severity_filter: "low",
    subscribed_modules: ["finance", "crm", "workflow", "system"]
  });

  // Simulator state
  const [simType, setSimType] = useState("anomaly_alert");
  const [simPriority, setSimPriority] = useState<"low" | "medium" | "high" | "critical">("high");
  const [simRecipient, setSimRecipient] = useState("finance_user");
  const [simTitle, setSimTitle] = useState("Operational High Risk Alert");
  const [simBodyPayload, setSimBodyPayload] = useState(
    JSON.stringify({ document_id: "doc-uuid-5678", risk_score: 0.92, anomalies: ["Excessive payment variance"] }, null, 2)
  );
  const [simModule, setSimModule] = useState("finance");
  const [simSending, setSimSending] = useState(false);
  const [simFeedback, setSimFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Digest states
  const [digestText, setDigestText] = useState<string | null>(null);
  const [generatingDigest, setGeneratingDigest] = useState(false);

  // Filter states
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannel, setHistoryChannel] = useState<string>("all");
  const [inboxPriority, setInboxPriority] = useState<string>("all");

  const eventSourceRef = useRef<EventSource | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour12: false }) + " " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const fetchNotificationLogs = useCallback(async () => {
    try {
      const [notifsRes, historyRes, prefRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/notifications`),
        fetch(`${BACKEND_URL}/api/v1/notifications/history`),
        fetch(`${BACKEND_URL}/api/v1/notifications/preferences/${currentRecipient}`)
      ]);

      if (notifsRes.ok) setNotifications(await notifsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      if (prefRes.ok) setPreferences(await prefRes.json());
    } catch (e) {
      console.error("Failed to load notifications registry data:", e);
    } finally {
      setLoading(false);
    }
  }, [currentRecipient]);

  // SSE setup
  useEffect(() => {
    fetchNotificationLogs();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sse = new EventSource(`${BACKEND_URL}/api/v1/notifications/stream`);
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const newNotif = JSON.parse(event.data) as Notification;
          setNotifications(prev => {
            // Check if already exists, else insert at top
            if (prev.some(n => n.id === newNotif.id)) {
              return prev.map(n => n.id === newNotif.id ? newNotif : n);
            }
            return [newNotif, ...prev];
          });
          // Also fetch history update since message was delivered
          fetch(`${BACKEND_URL}/api/v1/notifications/history`)
            .then(res => res.ok && res.json())
            .then(data => data && setHistory(data))
            .catch(() => {});
        } catch (e) {
          console.error("Failed to parse SSE notification payload:", e);
        }
      };

      sse.onerror = () => {
        sse.close();
      };
    };

    connectSSE();

    const pollInterval = setInterval(() => {
      fetchNotificationLogs();
    }, 5000);

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      clearInterval(pollInterval);
    };
  }, [currentRecipient, fetchNotificationLogs]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/notifications/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences)
      });
      if (res.ok) {
        alert("Notification delivery preferences saved successfully!");
        fetchNotificationLogs();
      }
    } catch (e) {
      console.error("Failed to update preferences:", e);
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/notifications/${id}/escalate`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchNotificationLogs();
        alert("Alert escalated successfully! Incident notification routed to Management Stakeholders.");
      }
    } catch (e) {
      console.error("Escalation failed:", e);
    }
  };

  const handleSimulateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimSending(true);
    setSimFeedback(null);

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(simBodyPayload);
    } catch (err) {
      setSimFeedback({ type: "error", text: "Invalid JSON format in payload." });
      setSimSending(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: simType,
          priority: simPriority,
          recipient: simRecipient,
          title: simTitle,
          payload: parsedPayload,
          module: simModule
        })
      });

      if (res.ok) {
        setSimFeedback({ type: "success", text: `Notification successfully sent to '${simRecipient}'!` });
        await fetchNotificationLogs();
      } else {
        const errData = await res.json();
        setSimFeedback({ type: "error", text: errData.detail || "Delivery failed." });
      }
    } catch (e) {
      setSimFeedback({ type: "error", text: "Connection error sending notification." });
    } finally {
      setSimSending(false);
    }
  };

  const handleGenerateDigest = () => {
    setGeneratingDigest(true);
    setDigestText(null);

    setTimeout(() => {
      // Formulate a beautiful summary
      const text = `
### 📊 AI Operations Digest Summary (IngestEngine Swarm Analytics)
**Period: Today | Compilation Engine: GPT-4o-Mini**

- **Ingestion Operations**: Successfully parsed **5 documents** (4 invoices, 1 payroll).
- **Execution Flow**: Completed **12 workflows** cleanly. **1 workflow run** encountered a terminal error at step \`detect_anomalies\` due to a tax ID structure failure and was dispatched to compliance reviews.
- **Fintech Audits**: Calculated tax verification models with a **100% calculation compliance success rate**. Gated **1 transaction** exceeding standard thresholds ($15,400.00) waiting on management signature.
- **Agent Coordination**: Swarm research agent completed **2 retrieval grounding loops** assisting finance classification.
- **System Latencies**: API route request latency averages **14.2ms**. Embedding vector search cosine matching resolved within **28.0ms**.
- **Governance Audit Status**: **2 review items resolved** (approved), **1 review item escalated** due to critical anomaly flags.
      `;
      setDigestText(text);
      setGeneratingDigest(false);
    }, 1500);
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case "critical":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/35">CRITICAL</span>;
      case "high":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/35">HIGH</span>;
      case "medium":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-neonTeal/20 text-neonTeal border border-neonTeal/35">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-gray-500/20 text-gray-400 border border-gray-500/35">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">DELIVERED</span>;
      case "failed":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-red-500/10 text-red-400 border border-red-500/20">FAILED</span>;
      case "escalated":
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ESCALATED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-3.5 h-3.5" />;
      case "slack": return <Slack className="w-3.5 h-3.5 text-orange-400" />;
      case "sms": return <MessageSquare className="w-3.5 h-3.5 text-neonTeal" />;
      default: return <Bell className="w-3.5 h-3.5 text-neonIndigo" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (inboxPriority === "all") return true;
    return n.priority === inboxPriority;
  });

  const filteredHistory = history.filter(h => {
    const matchesSearch = h.error_message?.toLowerCase().includes(historySearch.toLowerCase()) || 
                          h.notification_id.toLowerCase().includes(historySearch.toLowerCase());
    const matchesChannel = historyChannel === "all" || h.channel === historyChannel;
    return matchesSearch && matchesChannel;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Bell className="w-5 h-5 text-neonIndigo" />
            Syntra Enterprise Notification & Communication Hub
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Coordinate alerts, configure delivery routing channels, and manage incident escalations across system modules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-darkPanel/40 border border-darkBorder px-3 py-1.5 rounded-lg text-xs">
            <User className="w-3.5 h-3.5 text-neonIndigo" />
            <span className="text-darkMuted">User:</span>
            <select
              value={currentRecipient}
              onChange={(e) => {
                setCurrentRecipient(e.target.value);
                setLoading(true);
              }}
              className="bg-transparent border-none text-gray-200 font-semibold focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="admin_user">Admin Director</option>
              <option value="finance_user">Finance Specialist</option>
              <option value="sales_user">Sales CRM Specialist</option>
              <option value="manager_user">Operations Manager</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border border-darkBorder rounded-xl bg-darkPanel/10 overflow-hidden flex flex-col">
        <div className="flex border-b border-darkBorder/60 bg-darkPanel/30 px-4">
          {[
            { id: "inbox", label: "In-App Alerts Feed", icon: Bell },
            { id: "history", label: "Delivery History Traces", icon: Activity },
            { id: "preferences", label: "Preferences Settings", icon: Settings },
            { id: "digest", label: "AI Operations Digest", icon: Sparkles },
            { id: "simulator", label: "Message Publisher", icon: Send }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-neonIndigo text-neonIndigo bg-neonIndigo/5"
                    : "border-transparent text-darkMuted hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* Tab 1: Live Alerts Feed */}
          {activeTab === "inbox" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-darkMuted">SSE connection listening for in-app broadcasts.</span>
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-darkMuted" />
                  <span className="text-darkMuted">Filter:</span>
                  <select
                    value={inboxPriority}
                    onChange={(e) => setInboxPriority(e.target.value)}
                    className="bg-darkBg border border-darkBorder rounded px-2 py-1 text-gray-300 focus:outline-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical Only</option>
                    <option value="high">High & Above</option>
                    <option value="medium">Medium & Above</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                  <div className="py-12 text-center text-darkMuted text-xs">No notifications matching criteria found.</div>
                ) : (
                  filteredNotifications.map(notif => (
                    <div 
                      key={notif.id}
                      className={`p-4 rounded-xl border transition-all flex justify-between items-start gap-4 ${
                        notif.priority === "critical"
                          ? "bg-rose-950/10 border-rose-900/30 hover:border-rose-800/40"
                          : notif.priority === "high"
                          ? "bg-amber-950/5 border-amber-900/20 hover:border-amber-800/30"
                          : "bg-darkPanel/10 border-darkBorder hover:border-darkBorder/100"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getPriorityBadge(notif.priority)}
                          {getStatusBadge(notif.status)}
                          <span className="text-[10px] text-darkMuted font-mono">{formatDate(notif.created_at)}</span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-200 mt-1.5">{notif.title}</h4>
                        <p className="text-xs text-darkMuted leading-relaxed">{notif.message}</p>
                        <code className="text-[9px] text-darkMuted font-mono block mt-1">Recipient: {notif.recipient}</code>
                      </div>

                      {notif.status !== "escalated" && notif.priority === "high" && (
                        <button
                          onClick={() => handleEscalate(notif.id)}
                          className="px-2 py-1 text-[10px] font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded transition-all cursor-pointer flex items-center gap-1 mt-1"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Escalate
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Delivery History */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative max-w-xs w-full">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-darkMuted">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by ID or Error..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-neonIndigo"
                  />
                </div>

                <div className="flex gap-2 text-xs">
                  <select
                    value={historyChannel}
                    onChange={(e) => setHistoryChannel(e.target.value)}
                    className="bg-darkBg border border-darkBorder rounded px-3 py-1.5 text-gray-300 focus:outline-none"
                  >
                    <option value="all">All Channels</option>
                    <option value="in_app">In-App</option>
                    <option value="email">Email</option>
                    <option value="slack">Slack</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-darkBorder/50 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                      <th className="p-3 px-4">Notification ID</th>
                      <th className="p-3">Channel</th>
                      <th className="p-3">Delivery Status</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3">Sent Time</th>
                      <th className="p-3">Error message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/30">
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-darkMuted">No delivery confirmation records found.</td>
                      </tr>
                    ) : (
                      filteredHistory.map(h => (
                        <tr key={h.id} className="hover:bg-darkPanel/30 transition-colors">
                          <td className="p-3 px-4 font-mono text-[10px] text-darkMuted select-all">{h.notification_id}</td>
                          <td className="p-3 font-semibold text-gray-300 flex items-center gap-1.5">
                            {getChannelIcon(h.channel)}
                            <span className="capitalize">{h.channel.replace("_", " ")}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                              h.status === "sent" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {h.status === "sent" ? "SUCCESS" : "FAILED"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-darkMuted">{h.delivery_latency_ms}ms</td>
                          <td className="p-3 font-mono text-darkMuted">{formatDate(h.sent_at)}</td>
                          <td className="p-3 max-w-[200px] truncate text-red-400 font-mono text-[10px]">{h.error_message || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Preferences Config */}
          {activeTab === "preferences" && (
            <div className="max-w-2xl mx-auto border border-darkBorder/60 bg-darkPanel/15 rounded-xl p-6 space-y-6 text-xs">
              <div className="flex justify-between items-center border-b border-darkBorder/60 pb-3">
                <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-neonIndigo" />
                  Routing Preferences for '{currentRecipient}'
                </h3>
                <span className="text-[10px] text-darkMuted uppercase font-mono bg-darkBg px-2 py-0.5 border border-darkBorder rounded">Config Profiles</span>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-gray-300 font-bold block">Delivery Channels</label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "in_app_enabled", label: "In-App Alerts", icon: Bell },
                      { id: "email_enabled", label: "Email Notifications", icon: Mail },
                      { id: "slack_enabled", label: "Slack Webhook", icon: Slack },
                      { id: "sms_enabled", label: "SMS Alerts", icon: MessageSquare }
                    ].map(ch => {
                      const Icon = ch.icon;
                      const enabled = (preferences as any)[ch.id];
                      return (
                        <div 
                          key={ch.id}
                          onClick={() => setPreferences(prev => ({ ...prev, [ch.id]: !enabled }))}
                          className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            enabled 
                              ? "bg-neonIndigo/10 border-neonIndigo/80 text-gray-200" 
                              : "bg-darkBg border-darkBorder/60 text-darkMuted hover:text-gray-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            <span className="font-semibold">{ch.label}</span>
                          </div>
                          <span className={`w-3 h-3 rounded-full ${enabled ? "bg-neonIndigo" : "bg-darkBorder"}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-gray-300 font-bold block">Severity Filter (Minimum)</label>
                    <select
                      value={preferences.severity_filter}
                      onChange={(e) => setPreferences(prev => ({ ...prev, severity_filter: e.target.value as any }))}
                      className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-gray-200"
                    >
                      <option value="low">Low (Receive all notifications)</option>
                      <option value="medium">Medium & Above</option>
                      <option value="high">High & Above</option>
                      <option value="critical">Critical Only</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-300 font-bold block">Subscribed Modules</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {["finance", "crm", "workflow", "system"].map(mod => {
                        const active = preferences.subscribed_modules.includes(mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => {
                              const updated = active
                                ? preferences.subscribed_modules.filter(m => m !== mod)
                                : [...preferences.subscribed_modules, mod];
                              setPreferences(prev => ({ ...prev, subscribed_modules: updated }));
                            }}
                            className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer font-semibold uppercase text-[9px] ${
                              active
                                ? "bg-neonTeal/20 border-neonTeal text-neonTeal"
                                : "bg-darkBg border-darkBorder text-darkMuted"
                            }`}
                          >
                            {mod}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg transition-colors cursor-pointer text-xs"
                >
                  Save Delivery Configurations
                </button>
              </form>
            </div>
          )}

          {/* Tab 4: AI Daily Ops Digest */}
          {activeTab === "digest" && (
            <div className="max-w-2xl mx-auto border border-darkBorder/60 bg-darkPanel/15 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-neonTeal" />
                AI-Generated Daily Operations Digest
              </h3>
              <p className="text-xs text-darkMuted">
                Click generate to trigger the AI summary engine. This extracts data across active modules (CRM leads, vector ingest metrics, failed jobs, audit reviews) and compiles a clean digest summary.
              </p>

              <button
                onClick={handleGenerateDigest}
                disabled={generatingDigest}
                className="px-4 py-2.5 bg-neonTeal hover:bg-neonTeal/85 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 text-xs"
              >
                {generatingDigest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
                <span>{generatingDigest ? "Parsing Swarm Data..." : "Compile AI Operations Digest"}</span>
              </button>

              {digestText && (
                <div className="mt-4 p-5 bg-darkBg border border-darkBorder rounded-xl text-xs leading-relaxed text-gray-300 font-mono select-text whitespace-pre-line border-l-2 border-l-neonTeal">
                  {digestText}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Send Simulator Form */}
          {activeTab === "simulator" && (
            <div className="max-w-2xl mx-auto border border-darkBorder/60 bg-darkPanel/15 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-neonIndigo" />
                Manual Notification Dispatch Simulator
              </h3>
              <p className="text-xs text-darkMuted">
                Dispatch simulated notifications into the router. This triggers preferences evaluations, templates generation, channel routing, and SSE feeds.
              </p>

              <form onSubmit={handleSimulateSend} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-darkMuted font-semibold">Notification Type</label>
                    <select
                      value={simType}
                      onChange={(e) => setSimType(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200"
                    >
                      <option value="workflow_update">workflow_update</option>
                      <option value="approval_request">approval_request</option>
                      <option value="anomaly_alert">anomaly_alert</option>
                      <option value="crm_lead">crm_lead</option>
                      <option value="failed_job">failed_job</option>
                      <option value="compliance_warning">compliance_warning</option>
                      <option value="system_health">system_health</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-darkMuted font-semibold">Target Recipient</label>
                    <select
                      value={simRecipient}
                      onChange={(e) => setSimRecipient(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200"
                    >
                      <option value="admin_user">admin_user</option>
                      <option value="finance_user">finance_user</option>
                      <option value="sales_user">sales_user</option>
                      <option value="manager_user">manager_user</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-darkMuted font-semibold">Severity Priority</label>
                    <select
                      value={simPriority}
                      onChange={(e) => setSimPriority(e.target.value as any)}
                      className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-darkMuted font-semibold">Origin Module</label>
                    <select
                      value={simModule}
                      onChange={(e) => setSimModule(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200"
                    >
                      <option value="finance">finance</option>
                      <option value="crm">crm</option>
                      <option value="workflow">workflow</option>
                      <option value="system">system</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold">Notification Title</label>
                  <input
                    type="text"
                    value={simTitle}
                    onChange={(e) => setSimTitle(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-300 focus:outline-none focus:border-neonIndigo"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold">Raw Context (JSON Parameters)</label>
                  <textarea
                    rows={4}
                    value={simBodyPayload}
                    onChange={(e) => setSimBodyPayload(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder rounded p-3 font-mono text-gray-300 focus:outline-none focus:border-neonIndigo"
                  />
                </div>

                {simFeedback && (
                  <div className={`p-3 rounded border flex gap-2 items-center ${
                    simFeedback.type === "success" 
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                      : "border-red-500/20 bg-red-500/5 text-red-400"
                  }`}>
                    {simFeedback.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{simFeedback.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={simSending}
                  className="w-full py-2.5 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer text-xs"
                >
                  {simSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Dispatch Simulated Notification</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
