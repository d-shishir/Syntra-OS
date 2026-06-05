import React, { useEffect, useState, useCallback } from "react";
import {
  DollarSign, FileText, Clipboard, ShieldAlert, CheckCircle2,
  TrendingUp, Activity, Search, RefreshCw, Layers, ArrowUpRight,
  AlertTriangle, Check, X, Shield, Play, Lock, Settings, BarChart2
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

interface Invoice {
  id: string;
  vendor_name: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  currency: string;
  due_date?: string;
}

interface PayrollBatch {
  id: string;
  name: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_at: string;
}

interface Vendor {
  id: string;
  name: string;
  status: string;
  risk_score: number;
  payment_method: string;
}

interface Anomaly {
  source_type: string;
  source_id: string;
  rule_name: string;
  severity: string;
  risk_score: number;
  description: string;
}

interface FinanceStats {
  total_invoice_volume: number;
  invoices_processed_count: number;
  total_payroll_volume: number;
  anomaly_count: number;
  active_discrepancies: number;
  scheduled_payouts_count: number;
  completed_payouts_count: number;
  reconciliation_health_score: number;
  automation_hours_saved: number;
}

export const FinanceStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"invoices" | "payroll" | "vendors" | "anomalies" | "reconcile" | "analytics">("invoices");
  
  // API States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [reconReport, setReconReport] = useState<any | null>(null);

  // Form States
  const [newVendorName, setNewVendorName] = useState("");
  const [newBatchName, setNewBatchName] = useState("Payroll Batch June");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [batchAudits, setBatchAudits] = useState<any[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFinanceData = useCallback(async () => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    setRefreshing(true);
    const headers = { "Authorization": `Bearer ${token}` };

    try {
      const [invRes, batRes, venRes, anomRes, statRes, reconRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/v1/finance/invoices?vendor=${searchQuery}`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/finance/payroll/batches`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/finance/vendors`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/finance/anomalies`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/finance/analytics`, { headers }),
        fetch(`${BACKEND_URL}/api/v1/finance/reconcile`, { headers })
      ]);

      if (invRes.ok) setInvoices(await invRes.ok ? await invRes.json() : []);
      if (batRes.ok) setBatches(await batRes.json());
      if (venRes.ok) setVendors(await venRes.json());
      if (anomRes.ok) {
        const data = await anomRes.json();
        setAnomalies(data.anomalies || []);
      }
      if (statRes.ok) setStats(await statRes.json());
      if (reconRes.ok) setReconReport(await reconRes.json());

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchFinanceData();
  }, [fetchFinanceData]);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/finance/vendors/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: newVendorName })
      });
      if (res.ok) {
        setNewVendorName("");
        alert("Vendor profile created successfully!");
        fetchFinanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePayrollBatch = async () => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      // Simulate grouping existing payroll record IDs (mocked array here)
      const res = await fetch(`${BACKEND_URL}/api/v1/finance/payroll/batches/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newBatchName,
          record_ids: ["00000000-0000-0000-0000-000000000000"]
        })
      });
      if (res.ok) {
        alert("Payroll review batch registered!");
        fetchFinanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleValidateBatch = async (batchId: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/finance/payroll/batches/${batchId}/validate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBatchAudits(data.audits);
        alert(`Validation Audit Finished. Status: ${data.status}`);
        fetchFinanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSchedulePayment = async (invoiceId: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/finance/invoices/${invoiceId}/schedule-payment`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Payment scheduled for next payroll ledger run.");
        fetchFinanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReprocessInvoiceStatus = async (invoiceId: string, targetStatus: string) => {
    const token = localStorage.getItem("syntra_token");
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/finance/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.ok) {
        alert(`Invoice status updated to ${targetStatus}`);
        fetchFinanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev.toLowerCase()) {
      case "critical": return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "high": return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      default: return "bg-sky-500/10 text-sky-400 border border-sky-500/20";
    }
  };

  const getInvoiceStatusClass = (status: string) => {
    switch (status) {
      case "Paid": return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
      case "Approved": return "text-sky-400 border-sky-500/20 bg-sky-500/10";
      case "Under Review": return "text-purple-400 border-purple-500/20 bg-purple-500/10";
      case "Rejected": return "text-rose-400 border-rose-500/20 bg-rose-500/10";
      default: return "text-gray-400 border-gray-500/20 bg-gray-500/10";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 text-neonIndigo animate-spin mx-auto" />
          <p className="text-xs text-darkMuted">Auditing Financial Registers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-darkBorder/60 pb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-display font-black text-gray-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-neonIndigo" />
            Payroll & Invoice Automation Studio
          </h2>
          <p className="text-xs text-darkMuted mt-1">
            Enterprise financial operations: invoice extraction pipelines, automated payroll validators, bank reconciliation, and anomaly risk engines.
          </p>
        </div>

        <button
          onClick={fetchFinanceData}
          disabled={refreshing}
          className="p-2 border border-darkBorder bg-darkPanel/20 text-darkMuted hover:text-gray-200 rounded-lg flex items-center gap-2 cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span className="text-xs">Audit Registers</span>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex border-b border-darkBorder/60 text-xs font-semibold gap-1">
        {(["invoices", "payroll", "vendors", "anomalies", "reconcile", "analytics"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 capitalize transition-all border-b-2 -mb-[2px] cursor-pointer ${
              activeTab === tab 
                ? "border-neonIndigo text-neonIndigo" 
                : "border-transparent text-darkMuted hover:text-gray-200"
            }`}
          >
            {tab === "reconcile" ? "Bank Reconciliation" : tab === "anomalies" ? "Anomaly Risk Dashboard" : tab === "payroll" ? "Payroll Center" : tab === "invoices" ? "Invoice Center" : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "invoices" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Main List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Invoice Registry</span>
              <div className="relative text-xs">
                <Search className="w-3.5 h-3.5 text-darkMuted absolute left-2.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by vendor name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-darkBg border border-darkBorder rounded-lg pl-8 pr-3 py-1.5 focus:outline-none"
                />
              </div>
            </div>

            <div className="border border-darkBorder rounded-xl overflow-hidden bg-darkPanel/15">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-darkBorder bg-darkBg/60 text-darkMuted font-mono">
                    <th className="p-3">Vendor / Invoice</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-darkMuted">No invoices registered. Use the Document Upload pipeline to audit financial files.</td>
                    </tr>
                  ) : (
                    invoices.map(inv => (
                      <tr 
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className={`border-b border-darkBorder/60 hover:bg-darkBorder/10 cursor-pointer transition-colors ${
                          selectedInvoice?.id === inv.id ? "bg-darkBorder/20" : ""
                        }`}
                      >
                        <td className="p-3 font-semibold text-gray-200">
                          <div>{inv.vendor_name}</div>
                          <div className="text-[10px] text-darkMuted font-mono font-normal">#{inv.invoice_number}</div>
                        </td>
                        <td className="p-3 font-mono">${inv.total_amount?.toLocaleString()} {inv.currency || "USD"}</td>
                        <td className="p-3 text-darkMuted">{inv.due_date || "2026-07-01"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${getInvoiceStatusClass(inv.status)}`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSchedulePayment(inv.id); }}
                            disabled={inv.status === "Paid" || inv.status === "Approved"}
                            className="px-2 py-1 text-[9px] font-bold bg-neonTeal/10 hover:bg-neonTeal text-neonTeal hover:text-white border border-neonTeal/20 rounded cursor-pointer disabled:opacity-50"
                          >
                            Schedule Payout
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="space-y-4">
            {selectedInvoice ? (
              <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center border-b border-darkBorder/50 pb-3">
                  <h3 className="text-sm font-bold text-gray-100">Invoice Details</h3>
                  <button onClick={() => setSelectedInvoice(null)} className="p-1 text-darkMuted hover:text-gray-200 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-darkBorder/40 py-1.5">
                    <span className="text-darkMuted">Vendor</span>
                    <span className="text-gray-200 font-semibold">{selectedInvoice.vendor_name}</span>
                  </div>
                  <div className="flex justify-between border-b border-darkBorder/40 py-1.5">
                    <span className="text-darkMuted">Invoice Number</span>
                    <span className="text-gray-200 font-mono">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-darkBorder/40 py-1.5">
                    <span className="text-darkMuted">Total Amount</span>
                    <span className="text-gray-200 font-mono">${selectedInvoice.total_amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-darkBorder/40 py-1.5">
                    <span className="text-darkMuted">Status</span>
                    <span className="text-gray-200">{selectedInvoice.status}</span>
                  </div>
                </div>

                {/* Operations */}
                <div className="space-y-2 text-xs pt-2">
                  <span className="text-[9px] font-mono uppercase text-darkMuted block">Invoice Actions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReprocessInvoiceStatus(selectedInvoice.id, "Approved")}
                      className="py-1.5 bg-sky-500 hover:bg-sky-500/85 text-white font-semibold rounded text-[11px] cursor-pointer"
                    >
                      Authorize Payment
                    </button>
                    <button
                      onClick={() => handleReprocessInvoiceStatus(selectedInvoice.id, "Rejected")}
                      className="py-1.5 bg-rose-500 hover:bg-rose-500/85 text-white font-semibold rounded text-[11px] cursor-pointer"
                    >
                      Reject Payment
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl bg-darkPanel/5">
                Select an invoice row to verify line details, trigger approvals, or process status re-runs.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "payroll" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Main List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Payroll Review Batches</span>
              
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="bg-darkBg border border-darkBorder rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none"
                />
                <button
                  onClick={handleCreatePayrollBatch}
                  className="px-3 py-1 bg-neonIndigo text-white rounded-lg text-xs font-semibold hover:bg-neonIndigo/85 cursor-pointer transition-all"
                >
                  Create Batch
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {batches.map(b => (
                <div 
                  key={b.id}
                  onClick={() => { setSelectedBatch(b); setBatchAudits(null); }}
                  className={`p-4 border rounded-xl bg-darkPanel/10 space-y-3 cursor-pointer hover:border-darkBorder transition-all ${
                    selectedBatch?.id === b.id ? "border-neonIndigo" : "border-darkBorder/60"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-200 font-mono text-xs">{b.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      b.status === "Approved" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {b.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-darkMuted border-t border-darkBorder/40 pt-2">
                    <div>Gross: <span className="text-gray-200">${b.total_gross?.toLocaleString()}</span></div>
                    <div>Deductions: <span className="text-gray-200">${b.total_deductions?.toLocaleString()}</span></div>
                    <div>Net: <span className="text-gray-200">${b.total_net?.toLocaleString()}</span></div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleValidateBatch(b.id); }}
                      className="flex-1 py-1.5 bg-darkBorder hover:bg-darkBorder/80 text-gray-200 rounded font-semibold text-[10px] cursor-pointer"
                    >
                      Audit Batch
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audits Sidebar */}
          <div>
            {selectedBatch && batchAudits ? (
              <div className="p-5 border border-darkBorder rounded-xl bg-darkPanel/10 space-y-4 animate-fadeIn">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Compliance Verification Checks
                </h3>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 text-[11px] font-mono">
                  {batchAudits.map((a, idx) => (
                    <div key={idx} className={`p-2.5 rounded border-l-2 ${getSeverityBadgeClass(a.severity)}`}>
                      <div className="font-bold">{a.type}</div>
                      <p className="text-[10px] text-gray-300 font-sans mt-0.5">{a.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl bg-darkPanel/5">
                Run an audit check on a payroll batch to check for negative balances, rate spikes, or duplicate payment warnings.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "vendors" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn">
          {/* Main List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Vendor Directory</span>
              
              <form onSubmit={handleCreateVendor} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New vendor name..."
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  className="bg-darkBg border border-darkBorder rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-neonIndigo text-white rounded-lg text-xs font-semibold hover:bg-neonIndigo/85 cursor-pointer"
                >
                  Add Vendor
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {vendors.map(v => (
                <div key={v.id} className="p-4 border border-darkBorder/60 bg-darkPanel/10 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-200">{v.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      v.status === "Active" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                    }`}>
                      {v.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-darkMuted">
                    <div>Method: <span className="text-gray-300 capitalize">{v.payment_method.replace('_', ' ')}</span></div>
                    <div className="mt-1">Risk score: <span className={`font-bold ${v.risk_score > 50 ? "text-rose-400" : "text-emerald-400"}`}>{v.risk_score}/100</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "anomalies" && (
        <div className="space-y-4 animate-fadeIn">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200 block">System Anomalies Board</span>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.length === 0 ? (
              <div className="md:col-span-2 p-12 text-center text-xs text-darkMuted border border-dashed border-darkBorder rounded-xl">No active policy warnings detected. System operation health nominal.</div>
            ) : (
              anomalies.map((anom, idx) => (
                <div key={idx} className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl flex items-start gap-3 text-xs font-mono">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-200">{anom.rule_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${getSeverityBadgeClass(anom.severity)}`}>
                        {anom.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-darkMuted font-sans leading-relaxed">{anom.description}</p>
                    <span className="text-[9px] text-darkMuted block pt-1 border-t border-darkBorder/40">Risk Index: {anom.risk_score}/100</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "reconcile" && reconReport && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-darkBorder/50 pb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">Reconciliation Report Summary</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
              reconReport.reconciliation_status === "Balanced" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}>
              {reconReport.reconciliation_status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-darkPanel/10 border border-darkBorder rounded-lg">
              <span className="text-darkMuted block">Processed Items</span>
              <span className="text-lg font-bold text-gray-200">{reconReport.total_records_processed}</span>
            </div>
            <div className="p-3 bg-darkPanel/10 border border-darkBorder rounded-lg">
              <span className="text-darkMuted block">Reconciled (Matched)</span>
              <span className="text-lg font-bold text-emerald-400">{reconReport.reconciled_count}</span>
            </div>
            <div className="p-3 bg-darkPanel/10 border border-darkBorder rounded-lg">
              <span className="text-darkMuted block">Mismatches</span>
              <span className="text-lg font-bold text-rose-400">{reconReport.mismatches_count}</span>
            </div>
          </div>

          {reconReport.mismatches?.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-darkMuted block">Ledger Mismatches List</span>
              <div className="space-y-2 text-xs font-mono">
                {reconReport.mismatches.map((m: any, idx: number) => (
                  <div key={idx} className="p-3 bg-darkBg border border-darkBorder rounded-lg space-y-1">
                    <span className="text-rose-400 font-bold">{m.type}</span>
                    <p className="text-gray-300 font-sans">{m.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "analytics" && stats && (
        <div className="space-y-6 animate-fadeIn">
          {/* Visual indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-darkMuted block">Total Audited Volume</span>
              <span className="text-2xl font-bold text-gray-200">${stats.total_invoice_volume?.toLocaleString()}</span>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-darkMuted block">Completed Payouts</span>
              <span className="text-2xl font-bold text-emerald-400">{stats.completed_payouts_count}</span>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-darkMuted block">Reconciliation Health</span>
              <span className="text-2xl font-bold text-neonTeal">{stats.reconciliation_health_score}%</span>
            </div>
            <div className="p-4 border border-darkBorder bg-darkPanel/10 rounded-xl space-y-1">
              <span className="text-darkMuted block">Hours Saved</span>
              <span className="text-2xl font-bold text-neonIndigo">{stats.automation_hours_saved} hrs</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
