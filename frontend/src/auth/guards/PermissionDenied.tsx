import React, { useState } from "react";
import { ShieldAlert, ArrowLeft, Send, CheckCircle2 } from "lucide-react";

interface PermissionDeniedProps {
  requiredPermission: string;
  onGoBack: () => void;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({ requiredPermission, onGoBack }) => {
  const [justification, setJustification] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) return;

    setLoading(true);
    // Simulate sending elevation request to Admin
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1200);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 animate-fadeIn">
      <div className="max-w-md w-full bg-darkPanel border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500" />
        
        <div className="flex items-center gap-4 border-b border-darkBorder/40 pb-4">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldAlert className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest">ACCESS DENIED</h3>
            <h2 className="text-sm font-semibold text-gray-200 mt-0.5">Authorization Level Insufficient</h2>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-darkMuted">
          <p>
            Your current account credentials lack the permissions needed to load the resource.
          </p>
          <div className="p-3 bg-darkBg border border-darkBorder rounded-lg font-mono text-[10px] space-y-1">
            <span className="text-darkMuted block">REQUIRED POLICY FLAG:</span>
            <span className="text-amber-400 font-bold block">{requiredPermission}</span>
          </div>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 block">
                Access Justification Request
              </label>
              <textarea
                placeholder="Explain why your role requires this authorization level elevation..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                required
                className="w-full bg-darkBg border border-darkBorder rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-darkMuted focus:outline-none focus:border-rose-500 min-h-[70px] resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onGoBack}
                className="px-4 py-2 bg-darkBorder/55 hover:bg-darkBorder border border-darkBorder text-gray-300 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Go Back
              </button>
              <button
                type="submit"
                disabled={loading || !justification.trim()}
                className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/25 hover:border-rose-500 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Request Access
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-3 text-xs animate-scaleUp">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Request Sent Successfully</span>
            </div>
            <p className="text-darkMuted leading-normal">
              An access elevation request has been logged in the security center and dispatched to the platform administrators. You will be notified once reviewed.
            </p>
            <button
              onClick={onGoBack}
              className="w-full py-2 bg-darkPanel hover:bg-darkBorder border border-darkBorder text-gray-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Return to Previous Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
