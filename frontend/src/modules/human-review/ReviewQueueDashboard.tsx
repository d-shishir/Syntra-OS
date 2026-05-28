import { useState, useEffect, useCallback } from "react";
import { 
  ShieldAlert, Cpu, Layers, RefreshCw, Clock, ChevronRight, Check, X, ArrowUpCircle, Info, User, FileText
} from "lucide-react";

interface ReviewRequest {
  id: string;
  task_type: string;
  generated_by: string;
  risk_score: number;
  risk_level: string;
  risk_reason: string;
  status: string;
  recommended_action: string;
  supporting_context: any;
  workflow_run_id: string | null;
  assigned_reviewer: string | null;
  assigned_department: string;
  escalation_level: number;
  reviewer_comments: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface RiskAnalysis {
  request_id: string;
  task_type: string;
  risk_score: number;
  risk_level: string;
  risk_reason: string;
  ai_explanation: {
    recommendation: string;
    reasoning: string;
    confidence_score: number;
  };
  rag_retrieved_policy: {
    query: string;
    explanation: string;
    sources: any[];
  };
}

interface AuditTrail {
  id: string;
  approval_request_id: string;
  action: string;
  performed_by: string;
  comments: string | null;
  changes_made: any;
  timestamp: string;
}

interface ReviewQueueDashboardProps {
  backendUrl: string;
}

export function ReviewQueueDashboard({ backendUrl }: ReviewQueueDashboardProps) {
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewRequest | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  
  // Filters
  const [deptFilter, setDeptFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  
  // Loading states
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Action Center Form
  const [comments, setComments] = useState("");
  const [reviewerName, setReviewerName] = useState("ops_reviewer");
  const [actionInProgress, setActionInProgress] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch reviews list
  const fetchReviews = useCallback(async () => {
    setLoadingList(true);
    try {
      let url = `${backendUrl}/api/v1/reviews?limit=30`;
      if (deptFilter) url += `&department=${deptFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
        
        // Auto select first item if none selected
        if (data.length > 0 && !selectedReviewId) {
          setSelectedReviewId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load review requests:", e);
    } finally {
      setLoadingList(false);
    }
  }, [backendUrl, deptFilter, statusFilter, selectedReviewId]);

  // Fetch detailed risk analysis and RAG policies
  const fetchRiskAnalysis = useCallback(async (reqId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/reviews/risk-analysis/${reqId}`);
      if (res.ok) {
        const data = await res.json();
        setRiskAnalysis(data);
      }
    } catch (e) {
      console.error("Failed to fetch risk analysis:", e);
    } finally {
      setLoadingDetails(false);
    }
  }, [backendUrl]);

  // Fetch audit trails for selected item
  const fetchAuditTrails = useCallback(async (reqId: string) => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/reviews/audit-trails?approval_request_id=${reqId}`);
      if (res.ok) {
        const data = await res.json();
        setAuditTrails(data);
      }
    } catch (e) {
      console.error("Failed to fetch audit trails:", e);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews, refreshTrigger]);

  useEffect(() => {
    if (selectedReviewId) {
      const selected = reviews.find(r => r.id === selectedReviewId);
      if (selected) {
        setSelectedReview(selected);
        fetchRiskAnalysis(selectedReviewId);
        fetchAuditTrails(selectedReviewId);
      }
    } else {
      setSelectedReview(null);
      setRiskAnalysis(null);
      setAuditTrails([]);
    }
  }, [selectedReviewId, reviews, fetchRiskAnalysis, fetchAuditTrails]);

  const handleDecision = async (action: "approve" | "reject" | "escalate") => {
    if (!selectedReviewId || !reviewerName.trim()) return;
    
    setActionInProgress(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/reviews/${selectedReviewId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_name: reviewerName,
          comments: comments
        })
      });
      if (res.ok) {
        setComments("");
        // Trigger list refresh
        setRefreshTrigger(prev => prev + 1);
        // Force reload selected review details
        await fetchReviews();
      } else {
        alert(`Failed to execute ${action} decision.`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionInProgress(false);
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      case "medium":
        return "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      default:
        return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
    }
  };

  const getStatusBadgeColor = (statusVal: string) => {
    switch (statusVal.toLowerCase()) {
      case "approved":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
      case "rejected":
        return "bg-rose-500/20 text-rose-400 border border-rose-500/40";
      case "escalated":
        return "bg-purple-500/20 text-purple-400 border border-purple-500/40";
      default:
        return "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse";
    }
  };

  return (
    <div className="space-y-6 text-gray-200 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-darkBorder/40 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-neonIndigo" />
            Human-in-the-Loop Approval Queue (Governance)
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Evaluate high-risk agent suggestions, audit financial/CRM actions, and inspect compliance RAG guidelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-neonIndigo bg-neonIndigo/10 px-2 py-0.5 border border-neonIndigo/20 rounded">
            GOVERNANCE PROTOCOL: GATEWAY_ACTIVE
          </span>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-gray-300 bg-darkPanel border border-darkBorder hover:border-neonIndigo/50 rounded transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sync Queue
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Review Requests List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-3">
            <div className="flex gap-2">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-darkBg border border-darkBorder text-xs text-gray-300 px-2 py-1.5 rounded outline-none flex-1"
              >
                <option value="">All Departments</option>
                <option value="Finance">Finance</option>
                <option value="Compliance">Compliance</option>
                <option value="Sales">Sales</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-darkBg border border-darkBorder text-xs text-gray-300 px-2 py-1.5 rounded outline-none flex-1"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>

            {loadingList ? (
              <div className="py-20 text-center text-darkMuted flex flex-col items-center justify-center">
                <RefreshCw className="w-6 h-6 animate-spin text-neonIndigo mb-2" />
                <p className="text-xs">Loading queue items...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {reviews.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReviewId(req.id)}
                    className={`p-3.5 bg-darkBg/30 border rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      selectedReviewId === req.id ? "border-neonIndigo bg-darkBg/65" : "border-darkBorder"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${getRiskBadgeColor(req.risk_level)}`}>
                          {req.risk_level}
                        </span>
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${getStatusBadgeColor(req.status)}`}>
                          {req.status}
                        </span>
                      </div>
                      
                      <p className="text-xs font-semibold text-gray-200 truncate">{req.task_type.replace("_", " ").toUpperCase()}</p>
                      <p className="text-[10px] text-darkMuted leading-relaxed truncate">{req.risk_reason}</p>
                      
                      <div className="flex items-center gap-3 pt-1 text-[9px] text-darkMuted font-mono">
                        <span>Dept: {req.assigned_department}</span>
                        <span>|</span>
                        <span>{new Date(req.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-darkMuted shrink-0" />
                  </div>
                ))}
                {reviews.length === 0 && (
                  <div className="py-16 text-center text-darkMuted italic text-xs">
                    No approval review requests found in this queue.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Detailed Review Portal */}
        <div className="lg:col-span-7">
          {selectedReview && riskAnalysis ? (
            <div className="space-y-6">
              
              {/* Risk Analytics Card */}
              <div className="p-5 bg-darkPanel/20 border border-darkBorder rounded-xl space-y-4">
                <div className="flex justify-between items-start border-b border-darkBorder/40 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider">AI Risk & Reasoning</h3>
                    <h4 className="text-sm font-bold text-gray-200 mt-1 uppercase">
                      {selectedReview.task_type.replace("_", " ")}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-3 select-none">
                    <div className="text-right">
                      <span className="text-[9px] text-darkMuted block font-bold uppercase">Risk Score</span>
                      <span className={`text-base font-mono font-bold ${
                        selectedReview.risk_score > 70 
                          ? "text-rose-400" 
                          : selectedReview.risk_score > 40 
                          ? "text-amber-400" 
                          : "text-emerald-400"
                      }`}>
                        {selectedReview.risk_score}/100
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs select-text">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-darkMuted uppercase block">AI Flag Justification:</span>
                    <p className="text-gray-300 bg-darkBg/40 border border-darkBorder/60 p-2.5 rounded leading-relaxed">
                      {riskAnalysis.ai_explanation.reasoning}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <div className="p-2.5 bg-darkBg/30 border border-darkBorder/80 rounded-lg">
                      <span className="text-[8.5px] font-mono text-darkMuted uppercase block">Recommendation:</span>
                      <span className="text-gray-300 font-medium block mt-1">{selectedReview.recommended_action}</span>
                    </div>
                    <div className="p-2.5 bg-darkBg/30 border border-darkBorder/80 rounded-lg">
                      <span className="text-[8.5px] font-mono text-darkMuted uppercase block">Assigned Reviewer Role:</span>
                      <span className="text-gray-300 font-mono block mt-1 text-[11px]">{selectedReview.assigned_reviewer || "unassigned"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RAG Policy Guideline Context Card */}
              {loadingDetails ? (
                <div className="p-5 bg-darkPanel/20 border border-darkBorder rounded-xl text-center py-10 flex flex-col items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-neonIndigo mb-1.5" />
                  <p className="text-xs text-darkMuted">Retrieving compliance guidelines from RAG database...</p>
                </div>
              ) : (
                riskAnalysis.rag_retrieved_policy && (
                  <div className="p-5 bg-darkPanel/20 border border-darkBorder rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-neonTeal" />
                      RAG-Powered Compliance policy context
                    </h3>

                    <div className="space-y-3 text-xs select-text">
                      <div className="p-3 bg-darkBg/50 border border-darkBorder rounded-lg space-y-2">
                        <div className="flex gap-1.5 items-center text-[10px] text-neonTeal font-semibold uppercase">
                          <Info className="w-3.5 h-3.5" />
                          Retrieved Policy Analysis
                        </div>
                        <p className="text-gray-300 leading-relaxed font-sans">{riskAnalysis.rag_retrieved_policy.explanation}</p>
                      </div>

                      {/* Sources list */}
                      {riskAnalysis.rag_retrieved_policy.sources && riskAnalysis.rag_retrieved_policy.sources.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-darkMuted uppercase block">Compliance Reference Chunks:</span>
                          <div className="space-y-2 max-h-[160px] overflow-y-auto">
                            {riskAnalysis.rag_retrieved_policy.sources.map((src: any, i: number) => (
                              <div key={i} className="p-2.5 bg-darkBg/30 border border-darkBorder/40 rounded text-[10px] space-y-1">
                                <div className="flex justify-between text-[8px] text-darkMuted">
                                  <span className="font-semibold text-gray-400">{src.filename}</span>
                                  <span className="font-mono">Match: {(src.score * 100).toFixed(0)}%</span>
                                </div>
                                <p className="text-gray-300 font-sans leading-normal">{src.chunk_text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Action Center Form (for pending status) */}
              {selectedReview.status === "pending" && (
                <div className="p-5 bg-darkPanel/25 border border-darkBorder rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-neonIndigo uppercase tracking-wider">Compliance Reviewer Decision Console</h3>

                  <div className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-bold text-darkMuted uppercase">Reviewer User Role ID</label>
                        <input
                          type="text"
                          value={reviewerName}
                          onChange={(e) => setReviewerName(e.target.value)}
                          className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded px-3 py-2 text-xs outline-none"
                          required
                        />
                      </div>
                      <div className="space-y-1 flex flex-col justify-end">
                        <span className="text-[9px] text-darkMuted italic block pb-2.5">
                          Audit trails will stamp this ID permanently.
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-darkMuted uppercase">Reviewer Decision Comments</label>
                      <textarea
                        placeholder="Add review feedback, reasoning, or checklist confirmations..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded px-3 py-2 text-xs outline-none min-h-[70px] resize-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2.5 pt-1">
                      <button
                        onClick={() => handleDecision("approve")}
                        disabled={actionInProgress}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-500/85 text-white font-semibold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Approve execution
                      </button>
                      
                      <button
                        onClick={() => handleDecision("reject")}
                        disabled={actionInProgress}
                        className="flex-1 py-2 px-3 bg-rose-500 hover:bg-rose-500/85 text-white font-semibold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Reject & Fail
                      </button>

                      <button
                        onClick={() => handleDecision("escalate")}
                        disabled={actionInProgress}
                        className="py-2 px-3 bg-purple-600 hover:bg-purple-600/85 text-white font-semibold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Escalate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Immutable Audit Log Tracker */}
              {auditTrails.length > 0 && (
                <div className="p-5 bg-darkPanel/20 border border-darkBorder rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-darkMuted uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-neonIndigo" />
                    Review Audit Trail History
                  </h3>

                  <div className="space-y-3 font-mono text-[10px] select-text">
                    {auditTrails.map((trail) => (
                      <div key={trail.id} className="p-3 bg-darkBg/40 border border-darkBorder/60 rounded-lg space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] border-b border-darkBorder/20 pb-1">
                          <span className="font-bold uppercase text-neonTeal">ACTION: {trail.action}</span>
                          <span className="text-darkMuted">{new Date(trail.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-gray-300 leading-snug font-sans">{trail.comments}</p>
                        
                        <div className="flex items-center gap-2.5 text-[8.5px] text-darkMuted pt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-neonIndigo" />
                            By: {trail.performed_by}
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-neonTeal" />
                            ID: {trail.id.split("-")[0]}...
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-darkMuted border border-darkBorder border-dashed rounded-xl">
              <Cpu className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm font-semibold">Select Review Item</p>
              <p className="text-xs text-center mt-1 max-w-xs">
                Choose a pending transaction or policy exception in the queue to inspect compliance warnings, retrieved policies, and execute approval decisions.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
