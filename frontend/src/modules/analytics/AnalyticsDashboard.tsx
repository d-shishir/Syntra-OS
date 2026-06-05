import React, { useEffect, useState, useCallback } from "react";
import {
  Activity, TrendingUp, DollarSign, Clock, ShieldAlert,
  BarChart2, BookOpen, Layers, CheckCircle2, Sparkles, AlertTriangle,
  ArrowUpRight, Sliders, RefreshCw, FileText, Download, Check, Settings
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface MetricSection {
  total_runs?: number;
  success_runs?: number;
  failed_runs?: number;
  success_rate?: number;
  avg_duration_ms?: number;
  total_requests?: number;
  pending_count?: number;
  approved_count?: number;
  rejected_count?: number;
  escalated_count?: number;
  avg_approval_time_hours?: number;
  leads_captured?: number;
  invoices_audited?: number;
  payroll_checked?: number;
  anomalies_flagged?: number;
  total_financial_volume?: number;
}

interface AnalyticsData {
  workflows: MetricSection;
  agents: {
    total_runs: number;
    success_runs: number;
    failed_runs: number;
    success_rate: number;
    logs_captured: number;
    active_swarms: number;
  };
  search: {
    indexed_documents: number;
    indexed_invoices: number;
    indexed_leads: number;
    search_queries_total: number;
    search_failed_queries: number;
  };
  integrations: {
    connected_services_count: number;
    api_calls_count: number;
    usage_breakdown: Record<string, number>;
  };
  finance_crm: MetricSection;
  approvals: MetricSection;
  notifications: {
    dispatched_count: number;
  };
  event_bus: {
    events_published: number;
  };
}

interface KPITimeframe {
  tasks_automated: number;
  hours_saved: number;
  cost_reduction: number;
  approval_delays_hours: number;
  operational_throughput: number;
}

interface KPIData {
  summary: {
    tasks_automated: number;
    hours_saved: number;
    cost_reduction: number;
    automation_roi_pct: number;
  };
  timeframes: {
    daily: KPITimeframe;
    weekly: KPITimeframe;
    monthly: KPITimeframe;
    quarterly: KPITimeframe;
    yearly: KPITimeframe;
  };
}

interface DeptData {
  finance: Record<string, any>;
  operations: Record<string, any>;
  sales: Record<string, any>;
  compliance: Record<string, any>;
}

interface AIInsight {
  id: string;
  level: "success" | "warning" | "info" | "critical";
  category: string;
  message: string;
  action: string;
}

interface AlertItem {
  metric: string;
  value: number;
  threshold: number;
  severity: "high" | "medium";
  message: string;
}

export const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"executive" | "departments" | "builder" | "explorer" | "reports" | "alerts">("executive");
  const [selectedDeptTab, setSelectedDeptTab] = useState<"operations" | "finance" | "sales" | "compliance">("operations");
  
  // API states
  const [metrics, setMetrics] = useState<AnalyticsData | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [depts, setDepts] = useState<DeptData | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [forecasts, setForecasts] = useState<any | null>(null);
  const [alertThresholds, setAlertThresholds] = useState({ minSuccess: 92.0, maxLatency: 3.5 });
  const [triggeredAlerts, setTriggeredAlerts] = useState<AlertItem[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<"weekly_ops" | "monthly_finance" | "quarterly_roi">("weekly_ops");
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);
  
  // Custom builder states
  const [customWidgets, setCustomWidgets] = useState<string[]>(["workflows", "approvals", "roi"]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalyticsData = useCallback(async () => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    
    setRefreshing(true);
    const headers = { "Authorization": `Bearer ${token}` };

    try {
      const [metRes, kpiRes, deptRes, insRes, foreRes, rptRes, altRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/analytics/metrics`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/kpis`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/dashboards`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/insights`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/forecasts?days_ahead=7`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/reports?report_type=${selectedReportType}`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/analytics/alerts?min_workflow_success_rate=${alertThresholds.minSuccess}&max_approval_time_hours=${alertThresholds.maxLatency}`, { headers })
      ]);

      if (metRes.ok) setMetrics(await metRes.json());
      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (deptRes.ok) setDepts(await deptRes.json());
      if (insRes.ok) setInsights(await insRes.json());
      if (foreRes.ok) setForecasts(await foreRes.json());
      if (rptRes.ok) setGeneratedReport(await rptRes.json());
      if (altRes.ok) {
        const data = await altRes.json();
        setTriggeredAlerts(data.alerts);
      }
    } catch (e) {
      console.error("Failed to load BI analytics", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedReportType, alertThresholds]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const toggleCustomWidget = (widgetId: string) => {
    setCustomWidgets(prev => 
      prev.includes(widgetId) ? prev.filter(w => w !== widgetId) : [...prev, widgetId]
    );
  };

  const getInsightLevelClass = (level: string) => {
    switch (level) {
      case "critical": return "border-l-rose-500 bg-rose-500/5 text-rose-300";
      case "warning": return "border-l-amber-500 bg-amber-500/5 text-amber-300";
      case "success": return "border-l-emerald-500 bg-emerald-500/5 text-emerald-300";
      default: return "border-l-sky-500 bg-sky-500/5 text-sky-300";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-neonIndigo animate-spin mx-auto" />
          <p className="text-xs text-darkMuted">Compiling Monorepo BI Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-darkBorder/60 pb-4">
        <div>
          <h2 className="text-xl font-display font-black text-gray-100 flex items-center gap-2">
            <Activity className="w-6 h-6 text-neonIndigo" />
            Enterprise Analytics & BI Center
          </h2>
          <p className="text-xs text-darkMuted mt-1">
            Looker-grade reporting aggregator connecting Workflows, Agent swarms, Event buses, Finance and Compliance queues.
          </p>
        </div>
        <button
          onClick={fetchAnalyticsData}
          disabled={refreshing}
          className="p-2 border border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-200 rounded-lg flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="text-xs">Refresh Data</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-darkBorder/60 text-xs font-semibold gap-1">
        {(["executive", "departments", "builder", "explorer", "reports", "alerts"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize transition-all border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === tab 
                ? "border-neonIndigo text-neonIndigo" 
                : "border-transparent text-darkMuted hover:text-gray-200"
            }`}
          >
            {tab === "executive" ? "Executive CEO Dashboard" : tab === "builder" ? "Custom Widget Builder" : tab === "explorer" ? "KPI Explorer" : tab === "reports" ? "Reports Center" : tab === "alerts" ? "Alerts Monitor" : "Department views"}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "executive" && (
        <div className="space-y-6 animate-fadeIn">
          {/* ROI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-darkMuted block">Tasks Automated</span>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-display font-bold text-gray-200">{kpis?.summary.tasks_automated}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-emerald-400">across workflows, leads, & swarms</span>
            </div>

            <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-darkMuted block">Estimated Labor Savings</span>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-display font-bold text-gray-200">${kpis?.summary.cost_reduction.toLocaleString()}</span>
                <DollarSign className="w-5 h-5 text-neonTeal" />
              </div>
              <span className="text-[10px] text-neonTeal">net cost reduction</span>
            </div>

            <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-darkMuted block">Hours Saved</span>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-display font-bold text-gray-200">{kpis?.summary.hours_saved} hrs</span>
                <Clock className="w-5 h-5 text-neonIndigo" />
              </div>
              <span className="text-[10px] text-neonIndigo">manual processing averted</span>
            </div>

            <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-darkMuted block">Automation ROI Index</span>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-display font-bold text-gray-200">{kpis?.summary.automation_roi_pct}%</span>
                <TrendingUp className="w-5 h-5 text-neonTeal" />
              </div>
              <span className="text-[10px] text-neonTeal">efficiency ratio vs model costs</span>
            </div>
          </div>

          {/* AI Trends & Alerts Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Insights */}
            <div className="lg:col-span-2 p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-neonIndigo" />
                Dynamic AI Trend Insights
              </h3>
              <div className="space-y-3">
                {insights.map(ins => (
                  <div key={ins.id} className={`p-3 rounded-lg border-l-2 text-xs font-mono space-y-1 ${getInsightLevelClass(ins.level)}`}>
                    <div className="flex justify-between text-[10px] opacity-70">
                      <span className="font-bold uppercase tracking-wide">{ins.category}</span>
                      <span className="uppercase">{ins.level}</span>
                    </div>
                    <p className="text-gray-200 font-sans">{ins.message}</p>
                    <p className="text-[10px] text-darkMuted pt-1 border-t border-darkBorder/40">💡 Action: {ins.action}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Health Index */}
            <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">System Telemetry Rates</h3>
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-darkMuted">
                    <span>Workflow success rate</span>
                    <span className="text-emerald-400">{metrics?.workflows.success_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-darkBg rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${metrics?.workflows.success_rate}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-darkMuted">
                    <span>Agent success rate</span>
                    <span className="text-emerald-400">{metrics?.agents.success_rate}%</span>
                  </div>
                  <div className="h-1.5 bg-darkBg rounded overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${metrics?.agents.success_rate}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-darkMuted">
                    <span>Approval latency</span>
                    <span className="text-amber-400">{metrics?.approvals.avg_approval_time_hours} hrs</span>
                  </div>
                  <div className="h-1.5 bg-darkBg rounded overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${(metrics?.approvals.avg_approval_time_hours ?? 2.4) * 20}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-darkMuted">
                    <span>Events Published</span>
                    <span className="text-neonIndigo">{metrics?.event_bus.events_published}</span>
                  </div>
                  <p className="text-[10px] text-darkMuted">Telemetry signals dispatched dynamically on the Event Bus.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "departments" && depts && (
        <div className="space-y-6 animate-fadeIn">
          {/* Department Tabs */}
          <div className="flex gap-2">
            {(["operations", "finance", "sales", "compliance"] as const).map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDeptTab(dept)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer capitalize transition-all ${
                  selectedDeptTab === dept
                    ? "bg-neonIndigo/20 border-neonIndigo text-neonIndigo"
                    : "border-darkBorder bg-darkPanel/10 text-darkMuted hover:text-gray-200"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 capitalize">
              {selectedDeptTab} Department Telemetry
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {Object.entries(depts[selectedDeptTab]).map(([key, value]) => (
                <div key={key} className="p-3 bg-darkBg border border-darkBorder/60 rounded-lg space-y-1">
                  <span className="text-darkMuted capitalize font-mono text-[10px] block">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-lg font-bold text-gray-200">
                    {typeof value === "number" && key.includes("volume") ? `$${value.toLocaleString()}` : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-neonIndigo" />
              Configure Layout
            </h3>
            <p className="text-[10px] text-darkMuted">Select the telemetry components to map onto your custom dashboard.</p>
            
            <div className="space-y-2 text-xs">
              {[
                { id: "workflows", label: "Workflows Executed" },
                { id: "approvals", label: "Pending Approvals" },
                { id: "roi", label: "Automation ROI" },
                { id: "search", label: "Search Index Volume" },
                { id: "integrations", label: "Active Connections" },
                { id: "anomalies", label: "Fraud Anomalies Rate" }
              ].map(opt => (
                <label key={opt.id} className="flex items-center gap-2 p-2 border border-darkBorder/50 rounded-lg bg-darkBg hover:border-darkBorder transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customWidgets.includes(opt.id)}
                    onChange={() => toggleCustomWidget(opt.id)}
                    className="accent-neonIndigo"
                  />
                  <span className="text-gray-300 font-mono">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 border border-darkBorder border-dashed rounded-xl p-5 space-y-4 min-h-[300px]">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Custom Generated View</h3>
            
            {customWidgets.length === 0 ? (
              <div className="text-center py-20 text-xs text-darkMuted">Select configurations on the side to render widget items.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {customWidgets.includes("workflows") && metrics && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Workflow runs completed</span>
                    <span className="text-xl font-bold text-gray-200">{metrics.workflows.total_runs}</span>
                  </div>
                )}
                {customWidgets.includes("approvals") && metrics && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Human Review pending approvals</span>
                    <span className="text-xl font-bold text-amber-400">{metrics.approvals.pending_count}</span>
                  </div>
                )}
                {customWidgets.includes("roi") && kpis && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Net savings ratio</span>
                    <span className="text-xl font-bold text-neonTeal">${kpis.summary.cost_reduction.toLocaleString()}</span>
                  </div>
                )}
                {customWidgets.includes("search") && metrics && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Indexed documents count</span>
                    <span className="text-xl font-bold text-gray-200">{metrics.search.indexed_documents}</span>
                  </div>
                )}
                {customWidgets.includes("integrations") && metrics && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Connected services count</span>
                    <span className="text-xl font-bold text-gray-200">{metrics.integrations.connected_services_count}</span>
                  </div>
                )}
                {customWidgets.includes("anomalies") && metrics && (
                  <div className="p-4 bg-darkPanel/15 border border-darkBorder rounded-xl space-y-2">
                    <span className="font-mono text-darkMuted block">Anomalies flagged</span>
                    <span className="text-xl font-bold text-rose-400">{metrics.finance_crm.anomalies_flagged}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "explorer" && kpis && forecasts && (
        <div className="space-y-6 animate-fadeIn">
          {/* Timeframe selector */}
          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-neonTeal" />
              Timeframe Analytics Explorer
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(kpis.timeframes).map(([tfName, tfData]) => (
                <div key={tfName} className="p-3 bg-darkBg border border-darkBorder/60 rounded-lg space-y-2 text-xs">
                  <span className="text-neonTeal capitalize font-bold block">{tfName}</span>
                  <div className="space-y-1 text-darkMuted font-mono text-[10px]">
                    <div>Tasks: <span className="text-gray-200">{tfData.tasks_automated}</span></div>
                    <div>Hours saved: <span className="text-gray-200">{tfData.hours_saved}</span></div>
                    <div>Cost saved: <span className="text-gray-200">${tfData.cost_reduction}</span></div>
                    <div>Latency: <span className="text-gray-200">{tfData.approval_delays_hours}h</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecast Trends */}
          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">7-Day Moving-Average Predictive Projections</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-3 bg-darkBg border border-darkBorder/60 rounded-lg space-y-3">
                <span className="font-mono text-darkMuted block">Workflow Volume Forecast (Projected volume / day)</span>
                <div className="h-28 w-full flex items-end gap-2">
                  {forecasts.workflow_volume.map((f: any) => (
                    <div key={f.day} className="flex-1 flex flex-col justify-end items-center h-full">
                      <div className="w-full bg-neonIndigo/20 hover:bg-neonIndigo rounded text-center relative group" style={{ height: `${f.projected_volume * 15}%` }}>
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-darkBg border border-darkBorder px-1 py-0.5 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-all font-mono text-gray-200">
                          {f.projected_volume}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-darkMuted mt-1">Day {f.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-darkBg border border-darkBorder/60 rounded-lg space-y-3">
                <span className="font-mono text-darkMuted block">Agent Swarm Utilization (%)</span>
                <div className="h-28 w-full flex items-end gap-2">
                  {forecasts.agent_utilization.map((f: any) => (
                    <div key={f.day} className="flex-1 flex flex-col justify-end items-center h-full">
                      <div className="w-full bg-neonTeal/20 hover:bg-neonTeal rounded text-center relative group" style={{ height: `${f.projected_utilization_pct}%` }}>
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 bg-darkBg border border-darkBorder px-1 py-0.5 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-all font-mono text-gray-200">
                          {f.projected_utilization_pct}%
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-darkMuted mt-1">Day {f.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && generatedReport && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Sidebar selector */}
          <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-neonIndigo" />
              Report Types
            </h3>
            
            <div className="space-y-2 text-xs">
              {[
                { id: "weekly_ops", label: "Weekly Operations" },
                { id: "monthly_finance", label: "Monthly Finance Audit" },
                { id: "quarterly_roi", label: "Quarterly Automation ROI" }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedReportType(opt.id as any)}
                  className={`w-full text-left p-2.5 rounded-lg border font-mono transition-all cursor-pointer ${
                    selectedReportType === opt.id
                      ? "border-neonIndigo bg-neonIndigo/15 text-neonIndigo font-semibold"
                      : "border-darkBorder/40 bg-darkBg text-darkMuted hover:text-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reader */}
          <div className="lg:col-span-3 p-6 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-darkBorder/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-100 font-mono">{generatedReport.title}</h3>
                <span className="text-[10px] text-darkMuted font-mono">Compiled at: {generatedReport.generated_at}</span>
              </div>
              
              <button
                onClick={() => {
                  const blob = new Blob([generatedReport.markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${selectedReportType}_report_${new Date().toISOString().split('T')[0]}.md`;
                  a.click();
                }}
                className="px-3 py-1.5 text-xs bg-neonIndigo hover:bg-neonIndigo/85 text-white rounded cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download MD
              </button>
            </div>

            <div className="bg-darkBg/60 border border-darkBorder/40 rounded-lg p-5 font-mono text-[11px] text-gray-300 whitespace-pre-wrap select-all leading-relaxed max-h-[400px] overflow-y-auto">
              {generatedReport.markdown}
            </div>
          </div>
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Threshold controls */}
            <div className="p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-neonIndigo" />
                Configure Thresholds
              </h3>
              
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Min Workflow Success Rate (%)</label>
                  <input
                    type="number"
                    value={alertThresholds.minSuccess}
                    onChange={(e) => setAlertThresholds(prev => ({ ...prev, minSuccess: parseFloat(e.target.value) }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                    step="0.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Max Approval Latency (hrs)</label>
                  <input
                    type="number"
                    value={alertThresholds.maxLatency}
                    onChange={(e) => setAlertThresholds(prev => ({ ...prev, maxLatency: parseFloat(e.target.value) }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                    step="0.1"
                  />
                </div>
              </div>
            </div>

            {/* Active alerts output */}
            <div className="md:col-span-2 p-5 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Triggered Alarms
              </h3>

              {triggeredAlerts.length === 0 ? (
                <div className="text-center py-12 text-xs text-darkMuted border border-dashed border-darkBorder/40 rounded-lg flex flex-col items-center justify-center gap-2">
                  <Check className="w-8 h-8 text-emerald-400" />
                  <span>All metrics operate within normal healthy parameters.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {triggeredAlerts.map((alert, idx) => (
                    <div key={idx} className="p-3 border border-rose-500/20 bg-rose-500/5 text-rose-300 rounded-lg text-xs font-mono flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-rose-400 uppercase tracking-wide">
                          {alert.metric.replace(/_/g, " ")} Triggered
                        </span>
                        <p className="text-gray-300 font-sans">{alert.message}</p>
                        <p className="text-[10px] text-darkMuted">
                          Value: {alert.value} | Threshold: {alert.threshold}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
