import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Network, Search, Filter, Cpu, RefreshCw, Share2, AlertTriangle, BarChart2, ShieldAlert, Layers, Database, Play, HelpCircle } from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface GraphNode {
  id: string;
  entity_type: string;
  name: string;
  properties: any;
  created_at: string;
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: string;
  properties: any;
  created_at: string;
}

interface GraphAnalytics {
  node_count: number;
  edge_count: number;
  degree_centrality: Array<{ id: string; name: string; entity_type: string; degree: number }>;
  workflow_bottlenecks: Array<{ name: string; entity_type: string; status: string; degree: number }>;
  involved_departments: Array<{ name: string; degree: number }>;
}

export function GraphDashboard() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [analytics, setAnalytics] = useState<GraphAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [nodeDetails, setNodeDetails] = useState<any>(null);
  const [impactAnalysisResult, setImpactAnalysisResult] = useState<any>(null);
  const [analyzingImpact, setAnalyzingImpact] = useState<boolean>(false);
  
  // Force-simulation refs — positions are mutated in-place for perf, not stored in React state
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<{
    positions: Record<string, { x: number; y: number; vx: number; vy: number; pinned?: boolean }>;
    raf: number;
    width: number;
    height: number;
  }>({
    positions: {},
    raf: 0,
    width: 600,
    height: 420,
  });
  // Force a re-render when we want React to sync to sim state (e.g. on node click)
  const [simTick, setSimTick] = useState(0);
  const selectedNodeRef = useRef<GraphNode | null>(null);

  // Track SVG container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      simRef.current.width = width || 600;
      simRef.current.height = height || 420;
      if (svgRef.current) {
        svgRef.current.setAttribute("viewBox", `0 0 ${simRef.current.width} ${simRef.current.height}`);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Force Simulation ───────────────────────────────────────
  // Declared FIRST so fetchData can reference it in its dependency array
  const startForceSimulation = useCallback((nodeList: GraphNode[], edgeList: GraphEdge[]) => {
    cancelAnimationFrame(simRef.current.raf);

    const { width, height } = simRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const count = nodeList.length;

    // Seed initial positions in a jittered circle (preserve existing positions)
    nodeList.forEach((node, index) => {
      if (!simRef.current.positions[node.id]) {
        const angle = (index / (count || 1)) * 2 * Math.PI;
        const r = Math.min(width, height) * 0.3 + (Math.random() - 0.5) * 50;
        simRef.current.positions[node.id] = {
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
          vx: 0, vy: 0,
        };
      }
    });

    const REPULSION  = 3200;
    const SPRING_K   = 0.04;
    const REST_LEN   = 120;
    const GRAVITY    = 0.012;
    const DAMPING    = 0.82;
    const MAX_ITER   = 300;
    let tick = 0;

    const step = () => {
      const pos = simRef.current.positions;
      const nodeIds = nodeList.map(n => n.id);

      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const a = pos[nodeIds[i]];
          const b = pos[nodeIds[j]];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }

      edgeList.forEach(edge => {
        const a = pos[edge.source_id];
        const b = pos[edge.target_id];
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const stretch = dist - REST_LEN;
        const fx = (dx / dist) * stretch * SPRING_K;
        const fy = (dy / dist) * stretch * SPRING_K;
        if (!a.pinned) { a.vx += fx; a.vy += fy; }
        if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
      });

      nodeIds.forEach(id => {
        const p = pos[id];
        if (!p || p.pinned) return;
        p.vx += (cx - p.x) * GRAVITY;
        p.vy += (cy - p.y) * GRAVITY;
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(20, Math.min(width - 20, p.x));
        p.y = Math.max(20, Math.min(height - 20, p.y));
      });

      if (svgRef.current) {
        nodeIds.forEach(id => {
          const p = pos[id];
          if (!p) return;
          const nodeG = svgRef.current!.querySelector(`[data-node-id="${id}"]`) as SVGGElement | null;
          if (nodeG) nodeG.setAttribute("transform", `translate(${p.x},${p.y})`);
        });
        edgeList.forEach(edge => {
          const a = pos[edge.source_id];
          const b = pos[edge.target_id];
          const lineEl = svgRef.current!.querySelector(`[data-edge-id="${edge.id}"]`) as SVGLineElement | null;
          if (lineEl && a && b) {
            lineEl.setAttribute("x1", String(a.x));
            lineEl.setAttribute("y1", String(a.y));
            lineEl.setAttribute("x2", String(b.x));
            lineEl.setAttribute("y2", String(b.y));
          }
          const lblEl = svgRef.current!.querySelector(`[data-edge-lbl="${edge.id}"]`) as SVGTextElement | null;
          if (lblEl && a && b) {
            lblEl.setAttribute("x", String((a.x + b.x) / 2));
            lblEl.setAttribute("y", String((a.y + b.y) / 2 - 4));
          }
        });
      }

      tick++;
      if (tick < MAX_ITER) simRef.current.raf = requestAnimationFrame(step);
    };

    simRef.current.raf = requestAnimationFrame(step);
  }, []);

  // Fetch Graph Data & Analytics
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const visRes = await fetch(`${BACKEND_URL}/api/v1/graph/visualization`);
      if (visRes.ok) {
        const visData = await visRes.json();
        const nodeList: GraphNode[] = visData.nodes || [];
        const edgeList: GraphEdge[] = visData.edges || [];
        setNodes(nodeList);
        setEdges(edgeList);
        simRef.current.positions = {};
        startForceSimulation(nodeList, edgeList);
      }

      const analRes = await fetch(`${BACKEND_URL}/api/v1/graph/analytics`);
      if (analRes.ok) setAnalytics(await analRes.json());
    } catch (error) {
      console.error("Error loading Knowledge Graph:", error);
    } finally {
      setLoading(false);
    }
  }, [startForceSimulation]);

  useEffect(() => {
    fetchData();
    return () => cancelAnimationFrame(simRef.current.raf);
  }, [fetchData]);

  // Seeding initial demo relationships if graph is empty
  const handleSeedGraph = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/graph/seed`, { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to seed knowledge graph:", error);
    } finally {
      setSeeding(false);
    }
  };

  // Select Node and fetch adjacent relations details
  const handleSelectNode = async (node: GraphNode) => {
    setSelectedNode(node);
    selectedNodeRef.current = node;
    setImpactAnalysisResult(null);
    setSimTick(t => t + 1); // trigger React re-render for inspector panel
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/graph/entity/${node.id}`);
      if (res.ok) setNodeDetails(await res.json());
    } catch (error) {
      console.error("Error fetching node detail:", error);
    }
  };

  // Run downstream blast radius simulation
  const handleRunImpactAnalysis = async () => {
    if (!selectedNode) return;
    setAnalyzingImpact(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/graph/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: `impact analysis of ${selectedNode.name}` })
      });
      if (res.ok) {
        const resultData = await res.json();
        if (resultData.type === "impact_analysis") {
          setImpactAnalysisResult(resultData.data);
        }
      }
    } catch (error) {
      console.error("Error executing impact analysis:", error);
    } finally {
      setAnalyzingImpact(false);
    }
  };

  // Expand node: fetch 2-degrees neighboring relations and log to console
  const handleExpandNode = async () => {
    if (!selectedNode) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/graph/relationships/${selectedNode.id}`);
      if (res.ok) {
        const result = await res.json();
        // Add new nodes/edges to display sets
        const existingNodeIds = new Set(nodes.map(n => n.id));
        const newNodes = [...nodes];

        (result.nodes || []).forEach((n: GraphNode) => {
          if (!existingNodeIds.has(n.id)) {
            newNodes.push(n);
          }
        });

        setNodes(newNodes);

        const existingEdgeIds = new Set(edges.map(e => e.id));
        const newEdges = [...edges];
        (result.edges || []).forEach((e: GraphEdge) => {
          if (!existingEdgeIds.has(e.id)) {
            newEdges.push(e);
          }
        });
        setEdges(newEdges);
        startForceSimulation(newNodes, [...edges, ...newEdges]);
      }
    } catch (err) {
      console.error("Error expanding node connections:", err);
    }
  };

  // Filtering nodes list
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            node.entity_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === "all" || node.entity_type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, selectedType]);

  // Color mapping based on node entity types
  const getNodeColor = (type: string) => {
    switch (type) {
      case "person": return { fill: "#10b981", stroke: "#047857", bg: "bg-emerald-500/10 text-emerald-400" }; // emerald
      case "company": return { fill: "#6366f1", stroke: "#4f46e5", bg: "bg-indigo-500/10 text-indigo-400" }; // indigo
      case "invoice": return { fill: "#f59e0b", stroke: "#d97706", bg: "bg-amber-500/10 text-amber-400" }; // amber
      case "workflow": return { fill: "#06b6d4", stroke: "#0891b2", bg: "bg-cyan-500/10 text-cyan-400" }; // cyan
      case "approval": return { fill: "#ef4444", stroke: "#dc2626", bg: "bg-rose-500/10 text-rose-400" }; // rose
      case "department": return { fill: "#a855f7", stroke: "#9333ea", bg: "bg-purple-500/10 text-purple-400" }; // purple
      default: return { fill: "#6b7280", stroke: "#4b5563", bg: "bg-gray-500/10 text-gray-400" };
    }
  };

  // Drag: pin node during drag then release back to sim
  const handleDragNode = (nodeId: string, event: React.MouseEvent<SVGElement>) => {
    event.preventDefault();
    const pos = simRef.current.positions[nodeId];
    if (!pos) return;
    pos.pinned = true;
    pos.vx = 0; pos.vy = 0;

    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const scaleX = simRef.current.width / svgRect.width;
    const scaleY = simRef.current.height / svgRect.height;

    const handleMouseMove = (e: MouseEvent) => {
      pos.x = Math.max(20, Math.min(simRef.current.width - 20, (e.clientX - svgRect.left) * scaleX));
      pos.y = Math.max(20, Math.min(simRef.current.height - 20, (e.clientY - svgRect.top) * scaleY));
      const nodeG = svgEl.querySelector(`[data-node-id="${nodeId}"]`) as SVGGElement | null;
      if (nodeG) nodeG.setAttribute("transform", `translate(${pos.x},${pos.y})`);
    };

    const handleMouseUp = () => {
      pos.pinned = false;
      // Restart sim briefly to re-settle
      startForceSimulation(nodes, edges);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="space-y-6 animate-fadeIn select-text">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-darkPanel/25 border border-darkBorder rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo border border-neonIndigo/20">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-200">Knowledge Graph & Organizational Intelligence</h2>
            <p className="text-xs text-darkMuted">Traverse, audit, and analyze connected relationships across documents, people, and automated transactions.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-3.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-darkBorder/40 hover:bg-darkBorder/70 text-gray-300 border border-darkBorder rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Graph
          </button>
          
          {nodes.length === 0 && (
            <button
              onClick={handleSeedGraph}
              disabled={seeding}
              className="px-3.5 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-neonIndigo/15 hover:bg-neonIndigo/25 text-neonIndigo border border-neonIndigo/30 rounded-lg cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              {seeding ? "Seeding..." : "Seed Mock Relationships"}
            </button>
          )}
        </div>
      </div>

      {/* Grid: Search, Filters & Network canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left pane: Explorer Search, Node detail, and Impact Analysis */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Node Search & Filters */}
          <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-neonTeal" />
              Graph Explorer Filters
            </h3>
            
            <div className="relative">
              <Search className="w-4 h-4 text-darkMuted absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search entities or types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-darkBg/60 border border-darkBorder rounded-lg text-xs text-gray-300 placeholder-darkMuted focus:outline-none focus:border-neonTeal"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-mono tracking-wider text-darkMuted">Filter Node Type</label>
              <div className="flex flex-wrap gap-1.5">
                {["all", "person", "company", "invoice", "workflow", "approval", "department"].map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase transition-all cursor-pointer ${
                      selectedType === type
                        ? "bg-neonTeal/10 text-neonTeal border border-neonTeal/30"
                        : "bg-darkBg/30 text-darkMuted border border-darkBorder/60 hover:text-gray-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Node Inspector details */}
          <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4 min-h-[300px]">
            <div className="flex items-center justify-between border-b border-darkBorder/40 pb-2">
              <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-neonIndigo" />
                Entity Inspector
              </h3>
              {selectedNode && (
                <button
                  onClick={handleExpandNode}
                  className="px-2 py-0.5 text-[9px] font-mono border border-neonTeal/20 bg-neonTeal/5 text-neonTeal rounded hover:bg-neonTeal/10 cursor-pointer"
                >
                  Expand Neighbours
                </button>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-200">{selectedNode.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${getNodeColor(selectedNode.entity_type).bg}`}>
                      {selectedNode.entity_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-darkMuted block mt-1 font-mono">ID: {selectedNode.id}</span>
                </div>

                {/* Node properties */}
                <div className="space-y-2 bg-darkBg/40 border border-darkBorder/50 p-3 rounded-lg">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-darkMuted">Properties</span>
                  <div className="space-y-1 text-xs font-mono text-gray-300">
                    {Object.entries(selectedNode.properties || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-darkMuted">{key}:</span>
                        <span>{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
                      </div>
                    ))}
                    {Object.keys(selectedNode.properties || {}).length === 0 && (
                      <span className="text-darkMuted italic text-[11px]">No properties stored.</span>
                    )}
                  </div>
                </div>

                {/* Adjacent connections list */}
                {nodeDetails && (
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-darkMuted">Direct Relationships</span>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {/* Outbound */}
                      {nodeDetails.outbound_relationships?.map((rel: any, idx: number) => (
                        <div key={`out-${idx}`} className="text-xs flex items-center justify-between bg-darkBg/25 border border-darkBorder/30 p-2 rounded">
                          <span className="text-darkMuted">→ {rel.relationship_type} →</span>
                          <span className="font-medium text-gray-300 max-w-[120px] truncate">{rel.target_id}</span>
                        </div>
                      ))}
                      {/* Inbound */}
                      {nodeDetails.inbound_relationships?.map((rel: any, idx: number) => (
                        <div key={`in-${idx}`} className="text-xs flex items-center justify-between bg-darkBg/25 border border-darkBorder/30 p-2 rounded">
                          <span className="text-darkMuted">← {rel.relationship_type} ←</span>
                          <span className="font-medium text-gray-300 max-w-[120px] truncate">{rel.source_id}</span>
                        </div>
                      ))}
                      {nodeDetails.outbound_relationships?.length === 0 && nodeDetails.inbound_relationships?.length === 0 && (
                        <span className="text-darkMuted italic text-xs block">Isolated node.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Impact analysis run triggers */}
                <div className="border-t border-darkBorder/40 pt-3 space-y-2">
                  <button
                    onClick={handleRunImpactAnalysis}
                    disabled={analyzingImpact}
                    className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/35 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {analyzingImpact ? "Analyzing Impact..." : "Simulate Impact Analysis"}
                  </button>
                  <p className="text-[10px] text-darkMuted text-center">Traces all downstream dependencies if this node fails.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center text-darkMuted space-y-2">
                <Share2 className="w-8 h-8 text-darkBorder animate-pulse" />
                <span className="text-xs">Click any node on the graph panel to inspect properties and run simulations.</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Graph canvas visualization */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Visualizer viewport */}
          <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 flex flex-col justify-between min-h-[500px] relative overflow-hidden">
            
            {/* Legend indicators */}
            <div className="flex flex-wrap gap-3 p-2.5 bg-darkBg/60 border border-darkBorder/40 rounded-lg absolute top-4 left-4 z-10 text-[10px] font-mono uppercase">
              {["person", "company", "invoice", "workflow", "approval", "department"].map(type => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getNodeColor(type).fill }} />
                  <span className="text-gray-300">{type}</span>
                </div>
              ))}
              {impactAnalysisResult && (
                <div className="flex items-center gap-1.5 border-l border-darkBorder/60 pl-3">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-rose-400 font-bold">Downstream Blast Impact</span>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-darkMuted animate-pulse">Computing graph layout...</span>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Network className="w-16 h-16 text-darkBorder" />
                <div className="space-y-1 max-w-sm">
                  <h4 className="text-sm font-semibold text-gray-300">No Knowledge Graph Data</h4>
                  <p className="text-xs text-darkMuted">Upload documents, process workflows, CRM records, or trigger the seeding process to populate data.</p>
                </div>
                <button
                  onClick={handleSeedGraph}
                  disabled={seeding}
                  className="px-4 py-2 bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 hover:bg-neonIndigo/20 text-xs font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all"
                >
                  {seeding ? "Seeding..." : "Seed Default Structure"}
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-[420px] w-full border border-darkBorder/30 rounded-lg bg-[#05060b] relative" ref={containerRef}>
                {/* Force-directed SVG canvas — node/edge positions are written directly to DOM by the sim loop */}
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${simRef.current.width} ${simRef.current.height}`}
                  className="w-full h-full select-none"
                >
                  <defs>
                    <marker id="kg-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                    </marker>
                    <filter id="kg-glow">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>

                  {/* Edges — positions updated in-place by sim, initial coords don't matter */}
                  {edges.map(edge => {
                    const isImpacted = impactAnalysisResult &&
                      impactAnalysisResult.edges?.some((e: any) => e.id === edge.id);
                    const spos = simRef.current.positions[edge.source_id];
                    const tpos = simRef.current.positions[edge.target_id];
                    return (
                      <g key={edge.id}>
                        <line
                          data-edge-id={edge.id}
                          x1={spos?.x ?? 0} y1={spos?.y ?? 0}
                          x2={tpos?.x ?? 0} y2={tpos?.y ?? 0}
                          stroke={isImpacted ? "#ef4444" : "#374151"}
                          strokeWidth={isImpacted ? 2 : 1}
                          strokeOpacity={isImpacted ? 0.9 : 0.55}
                          markerEnd="url(#kg-arrow)"
                        />
                        <text
                          data-edge-lbl={edge.id}
                          x={spos && tpos ? (spos.x + tpos.x) / 2 : 0}
                          y={spos && tpos ? (spos.y + tpos.y) / 2 - 4 : 0}
                          fill={isImpacted ? "#f87171" : "#6b7280"}
                          fontSize="7"
                          fontFamily="monospace"
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {edge.relationship_type}
                        </text>
                      </g>
                    );
                  })}

                  {/* Nodes — rendered at initial position, translated by sim via DOM */}
                  {filteredNodes.map(node => {
                    const color = getNodeColor(node.entity_type);
                    const isSelected = selectedNode?.id === node.id;
                    const isImpacted = impactAnalysisResult &&
                      impactAnalysisResult.impacted_nodes?.some((n: any) => n.id === node.id);
                    const spos = simRef.current.positions[node.id];
                    return (
                      <g
                        key={node.id}
                        data-node-id={node.id}
                        transform={spos ? `translate(${spos.x},${spos.y})` : `translate(${simRef.current.width / 2},${simRef.current.height / 2})`}
                        className="cursor-pointer"
                        onMouseDown={e => handleDragNode(node.id, e)}
                        onClick={() => handleSelectNode(node)}
                      >
                        {/* Impact pulse ring */}
                        {isImpacted && (
                          <circle r={18} fill="none" stroke="#ef4444" strokeWidth={2} opacity={0.6}
                            style={{ animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite" }}
                          />
                        )}
                        {/* Selection ring */}
                        {isSelected && (
                          <circle r={16} fill="none" stroke="#ffffff" strokeWidth={1.5} opacity={0.4}
                            filter="url(#kg-glow)"
                          />
                        )}
                        {/* Main node circle */}
                        <circle
                          r={isSelected ? 13 : 11}
                          fill={isImpacted ? "#ef4444" : color.fill}
                          stroke={isSelected ? "#ffffff" : color.stroke}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          filter={isSelected ? "url(#kg-glow)" : undefined}
                        />
                        {/* Label */}
                        <text
                          y={isSelected ? 24 : 22}
                          fill={isSelected ? "#ffffff" : "#d1d5db"}
                          fontSize={isSelected ? 10 : 9}
                          fontWeight={isSelected ? "bold" : "normal"}
                          fontFamily="sans-serif"
                          textAnchor="middle"
                          pointerEvents="none"
                        >
                          {node.name.length > 14 ? node.name.slice(0, 13) + "…" : node.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Controls overlay */}
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  <button
                    onClick={() => startForceSimulation(nodes, edges)}
                    className="px-2.5 py-1 text-[9px] font-mono uppercase text-darkMuted border border-darkBorder/60 bg-darkBg/70 hover:text-gray-300 rounded cursor-pointer transition-all flex items-center gap-1"
                    title="Re-run layout"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Re-settle
                  </button>
                  <span className="text-[9px] font-mono text-darkMuted/60">Drag nodes · Click to inspect</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Analytics indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric 1: Most connected nodes (Degree Centrality) */}
        <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-neonIndigo" />
            Degree Centrality (Influence Hubs)
          </h3>
          <div className="space-y-2">
            {analytics?.degree_centrality?.map((node, idx) => (
              <div key={idx} className="flex justify-between items-center bg-darkBg/30 border border-darkBorder/30 p-2.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-darkMuted font-mono">#{idx+1}</span>
                  <span className="font-semibold text-gray-200">{node.name}</span>
                  <span className={`text-[8px] font-mono uppercase px-1 rounded ${getNodeColor(node.entity_type).bg}`}>
                    {node.entity_type}
                  </span>
                </div>
                <span className="font-mono text-neonIndigo font-bold">{node.degree} links</span>
              </div>
            ))}
            {(!analytics?.degree_centrality || analytics.degree_centrality.length === 0) && (
              <span className="text-darkMuted italic text-xs block text-center py-4">No connection metrics computed.</span>
            )}
          </div>
        </div>

        {/* Metric 2: Workflow Bottlenecks */}
        <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Active Bottlenecks
          </h3>
          <div className="space-y-2">
            {analytics?.workflow_bottlenecks?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-darkBg/30 border border-darkBorder/30 p-2.5 rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-200">{item.name}</span>
                  <span className="text-[9px] font-mono uppercase px-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    {item.status}
                  </span>
                </div>
                <span className="font-mono text-rose-400 font-bold">{item.degree} linked</span>
              </div>
            ))}
            {analytics?.workflow_bottlenecks?.length === 0 && (
              <div className="text-center py-6 text-darkMuted text-xs italic">
                No active failures or bottlenecks detected.
              </div>
            )}
          </div>
        </div>

        {/* Metric 3: Active Departments */}
        <div className="bg-darkPanel/20 border border-darkBorder rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-neonTeal" />
            Department Involvement
          </h3>
          <div className="space-y-2">
            {analytics?.involved_departments?.map((dept, idx) => (
              <div key={idx} className="flex justify-between items-center bg-darkBg/30 border border-darkBorder/30 p-2.5 rounded-lg text-xs">
                <span className="font-semibold text-gray-200">{dept.name} Department</span>
                <span className="font-mono text-neonTeal font-bold">{dept.degree} nodes</span>
              </div>
            ))}
            {(!analytics?.involved_departments || analytics.involved_departments.length === 0) && (
              <span className="text-darkMuted italic text-xs block text-center py-4">No department metrics registered.</span>
            )}
          </div>
        </div>

      </div>

      {/* Downstream Impact Simulation results overlay */}
      {impactAnalysisResult && (
        <div className="bg-rose-950/20 border border-rose-500/25 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-400">Downstream Impact Analysis Blast Radius</h4>
              <p className="text-[11px] text-darkMuted">Traced downstream dependencies connected to target node: <code className="text-gray-300">{impactAnalysisResult.target_entity?.name}</code></p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {impactAnalysisResult.impacted_nodes?.map((node: any, idx: number) => (
              <div key={idx} className="bg-darkBg/50 border border-darkBorder/40 p-3 rounded-lg flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-gray-200 block font-semibold">{node.name}</span>
                  <span className="text-[9px] uppercase text-darkMuted">{node.entity_type}</span>
                </div>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  CRITICAL IMPACT
                </span>
              </div>
            ))}
            {impactAnalysisResult.impacted_nodes?.length === 0 && (
              <div className="col-span-3 text-center py-4 text-xs text-darkMuted italic">
                No downstream dependencies directly affected.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
