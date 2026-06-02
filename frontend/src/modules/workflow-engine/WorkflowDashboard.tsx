import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Play, Plus, CheckCircle2, XCircle, RefreshCw,
  Loader2, Sparkles, Send, FileText,
  Clock, Database, Mail, ShieldAlert, Trash2, Settings, Zap, X
} from "lucide-react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  MiniMap,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const STEP_TYPES = [
  { name: "extract_document", label: "Extract Document", desc: "Structured Invoice/Payroll Schema Parsing", icon: FileText, color: "#6366f1" },
  { name: "detect_anomalies", label: "Detect Anomalies", desc: "Compliance Auditing & Fraud Verification", icon: ShieldAlert, color: "#ef4444" },
  { name: "summarize_document", label: "Summarize", desc: "AI Document Digest Summarization", icon: Clock, color: "#38bdf8" },
  { name: "search_vector_db", label: "Vector Search", desc: "RAG Semantic Context Querying", icon: Database, color: "#10b981" },
  { name: "send_email", label: "Send Email", desc: "Mock Notification Alert Relay", icon: Mail, color: "#f59e0b" },
  { name: "generate_report", label: "Generate Report", desc: "Findings Document Assembly", icon: FileText, color: "#a855f7" },
  { name: "run_agent", label: "Run Agent", desc: "Dispatch AI Sub-Agent Task", icon: Zap, color: "#06b6d4" },
];

