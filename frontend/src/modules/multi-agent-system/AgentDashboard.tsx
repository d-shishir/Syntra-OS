import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Cpu, Terminal, Sparkles, Layers, RefreshCw, Play, Users, Clock, Plus,
  Search, Sliders, Shield, BookOpen, AlertTriangle, CheckCircle2, 
  ExternalLink, BarChart3, Archive, Eye, Check, Send, ChevronRight, Zap, Info, Loader2
} from "lucide-react";
import { MarkdownRenderer } from "../../components/ui/MarkdownRenderer";

interface Agent {
  key: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  system_prompt: string;
  status?: string;
  category?: string;
  creator?: string;
  memory_short?: boolean;
  memory_long?: boolean;
  knowledge_sources?: string[];
  approval_required?: boolean;
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
  // Navigation tabs: marketplace, builder, playground, monitoring, swarm
  const [activeSubTab, setActiveSubTab] = useState<"marketplace" | "builder" | "playground" | "monitoring" | "swarm">("marketplace");
  
  // Data State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  
  // Filtering & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("coordinator_agent");
  const selectedAgent = agents.find(a => a.key === selectedAgentKey) || agents[0];

  // Builder Form State
  const [builderKey, setBuilderKey] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [builderRole, setBuilderRole] = useState("");
  const [builderDesc, setBuilderDesc] = useState("");
  const [builderCategory, setBuilderCategory] = useState("Operations");
  const [builderPrompt, setBuilderPrompt] = useState("");
  const [builderGoals, setBuilderGoals] = useState("");
  const [builderRules, setBuilderRules] = useState("");
  const [builderEscalation, setBuilderEscalation] = useState("");
  const [builderCapabilities, setBuilderCapabilities] = useState("");
  
  // Builder Toggles
  const [toolSearch, setToolSearch] = useState(true);
  const [toolGraph, setToolGraph] = useState(true);
  const [toolWorkflow, setToolWorkflow] = useState(false);
  const [toolRAG, setToolRAG] = useState(true);
  const [toolNotifications, setToolNotifications] = useState(false);
  const [toolResearch, setToolResearch] = useState(false);
  const [memoryShort, setMemoryShort] = useState(true);
  const [memoryLong, setMemoryLong] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [builderStatus, setBuilderStatus] = useState<"Draft" | "Testing" | "Published" | "Archived">("Published");
  const [submittingAgent, setSubmittingAgent] = useState(false);

  // Copilot Generator State inside Builder
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Playground Chat State
  const [playgroundMsg, setPlaygroundMsg] = useState("");
  const [playgroundChat, setPlaygroundChat] = useState<any[]>([
    { sender: "system", content: "Playground initialized. Submit query statement to test agent responses." }
  ]);
  const [testingAgent, setTestingAgent] = useState(false);
  const [playgroundTrace, setPlaygroundTrace] = useState<string[]>([]);
  const [playgroundToolsUsed, setPlaygroundToolsUsed] = useState<any[]>([]);
  const [playgroundLogs, setPlaygroundLogs] = useState<string[]>([]);

