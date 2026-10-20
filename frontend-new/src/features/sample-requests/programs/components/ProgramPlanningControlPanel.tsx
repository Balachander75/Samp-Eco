import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, X, Pause, Play, Loader2, Ban } from "lucide-react";

export interface ProgramPlanningControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  readOnly?: boolean;
  canPause?: boolean;
  isTogglingPause?: boolean;
  onTogglePause?: () => void;
  canDismantle?: boolean;
  isDismantling?: boolean;
  onDismantle?: () => void;
  mode?: "marketing" | "sampling" | "plant";
}

export const ProgramPlanningControlPanel: React.FC<ProgramPlanningControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  readOnly: _readOnly = false,
  canPause = false,
  isTogglingPause = false,
  onTogglePause,
  canDismantle = false,
  isDismantling = false,
  onDismantle,
  mode = "marketing",
}) => {
  const code =
    activeRequest.requestCode ||
    activeRequest.materialCode ||
    (activeRequest.id ? `PP-${activeRequest.id}` : "");

  const isDismantled = activeRequest.status === "Dismantled";
  const isPaused = !isDismantled && activeRequest.isActive === false;

  return (
    <header className="px-4 py-2 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0 shadow-2xs select-text">
      {/* ── Left: Request Code & Lifecycle Status Pill Only ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onCopyCode}
          className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          title="Click to copy program code"
        >
          <span>{code}</span>
          {copiedCode ? (
            <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>

        <div className="h-4 w-px bg-[var(--border-subtle)] shrink-0" />

        {/* Status indicator: ACTIVE / PAUSED / DISMANTLED */}
        {isDismantled ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold shrink-0 bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>DISMANTLED</span>
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold shrink-0 ${
              isPaused
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span>{isPaused ? "PAUSED" : "ACTIVE"}</span>
          </span>
        )}
      </div>

      {/* ── Right: Role indicator & Action buttons ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          {mode === "sampling"
            ? "SAMP Desk"
            : mode === "plant"
            ? (activeRequest.targetPlant ? (activeRequest.targetPlant.toLowerCase().startsWith("plant") ? activeRequest.targetPlant : `Plant ${activeRequest.targetPlant}`) : "Plant 1505")
            : "Marketing Desk"}
        </span>

        {/* Pause / Resume Button (Only if not dismantled) */}
        {!isDismantled && canPause && onTogglePause && (
          <button
            type="button"
            onClick={onTogglePause}
            disabled={isTogglingPause}
            className="h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] text-xs font-medium transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-2xs"
            title={isPaused ? "Resume program execution" : "Pause program plan"}
          >
            {isTogglingPause ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isPaused ? (
              <Play className="w-3 h-3 text-emerald-600" />
            ) : (
              <Pause className="w-3 h-3 text-amber-600" />
            )}
            <span className="hidden md:inline text-[11px] font-semibold">{isPaused ? "Resume" : "Pause"}</span>
          </button>
        )}

        {/* Dismantle Program Button (Permanent termination) */}
        {!isDismantled && canDismantle && onDismantle && (
          <button
            type="button"
            onClick={onDismantle}
            disabled={isDismantling}
            className="h-7 px-3 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-2xs"
            title="Permanently dismantle this program plan"
          >
            {isDismantling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
            ) : (
              <Ban className="w-3.5 h-3.5 text-rose-600" />
            )}
            <span className="text-[11px] font-bold">Dismantle</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] flex items-center justify-center transition cursor-pointer active:scale-95"
          title="Close Inspector (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};

export default ProgramPlanningControlPanel;
