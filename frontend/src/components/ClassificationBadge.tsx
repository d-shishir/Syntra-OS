import React from "react";

interface ClassificationBadgeProps {
  documentType?: string;
}

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({ documentType }) => {
  switch (documentType) {
    case "invoice":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-amber-950/20 text-amber-400 border border-amber-500/20">
          Invoice
        </span>
      );
    case "payroll":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-emerald-950/20 text-emerald-400 border border-emerald-500/20">
          Payroll
        </span>
      );
    case "generic":
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-blue-950/20 text-blue-400 border border-blue-500/20">
          Generic
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded bg-darkBorder/60 text-darkMuted border border-darkBorder/80">
          Analyzing
        </span>
      );
  }
};
