import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  Zap, Server, Activity, Clock, CheckCircle2, AlertTriangle, 
  RefreshCw, Play, Send, Cpu, Terminal, X, ChevronRight, 
  ShieldAlert, Eye, Settings, FileText, Database
} from "lucide-react";

interface EventLog {
  id: string;
  event_type: string;
  source_module: string;
  timestamp: string;
  payload: Record<string, any> | null;
  priority: "low" | "medium" | "high" | "critical";
  trace_id: string | null;
}

interface EventJob {
  id: string;
  event_id: string | null;
  job_type: string;
  payload: Record<string, any> | null;
  status: "queued" | "running" | "completed" | "failed" | "dead_letter";
  priority: "low" | "medium" | "high" | "critical";
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  next_retry_at: string | null;
}

interface DLQJob {
  id: string;
  job_id: string;
  job_type: string;
  payload: Record<string, any> | null;
  priority: "low" | "medium" | "high" | "critical";
  retry_count: number;
  error_message: string | null;
  failed_at: string;
}

interface LiveMetrics {
  event_count: number;
  job_count: number;
  failed_job_count: number;
  dlq_count: number;
  active_workers: number;
}

const BACKEND_URL = "http://localhost:8000";

export const EventDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"stream" | "jobs" | "dlq" | "simulator">("stream");
  const [events, setEvents] = useState<EventLog[]>([]);
  const [jobs, setJobs] = useState<EventJob[]>([]);
  const [dlqJobs, setDlqJobs] = useState<DLQJob[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    event_count: 0,
    job_count: 0,
    failed_job_count: 0,
    dlq_count: 0,
    active_workers: 2
  });

  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventLog | null>(null);
  const [selectedJob, setSelectedJob] = useState<EventJob | null>(null);
  const [drawerType, setDrawerType] = useState<"event" | "job" | null>(null);

  // Simulator state
  const [simEventType, setSimEventType] = useState("invoice_uploaded");
  const [simSource, setSimSource] = useState("finance");
  const [simPayload, setSimPayload] = useState(
    JSON.stringify({ document_id: "doc-uuid-1234", filename: "invoice_998.pdf", amount: 1540.50 }, null, 2)
  );
  const [simPriority, setSimPriority] = useState<"low" | "medium" | "high" | "critical">("high");
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchStaticData = useCallback(async () => {
    try {
      const [eventsRes, jobsRes, dlqRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/events`),
        fetch(`${BACKEND_URL}/api/v1/events/jobs`),
        fetch(`${BACKEND_URL}/api/v1/events/dead-letter-queue`)
      ]);
      
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (dlqRes.ok) setDlqJobs(await dlqRes.json());
    } catch (e) {
      console.error("Failed to fetch static events data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // SSE setup
  useEffect(() => {
    fetchStaticData();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sse = new EventSource(`${BACKEND_URL}/api/v1/events/stream`);
      eventSourceRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.metrics) {
            setMetrics(parsed.metrics);
          }
          if (parsed.new_events && parsed.new_events.length > 0) {
            setEvents(prev => {
              const merged = [...parsed.new_events, ...prev];
              // De-duplicate and cap at 100 entries
              const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
              return unique.slice(0, 100);
            });
          }
          if (parsed.new_jobs && parsed.new_jobs.length > 0) {
            setJobs(prev => {
              const merged = [...parsed.new_jobs, ...prev];
              const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
              return unique.slice(0, 100);
            });
          }
        } catch (err) {
          console.error("Error parsing SSE data:", err);
        }
      };

      sse.onerror = (err) => {
        console.warn("SSE error, falling back to REST polling:", err);
        sse.close();
      };
    };

    connectSSE();

    // Fallback polling for updates in case of connection failure
    const pollInterval = setInterval(() => {
      fetchStaticData();
    }, 4000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(pollInterval);
    };
  }, [fetchStaticData]);

  const handleManualRetry = async (jobId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/events/jobs/${jobId}/retry`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchStaticData();
        alert("Job successfully re-enqueued for processing!");
        setDrawerType(null);
      } else {
        const data = await res.json();
        alert(`Retry failed: ${data.detail || "Unknown error"}`);
      }
    } catch (e) {
      console.error("Retry failed:", e);
    }
  };

  const handleSimulatePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishing(true);
    setPublishMessage(null);

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(simPayload);
    } catch (err) {
      setPublishMessage({ type: "error", text: "Invalid JSON payload structure." });
      setPublishing(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/events/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: simEventType,
          source_module: simSource,
          payload: parsedPayload,
          priority: simPriority
        })
      });

      if (res.ok) {
        setPublishMessage({ type: "success", text: `Successfully published '${simEventType}' to the Event Bus!` });
        await fetchStaticData();
      } else {
        const errData = await res.json();
        setPublishMessage({ type: "error", text: errData.detail || "Publish request rejected." });
      }
    } catch (err) {
      setPublishMessage({ type: "error", text: "Connection error publishing event." });
    } finally {
      setPublishing(false);
    }
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
      case "queued":
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold"><span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />QUEUED</span>;
      case "running":
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-neonTeal/10 text-neonTeal border border-neonTeal/20 text-[10px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-neonTeal animate-ping" />RUNNING</span>;
      case "completed":
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">COMPLETED</span>;
      case "dead_letter":
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/35 text-[10px] font-semibold"><ShieldAlert className="w-3 h-3" />DLQ</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-semibold">FAILED</span>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour12: false }) + " " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Zap className="w-5 h-5 text-neonIndigo" />
            Syntra Real-Time Event Bus Operations Center
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Monitor real-time system events, track backoff-scheduled background jobs, and manage the Dead Letter Queue (DLQ).
          </p>
        </div>
        
        <button
          onClick={fetchStaticData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neonIndigo/10 hover:bg-neonIndigo text-neonIndigo hover:text-white border border-neonIndigo/20 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Console</span>
        </button>
      </div>

      {/* Grid statistics cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-neonIndigo/15">
            <Activity className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Total Events</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{metrics.event_count}</p>
        </div>

        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-neonTeal/15">
            <Server className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Job Executions</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{metrics.job_count}</p>
        </div>

        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-red-500/10">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Failed Retries</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{metrics.failed_job_count}</p>
        </div>

        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-rose-500/10">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Dead Letter (DLQ)</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.dlq_count > 0 ? "text-rose-500" : "text-gray-400"}`}>
            {metrics.dlq_count}
          </p>
        </div>

        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-emerald-500/10">
            <Cpu className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Daemon Workers</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.active_workers} Active</p>
        </div>
      </div>

      {/* Tabs list selector */}
      <div className="border border-darkBorder rounded-xl bg-darkPanel/10 overflow-hidden flex flex-col">
        <div className="flex border-b border-darkBorder/60 bg-darkPanel/30 px-4">
          {[
            { id: "stream", label: "Event Stream", num: events.length },
            { id: "jobs", label: "Job Queue Log", num: jobs.length },
            { id: "dlq", label: "Dead Letter Queue", num: dlqJobs.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                activeTab === tab.id
                  ? "border-neonIndigo text-neonIndigo bg-neonIndigo/5"
                  : "border-transparent text-darkMuted hover:text-gray-200"
              }`}
            >
              {tab.label} {tab.num !== null && `(${tab.num})`}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Tab 1: Event Stream */}
          {activeTab === "stream" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-darkMuted">
                <span>Displaying latest system telemetry logs. Connected via SSE.</span>
              </div>
              
              <div className="overflow-x-auto border border-darkBorder/50 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                      <th className="p-3 px-4">Event Type</th>
                      <th className="p-3">Source Module</th>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/30">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-darkMuted">No events published yet. Simulates workflows to start.</td>
                      </tr>
                    ) : (
                      events.map(ev => (
                        <tr key={ev.id} className="hover:bg-darkPanel/30 transition-colors group">
                          <td className="p-3 px-4 font-semibold text-gray-200 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-neonIndigo" />
                            {ev.event_type}
                          </td>
                          <td className="p-3 text-darkMuted font-semibold">{ev.source_module}</td>
                          <td className="p-3 text-[10px] text-darkMuted font-mono">{formatDate(ev.timestamp)}</td>
                          <td className="p-3">{getPriorityBadge(ev.priority)}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedEvent(ev);
                                setDrawerType("event");
                              }}
                              className="text-neonIndigo hover:underline"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 2: Job Queue Log */}
          {activeTab === "jobs" && (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-darkBorder/50 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                      <th className="p-3 px-4">Job Type</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Attempts</th>
                      <th className="p-3">Created At</th>
                      <th className="p-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/30">
                    {jobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-darkMuted">No background jobs registered in this session.</td>
                      </tr>
                    ) : (
                      jobs.map(job => (
                        <tr key={job.id} className="hover:bg-darkPanel/30 transition-colors">
                          <td className="p-3 px-4 font-semibold text-gray-200 flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-neonTeal" />
                            {job.job_type}
                          </td>
                          <td className="p-3">{getStatusBadge(job.status)}</td>
                          <td className="p-3">{getPriorityBadge(job.priority)}</td>
                          <td className="p-3 text-gray-300 font-semibold">{job.retry_count} / {job.max_retries}</td>
                          <td className="p-3 text-[10px] text-darkMuted font-mono">{formatDate(job.created_at)}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedJob(job);
                                setDrawerType("job");
                              }}
                              className="text-neonTeal hover:underline"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: DLQ (Dead Letter Queue) */}
          {activeTab === "dlq" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-xs text-red-400 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold">Dead Letter Queue Storage</h4>
                  <p className="mt-0.5 leading-relaxed opacity-90">
                    Exhausted background operations are captured here permanently. You can manually inspect the exception state parameters and re-enqueue them back into the priority queues.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border border-darkBorder/50 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                      <th className="p-3 px-4">Failed Job</th>
                      <th className="p-3">Error Reason</th>
                      <th className="p-3">Failed At</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/30">
                    {dlqJobs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-darkMuted">Dead Letter Queue is empty! No permanent failures.</td>
                      </tr>
                    ) : (
                      dlqJobs.map(dJob => (
                        <tr key={dJob.id} className="hover:bg-darkPanel/30 transition-colors">
                          <td className="p-3 px-4 font-semibold text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {dJob.job_type}
                          </td>
                          <td className="p-3 max-w-[280px] truncate text-darkMuted font-mono text-[10px]">{dJob.error_message}</td>
                          <td className="p-3 text-[10px] text-darkMuted font-mono">{formatDate(dJob.failed_at)}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleManualRetry(dJob.job_id)}
                              className="px-2 py-0.5 text-[10px] font-bold bg-neonTeal/15 hover:bg-neonTeal text-neonTeal hover:text-white border border-neonTeal/20 hover:border-neonTeal rounded transition-all cursor-pointer"
                            >
                              Retry Job
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </div>
      </div>

      {/* Details Slide-Over Drawer panel */}
      {drawerType && (selectedEvent || selectedJob) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-darkPanel border-l border-darkBorder flex flex-col justify-between shadow-2xl animate-slideOver">
            
            {/* Header */}
            <div className="p-6 border-b border-darkBorder flex items-center justify-between">
              <div>
                <h3 className="text-md font-semibold text-gray-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-neonIndigo" />
                  {drawerType === "event" ? "Telemetry Event Record Detail" : "Queue Task Job Execution Trace"}
                </h3>
                <p className="text-xs text-darkMuted mt-0.5 font-mono">
                  ID: {drawerType === "event" ? selectedEvent?.id : selectedJob?.id}
                </p>
              </div>
              <button
                onClick={() => setDrawerType(null)}
                className="p-1.5 rounded-lg bg-darkBg hover:bg-darkBorder text-darkMuted hover:text-gray-200 transition-colors border border-darkBorder cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
              
              {drawerType === "event" && selectedEvent && (
                <>
                  <div className="grid grid-cols-2 gap-4 bg-darkBg/30 p-4 border border-darkBorder/40 rounded-xl">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Event Name</span>
                      <p className="text-sm font-semibold text-gray-200 mt-0.5">{selectedEvent.event_type}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Origin</span>
                      <p className="text-sm font-semibold text-gray-300 mt-0.5">{selectedEvent.source_module}</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Timestamp</span>
                      <p className="text-gray-300 font-mono mt-0.5">{formatDate(selectedEvent.timestamp)}</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Priority</span>
                      <div className="mt-0.5">{getPriorityBadge(selectedEvent.priority)}</div>
                    </div>
                  </div>

                  {selectedEvent.trace_id && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Observability Trace Correlation ID</span>
                      <div className="p-2.5 bg-darkBg border border-darkBorder rounded-lg font-mono text-gray-300 select-all">
                        {selectedEvent.trace_id}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Event Payload Arguments</span>
                    <pre className="p-4 bg-darkBg border border-darkBorder rounded-lg font-mono text-gray-300 overflow-x-auto leading-relaxed select-all">
                      {JSON.stringify(selectedEvent.payload, null, 2)}
                    </pre>
                  </div>
                </>
              )}

              {drawerType === "job" && selectedJob && (
                <>
                  <div className="grid grid-cols-2 gap-4 bg-darkBg/30 p-4 border border-darkBorder/40 rounded-xl">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Job Task Type</span>
                      <p className="text-sm font-semibold text-gray-200 mt-0.5">{selectedJob.job_type}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Status State</span>
                      <div className="mt-0.5">{getStatusBadge(selectedJob.status)}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Attempts</span>
                      <p className="text-gray-300 mt-0.5 font-bold">{selectedJob.retry_count} / {selectedJob.max_retries}</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Scheduled Delay Retry</span>
                      <p className="text-gray-300 font-mono mt-0.5">{selectedJob.next_retry_at ? formatDate(selectedJob.next_retry_at) : "None (Instant)"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Parameters Payload</span>
                    <pre className="p-4 bg-darkBg border border-darkBorder rounded-lg font-mono text-gray-300 overflow-x-auto leading-relaxed">
                      {JSON.stringify(selectedJob.payload, null, 2)}
                    </pre>
                  </div>

                  {selectedJob.error_message && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-rose-400 font-semibold">Exception Trace Log</span>
                      <pre className="p-4 bg-red-950/15 border border-red-900/35 rounded-lg font-mono text-red-300 overflow-x-auto leading-relaxed select-text">
                        {selectedJob.error_message}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="p-6 border-t border-darkBorder bg-darkBg/30 flex justify-end gap-3">
              {drawerType === "job" && selectedJob && (selectedJob.status === "failed" || selectedJob.status === "dead_letter") && (
                <button
                  onClick={() => handleManualRetry(selectedJob.id)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-neonTeal hover:bg-neonTeal/85 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Job Now
                </button>
              )}
              <button
                onClick={() => setDrawerType(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-300 bg-darkBorder/40 hover:bg-darkBorder border border-darkBorder rounded-lg transition-colors cursor-pointer"
              >
                Close Inspect
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