// Custom Node renderer for the canvas
function WorkflowStepNode({ data, selected }: { data: any; selected?: boolean }) {
  const stepType = STEP_TYPES.find(s => s.name === data.stepType) || STEP_TYPES[0];
  const Icon = stepType.icon;
  return (
    <div
      className={`rounded-xl border-2 bg-[#0b0d16] shadow-xl transition-all w-[180px] ${
        selected ? "border-[#6366f1] shadow-[0_0_16px_rgba(99,102,241,0.35)]" : "border-[#1a1e2d]"
      }`}
    >
      {/* Node header */}
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[#1a1e2d]" style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: `${stepType.color}22` }}>
          <Icon className="w-3 h-3" style={{ color: stepType.color }} />
        </div>
        <span className="text-[11px] font-bold text-gray-200 truncate">{data.label}</span>
      </div>
      {/* Node body */}
      <div className="px-3 py-2">
        <p className="text-[9px] text-[#717d96] leading-normal">{stepType.desc}</p>
        {data.retries > 0 && (
          <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] text-amber-400">
            <RefreshCw className="w-2.5 h-2.5" /> {data.retries} retries
          </span>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { workflowStep: WorkflowStepNode };

interface StepLog {
  id: string;
  step_name: string;
  status: "success" | "failed" | "running" | "pending";
  execution_time_ms: number;
  retry_count: number;
  error?: string;
  output_data?: unknown;
  created_at: string;
}

interface WorkflowRun {
  id: string;
  workflow_id?: string;
  workflow_name: string;
  status: "success" | "failed" | "running" | "pending";
  input_context: unknown;
  output_context: unknown;
  started_at: string;
  completed_at?: string;
  error?: string;
  steps?: StepLog[];
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  created_at: string;
}

interface DocumentInfo {
  id: string;
  filename: string;
  document_type?: string;
}

interface WorkflowDashboardProps {
  backendUrl: string;
}

let nodeIdCounter = 100;
const nextNodeId = () => `wf-node-${++nodeIdCounter}`;

export function WorkflowDashboard({ backendUrl }: WorkflowDashboardProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  // Active view: 'builder' | 'planner' | 'history'
  const [view, setView] = useState<"builder" | "planner" | "history">("builder");

  // React Flow canvas state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Builder workflow metadata
  const [builderName, setBuilderName] = useState("Untitled Workflow");
  const [builderDesc, setBuilderDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Planner
  const [goalPrompt, setGoalPrompt] = useState("");
  const [selectedRunDocId, setSelectedRunDocId] = useState("");
  const [planningAndRunning, setPlanningAndRunning] = useState(false);

  // History inspector
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows/runs`);
      if (res.ok) setRuns(await res.json());
    } catch (e) { console.error(e); }
  }, [backendUrl]);

  const fetchRunDetails = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows/runs/${runId}`);
      if (res.ok) setSelectedRun(await res.json());
    } catch (e) { console.error(e); }
  }, [backendUrl]);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows`);
      if (res.ok) setWorkflows(await res.json());
    } catch (e) { console.error(e); }
  }, [backendUrl]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/documents`);
      if (res.ok) setDocuments(await res.json());
    } catch (e) { console.error(e); }
  }, [backendUrl]);

  useEffect(() => {
    Promise.all([fetchRuns(), fetchDocuments(), fetchWorkflows()]).finally(() => setLoading(false));
  }, [fetchRuns, fetchDocuments, fetchWorkflows]);

  // Poll running executions
  useEffect(() => {
    const hasRunning = runs.some(r => r.status === "running");
    if (!hasRunning) return;
    const timer = setInterval(() => {
      fetchRuns();
      if (selectedRun?.status === "running") fetchRunDetails(selectedRun.id);
    }, 2000);
    return () => clearInterval(timer);
  }, [runs, selectedRun, fetchRuns, fetchRunDetails]);

  // ── Canvas helpers ──────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, animated: true, style: { stroke: "#6366f1", strokeWidth: 1.5 } }, eds)),
    [setEdges]
  );

  const addStepToCanvas = (stepType: typeof STEP_TYPES[0]) => {
    const id = nextNodeId();
    const col = nodes.length % 4;
    const row = Math.floor(nodes.length / 4);
    const newNode: Node = {
      id,
      type: "workflowStep",
      position: { x: 60 + col * 220, y: 60 + row * 120 },
      data: { label: stepType.label, stepType: stepType.name, retries: 0 },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNode(newNode);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const updateSelectedNodeLabel = (label: string) => {
    setNodes(nds => nds.map(n => n.id === selectedNode?.id ? { ...n, data: { ...n.data, label } } : n));
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, label } } : prev);
  };

  const updateSelectedNodeRetries = (retries: number) => {
    setNodes(nds => nds.map(n => n.id === selectedNode?.id ? { ...n, data: { ...n.data, retries } } : n));
    setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, retries } } : prev);
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setSelectedNode(null);
  };

  // Save the visual canvas as a workflow definition
  const handleSaveCanvasWorkflow = async () => {
    if (nodes.length === 0 || !builderName.trim()) return;
    setSaving(true);
    setSaveSuccess(false);
    // Derive ordered steps by following the edge chain (simple topological sort)
    const orderedSteps: string[] = [];
    const visited = new Set<string>();
    const adjacency: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    nodes.forEach(n => { adjacency[n.id] = []; inDegree[n.id] = 0; });
    edges.forEach(e => {
      adjacency[e.source]?.push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });
    const queue = nodes.filter(n => (inDegree[n.id] || 0) === 0).map(n => n.id);
    while (queue.length) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const node = nodes.find(n => n.id === cur);
      if (node) orderedSteps.push(node.data.stepType as string);
      (adjacency[cur] || []).forEach(next => queue.push(next));
    }
    // Fallback: unconnected nodes appended at end
    nodes.forEach(n => { if (!visited.has(n.id)) orderedSteps.push(n.data.stepType as string); });

    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: builderName, description: builderDesc, steps: orderedSteps }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchWorkflows();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  // Execute a workflow from the library
  const handleRunWorkflow = async (workflowId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_id: workflowId, input_context: {} }),
      });
      if (res.ok) {
        fetchRuns();
        setView("history");
        setSelectedRun(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const handlePlanAndRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalPrompt.trim()) return;
    setPlanningAndRunning(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/workflows/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_goal: goalPrompt,
          input_context: selectedRunDocId ? { document_id: selectedRunDocId } : {},
        }),
      });
      if (res.ok) {
        setGoalPrompt("");
        fetchWorkflows();
        fetchRuns();
        setSelectedRun(await res.json());
        setView("history");
      }
    } catch (e) { console.error(e); }
    finally { setPlanningAndRunning(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 animate-fadeIn">

      {/* ── Top Bar ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neonTeal" />
            Workflow Orchestration Studio
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">Design, plan, and monitor multi-step automation pipelines.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-darkBg/60 border border-darkBorder rounded-xl p-1">
          {(["builder", "planner", "history"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all capitalize ${
                view === v
                  ? "bg-neonIndigo/15 text-neonIndigo border border-neonIndigo/25"
                  : "text-darkMuted hover:text-gray-200"
              }`}
            >
              {v === "builder" ? "Visual Builder" : v === "planner" ? "AI Planner" : "Run History"}
            </button>
          ))}
        </div>
      </div>

      {/* ══ VIEW: Visual Builder ══════════════════════ */}
      {view === "builder" && (
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Left: step palette */}
          <div className="w-56 shrink-0 space-y-3 overflow-y-auto">
            <div className="bg-darkPanel/30 border border-darkBorder rounded-xl p-4 space-y-3">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-darkMuted">Step Palette</h3>
              <p className="text-[10px] text-darkMuted/70 leading-normal">Click any step to add it to the canvas. Drag to rearrange.</p>
              <div className="space-y-1.5">
                {STEP_TYPES.map(step => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.name}
                      onClick={() => addStepToCanvas(step)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg border border-darkBorder bg-darkBg/30 hover:border-darkBorder/100 hover:bg-darkBg/70 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border" style={{ background: `${step.color}18`, borderColor: `${step.color}40` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: step.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white truncate">{step.label}</p>
                        <p className="text-[9px] text-darkMuted truncate">{step.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workflow metadata */}
            <div className="bg-darkPanel/30 border border-darkBorder rounded-xl p-4 space-y-3">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-darkMuted">Workflow Info</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={builderName}
                  onChange={e => setBuilderName(e.target.value)}
                  placeholder="Workflow name…"
                  className="w-full form-input text-xs"
                />
                <textarea
                  value={builderDesc}
                  onChange={e => setBuilderDesc(e.target.value)}
                  placeholder="Description (optional)…"
                  rows={2}
                  className="w-full form-input text-xs resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCanvasWorkflow}
                  disabled={saving || nodes.length === 0}
                  className="flex-1 py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all btn btn-primary disabled:opacity-40"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {saving ? "Saving…" : saveSuccess ? "Saved!" : "Save"}
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-2 rounded-lg border border-darkBorder text-darkMuted hover:text-rose-400 hover:border-rose-500/40 cursor-pointer transition-all"
                  title="Clear canvas"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Center: React Flow Canvas */}
          <div className="flex-1 min-h-0 rounded-xl border border-darkBorder overflow-hidden bg-[#05060b] relative" ref={reactFlowWrapper}>
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-neonIndigo/5 border border-neonIndigo/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-neonIndigo/40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-500">Empty Canvas</p>
                  <p className="text-xs text-darkMuted mt-1 max-w-xs">Click steps from the palette on the left to begin building your workflow pipeline.</p>
                </div>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNode(node)}
              onPaneClick={() => setSelectedNode(null)}
              fitView
              colorMode="dark"
              defaultEdgeOptions={{ animated: true, style: { stroke: "#6366f1", strokeWidth: 1.5 } }}
              style={{ background: "transparent" }}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1a1e2d" />
              <Controls className="!bottom-4 !left-4 !top-auto" />
              <MiniMap
                style={{ background: "#0b0d16", border: "1px solid #1a1e2d" }}
                nodeColor={() => "#6366f1"}
                maskColor="rgba(5,6,11,0.7)"
              />
              {nodes.length > 0 && (
                <Panel position="top-right">
                  <div className="text-[9px] font-mono text-darkMuted bg-darkBg/80 px-2 py-1 rounded border border-darkBorder">
                    {nodes.length} nodes · {edges.length} connections
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>

          {/* Right: Node inspector */}
          <div className="w-56 shrink-0">
            <div className="bg-darkPanel/30 border border-darkBorder rounded-xl p-4 space-y-4 h-full">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-darkMuted flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Node Inspector
              </h3>
              {selectedNode ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono uppercase text-darkMuted">Display Label</label>
                    <input
                      type="text"
                      value={selectedNode.data.label as string}
                      onChange={e => updateSelectedNodeLabel(e.target.value)}
                      className="w-full form-input text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono uppercase text-darkMuted">Max Retries</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={selectedNode.data.retries as number}
                      onChange={e => updateSelectedNodeRetries(Number(e.target.value))}
                      className="w-full form-input text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono uppercase text-darkMuted">Step Type</label>
                    <div className="text-[10px] font-mono text-neonIndigo bg-neonIndigo/5 border border-neonIndigo/20 px-2 py-1 rounded">
                      {selectedNode.data.stepType as string}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono uppercase text-darkMuted">Node ID</label>
                    <div className="text-[9px] font-mono text-darkMuted truncate">{selectedNode.id}</div>
                  </div>
                  <button
                    onClick={deleteSelectedNode}
                    className="w-full py-2 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all btn btn-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Node
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center text-darkMuted space-y-2">
                  <Settings className="w-8 h-8 text-darkBorder" />
                  <p className="text-xs">Click a node on the canvas to inspect and configure it.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ VIEW: AI Planner ══════════════════════════ */}
      {view === "planner" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          <div className="space-y-6">
            <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-4">
              <div>
                <h3 className="text-xs font-bold text-neonTeal uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Agent Task Planner
                </h3>
                <p className="text-[10px] text-darkMuted mt-0.5">Translate natural goal statements into structured chained actions</p>
              </div>
              <form onSubmit={handlePlanAndRun} className="space-y-3">
                <textarea
                  placeholder="e.g. Ingest new document, summarize findings, check for compliance anomalies, and notify team."
                  value={goalPrompt}
                  onChange={e => setGoalPrompt(e.target.value)}
                  className="w-full form-input text-xs min-h-[80px] resize-none"
                  required
                />
                <select
                  value={selectedRunDocId}
                  onChange={e => setSelectedRunDocId(e.target.value)}
                  className="w-full form-input text-xs cursor-pointer"
                >
                  <option value="">-- No document context --</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.filename} ({doc.document_type || "generic"})</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={planningAndRunning || !goalPrompt.trim()}
                  className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-neonIndigo hover:bg-neonIndigo/85 disabled:bg-neonIndigo/50 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {planningAndRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Planning Chain…</> : <><Send className="w-3.5 h-3.5" />Plan & Execute</>}
                </button>
              </form>
            </div>

            {/* Saved Workflow Library */}
            <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider">Workflow Library</h3>
              {loading ? (
                <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 text-neonTeal animate-spin" /></div>
              ) : workflows.length === 0 ? (
                <p className="text-xs text-darkMuted italic text-center py-4">No workflows saved yet. Build one in the Visual Builder tab.</p>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {workflows.map(wf => (
                    <div key={wf.id} className="p-3 bg-darkBg/40 border border-darkBorder rounded-lg flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-gray-200 truncate">{wf.name}</p>
                        <p className="text-[9px] font-mono text-darkMuted mt-0.5">[{wf.steps.length} steps]</p>
                      </div>
                      <button
                        onClick={() => handleRunWorkflow(wf.id)}
                        className="shrink-0 px-2.5 py-1 text-[9px] font-mono font-bold uppercase text-neonTeal border border-neonTeal/30 bg-neonTeal/5 hover:bg-neonTeal/15 rounded cursor-pointer transition-all"
                      >
                        Run
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: animated steps preview */}
          <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-xl flex flex-col items-center justify-center text-center">
            {planningAndRunning ? (
              <div className="space-y-4 w-full max-w-sm">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-neonIndigo animate-spin" />
                  <span className="text-xs font-mono text-gray-300">Executing autonomous reasoning loop…</span>
                </div>
                <div className="border-l border-darkBorder/60 ml-2.5 pl-5 space-y-4 text-xs font-mono text-left">
                  {["Generating sub-task plan", "Compiling search & RAG evidence", "Synthesizing correlations", "Drafting pipeline definition"].map((step, i) => (
                    <div key={i} className="relative flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-neonIndigo rounded-full absolute -left-[23px] top-1" />
                      <span className="text-gray-300">{step}</span>
                      <Loader2 className="w-3 h-3 animate-spin text-neonIndigo" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-darkMuted">
                <Sparkles className="w-12 h-12 text-darkBorder mx-auto" />
                <p className="text-sm font-semibold text-gray-400">AI Planner Ready</p>
                <p className="text-xs max-w-xs">Describe a business goal on the left and the AI will plan and execute a structured workflow automatically.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ VIEW: Run History ══════════════════════════ */}
      {view === "history" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

          {/* Run list */}
          <div className="lg:col-span-1 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider">Execution Log</h3>
              <button onClick={fetchRuns} className="p-1.5 rounded-lg border border-darkBorder text-darkMuted hover:text-gray-300 cursor-pointer transition-all">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 text-neonTeal animate-spin" /></div>
            ) : runs.length === 0 ? (
              <p className="text-xs text-darkMuted italic text-center py-4">No executions logged yet.</p>
            ) : (
              runs.map(r => (
                <div
                  key={r.id}
                  onClick={() => fetchRunDetails(r.id)}
                  className={`p-3 bg-darkBg/40 border hover:border-darkBorder/100 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                    selectedRun?.id === r.id ? "border-neonIndigo bg-darkBg/65" : "border-darkBorder"
                  }`}
                >
                  <div className="truncate">
                    <p className="font-semibold text-xs text-gray-200 truncate">{r.workflow_name}</p>
                    <p className="text-[9px] font-mono text-darkMuted mt-0.5">{r.id.slice(0, 8)}… · {new Date(r.started_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="shrink-0">
                    {r.status === "success" && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />}
                    {r.status === "failed" && <XCircle className="w-4.5 h-4.5 text-rose-500" />}
                    {r.status === "running" && <Loader2 className="w-4.5 h-4.5 text-neonTeal animate-spin" />}
                    {r.status === "pending" && <Clock className="w-4.5 h-4.5 text-darkMuted" />}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Run detail / step graph */}
          <div className="lg:col-span-2">
            {selectedRun ? (
              <div className="p-6 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-6 select-text animate-fadeIn h-full overflow-y-auto">
                <div className="flex justify-between items-start gap-4 border-b border-darkBorder/50 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-200 text-sm">{selectedRun.workflow_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase font-bold border ${
                        selectedRun.status === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : selectedRun.status === "failed" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-neonTeal/10 text-neonTeal border-neonTeal/20 animate-pulse"
                      }`}>{selectedRun.status}</span>
                    </div>
                    <p className="text-[10px] text-darkMuted font-mono mt-1">Run UUID: {selectedRun.id}</p>
                  </div>
                  <div className="text-right text-[10px] text-darkMuted space-y-0.5">
                    <p>Started: {new Date(selectedRun.started_at).toLocaleString()}</p>
                    {selectedRun.completed_at && <p>Duration: {Math.max(0, new Date(selectedRun.completed_at).getTime() - new Date(selectedRun.started_at).getTime())} ms</p>}
                  </div>
                </div>

                {/* Visual step pipeline */}
                <div>
                  <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block mb-4">Pipeline Execution Graph</span>
                  <div className="flex flex-col space-y-5 relative pl-6">
                    <div className="absolute left-[33px] top-4 bottom-4 w-0.5 bg-darkBorder/60" />
                    {selectedRun.steps?.map(step => (
                      <div key={step.id} className="relative flex gap-4 items-start animate-fadeIn">
                        <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
                          step.status === "success" ? "bg-emerald-950/20 border-emerald-500 text-emerald-400"
                          : step.status === "failed" ? "bg-rose-950/20 border-rose-500 text-rose-400"
                          : "bg-darkPanel border-neonTeal text-neonTeal animate-pulse"
                        }`}>
                          {step.status === "success" && <CheckCircle2 className="w-4 h-4" />}
                          {step.status === "failed" && <XCircle className="w-4 h-4" />}
                          {step.status !== "success" && step.status !== "failed" && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <div className="flex-1 bg-darkBg/35 border border-darkBorder hover:border-darkBorder/100 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-semibold text-xs text-gray-200">{step.step_name}</span>
                            <div className="flex items-center gap-2 text-[10px]">
                              {step.retry_count > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[9px] flex items-center gap-0.5">
                                  <RefreshCw className="w-2.5 h-2.5" /> {step.retry_count} retries
                                </span>
                              )}
                              <span className="text-darkMuted font-mono">{step.execution_time_ms} ms</span>
                            </div>
                          </div>
                          {step.error && <p className="text-[10px] text-rose-400 bg-rose-950/20 p-2 rounded-lg border border-rose-900/30 font-mono">[ERROR] {step.error}</p>}
                          {!!step.output_data && (
                            <div className="space-y-1 pt-1 border-t border-darkBorder/20">
                              <p className="text-[8px] font-mono uppercase text-darkMuted">Output Context</p>
                              <pre className="text-[10px] font-mono bg-darkBg/60 p-2 rounded max-h-[80px] overflow-y-auto text-gray-300 leading-normal">{JSON.stringify(step.output_data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 border-t border-darkBorder/50 pt-4">
                  <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block">Final Output Context</span>
                  <pre className="text-[10px] font-mono bg-darkBg/40 p-4 rounded-xl border border-darkBorder text-gray-300 max-h-[160px] overflow-y-auto">{JSON.stringify(selectedRun.output_context, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-darkBorder rounded-xl bg-darkPanel/10 h-full flex flex-col items-center justify-center text-center text-darkMuted space-y-3 select-none">
                <Play className="w-10 h-10 text-darkMuted stroke-1 animate-pulse" />
                <p className="text-sm font-semibold text-gray-400">Select a Run</p>
                <p className="text-xs max-w-sm">Click any execution from the log to view the visual step graph and output context.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

