import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Cpu, Terminal, Sparkles, Layers, RefreshCw, Play, Users, Clock, Plus
} from "lucide-react";
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer";

interface Agent {
  key: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  system_prompt: string;
}

interface Step {
  task: string;
  capability: string;
}

interface AgentLog {
  id: string;
  sender: string;
  recipient: string;
  message_type: string;
  content: string;
  created_at: string;
}

interface WorkflowRun {
  id: string;
  goal: string;
  status: "running" | "success" | "failed" | "pending";
  execution_plan: Step[];
  shared_memory: Record<string, any>;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

interface AgentDashboardProps {
  backendUrl: string;
}

export function AgentDashboard({ backendUrl }: AgentDashboardProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  
  // Launch state
  const [goal, setGoal] = useState("Review uploaded payroll records and identify compliance risks");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom agent registration modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customName, setCustomName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customCaps, setCustomCaps] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [submittingAgent, setSubmittingAgent] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Fetch registered agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (e) {
      console.error("Error loading agents:", e);
    }
  }, [backendUrl]);

  // Fetch agent workflows history
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/workflows`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
        // Sync selected run if it is active
        if (data.length > 0) {
          if (!selectedRun) {
            setSelectedRun(data[0]);
          } else {
            const updated = data.find((r: WorkflowRun) => r.id === selectedRun.id);
            if (updated) setSelectedRun(updated);
          }
        }
      }
    } catch (e) {
      console.error("Error loading agent workflows:", e);
    }
  }, [backendUrl, selectedRun]);

  // Fetch logs for current run
  const fetchLogs = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/logs?run_id=${runId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Error loading logs:", e);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchAgents();
    fetchWorkflows();
  }, [fetchAgents, fetchWorkflows]);

  // Auto poll while running
  useEffect(() => {
    if (selectedRun && selectedRun.status === "running") {
      const timer = setInterval(() => {
        fetchWorkflows();
        fetchLogs(selectedRun.id);
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [selectedRun, fetchWorkflows, fetchLogs]);

  // Scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleRunTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setRunning(true);
    setError(null);
    setLogs([]);
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/run-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal,
          context: {}
        })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchWorkflows();
        if (data.run_id) {
          const runDetails: WorkflowRun = {
            id: data.run_id,
            goal: goal,
            status: "running",
            execution_plan: data.plan || [],
            shared_memory: {},
            started_at: new Date().toISOString()
          };
          setSelectedRun(runDetails);
          fetchLogs(data.run_id);
        }
      } else {
        const errData = await res.json();
        setError(errData.detail || "Orchestration request failed.");
      }
    } catch (err) {
      setError("Failed to connect to the agent backend node.");
    } finally {
      setRunning(false);
    }
  };

  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKey.trim() || !customName.trim()) return;

    setSubmittingAgent(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: customKey,
          name: customName,
          role: customRole,
          description: customDesc,
          capabilities: customCaps.split(",").map(c => c.trim()).filter(Boolean),
          system_prompt: customPrompt
        })
      });
      if (res.ok) {
        fetchAgents();
        setShowRegisterModal(false);
        // Reset form
        setCustomKey("");
        setCustomName("");
        setCustomRole("");
        setCustomDesc("");
        setCustomCaps("");
        setCustomPrompt("");
      } else {
        alert("Failed to register custom agent.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingAgent(false);
    }
  };

  const selectSuggestedGoal = (suggestion: string) => {
    setGoal(suggestion);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Swarm Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-darkBorder/40 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neonIndigo animate-pulse" />
            Swarm Orchestrator (Multi-Agent Swarm)
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Coordinate specialized AI operations agents collaborating internally to complete complex workflows.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-neonIndigo bg-neonIndigo/10 px-2 py-0.5 border border-neonIndigo/20 rounded">
            SWARM STATUS: ACTIVE
          </span>
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-neonIndigo hover:bg-neonIndigo/85 rounded-lg transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Agent
          </button>
        </div>
      </div>

      {/* Suggestion Quick Chips */}
      <div className="flex flex-wrap gap-2 text-xs items-center">
        <span className="text-darkMuted font-medium">Quick Tasks:</span>
        <button 
          onClick={() => selectSuggestedGoal("Review uploaded payroll records and identify compliance risks")}
          className="px-2.5 py-1 bg-darkPanel/30 border border-darkBorder hover:border-neonIndigo/55 rounded-lg text-gray-300 transition-colors text-[11px] cursor-pointer"
        >
          🔍 Audit Payroll Risks
        </button>
        <button 
          onClick={() => selectSuggestedGoal("Process all uploaded invoices and generate weekly financial summary")}
          className="px-2.5 py-1 bg-darkPanel/30 border border-darkBorder hover:border-neonTeal/55 rounded-lg text-gray-300 transition-colors text-[11px] cursor-pointer"
        >
          📊 Summarize Invoices
        </button>
        <button 
          onClick={() => selectSuggestedGoal("Analyze recent CRM leads, enrich details, score qualifications, and write outreaches")}
          className="px-2.5 py-1 bg-darkPanel/30 border border-darkBorder hover:border-yellow-500/55 rounded-lg text-gray-300 transition-colors text-[11px] cursor-pointer"
        >
          🤝 Qualify Leads & RAG
        </button>
      </div>

      {/* Main Grid: Inputs + Registry / Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Pane: Active Swarm Registry */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-neonTeal" />
              Specialized Swarm Registry ({agents.length})
            </h3>
            
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {agents.map((agent) => (
                <div key={agent.key} className="p-3.5 bg-darkBg/50 border border-darkBorder hover:border-darkBorder/100 rounded-xl space-y-2.5 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-xs text-gray-200">{agent.name}</h4>
                      <code className="text-[9px] text-darkMuted font-mono uppercase">{agent.role}</code>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  
                  <p className="text-[10.5px] text-darkMuted leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="px-1.5 py-0.2 text-[8.5px] font-mono font-bold uppercase rounded bg-darkPanel text-neonTeal border border-darkBorder/60">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow history selector */}
          <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-neonIndigo" />
              Swarm Workflow Executions
            </h3>
            
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {workflows.map(run => (
                <div
                  key={run.id}
                  onClick={() => { setSelectedRun(run); fetchLogs(run.id); }}
                  className={`p-3 bg-darkBg/40 border rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 ${
                    selectedRun && selectedRun.id === run.id ? "border-neonIndigo bg-darkBg/65" : "border-darkBorder"
                  }`}
                >
                  <div className="truncate min-w-0">
                    <p className="font-semibold text-xs text-gray-200 truncate">{run.goal}</p>
                    <p className="text-[9px] font-mono text-darkMuted mt-0.5">{run.id.split("-")[0]}... | {new Date(run.started_at).toLocaleTimeString()}</p>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase ${
                    run.status === "success" 
                      ? "bg-emerald-500/15 text-emerald-400" 
                      : run.status === "failed" 
                      ? "bg-rose-500/15 text-rose-400" 
                      : "bg-neonTeal/15 text-neonTeal animate-pulse"
                  }`}>
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center/Right Pane: Console Monitor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Launcher & Decomposition Timeline */}
          <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-5">
            <div>
              <h3 className="text-xs font-bold text-neonIndigo uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-neonIndigo" />
                Submit Task Goal to Swarm Coordinator
              </h3>
              <p className="text-[10px] text-darkMuted mt-0.5">Let agents plan task decomposition pipelines autonomously</p>
            </div>

            <form onSubmit={handleRunTask} className="flex gap-2.5">
              <input
                type="text"
                placeholder="Submit goal statement..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="flex-1 bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder:text-darkMuted outline-none transition-all"
                disabled={running}
              />
              <button
                type="submit"
                disabled={running || !goal.trim()}
                className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-neonIndigo hover:bg-neonIndigo/85 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
              >
                {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Launch
              </button>
            </form>

            {error && (
              <p className="text-xs text-rose-400 font-mono bg-rose-950/20 border border-rose-500/20 p-3 rounded-lg">
                [ALERT] {error}
              </p>
            )}

            {/* Decomposed Plan Steps */}
            {selectedRun && selectedRun.execution_plan && selectedRun.execution_plan.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-darkBorder/40">
                <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block">Decomposed Execution Pipeline</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {selectedRun.execution_plan.map((step, idx) => {
                    const isDone = !!(selectedRun.shared_memory && selectedRun.shared_memory[`${step.capability}_summary`]);
                    return (
                      <div key={idx} className="p-3 bg-darkBg/30 border border-darkBorder/80 rounded-xl flex gap-2.5 items-start">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5 ${
                          isDone 
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                            : "bg-neonIndigo/10 text-neonIndigo"
                        }`}>
                          {isDone ? "✓" : idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-200">{step.task}</p>
                          <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[8.5px] font-mono bg-darkPanel text-darkMuted">
                            Requires: {step.capability}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Communications logs */}
          <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-xl flex flex-col space-y-4 h-[380px] justify-between">
            <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2">
              <span className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-neonTeal" />
                Inter-Agent Swarm Communication Bus
              </span>
              <span className="text-[9px] text-neonTeal font-mono font-bold animate-pulse">Live Bus Relay</span>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[10.5px] leading-relaxed text-gray-300 space-y-3 pr-2.5 select-text">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-darkMuted text-center">
                  <Terminal className="w-8 h-8 opacity-25 mb-2.5" />
                  <p>Swarm log stream idle.</p>
                  <p className="text-[9px] mt-0.5">Select an active run or launch a task goal to trace logs.</p>
                </div>
              ) : (
                logs.map((log) => {
                  const isSystem = log.sender === "system" || log.recipient === "system_bus";
                  const isResult = log.message_type === "task_result";
                  return (
                    <div 
                      key={log.id} 
                      className={`p-2.5 border rounded-none ${
                        isSystem 
                          ? "bg-darkBg/60 border-darkBorder/60 text-darkMuted" 
                          : isResult 
                          ? "bg-emerald-950/5 border-emerald-500/20 text-emerald-300"
                          : "bg-darkBg/40 border-neonIndigo/20 text-neonIndigo"
                      }`}
                    >
                      <div className="flex justify-between items-center text-[9px] opacity-70 mb-1 border-b border-darkBorder/20 pb-1">
                        <span className="font-bold">
                          {log.sender.toUpperCase()} → {log.recipient.toUpperCase()}
                        </span>
                        <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{log.content}</p>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

      </div>

      {/* Shared memory & Final Report pane */}
      {selectedRun && (
        <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-5 animate-fadeIn">
          <div>
            <span className="text-xs font-bold text-neonIndigo uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-neonIndigo" />
              Swarm Audit Report Output & Shared Memory
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Final Report Card (col-span-8) */}
            <div className="lg:col-span-8 p-5 bg-darkBg/50 border border-darkBorder rounded-xl space-y-4 select-text">
              <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block border-b border-darkBorder/40 pb-2">
                Executive Synthesis Report (Coordinator)
              </span>
              
              {selectedRun.status === "running" ? (
                <div className="py-12 text-center text-darkMuted space-y-3 flex flex-col items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-neonIndigo" />
                  <p className="text-xs">Agents are working. Compiling audit results...</p>
                </div>
              ) : selectedRun.shared_memory && selectedRun.shared_memory.final_report ? (
                <MarkdownRenderer content={selectedRun.shared_memory.final_report} className="text-xs" />
              ) : (
                <p className="text-xs text-darkMuted italic text-center py-8">Final report compilation pending.</p>
              )}
            </div>

            {/* Shared Memory Context (col-span-4) */}
            <div className="lg:col-span-4 p-5 bg-darkBg/50 border border-darkBorder rounded-xl space-y-4">
              <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block border-b border-darkBorder/40 pb-2">
                Shared Memory inspector
              </span>
              
              <div className="space-y-3 overflow-y-auto max-h-[300px] text-[10px] font-mono pr-1 select-text">
                {selectedRun.shared_memory && Object.keys(selectedRun.shared_memory).length > 0 ? (
                  Object.entries(selectedRun.shared_memory).map(([key, val]) => {
                    if (key === "final_report") return null;
                    return (
                      <div key={key} className="p-2.5 bg-darkPanel/25 border border-darkBorder rounded-lg space-y-1">
                        <span className="text-neonTeal block font-semibold">{key}</span>
                        <pre className="text-darkMuted whitespace-pre-wrap leading-tight text-[9px] max-h-[120px] overflow-y-auto">
                          {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                        </pre>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-darkMuted italic text-center py-8">Shared memory is empty.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Register Agent */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkBg/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-darkPanel border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div>
              <h3 className="text-base font-bold text-gray-200">Register Custom Agent</h3>
              <p className="text-xs text-darkMuted mt-0.5">Add a new specialized agent key to the active registry.</p>
            </div>

            <form onSubmit={handleRegisterAgent} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-darkMuted uppercase">
                    Agent Key (Id)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. data_auditor"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-darkMuted uppercase">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Audit Agent"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-darkMuted uppercase">
                  Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Operations Auditor"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-darkMuted uppercase">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Summarize capability fields..."
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-darkMuted uppercase">
                  Capabilities (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. invoice_analysis, anomaly_review"
                  value={customCaps}
                  onChange={(e) => setCustomCaps(e.target.value)}
                  className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-darkMuted uppercase">
                  System Prompt (System Role instruction)
                </label>
                <textarea
                  placeholder="You focus on auditing database schemas and validating..."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3 py-2 text-gray-200 outline-none min-h-[70px] resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-darkBorder/40 hover:bg-darkBorder text-gray-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAgent || !customKey.trim() || !customName.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-neonIndigo hover:bg-neonIndigo/85 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Save Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
