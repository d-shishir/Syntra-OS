import React, { useEffect, useState, useCallback } from "react";
import { 
  Activity, Cpu, CheckCircle2, AlertTriangle, Clock, RefreshCw, Terminal, Trash2, Loader2, Server, X
} from "lucide-react";

interface TaskJob {
  id: string;
  task_type: string;
  payload: Record<string, any> | null;
  status: "pending" | "processing" | "completed" | "failed";
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface WorkerMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

const BACKEND_URL = "http://localhost:8000";

export const WorkerMonitor: React.FC = () => {
  const [tasks, setTasks] = useState<TaskJob[]>([]);
  const [metrics, setMetrics] = useState<WorkerMetrics>({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskJob | null>(null);
  const [errorDrawerOpen, setErrorDrawerOpen] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/worker/metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch worker metrics:", err);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/worker/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error("Failed to fetch worker tasks:", err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), fetchTasks()]);
    setRefreshing(false);
    setLoading(false);
  }, [fetchMetrics, fetchTasks]);

  // Polling loop
  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchTasks();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchTasks, refreshData]);

  const handleRetryTask = async (jobId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/worker/tasks/${jobId}/retry`, {
        method: "POST"
      });
      if (res.ok) {
        refreshData();
      } else {
        const errData = await res.json();
        alert(`Failed to retry job: ${errData.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error retrying job:", err);
    }
  };

  const handleClearCompleted = async () => {
    if (!window.confirm("Are you sure you want to clear completed tasks from the log?")) {
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/worker/tasks/clear-completed`, {
        method: "POST"
      });
      if (res.ok) {
        refreshData();
      }
    } catch (err) {
      console.error("Error clearing jobs:", err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }) + " " + date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 0) return "—";
    return (diffMs / 1000).toFixed(2) + "s";
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title & Control Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neonTeal" />
            Asynchronous Task Worker Monitor
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Monitor real-time task queues, review worker errors, and manage backend execution jobs
          </p>
        </div>
        
        <div className="flex gap-2.5">
          <button
            onClick={handleClearCompleted}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-darkBorder/40 hover:bg-red-500/10 text-darkMuted hover:text-red-400 border border-darkBorder hover:border-red-500/20 transition-all cursor-pointer"
            title="Purge Completed Jobs Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Completed</span>
          </button>
          
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-neonTeal/10 hover:bg-neonTeal text-neonTeal hover:text-white border border-neonTeal/20 hover:border-neonTeal transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Force Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Tasks Card */}
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-darkBorder/25 group-hover:scale-110 transition-transform">
            <Server className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Total Jobs</p>
          <p className="text-2xl font-bold text-gray-200 mt-1">{metrics.total}</p>
        </div>

        {/* Pending Card */}
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-amber-500/10 group-hover:scale-110 transition-transform">
            <Clock className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Pending Queue</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.pending > 0 ? "text-amber-400" : "text-gray-400"}`}>
            {metrics.pending}
          </p>
        </div>

        {/* Processing Card */}
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-neonTeal/10 group-hover:scale-110 transition-transform">
            <Activity className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Processing</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.processing > 0 ? "text-neonTeal animate-pulse" : "text-gray-400"}`}>
            {metrics.processing}
          </p>
        </div>

        {/* Completed Card */}
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-emerald-500/10 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Completed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{metrics.completed}</p>
        </div>

        {/* Failed Card */}
        <div className="p-4 bg-darkPanel/20 border border-darkBorder rounded-xl relative overflow-hidden group">
          <div className="absolute -right-2 -bottom-2 text-red-500/10 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <p className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Failed</p>
          <p className={`text-2xl font-bold mt-1 ${metrics.failed > 0 ? "text-red-400" : "text-gray-400"}`}>
            {metrics.failed}
          </p>
        </div>
      </div>

      {/* Jobs Log Table List */}
      <div className="overflow-hidden border border-darkBorder rounded-xl bg-darkPanel/20 backdrop-blur-md">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-darkMuted flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-neonTeal" />
              <p className="text-xs">Fetching task queues...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 text-center text-darkMuted flex flex-col items-center justify-center">
              <Cpu className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-gray-300 font-semibold">Task Queue Empty</p>
              <p className="text-xs mt-1">Upload a PDF or trigger an automated pipeline to start job queues</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-darkBorder bg-darkPanel/40 text-xs font-semibold text-darkMuted uppercase tracking-wider">
                  <th className="py-4 px-6">Task Type & Job ID</th>
                  <th className="py-4 px-6">Payload Arguments</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Created At</th>
                  <th className="py-4 px-6">Attempts</th>
                  <th className="py-4 px-6">Duration</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-darkBorder/50 text-sm">
                {tasks.map((job) => (
                  <tr 
                    key={job.id} 
                    className="hover:bg-darkPanel/40 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-gray-200 text-xs flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-neonTeal/80" />
                        {job.task_type}
                      </div>
                      <code className="text-[10px] text-darkMuted font-mono select-all block mt-0.5">
                        ID: {job.id}
                      </code>
                    </td>
                    <td className="py-4 px-6">
                      <div className="max-w-[200px] truncate text-xs font-mono text-darkMuted bg-darkBg/60 px-2 py-1 rounded border border-darkBorder/40">
                        {JSON.stringify(job.payload)}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {job.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <span className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
                          PENDING
                        </span>
                      )}
                      {job.status === "processing" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neonTeal/10 text-neonTeal border border-neonTeal/20">
                          <span className="w-1 h-1 rounded-full bg-neonTeal animate-pulse" />
                          PROCESSING
                        </span>
                      )}
                      {job.status === "completed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          COMPLETED
                        </span>
                      )}
                      {job.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-darkMuted font-mono">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="py-4 px-6 text-xs font-semibold text-gray-300">
                      {job.retry_count} / {job.max_retries}
                    </td>
                    <td className="py-4 px-6 text-xs text-darkMuted font-mono">
                      {calculateDuration(job.started_at, job.completed_at)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        {job.status === "failed" && job.error_message && (
                          <button
                            onClick={() => {
                              setSelectedTask(job);
                              setErrorDrawerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500 transition-all cursor-pointer"
                          >
                            Error Log
                          </button>
                        )}
                        {(job.status === "failed" || job.status === "completed") && (
                          <button
                            onClick={() => handleRetryTask(job.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-darkBorder/60 hover:bg-neonTeal/15 text-darkMuted hover:text-neonTeal border border-darkBorder hover:border-neonTeal/30 transition-all cursor-pointer"
                            title="Re-run Task Job"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Error Traceback Slider Drawer */}
      {errorDrawerOpen && selectedTask && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-darkPanel border-l border-darkBorder flex flex-col justify-between shadow-2xl animate-slideOver">
            <div className="p-6 border-b border-darkBorder flex items-center justify-between">
              <div>
                <h3 className="text-md font-semibold text-gray-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Task Error Log Traceback
                </h3>
                <p className="text-xs text-darkMuted mt-0.5 font-mono">
                  Job ID: {selectedTask.id} ({selectedTask.task_type})
                </p>
              </div>
              <button
                onClick={() => setErrorDrawerOpen(false)}
                className="p-1.5 rounded-lg bg-darkBg hover:bg-darkBorder text-darkMuted hover:text-gray-200 transition-colors border border-darkBorder cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-darkMuted font-semibold">Parameters</span>
                <pre className="p-3 bg-darkBg border border-darkBorder rounded-lg text-xs font-mono text-gray-300 overflow-x-auto">
                  {JSON.stringify(selectedTask.payload, null, 2)}
                </pre>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-red-400 font-semibold">Exception Trace</span>
                <pre className="p-4 bg-red-950/15 border border-red-900/35 rounded-lg text-[11px] font-mono text-red-300 overflow-x-auto leading-relaxed select-text">
                  {selectedTask.error_message}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-darkBorder bg-darkBg/30 flex justify-end gap-3">
              <button
                onClick={() => {
                  handleRetryTask(selectedTask.id);
                  setErrorDrawerOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-neonTeal hover:bg-neonTeal/85 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Job Now
              </button>
              <button
                onClick={() => setErrorDrawerOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-300 bg-darkBorder/40 hover:bg-darkBorder border border-darkBorder rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
