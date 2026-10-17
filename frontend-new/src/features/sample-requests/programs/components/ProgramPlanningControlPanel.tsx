import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, Trash2, X, ChevronRight, CheckCircle2, Pause, Play, Loader2 } from "lucide-react";

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
}) => {
  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());
  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  const steps = [
    {
      label: "1. Campaign Plan",
      status: "done" as const,
    },
    {
      label: "2. SAMP Review",
      status: hasSampNote
        ? ("done" as const)
        : ("active" as const),
      badge: hasSampNote ? "Reviewed" : "Awaiting",
    },
    {
      label: "3. Plant Feasibility",
      status: hasPlantNote
        ? ("done" as const)
        : hasSampNote
        ? ("active" as const)
        : ("pending" as const),
      badge: hasPlantNote ? "Confirmed" : "Awaiting",
    },
    {
      label: "4. Production Ready",
      status: hasSampNote && hasPlantNote
        ? ("done" as const)
        : hasSampNote || hasPlantNote
        ? ("active" as const)
        : ("pending" as const),
    },
  ];

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Left Action Buttons */}
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={onClose}
          className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <span>Close Inspector</span>
        </button>

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

        <button
          type="button"
          onClick={onCopyCode}
          className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
          title="Copy program code"
        >
          {copiedCode ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[var(--on-surface-subtle)]" />
          )}
          <span>{copiedCode ? "Copied" : "Copy Code"}</span>
        </button>

        {canPause && onTogglePause && (
          <button
            type="button"
            onClick={onTogglePause}
            disabled={isTogglingPause}
            className={`font-semibold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition border disabled:opacity-60 disabled:cursor-not-allowed ${
              activeRequest.isActive === false
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 hover:bg-amber-100"
            }`}
            title={activeRequest.isActive === false ? "Resume Program Plan" : "Pause Program Plan"}
          >
            {isTogglingPause ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : activeRequest.isActive === false ? (
              <Play className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Pause className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{activeRequest.isActive === false ? "Resume Program" : "Pause Program"}</span>
          </button>
        )}

        {!readOnly && onDeleteRequest && (
          <button
            type="button"
            onClick={() => onDeleteRequest(activeRequest)}
            className="text-[var(--on-surface-subtle)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
            title="Delete this program planning request"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Right: Modern Workflow Stepper */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 p-1 bg-[var(--surface-low)] rounded-xl border border-[var(--border-subtle)]">
          {steps.map((st, i) => (
            <React.Fragment key={i}>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-sans transition-all select-none ${
                  st.status === "done"
                    ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] font-bold shadow-2xs"
                    : st.status === "active"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--accent-primary)]"
                    : "text-[var(--on-surface-subtle)] font-medium"
                }`}
              >
                {st.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                ) : st.status === "active" ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                )}
                <span>{st.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-[var(--border-strong)] shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Modal Close [X] */}
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition cursor-pointer"
          title="Close (Esc)"
          aria-label="Close inspector modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ProgramPlanningControlPanel;
