import { useEffect, useState, useCallback, useRef } from "react";
import { FileUpload } from "./components/FileUpload";
import { DocumentList } from "./components/DocumentList";
import type { DocumentMetadata } from "./components/DocumentList";
import { DocumentViewer } from "./components/DocumentViewer";
import { 
  Server, Search, Loader2, HelpCircle, Send, ChevronDown, ChevronUp, 
  Clock, Sliders, Eye, EyeOff, Lock, AlertTriangle, Zap
} from "lucide-react";
import { AppShell } from "./layouts/AppShell";
import type { WorkspaceTab } from "./layouts/AppShell";
import { apiClient } from "./services/apiClient";

// Import Module Dashboards
import { Dashboard as FinanceDashboard } from "./modules/invoice-automation/Dashboard";
import { WorkflowDashboard } from "./modules/workflow-engine/WorkflowDashboard";
import { CrmDashboard } from "./modules/crm-intelligence/CrmDashboard";
import { WorkerMonitor } from "./modules/background-worker/WorkerMonitor";
import { AgentDashboard } from "./modules/multi-agent-system/AgentDashboard";
import { ObservabilityDashboard } from "./modules/observability/ObservabilityDashboard";
import { ReviewQueueDashboard } from "./modules/human-review/ReviewQueueDashboard";
import { EventDashboard } from "./modules/event-monitoring/EventDashboard";
import { NotificationDashboard } from "./modules/notification-center/NotificationDashboard";
import { AuthDashboard } from "./modules/auth-access/AuthDashboard";
import { UnifiedDashboard } from "./modules/unified-dashboard/UnifiedDashboard";
import { CopilotDashboard } from "./modules/ai-copilot/CopilotDashboard";
import { GraphDashboard } from "./modules/knowledge-graph/GraphDashboard";
import { SearchDashboard } from "./modules/enterprise-search/SearchDashboard";
import { ResearchDashboard } from "./modules/ai-research/ResearchDashboard";

interface SearchResult {
  content: string;
  chunk_index: number;
  document_id: string;
  filename: string;
  similarity: number;
}

interface ChatSource {
  document_id: string;
  chunk_text: string;
  score: number;
  filename: string;
}

interface ChatMetrics {
  rewrite_time_ms: number;
  embedding_time_ms: number;
  db_time_ms: number;
  rerank_time_ms: number;
  generation_time_ms: number;
  total_time_ms: number;
  cache_hit: boolean;
}

interface Message {
  sender: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
  metrics?: ChatMetrics;
  query_rewritten?: string;
}

interface AIStatus {
  status: "connected" | "mock" | "disconnected";
  model: string;
  embedding_model: string;
  provider: string;
  detail: string;
}

