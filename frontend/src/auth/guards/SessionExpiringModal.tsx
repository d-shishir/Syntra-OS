import React from "react";
import { Clock, LogOut, RefreshCw } from "lucide-react";

interface SessionExpiringModalProps {
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionExpiringModal: React.FC<SessionExpiringModalProps> = ({
  timeRemaining,
  onExtend,
  onLogout,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-md w-full bg-darkPanel border border-darkBorder rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden animate-scaleIn">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-red-500 animate-pulse" />

        <div className="flex items-center gap-3 border-b border-darkBorder/40 pb-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Clock className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
              SESSION EXPIRING
            </h3>
            <h2 className="text-sm font-semibold text-gray-200 mt-0.5">
              Enterprise Session Lifetime Limit
            </h2>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-darkMuted leading-relaxed">
          <p>
            Due to secure enterprise access policies, your operational session will automatically terminate in:
          </p>

          <div className="py-4 text-center bg-darkBg/60 border border-darkBorder/80 rounded-xl">
            <span className="font-mono text-3xl font-extrabold text-amber-400">
              {timeRemaining}s
            </span>
            <span className="block text-[9px] font-mono uppercase tracking-widest text-darkMuted mt-1">
              UNTIL AUTO-LOCKOUT
            </span>
          </div>

          <p>
            Please extend your session authentication token to preserve unsaved configurations and active workflows.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-darkBorder/40">
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-darkBorder/55 hover:bg-rose-500/10 text-darkMuted hover:text-rose-400 border border-darkBorder hover:border-rose-500/35 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Now
          </button>
          <button
            onClick={onExtend}
            className="px-4 py-2 bg-neonIndigo hover:bg-neonIndigo/85 text-white rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Extend Session
          </button>
        </div>
      </div>
    </div>
  );
};
