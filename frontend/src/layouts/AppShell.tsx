import React, { useState } from "react";
import { 
  Cpu, Sparkles, Network, Search, BookOpen, MessageSquare, 
  Sliders, Server, ShieldAlert, Activity, Zap, Bell, Lock, 
  ChevronLeft, ChevronRight, LogOut, Shield, Link2, Users, DollarSign
} from "lucide-react";

export type WorkspaceTab = 
  | "hub" | "copilot" | "graph" | "search" | "research" | "assistant" 
  | "automation" | "worker" | "agents" | "observability" | "review" 
  | "events" | "notifications" | "auth" | "integrations" | "analytics" | "workforce" | "finance" | "governance" | "organizations" | "developer" | "executive";

interface AppShellProps {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  isAdvancedMode: boolean;
  setIsAdvancedMode: (val: boolean) => void;
  apiConnected: boolean;
  aiStatus: { status: string; provider: string; model: string } | null;
  currentUser: { name: string; role: string; department: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  setActiveTab,
  isAdvancedMode,
  setIsAdvancedMode,
  apiConnected,
  aiStatus,
  currentUser,
  onLogout,
  children
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Grouped Navigation configuration
  const navSections = [
    {
      title: "Operations",
      items: [
        { id: "executive", label: "CEO Control Room", icon: Shield },
        { id: "hub", label: "Control Center", icon: Cpu },
        { id: "review", label: "Human Review", icon: ShieldAlert },
        { id: "analytics", label: "Analytics BI", icon: Activity },
        { id: "workforce", label: "Workforce EOR", icon: Users },
        { id: "finance", label: "Finance Studio", icon: DollarSign },
      ]
    },
    {
      title: "Automation",
      items: [
        { id: "copilot", label: "AI Copilot", icon: Sparkles },
        { id: "automation", label: "Business Flows", icon: Sliders },
        { id: "agents", label: "Agent Swarms", icon: Sliders },
        { id: "research", label: "Research Lab", icon: BookOpen },
      ]
    },
    {
      title: "Knowledge",
      items: [
        { id: "search", label: "Hybrid Search", icon: Search },
        { id: "graph", label: "Knowledge Graph", icon: Network },
        { id: "assistant", label: "Doc Assistant", icon: MessageSquare },
      ]
    },
    ...(isAdvancedMode ? [{
      title: "System Admin",
      items: [
        { id: "worker", label: "Worker Queue", icon: Server },
        { id: "integrations", label: "Integrations Hub", icon: Link2 },
        { id: "observability", label: "Telemetry Logs", icon: Activity },
        { id: "events", label: "Event Bus", icon: Zap },
        { id: "notifications", label: "Alert Hub", icon: Bell },
        { id: "auth", label: "Security IAM", icon: Lock },
        { id: "governance", label: "AI Governance", icon: Shield },
        { id: "organizations", label: "Org Settings", icon: Users },
        { id: "developer", label: "Developer Portal", icon: Sliders },
      ]
    }] : [])
  ];

  return (
    <div className="min-h-screen flex bg-darkBg text-gray-200 font-sans">
      {/* Sidebar Navigation */}
      <aside 
        className={`bg-darkPanel border-r border-darkBorder flex flex-col justify-between transition-all duration-300 relative z-30 shrink-0 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Collapse Toggle Handle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-6 w-7 h-7 rounded-full bg-darkPanel border border-darkBorder hover:border-neonTeal hover:text-neonTeal flex items-center justify-center cursor-pointer transition-colors z-40"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        <div className="flex flex-col flex-1 overflow-y-auto pt-5 pb-4">
          {/* Brand Logo & Header */}
          <div className={`px-4 mb-8 flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-lg bg-neonIndigo/10 flex items-center justify-center text-neonIndigo border border-neonIndigo/20 shrink-0">
              <Cpu className="w-4.5 h-4.5" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-display font-extrabold text-gray-200 tracking-wider text-sm uppercase flex items-center gap-1.5">
                  Syntra OS
                </h1>
                <span className="text-[9px] font-mono text-darkMuted uppercase tracking-widest block mt-0.5">Control Shell</span>
              </div>
            )}
          </div>

          {/* Navigation Links Grouped */}
          <nav className="flex-1 space-y-6 px-3">
            {navSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                {!collapsed && (
                  <span className="px-3 text-[9px] font-mono font-bold text-darkMuted uppercase tracking-widest block mb-2">
                    {section.title}
                  </span>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as WorkspaceTab)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer border ${
                          isActive
                            ? "bg-neonIndigo/8 border-neonIndigo/20 text-neonIndigo"
                            : "bg-transparent border-transparent text-darkMuted hover:text-gray-200 hover:bg-darkBorder/20"
                        } ${collapsed ? "justify-center" : ""}`}
                        title={item.label}
                      >
                        <Icon className="w-4.5 h-4.5 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer (Profile / Logout) */}
        <div className="p-3 border-t border-darkBorder/60 bg-darkPanel/20">
          {currentUser ? (
            <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : "px-1.5 py-1"}`}>
              <div className="w-8 h-8 rounded-full bg-darkBorder/60 flex items-center justify-center text-neonIndigo border border-darkBorder shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-200 truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-darkMuted capitalize truncate">{currentUser.role} • {currentUser.department}</p>
                </div>
              )}
              {!collapsed && (
                <button
                  onClick={onLogout}
                  className="p-1 rounded-lg hover:bg-rose-500/10 text-darkMuted hover:text-rose-400 cursor-pointer transition-colors"
                  title="Sign out Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="text-center text-[10px] text-darkMuted py-2 font-mono">STANDBY</div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Component */}
        <header className="border-b border-darkBorder bg-darkPanel/20 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Context breadcrumb based on active tab */}
            <h2 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-widest">
              Workspace / <span className="text-gray-200">{activeTab}</span>
            </h2>
          </div>

          <div className="flex items-center gap-6 text-xs select-none">
            {/* Developer Mode switch toggle */}
            <div className="flex items-center gap-2 border-r border-darkBorder/60 pr-6 mr-1">
              <span className="text-xs text-darkMuted font-semibold">Developer Mode</span>
              <label className="switch-toggle">
                <input 
                  type="checkbox" 
                  checked={isAdvancedMode} 
                  onChange={(e) => setIsAdvancedMode(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            {/* API Connection Indicator */}
            <div className={`flex items-center gap-1.5 font-medium ${apiConnected ? "text-emerald-400" : "text-rose-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${apiConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`} />
              <span>{apiConnected ? "Connected" : "Offline"}</span>
            </div>

            {/* AI Provider Indicator */}
            {apiConnected && aiStatus && (
              <div className={`flex items-center gap-1.5 font-medium px-2 py-0.5 rounded border text-[10px] ${
                aiStatus.status === "connected"
                  ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                  : "text-amber-400 border-amber-500/20 bg-amber-500/5"
              }`}>
                <span className="w-1 h-1 rounded-full bg-current" />
                <span>AI: {aiStatus.provider}</span>
              </div>
            )}
          </div>
        </header>

        {/* Content Viewport */}
        <main className="page-rails flex-1 flex flex-col p-6 md:p-8 dot-pattern">
          {children}
        </main>
      </div>
    </div>
  );
};
