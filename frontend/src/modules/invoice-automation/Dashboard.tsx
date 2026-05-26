import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  Clock, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  User 
} from "lucide-react";

interface DashboardProps {
  backendUrl: string;
}

interface InvoiceData {
  id: string;
  document_id: string;
  vendor_name: string;
  invoice_number: string;
  currency: string;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number;
  due_date: string | null;
  payment_terms: string | null;
  status: string;
  created_at: string;
}

interface PayrollData {
  id: string;
  document_id: string;
  employee_name: string;
  salary: number;
  deductions: any[];
  net_pay: number;
  payment_date: string | null;
  status: string;
  created_at: string;
}

interface AnomalyData {
  id: string;
  document_id: string;
  invoice_id: string | null;
  payroll_record_id: string | null;
  rule_name: string;
  severity: string;
  description: string;
  resolved: boolean;
  created_at: string;
}

interface StatsData {
  invoices: {
    total_value: number;
    average_value: number;
    count: number;
  };
  payroll: {
    total_value: number;
    count: number;
  };
  anomalies: {
    total: number;
    active: number;
    high: number;
    medium: number;
    low: number;
  };
  risk_score: number;
  total_documents: number;
}

// Custom Cyber-Industrial Panel Wrapper Component with Monospace crosshair markers
const Panel: React.FC<{ children: React.ReactNode; className?: string; accentColor?: string; indicatorColor?: string }> = ({ 
  children, 
  className = "", 
  accentColor = "text-neonTeal",
  indicatorColor = ""
}) => {
  return (
    <div className={`relative p-5 bg-darkPanel/40 border border-darkBorder/70 rounded-none shadow-lg backdrop-blur-sm ${className}`}>
      {/* Corner crosshairs */}
      <span className={`absolute -top-2 -left-1 font-mono font-extrabold text-[10px] ${accentColor} select-none`}>+</span>
      <span className={`absolute -top-2 -right-1 font-mono font-extrabold text-[10px] ${accentColor} select-none`}>+</span>
      <span className={`absolute -bottom-2 -left-1 font-mono font-extrabold text-[10px] ${accentColor} select-none`}>+</span>
      <span className={`absolute -bottom-2 -right-1 font-mono font-extrabold text-[10px] ${accentColor} select-none`}>+</span>
      
      {indicatorColor && (
        <div className={`absolute top-0 left-0 w-1 h-full ${indicatorColor}`} />
      )}
      
      {children}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ backendUrl }) => {
  const [activeSubTab, setActiveSubTab] = useState<"invoices" | "payroll">("invoices");
  
  // Data States
  const [stats, setStats] = useState<StatsData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [payroll, setPayroll] = useState<PayrollData[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  
  // Loading & Error States
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [invoicePage, setInvoicePage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [payrollSearch, setPayrollSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPayroll, setTotalPayroll] = useState(0);
  
  const itemsPerPage = 6;

  // Fetch Stats API
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/invoice-automation/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [backendUrl]);

  // Fetch Active Anomalies
  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/invoice-automation/anomalies?resolved=false`);
      if (res.ok) {
        const data = await res.json();
        setAnomalies(data);
      }
    } catch (err) {
      console.error("Error fetching anomalies:", err);
    }
  }, [backendUrl]);

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    setLoadingData(true);
    try {
      let url = `${backendUrl}/api/v1/invoice-automation/invoices?page=${invoicePage}&limit=${itemsPerPage}`;
      if (invoiceSearch) url += `&vendor=${encodeURIComponent(invoiceSearch)}`;
      if (statusFilter !== "all") url += `&status=${encodeURIComponent(statusFilter)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.data);
        setTotalInvoices(data.total);
      }
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Failed to load invoice records.");
    } finally {
      setLoadingData(false);
    }
  }, [backendUrl, invoicePage, invoiceSearch, statusFilter]);

  // Fetch Payroll Records
  const fetchPayroll = useCallback(async () => {
    setLoadingData(true);
    try {
      let url = `${backendUrl}/api/v1/invoice-automation/payroll-records?page=${payrollPage}&limit=${itemsPerPage}`;
      if (payrollSearch) url += `&employee=${encodeURIComponent(payrollSearch)}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPayroll(data.data);
        setTotalPayroll(data.total);
      }
    } catch (err) {
      console.error("Error fetching payroll records:", err);
      setError("Failed to load payroll records.");
    } finally {
      setLoadingData(false);
    }
  }, [backendUrl, payrollPage, payrollSearch]);

  // Initial Load & Triggers
  useEffect(() => {
    fetchStats();
    fetchAnomalies();
  }, [fetchStats, fetchAnomalies]);

  useEffect(() => {
    if (activeSubTab === "invoices") {
      fetchInvoices();
    } else {
      fetchPayroll();
    }
  }, [activeSubTab, fetchInvoices, fetchPayroll]);

  // Resolve Anomaly Action Handler
  const handleResolveAnomaly = async (anomalyId: string) => {
    setActionLoadingId(anomalyId);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/v1/invoice-automation/anomalies/${anomalyId}/resolve`, {
        method: "POST",
      });
      if (res.ok) {
        fetchStats();
        fetchAnomalies();
        if (activeSubTab === "invoices") fetchInvoices();
        else fetchPayroll();
      } else {
        let errorText = "Failed to resolve anomaly.";
        try {
          const errorData = await res.json();
          errorText = errorData.detail || errorText;
        } catch {}
        setError(errorText);
      }
    } catch (err: any) {
      console.error("Error resolving anomaly:", err);
      setError(err.message === "Failed to fetch" 
        ? "Database server connection lost. Please check if the API backend is running." 
        : "Failed to resolve anomaly: " + (err.message || "Unknown error"));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reprocess Document Action Handler
  const handleReprocessDocument = async (docId: string, itemType: "invoice" | "payroll") => {
    setActionLoadingId(docId);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/v1/invoice-automation/reprocess/${docId}`, {
        method: "POST",
      });
      if (res.ok) {
        fetchStats();
        fetchAnomalies();
        if (itemType === "invoice") fetchInvoices();
        else fetchPayroll();
      } else {
        let errorText = "Failed to reprocess document.";
        try {
          const errorData = await res.json();
          errorText = errorData.detail || errorText;
        } catch {}
        setError(errorText);
      }
    } catch (err: any) {
      console.error("Error reprocessing document:", err);
      setError(err.message === "Failed to fetch" 
        ? "Database server connection lost. Please check if the API backend is running." 
        : "Failed to reprocess document: " + (err.message || "Unknown error"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalInvoicePages = Math.ceil(totalInvoices / itemsPerPage) || 1;
  const totalPayrollPages = Math.ceil(totalPayroll / itemsPerPage) || 1;

  return (
    <div className="space-y-6 animate-fadeIn select-text">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-display font-extrabold text-gray-200 tracking-wider flex items-center gap-2 uppercase">
            <ShieldAlert className="w-4 h-4 text-neonTeal" />
            Financial Audit Control Panel
          </h2>
          <p className="text-[10px] font-mono text-darkMuted uppercase tracking-wider mt-0.5">
            Real-time compliance validation, ledger analysis, and anomaly intelligence
          </p>
        </div>
        
        {/* Refresh Metrics */}
        <button
          onClick={() => {
            fetchStats();
            fetchAnomalies();
            if (activeSubTab === "invoices") fetchInvoices();
            else fetchPayroll();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-none bg-darkBorder/40 hover:bg-neonTeal/10 hover:text-neonTeal border border-darkBorder/80 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Mainframe</span>
        </button>
      </div>

      {/* KPI Stats Panel Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Invoiced value */}
        <Panel accentColor="text-neonTeal" indicatorColor="bg-neonTeal" className="glow-amber-pulse">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-display uppercase font-bold text-darkMuted tracking-wider block">Total Invoiced</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-mono font-bold text-gray-100 tracking-tight">
                  ${stats ? stats.invoices.total_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </span>
                <span className="text-[10px] font-mono text-darkMuted">USD</span>
              </div>
            </div>
            
            {/* Sparkline line indicator */}
            <svg className="w-16 h-8 text-neonTeal opacity-60 shrink-0 mt-1" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M0,25 Q15,10 30,22 T60,5 T90,20 L100,8" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex justify-between items-center mt-3 text-[9px] font-mono text-darkMuted border-t border-darkBorder/40 pt-2.5">
            <span>Volume: {stats ? stats.invoices.count : 0} items</span>
            <span className="text-neonTeal flex items-center gap-0.5 font-bold">
              <TrendingUp className="w-3 h-3" /> Avg: ${stats ? Math.round(stats.invoices.average_value) : 0}
            </span>
          </div>
        </Panel>

        {/* Total Payroll outlays */}
        <Panel accentColor="text-neonIndigo" indicatorColor="bg-neonIndigo" className="glow-green-pulse">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-display uppercase font-bold text-darkMuted tracking-wider block">Payroll Outlays</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-mono font-bold text-gray-100 tracking-tight">
                  ${stats ? stats.payroll.total_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                </span>
                <span className="text-[10px] font-mono text-darkMuted">USD</span>
              </div>
            </div>
            
            {/* Sparkline indicator */}
            <svg className="w-16 h-8 text-neonIndigo opacity-60 shrink-0 mt-1" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M0,15 Q20,25 40,12 T70,8 L100,22" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex justify-between items-center mt-3 text-[9px] font-mono text-darkMuted border-t border-darkBorder/40 pt-2.5">
            <span>Employees: {stats ? stats.payroll.count : 0} members</span>
            <span className="text-neonIndigo flex items-center gap-0.5 font-bold animate-pulse">
              <Activity className="w-3 h-3" /> Audited Active
            </span>
          </div>
        </Panel>

        {/* Active Anomalies count */}
        <Panel accentColor="text-rose-500" indicatorColor="bg-rose-500">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-display uppercase font-bold text-darkMuted tracking-wider block">Active Flags</span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className={`text-2xl font-mono font-bold ${anomalies.length > 0 ? "text-rose-400" : "text-gray-100"}`}>
                  {anomalies.length}
                </span>
                {anomalies.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded animate-pulse">
                    Risk detected
                  </span>
                )}
              </div>
            </div>
            
            {/* Mini visual indicators block */}
            <div className="flex gap-0.5 items-end h-7 mt-1.5 shrink-0 opacity-55">
              <div className={`w-1.5 h-3 ${stats && stats.anomalies.low > 0 ? 'bg-blue-500' : 'bg-darkBorder'}`} />
              <div className={`w-1.5 h-4.5 ${stats && stats.anomalies.medium > 0 ? 'bg-yellow-500' : 'bg-darkBorder'}`} />
              <div className={`w-1.5 h-6.5 ${stats && stats.anomalies.high > 0 ? 'bg-rose-500' : 'bg-darkBorder'}`} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-3 text-[9px] font-mono text-darkMuted border-t border-darkBorder/40 pt-2.5">
            <span>High: {stats ? stats.anomalies.high : 0} | Med: {stats ? stats.anomalies.medium : 0} | Low: {stats ? stats.anomalies.low : 0}</span>
            <span className="text-rose-400 flex items-center gap-0.5 font-bold">
              <AlertTriangle className="w-3 h-3" /> Audit Warning
            </span>
          </div>
        </Panel>

        {/* Risk Score Radial gauge */}
        <Panel accentColor="text-yellow-500" indicatorColor="bg-yellow-500">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[9px] font-display uppercase font-bold text-darkMuted tracking-wider block">Operational Risk</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-xs font-mono uppercase text-darkMuted font-bold">Risk Index:</span>
                <span className={`text-base font-mono font-bold uppercase ml-1.5 ${stats && stats.risk_score > 50 ? "text-yellow-400" : "text-emerald-400"}`}>
                  {stats && stats.risk_score > 50 ? "Medium" : "Low"}
                </span>
              </div>
            </div>

            {/* Circular progress gauge */}
            {(() => {
              const riskScore = stats ? stats.risk_score : 0;
              const radius = 18;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (riskScore / 100) * circumference;
              
              return (
                <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="22" cy="22" r={radius} stroke="#1b1e28" strokeWidth="2.5" fill="transparent" />
                    <circle 
                      cx="22" 
                      cy="22" 
                      r={radius} 
                      stroke={riskScore > 50 ? "#f59e0b" : "#10b981"} 
                      strokeWidth="3.2" 
                      fill="transparent" 
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-mono text-[9px] font-bold text-gray-200">{riskScore}%</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-1.5 mt-3 text-[9px] font-mono text-darkMuted border-t border-darkBorder/40 pt-2.5">
            <div className="w-full bg-darkBorder/40 h-1 rounded overflow-hidden">
              <div 
                className={`h-full ${stats && stats.risk_score > 50 ? "bg-yellow-500" : "bg-emerald-400"}`} 
                style={{ width: `${stats ? stats.risk_score : 0}%` }} 
              />
            </div>
            <span className="shrink-0 font-mono text-[9px] font-bold">
              SYS STATUS
            </span>
          </div>
        </Panel>
      </div>

      {/* Main layout divided into left grids list and right diagnostic feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Grids list pane (col-span-2) */}
        <Panel className="lg:col-span-2 flex flex-col justify-between min-h-[480px]">
          
          <div className="space-y-4">
            {/* Sub-tab Selector */}
            <div className="flex justify-between items-center border-b border-darkBorder/40 pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => { setActiveSubTab("invoices"); setError(null); }}
                  className={`px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider rounded-none transition-all ${
                    activeSubTab === "invoices"
                      ? "bg-neonTeal/10 text-neonTeal border border-neonTeal/20"
                      : "text-darkMuted hover:text-gray-300"
                  }`}
                >
                  Invoice Catalog
                </button>
                <button
                  onClick={() => { setActiveSubTab("payroll"); setError(null); }}
                  className={`px-3 py-1.5 text-[10px] font-display font-bold uppercase tracking-wider rounded-none transition-all ${
                    activeSubTab === "payroll"
                      ? "bg-neonIndigo/10 text-neonIndigo border border-neonIndigo/20"
                      : "text-darkMuted hover:text-gray-300"
                  }`}
                >
                  Payroll Outlays
                </button>
              </div>

              {/* Filtering / Search */}
              <div className="flex items-center gap-2">
                {activeSubTab === "invoices" && (
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setInvoicePage(1); }}
                      className="bg-darkBg/60 border border-darkBorder/80 rounded-none px-2.5 py-1 text-[10px] font-mono text-gray-300 font-semibold focus:border-neonTeal outline-none transition-all cursor-pointer"
                    >
                      <option value="all">ALL STATUS</option>
                      <option value="validated">VALIDATED</option>
                      <option value="anomaly">ANOMALY</option>
                    </select>
                  </div>
                )}
                
                <div className="relative">
                  <input
                    type="text"
                    placeholder={activeSubTab === "invoices" ? "Search Vendor..." : "Search Employee..."}
                    value={activeSubTab === "invoices" ? invoiceSearch : payrollSearch}
                    onChange={(e) => {
                      if (activeSubTab === "invoices") {
                        setInvoiceSearch(e.target.value);
                        setInvoicePage(1);
                      } else {
                        setPayrollSearch(e.target.value);
                        setPayrollPage(1);
                      }
                    }}
                    className="bg-darkBg/60 border border-darkBorder/80 rounded-none pl-8 pr-3 py-1 text-[10px] font-mono text-gray-300 placeholder:text-darkMuted focus:border-neonTeal outline-none transition-all"
                  />
                  <Search className="w-3 h-3 text-darkMuted absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 bg-rose-950/20 border border-rose-500/20 rounded-none text-[11px] font-mono text-rose-300">
                {error}
              </div>
            )}

            {/* List Panels loading */}
            {loadingData ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-7 h-7 text-neonTeal animate-spin" />
                <p className="text-xs font-mono text-darkMuted">Auditing ledger structures...</p>
              </div>
            ) : activeSubTab === "invoices" ? (
              /* Invoices list panel */
              invoices.length === 0 ? (
                <div className="py-24 text-center border border-dashed border-darkBorder/40 bg-darkPanel/5">
                  <FileText className="w-7 h-7 text-darkMuted mx-auto mb-2.5" />
                  <p className="text-xs font-mono font-semibold text-gray-300">No invoices matching filters found</p>
                  <p className="text-[10px] font-mono text-darkMuted mt-1">Upload and vectorize financial documents to see records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-darkBorder/40 text-darkMuted font-mono font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2.5">Vendor</th>
                        <th className="py-2.5">Invoice #</th>
                        <th className="py-2.5">Total Amount</th>
                        <th className="py-2.5">Due Date</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkBorder/20 font-mono text-[11px]">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-darkPanel/10 transition-colors group">
                          <td className="py-3 font-sans font-semibold text-gray-200 truncate max-w-[135px]">{inv.vendor_name}</td>
                          <td className="py-3 text-gray-300 tracking-tight">{inv.invoice_number || "N/A"}</td>
                          <td className="py-3 font-semibold text-neonTeal">
                            {inv.currency} {inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 text-darkMuted">
                            {inv.due_date || "N/A"}
                          </td>
                          <td className="py-3 font-sans">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase border rounded-none ${
                              inv.status === "validated"
                                ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-950/20 text-rose-400 border-rose-500/20"
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${inv.status === "validated" ? "bg-emerald-400" : "bg-rose-400"}`} />
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 text-right font-sans">
                            <button
                              disabled={actionLoadingId === inv.document_id}
                              onClick={() => handleReprocessDocument(inv.document_id, "invoice")}
                              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-neonTeal hover:bg-neonTeal/10 rounded-none border border-neonTeal/20 disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Re-run structural extraction and validation engine"
                            >
                              {actionLoadingId === inv.document_id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-2.5 h-2.5" />
                              )}
                              Reprocess
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Payroll list panel */
              payroll.length === 0 ? (
                <div className="py-24 text-center border border-dashed border-darkBorder/40 bg-darkPanel/5">
                  <User className="w-7 h-7 text-darkMuted mx-auto mb-2.5" />
                  <p className="text-xs font-mono font-semibold text-gray-300">No payroll statements found</p>
                  <p className="text-[10px] font-mono text-darkMuted mt-1">Upload and vectorize salary statements to see records.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-darkBorder/40 text-darkMuted font-mono font-bold text-[9px] uppercase tracking-wider">
                        <th className="py-2.5">Employee</th>
                        <th className="py-2.5">Basic Salary</th>
                        <th className="py-2.5">Net Pay</th>
                        <th className="py-2.5">Payment Date</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-darkBorder/20 font-mono text-[11px]">
                      {payroll.map((pr) => (
                        <tr key={pr.id} className="hover:bg-darkPanel/10 transition-colors group">
                          <td className="py-3 font-sans font-semibold text-gray-200">{pr.employee_name}</td>
                          <td className="py-3 text-darkMuted">${pr.salary.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 font-semibold text-neonIndigo">
                            ${pr.net_pay.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 text-darkMuted">
                            {pr.payment_date || "N/A"}
                          </td>
                          <td className="py-3 font-sans">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase border rounded-none ${
                              pr.status === "validated"
                                ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-950/20 text-rose-400 border-rose-500/20"
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${pr.status === "validated" ? "bg-emerald-400" : "bg-rose-400"}`} />
                              {pr.status}
                            </span>
                          </td>
                          <td className="py-3 text-right font-sans">
                            <button
                              disabled={actionLoadingId === pr.document_id}
                              onClick={() => handleReprocessDocument(pr.document_id, "payroll")}
                              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-neonIndigo hover:bg-neonIndigo/10 rounded-none border border-neonIndigo/20 disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Re-run structural extraction and validation engine"
                            >
                              {actionLoadingId === pr.document_id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-2.5 h-2.5" />
                              )}
                              Reprocess
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Pagination Controls */}
          {!loadingData && (
            <div className="flex items-center justify-between border-t border-darkBorder/40 pt-4 mt-4 text-[10px] font-mono text-darkMuted">
              <span>
                PAGE {activeSubTab === "invoices" ? invoicePage : payrollPage} /{" "}
                {activeSubTab === "invoices" ? totalInvoicePages : totalPayrollPages}
              </span>
              
              <div className="flex gap-2">
                <button
                  disabled={activeSubTab === "invoices" ? invoicePage === 1 : payrollPage === 1}
                  onClick={() => {
                    if (activeSubTab === "invoices") setInvoicePage(prev => Math.max(1, prev - 1));
                    else setPayrollPage(prev => Math.max(1, prev - 1));
                  }}
                  className="p-1 rounded-none bg-darkBorder/40 hover:bg-darkBorder/80 border border-darkBorder disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-300" />
                </button>
                <button
                  disabled={
                    activeSubTab === "invoices" 
                      ? invoicePage >= totalInvoicePages 
                      : payrollPage >= totalPayrollPages
                  }
                  onClick={() => {
                    if (activeSubTab === "invoices") setInvoicePage(prev => prev + 1);
                    else setPayrollPage(prev => prev + 1);
                  }}
                  className="p-1 rounded-none bg-darkBorder/40 hover:bg-darkBorder/80 border border-darkBorder disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                </button>
              </div>
            </div>
          )}
        </Panel>

        {/* Right Diagnostics Feed & Active Alerts (col-span-1) */}
        <Panel accentColor="text-rose-500" className="flex flex-col space-y-4">
          <div className="border-b border-darkBorder/40 pb-2">
            <span className="text-[11px] font-display font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              Operational Risk Log ({anomalies.length})
            </span>
            <p className="text-[9px] font-mono text-darkMuted uppercase mt-1">Calculation and audit discrepancies</p>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1.5">
            {anomalies.length === 0 ? (
              <div className="py-24 text-center select-none">
                <CheckCircle className="w-7 h-7 text-neonIndigo mx-auto mb-2.5 stroke-1" />
                <p className="text-xs font-display font-bold text-gray-300 uppercase tracking-wide">LEGER AUDITED CLEAN</p>
                <p className="text-[9px] font-mono text-darkMuted mt-1 uppercase">Zero compliance warnings detected.</p>
              </div>
            ) : (
              anomalies.map((anom) => (
                <div 
                  key={anom.id} 
                  className={`p-3.5 border rounded-none space-y-2 bg-darkBg/30 transition-all ${
                    anom.severity === "high" 
                      ? "border-rose-500/30 hover:border-rose-500/50" 
                      : anom.severity === "medium" 
                      ? "border-yellow-500/30 hover:border-yellow-500/50" 
                      : "border-blue-500/30 hover:border-blue-500/50"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider border rounded-none ${
                      anom.severity === "high" 
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                        : anom.severity === "medium" 
                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" 
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    }`}>
                      {anom.severity} RISK
                    </span>
                    <span className="text-[9px] font-mono text-darkMuted font-bold">
                      {anom.rule_name.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>

                  <p className="text-[11px] leading-relaxed text-gray-300 font-sans">
                    {anom.description}
                  </p>

                  <div className="flex justify-between items-center border-t border-darkBorder/20 pt-2.5 mt-2 text-[10px] font-mono text-darkMuted">
                    <span>
                      {anom.invoice_id ? "INVOICE" : "PAYROLL"}
                    </span>
                    
                    <button
                      disabled={actionLoadingId === anom.id}
                      onClick={() => handleResolveAnomaly(anom.id)}
                      className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-white bg-emerald-700 hover:bg-emerald-600 border border-emerald-600/30 rounded-none disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-1"
                    >
                      {actionLoadingId === anom.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <CheckCircle className="w-2.5 h-2.5" />
                      )}
                      Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

      </div>
    </div>
  );
};
