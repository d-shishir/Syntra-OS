import React from "react";

interface IndexingStatusBadgeProps {
  isVectorized?: boolean;
  indexingMethod?: "live" | "mock" | null;
  compact?: boolean;
}

export const IndexingStatusBadge: React.FC<IndexingStatusBadgeProps> = ({
  isVectorized,
  indexingMethod,
  compact = false,
}) => {
  if (isVectorized) {
    const methodLabel = indexingMethod === "live" ? "BAAI · Live" : indexingMethod === "mock" ? "Mock" : null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-emerald-950/10 text-emerald-400 border border-emerald-500/10">
        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
        Vectorized
        {!compact && methodLabel && (
          <span className="ml-1 px-1 py-px rounded text-[8px] bg-emerald-900/30 text-emerald-300 border border-emerald-600/20">
            {methodLabel}
          </span>
        )}
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-amber-950/10 text-amber-500 border border-amber-500/10">
        <span className="w-1 h-1 rounded-full bg-amber-500" />
        Pending Index
      </span>
    );
  }
};
