import { useEffect, useState, useCallback, useRef } from "react";
import { FileUpload } from "./components/FileUpload";
import { DocumentList } from "./components/DocumentList";
import type { DocumentMetadata } from "./components/DocumentList";
import { DocumentViewer } from "./components/DocumentViewer";
import { Cpu, Server, Database, Sparkles, Search, Loader2, ArrowUpRight, HelpCircle, MessageSquare, BookOpen, Send, ChevronDown, ChevronUp, Clock, Activity, Zap, Sliders, Eye, EyeOff, Users } from "lucide-react";
import { Dashboard } from "./modules/invoice-automation/Dashboard";
import { WorkflowDashboard } from "./modules/workflow-engine/WorkflowDashboard";
import { CrmDashboard } from "./modules/crm-intelligence/CrmDashboard";
import { WorkerMonitor } from "./modules/background-worker/WorkerMonitor";

const BACKEND_URL = "http://localhost:8000";

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

type WorkspaceTab = "catalog" | "search" | "chat" | "finance" | "workflows" | "crm" | "worker";

interface SystemMetrics {
  documents_indexed: number;
  total_chunks: number;
  avg_query_time_ms: number;
  cache_hit_rate: number;
}

function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [trashDocuments, setTrashDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  
  // Connection status tracking
  const [apiConnected, setApiConnected] = useState<boolean>(true);
  
  // Workspace Tab State
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("catalog");

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

  // System Metrics
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  // AI Connection Status
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/documents?is_deleted=false`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents.");
      }
      const data = await response.json();
      setDocuments(data);

      const trashResponse = await fetch(`${BACKEND_URL}/documents?is_deleted=true`);
      if (trashResponse.ok) {
        const trashData = await trashResponse.json();
        setTrashDocuments(trashData);
      }
      setApiConnected(true);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      if (error.message === "Failed to fetch") {
        setApiConnected(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTrashDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to move this document to the Trash? It will remain in the trash for 30 days before being permanently deleted.")) {
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/documents/${id}/trash`, { method: "POST" });
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error trashing document:", error);
    }
  };

  const handleRestoreDocument = async (id: string) => {
    try {
      const response = await fetch(`${BACKEND_URL}/documents/${id}/restore`, { method: "POST" });
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error restoring document:", error);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this document? This will delete all text chunks, extractions, anomalies, and cannot be undone.")) {
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/documents/${id}`, { method: "DELETE" });
      if (response.ok) {
        fetchDocuments();
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const fetchAIStatus = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health/ai`);
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
    } catch (error: any) {
      console.error("Error fetching AI status:", error);
      setAiStatus({
        status: "disconnected",
        model: "Unknown",
        embedding_model: "Unknown",
        provider: "API Connection Failure",
        detail: "Could not reach the health endpoint."
      });
      if (error.message === "Failed to fetch") {
        setApiConnected(false);
      }
    }
  }, []);

  const fetchSystemMetrics = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/system-metrics`);
      if (response.ok) {
        const data = await response.json();
        setSystemMetrics(data);
        setApiConnected(true);
      }
    } catch (error: any) {
      console.error("Error fetching system metrics:", error);
      if (error.message === "Failed to fetch") {
        setApiConnected(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchAIStatus();
    fetchSystemMetrics();
  }, [fetchDocuments, fetchAIStatus, fetchSystemMetrics]);

  // Scroll to bottom of chat
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
      const res = await fetch(`${BACKEND_URL}/search?query=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error("Semantic query request failed.");
      }
      const data = await res.json();
      setSearchResults(data);
    } catch (err: any) {
      setSearchError(err.message || "An error occurred during search.");
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
      const res = await fetch(`${BACKEND_URL}/chat-with-documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage })
      });

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
      // Auto-select the newly arrived message for debugging view
      setSelectedMessageIdx(messages.length + 1);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        sender: "assistant",
        text: `Error: ${err.message || "Something went wrong while retrieving documents."}`
      }]);
    } finally {
      setChatting(false);
      fetchSystemMetrics();
    }
  };

  const selectSuggestion = (queryText: string) => {
    setChatInput(queryText);
  };

  return (
    <div className="min-h-screen pb-16 flex flex-col">
      {/* Navbar / Header */}
      <header className="border-b border-darkBorder bg-darkPanel/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-neonTeal/10 flex items-center justify-center text-neonTeal border border-neonTeal/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-gray-200 tracking-wider flex items-center gap-1.5 text-base uppercase">
                Syntra OS
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-neonIndigo/20 text-neonIndigo border border-neonIndigo/30 tracking-normal font-medium">
                  Enterprise
                </span>
              </h1>
              <p className="text-[9px] font-mono text-darkMuted uppercase tracking-wider mt-0.5">AI-Powered Operations Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            {apiConnected && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-darkBorder/30 hover:bg-neonTeal/20 text-gray-300 hover:text-neonTeal border border-darkBorder/60 transition-all cursor-pointer mr-1"
                title={sidebarOpen ? "Collapse sidebar control panel" : "Expand sidebar control panel"}
              >
                <Sliders className="w-3 h-3" />
                <span>{sidebarOpen ? "Hide Panel" : "Show Panel"}</span>
              </button>
            )}

            <div className={`flex items-center gap-1.5 font-medium ${apiConnected ? "text-emerald-400" : "text-rose-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${apiConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500 animate-pulse"}`} />
              {apiConnected ? "API Connected" : "API Offline"}
            </div>
            {apiConnected && aiStatus && (
              <div className={`flex items-center gap-1.5 font-medium px-2 py-0.5 rounded border ${
                aiStatus.status === "connected"
                  ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                  : aiStatus.status === "mock"
                  ? "text-amber-400 border-amber-500/20 bg-amber-500/5"
                  : "text-rose-400 border-rose-500/20 bg-rose-500/5"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  aiStatus.status === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : aiStatus.status === "mock"
                    ? "bg-amber-400"
                    : "bg-rose-400"
                }`} />
                AI: {aiStatus.provider}
              </div>
            )}
          </div>
        </div>
      </header>

      {!apiConnected ? (
        <div className="max-w-4xl mx-auto px-6 mt-16 w-full flex-1 flex flex-col items-center justify-center animate-fadeIn text-center space-y-6">
          <div className="p-8 border border-rose-500/25 bg-darkPanel/20 rounded-none max-w-xl space-y-5 relative shadow-lg shadow-rose-950/5">
            {/* Corner Indicators */}
            <span className="absolute -top-2 -left-1 font-mono font-extrabold text-[10px] text-rose-500 select-none">+</span>
            <span className="absolute -top-2 -right-1 font-mono font-extrabold text-[10px] text-rose-500 select-none">+</span>
            <span className="absolute -bottom-2 -left-1 font-mono font-extrabold text-[10px] text-rose-500 select-none">+</span>
            <span className="absolute -bottom-2 -right-1 font-mono font-extrabold text-[10px] text-rose-500 select-none">+</span>
            
            <div className="w-12 h-12 mx-auto rounded border border-rose-500/20 bg-rose-500/10 flex items-center justify-center text-rose-400">
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
                The operations node at <code className="text-gray-300 font-mono bg-darkBg/60 px-1 py-0.5 border border-darkBorder/45 rounded">{BACKEND_URL}</code> is unreachable. Vector storage retrieval, semantic chunking pipelines, and LLM automation services are suspended until contact is restored.
              </p>
            </div>

            <button
              onClick={() => {
                setLoading(true);
                fetchDocuments();
                fetchAIStatus();
                fetchSystemMetrics();
              }}
              className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-rose-950 hover:bg-rose-900 border border-rose-700/40 rounded-none transition-all cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <Clock className="w-3.5 h-3.5" />
              Reconnect Mainframe
            </button>
          </div>
        </div>
      ) : (
        /* Main Grid Content */
        <main className="max-w-7xl w-full mx-auto px-6 mt-8 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Side: Upload & System Stats */}
        {sidebarOpen ? (
          <div className="space-y-6 lg:col-span-1 animate-fadeIn">
            <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-200">Upload PDF Document</h2>
                <p className="text-xs text-darkMuted mt-0.5">Ingest files into the pipeline database</p>
              </div>
              
              <FileUpload 
                onUploadSuccess={fetchDocuments}
                backendUrl={BACKEND_URL}
              />
            </div>

            {/* System status details */}
            <div className="p-6 bg-darkPanel/30 border border-darkBorder rounded-xl space-y-4">
              <h3 className="text-xs font-semibold text-darkMuted uppercase tracking-wider">
                Pipeline Integration
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonTeal">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 font-medium">API Endpoint</p>
                    <p className="text-[10px] text-darkMuted">FastAPI running on localhost:8000</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonIndigo">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 font-medium">PostgreSQL Database</p>
                    <p className="text-[10px] text-darkMuted">DB: doc_ingest | Port: 5433</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-yellow-400">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 font-medium">Vector Store Setup</p>
                    <p className="text-[10px] text-darkMuted">pgvector active (HNSW indexed)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center ${
                    !aiStatus
                      ? "text-gray-400"
                      : aiStatus.status === "connected"
                      ? "text-emerald-400"
                      : aiStatus.status === "mock"
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 font-medium">AI Model Engine</p>
                    <div className="text-[10px] text-darkMuted leading-tight">
                      {aiStatus ? (
                        <>
                          <span className="font-semibold">{aiStatus.provider}</span>
                          <span className="block text-[9px] text-gray-400 mt-0.5">Chat: {aiStatus.model}</span>
                          <span className="block text-[9px] text-gray-400">Embeddings: {aiStatus.embedding_model}</span>
                          <span className="block text-[9px] text-darkMuted mt-0.5">{aiStatus.detail}</span>
                        </>
                      ) : (
                        "Checking status..."
                      )}
                    </div>
                  </div>
                </div>

                {systemMetrics && (
                  <>
                    <div className="border-t border-darkBorder/30 my-2 pt-2" />
                    
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonTeal">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-300 font-medium">Avg RAG Latency</p>
                        <p className="text-[10px] text-darkMuted">{systemMetrics.avg_query_time_ms} ms</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-darkBorder/40 flex items-center justify-center text-neonIndigo">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-300 font-medium">RAG Cache Hit Rate</p>
                        <p className="text-[10px] text-darkMuted">{systemMetrics.cache_hit_rate}%</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Right Side: Tabbed workspaces */}
        <div className={`${sidebarOpen ? "lg:col-span-3" : "lg:col-span-4"} space-y-6 flex flex-col transition-all duration-300`}>
          {/* Tab Selector Buttons */}
          <div className="flex flex-wrap gap-2 border-b border-darkBorder/60 pb-3">
            {[
              { id: "catalog", label: "Library Catalog", num: "01", activeColor: "border-neonTeal text-neonTeal bg-neonTeal/5", icon: BookOpen },
              { id: "chat", label: "RAG Chat Assistant", num: "02", activeColor: "border-neonIndigo text-neonIndigo bg-neonIndigo/5", icon: MessageSquare },
              { id: "search", label: "Semantic Search", num: "03", activeColor: "border-yellow-500 text-yellow-500 bg-yellow-500/5", icon: Search },
              { id: "finance", label: "Finance Operations", num: "04", activeColor: "border-neonTeal text-neonTeal bg-neonTeal/5", icon: Activity },
              { id: "workflows", label: "Agent Workflows", num: "05", activeColor: "border-neonIndigo text-neonIndigo bg-neonIndigo/5", icon: Cpu },
              { id: "crm", label: "CRM & Sales Intel", num: "06", activeColor: "border-neonIndigo text-neonIndigo bg-neonIndigo/5", icon: Users },
              { id: "worker", label: "Worker Queue", num: "07", activeColor: "border-neonTeal text-neonTeal bg-neonTeal/5", icon: Server }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as WorkspaceTab)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer rounded-none ${
                    isActive
                      ? `${tab.activeColor} border-current`
                      : "border-darkBorder bg-darkPanel/10 text-darkMuted hover:text-gray-300 hover:border-darkBorder/100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span className="text-[8px] opacity-40 ml-1">[{tab.num}]</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab View Panels */}
          <div className="flex-1">
            {activeTab === "catalog" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-200">Ingested Library</h2>
                    <p className="text-xs text-darkMuted mt-0.5">
                      Browse metadata and preview extracted text segments
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-darkBorder/40 text-gray-300">
                    {documents.length} {documents.length === 1 ? "document" : "documents"}
                  </span>
                </div>

                <DocumentList
                  documents={documents}
                  trashDocuments={trashDocuments}
                  onSelectDocument={setSelectedDocId}
                  onTrashDocument={handleTrashDocument}
                  onRestoreDocument={handleRestoreDocument}
                  onDeleteDocument={handleDeleteDocument}
                  isLoading={loading}
                  sidebarOpen={sidebarOpen}
                />
              </div>
            )}

            {activeTab === "chat" && (
              <div className={`grid grid-cols-1 ${sidebarOpen ? "xl:grid-cols-3 h-auto xl:h-[600px]" : "lg:grid-cols-3 h-auto lg:h-[600px]"} gap-6 animate-fadeIn`}>
                {/* Left side: RAG Chat pane */}
                <div className={`${sidebarOpen ? "xl:col-span-2 h-[550px] xl:h-full" : "lg:col-span-2 h-[550px] lg:h-full"} bg-darkPanel/20 border border-darkBorder rounded-xl p-5 flex flex-col justify-between space-y-4`}>
                  {/* Chat Message Stream */}
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

                        {/* Display ground sources / citations for assistant answers */}
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
                                      <span className="text-[10px] text-neonTeal">{(src.score * 100).toFixed(1)}% similarity</span>
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

                    {/* Thinking Loader */}
                    {chatting && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-darkPanel border border-darkBorder/80 max-w-[200px] text-xs text-darkMuted mr-auto">
                        <Loader2 className="w-3.5 h-3.5 text-neonIndigo animate-spin" />
                        Retrieving context...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Suggestion Prompt Chips */}
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

                  {/* Chat Input Field Form */}
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

                {/* Right side: Retrieval & Latency Debugger Panel */}
                <div className={`${sidebarOpen ? "xl:col-span-1 h-[450px] xl:h-full" : "lg:col-span-1 h-[450px] lg:h-full"} bg-darkPanel/35 border border-darkBorder rounded-xl p-5 flex flex-col space-y-4 overflow-y-auto`}>
                  <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neonIndigo uppercase tracking-wider">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>RAG Diagnostics</span>
                    </div>
                    {selectedMessageIdx !== null && messages[selectedMessageIdx]?.metrics?.cache_hit && (
                      <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                        <Zap className="w-2.5 h-2.5" /> Cache Hit
                      </span>
                    )}
                  </div>

                  {selectedMessageIdx !== null && messages[selectedMessageIdx]?.sender === "assistant" && messages[selectedMessageIdx]?.metrics ? (
                    (() => {
                      const activeMsg = messages[selectedMessageIdx];
                      const metrics = activeMsg.metrics!;
                      
                      return (
                        <div className="space-y-4 text-xs select-text">
                          {/* Query Rewriting */}
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

                          {/* Latency Metrics */}
                          <div>
                            <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block mb-2">
                              Execution Latency
                            </span>
                            <div className="space-y-2 p-3 bg-darkBg/50 border border-darkBorder/50 rounded-lg">
                              {/* Total Latency header */}
                              <div className="flex justify-between items-center text-xs font-semibold text-gray-200 border-b border-darkBorder/30 pb-1.5">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-neonTeal" /> Total Time
                                </span>
                                <span className="text-neonTeal">{metrics.total_time_ms} ms</span>
                              </div>
                              
                              {/* Breakdown Progress Bars */}
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
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider">
                                  Top Reranked Chunks
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowRetrievedChunks(!showRetrievedChunks)}
                                  className="text-[9px] font-bold uppercase tracking-wider text-neonTeal flex items-center gap-0.5 cursor-pointer"
                                >
                                  {showRetrievedChunks ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
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
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center flex-1 text-center text-darkMuted p-4 select-none">
                      <Sliders className="w-8 h-8 mb-2 stroke-1" />
                      <p className="text-xs font-semibold text-gray-400">Retrieval Diagnostics</p>
                      <p className="text-[10px] mt-1 max-w-[180px]">Select an assistant bubble message to view latency and search metrics.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "search" && (
              <div className="p-6 bg-darkPanel/20 border border-darkBorder rounded-xl space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-base font-semibold text-gray-200 flex items-center gap-2">
                    <Search className="w-4 h-4 text-yellow-500" />
                    Semantic Search Engine
                  </h2>
                  <p className="text-xs text-darkMuted mt-0.5">
                    Query document segments by semantic meaning (powered by high-dimensional embeddings)
                  </p>
                </div>

                {/* Search Input Bar */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="e.g., invoice payment details or document summary..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-darkBg/60 border border-darkBorder focus:border-yellow-500/80 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder:text-darkMuted outline-none transition-all"
                    />
                    <Search className="w-4 h-4 text-darkMuted absolute left-3.5 top-3.5" />
                  </div>
                  <button
                    type="submit"
                    disabled={searching}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-yellow-650 hover:bg-yellow-600 border border-yellow-500/30 disabled:bg-yellow-800 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5" />
                        Search
                      </>
                    )}
                  </button>
                </form>

                {/* Search Result Snippets */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {searching ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
                      <p className="text-xs text-darkMuted">Generating query embedding and querying pgvector indexes...</p>
                    </div>
                  ) : searchError ? (
                    <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
                      {searchError}
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-darkMuted uppercase tracking-wider block">
                        Top Semantic Matches
                      </span>
                      
                      {searchResults.map((result, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-darkBg/30 border border-darkBorder hover:border-yellow-500/40 rounded-xl space-y-2.5 transition-colors group relative"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-300">{result.filename}</span>
                              <span className="text-[10px] text-darkMuted">Chunk #{result.chunk_index}</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-neonTeal">
                                {(result.similarity * 100).toFixed(1)}% match
                              </span>
                              
                              <button
                                onClick={() => setSelectedDocId(result.document_id)}
                                className="p-1 rounded bg-darkBorder/60 hover:bg-yellow-500 hover:text-darkBg text-gray-400 transition-colors"
                                title="Open document workspace"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                      <p className="text-xs text-darkMuted mt-1">Make sure you have indexed your ingested documents first.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            {activeTab === "finance" && (
              <Dashboard backendUrl={BACKEND_URL} />
            )}
            {activeTab === "workflows" && (
              <WorkflowDashboard backendUrl={BACKEND_URL} />
            )}
            {activeTab === "crm" && (
              <CrmDashboard backendUrl={BACKEND_URL} />
            )}
            {activeTab === "worker" && (
              <WorkerMonitor />
            )}
          </div>
        </div>
      </main>
      )}

      {/* Side preview Drawer */}
      <DocumentViewer
        documentId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        backendUrl={BACKEND_URL}
      />
    </div>
  );
}

export default App;