  // Swarm launcher state
  const [swarmGoal, setSwarmGoal] = useState("Review uploaded payroll records and identify compliance risks");
  const [runningSwarm, setRunningSwarm] = useState(false);
  const [swarmError, setSwarmError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const playgroundEndRef = useRef<HTMLDivElement>(null);

  // Fetch agents directory
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

  // Fetch telemetry metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/metrics`);
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch (e) {
      console.error("Error loading metrics:", e);
    }
  }, [backendUrl]);

  // Fetch workflows
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/workflows`);
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
        if (data.length > 0 && !selectedRun) {
          setSelectedRun(data[0]);
        }
      }
    } catch (e) {
      console.error("Error loading workflows:", e);
    }
  }, [backendUrl, selectedRun]);

  // Fetch logs
  const fetchLogs = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/logs?run_id=${runId}`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (e) {
      console.error("Error loading logs:", e);
    }
  }, [backendUrl]);

  // Initialize
  useEffect(() => {
    fetchAgents();
    fetchMetrics();
    fetchWorkflows();
  }, [fetchAgents, fetchMetrics, fetchWorkflows]);

  // Swarm telemetry logs auto poll
  useEffect(() => {
    if (selectedRun && selectedRun.status === "running") {
      const timer = setInterval(() => {
        fetchWorkflows();
        fetchLogs(selectedRun.id);
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [selectedRun, fetchWorkflows, fetchLogs]);

  // Auto scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Auto scroll playground
  useEffect(() => {
    playgroundEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playgroundChat]);

  // Copilot agent builder auto generator mapping
  const handleCopilotGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotPrompt.trim()) return;

    setIsGenerating(true);

    setTimeout(() => {
      const prompt = copilotPrompt.toLowerCase();
      let name = "Smart Operations Agent";
      let role = "Operations Auditor";
      let key = "operations_auditor";
      let desc = "Automatically reviews business records to identify anomalies and compliance risks.";
      let systemPrompt = "You are a specialized agent designed to verify records, query indices, and audit transactions.";
      let goals = "1. Parse input invoices or records.\n2. Crosscheck numbers against Knowledge Graph relations.\n3. Flag anomalous ledger entries.";
      let rules = "1. Always ground calculations in retrieved document tables.\n2. Never assume missing database records.";
      let caps = "invoice_analysis, anomaly_review, compliance_research";

      if (prompt.includes("invoice") || prompt.includes("payment") || prompt.includes("suspicious")) {
        name = "Payment Reviewer Agent";
        role = "Fraud & Suspicious Transaction Auditor";
        key = "payment_reviewer";
        desc = "Reviews invoice totals, payment terms, and ledger postings to flag suspicious expenses.";
        systemPrompt = "You are the Payment Reviewer Agent. Your directive is to evaluate invoice totals, match against vendor records, and cross-reference payments with standard banking policies.";
        goals = "1. Identify invoices with risk flags.\n2. Trace ledger accounts for suspicious transfer amounts.";
        caps = "invoice_analysis, anomaly_review, fraud_detection";
      } else if (prompt.includes("compliance") || prompt.includes("policy") || prompt.includes("regulation")) {
        name = "Policy Governance Agent";
        role = "Compliance & Regulatory Specialist";
        key = "policy_governance";
        desc = "Monitors operational workflow logs to enforce regulatory requirements and ISO security standards.";
        systemPrompt = "You are the Policy Governance Agent. You focus on auditing document uploads and workflow execution steps against corporate compliance policies.";
        goals = "1. Review document metadata for confidentiality violations.\n2. Inspect workflow runs for regulatory safety policies.";
        caps = "compliance_research, document_retrieval, governance_audit";
      } else if (prompt.includes("crm") || prompt.includes("lead") || prompt.includes("sales")) {
        name = "CRM Research Agent";
        role = "Sales Pipeline Enrichment Specialist";
        key = "crm_research_agent";
        desc = "Ingests sales pipeline leads, enriches organization details, and drafts outreaches.";
        systemPrompt = "You are the CRM Research Agent. You retrieve prospect data and structure customized email campaigns using grounded context.";
        goals = "1. Score leads based on fit matrices.\n2. Generate context-rich outreach emails.";
        caps = "lead_analysis, outreach_generation, sales_intelligence";
      }

      setBuilderName(name);
      setBuilderRole(role);
      setBuilderKey(key);
      setBuilderDesc(desc);
      setBuilderPrompt(systemPrompt);
      setBuilderGoals(goals);
      setBuilderRules(rules);
      setBuilderCapabilities(caps);
      setBuilderCategory("Operations");

      // Auto check tools
      setToolSearch(true);
      setToolGraph(true);
      setToolRAG(true);
      setToolWorkflow(false);

      setIsGenerating(false);
      setCopilotPrompt("");
    }, 1500);
  };

  // Submit/Deploy Agent Builder
  const handleDeployAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderKey.trim() || !builderName.trim() || !builderRole.trim()) return;

    setSubmittingAgent(true);

    try {
      // 1. Create/Register agent config
      const capabilitiesArr = builderCapabilities.split(",").map(c => c.trim()).filter(Boolean);
      const res = await fetch(`${backendUrl}/api/v1/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: builderKey,
          name: builderName,
          role: builderRole,
          description: builderDesc,
          capabilities: capabilitiesArr,
          system_prompt: builderPrompt || `You are the ${builderName} specializing in ${builderRole}.`
        })
      });

      if (res.ok) {
        // 2. Update status (deploy)
        await fetch(`${backendUrl}/api/v1/agents/deploy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: builderKey,
            status: builderStatus
          })
        });

        alert(`Successfully deployed AI Agent: ${builderName} (${builderStatus})`);
        
        // Refresh local cache
        await fetchAgents();
        
        // Reset form
        setBuilderKey("");
        setBuilderName("");
        setBuilderRole("");
        setBuilderDesc("");
        setBuilderPrompt("");
        setBuilderGoals("");
        setBuilderRules("");
        setBuilderEscalation("");
        setBuilderCapabilities("");
        
        // Route to marketplace to view newly added agent
        setActiveSubTab("marketplace");
      } else {
        alert("Failed to deploy agent. Please verify key is unique.");
      }
    } catch (err) {
      console.error(err);
      alert("Connection failure deploying agent.");
    } finally {
      setSubmittingAgent(false);
    }
  };

  // Run Test in Playground
  const handlePlaygroundSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundMsg.trim()) return;

    const userText = playgroundMsg.trim();
    setPlaygroundMsg("");
    setTestingAgent(true);

    // Append user query in playground chat
    setPlaygroundChat(prev => [...prev, { sender: "user", content: userText }]);

    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: selectedAgentKey,
          message: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setPlaygroundChat(prev => [...prev, { sender: data.sender, content: data.content }]);
        setPlaygroundTrace(data.reasoning_trace || []);
        setPlaygroundToolsUsed(data.tool_calls || []);
        setPlaygroundLogs(data.logs || []);
      } else {
        setPlaygroundChat(prev => [...prev, { sender: "system", content: "Error: Simulation endpoint returned rejection." }]);
      }
    } catch (err) {
      setPlaygroundChat(prev => [...prev, { sender: "system", content: "Error: Playground connection failure." }]);
    } finally {
      setTestingAgent(false);
    }
  };

  // Launch Swarm Orchestration Run
  const handleLaunchSwarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!swarmGoal.trim()) return;

    setRunningSwarm(true);
    setSwarmError(null);
    setLogs([]);

    try {
      const res = await fetch(`${backendUrl}/api/v1/agents/run-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: swarmGoal,
          context: {}
        })
      });

      if (res.ok) {
        const data = await res.json();
        await fetchWorkflows();
        if (data.run_id) {
          const runDetails: WorkflowRun = {
            id: data.run_id,
            goal: swarmGoal,
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
        setSwarmError(errData.detail || "Task runner failed.");
      }
    } catch (err) {
      setSwarmError("Failed to dispatch swarm. Mainframe unreachable.");
    } finally {
      setRunningSwarm(false);
    }
  };

  const loadAgentToBuilder = (agent: Agent) => {
    setBuilderKey(agent.key);
    setBuilderName(agent.name);
    setBuilderRole(agent.role);
    setBuilderDesc(agent.description);
    setBuilderPrompt(agent.system_prompt);
    setBuilderCapabilities(agent.capabilities.join(", "));
    setBuilderStatus((agent.status as any) || "Published");
    setBuilderCategory(agent.category || "Operations");
    setMemoryShort(agent.memory_short ?? true);
    setMemoryLong(agent.memory_long ?? false);
    setSelectedKnowledge(agent.knowledge_sources || []);
    setApprovalRequired(agent.approval_required ?? false);
    
    // Auto-detect capabilities
    setToolSearch(agent.capabilities.includes("document_retrieval"));
    setToolGraph(agent.capabilities.includes("knowledge_summarization"));
    setToolWorkflow(agent.capabilities.includes("execute_workflows"));
    setToolRAG(agent.capabilities.includes("rag_search"));
    setToolNotifications(agent.capabilities.includes("notifications"));
    setToolResearch(agent.capabilities.includes("research_jobs"));

    setActiveSubTab("builder");
  };

  // Filtered agents list
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || agent.category === categoryFilter || (!agent.category && categoryFilter === "Operations");
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fadeIn text-xs">
      
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-darkBorder/40 pb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neonIndigo animate-pulse" />
            Visual AI Agent Builder Console
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Configure specialized AI agents, toggle retrieval tools, monitor telemetry, and test run chat playgrounds without code.
          </p>
        </div>

        {/* Global tab routing buttons */}
        <div className="flex bg-darkPanel/40 p-1 rounded-lg border border-darkBorder/60 text-[10px] font-mono font-bold uppercase">
          {[
            { id: "marketplace", label: "Agent Marketplace", icon: Users },
            { id: "builder", label: "Agent Builder", icon: Sliders },
            { id: "playground", label: "Playground", icon: Terminal },
            { id: "monitoring", label: "Telemetry", icon: BarChart3 },
            { id: "swarm", label: "Swarm Orchestrator", icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer transition-all ${
                  activeSubTab === tab.id
                    ? "bg-neonIndigo text-white shadow-lg"
                    : "text-darkMuted hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content views */}

      {/* Tab 1: Agent Marketplace */}
      {activeSubTab === "marketplace" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filtering Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-darkPanel/25 p-4 border border-darkBorder rounded-xl">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 text-darkMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registered agents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg pl-9 pr-4 py-2 text-xs text-gray-200 outline-none placeholder:text-darkMuted font-mono"
              />
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-2">
                <span className="text-darkMuted font-semibold">Filter:</span>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-darkBg border border-darkBorder rounded px-2.5 py-1.5 text-gray-200"
                >
                  <option value="all">All Categories</option>
                  <option value="Operations">Operations</option>
                  <option value="Finance">Finance</option>
                  <option value="Compliance">Compliance</option>
                  <option value="Intelligence">Intelligence</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setBuilderKey("");
                  setBuilderName("");
                  setBuilderRole("");
                  setBuilderDesc("");
                  setBuilderPrompt("");
                  setBuilderCapabilities("");
                  setActiveSubTab("builder");
                }}
                className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" /> Create Custom Agent
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map(agent => (
              <div 
                key={agent.key} 
                className="bg-darkPanel/20 border border-darkBorder hover:border-neonIndigo/40 hover:bg-darkPanel/30 rounded-2xl p-5 flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 flex items-center justify-center shrink-0">
                        <Cpu className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-100 text-sm">{agent.name}</h4>
                        <span className="text-[9px] font-mono text-darkMuted uppercase">{agent.role}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${
                      agent.status === "Archived" ? "bg-darkPanel text-darkMuted border border-darkBorder" :
                      agent.status === "Testing" ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" :
                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                    }`}>
                      {agent.status || "Published"}
                    </span>
                  </div>

                  <p className="text-darkMuted text-[11px] leading-relaxed line-clamp-3">
                    {agent.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map(cap => (
                      <span key={cap} className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-darkBg text-neonTeal border border-darkBorder/60">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-darkBorder/40 mt-4 pt-4 flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setSelectedAgentKey(agent.key);
                      setPlaygroundChat([
                        { sender: "system", content: `Playground connected to agent node [${agent.name}]. Submit query statement to test.` }
                      ]);
                      setPlaygroundTrace([]);
                      setPlaygroundToolsUsed([]);
                      setPlaygroundLogs([]);
                      setActiveSubTab("playground");
                    }}
                    className="px-3 py-1.5 bg-darkBg hover:bg-darkBorder border border-darkBorder text-gray-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Terminal className="w-3.5 h-3.5" /> Test Playground
                  </button>
                  <button
                    onClick={() => loadAgentToBuilder(agent)}
                    className="px-3 py-1.5 bg-neonIndigo/15 hover:bg-neonIndigo hover:text-white border border-neonIndigo/20 rounded-lg text-neonIndigo transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" /> Edit Config
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Agent Builder Configurator Panel */}
      {activeSubTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left panel inputs (8 cols) */}
          <form onSubmit={handleDeployAgent} className="lg:col-span-8 space-y-6">
            
            {/* Identity Group */}
            <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-bold text-neonIndigo uppercase tracking-widest border-b border-darkBorder/40 pb-2 flex items-center gap-1.5">
                <Sliders className="w-4 h-4" /> 1. Agent Identity
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Agent Identifier Key (Unique Id)</label>
                  <input
                    type="text"
                    placeholder="e.g. payroll_auditor"
                    value={builderKey}
                    onChange={e => setBuilderKey(e.target.value)}
                    required
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Agent Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Payroll Reviewer Agent"
                    value={builderName}
                    onChange={e => setBuilderName(e.target.value)}
                    required
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Clearance Privilege Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Compliance Audit Agent"
                    value={builderRole}
                    onChange={e => setBuilderRole(e.target.value)}
                    required
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Category Classification</label>
                  <select
                    value={builderCategory}
                    onChange={e => setBuilderCategory(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none"
                  >
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Compliance">Compliance</option>
                    <option value="Intelligence">Intelligence</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">Mission / Objective Description</label>
                <input
                  type="text"
                  placeholder="e.g. Review transactions and identify regulatory non-compliance..."
                  value={builderDesc}
                  onChange={e => setBuilderDesc(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none"
                />
              </div>
            </div>

            {/* Instruction System Prompt */}
            <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-bold text-neonTeal uppercase tracking-widest border-b border-darkBorder/40 pb-2 flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> 2. Operating Instructions
              </h3>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 block">System Persona Prompt (Behavior Directive)</label>
                <textarea
                  placeholder="You are a specialized agent designed to verify calculations..."
                  value={builderPrompt}
                  onChange={e => setBuilderPrompt(e.target.value)}
                  required
                  className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none min-h-[70px] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Agent Execution Goals</label>
                  <textarea
                    placeholder="1. Verify invoice details against files.&#10;2. Calculate total values."
                    value={builderGoals}
                    onChange={e => setBuilderGoals(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none min-h-[70px] resize-none font-mono text-[10px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300 block">Guardrail Escalation Rules</label>
                  <textarea
                    placeholder="1. If anomaly risk exceeds 70%, request approval.&#10;2. Never auto-commit payouts."
                    value={builderRules}
                    onChange={e => setBuilderRules(e.target.value)}
                    className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none min-h-[70px] resize-none font-mono text-[10px]"
                  />
                </div>
              </div>
            </div>

            {/* Tools, Memory & Permissions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Tool Toggles */}
              <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-2xl space-y-4">
                <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest border-b border-darkBorder/40 pb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> 3. Available Tools Integration
                </h3>
                
                <div className="space-y-3.5">
                  {[
                    { state: toolSearch, set: setToolSearch, label: "Day 19 Enterprise Search Engine", desc: "Allows retrieval of indexed document context" },
                    { state: toolGraph, set: setToolGraph, label: "Day 18 Knowledge Graph Schema", desc: "Trace downstream relational nodes" },
                    { state: toolRAG, set: setToolRAG, label: "Standard RAG Vector Store", desc: "Retrieve context matching key phrases" },
                    { state: toolWorkflow, set: setToolWorkflow, label: "Workflow Executor", desc: "Trigger named automated loops" },
                    { state: toolNotifications, set: setToolNotifications, label: "Alert Notification Hub", desc: "Emit warning triggers to channels" },
                    { state: toolResearch, set: setToolResearch, label: "Day 20 Research Engine", desc: "Launch autonomous deep research jobs" }
                  ].map(tool => (
                    <div key={tool.label} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={tool.state}
                        onChange={e => tool.set(e.target.checked)}
                        className="rounded bg-darkBg border-darkBorder text-neonIndigo focus:ring-0 mt-0.5"
                      />
                      <div>
                        <span className="font-semibold text-gray-200 block text-[11px]">{tool.label}</span>
                        <span className="text-[10px] text-darkMuted block mt-0.5">{tool.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memory & Permission Controls */}
              <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-2xl space-y-6">
                
                {/* Memory Settings */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-neonIndigo uppercase tracking-widest border-b border-darkBorder/40 pb-2 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> 4. Memory Configurations
                  </h3>
                  
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 select-none">
                      <input
                        type="checkbox"
                        checked={memoryShort}
                        onChange={e => setMemoryShort(e.target.checked)}
                        className="rounded bg-darkBg border-darkBorder text-neonIndigo focus:ring-0"
                      />
                      <span className="text-gray-300 font-semibold">Short-Term Context</span>
                    </label>
                    <label className="flex items-center gap-2 select-none">
                      <input
                        type="checkbox"
                        checked={memoryLong}
                        onChange={e => setMemoryLong(e.target.checked)}
                        className="rounded bg-darkBg border-darkBorder text-neonIndigo focus:ring-0"
                      />
                      <span className="text-gray-300 font-semibold">Long-Term Storage</span>
                    </label>
                  </div>
                </div>

                {/* RBAC Integration & Approval rules */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest border-b border-darkBorder/40 pb-2 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> 5. RBAC Clearance & Approvals
                  </h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-2.5 select-none">
                      <input
                        type="checkbox"
                        checked={approvalRequired}
                        onChange={e => setApprovalRequired(e.target.checked)}
                        className="rounded bg-darkBg border-darkBorder text-neonIndigo focus:ring-0 mt-0.5"
                      />
                      <div>
                        <span className="text-gray-200 font-semibold block">Require Administrator Approval</span>
                        <span className="text-[10px] text-darkMuted block mt-0.5">Enforce high-risk actions to route through the review queues first.</span>
                      </div>
                    </label>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono font-bold text-darkMuted block uppercase">Capabilities (Comma separated)</label>
                      <input
                        type="text"
                        placeholder="e.g. invoice_analysis, anomaly_review"
                        value={builderCapabilities}
                        onChange={e => setBuilderCapabilities(e.target.value)}
                        className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 font-mono text-[10.5px]"
                      />
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Submit Bar */}
            <div className="p-4 bg-darkPanel/30 border border-darkBorder rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-darkMuted font-semibold font-mono uppercase text-[10px]">Lifecycle Status:</span>
                <div className="flex bg-darkBg p-0.5 rounded border border-darkBorder text-[9px] font-mono font-bold uppercase">
                  {(["Draft", "Testing", "Published", "Archived"] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBuilderStatus(st)}
                      className={`px-3 py-1.5 rounded cursor-pointer ${
                        builderStatus === st
                          ? "bg-neonIndigo text-white"
                          : "text-darkMuted hover:text-gray-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAgent || !builderKey.trim() || !builderName.trim()}
                className="px-6 py-2.5 bg-neonTeal hover:bg-neonTeal/85 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 font-mono tracking-wide"
              >
                {submittingAgent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                DEPLOY AGENT
              </button>
            </div>

          </form>

          {/* Right panel: Copilot generator overlay (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-neonIndigo animate-pulse" />
                <h3 className="text-xs font-bold text-gray-200">AI Copilot Agent Generator</h3>
              </div>
              
              <p className="text-[11px] text-darkMuted leading-relaxed">
                Describe the target agent objectives in simple natural language. The copilot will automatically generate matching identity, behavior prompts, capabilities, and tool toggles.
              </p>

              <form onSubmit={handleCopilotGenerate} className="space-y-3 text-xs">
                <textarea
                  placeholder="e.g. Create a policy governance agent that scans invoice details and triggers slack alerts for compliance failures..."
                  value={copilotPrompt}
                  onChange={e => setCopilotPrompt(e.target.value)}
                  required
                  className="w-full bg-darkBg border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 outline-none min-h-[90px] resize-none"
                />
                
                <button
                  type="submit"
                  disabled={isGenerating || !copilotPrompt.trim()}
                  className="w-full py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 font-mono text-[10px]"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
                  GENERATE AGENT
                </button>
              </form>
            </div>

            {/* Quick config helper info */}
            <div className="p-5 bg-darkPanel/10 border border-darkBorder/40 rounded-2xl space-y-2 text-darkMuted leading-relaxed text-[11px]">
              <h4 className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-neonTeal" /> Configuration Help
              </h4>
              <p>
                - <b>Short-Term Memory</b> keeps context alive within a single execution chat session.<br/>
                - <b>Long-Term Memory</b> logs observations in database schema for recall across multiple runs.<br/>
                - Ensure that capability flags matches the corresponding specialized modules in the backend registry.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: Agent Playground Chat */}
      {activeSubTab === "playground" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          
          {/* Left: Chat thread (7 cols) */}
          <div className="lg:col-span-7 border border-darkBorder rounded-2xl bg-darkPanel/10 overflow-hidden flex flex-col h-[520px]">
            
            {/* Header selection */}
            <div className="p-4 bg-darkPanel/30 border-b border-darkBorder/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-mono text-[10px] text-darkMuted uppercase">TESTING TARGET:</span>
                <select
                  value={selectedAgentKey}
                  onChange={e => {
                    setSelectedAgentKey(e.target.value);
                    const agent = agents.find(a => a.key === e.target.value);
                    setPlaygroundChat([
                      { sender: "system", content: `Playground connected to agent node [${agent ? agent.name : e.target.value}]. Submit queries.` }
                    ]);
                    setPlaygroundTrace([]);
                    setPlaygroundToolsUsed([]);
                    setPlaygroundLogs([]);
                  }}
                  className="bg-darkBg border border-darkBorder rounded px-2.5 py-1 text-gray-200 text-xs font-semibold focus:outline-none"
                >
                  {agents.map(a => (
                    <option key={a.key} value={a.key}>{a.name}</option>
                  ))}
                </select>
              </div>
              <span className="text-[9px] font-mono text-darkMuted uppercase">clearance: {selectedAgent?.role}</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 select-text">
              {playgroundChat.map((msg, idx) => {
                const isSystem = msg.sender === "system";
                const isUser = msg.sender === "user";
                return (
                  <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-md p-3.5 rounded-xl border ${
                      isSystem 
                        ? "bg-darkBg border-darkBorder/60 text-darkMuted font-mono text-[10px]" 
                        : isUser 
                        ? "bg-neonIndigo/10 border-neonIndigo/30 text-gray-200" 
                        : "bg-darkPanel/20 border-darkBorder text-gray-300"
                    }`}>
                      {!isSystem && (
                        <span className="text-[8px] font-mono uppercase tracking-wider text-darkMuted block mb-1">
                          {isUser ? "Operator" : selectedAgent?.name}
                        </span>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              {testingAgent && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-xl border border-darkBorder bg-darkPanel/10 text-darkMuted flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="font-mono text-[9px] uppercase">Reasoning steps running...</span>
                  </div>
                </div>
              )}
              <div ref={playgroundEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handlePlaygroundSend} className="p-3 bg-darkPanel/30 border-t border-darkBorder/60 flex gap-2">
              <input
                type="text"
                placeholder={`Ask ${selectedAgent?.name || "agent"} anything...`}
                value={playgroundMsg}
                onChange={e => setPlaygroundMsg(e.target.value)}
                disabled={testingAgent}
                className="flex-1 bg-darkBg border border-darkBorder rounded-lg px-3.5 py-2 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
              />
              <button
                type="submit"
                disabled={testingAgent || !playgroundMsg.trim()}
                className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Test</span>
              </button>
            </form>
          </div>

          {/* Right: Traces, tools & logs (5 cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col h-[520px] justify-between">
            
            {/* Reasoning Trace */}
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl flex-1 overflow-y-auto space-y-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block border-b border-darkBorder/40 pb-1.5">
                AI Reasoning Trace Steps
              </span>
              {playgroundTrace.length === 0 ? (
                <p className="text-darkMuted italic text-center py-8">Trace log empty. Send a prompt to display reasoning steps.</p>
              ) : (
                <div className="space-y-2 select-text">
                  {playgroundTrace.map((step, idx) => (
                    <div key={idx} className="flex gap-2 text-[10.5px] leading-relaxed text-gray-300">
                      <span className="text-neonIndigo font-semibold">►</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tools Executed */}
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl h-[140px] overflow-y-auto space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block border-b border-darkBorder/40 pb-1.5">
                Tools Executed
              </span>
              {playgroundToolsUsed.length === 0 ? (
                <p className="text-darkMuted italic text-center py-2">No active tools triggered.</p>
              ) : (
                <div className="space-y-1.5 select-text">
                  {playgroundToolsUsed.map((tc, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-darkBg/60 p-1.5 px-2.5 border border-darkBorder/60 rounded">
                      <span className="font-semibold text-gray-200">{tc.tool}</span>
                      <span className="text-[9px] font-mono text-darkMuted">{tc.action} ({tc.status})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Playground logs console */}
            <div className="p-4 bg-darkPanel/25 border border-darkBorder rounded-2xl h-[120px] overflow-y-auto font-mono text-[9px] text-darkMuted space-y-1 select-text">
              <span className="text-[9.5px] uppercase font-bold tracking-widest text-darkMuted block mb-1 border-b border-darkBorder/30 pb-1">
                SYSTEM AGENT CONSOLE STREAMS
              </span>
              {playgroundLogs.length === 0 ? (
                <p className="italic">Console logs standby.</p>
              ) : (
                playgroundLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))
              )}
            </div>

          </div>

        </div>
      )}

      {/* Tab 4: Agent Telemetry Dashboard */}
      {activeSubTab === "monitoring" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold">
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-1">
              <span className="text-[9px] font-mono text-darkMuted uppercase block">TOTAL AGENT DISPATCHES</span>
              <span className="text-lg font-bold text-gray-100 block">{metrics?.total_runs || 18} RUNS</span>
            </div>
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-1">
              <span className="text-[9px] font-mono text-darkMuted uppercase block">SUCCESS CONTEXT</span>
              <span className="text-lg font-bold text-emerald-400 block">{metrics?.success_rate || 94.4}%</span>
            </div>
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-1">
              <span className="text-[9px] font-mono text-darkMuted uppercase block">FAILURE RATE</span>
              <span className="text-lg font-bold text-rose-400 block">{metrics?.failure_rate || 5.6}%</span>
            </div>
            <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-1">
              <span className="text-[9px] font-mono text-darkMuted uppercase block">AVG RESPONSE LATENCY</span>
              <span className="text-lg font-bold text-neonIndigo block">{metrics?.avg_execution_time || 2350} MS</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Tool usage charts (7 cols) */}
            <div className="lg:col-span-7 p-5 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                <BarChart3 className="w-4 h-4 text-neonIndigo" />
                Specialized Tool Invocations Counter
              </h3>
              
              {metrics?.tool_usage ? (
                <div className="space-y-4 select-none">
                  {Object.entries(metrics.tool_usage).map(([toolName, val]: any) => (
                    <div key={toolName} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-gray-200">{toolName}</span>
                        <span className="font-mono text-darkMuted">{val} runs</span>
                      </div>
                      <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden border border-darkBorder/30">
                        <div 
                          className="h-full bg-gradient-to-r from-neonIndigo to-neonTeal rounded-full" 
                          style={{ width: `${Math.min(val * 1.5, 100)}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-darkMuted italic py-6 text-center">Loading telemetry...</p>
              )}
            </div>

            {/* Approval request logs (5 cols) */}
            <div className="lg:col-span-5 p-5 bg-darkPanel/20 border border-darkBorder rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                <Shield className="w-4 h-4 text-rose-400" />
                Escalated Security Approvals
              </h3>
              
              <div className="space-y-3.5 select-text">
                <div className="p-3 bg-rose-950/10 border border-rose-900/30 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-400">FINANCE_AGENT</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-400">PENDING</span>
                  </div>
                  <p className="text-gray-300 text-[10.5px]">Invoice total $12,450.00 matches anomaly checks: duplicate invoice number check fail.</p>
                </div>

                <div className="p-3 bg-darkBg/60 border border-darkBorder/60 rounded-xl space-y-1 text-xs opacity-75">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-300">PAYROLL_REVIEWER</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-darkPanel text-darkMuted">APPROVED</span>
                  </div>
                  <p className="text-darkMuted text-[10.5px]">Adjusted net pay for Employee ID #245 exceeds limit by 15%: verified bonus allocation document.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tab 5: Swarm Orchestrator (legacy interface updated) */}
      {activeSubTab === "swarm" && (
        <div className="space-y-6 animate-fadeIn">
          {/* suggest goal chips */}
          <div className="flex flex-wrap gap-2 text-xs items-center">
            <span className="text-darkMuted font-medium">Quick Tasks:</span>
            {[
              "Review uploaded payroll records and identify compliance risks",
              "Process all uploaded invoices and generate weekly financial summary",
              "Analyze recent CRM leads, enrich details, score qualifications, and write outreaches"
            ].map(suggestion => (
              <button 
                key={suggestion}
                onClick={() => setSwarmGoal(suggestion)}
                className="px-2.5 py-1 bg-darkPanel/30 border border-darkBorder hover:border-neonIndigo/55 rounded-lg text-gray-300 transition-colors text-[11px] cursor-pointer"
              >
                {suggestion.slice(0, 30)}...
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Launcher (col-span-8) */}
            <div className="lg:col-span-8 space-y-6">
              <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-neonIndigo uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                    <Sparkles className="w-4 h-4" />
                    Submit Task Goal to Swarm Coordinator
                  </h3>
                  <p className="text-[10px] text-darkMuted mt-1">Let agents plan task decomposition pipelines autonomously</p>
                </div>

                <form onSubmit={handleLaunchSwarm} className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="Submit goal statement..."
                    value={swarmGoal}
                    onChange={(e) => setSwarmGoal(e.target.value)}
                    className="flex-1 bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-3.5 py-2.5 text-xs text-gray-200 placeholder:text-darkMuted outline-none transition-all"
                    disabled={runningSwarm}
                  />
                  <button
                    type="submit"
                    disabled={runningSwarm || !swarmGoal.trim()}
                    className="px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-neonIndigo hover:bg-neonIndigo/85 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {runningSwarm ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    Launch Swarm
                  </button>
                </form>

                {swarmError && (
                  <p className="text-xs text-rose-400 font-mono bg-rose-950/20 border border-rose-500/20 p-3 rounded-lg">
                    [ALERT] {swarmError}
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

              {/* Shared memory & Final Report pane */}
              {selectedRun && (
                <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-4 animate-fadeIn">
                  <span className="text-xs font-bold text-neonIndigo uppercase tracking-wider flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                    <Layers className="w-4 h-4" />
                    Swarm Audit Report Output & Shared Memory
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Final Report Card (col-span-8) */}
                    <div className="sm:col-span-8 p-4 bg-darkBg/50 border border-darkBorder rounded-xl space-y-3 select-text">
                      <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block border-b border-darkBorder/30 pb-2">
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
                    <div className="sm:col-span-4 p-4 bg-darkBg/50 border border-darkBorder rounded-xl space-y-3">
                      <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block border-b border-darkBorder/30 pb-2">
                        Context Inspector
                      </span>
                      
                      <div className="space-y-2 overflow-y-auto max-h-[220px] text-[10px] font-mono pr-1 select-text">
                        {selectedRun.shared_memory && Object.keys(selectedRun.shared_memory).length > 0 ? (
                          Object.entries(selectedRun.shared_memory).map(([key, val]) => {
                            if (key === "final_report") return null;
                            return (
                              <div key={key} className="p-2 bg-darkPanel/25 border border-darkBorder rounded-lg space-y-1">
                                <span className="text-neonTeal block font-semibold">{key}</span>
                                <pre className="text-darkMuted whitespace-pre-wrap leading-tight text-[9px] max-h-[100px] overflow-y-auto">
                                  {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                                </pre>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-darkMuted italic text-center py-8">Memory context empty.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Bus Logs (col-span-4) */}
            <div className="lg:col-span-4 p-5 bg-darkPanel/25 border border-darkBorder rounded-xl flex flex-col h-[520px] justify-between">
              <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2">
                <span className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  Swarm Comm Bus Live Log
                </span>
                <span className="text-[9px] text-neonTeal font-mono font-bold animate-pulse">Relay Bus</span>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-gray-300 space-y-3 my-3 pr-2.5 select-text">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-darkMuted text-center">
                    <Terminal className="w-8 h-8 opacity-25 mb-2" />
                    <p>Logs standby.</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const isSystem = log.sender === "system" || log.recipient === "system_bus";
                    const isResult = log.message_type === "task_result";
                    return (
                      <div 
                        key={log.id} 
                        className={`p-2 border rounded ${
                          isSystem 
                            ? "bg-darkBg/60 border-darkBorder/60 text-darkMuted" 
                            : isResult 
                            ? "bg-emerald-950/5 border-emerald-500/20 text-emerald-300"
                            : "bg-darkBg/40 border-neonIndigo/20 text-neonIndigo"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[8.5px] opacity-70 mb-1 border-b border-darkBorder/20 pb-0.5">
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

              <div className="border-t border-darkBorder/30 pt-3">
                <span className="text-[9px] font-mono text-darkMuted block">SELECT EXECUTION:</span>
                <div className="space-y-1.5 max-h-[120px] overflow-y-auto mt-1.5">
                  {workflows.slice(0, 4).map(run => (
                    <div
                      key={run.id}
                      onClick={() => { setSelectedRun(run); fetchLogs(run.id); }}
                      className={`p-2 bg-darkBg/40 border rounded cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        selectedRun && selectedRun.id === run.id ? "border-neonIndigo" : "border-darkBorder"
                      }`}
                    >
                      <span className="truncate font-semibold text-[10px] text-gray-200">{run.goal}</span>
                      <span className={`px-1 rounded text-[8px] font-bold ${
                        run.status === "success" ? "bg-emerald-500/10 text-emerald-400" :
                        run.status === "failed" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                      }`}>{run.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
