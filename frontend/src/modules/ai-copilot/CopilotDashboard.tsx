import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send, Sparkles, AlertTriangle, Shield, Check, Clock,
  Workflow, Users, FileText, CheckCircle2, ShieldAlert,
  Activity, Search, Terminal, ArrowUpRight, HelpCircle, Loader2, ChevronRight
} from "lucide-react";

// Terminal slash-command palette
const SLASH_COMMANDS: { cmd: string; desc: string; mode: "ask" | "action" | "plan" | "debug" }[] = [
  { cmd: "/list workflows",         desc: "List recent workflow executions",              mode: "ask" },
  { cmd: "/run workflow",           desc: "Execute a workflow by goal description",       mode: "action" },
  { cmd: "/list agents",            desc: "Show all active agents and their state",       mode: "ask" },
  { cmd: "/pending approvals",      desc: "Fetch pending approval requests",              mode: "ask" },
  { cmd: "/approve",               desc: "/approve <request_id> — Authorize a review",   mode: "action" },
  { cmd: "/search",                desc: "/search <query> — Semantic document search",   mode: "ask" },
  { cmd: "/finance summary",        desc: "Generate a finance KPI snapshot",              mode: "ask" },
  { cmd: "/anomaly report",         desc: "Detect payroll and invoice anomalies",         mode: "ask" },
  { cmd: "/crm leads",              desc: "Show CRM lead pipeline overview",              mode: "ask" },
  { cmd: "/health check",           desc: "Run system integrity diagnostics",             mode: "debug" },
  { cmd: "/plan",                  desc: "/plan <goal> — Build an autonomous agent plan",mode: "plan" },
  { cmd: "/debug last run",         desc: "Trace the most recent failed execution",       mode: "debug" },
  { cmd: "/graph impact",           desc: "Show downstream impact of a knowledge entity", mode: "ask" },
];

const MODE_COLOR: Record<string, string> = {
  ask:    "text-neonTeal border-neonTeal/30 bg-neonTeal/5",
  action: "text-neonIndigo border-neonIndigo/30 bg-neonIndigo/5",
  plan:   "text-amber-400 border-amber-500/30 bg-amber-500/5",
  debug:  "text-rose-400 border-rose-500/30 bg-rose-500/5",
};

interface Message {
  sender: "user" | "assistant";
  text: string;
  type?: string;
  data?: any;
  success?: boolean;
}

interface ContextInfo {
  user: {
    name: string;
    role: string;
    department: string;
  };
  metrics: {
    active_workflows: number;
    running_agents: number;
    pending_approvals: number;
    failed_jobs: number;
    crm_leads: number;
    finance_alerts: number;
  };
  health: number;
  health_status: string;
}

const BACKEND_URL = "http://localhost:8000";

