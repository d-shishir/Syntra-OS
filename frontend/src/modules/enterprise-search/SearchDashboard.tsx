import React, { useState, useEffect, useRef } from "react";
import { Search, Filter, Cpu, Database, RefreshCw, BarChart2, ShieldAlert, FileText, CheckCircle2, AlertCircle, Sparkles, Clock, Globe, User, Server } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description: string;
  score: number;
  metadata: any;
  sources: string[];
}

interface SearchAnalytics {
  total_queries: number;
  average_latency_ms: number;
  success_rate: number;
  failed_queries_count: number;
  popular_queries: Array<{ query: string; count: number }>;
  sync_indexes: {
    documents_indexed: number;
    invoices_indexed: number;
    leads_indexed: number;
    workflows_indexed: number;
    approvals_indexed: number;
    last_sync_timestamp: string;
  };
}

export function SearchDashboard() {
  const [query, setQuery] = useState<string>("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [latency, setLatency] = useState<number>(0);
  const [searching, setSearching] = useState<boolean>(false);
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  
  // Advanced filters
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load analytics & recent searches
  const loadStats = async () => {
    try {
      const analRes = await fetch(`${BACKEND_URL}/api/v1/search/analytics`);
      if (analRes.ok) {
        const analData = await analRes.json();
        setAnalytics(analData);
      }

      const recentRes = await fetch(`${BACKEND_URL}/api/v1/search/recent`);
      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentQueries(recentData || []);
      }
    } catch (err) {
      console.error("Failed to load search statistics:", err);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Close dropdown on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle autocomplete suggestion prefix fetching
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/search/suggestions?prefix=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data || []);
        }
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchSuggestions();
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Execute Search
  const handleSearch = async (searchPhrase: string) => {
    if (!searchPhrase || !searchPhrase.trim()) return;
    setQuery(searchPhrase);
    setShowSuggestions(false);
    setSearching(true);
    setAiAnswer("");
    setResults([]);

    try {
      // Get auth token from local storage
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`${BACKEND_URL}/api/v1/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query: searchPhrase })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAiAnswer(data.answer || "");
        setLatency(data.metrics?.latency_ms || 0);
        
        // Reload analytics
        loadStats();
      }
    } catch (err) {
      console.error("Unified search failure:", err);
    } finally {
      setSearching(false);
    }
  };

  // Run advanced search with explicit filters
  const handleAdvancedSearch = async () => {
    setSearching(true);
    try {
      const token = localStorage.getItem("token") || "";
      const filters: any = {};
      if (selectedType) filters["type"] = selectedType;
      if (selectedStatus) filters["status"] = selectedStatus;

      const res = await fetch(`${BACKEND_URL}/api/v1/search/advanced`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          query: query,
          filters: filters
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setAiAnswer(data.answer || "");
        setLatency(data.metrics?.latency_ms || 0);
      }
    } catch (err) {
      console.error("Advanced search failure:", err);
    } finally {
      setSearching(false);
    }
  };

  // Result card icon selector
  const getResultIcon = (type: string) => {
    switch (type) {
      case "document": return <FileText className="w-4 h-4 text-neonTeal" />;
      case "invoice": return <Cpu className="w-4 h-4 text-amber-400" />;
      case "workflow": return <Server className="w-4 h-4 text-cyan-400" />;
      case "approval": return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case "lead": return <User className="w-4 h-4 text-emerald-400" />;
      default: return <Globe className="w-4 h-4 text-gray-400" />;
    }
  };

  // Result card color border mapping
  const getBorderColor = (type: string) => {
    switch (type) {
      case "document": return "border-l-4 border-l-neonTeal";
      case "invoice": return "border-l-4 border-l-amber-500";
      case "workflow": return "border-l-4 border-l-cyan-500";
      case "approval": return "border-l-4 border-l-rose-500";
      case "lead": return "border-l-4 border-l-emerald-500";
      default: return "border-l-4 border-l-gray-500";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn select-text">
      
      {/* Search Header Banner */}
      <div className="text-center py-6 space-y-2">
        <h2 className="text-2xl font-extrabold text-gray-200 tracking-wider flex items-center justify-center gap-2 uppercase">
          <Search className="w-6 h-6 text-neonIndigo" />
          Enterprise Search Hub
        </h2>
        <p className="text-xs text-darkMuted max-w-lg mx-auto">
          Intelligent hybrid search indexing all documents, transaction invoices, active workflows, approvals, and CRM lead directories.
        </p>
      </div>

      {/* Main Global Search Panel */}
      <div className="max-w-2xl mx-auto relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-darkMuted absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search people, invoices, leads, status, or anomalies..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch(query);
                }
              }}
              className="w-full pl-12 pr-4 py-3 bg-darkPanel/40 border border-darkBorder hover:border-darkBorder/100 rounded-xl text-sm text-gray-200 placeholder-darkMuted focus:outline-none focus:border-neonIndigo shadow-lg shadow-black/10"
            />
          </div>
          <button
            onClick={() => handleSearch(query)}
            className="px-6 bg-neonIndigo text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider hover:bg-neonIndigo/80 cursor-pointer shadow-lg shadow-neonIndigo/10"
          >
            Search
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 border rounded-xl cursor-pointer transition-all ${
              showFilters 
                ? "border-neonTeal bg-neonTeal/10 text-neonTeal" 
                : "border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-300"
            }`}
            title="Toggle advanced search filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Autocomplete Dropdown suggestions list */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-14 bg-darkPanel border border-darkBorder rounded-xl shadow-xl z-30 overflow-hidden text-xs">
            {suggestions.map((sug, idx) => (
              <div
                key={idx}
                onClick={() => handleSearch(sug)}
                className="px-4 py-3 hover:bg-darkBg/60 text-gray-300 cursor-pointer border-b border-darkBorder/20 last:border-b-0 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-neonIndigo" />
                <span>{sug}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suggested & Recent Search Query Chips */}
      <div className="flex flex-wrap gap-2 justify-center text-[10px] font-mono uppercase tracking-wider text-darkMuted">
        <span>Suggested:</span>
        {[
          "payroll anomalies",
          "invoices approved by Sarah",
          "workflows related to Acme Corp",
          "CRM leads from Nepal"
        ].map(chip => (
          <button
            key={chip}
            onClick={() => handleSearch(chip)}
            className="px-2 py-0.5 bg-darkBg/40 border border-darkBorder/60 text-darkMuted hover:text-white rounded transition-colors cursor-pointer"
          >
            "{chip}"
          </button>
        ))}
      </div>

      {/* Advanced Filters Drawer Panel */}
      {showFilters && (
        <div className="max-w-2xl mx-auto bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4 animate-slideDown">
          <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-neonTeal" />
              Advanced Filters
            </h3>
            <button
              onClick={() => {
                setSelectedType("");
                setSelectedStatus("");
                setResults([]);
              }}
              className="text-[10px] font-mono text-darkMuted hover:text-rose-400"
            >
              Clear Filters
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-darkMuted">Entity / Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-darkBg/60 border border-darkBorder text-xs text-gray-300 p-2 rounded-lg focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="document">Documents</option>
                <option value="invoice">Invoices</option>
                <option value="workflow">Workflows</option>
                <option value="approval">Approvals</option>
                <option value="lead">CRM Leads</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-darkMuted">Status Code</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-darkBg/60 border border-darkBorder text-xs text-gray-300 p-2 rounded-lg focus:outline-none"
              >
                <option value="">Any Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed / Success</option>
                <option value="failed">Failed / Rejected</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAdvancedSearch}
            className="w-full py-2 bg-neonTeal/15 hover:bg-neonTeal/25 border border-neonTeal/30 text-neonTeal text-xs font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all"
          >
            Apply Advanced Search Constraints
          </button>
        </div>
      )}

      {/* Main Results Section */}
      {(searching || results.length > 0 || aiAnswer) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          
          {/* Left/Center: AI Answer and Result items lists */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* AI Synthesized Answer Box */}
            {aiAnswer && (
              <div className="bg-darkPanel/25 border border-darkBorder rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-neonIndigo/5 rounded-full blur-2xl" />
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo border border-neonIndigo/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-200">AI Search Answer</h3>
                </div>
                <div className="text-xs text-gray-300 leading-relaxed font-sans select-text whitespace-pre-line border-t border-darkBorder/40 pt-3">
                  {aiAnswer}
                </div>
              </div>
            )}

            {/* Results list count indicator */}
            {results.length > 0 && (
              <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-darkMuted px-2">
                <span>Ranked Search Results ({results.length})</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  latency: {latency} ms
                </span>
              </div>
            )}

            {/* Search list items cards */}
            <div className="space-y-4">
              {searching ? (
                <div className="flex flex-col items-center justify-center h-48 text-darkMuted space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-neonIndigo" />
                  <span className="text-xs font-mono">Aggregating keyword, vector, and graph search results...</span>
                </div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={idx}
                    className={`bg-darkPanel/20 border border-darkBorder hover:border-darkBorder/100 p-4 rounded-xl flex items-start gap-4 transition-all ${getBorderColor(item.type)}`}
                  >
                    <div className="p-2.5 bg-darkBg/60 border border-darkBorder/50 rounded-lg">
                      {getResultIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-200 truncate">{item.title}</span>
                        <div className="flex items-center gap-2">
                          {item.sources.map(src => (
                            <span key={src} className="text-[8px] font-mono px-1 rounded bg-darkBg/60 text-darkMuted">
                              {src}
                            </span>
                          ))}
                          <span className="text-[10px] font-mono font-bold text-neonIndigo">
                            {(item.score * 100).toFixed(0)}% score
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed font-sans">{item.description}</p>
                      
                      {/* Optional metadata tags rendering */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 text-[9px] font-mono text-darkMuted">
                          {Object.entries(item.metadata).map(([k, v]) => (
                            <span key={k} className="bg-darkBg/30 px-1.5 py-0.5 rounded border border-darkBorder/40">
                              {k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {results.length === 0 && !searching && (
                <div className="flex flex-col items-center justify-center h-48 border border-darkBorder/40 bg-darkPanel/5 rounded-xl text-darkMuted text-xs gap-1.5">
                  <AlertCircle className="w-6 h-6 text-darkBorder" />
                  <span>No matching results found for search query.</span>
                </div>
              )}
            </div>

          </div>

          {/* Right side: Search Analytics dashboard */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Search performance telemetry */}
            <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                <BarChart2 className="w-4 h-4 text-neonIndigo" />
                Search Performance
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-darkBg/40 border border-darkBorder/40 p-2.5 rounded-lg">
                  <span className="text-[9px] font-mono uppercase text-darkMuted block">Avg Latency</span>
                  <span className="text-sm font-extrabold text-neonTeal font-mono">{analytics?.average_latency_ms || 0} ms</span>
                </div>
                <div className="bg-darkBg/40 border border-darkBorder/40 p-2.5 rounded-lg">
                  <span className="text-[9px] font-mono uppercase text-darkMuted block">Success Rate</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">{analytics?.success_rate || 100}%</span>
                </div>
              </div>

              {/* Popular queries tracker */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-darkMuted block">Top Queries</span>
                {analytics?.popular_queries?.map((pop, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-darkBg/20 border border-darkBorder/20 p-2 rounded text-xs">
                    <span className="text-gray-300 truncate max-w-[120px] font-medium font-sans">"{pop.query}"</span>
                    <span className="font-mono text-darkMuted text-[10px]">{pop.count} searches</span>
                  </div>
                ))}
                {(!analytics?.popular_queries || analytics.popular_queries.length === 0) && (
                  <span className="text-darkMuted italic text-xs block text-center py-2">No queries logged.</span>
                )}
              </div>
            </div>

            {/* Event index sync status */}
            <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 border-b border-darkBorder/40 pb-2">
                <RefreshCw className="w-4 h-4 text-neonTeal" />
                Index Sync Status
              </h3>
              {analytics?.sync_indexes && (
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-darkMuted">Documents:</span>
                    <span className="text-gray-200">{analytics.sync_indexes.documents_indexed} synced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-darkMuted">Invoices:</span>
                    <span className="text-gray-200">{analytics.sync_indexes.invoices_indexed} synced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-darkMuted">CRM Leads:</span>
                    <span className="text-gray-200">{analytics.sync_indexes.leads_indexed} synced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-darkMuted">Workflows:</span>
                    <span className="text-gray-200">{analytics.sync_indexes.workflows_indexed} synced</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-darkMuted">Approvals:</span>
                    <span className="text-gray-200">{analytics.sync_indexes.approvals_indexed} synced</span>
                  </div>
                  <div className="border-t border-darkBorder/30 pt-2 flex justify-between text-[9px]">
                    <span className="text-darkMuted">Last Index Sync:</span>
                    <span className="text-neonTeal">{analytics.sync_indexes.last_sync_timestamp ? "Active (Live)" : "Standby"}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
