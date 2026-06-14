import React, { useState, useEffect } from "react";
import { 
  Building, Globe, Shield, Sparkles, Plus, CheckCircle, 
  Users, Layers, Settings, ChevronRight, Check, Send, 
  Trash2, HelpCircle, AlertTriangle, RefreshCw
} from "lucide-react";
import { apiClient } from "../../services/apiClient";

interface Org {
  id: string;
  name: string;
  industry: string;
  country: string;
  subscription_plan: string;
  status: string;
  settings: any;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  status: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: string;
}

export const OrgAdminCenter: React.FC = () => {
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  // Forms State
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgIndustry, setNewOrgIndustry] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Analyst");
  const [inviteDept, setInviteDept] = useState("Engineering");
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "workspaces" | "settings" | "subscription">("directory");

  // Notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get("/organizations");
      if (response.ok) {
        const res = await response.json();
        if (res && res.length > 0) {
          setOrganizations(res);
          setActiveOrg(res[0]);
          fetchOrgDetails(res[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgDetails = async (orgId: string) => {
    try {
      const [wsRes, memRes] = await Promise.all([
        apiClient.get(`/organizations/${orgId}/workspaces`),
        apiClient.get(`/organizations/${orgId}/members`)
      ]);
      if (wsRes.ok) setWorkspaces(await wsRes.json());
      if (memRes.ok) setMembers(await memRes.json());
    } catch (err) {
      console.error("Error loading org details", err);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName) return;
    try {
      const response = await apiClient.post("/organizations", {
        name: newOrgName,
        industry: newOrgIndustry || "Technology",
        country: "United States",
        subscription_plan: "Starter"
      });
      if (response.ok) {
        const newOrg = await response.json();
        setOrganizations([...organizations, newOrg]);
        setActiveOrg(newOrg);
        fetchOrgDetails(newOrg.id);
        setNewOrgName("");
        setNewOrgIndustry("");
        showToast(`Organization "${newOrg.name}" created successfully!`);
      } else {
        showToast("Failed to create organization.", "error");
      }
    } catch (err) {
      showToast("Failed to create organization.", "error");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !newWsName) return;
    try {
      const response = await apiClient.post(`/organizations/${activeOrg.id}/workspaces`, {
        name: newWsName,
        description: newWsDesc
      });
      if (response.ok) {
        const newWs = await response.json();
        setWorkspaces([...workspaces, newWs]);
        setNewWsName("");
        setNewWsDesc("");
        showToast(`Workspace "${newWs.name}" initialized!`);
      } else {
        showToast("Failed to create workspace.", "error");
      }
    } catch (err) {
      showToast("Failed to create workspace.", "error");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !inviteEmail) return;
    try {
      await apiClient.post(`/organizations/${activeOrg.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
        department: inviteDept,
        workspace_ids: workspaces.slice(0, 1).map(w => w.id)
      });
      setInviteEmail("");
      showToast(`Invitation dispatched to ${inviteEmail}!`);
      fetchOrgDetails(activeOrg.id); // refresh
    } catch (err) {
      showToast("Failed to invite member.", "error");
    }
  };

  const handleSwitchOrg = (org: Org) => {
    setActiveOrg(org);
    fetchOrgDetails(org.id);
    showToast(`Switched context to ${org.name}`);
  };

  return (
    <div className="space-y-8 animate-fadeIn text-gray-200">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-xl border flex items-center gap-2.5 z-50 transition-all ${
          toast.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-darkBorder/60 bg-gradient-to-r from-darkPanel via-darkPanel/80 to-neonIndigo/5 p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-neonTeal font-mono text-xs uppercase tracking-widest mb-1.5">
              <Building className="w-3.5 h-3.5" />
              <span>Multi-Tenant Administration</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-100">
              Enterprise Tenant Directory
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Manage organization boundaries, workspaces, policies, memberships, and tenant-isolated operations.
            </p>
          </div>

          {/* Org Selector Switcher */}
          <div className="flex flex-wrap gap-2.5 bg-darkBg/60 p-1.5 rounded-xl border border-darkBorder/40">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitchOrg(org)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeOrg?.id === org.id
                    ? "bg-neonIndigo text-white shadow-lg shadow-neonIndigo/20"
                    : "text-darkMuted hover:text-gray-200 hover:bg-darkPanel"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: Organization Admin Config Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-5 space-y-5">
            <h3 className="text-xs font-mono font-bold text-darkMuted uppercase tracking-wider">
              Tenant Summary
            </h3>
            
            {activeOrg && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono">Organization Name</label>
                  <p className="text-sm font-semibold text-gray-200 mt-0.5">{activeOrg.name}</p>
                </div>
                <div>
                  <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono">Industry / Location</label>
                  <p className="text-xs text-gray-300 mt-0.5">{activeOrg.industry} • {activeOrg.country}</p>
                </div>
                <div>
                  <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono">Plan Level</label>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20 mt-1">
                    <Sparkles className="w-3 h-3" />
                    {activeOrg.subscription_plan}
                  </span>
                </div>
                <div className="pt-2 border-t border-darkBorder/40">
                  <div className="flex justify-between text-xs text-darkMuted mb-1.5">
                    <span>Workspaces</span>
                    <span className="font-semibold text-gray-200">{workspaces.length}</span>
                  </div>
                  <div className="flex justify-between text-xs text-darkMuted">
                    <span>Active Users</span>
                    <span className="font-semibold text-gray-200">{members.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Org Creation Form */}
          <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-5 space-y-4">
            <h4 className="text-xs font-semibold text-gray-200">Initialize New Tenant</h4>
            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Organization Name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                  required
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Industry (e.g. Healthcare)"
                  value={newOrgIndustry}
                  onChange={(e) => setNewOrgIndustry(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-neonTeal/10 hover:bg-neonTeal/20 text-neonTeal border border-neonTeal/30 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Tenant</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Dynamic workspace dashboards */}
        <div className="lg:col-span-3 space-y-6">
          {/* Sub Tab Navigation */}
          <div className="flex gap-2 border-b border-darkBorder/40 pb-2.5">
            {[
              { id: "directory", label: "Members Directory", icon: Users },
              { id: "workspaces", label: "Workspaces", icon: Layers },
              { id: "settings", label: "Tenant Settings", icon: Settings },
              { id: "subscription", label: "Usage & Billing", icon: Globe }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    activeSubTab === tab.id
                      ? "bg-neonTeal/10 text-neonTeal border-neonTeal/20"
                      : "bg-transparent border-transparent text-darkMuted hover:text-gray-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Directory Content */}
          {activeSubTab === "directory" && (
            <div className="space-y-6">
              {/* Directory Grid */}
              <div className="bg-darkPanel/40 border border-darkBorder/40 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-darkPanel/80 text-darkMuted border-b border-darkBorder/40 uppercase tracking-widest text-[9px] font-mono">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Org Role</th>
                      <th className="p-4">Department</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-darkBorder/20">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-darkPanel/20 transition-colors">
                        <td className="p-4 font-semibold text-gray-200">{member.name}</td>
                        <td className="p-4 font-mono text-darkMuted">{member.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded bg-darkBorder/40 text-gray-300 text-[10px]">
                            {member.role}
                          </span>
                        </td>
                        <td className="p-4">{member.department}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {member.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-darkMuted">No organization memberships found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invite User Panel */}
              <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Invite Teammate</h4>
                  <p className="text-xs text-darkMuted mt-0.5">Sends a workspace enrollment link to access isolated workspaces.</p>
                </div>
                <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="dev@acme.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">System Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Finance Manager">Finance Manager</option>
                      <option value="Compliance Reviewer">Compliance Reviewer</option>
                      <option value="Analyst">Analyst</option>
                      <option value="Guest">Guest</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Department</label>
                    <select
                      value={inviteDept}
                      onChange={(e) => setInviteDept(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                    >
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Sales">Sales</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Research">Research</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full bg-neonIndigo hover:bg-neonIndigo/80 text-white rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Invite</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Workspaces Content */}
          {activeSubTab === "workspaces" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaces.map((ws) => (
                  <div key={ws.id} className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-5 space-y-3 hover:border-neonTeal/30 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-200">{ws.name}</h4>
                        <p className="text-xs text-darkMuted mt-1">{ws.description || "Isolated workspace segment"}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                        {ws.status}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-darkBorder/20 flex gap-4 text-[10px] font-mono text-darkMuted">
                      <span>Resources: Isolated</span>
                      <span>Access: Tenant-Only</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create Workspace Form */}
              <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-6 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Initialize Workspace</h4>
                  <p className="text-xs text-darkMuted mt-0.5">Define a distinct operations, research, or compliance department workspace boundary.</p>
                </div>
                <form onSubmit={handleCreateWorkspace} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-1">
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Workspace Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Compliance Workspace"
                      value={newWsName}
                      onChange={(e) => setNewWsName(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1">Description</label>
                    <input
                      type="text"
                      placeholder="Internal compliance audits"
                      value={newWsDesc}
                      onChange={(e) => setNewWsDesc(e.target.value)}
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full bg-neonTeal hover:bg-neonTeal/80 text-darkBg rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Workspace</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeSubTab === "settings" && (
            <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-200">Branding & Security Configuration</h4>
                <p className="text-xs text-darkMuted mt-0.5">Customize workspace domains and policy constraints for the active organization.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1.5">Custom Domain Mapping</label>
                    <input
                      type="text"
                      placeholder="syntra.acme.com"
                      className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-darkMuted uppercase tracking-widest font-mono block mb-1.5">Branding Primary Hex Accent</label>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded bg-neonTeal shrink-0" />
                      <input
                        type="text"
                        defaultValue="#0df2c9"
                        className="w-full bg-darkBg border border-darkBorder/60 rounded-lg px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-neonIndigo"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-darkBg/60 rounded-lg p-4 border border-darkBorder/40 space-y-3">
                    <h5 className="text-xs font-semibold text-gray-300">Workspace Restriction Policies</h5>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" defaultChecked className="rounded border-darkBorder text-neonTeal focus:ring-0" />
                        <span>Enforce strict tenant data boundaries</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" className="rounded border-darkBorder text-neonTeal focus:ring-0" />
                        <span>Require MFA for all workspace administrators</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-300">
                        <input type="checkbox" defaultChecked className="rounded border-darkBorder text-neonTeal focus:ring-0" />
                        <span>Log AI agent decision runs in compliance database</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-darkBorder/20 flex justify-end">
                <button
                  onClick={() => showToast("Tenant setting customizations applied.")}
                  className="bg-neonIndigo hover:bg-neonIndigo/80 text-white rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  Save Branding Configuration
                </button>
              </div>
            </div>
          )}

          {/* Usage & Billing Tab */}
          {activeSubTab === "subscription" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Active Plan Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { name: "Starter", price: "$49", features: ["5 Workspaces", "10 Team members", "50GB Storage", "Basic AI Agents"], active: activeOrg?.subscription_plan === "Starter" },
                  { name: "Professional", price: "$199", features: ["15 Workspaces", "50 Team members", "500GB Storage", "Full Integrations Hub", "Autonomous Agent Swarms"], active: activeOrg?.subscription_plan === "Professional" },
                  { name: "Enterprise", price: "Custom", features: ["Unlimited Workspaces", "Unlimited Members", "Multi-Tenant boundaries", "Premium Governance logs", "API Gateway access"], active: activeOrg?.subscription_plan === "Enterprise" }
                ].map((plan, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-darkPanel/60 rounded-xl border p-5 flex flex-col justify-between relative ${
                      plan.active 
                        ? "border-neonTeal/60 bg-gradient-to-b from-neonTeal/5 to-transparent" 
                        : "border-darkBorder/40"
                    }`}
                  >
                    {plan.active && (
                      <span className="absolute -top-2.5 right-4 bg-neonTeal text-darkBg px-2 py-0.5 text-[9px] font-bold tracking-wider rounded-full uppercase">
                        Current Active Plan
                      </span>
                    )}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200">{plan.name}</h4>
                      <p className="text-2xl font-bold text-gray-100 mt-2">{plan.price}<span className="text-xs text-darkMuted font-normal"> / mo</span></p>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Check className="w-3.5 h-3.5 text-neonTeal shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* Usage Meters */}
              <div className="bg-darkPanel/60 rounded-xl border border-darkBorder/40 p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">Tenant Resource Utilization Meter</h4>
                  <p className="text-xs text-darkMuted mt-0.5">Real-time usage metrics tracked against plan thresholds.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">Workflow Executions (Monthly)</span>
                        <span className="text-darkMuted">1,240 / Unlimited</span>
                      </div>
                      <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden">
                        <div className="h-full bg-neonIndigo rounded-full" style={{ width: "24%" }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">AI Agent Agentic Runs</span>
                        <span className="text-darkMuted">874 / Unlimited</span>
                      </div>
                      <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden">
                        <div className="h-full bg-neonTeal rounded-full" style={{ width: "38%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">Tenant Isolated Storage</span>
                        <span className="text-darkMuted">342 MB / 100 GB</span>
                      </div>
                      <div className="w-full h-1.5 bg-darkBg rounded-full overflow-hidden">
                        <div className="h-full bg-neonTeal rounded-full" style={{ width: "0.34%" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
