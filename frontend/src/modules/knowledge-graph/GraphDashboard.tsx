import React, { useEffect, useState, useRef, useMemo } from "react";
import { Network, Search, Filter, ShieldAlert, Cpu, Database, RefreshCw, BarChart2, Share2, Layers, AlertTriangle, Play, HelpCircle } from "lucide-react";

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
  
  // Graph positions state for custom SVG renderer
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch Graph Data & Analytics
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch visualization topology
      const visRes = await fetch(`${BACKEND_URL}/api/v1/graph/visualization`);
      if (visRes.ok) {
        const visData = await visRes.json();
        setNodes(visData.nodes || []);
        setEdges(visData.edges || []);
        
        // Calculate initial coordinates for nodes
        generatePositions(visData.nodes || []);
      }
      
      // Fetch analytics
      const analRes = await fetch(`${BACKEND_URL}/api/v1/graph/analytics`);
      if (analRes.ok) {
        const analData = await analRes.json();
        setAnalytics(analData);
      }
    } catch (error) {
      console.error("Error loading Knowledge Graph:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to generate node positions in a nice layout circle / physics grid
  const generatePositions = (nodeList: GraphNode[]) => {
    const coords: Record<string, { x: number; y: number }> = {};
    const width = 600;
    const height = 400;
    const count = nodeList.length;

    nodeList.forEach((node, index) => {
      // Arrange in a nice circular pattern to start
      const angle = (index / (count || 1)) * 2 * Math.PI;
      const radius = 150 + Math.random() * 40;
      coords[node.id] = {
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle)
      };
    });
    setPositions(coords);
  };

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
    setImpactAnalysisResult(null); // Clear previous analysis
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/graph/entity/${node.id}`);
      if (res.ok) {
        const data = await res.json();
        setNodeDetails(data);
      }
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
        generatePositions(newNodes);
        
        const existingEdgeIds = new Set(edges.map(e => e.id));
        const newEdges = [...edges];
        (result.edges || []).forEach((e: GraphEdge) => {
          if (!existingEdgeIds.has(e.id)) {
            newEdges.push(e);
          }
        });
        setEdges(newEdges);
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

  // Node position drag simulation
  const handleDragNode = (nodeId: string, event: React.MouseEvent<SVGCircleElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialPos = positions[nodeId] || { x: 300, y: 200 };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      setPositions(prev => ({
        ...prev,
        [nodeId]: {
          x: initialPos.x + dx,
          y: initialPos.y + dy
        }
      }));
    };

    const handleMouseUp = () => {
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
              <div className="flex-1 min-h-[400px] w-full border border-darkBorder/30 rounded-lg bg-darkBg/20 relative">
                <svg width="100%" height="100%" viewBox="0 0 600 400" className="w-full h-full select-none cursor-grab active:cursor-grabbing">
                  {/* Arrows marker */}
                  <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#4b5563" />
                    </marker>
                  </defs>

                  {/* Draw edges (lines) */}
                  {edges.map((edge) => {
                    const srcPos = positions[edge.source_id] || { x: 300, y: 200 };
                    const tgtPos = positions[edge.target_id] || { x: 300, y: 200 };
                    
                    // Highlight if involved in impact analysis
                    const isImpacted = impactAnalysisResult && (
                      impactAnalysisResult.edges?.some((e: any) => e.id === edge.id)
                    );

                    return (
                      <g key={edge.id}>
                        <line
                          x1={srcPos.x}
                          y1={srcPos.y}
                          x2={tgtPos.x}
                          y2={tgtPos.y}
                          stroke={isImpacted ? "#ef4444" : "#4b5563"}
                          strokeWidth={isImpacted ? 2.5 : 1}
                          strokeOpacity={isImpacted ? 0.95 : 0.45}
                          markerEnd="url(#arrow)"
                        />
                        {/* Text relationship label */}
                        <text
                          x={(srcPos.x + tgtPos.x) / 2}
                          y={(srcPos.y + tgtPos.y) / 2 - 4}
                          fill={isImpacted ? "#f87171" : "#9ca3af"}
                          fontSize="7"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {edge.relationship_type}
                        </text>
                      </g>
                    );
                  })}

                  {/* Draw nodes (circles) */}
                  {filteredNodes.map((node) => {
                    const pos = positions[node.id] || { x: 300, y: 200 };
                    const color = getNodeColor(node.entity_type);
                    const isSelected = selectedNode?.id === node.id;
                    
                    // Check if node is impacted in simulation
                    const isImpacted = impactAnalysisResult && (
                      impactAnalysisResult.impacted_nodes?.some((n: any) => n.id === node.id)
                    );

                    return (
                      <g key={node.id} className="cursor-pointer">
                        {/* Pulsing ring if impacted */}
                        {isImpacted && (
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={16}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={2}
                            className="animate-ping opacity-75"
                          />
                        )}
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={11}
                          fill={isImpacted ? "#ef4444" : color.fill}
                          stroke={isSelected ? "#ffffff" : (isImpacted ? "#7f1d1d" : color.stroke)}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          onMouseDown={(e) => handleDragNode(node.id, e)}
                          onClick={() => handleSelectNode(node)}
                        />
                        {/* Node Label Text */}
                        <text
                          x={pos.x}
                          y={pos.y + 20}
                          fill="#f3f4f6"
                          fontSize="9"
                          fontWeight={isSelected ? "bold" : "normal"}
                          fontFamily="sans-serif"
                          textAnchor="middle"
                        >
                          {node.name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                
                {/* Floating Canvas controls */}
                <div className="absolute bottom-4 right-4 text-[9px] font-mono text-darkMuted bg-darkBg/75 p-2 border border-darkBorder/40 rounded">
                  💡 Tip: Click and drag nodes to customize the layout.
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
