import React, { useEffect, useState, useCallback } from "react";
import { 
  Lock, Key, Shield, UserCheck, Activity, RefreshCw, 
  Trash2, ShieldAlert, Users, Terminal, CheckCircle2, AlertTriangle,
  UserX, LogOut, Check, ChevronRight, X
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "suspended";
}

interface UserSession {
  id: string;
  user_id: string;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

interface SecurityAudit {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  status: string;
  ip_address: string | null;
  timestamp: string;
}

const BACKEND_URL = "http://localhost:8000";

// Predefined users credentials for simulation
const SIMULATED_LOGINS = [
  { email: "admin@syntra.io", password: "adminpassword", label: "Admin Director (System)" },
  { email: "finance@syntra.io", password: "financepassword", label: "Finance Specialist (Finance)" },
  { email: "sales@syntra.io", password: "salespassword", label: "Sales Specialist (Sales)" },
  { email: "compliance@syntra.io", password: "compliancepassword", label: "Compliance Specialist (Compliance)" }
];

export const AuthDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"users" | "sessions" | "audit">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [audits, setAudits] = useState<SecurityAudit[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Login Session State resolved from localStorage
  const [currentSession, setCurrentSession] = useState<any | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginFeedback, setLoginFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // User Manager forms
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newStatus, setNewStatus] = useState<"active" | "suspended">("active");

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

  useEffect(() => {
    const token = localStorage.getItem("syntra_token");
    if (token) {
      const payload = decodeJwt(token);
      if (payload) {
        setCurrentSession({
          access_token: token,
          user: {
            id: payload.sub,
            name: payload.role === "admin" 
              ? "Admin Director" 
              : payload.role.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
            role: payload.role,
            department: payload.department
          }
        });
      }
    }
  }, []);

  const fetchSecurityData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (currentSession && currentSession.access_token) {
        headers["Authorization"] = `Bearer ${currentSession.access_token}`;
      }

      // Check if logged in as Admin to pull user directory
      const isAdmin = currentSession?.user?.role === "admin";
      const isComplianceOrAdmin = currentSession?.user?.role === "admin" || currentSession?.user?.role === "compliance_officer";

      if (isAdmin) {
        const usersRes = await fetch(`${BACKEND_URL}/api/v1/auth/users`, { headers });
        if (usersRes.ok) setUsers(await usersRes.json());
      } else {
        setUsers([]);
      }