export const CopilotDashboard: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "assistant",
      text: "Welcome to the Syntra AI Copilot. Type any command in natural language to query data, trigger workflows, delegate agent tasks, or authorize reviews."
    }
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"ask" | "action" | "plan" | "debug">("ask");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<ContextInfo | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCmdSuggestions, setShowCmdSuggestions] = useState(false);
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0);

  const filteredCmds = input.startsWith("/")
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(input) || c.desc.toLowerCase().includes(input.slice(1).toLowerCase()))
    : showCmdSuggestions && input === ""
    ? SLASH_COMMANDS
    : [];

  // Load diagnostics context
  const fetchContext = useCallback(async () => {
    const token = localStorage.getItem("syntra_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/copilot/context`, { headers });
      if (res.ok) setContext(await res.json());
    } catch (e) {
      console.error("Failed to load copilot context:", e);
    }
  }, []);

  useEffect(() => {
    fetchContext();
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, fetchContext]);

  // Handle query submit
  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);

    // Append user message
    setMessages(prev => [...prev, { sender: "user", text: queryText }]);
    setInput("");

    const token = localStorage.getItem("syntra_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/copilot/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: queryText })
      });

      if (res.ok) {
        const result = await res.json();
        setMessages(prev => [...prev, {
          sender: "assistant",
          text: result.text,
          type: result.type,
          data: result.data,
          success: result.success
        }]);
        fetchContext(); // Refresh diagnostics state
      } else {
        const errData = await res.json();
        setMessages(prev => [...prev, {
          sender: "assistant",
          text: `⚠️ **Error:** ${errData.detail || "Request failed."}`,
          success: false
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        sender: "assistant",
        text: "⚠️ **Connection Error:** Failed to reach Copilot engine.",
        success: false
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger quick example command click
  const triggerExample = (cmd: string) => {
    handleQuery(cmd);
  };

  // Approve action directly from response card
  const handleCardApprove = async (reqId: string) => {
    await handleQuery(`Approve review request ${reqId}`);
  };

  // Form submit wrapper
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(input);
  };

  // Multi-modal rendering engine for payload cards
  const renderResponseCard = (msg: Message) => {
    if (!msg.data || !msg.type) return null;

    const data = msg.data;

    switch (msg.type) {
      // 1. Workflow details
      case "workflow_run":
        return (
          <div className="mt-3 p-4 bg-darkBg border border-darkBorder rounded-xl space-y-2 text-xs">
            <span className="text-[10px] font-mono font-bold text-neonIndigo uppercase tracking-wider block">Workflow Executed</span>
            <div className="flex justify-between items-center bg-darkPanel/30 p-2.5 rounded border border-darkBorder/40">
              <div>
                <span className="font-semibold block text-gray-200">{data.workflow_name}</span>
                <code className="text-[9px] text-darkMuted font-mono block mt-0.5">ID: {data.id}</code>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                data.status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" :
                data.status === "failed" ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" :
                "bg-amber-500/10 text-amber-400 border border-amber-500/25"
              }`}>
                {data.status}
              </span>
            </div>
          </div>
        );

      // 2. Workflow runs list
      case "workflow_list":
        return (
          <div className="mt-3 overflow-x-auto border border-darkBorder/55 rounded-xl text-[11px] bg-darkBg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-darkPanel/45 border-b border-darkBorder font-mono text-[9px] uppercase tracking-wider text-darkMuted">
                  <th className="p-2.5 px-3">Workflow Name</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Started At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder/30">
                {data.map((r: any) => (
                  <tr key={r.id} className="hover:bg-darkPanel/20">
                    <td className="p-2 px-3 font-semibold text-gray-300">{r.workflow_name}</td>
                    <td className="p-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                        r.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                        r.status === "failed" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-[9px] text-darkMuted">{new Date(r.started_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      // 3. Leads lists
      case "lead_list":
        return (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {data.map((l: any) => (
              <div key={l.id} className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-1">
                <span className="font-semibold block text-gray-200">{l.name} ({l.company})</span>
                <span className="text-darkMuted text-[9px] font-mono block">Role: {l.role || "—"}</span>
                <div className="flex justify-between items-center pt-1.5 border-t border-darkBorder/20 mt-1">
                  <span className="text-neonTeal font-bold font-mono text-[10px]">Score: {l.lead_score}</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-darkPanel/60 capitalize text-gray-300 border border-darkBorder">
                    {l.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );

      // 4. Invoice lists
      case "invoice_list":
        return (
          <div className="mt-3 overflow-x-auto border border-darkBorder/55 rounded-xl text-[11px] bg-darkBg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-darkPanel/45 border-b border-darkBorder font-mono text-[9px] uppercase tracking-wider text-darkMuted">
                  <th className="p-2 px-3">Vendor</th>
                  <th className="p-2">Total Amount</th>
                  <th className="p-2">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder/30">
                {data.map((i: any) => (
                  <tr key={i.id} className="hover:bg-darkPanel/20">
                    <td className="p-2 px-3 font-semibold text-gray-300">{i.vendor_name}</td>
                    <td className="p-2 font-mono text-neonTeal font-bold">${i.total_amount}</td>
                    <td className="p-2 font-mono text-darkMuted text-[9px]">{i.due_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      // 5. Payroll records list
      case "payroll_list":
        return (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {data.map((pay: any) => (
              <div key={pay.id} className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-1">
                <span className="font-semibold block text-gray-200">{pay.employee_name}</span>
                <div className="flex justify-between text-darkMuted font-mono text-[10px] mt-1 pt-1 border-t border-darkBorder/25">
                  <span>Net Pay: <b className="text-neonTeal font-bold">${pay.net_pay}</b></span>
                  <span className="capitalize">{pay.status}</span>
                </div>
              </div>
            ))}
          </div>
        );

      // 6. Anomalies check anomalies table
      case "anomaly_list":
        return (
          <div className="mt-3 space-y-2">
            {data.map((anom: any) => (
              <div key={anom.id} className="p-3 bg-rose-950/10 border border-rose-900/35 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between items-start">
                  <span className="font-mono font-bold text-[10px] text-rose-400 uppercase tracking-widest">{anom.rule_name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {anom.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-300 leading-normal text-[11px]">{anom.description}</p>
              </div>
            ))}
          </div>
        );

      // 7. Review queues list and approval button
      case "approval_list":
      case "approval_detail":
        const items = msg.type === "approval_list" ? data : [data];
        return (
          <div className="mt-3 space-y-2">
            {items.map((app: any) => (
              <div key={app.id} className="p-3.5 bg-darkBg border border-darkBorder rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold block text-gray-200 capitalize">{app.task_type.replace("_", " ")}</span>
                    <span className="text-darkMuted font-mono text-[9px] block mt-0.5">Risk Score: {app.risk_score} ({app.risk_level.toUpperCase()})</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                    app.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" :
                    app.status === "rejected" ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" :
                    "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}>
                    {app.status}
                  </span>
                </div>
                <p className="text-darkMuted text-[10.5px] leading-relaxed">{app.risk_reason}</p>
                {app.status === "pending" && (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleCardApprove(app.id)}
                      className="px-3 py-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 hover:border-emerald-500 rounded font-bold transition-all cursor-pointer text-[10px] flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      // 8. RAG citations
      case "rag_answer":
        return (
          <div className="mt-3 space-y-1">
            {data.sources && data.sources.length > 0 && (
              <div className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-2 text-[10px]">
                <span className="text-[9px] font-mono font-bold text-darkMuted uppercase tracking-wider block">Reference Citations ({data.sources.length})</span>
                <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                  {data.sources.map((s: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-darkMuted border-b border-darkBorder/20 pb-1 last:border-none">
                      <span className="font-semibold text-gray-300 truncate max-w-[150px]">{s.filename || "rag_source"}</span>
                      <span className="font-mono text-[9px] opacity-75">Match: {Math.round(s.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      // 9. Agent coord logs
      case "agent_run":
        return (
          <div className="mt-3 p-4 bg-darkBg border border-darkBorder rounded-xl space-y-2 text-xs">
            <span className="text-[10px] font-mono font-bold text-neonTeal uppercase tracking-wider block">Swarm Coordination Dispatched</span>
            <div className="flex items-center gap-2 p-2.5 rounded bg-neonTeal/5 border border-neonTeal/20">
              <Users className="w-4 h-4 text-neonTeal" />
              <div>
                <span className="font-semibold block text-gray-200">Swarm Task: {data.goal}</span>
                <span className="text-darkMuted font-mono text-[9px] mt-0.5 block">State: <span className="capitalize">{data.status}</span></span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
      
      {/* Left Chat Window (3 span) */}
      <div className="lg:col-span-3 border border-darkBorder rounded-xl bg-darkPanel/10 overflow-hidden flex flex-col h-[650px]">
        
        {/* Chat Header */}
        <div className="p-4 bg-darkPanel/30 border-b border-darkBorder/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-neonIndigo fill-current animate-pulse" />
            <h3 className="text-xs font-mono font-bold uppercase text-gray-200 tracking-wider">AI Operations Command Console</h3>
          </div>

          <div className="flex gap-1">
            {(["ask", "action", "plan", "debug"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 font-mono uppercase text-[9px] font-bold border transition-all cursor-pointer rounded ${
                  mode === m
                    ? "bg-neonIndigo/15 border-neonIndigo text-neonIndigo"
                    : "bg-darkBg border-darkBorder text-darkMuted hover:text-gray-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Logs */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl p-4 rounded-xl border relative ${
                msg.sender === "user" 
                  ? "bg-neonIndigo/10 border-neonIndigo/30 text-gray-200" 
                  : msg.success === false
                  ? "bg-rose-950/10 border-rose-900/30 text-rose-300"
                  : "bg-darkPanel/10 border-darkBorder text-gray-300"
              }`}>
                <span className="text-[8px] font-mono uppercase tracking-wider text-darkMuted block mb-1">
                  {msg.sender === "user" ? "Corporate operator" : "Syntra Assistant"}
                </span>
                
                <p className="leading-relaxed select-text whitespace-pre-wrap">{msg.text}</p>
                
                {renderResponseCard(msg)}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="p-4 rounded-xl border border-darkBorder bg-darkPanel/10 text-darkMuted flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[10px] uppercase">Parsing command intent...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Dynamic Command Suggestions Row */}
        <div className="p-3 bg-darkBg/30 border-t border-darkBorder/40 flex gap-2 overflow-x-auto text-[9.5px] pr-1">
          {[
            { label: "Check Failed Workflows", text: "Show all failed workflows today" },
            { label: "Analyze Financial Risk", text: "Analyze financial risk across invoices" },
            { label: "Compliance Check", text: "Run compliance check on documents" },
            { label: "Approve Pending Reviews", text: "Approve all low-risk invoices" }
          ].map(shortcut => (
            <button
              key={shortcut.label}
              type="button"
              onClick={() => triggerExample(shortcut.text)}
              className="px-2.5 py-1 rounded bg-darkPanel/45 hover:bg-darkPanel border border-darkBorder hover:border-darkBorder/100 text-darkMuted hover:text-gray-300 transition-all font-semibold whitespace-nowrap cursor-pointer"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        {/* Input Bar with autocomplete */}
        <div className="relative">
          {/* Autocomplete dropdown */}
          {(showCmdSuggestions || input.startsWith("/")) && filteredCmds.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-darkPanel border border-darkBorder rounded-xl shadow-xl z-30 overflow-hidden max-h-[260px] overflow-y-auto">
              <div className="px-3 py-1.5 border-b border-darkBorder/40 flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-widest text-darkMuted flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Command Palette ({filteredCmds.length})
                </span>
                <span className="text-[9px] font-mono text-darkMuted">Tab to complete · ↑↓ navigate</span>
              </div>
              {filteredCmds.map((cmd, idx) => (
                <button
                  key={cmd.cmd}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    setInput(cmd.cmd + " ");
                    setShowCmdSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className={`w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors ${
                    activeSuggestionIdx === idx ? "bg-neonIndigo/8 border-l-2 border-neonIndigo" : "hover:bg-darkBg/40 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronRight className="w-3 h-3 text-darkMuted shrink-0" />
                    <span className="text-[11px] font-mono text-gray-200 font-semibold shrink-0">{cmd.cmd}</span>
                    <span className="text-[10px] text-darkMuted truncate">— {cmd.desc}</span>
                  </div>
                  <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${MODE_COLOR[cmd.mode]}`}>{cmd.mode}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="p-4 bg-darkPanel/30 border-t border-darkBorder/60 flex gap-3">
            <input
              ref={inputRef}
              type="text"
              placeholder='Type / for commands, or natural language…'
              value={input}
              onChange={e => {
                setInput(e.target.value);
                setActiveSuggestionIdx(0);
              }}
              onFocus={() => setShowCmdSuggestions(true)}
              onBlur={() => setTimeout(() => setShowCmdSuggestions(false), 150)}
              onKeyDown={e => {
                if (filteredCmds.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestionIdx(i => Math.min(i + 1, filteredCmds.length - 1)); }
                  if (e.key === "ArrowUp")   { e.preventDefault(); setActiveSuggestionIdx(i => Math.max(i - 1, 0)); }
                  if (e.key === "Tab" || e.key === "Enter" && input.startsWith("/")) {
                    e.preventDefault();
                    const chosen = filteredCmds[activeSuggestionIdx];
                    if (chosen) {
                      setInput(chosen.cmd + " ");
                      setShowCmdSuggestions(false);
                    }
                    return;
                  }
                  if (e.key === "Escape") setShowCmdSuggestions(false);
                }
              }}
              disabled={loading}
              className="flex-1 bg-darkBg border border-darkBorder rounded-lg px-4 py-2 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo disabled:opacity-50 font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Execute</span>
            </button>
          </form>
        </div>

      </div>

      {/* Right Diagnostics Context Panel (1 span) */}
      <div className="border border-darkBorder rounded-xl bg-darkPanel/10 p-5 space-y-6">
        
        {/* User Gating Section */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">Operator Profile</h4>
          {context ? (
            <div className="p-3 bg-darkBg border border-darkBorder rounded-lg text-xs space-y-1.5">
              <div>
                <span className="text-[9px] font-mono text-darkMuted uppercase block">Name</span>
                <span className="font-semibold text-gray-200">{context.user.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1 pt-1 border-t border-darkBorder/20 text-[10px]">
                <div>
                  <span className="text-[9px] font-mono text-darkMuted uppercase block">Role</span>
                  <span className="font-semibold text-gray-300 capitalize">{context.user.role}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-darkMuted uppercase block">Dept</span>
                  <span className="font-semibold text-gray-300 capitalize">{context.user.department}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-darkMuted">Loading context...</div>
          )}
        </div>

        {/* Telemetry Stats */}
        <div className="space-y-3">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">Control telemetry</h4>
          {context ? (
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              
              <div className="p-2.5 bg-darkBg border border-darkBorder rounded-lg">
                <span className="text-[8px] font-mono text-darkMuted block">ACTIVE FLOWS</span>
                <span className="text-sm font-bold text-gray-200 mt-1 block">{context.metrics.active_workflows}</span>
              </div>

              <div className="p-2.5 bg-darkBg border border-darkBorder rounded-lg">
                <span className="text-[8px] font-mono text-darkMuted block">ACTIVE AGENTS</span>
                <span className="text-sm font-bold text-gray-200 mt-1 block">{context.metrics.running_agents}</span>
              </div>

              <div className="p-2.5 bg-darkBg border border-darkBorder rounded-lg">
                <span className="text-[8px] font-mono text-darkMuted block">PENDING REVIEWS</span>
                <span className="text-sm font-bold text-amber-400 mt-1 block">{context.metrics.pending_approvals}</span>
              </div>

              <div className="p-2.5 bg-darkBg border border-darkBorder rounded-lg">
                <span className="text-[8px] font-mono text-darkMuted block">FAILED JOBS</span>
                <span className="text-sm font-bold text-rose-400 mt-1 block">{context.metrics.failed_jobs}</span>
              </div>

            </div>
          ) : (
            <div className="text-[10px] text-darkMuted">Loading metrics...</div>
          )}
        </div>

        {/* Health Gauge */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted">System Integrity</h4>
          {context ? (
            <div className="p-3 bg-darkBg border border-darkBorder rounded-lg flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${
                  context.health_status === "healthy" ? "text-emerald-400" : context.health_status === "degraded" ? "text-amber-400" : "text-rose-500"
                }`} />
                <span className="font-semibold text-gray-200">Score: {context.health}/100</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold capitalize ${
                context.health_status === "healthy" ? "bg-emerald-500/10 text-emerald-400" : context.health_status === "degraded" ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
              }`}>
                {context.health_status}
              </span>
            </div>
          ) : (
            <div className="text-[10px] text-darkMuted">Loading integrity...</div>
          )}
        </div>

      </div>

    </div>
  );
};
