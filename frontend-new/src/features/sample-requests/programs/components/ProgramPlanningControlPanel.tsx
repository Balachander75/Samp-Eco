import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, Trash2, X, Pause, Play, Loader2 } from "lucide-react";

export interface ProgramPlanningControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  onDeleteRequest?: (req: SampleRequestItem) => void;
  readOnly?: boolean;
  canPause?: boolean;
  isTogglingPause?: boolean;
  onTogglePause?: () => void;
  mode?: "marketing" | "sampling" | "plant";
}

export const ProgramPlanningControlPanel: React.FC<ProgramPlanningControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  onDeleteRequest,
  readOnly = false,
  canPause = false,
  isTogglingPause = false,
  onTogglePause,
  mode = "marketing",
}) => {
  const code =
    activeRequest.requestCode ||
    activeRequest.materialCode ||
    (activeRequest.id ? `PP-${activeRequest.id}` : "");

  const isPaused = activeRequest.isActive === false;

  return (
    <header className="px-5 sm:px-6 py-3.5 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-4 shrink-0 shadow-2xs select-text">
      {/* ── Left: Request ID, Title, Customer & Status ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onCopyCode}
          className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)] transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          title="Click to copy program code"
        >
          <span>{code}</span>
          {copiedCode ? (
            <Check className="w-3 h-3 text-emerald-500" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>

        <div className="h-4 w-px bg-[var(--border-subtle)] hidden sm:block shrink-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm md:text-base font-bold text-[var(--on-surface)] truncate font-display">
              {activeRequest.programName || activeRequest.programCampaignTitle || "Annual Program Plan"}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[10.5px] font-semibold shrink-0 ${
                isPaused
                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPaused ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              <span>{isPaused ? "Paused" : "Active"}</span>
            </span>
          </div>
          <p className="text-[11px] text-[var(--on-surface-muted)] font-medium truncate flex items-center gap-1.5 mt-0.5">
            <span className="font-semibold text-[var(--on-surface)]">
              {activeRequest.customer || "General Enterprise"}
            </span>
            <span>·</span>
            <span>FY {activeRequest.programYear || "2026-2027"}</span>
            <span>·</span>
            <span className="font-semibold text-[var(--on-surface)]">
              Plant {activeRequest.targetPlant || "1505"}
            </span>
            {activeRequest.createdBy && (
              <>
                <span className="hidden md:inline">·</span>
                <span className="hidden md:inline text-[var(--on-surface-subtle)] font-mono text-[10.5px]">
                  By {activeRequest.createdBy}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Right: Role indicator & Action buttons ── */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          {mode === "sampling"
            ? "SAMP Lab Desk"
            : mode === "plant"
            ? `Plant ${activeRequest.targetPlant || "1505"}`
            : "Marketing Desk"}
        </span>

        {canPause && onTogglePause && (
          <button
            type="button"
            onClick={onTogglePause}
            disabled={isTogglingPause}
            className="h-8 px-3 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] text-xs font-medium transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title={isPaused ? "Resume program execution" : "Pause program plan"}
          >
            {isTogglingPause ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">{isPaused ? "Resume" : "Pause"}</span>
          </button>
        )}

        {!readOnly && onDeleteRequest && (
          <button
            type="button"
            onClick={() => onDeleteRequest(activeRequest)}
            className="h-8 w-8 rounded-xl border border-[var(--border-subtle)] hover:bg-rose-500/10 hover:border-rose-500/30 text-[var(--on-surface-subtle)] hover:text-rose-500 flex items-center justify-center transition cursor-pointer"
            title="Delete Program Plan"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] flex items-center justify-center transition cursor-pointer"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default ProgramPlanningControlPanel;
