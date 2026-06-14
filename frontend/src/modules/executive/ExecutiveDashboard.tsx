import React, { useState, useEffect } from "react";
import { 
  Activity, Shield, TrendingUp, AlertTriangle, Cpu, Terminal, 
  Search, Play, CheckCircle, RefreshCw, HelpCircle, ArrowRight,
  TrendingDown, DollarSign, Users, Sparkles, Server, Zap
} from "lucide-react";
import { apiClient } from "../../services/apiClient";

interface Scores {
  company_health: number;
  governance_compliance: number;
  ai_system_health: number;
  financial_stability: number;
  operational_efficiency: number;
  automation_coverage: number;
}

interface RiskFactor {
  name: string;
  impact: string;
  score_added: number;
}

interface RiskRadar {
  risk_score: number;
  severity: string;
  trend: string;
  factors: RiskFactor[];
}

interface Alert {
  id: string;
  severity: string;
  title: string;
  message: string;
  source_module: string;
  timestamp: string;
}

export const ExecutiveDashboard: React.FC = () => {
  const [scores, setScores] = useState<Scores | null>(null);
  const [riskRadar, setRiskRadar] = useState<RiskRadar | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  // Decision Q&A state
  const [query, setQuery] = useState("What is slowing down finance approvals?");
  const [decisionResult, setDecisionResult] = useState<any>(null);
  const [asking, setAsking] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchExecutiveData();
  }, []);

  const fetchExecutiveData = async () => {
    setLoading(true);
    try {
      const [metricsRes, insRes, altsRes] = await Promise.all([
        apiClient.get("/executive/metrics"),
        apiClient.get("/executive/insights"),
        apiClient.get("/executive/alerts")
      ]);
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setScores(metrics.scores);
        setRiskRadar(metrics.risk_radar);
      }
      if (insRes.ok) {
        setInsights(await insRes.json());
      }
      if (altsRes.ok) {
        setAlerts(await altsRes.json());
      }
    } catch (err) {
      console.error("Error loading executive dashboard metrics", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setAsking(true);
    try {
      const response = await apiClient.post("/executive/ask", { question: query });
      if (response.ok) {
        const res = await response.json();
        setDecisionResult(res);
        setToast("AI Executive Analyst compiled decision trace.");
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-200 font-sans selection:bg-neonTeal/30">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border bg-darkPanel border-neonIndigo/30 text-neonIndigo flex items-center gap-2.5 z-50">
          <Sparkles className="w-4 h-4 text-neonIndigo animate-pulse" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Bloomberg-Style Top Health Header Ribbon */}
      <div className="relative overflow-hidden rounded-2xl border border-darkBorder/60 bg-gradient-to-r from-darkPanel via-darkPanel/95 to-neonIndigo/10 p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-neonIndigo font-mono text-xs uppercase tracking-widest mb-1.5">
              <Activity className="w-4 h-4 animate-pulse" />
              <span>CEO CONTROL SHIELD</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-100 font-display">
              Syntra OS Executive Command Center
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Unified real-time company health analytics, risk scoring indicators, and AI decision support logs.
            </p>
          </div>

          {/* Master Company Score */}
          {scores && (
            <div className="flex items-center gap-4 bg-darkBg/60 p-4 rounded-xl border border-darkBorder/40 shadow-inner">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#1f2937" strokeWidth="4" fill="transparent" />
                  <circle cx="32" cy="32" r="28" stroke="#6366f1" strokeWidth="4" fill="transparent" 
                          strokeDasharray={175} strokeDashoffset={175 - (175 * scores.company_health) / 100} />
                </svg>
                <span className="text-lg font-bold font-mono text-neonIndigo">{scores.company_health}%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-darkMuted tracking-wider">Company Health Score</span>
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>OPTIMAL STATUS</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Metric score meters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-5 shadow-lg">
            <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
              Health Indicators
            </h3>
            {scores && (
              <div className="space-y-4">
                {[
                  { name: "AI Agent Health", val: scores.ai_system_health, color: "bg-neonTeal", text: "text-neonTeal" },
                  { name: "Governance & Compliance", val: scores.governance_compliance, color: "bg-neonIndigo", text: "text-neonIndigo" },
                  { name: "Financial Stability", val: scores.financial_stability, color: "bg-emerald-400", text: "text-emerald-400" },
                  { name: "Operational Efficiency", val: scores.operational_efficiency, color: "bg-indigo-400", text: "text-indigo-400" },
                  { name: "Automation Coverage", val: scores.automation_coverage, color: "bg-teal-400", text: "text-teal-400" }
                ].map((s, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-gray-300">{s.name}</span>
                      <span className={`${s.text} font-mono font-bold`}>{s.val}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden border border-darkBorder/20">
                      <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Radar widget */}
          {riskRadar && (
            <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4 shadow-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                  Risk Radar Map
                </h3>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                  riskRadar.severity === "Low" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                }`}>
                  {riskRadar.severity.toUpperCase()}
                </span>
              </div>

              <div className="bg-darkBg/60 p-4 rounded-lg border border-darkBorder/40 text-center relative overflow-hidden">
                {/* Radar Grid Graphic */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-rose-400 animate-spin" />
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-rose-400" />
                </div>
                
                <span className="text-4xl font-extrabold font-mono text-rose-400 relative z-10">{riskRadar.risk_score}</span>
                <p className="text-[10px] text-darkMuted uppercase tracking-widest font-mono mt-1 relative z-10">Threat Index (0-100)</p>
                <div className="text-[11px] text-gray-300 font-semibold flex items-center justify-center gap-1 mt-2.5 relative z-10">
                  <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  <span>Trend: {riskRadar.trend}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-darkBorder/40">
                {riskRadar.factors.map((f, idx) => (
                  <div key={idx} className="flex justify-between text-[11px] bg-darkBg/30 p-2 rounded border border-darkBorder/25">
                    <span className="text-gray-300 truncate max-w-[150px]">{f.name}</span>
                    <span className="text-rose-400 font-mono font-semibold">+{f.score_added}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic center pane: live system map & Q&A insights */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Real-time System Status Map */}
          <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-6 space-y-4 shadow-lg">
            <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
              Live Corporate Operations Control Map
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "Automation Workflows", icon: Server, items: ["Running: 14", "Failed: 0", "Idle: 32"], color: "border-neonTeal/30" },
                { title: "AI Swarms & Agents", icon: Cpu, items: ["Active Swarms: 8", "Unreliable: 0", "Query Latency: 120ms"], color: "border-neonIndigo/30" },
                { title: "Integrations Hub", icon: Zap, items: ["Connected: 12", "Failing API: 0", "Event Throughput: 420/s"], color: "border-emerald-500/30" }
              ].map((sys, idx) => {
                const Icon = sys.icon;
                return (
                  <div key={idx} className={`p-4 bg-darkBg/60 border ${sys.color} rounded-xl space-y-3 relative hover:scale-[1.01] transition-transform`}>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded bg-darkPanel text-gray-200">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-gray-200">{sys.title}</h4>
                    </div>
                    <ul className="space-y-1.5">
                      {sys.items.map((it, itIdx) => (
                        <li key={itIdx} className="text-[11px] text-gray-400 flex items-center gap-1.5 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-neonTeal animate-pulse" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Decision Support Engine */}
          <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-6 space-y-4 shadow-lg">
            <div>
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                Executive Decision Support Agent
              </h3>
              <p className="text-xs text-darkMuted mt-0.5">Submit natural language queries to execute root cause analyses across system logs.</p>
            </div>

            <form onSubmit={handleAskQuestion} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-darkMuted absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Ask e.g. What is slowing down finance approvals?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder/60 rounded-lg pl-10 pr-4 py-2 text-xs text-gray-200 focus:outline-none focus:border-neonTeal"
                />
              </div>
              <button
                type="submit"
                disabled={asking}
                className="bg-neonTeal hover:bg-neonTeal/80 text-darkBg px-5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
              >
                {asking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                <span>Analyze</span>
              </button>
            </form>

            {decisionResult && (
              <div className="bg-darkBg/60 border border-darkBorder/50 rounded-lg p-5 space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-neonTeal uppercase tracking-widest font-mono">Root Cause Diagnosis</h4>
                  <p className="text-xs text-gray-200 leading-relaxed mt-1">{decisionResult.answer}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-darkBorder/30">
                  <div className="space-y-1">
                    <h5 className="text-[10px] text-darkMuted uppercase tracking-wider font-mono">Technical Assessment</h5>
                    <p className="text-xs text-gray-300">{decisionResult.root_cause}</p>
                  </div>
                  <div className="space-y-2">
                    <h5 className="text-[10px] text-darkMuted uppercase tracking-wider font-mono">Recommended Remediation</h5>
                    <ul className="space-y-1.5">
                      {decisionResult.suggestions.map((s: string, idx: number) => (
                        <li key={idx} className="text-xs text-gray-300 flex items-start gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-neonTeal shrink-0 mt-0.5" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 font-mono">
                        ROI Impact: +${decisionResult.impact_score}/mo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI insights ticker & critical alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Insights Panel */}
            <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                Executive Heuristic Insights
              </h3>
              <div className="space-y-2.5">
                {insights.map((ins, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs leading-relaxed bg-darkBg/20 p-2.5 rounded border border-darkBorder/30">
                    <Sparkles className="w-4 h-4 text-neonTeal shrink-0 mt-0.5" />
                    <span className="text-gray-300">{ins}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts feed */}
            <div className="bg-darkPanel/60 border border-darkBorder/40 rounded-xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
                Critical Operations Alerts
              </h3>
              <div className="space-y-2.5">
                {alerts.map((a) => (
                  <div key={a.id} className="flex gap-3 items-start text-xs leading-relaxed bg-rose-500/5 p-2.5 rounded border border-rose-500/20">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-gray-200">{a.title}</h4>
                      <p className="text-gray-400 text-[11px] mt-0.5">{a.message}</p>
                      <span className="text-[9px] font-mono text-darkMuted uppercase block mt-1">Source: {a.source_module}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
