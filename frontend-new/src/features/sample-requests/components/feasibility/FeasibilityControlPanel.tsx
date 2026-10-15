import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, Trash2, X, ChevronRight, CheckCircle2 } from "lucide-react";

export interface FeasibilityControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  onDeleteRequest?: (req: SampleRequestItem) => void;
}

export const FeasibilityControlPanel: React.FC<FeasibilityControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  onDeleteRequest,
}) => {
  // Stepper state computation
  const isReviewDone = Boolean(activeRequest.samplingFeasibilityResponse);
  const isReviewActive = !isReviewDone;

  const isDecisionDone = Boolean(activeRequest.marketingDecision);
  const isDecisionActive = isReviewDone && !isDecisionDone;

  const isConvertedDone = Boolean(activeRequest.convertedSrNumber);
  const isConvertedActive =
    isDecisionDone && activeRequest.marketingDecision === "Accepted" && !isConvertedDone;

  const steps = [
    {
      label: "1. Intake",
      status: "done" as const,
    },
    {
      label: "2. Technical Review",
      status: isReviewDone
        ? ("done" as const)
        : isReviewActive
        ? ("active" as const)
        : ("pending" as const),
      badge: activeRequest.samplingFeasibilityResponse,
    },
    {
      label: "3. Commercial Sign-Off",
      status: isDecisionDone
        ? ("done" as const)
        : isDecisionActive
        ? ("active" as const)
        : ("pending" as const),
      badge: activeRequest.marketingDecision,
    },
    {
      label: isConvertedDone
        ? `4. Sampling: ${activeRequest.convertedSrNumber}`
        : "4. Sampling Conversion",
      status: isConvertedDone
        ? ("done" as const)
        : isConvertedActive
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
          <span>Save & Close</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface-muted)] px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer"
        >
          Discard
        </button>

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

        <button
          type="button"
          onClick={onCopyCode}
          className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
          title="Copy request code"
        >
          {copiedCode ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-[var(--on-surface-subtle)]" />
          )}
          <span>{copiedCode ? "Copied" : "Copy Code"}</span>
        </button>

        {onDeleteRequest && (
          <button
            type="button"
            onClick={() => onDeleteRequest(activeRequest)}
            className="text-[var(--on-surface-subtle)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
            title="Delete this request"
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
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FeasibilityControlPanel;
