import React from "react";
import { Cpu, Cloud, HardDrive, BrainCircuit } from "lucide-react";

type MethodType = "live" | "mock" | null | undefined;

interface MethodHudBadgeProps {
  /** "extract" for AI extraction, "vector" for indexing */
  kind: "extract" | "vector";
  method: MethodType;
}

/**
 * Cyber-Industrial HUD chip showing whether an operation ran against
 * the live model (OpenAI/BAAI via API) or the local mock engine.
 *
 * Design language: retro-futuristic monospace, amber = mock, emerald = live.
 */
export const MethodHudBadge: React.FC<MethodHudBadgeProps> = ({ kind, method }) => {
  if (!method) return null;

  const isLive = method === "live";

  const kindLabel = kind === "extract" ? "EXTRACT" : "VECTOR";
  const engineLabel =
    kind === "extract"
      ? isLive
        ? "OpenAI · Live"
        : "Mock Engine"
      : isLive
      ? "BAAI · Live"
      : "Mock Engine";

  const Icon =
    kind === "extract"
      ? isLive
        ? Cloud
        : BrainCircuit
      : isLive
      ? Cpu
      : HardDrive;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest rounded border transition-all select-none ${
        isLive
          ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-300"
          : "bg-amber-950/20 border-amber-500/25 text-amber-400"
      }`}
      title={`${kindLabel}: ${engineLabel}`}
    >
      <span
        className={`w-1 h-1 rounded-full ${
          isLive ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
        }`}
      />
      <Icon className="w-2.5 h-2.5" />
      {kindLabel}:{" "}
      <span className={isLive ? "text-emerald-200" : "text-amber-300"}>
        {engineLabel}
      </span>
    </span>
  );
};