      if (isComplianceOrAdmin) {
        const auditsRes = await fetch(`${BACKEND_URL}/api/v1/auth/audit/security`, { headers });
        if (auditsRes.ok) setAudits(await auditsRes.json());
      } else {
        setAudits([]);
      }
    } catch (e) {
      console.error("Failed to load security logs:", e);
    } finally {
      setLoading(false);
    }
  }, [currentSession]);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  const handleSimulateLogin = async (email: string, pass: string) => {
    setLoginFeedback(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentSession(data);
        setLoginFeedback({ type: "success", text: `Authenticated successfully! Logged in as ${data.user.name} (${data.user.role})` });
        
        // Save token to localStorage to preserve state if desired
        localStorage.setItem("syntra_token", data.access_token);
        
        await fetchSecurityData();
      } else {
        const errData = await res.json();
        setLoginFeedback({ type: "error", text: errData.detail || "Authentication rejected." });
        setCurrentSession(null);
      }
    } catch (e) {
      setLoginFeedback({ type: "error", text: "Connection error authenticating user." });
    }
  };

  const handleLogout = async () => {
    if (!currentSession) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentSession.access_token}` }
      });
      if (res.ok) {
        setCurrentSession(null);
        setLoginFeedback({ type: "success", text: "Logged out successfully from session database." });
        localStorage.removeItem("syntra_token");
        setUsers([]);
        setAudits([]);
      }
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const handleAssignPermissions = async (userId: string) => {
    if (!currentSession || currentSession.user.role !== "admin") {
      alert("Permission denied. Only Admins can modify permissions.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/auth/permissions/assign`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({
          user_id: userId,
          role: newRole,
          status: newStatus
        })
      });
      if (res.ok) {
        alert("User permissions updated successfully!");
        setEditingUser(null);
        fetchSecurityData();
      } else {
        const errData = await res.json();
        alert(`Update failed: ${errData.detail}`);
      }
    } catch (e) {
      console.error("Failed to assign permissions:", e);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour12: false }) + " " + date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <Lock className="w-5 h-5 text-neonTeal" />
            Syntra IAM Security & Governance Operations Center
          </h2>
          <p className="text-xs text-darkMuted mt-0.5">
            Configure user privileges, monitor active refresh token sessions, and inspect system audit security logs.
          </p>
        </div>

        {currentSession ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
              Active: {currentSession.user.name} ({currentSession.user.role.toUpperCase()})
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-darkBorder/40 hover:bg-rose-500/20 text-darkMuted hover:text-rose-400 border border-darkBorder hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <span className="text-xs text-rose-400 font-semibold bg-rose-500/10 px-3 py-1 rounded border border-rose-500/20">
            Unauthenticated Session (Guest Mode)
          </span>
        )}
      </div>

      {/* Tab Panels */}
      <div className="border border-darkBorder rounded-xl bg-darkPanel/10 overflow-hidden flex flex-col">
        <div className="flex border-b border-darkBorder/60 bg-darkPanel/30 px-4">
          {[
            { id: "users", label: "User Directory Access", icon: Users },
            { id: "audit", label: "Security Audit Logs", icon: ShieldAlert }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-neonTeal text-neonTeal bg-neonTeal/5"
                    : "border-transparent text-darkMuted hover:text-gray-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">


          {/* Tab 2: Users Management (restricted) */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {currentSession?.user?.role !== "admin" ? (
                <div className="p-8 border border-red-500/25 bg-red-500/5 rounded-xl text-center text-xs text-red-400 flex flex-col items-center justify-center gap-3">
                  <ShieldAlert className="w-10 h-10" />
                  <div>
                    <h4 className="font-bold text-sm">Access Denied: Admin Rights Required</h4>
                    <p className="mt-1 opacity-90">Only users logged in with role 'admin' possess capabilities to view or edit the user registry directories.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto border border-darkBorder/50 rounded-lg text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                        <th className="p-3 px-4">Name & Email</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Department</th>
                        <th className="p-3">Security Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkBorder/30">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-darkPanel/30 transition-colors">
                          <td className="p-3 px-4 font-semibold text-gray-200">
                            {u.name}
                            <span className="block text-[10px] text-darkMuted font-mono font-normal mt-0.5">{u.email}</span>
                          </td>
                          <td className="p-3 capitalize font-semibold text-gray-300">{u.role.replace("_", " ")}</td>
                          <td className="p-3 capitalize text-darkMuted">{u.department}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                              u.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {u.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setNewRole(u.role);
                                setNewStatus(u.status);
                              }}
                              className="text-neonTeal hover:underline"
                            >
                              Edit Permissions
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Security Audit Log (restricted) */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              {!(currentSession?.user?.role === "admin" || currentSession?.user?.role === "compliance_officer") ? (
                <div className="p-8 border border-red-500/25 bg-red-500/5 rounded-xl text-center text-xs text-red-400 flex flex-col items-center justify-center gap-3">
                  <ShieldAlert className="w-10 h-10" />
                  <div>
                    <h4 className="font-bold text-sm">Access Denied: Audit Rights Required</h4>
                    <p className="mt-1 opacity-90">Only users logged in as 'admin' or 'compliance_officer' possess capabilities to view compliance audit logs.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto border border-darkBorder/50 rounded-lg text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-darkPanel/45 border-b border-darkBorder text-[10px] uppercase font-mono tracking-widest text-darkMuted">
                        <th className="p-3 px-4">Action</th>
                        <th className="p-3">Subject ID</th>
                        <th className="p-3">Target Resource</th>
                        <th className="p-3">Status Outcome</th>
                        <th className="p-3">IP Address</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkBorder/30">
                      {audits.map(log => (
                        <tr key={log.id} className="hover:bg-darkPanel/30 transition-colors">
                          <td className="p-3 px-4 font-semibold text-gray-200 flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-neonTeal" />
                            {log.action}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-darkMuted">{log.user_id}</td>
                          <td className="p-3 font-mono text-[10px] text-gray-300">{log.resource}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                              log.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-darkMuted">{log.ip_address || "—"}</td>
                          <td className="p-3 font-mono text-darkMuted">{formatDate(log.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Edit User Permission Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-darkPanel border border-darkBorder rounded-2xl overflow-hidden shadow-2xl animate-scaleUp text-xs space-y-4 p-6">
            <div className="flex justify-between items-center border-b border-darkBorder/60 pb-3">
              <h3 className="text-sm font-semibold text-gray-200">Edit User Privileges</h3>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded bg-darkBg hover:bg-darkBorder border border-darkBorder cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-darkBg/30 p-3 rounded-lg border border-darkBorder/50">
                <span className="text-darkMuted text-[10px] uppercase font-mono">User</span>
                <p className="font-semibold text-gray-200 mt-0.5">{editingUser.name}</p>
                <code className="text-darkMuted font-mono mt-0.5 block">{editingUser.email}</code>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold block">Assigned Privilege Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-darkBg border border-darkBorder rounded px-3 py-2 text-gray-200"
                >
                  <option value="admin">Admin</option>
                  <option value="finance_manager">Finance Manager</option>
                  <option value="compliance_officer">Compliance Officer</option>
                  <option value="sales_rep">Sales Representative</option>
                  <option value="operations_manager">Operations Manager</option>
                  <option value="reviewer">Reviewer</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-gray-300 font-bold block">User Account Status</label>
                <div className="flex gap-3 mt-1">
                  {(["active", "suspended"] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNewStatus(st)}
                      className={`px-4 py-2 font-mono uppercase font-bold text-[9px] border rounded transition-all cursor-pointer ${
                        newStatus === st
                          ? st === "active"
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                            : "bg-red-500/10 border-red-500 text-red-400"
                          : "bg-darkBg border-darkBorder text-darkMuted hover:text-gray-300"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-darkBorder/60">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-darkBorder/55 hover:bg-darkBorder border border-darkBorder rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignPermissions(editingUser.id)}
                className="px-4 py-2 bg-neonTeal hover:bg-neonTeal/85 text-white font-semibold rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Security Policy
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