interface SystemMetrics {
  documents_indexed: number;
  total_chunks: number;
  avg_query_time_ms: number;
  cache_hit_rate: number;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("syntra_token"));
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // App States
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [trashDocuments, setTrashDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("hub");
  const [assistantSubTab, setAssistantSubTab] = useState<"chat" | "search">("chat");
  const [automationSubTab, setAutomationSubTab] = useState<"finance" | "crm" | "workflows">("finance");
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);

  // Semantic Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // RAG Chat State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "assistant",
      text: "Hi! I am Syntra OS's RAG Assistant. Ask me any question, and I will search and answer using only your vectorized document library."
    }
  ]);
  const [chatting, setChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedSourceIdx, setExpandedSourceIdx] = useState<number | null>(null);
  const [selectedMessageIdx, setSelectedMessageIdx] = useState<number | null>(null);
  const [showRetrievedChunks, setShowRetrievedChunks] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // System telemetry & Health Status
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  // Login inputs state
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const decodeJwt = (activeToken: string) => {
    try {
      const base64Url = activeToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const fetchUserContext = useCallback((activeToken: string) => {
    const payload = decodeJwt(activeToken);
    if (payload) {
      setCurrentUser({
        id: payload.sub,
        name: payload.role === "admin" 
          ? "Admin Director" 
          : payload.role.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        role: payload.role,
        department: payload.department
      });
    } else {
      localStorage.removeItem("syntra_token");
      setToken(null);
      setCurrentUser(null);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent | string, manualPassword?: string) => {
    if (typeof e !== "string") {
      e.preventDefault();
    }
    setLoginError(null);
    setLoginLoading(true);

    const email = typeof e === "string" ? e : emailInput;
    const password = typeof e === "string" ? manualPassword : passwordInput;

    try {
      const res = await apiClient.post("/api/v1/auth/login", { email, password });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("syntra_token", data.access_token);
        setToken(data.access_token);
        fetchUserContext(data.access_token);
      } else {
        const errData = await res.json();
        setLoginError(errData.detail || "Authentication credentials rejected.");
      }
    } catch (err) {
      setLoginError("Failed to reach security authentication service.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("syntra_token");
    setToken(null);
    setCurrentUser(null);
  };

  const fetchDocuments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await apiClient.get("/documents", { params: { is_deleted: "false" } });
      if (!response.ok) {
        throw new Error("Failed to fetch documents.");
      }
      const data = await response.json();
      setDocuments(data);

      const trashResponse = await apiClient.get("/documents", { params: { is_deleted: "true" } });
      if (trashResponse.ok) {
        const trashData = await trashResponse.json();
        setTrashDocuments(trashData);
      }
      setApiConnected(true);
    } catch (error) {
      console.error("Error fetching documents:", error);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleTrashDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to move this document to the Trash?")) {
      return;
    }
    try {
      const response = await apiClient.post(`/documents/${id}/trash`);
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error trashing document:", error);
    }
  };

  const handleRestoreDocument = async (id: string) => {
    try {
      const response = await apiClient.post(`/documents/${id}/restore`);
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error restoring document:", error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this document?")) {
      return;
    }
    try {
      const response = await apiClient.delete(`/documents/${id}`);
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const fetchAIStatus = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiClient.get("/health/ai");
      if (response.ok) {
        const data = await response.json();
        setAiStatus(data);
        setApiConnected(true);
      } else {
        setAiStatus({
          status: "disconnected",
          model: "Unknown",
          embedding_model: "Unknown",
          provider: "API Connection Failure",
          detail: "Server returned non-200 status code."
        });
      }
    } catch (error) {
      console.error("Error fetching AI status:", error);
      setAiStatus({
        status: "disconnected",
        model: "Unknown",
        embedding_model: "Unknown",
        provider: "API Connection Failure",
        detail: "Could not reach the health endpoint."
      });
      setApiConnected(false);
    }
  }, [token]);

  const fetchSystemMetrics = useCallback(async () => {
    if (!token) return;
    try {
      const response = await apiClient.get("/system-metrics");
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data);
        setApiConnected(true);
      }
    } catch (error) {
      console.error("Error fetching system metrics:", error);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUserContext(token);
      fetchDocuments();
      fetchAIStatus();
      fetchSystemMetrics();
    }
  }, [token, fetchDocuments, fetchAIStatus, fetchSystemMetrics, fetchUserContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatting]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery && !searchQuery.trim()) return;

    setSearching(true);
    setSearchError(null);
    setSearched(true);
    try {
      const res = await apiClient.get("/search", { params: { query: searchQuery } });
      if (!res.ok) {
        throw new Error("Semantic query request failed.");
      }
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      const error = err as Error;
      setSearchError(error.message || "An error occurred during search.");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput || !chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { sender: "user", text: userMessage }]);
    setChatting(true);
    setExpandedSourceIdx(null);

    try {
      const res = await apiClient.post("/chat-with-documents", { query: userMessage });
      if (!res.ok) {
        throw new Error("Server error processing chat query.");
      }

      const data = await res.json();
      setMessages(prev => [...prev, {
        sender: "assistant",
        text: data.answer,
        sources: data.sources,
        metrics: data.metrics
      }]);
      setSelectedMessageIdx(messages.length + 1);
    } catch (err) {
      const error = err as Error;
      setMessages(prev => [...prev, {
        sender: "assistant",
        text: `Error: ${error.message || "Something went wrong while retrieving documents."}`
      }]);
    } finally {
      setChatting(false);
      fetchSystemMetrics();
    }
  };

  const selectSuggestion = (queryText: string) => {
    setChatInput(queryText);
  };

  // 1. Root Login Gating layout
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-darkBg text-gray-200 p-6">
        <div className="max-w-md w-full p-8 border border-darkBorder rounded-2xl bg-darkPanel/45 space-y-6 shadow-2xl relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-neonIndigo/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center space-y-2 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-extrabold text-gray-200">Authenticate Syntra OS</h3>
            <p className="text-xs text-darkMuted">Enter your credentials or select a simulation profile to access the operational shell.</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs relative z-10">
            <div className="space-y-1.5">
              <label className="text-darkMuted font-semibold">Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="form-input"
                placeholder="e.g. admin@syntra.io"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-darkMuted font-semibold">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 border border-red-500/20 bg-red-500/5 text-red-400 rounded-lg flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-2.5 bg-neonIndigo hover:bg-neonIndigo/85 text-white font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs"
            >
              {loginLoading ? "Authenticating session..." : "Sign In to Platform"}
            </button>
          </form>

          <div className="border-t border-darkBorder/60 pt-4 space-y-2.5 relative z-10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-darkMuted block">Quick-Select Simulation Profiles</span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {[
                { email: "admin@syntra.io", label: "Admin Director" },
                { email: "finance@syntra.io", label: "Finance Specialist" },
                { email: "sales@syntra.io", label: "Sales Rep" },
                { email: "compliance@syntra.io", label: "Compliance Officer" }
              ].map(profile => (
                <button
                  key={profile.email}
                  type="button"
                  onClick={() => handleLoginSubmit(profile.email, `${profile.email.split('@')[0]}password`)}
                  className="p-2 border border-darkBorder bg-darkPanel/20 hover:border-darkBorder/100 text-darkMuted hover:text-gray-300 rounded-lg text-left transition-all cursor-pointer"
                >
                  <span className="font-semibold block">{profile.label}</span>
                  <span className="opacity-60 block text-[9px] truncate">{profile.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Central Mainframe Offline
  if (!apiConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-darkBg text-gray-200 p-6">
        <div className="p-8 border border-rose-500/25 bg-darkPanel/20 rounded-xl max-w-xl space-y-5 relative shadow-lg text-center">
          <div className="w-12 h-12 mx-auto rounded-lg border border-rose-500/20 bg-rose-500/10 flex items-center justify-center text-rose-400">
            <Server className="w-6 h-6 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h2 className="font-display font-extrabold text-sm text-gray-200 tracking-wider uppercase">
              [ALERT] Central Mainframe Offline
            </h2>
            <p className="font-mono text-[9px] text-rose-400 uppercase tracking-widest leading-normal">
              Critical: Syntra OS API Node Unreachable
            </p>
            <div className="border-t border-darkBorder/40 my-3 pt-3" />
            <p className="text-xs text-darkMuted leading-relaxed">
              The platform could not reach the backend operations server. Please check that the backend daemon is running properly on port 8000 and try again.
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              fetchDocuments();
              fetchAIStatus();
              fetchSystemMetrics();
            }}
            className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-rose-950 hover:bg-rose-900 border border-rose-700/40 rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Clock className="w-3.5 h-3.5" />
            Reconnect Mainframe
          </button>
        </div>
      </div>
    );
  }

  // 3. Render Dashboard Component switch
  const renderTabContent = () => {
    switch (activeTab) {
      case "hub":
        return <UnifiedDashboard />;
      case "copilot":
        return <CopilotDashboard />;
      case "graph":
        return <GraphDashboard />;
      case "search":
        return <SearchDashboard />;
      case "research":
        return <ResearchDashboard />;
      case "agents":
        return <AgentDashboard backendUrl="http://localhost:8000" />;
      case "worker":
        return <WorkerMonitor />;
      case "observability":
        return <ObservabilityDashboard backendUrl="http://localhost:8000" />;
      case "review":
        return <ReviewQueueDashboard backendUrl="http://localhost:8000" />;
      case "events":
        return <EventDashboard />;
      case "notifications":
        return <NotificationDashboard />;
      case "auth":
        return <AuthDashboard />;
      case "automation":
        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Sub Tab Navigation for Business Automation */}
            <div className="flex flex-wrap gap-2 border-b border-darkBorder/40 pb-2.5">
              <button
                onClick={() => setAutomationSubTab("finance")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  automationSubTab === "finance"
                    ? "bg-neonTeal/10 text-neonTeal border border-neonTeal/20"
                    : "text-darkMuted hover:text-gray-200"
                }`}
              >
                Finance Invoices
              </button>
              <button
                onClick={() => setAutomationSubTab("crm")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  automationSubTab === "crm"
                    ? "bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20"
                    : "text-darkMuted hover:text-gray-200"
                }`}
              >
                CRM Lead Capture
              </button>
              <button
                onClick={() => setAutomationSubTab("workflows")}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  automationSubTab === "workflows"
                    ? "bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20"
                    : "text-darkMuted hover:text-gray-200"
                }`}
              >
                Active Workflows
              </button>
            </div>

            <div className="mt-4">
              {automationSubTab === "finance" && (
                <FinanceDashboard backendUrl="http://localhost:8000" />
              )}
              {automationSubTab === "crm" && (
                <CrmDashboard backendUrl="http://localhost:8000" />
              )}
              {automationSubTab === "workflows" && (
                <WorkflowDashboard backendUrl="http://localhost:8000" />
              )}
            </div>
          </div>
        );
      case "assistant":
        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Sub Tab Navigation (AI Chat vs Semantic Search) */}
            <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2.5">
              <div className="flex gap-2">
                <button
                  onClick={() => setAssistantSubTab("chat")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    assistantSubTab === "chat"
                      ? "bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20"
                      : "text-darkMuted hover:text-gray-200"
                  }`}
                >
                  AI Chat Assistant
                </button>
                <button
                  onClick={() => setAssistantSubTab("search")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    assistantSubTab === "search"
                      ? "bg-neonTeal/10 text-neonTeal border border-neonTeal/20"
                      : "text-darkMuted hover:text-gray-200"
                  }`}
                >
                  Semantic Search
                </button>
              </div>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg border border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-200 hover:border-darkBorder/100 cursor-pointer transition-all"
              >
                {sidebarOpen ? "Hide Library" : "Show Library"}
              </button>
            </div>

            {assistantSubTab === "chat" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[600px]">
                {/* Left side: RAG Chat pane */}
                <div className="lg:col-span-2 h-[550px] lg:h-full bg-darkPanel/20 border border-darkBorder rounded-xl p-5 flex flex-col justify-between space-y-4">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 select-text">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex flex-col space-y-1 max-w-[85%] ${
                          msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <div
                          onClick={() => {
                            if (msg.sender === "assistant") {
                              setSelectedMessageIdx(index);
                            }
                          }}
                          className={`p-3.5 rounded-xl text-sm leading-relaxed ${
                            msg.sender === "assistant" ? "cursor-pointer hover:border-darkBorder/100 transition-colors" : ""
                          } ${
                            selectedMessageIdx === index
                              ? "border-neonIndigo bg-darkPanel shadow-lg shadow-neonIndigo/5"
                              : ""
                          } ${
                            msg.sender === "user"
                              ? "bg-darkBorder/80 text-white rounded-br-none"
                              : "bg-darkPanel border border-darkBorder/80 text-gray-200 rounded-bl-none"
                          }`}
                        >
                          {msg.text}
                        </div>

                        {msg.sender === "assistant" && msg.sources && msg.sources.length > 0 && (
                          <div className="w-full mt-1.5 space-y-1">
                            <button
                              onClick={() => setExpandedSourceIdx(expandedSourceIdx === index ? null : index)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-neonIndigo hover:text-neonIndigo/80 uppercase tracking-wide transition-colors"
                            >
                              <span>Sources & Citations ({msg.sources.length})</span>
                              {expandedSourceIdx === index ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {expandedSourceIdx === index && (
                              <div className="space-y-2 p-3 bg-darkBg/50 border border-darkBorder/50 rounded-xl mt-1 max-w-lg animate-fadeIn text-xs text-darkMuted leading-relaxed">
                                {msg.sources.map((src, sIdx) => (
                                  <div key={sIdx} className="border-b border-darkBorder/30 pb-2 last:border-b-0 last:pb-0">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-semibold text-gray-300 truncate max-w-[180px]">{src.filename}</span>
                                      <span className="text-[10px] text-neonTeal">
                                        {isAdvancedMode ? `${(src.score * 100).toFixed(1)}% similarity` : "Highly Relevant Match"}
                                      </span>
                                    </div>
                                    <p className="italic text-[11px] bg-darkPanel/35 p-2 rounded text-darkMuted select-text">
                                      "{src.chunk_text}"
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {chatting && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-darkPanel border border-darkBorder/80 max-w-[200px] text-xs text-darkMuted mr-auto">
                        <Loader2 className="w-3.5 h-3.5 text-neonIndigo animate-spin" />
                        Retrieving context...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {messages.length === 1 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-darkBorder/40">
                      <button
                        onClick={() => selectSuggestion("What is the invoice amount for Canada Post?")}
                        className="px-3 py-1.5 text-[11px] font-medium text-darkMuted hover:text-white bg-darkBg/40 hover:bg-darkBorder/60 border border-darkBorder/60 rounded-full transition-all cursor-pointer"
                      >
                        "What is the invoice amount?"
                      </button>
                      <button
                        onClick={() => selectSuggestion("Summarize the key points of the documents")}
                        className="px-3 py-1.5 text-[11px] font-medium text-darkMuted hover:text-white bg-darkBg/40 hover:bg-darkBorder/60 border border-darkBorder/60 rounded-full transition-all cursor-pointer"
                      >
                        "Summarize the key points"
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-darkBorder/50">
                    <input
                      type="text"
                      placeholder="Ask a question about the document context..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-darkBg/60 border border-darkBorder focus:border-neonIndigo rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-darkMuted outline-none transition-all"
                      disabled={chatting}
                    />
                    <button
                      type="submit"
                      disabled={chatting || !chatInput.trim()}
                      className="px-4 py-2.5 text-xs font-semibold text-white bg-neonIndigo hover:bg-neonIndigo/80 disabled:bg-neonIndigo/50 rounded-lg shadow-lg shadow-neonIndigo/10 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Right side: Diagnostics Panel */}
                {isAdvancedMode && (
                  <div className="lg:col-span-1 h-[450px] lg:h-full bg-darkPanel/35 border border-darkBorder rounded-xl p-5 flex flex-col space-y-4 overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neonIndigo uppercase tracking-wider">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>RAG Diagnostics</span>
                      </div>
                      {selectedMessageIdx !== null && messages[selectedMessageIdx]?.metrics?.cache_hit && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                          <Zap className="w-2.5 h-2.5 animate-bounce" /> Cache Hit
                        </span>
                      )}
                    </div>

                    {selectedMessageIdx !== null && messages[selectedMessageIdx]?.sender === "assistant" && messages[selectedMessageIdx]?.metrics ? (
                      (() => {
                        const activeMsg = messages[selectedMessageIdx];
                        const metrics = activeMsg.metrics!;
                        
                        return (
                          <div className="space-y-4 text-xs select-text">
                            <div>
                              <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block mb-1">
                                Query Rewriting
                              </span>
                              <div className="p-3 bg-darkBg/50 border border-darkBorder/50 rounded-lg space-y-1.5">
                                <div>
                                  <p className="text-[9px] text-darkMuted font-bold uppercase tracking-wider">User Query</p>
                                  <p className="text-gray-300 italic">"{messages[selectedMessageIdx - 1]?.text || "Unknown"}"</p>
                                </div>
                                <div className="border-t border-darkBorder/20 my-1.5" />
                                <div>
                                  <p className="text-[9px] text-neonIndigo font-bold uppercase tracking-wider">Optimized Retrieval Query</p>
                                  <p className="text-gray-200 font-semibold italic">"{activeMsg.query_rewritten || "Original query used"}"</p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block mb-2">
                                Execution Latency
                              </span>
                              <div className="space-y-2 p-3 bg-darkBg/50 border border-darkBorder/50 rounded-lg">
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-200 border-b border-darkBorder/30 pb-1.5">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-neonTeal" /> Total Time
                                  </span>
                                  <span className="text-neonTeal">{metrics.total_time_ms} ms</span>
                                </div>
                                
                                <div className="space-y-2 pt-1">
                                  {[
                                    { label: "Query Rewrite", val: metrics.rewrite_time_ms, color: "bg-purple-500" },
                                    { label: "Embedding Gen", val: metrics.embedding_time_ms, color: "bg-blue-500" },
                                    { label: "Vector DB Search", val: metrics.db_time_ms, color: "bg-emerald-500" },
                                    { label: "Lexical Reranker", val: metrics.rerank_time_ms, color: "bg-yellow-500" },
                                    { label: "LLM Generation", val: metrics.generation_time_ms, color: "bg-pink-500" }
                                  ].map((item, i) => {
                                    const percentage = metrics.total_time_ms > 0 ? (item.val / metrics.total_time_ms) * 100 : 0;
                                    return (
                                      <div key={i} className="space-y-0.5">
                                        <div className="flex justify-between text-[10px] text-darkMuted">
                                          <span>{item.label}</span>
                                          <span>{item.val.toFixed(1)} ms</span>
                                        </div>
                                        <div className="w-full bg-darkBorder/30 h-1.5 rounded overflow-hidden">
                                          <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Source Chunks (Reranked) */}
                            {activeMsg.sources && activeMsg.sources.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center border-t border-darkBorder/20 pt-3 mt-3">
                                  <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider">
                                    Top Reranked Chunks
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowRetrievedChunks(!showRetrievedChunks)}
                                    className="text-[9px] font-bold uppercase tracking-wider text-neonTeal flex items-center gap-1 cursor-pointer"
                                  >
                                    {showRetrievedChunks ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    {showRetrievedChunks ? "Hide Chunks" : "Show Chunks"}
                                  </button>
                                </div>
                                
                                {showRetrievedChunks && (
                                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                    {activeMsg.sources.map((src, sIdx) => (
                                      <div key={sIdx} className="p-2.5 bg-darkBg/50 border border-darkBorder/50 rounded-lg space-y-1">
                                        <div className="flex justify-between items-center text-[10px] text-darkMuted">
                                          <span className="font-semibold text-gray-300 truncate max-w-[130px]">{src.filename}</span>
                                          <span className="text-neonTeal font-mono">{(src.score * 100).toFixed(1)}% match</span>
                                        </div>
                                        <p className="italic text-[10px] leading-normal bg-darkPanel/25 p-2 rounded border border-darkBorder/20 text-darkMuted select-text max-h-[60px] overflow-y-auto">
                                          "{src.chunk_text}"
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Aggregated System Metrics */}
                            {systemMetrics && (
                              <div className="space-y-2 border-t border-darkBorder/20 pt-3 mt-3">
                                <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block">
                                  System Pipeline Performance
                                </span>
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-darkBg/40 p-2.5 rounded-lg border border-darkBorder/30">
                                  <div>
                                    <span className="text-darkMuted block">Avg RAG Latency</span>
                                    <span className="text-neonTeal font-bold">{systemMetrics.avg_query_time_ms} ms</span>
                                  </div>
                                  <div>
                                    <span className="text-darkMuted block">RAG Cache Rate</span>
                                    <span className="text-neonIndigo font-bold">{systemMetrics.cache_hit_rate}%</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1 text-center text-darkMuted p-4 select-none">
                        <Sliders className="w-8 h-8 mb-2 stroke-1" />
                        <p className="text-xs font-semibold text-gray-400">Retrieval Diagnostics</p>
                        <p className="text-[10px] mt-1 max-w-[180px]">Select an assistant bubble message to view metrics.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 bg-darkPanel/20 border border-darkBorder rounded-xl space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
                    <Search className="w-4 h-4 text-neonTeal" />
                    Semantic Search Engine
                  </h2>
                  <p className="text-xs text-darkMuted mt-0.5">
                    Query document segments by semantic meaning using vectorized concept matching
                  </p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g., invoice payment details or document summary..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-darkBg/60 border border-darkBorder focus:border-neonTeal/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-darkMuted outline-none transition-all"
                    />
                    <Search className="w-4 h-4 text-darkMuted absolute left-3.5 top-3.5" />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-neonTeal hover:bg-neonTeal/90 border border-neonTeal/30 disabled:bg-sky-850 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    {searching ? "Searching..." : "Search"}
                  </button>
                </form>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {searching ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-neonTeal animate-spin" />
                      <p className="text-xs text-darkMuted">Searching database vectors...</p>
                    </div>
                  ) : searchError ? (
                    <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
                      {searchError}
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-3 animate-fadeIn">
                      {searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-darkBg/35 border border-darkBorder hover:border-neonTeal/40 rounded-xl space-y-2.5 transition-colors group relative"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-300">{result.filename}</span>
                              {isAdvancedMode && <span className="text-[10px] text-darkMuted">Chunk #{result.chunk_index}</span>}
                            </div>
                            <span className="font-semibold text-neonTeal">
                              {(result.similarity * 100).toFixed(1)}% match
                            </span>
                          </div>
                          <p className="text-xs text-darkMuted leading-relaxed italic bg-darkPanel/20 p-3 rounded-lg border border-darkBorder/50 font-sans group-hover:text-gray-200 transition-colors whitespace-pre-wrap select-text">
                            "{result.content}"
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : searched ? (
                    <div className="text-center py-12 border border-dashed border-darkBorder rounded-xl bg-darkPanel/10">
                      <HelpCircle className="w-8 h-8 text-darkMuted mx-auto mb-3 animate-pulse" />
                      <p className="text-gray-300 font-medium">No matches found</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <div className="text-sm text-darkMuted">Tab content coming soon...</div>;
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isAdvancedMode={isAdvancedMode}
      setIsAdvancedMode={setIsAdvancedMode}
      apiConnected={apiConnected}
      aiStatus={aiStatus}
      currentUser={currentUser}
      onLogout={handleLogout}
    >
      {/* Dynamic Module content area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1">
        
        {/* Left Drawer component visible under Document Assistant Tab */}
        {activeTab === "assistant" && sidebarOpen && (
          <div className="lg:col-span-1 space-y-6 animate-fadeIn">
            <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-200">Upload PDF Document</h2>
                <p className="text-xs text-darkMuted mt-0.5">Ingest files into pipeline database</p>
              </div>
              <FileUpload 
                onUploadSuccess={fetchDocuments}
                backendUrl="http://localhost:8000"
                isAdvancedMode={isAdvancedMode}
              />
            </div>

            <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4 max-h-[380px] overflow-y-auto">
              <h3 className="text-xs font-semibold text-darkMuted uppercase tracking-wider">
                Document Library ({documents.length})
              </h3>
              <DocumentList
                documents={documents}
                trashDocuments={trashDocuments}
                onSelectDocument={setSelectedDocId}
                onTrashDocument={handleTrashDocument}
                onRestoreDocument={handleRestoreDocument}
                onDeleteDocument={handleDeleteDocument}
                isLoading={loading}
                sidebarOpen={true}
                isCompact={true}
              />
            </div>
          </div>
        )}

        {/* Dynamic Center Dashboard Views */}
        <div className={`${activeTab === "assistant" && sidebarOpen ? "lg:col-span-3" : "lg:col-span-4"} space-y-6 flex flex-col`}>
          {renderTabContent()}
        </div>
      </div>

      {/* Slide preview drawer */}
      <DocumentViewer
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        backendUrl="http://localhost:8000"
      />
    </AppShell>
  );
}

export default App;
