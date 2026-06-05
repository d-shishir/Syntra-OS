import React, { useEffect, useState, useCallback } from "react";
import {
  Users, UserPlus, Clipboard, ShieldCheck, FileText, Activity,
  Search, Sliders, RefreshCw, Upload, Sparkles, AlertTriangle, Check, CheckCircle2,
  TrendingUp, Globe, Clock, X, ChevronRight, MessageSquare, Send
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface Contractor {
  id: string;
  name: string;
  email: string;
  country: string;
  role: string;
  department: string;
  status: string;
  start_date?: string;
  manager?: string;
  payment_method?: string;
}

interface Analytics {
  total_contractors: number;
  active_contractors: number;
  pending_approvals: number;
  invited_count: number;
  pending_documents: number;
  compliance_review: number;
  country_distribution: Record<string, number>;
  avg_onboarding_time_days: number;
}

export const WorkforceDashboard: React.FC = () => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [contractorDetails, setContractorDetails] = useState<any | null>(null);

  // Invitation Form
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    country: "United States",
    role: "",
    department: "",
    manager: ""
  });

  // Contract Generator Form
  const [compensation, setCompensation] = useState("$5,000 USD per month");
  
  // Simulation File Upload Forms
  const [selectedDocType, setSelectedDocType] = useState("Government ID");
  const [uploadFileName, setUploadFileName] = useState("passport_scan.jpg");

  // AI Assistant Chat States
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Welcome to the Syntra Workforce Assistant. Ask me onboarding compliance questions about active profiles!" }
  ]);
  const [chatInput, setChatInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkforceData = useCallback(async () => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    setRefreshing(true);
    const headers = { "Authorization": `Bearer ${token}` };
    try {
      const [dirRes, anaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/workforce/contractors?query=${searchQuery}&status=${statusFilter}`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/workforce/analytics`, { headers })
      ]);
      if (dirRes.ok) setContractors(await dirRes.json());
      if (anaRes.ok) setAnalytics(await anaRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, statusFilter]);

  const fetchContractorDetails = useCallback(async (id: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    const headers = { "Authorization": `Bearer ${token}` };
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${id}`, { headers });
      if (res.ok) {
        setContractorDetails(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchWorkforceData();
  }, [fetchWorkforceData]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(inviteForm)
      });
      if (res.ok) {
        setShowInviteModal(false);
        setInviteForm({ name: "", email: "", country: "United States", role: "", department: "", manager: "" });
        fetchWorkforceData();
      } else {
        alert("Failed to invite contractor.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedContractor) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${selectedContractor.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ document_type: selectedDocType, file_name: uploadFileName })
      });
      if (res.ok) {
        alert("Document uploaded. AI scanned & processed successfully!");
        fetchContractorDetails(selectedContractor.id);
        fetchWorkforceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateContract = async () => {
    if (!selectedContractor) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${selectedContractor.id}/generate-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ compensation_details: compensation })
      });
      if (res.ok) {
        alert("Employment agreement contract generated!");
        fetchContractorDetails(selectedContractor.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignAgreement = async () => {
    if (!selectedContractor) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${selectedContractor.id}/sign-agreement`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Agreement signed successfully!");
        fetchContractorDetails(selectedContractor.id);
        fetchWorkforceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyCompliance = async () => {
    if (!selectedContractor) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${selectedContractor.id}/verify`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Compliance check processed. Current Status: ${data.current_status}`);
        fetchContractorDetails(selectedContractor.id);
        fetchWorkforceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveOnboarding = async () => {
    if (!selectedContractor) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/workforce/${selectedContractor.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reviewer_role: "Operations Manager", comments: "All onboarding verification steps cleared." })
      });
      if (res.ok) {
        alert("Onboarding approved! Contractor activated in global payroll registry.");
        fetchContractorDetails(selectedContractor.id);
        fetchWorkforceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userText = chatInput;
    setChatMessages(prev => [...prev, { sender: "user", text: userText }]);
    setChatInput("");

    // Simulate AI Copilot response grounded on database
    setTimeout(() => {
      let reply = "I'm looking up contractor records. Please specify a contractor's name or country for exact compliance checklist lookup.";
      const query = userText.toLowerCase();
      
      if (selectedContractor) {
        const name = selectedContractor.name;
        const status = contractorDetails?.status || selectedContractor.status;
        const missingCount = contractorDetails ? (4 - contractorDetails.documents?.length) : 4;
        
        if (query.includes("status") || query.includes("onboarding")) {
          reply = `Contractor ${name} is currently in the "${status}" status.`;
        } else if (query.includes("missing") || query.includes("documents") || query.includes("verify")) {
          reply = `For ${name} (${selectedContractor.country}): ${missingCount} of 4 documents uploaded. Current files verified: ${
            contractorDetails?.documents?.map((d: any) => d.document_type).join(", ") || "None"
          }.`;
        } else if (query.includes("action") || query.includes("next")) {
          if (status === "Invited") {
            reply = `The next step for ${name} is contract generation or uploading identity documents.`;
          } else if (status === "Pending Documents") {
            reply = `Please complete all document uploads (Government ID, Address Proof, Tax Form) for ${name}.`;
          } else if (status === "Compliance Review") {
            reply = `AI Scan completed. Run the manual compliance check to queue for approvals.`;
          } else if (status === "Approval Pending") {
            reply = `Onboarding is awaiting Manager and Compliance Officer approval signatures before final activation.`;
          } else {
            reply = `${name} is fully activated and registered in the system.`;
          }
        }
      } else {
        if (query.includes("pending") || query.includes("blocked")) {
          const pendingList = contractors.filter(c => c.status !== "Active");
          reply = `We have ${pendingList.length} contractors pending onboarding. Blocked compliance keys exist for countries requiring citizenship verification cards.`;
        }
      }

      setChatMessages(prev => [...prev, { sender: "bot", text: reply }]);
    }, 800);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Active": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Invited": return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
      case "Pending Documents": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "Compliance Review": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "Approval Pending": return "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20";
      default: return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
            <span className="text-[9px] font-mono uppercase text-darkMuted block">Total Directory</span>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-gray-200">{analytics.total_contractors}</span>
              <Users className="w-4 h-4 text-neonIndigo" />
            </div>
          </div>
          <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
            <span className="text-[9px] font-mono uppercase text-darkMuted block">Active EOR Workers</span>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-emerald-400">{analytics.active_contractors}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
            <span className="text-[9px] font-mono uppercase text-darkMuted block">Review Pending</span>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-amber-400">{analytics.pending_approvals}</span>
              <ShieldCheck className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
            <span className="text-[9px] font-mono uppercase text-darkMuted block">Invited Standby</span>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-sky-400">{analytics.invited_count}</span>
              <Globe className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
            <span className="text-[9px] font-mono uppercase text-darkMuted block">Avg Onboarding Latency</span>
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-neonTeal">{analytics.avg_onboarding_time_days} days</span>
              <Clock className="w-4 h-4 text-neonTeal" />
            </div>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side (Directory) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Global Contractor Directory</h3>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-2.5 py-1 text-[10px] bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" /> Invite Contractor
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-darkMuted absolute left-2.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search contractors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchWorkforceData()}
                  className="bg-darkBg border border-darkBorder rounded-lg pl-8 pr-3 py-1 text-xs text-gray-200 focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); }}
                className="bg-darkBg border border-darkBorder rounded-lg px-2.5 py-1 text-xs text-darkMuted focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="Invited">Invited</option>
                <option value="Pending Documents">Pending Documents</option>
                <option value="Compliance Review">Compliance Review</option>
                <option value="Approval Pending">Approval Pending</option>
                <option value="Active">Active</option>
              </select>

              <button
                onClick={fetchWorkforceData}
                className="p-1.5 border border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-200 rounded-lg cursor-pointer transition-all"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Directory Table */}
          <div className="border border-darkBorder rounded-xl overflow-hidden bg-darkPanel/15">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-darkBorder bg-darkBg/60 text-darkMuted font-mono">
                  <th className="p-3">Contractor Name</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Role / Dept</th>
                  <th className="p-3">Manager</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-darkMuted">No contractors found. Invite a new contractor to start onboarding.</td>
                  </tr>
                ) : (
                  contractors.map(c => (
                    <tr 
                      key={c.id} 
                      onClick={() => { setSelectedContractor(c); fetchContractorDetails(c.id); }}
                      className={`border-b border-darkBorder/60 hover:bg-darkBorder/10 cursor-pointer transition-colors ${
                        selectedContractor?.id === c.id ? "bg-darkBorder/20" : ""
                      }`}
                    >
                      <td className="p-3 font-semibold text-gray-200">
                        <div>{c.name}</div>
                        <div className="text-[10px] text-darkMuted font-mono font-normal">{c.email}</div>
                      </td>
                      <td className="p-3 font-mono">{c.country}</td>
                      <td className="p-3">
                        <div>{c.role}</div>
                        <div className="text-[10px] text-darkMuted font-mono">{c.department}</div>
                      </td>
                      <td className="p-3 text-darkMuted">{c.manager}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${getStatusBadgeClass(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <ChevronRight className="w-4 h-4 text-darkMuted" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side Panels (Details & AI Chat Assistant) */}
        <div className="space-y-6">
          {selectedContractor && contractorDetails ? (
            <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4 animate-fadeIn">
              <div className="flex justify-between items-start border-b border-darkBorder/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-100">{selectedContractor.name}</h3>
                  <span className="text-[10px] text-darkMuted font-mono block mt-0.5">{selectedContractor.country} • {selectedContractor.role}</span>
                </div>
                <button 
                  onClick={() => { setSelectedContractor(null); setContractorDetails(null); }}
                  className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Onboarding Checklist Status */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono uppercase text-darkMuted block">AI Verification & Documents</span>
                <div className="space-y-1.5 text-[11px] font-mono">
                  {["Government ID", "W-9 Tax Form", "Proof of Address", "Signed Agreement"].map(dType => {
                    const doc = contractorDetails.documents?.find((d: any) => d.document_type === dType);
                    return (
                      <div key={dType} className="flex justify-between items-center p-2 rounded bg-darkBg/60 border border-darkBorder/40">
                        <span>{dType}</span>
                        {doc ? (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            doc.status === "Verified" 
                              ? "bg-emerald-500/10 text-emerald-400" 
                              : doc.status === "Suspicious" 
                              ? "bg-rose-500/10 text-rose-400" 
                              : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {doc.status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-500/10 text-darkMuted">MISSING</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Simulation Document Uploader */}
              <div className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-2 text-xs">
                <span className="text-[9px] font-mono uppercase text-darkMuted block">Simulate Document Submission</span>
                <div className="space-y-1.5">
                  <select
                    value={selectedDocType}
                    onChange={(e) => {
                      setSelectedDocType(e.target.value);
                      // Set matching mock filenames
                      if (e.target.value === "Government ID") setUploadFileName("passport_verified.jpg");
                      else if (e.target.value === "W-9 Tax Form") setUploadFileName("w9_stark_valid.pdf");
                      else if (e.target.value === "Proof of Address") setUploadFileName("utility_bill_tower.pdf");
                      else setUploadFileName("signed_agreement.pdf");
                    }}
                    className="w-full bg-darkPanel border border-darkBorder rounded p-1 text-xs text-gray-200 focus:outline-none"
                  >
                    <option value="Government ID">Government ID</option>
                    <option value="W-9 Tax Form">Tax Form (W-9 / Right to work)</option>
                    <option value="Proof of Address">Proof of Address</option>
                    <option value="Signed Agreement">Signed Agreement Document</option>
                  </select>
                  <input
                    type="text"
                    value={uploadFileName}
                    onChange={(e) => setUploadFileName(e.target.value)}
                    placeholder="mock_filename.pdf"
                    className="w-full bg-darkPanel border border-darkBorder rounded p-1 text-xs text-gray-200 focus:outline-none"
                  />
                  <button
                    onClick={handleUploadDocument}
                    className="w-full py-1.5 bg-darkBorder hover:bg-darkBorder/100 border border-darkBorder text-gray-200 rounded font-semibold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Submit File
                  </button>
                </div>
              </div>

              {/* Boilerplate Generator */}
              <div className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-2 text-xs">
                <span className="text-[9px] font-mono uppercase text-darkMuted block">Agreement Contract Draft</span>
                {contractorDetails.agreements?.length === 0 ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={compensation}
                      onChange={(e) => setCompensation(e.target.value)}
                      className="w-full bg-darkPanel border border-darkBorder rounded p-1 text-xs text-gray-200 focus:outline-none"
                    />
                    <button
                      onClick={handleGenerateContract}
                      className="w-full py-1.5 bg-neonTeal hover:bg-neonTeal/85 text-white rounded font-semibold text-[11px] cursor-pointer"
                    >
                      Generate Contract Agreement
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-[10px] bg-darkPanel/50 border border-darkBorder p-2 rounded max-h-[85px] overflow-y-auto font-mono text-darkMuted whitespace-pre-wrap select-all">
                      {contractorDetails.agreements[0].content}
                    </div>
                    {!contractorDetails.agreements[0].accepted ? (
                      <button
                        onClick={handleSignAgreement}
                        className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-500/85 text-white rounded font-semibold text-[11px] cursor-pointer flex items-center justify-center gap-1"
                      >
                        ✍ Contractor Sign Agreement
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 block font-mono text-center">✓ Signed & Accepted Agreement</span>
                    )}
                  </div>
                )}
              </div>

              {/* Onboarding Operations Checks */}
              <div className="flex gap-2">
                <button
                  onClick={handleVerifyCompliance}
                  className="flex-1 py-1.5 bg-darkBorder text-gray-200 hover:bg-darkBorder/80 rounded font-semibold text-[11px] cursor-pointer"
                >
                  Run Compliance Verification
                </button>
                {contractorDetails.status === "Approval Pending" && (
                  <button
                    onClick={handleApproveOnboarding}
                    className="flex-1 py-1.5 bg-neonIndigo hover:bg-neonIndigo/85 text-white rounded font-semibold text-[11px] cursor-pointer"
                  >
                    Grant Active Approval
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl bg-darkPanel/5">
              Select a contractor profile to view onboarding checklists, AI scan simulations, compliance controls, and contracts.
            </div>
          )}

          {/* AI Onboarding Swarm Assistant */}
          <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/15 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-neonTeal" />
              AI Onboarding Agent
            </h3>
            
            <div className="h-[200px] border border-darkBorder/60 bg-darkBg/60 rounded-lg p-3 overflow-y-auto space-y-2.5 text-[11px] font-sans">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`p-2 rounded-lg max-w-[85%] leading-relaxed ${
                    msg.sender === "user" 
                      ? "bg-neonIndigo text-white" 
                      : "bg-darkPanel border border-darkBorder text-gray-200"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                placeholder="Ask about Tony Stark missing docs..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-darkBg border border-darkBorder rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none"
              />
              <button type="submit" className="p-2 bg-neonIndigo text-white hover:bg-neonIndigo/85 rounded-lg cursor-pointer">
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-darkBg/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
          <div className="max-w-md w-full p-6 border border-darkBorder rounded-2xl bg-darkPanel/100 space-y-4">
            <div className="flex justify-between items-center border-b border-darkBorder/60 pb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Invite Contractor</h3>
              <button onClick={() => setShowInviteModal(false)} className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  placeholder="Tony Stark"
                />
              </div>

              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  placeholder="tony@starkindustries.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Country</label>
                <select
                  value={inviteForm.country}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                >
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="Nepal">Nepal</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Role</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                    placeholder="Robotics Engineer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-darkMuted font-semibold block">Department</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                    placeholder="R&D"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-darkMuted font-semibold block">Reports-To Manager</label>
                <input
                  type="text"
                  value={inviteForm.manager}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, manager: e.target.value }))}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200 focus:outline-none"
                  placeholder="Pepper Potts"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded cursor-pointer transition-colors text-center"
              >
                Send Onboarding Invitation Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
