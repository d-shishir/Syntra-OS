import React, { useState, useEffect } from "react";
import { Sparkles, Play, RefreshCw, BarChart2, ShieldAlert, FileText, CheckCircle2, AlertTriangle, Layers, Clock, HelpCircle, FileJson } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface ResearchTaskDict {
  id: string;
  goal: string;
  sub_tasks: string[];
  status: string;
  report_content: any;
  confidence_score: number;
  created_at: string;
}

export function ResearchDashboard() {
  const [goal, setGoal] = useState<string>("");
  const [activeTask, setActiveTask] = useState<ResearchTaskDict | null>(null);
  const [history, setHistory] = useState<ResearchTaskDict[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [starting, setStarting] = useState<boolean>(false);
  const [activeReportTab, setActiveReportTab] = useState<"summary" | "findings" | "risks" | "recommendations" | "evidence">("summary");

  const loadHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/research/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data || []);
        
        // If there is an active running task, let's track it
        const running = (data || []).find((t: ResearchTaskDict) => t.status === "running" || t.status === "pending");
        if (running && !activeTask) {
          setActiveTask(running);
        }
      }
    } catch (err) {
      console.error("Failed to load research history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Poll for status updates if a task is running
  useEffect(() => {
    if (!activeTask || (activeTask.status !== "running" && activeTask.status !== "pending")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/research/${activeTask.id}`);
        if (res.ok) {
          const updated = await res.json();
          setActiveTask(updated);
          if (updated.status === "completed" || updated.status === "failed") {
            clearInterval(interval);
            loadHistory();
          }
        }
      } catch (err) {
        console.error("Task status polling failed:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeTask]);

  // Submit Goal
  const handleStartResearch = async () => {
    if (!goal || !goal.trim()) return;
    setStarting(true);
    setActiveTask(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/research/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTask(data);
        setGoal("");
      }
    } catch (err) {
      console.error("Research goal submission failed:", err);
    } finally {
      setStarting(false);
    }
  };

  // Mock anomaly workflow trigger
  const handleTriggerAnomalyWorkflow = async () => {
    if (!activeTask || !activeTask.report_content) return;
    try {
      // Dispatch alert payload to main event pipeline
      const res = await fetch(`${BACKEND_URL}/api/v1/events/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "anomaly_detected",
          source_module: "research_labs",
          payload: {
            risk_score: activeTask.confidence_score,
            reason: `Manual escalation from research goal: ${activeTask.goal}`
          }
        })
      });
      if (res.ok) {
        alert("Successfully triggered anomaly investigation workflow on Event Bus!");
      }
    } catch (err) {
      console.error("Failed to trigger flow:", err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-emerald-400 border-emerald-500/20 bg-emerald-500/5";
      case "running": return "text-cyan-400 border-cyan-500/20 bg-cyan-500/5";
      case "failed": return "text-rose-400 border-rose-500/20 bg-rose-500/5";
      default: return "text-amber-400 border-amber-500/20 bg-amber-500/5";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn select-text">
      {/* Header Portal Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-darkPanel/25 border border-darkBorder rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo border border-neonIndigo/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-200">Autonomous AI Research & Analysis Labs</h2>
            <p className="text-xs text-darkMuted">Assign macro business goals to trigger automated planning, cross-module data collection, synthesis, and evaluation.</p>
          </div>
        </div>
        <button
          onClick={loadHistory}
          className="px-3.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-darkBorder/40 hover:bg-darkBorder/70 text-gray-300 border border-darkBorder rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh List
        </button>
      </div>

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Submit Goal & History */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Research Box */}
          <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
              <Play className="w-4 h-4 text-neonTeal" />
              Configure Study Goal
            </h3>
            
            <div className="space-y-2">
              <textarea
                placeholder="E.g. Analyze payroll anomalies across Q1 and trace root approval failures..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                className="w-full p-3 bg-darkBg/60 border border-darkBorder rounded-lg text-xs text-gray-300 placeholder-darkMuted focus:outline-none focus:border-neonIndigo"
              />
              <button
                onClick={handleStartResearch}
                disabled={starting || !goal.trim()}
                className="w-full py-2.5 bg-neonIndigo text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider hover:bg-neonIndigo/80 cursor-pointer flex items-center justify-center gap-1.5"
              >
                {starting ? "Launching..." : "Launch Research Engine"}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 text-[9px] font-mono text-darkMuted pt-2">
              <span>Popular topics:</span>
              <button onClick={() => setGoal("Analyze payroll anomalies across Q1")} className="hover:text-white cursor-pointer underline">
                Payroll anomalies
              </button>
              <span>•</span>
              <button onClick={() => setGoal("Investigate sales conversions and lead pipelines")} className="hover:text-white cursor-pointer underline">
                CRM lead audit
              </button>
            </div>
          </div>

          {/* Past Studies log */}
          <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4 max-h-[400px] overflow-y-auto">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
              <Clock className="w-4 h-4 text-darkMuted" />
              Historical Studies
            </h3>

            <div className="space-y-2.5">
              {loading ? (
                <span className="text-xs text-darkMuted animate-pulse block text-center py-4">Loading history...</span>
              ) : history.map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    setActiveTask(task);
                  }}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    activeTask?.id === task.id
                      ? "border-neonIndigo bg-neonIndigo/5"
                      : "border-darkBorder bg-darkBg/25 hover:border-darkBorder/100"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    {task.confidence_score > 0 && (
                      <span className="text-[9px] font-mono text-neonIndigo font-semibold">
                        {(task.confidence_score * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-200 truncate">{task.goal}</p>
                  <span className="text-[9px] text-darkMuted block mt-1">
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                </div>
              ))}

              {history.length === 0 && !loading && (
                <div className="text-center py-6 text-xs text-darkMuted italic">
                  No historical research tasks logged.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Center/Right: Live Progress Timeline and Report Viewer */}
        <div className="lg:col-span-2 space-y-6">
          {activeTask ? (
            <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-6">
              
              {/* Status Header */}
              <div className="flex justify-between items-center border-b border-darkBorder/40 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-darkMuted">Research Target</span>
                  <h4 className="text-base font-bold text-gray-200">{activeTask.goal}</h4>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase border ${getStatusColor(activeTask.status)}`}>
                  {activeTask.status}
                </span>
              </div>

              {/* Step-by-Step progress steps timeline */}
              {activeTask.status === "running" || activeTask.status === "pending" ? (
                <div className="space-y-4 py-4 max-w-md mx-auto">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-neonIndigo animate-spin" />
                    <span className="text-xs font-mono text-gray-300">Executing autonomous reasoning loop...</span>
                  </div>
                  
                  {/* Step list checkpoints */}
                  <div className="border-l border-darkBorder/60 ml-2.5 pl-5 space-y-4 text-xs font-mono">
                    <div className="relative">
                      <span className="w-1.5 h-1.5 bg-neonIndigo rounded-full absolute -left-[24px] top-1.5" />
                      <span className="text-gray-300">Phase 1: Generating sub-task plan guidelines</span>
                    </div>
                    <div className="relative">
                      <span className="w-1.5 h-1.5 bg-neonIndigo rounded-full absolute -left-[24px] top-1.5" />
                      <span className="text-gray-300">Phase 2: Compiling search, RAG, and Graph evidence</span>
                    </div>
                    <div className="relative">
                      <span className="w-1.5 h-1.5 bg-neonIndigo rounded-full absolute -left-[24px] top-1.5" />
                      <span className="text-darkMuted">Phase 3: Synthesizing multi-source correlations</span>
                    </div>
                    <div className="relative">
                      <span className="w-1.5 h-1.5 bg-neonIndigo rounded-full absolute -left-[24px] top-1.5" />
                      <span className="text-darkMuted">Phase 4: Evaluating coverage & drafting markdown report</span>
                    </div>
                  </div>
                </div>
              ) : activeTask.status === "completed" && activeTask.report_content ? (
                
                // Final Report Viewer
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-darkBg/40 border border-darkBorder/40 p-4 rounded-lg">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-darkMuted">Study Confidence Rating</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-lg font-bold text-neonTeal font-mono">
                          {(activeTask.confidence_score * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-darkMuted">Based on task coverage, sources, and audit checks.</span>
                      </div>
                    </div>
                    
                    {/* Action trigger button */}
                    <button
                      onClick={handleTriggerAnomalyWorkflow}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all"
                    >
                      Trigger Automated Investigation Workflow
                    </button>
                  </div>

                  {/* Tabs Nav for report sections */}
                  <div className="flex flex-wrap gap-2 border-b border-darkBorder/40 pb-2">
                    {[
                      { id: "summary", label: "Executive Summary" },
                      { id: "findings", label: "Key Findings" },
                      { id: "risks", label: "Risks & Vulnerabilities" },
                      { id: "recommendations", label: "Recommendations" },
                      { id: "evidence", label: "Data Evidence" }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveReportTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          activeReportTab === tab.id
                            ? "bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20"
                            : "text-darkMuted hover:text-gray-200"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Report tab content */}
                  <div className="text-xs text-gray-300 leading-relaxed font-sans select-text border border-darkBorder/40 p-4 rounded-xl bg-darkBg/10 min-h-[250px]">
                    {activeReportTab === "summary" && (
                      <div className="space-y-2">
                        <h4 className="font-bold text-gray-100 mb-2">Executive Summary</h4>
                        <p>{activeTask.report_content.executive_summary}</p>
                      </div>
                    )}

                    {activeReportTab === "findings" && (
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-gray-100 mb-2">Key Findings</h4>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {activeTask.report_content.findings?.map((f: string, idx: number) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeReportTab === "risks" && (
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-gray-100 mb-2">Risks & Vulnerabilities</h4>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {activeTask.report_content.risks?.map((r: string, idx: number) => (
                            <li key={idx} className="text-rose-400">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeReportTab === "recommendations" && (
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-gray-100 mb-2">Recommendations</h4>
                        <ul className="list-disc pl-5 space-y-1.5">
                          {activeTask.report_content.recommendations?.map((r: string, idx: number) => (
                            <li key={idx} className="text-emerald-400">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeReportTab === "evidence" && (
                      <div className="space-y-2.5">
                        <h4 className="font-bold text-gray-100 mb-2">Supporting Evidence (Cross-Module Sources)</h4>
                        <div className="space-y-2">
                          {activeTask.report_content.sources?.map((src: any, idx: number) => (
                            <div key={idx} className="p-3 bg-darkBg/40 border border-darkBorder/40 rounded-lg space-y-1 font-mono">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-semibold text-gray-200">{src.title}</span>
                                <span className="text-neonIndigo">{src.type}</span>
                              </div>
                              <p className="text-[11px] text-darkMuted italic">"{src.description}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Markdown direct downloader */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        const blob = new Blob([activeTask.report_content.markdown], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `research_report_${activeTask.id}.md`;
                        a.click();
                      }}
                      className="px-3.5 py-1.5 text-[10px] font-mono border border-darkBorder bg-darkBg/60 text-darkMuted hover:text-white rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Download Markdown Report (.md)
                    </button>
                  </div>

                </div>
              ) : (
                <div className="text-center py-12 text-rose-400 text-xs font-mono">
                  🚨 Research execution failed or aborted. Check server logs for details.
                </div>
              )}

            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[450px] border border-dashed border-darkBorder/60 bg-darkPanel/5 rounded-xl text-darkMuted space-y-3 text-center p-6">
              <Layers className="w-12 h-12 text-darkBorder animate-pulse" />
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-semibold text-gray-300">No Target Goal Active</h4>
                <p className="text-xs">Configure a study goal on the left panel or click a past task in the timeline history to load results.</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
