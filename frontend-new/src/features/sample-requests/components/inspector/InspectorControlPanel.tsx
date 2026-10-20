import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, Send, X, ChevronRight, CheckCircle2 } from "lucide-react";

export interface InspectorControlPanelProps {
  request: SampleRequestItem;
  activeRequest: SampleRequestItem;
  trackType: string | null;
  copiedCode: boolean;
  isConverting: boolean;
  isReleasing: boolean;
  isSubmitting: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  onReleaseDraft?: (request: SampleRequestItem) => Promise<void> | void;
  onConvertToSampling: () => Promise<void>;
  onMarketingFinalApprove: (approved: boolean, remark?: string) => Promise<void>;
  setIsReleasing: (val: boolean) => void;
}

export const InspectorControlPanel: React.FC<InspectorControlPanelProps> = ({
  request,
  activeRequest,
  trackType,
  copiedCode,
  isConverting,
  isReleasing,
  readOnly = false,
  onClose,
  onCopyCode,
  onReleaseDraft,
  onConvertToSampling,
  setIsReleasing,
}) => {
  const isDraft =
    String(request.status || "").toLowerCase().includes("draft") ||
    String(request.status || "").toLowerCase().includes("smt") ||
    String(request.status || "").toLowerCase().includes("pending allocation");

  // Dynamic Stepper Computation based on track type
  const steps = React.useMemo(() => {
    if (trackType === "feasibility_check") {
      const isReviewDone = Boolean(activeRequest.samplingFeasibilityResponse);
      const isDecisionDone = Boolean(activeRequest.marketingDecision);
      const convertedCode = activeRequest.convertedRequestCode || activeRequest.convertedSrNumber;
      const isConvertedDone = Boolean(convertedCode || activeRequest.convertedSampleRequestId);

      return [
        { label: "1. Scope & Intake", status: "done" as const },
        {
          label: "2. Technical Review",
          status: isReviewDone ? ("done" as const) : ("active" as const),
        },
        {
          label: "3. Commercial Sign-off",
          status: isDecisionDone
            ? ("done" as const)
            : isReviewDone
            ? ("active" as const)
            : ("pending" as const),
        },
        {
          label: isConvertedDone
            ? `4. Commercial Request: ${convertedCode || "Created"}`
            : "4. Commercial Request",
          status: isConvertedDone
            ? ("done" as const)
            : isDecisionDone && activeRequest.marketingDecision === "Accepted"
            ? ("active" as const)
            : ("pending" as const),
        },
      ];
    }

    if (trackType === "program_planning") {
      return [
        { label: "1. Seasonal Master", status: "done" as const },
        { label: "2. Material Matrix", status: "active" as const },
        { label: "3. Capacity Review", status: "pending" as const },
        { label: "4. Plant Scheduled", status: "pending" as const },
      ];
    }

    // Default Commercial Sampling Steps
    const statusLower = String(activeRequest.status || "").toLowerCase();
    const isCreative =
      statusLower.includes("creative") || statusLower.includes("design");
    const isCAD = statusLower.includes("studio") || statusLower.includes("cad");
    const isCosting =
      statusLower.includes("costing") || statusLower.includes("bom");
    const isLab =
      statusLower.includes("samp") || statusLower.includes("sampling");
    const isPlant =
      statusLower.includes("plant") || statusLower.includes("execution");
    const isClosed =
      statusLower.includes("dispatched") ||
      statusLower.includes("deal") ||
      statusLower.includes("closed");

    const stage2Done = isCosting || isLab || isPlant || isClosed;
    const stage2Active = isCreative || isCAD;

    const stage3Done = isPlant || isClosed;
    const stage3Active = isCosting || isLab;

    const stage4Done = isClosed;
    const stage4Active = isPlant;

    return [
      { label: "1. Intake & Specs", status: isDraft ? ("active" as const) : ("done" as const) },
      {
        label: "2. Creative & CAD",
        status: stage2Done
          ? ("done" as const)
          : stage2Active
          ? ("active" as const)
          : ("pending" as const),
      },
      {
        label: "3. Costing & Sampling",
        status: stage3Done
          ? ("done" as const)
          : stage3Active
          ? ("active" as const)
          : ("pending" as const),
      },
      {
        label: "4. Plant Floor",
        status: stage4Done
          ? ("done" as const)
          : stage4Active
          ? ("active" as const)
          : ("pending" as const),
      },
    ];
  }, [trackType, activeRequest, isDraft]);

  return (
    <div className="bg-[var(--surface-base)] border-b border-[var(--border-subtle)] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-[0_2px_12px_rgba(11,28,48,0.02)]">
      {/* Left Action Buttons */}
      <div className="flex items-center space-x-2 flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-4 py-1.5 rounded-xl text-xs font-display font-semibold flex items-center space-x-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
        >
          <span>{readOnly ? "Close" : "Save & Close"}</span>
        </button>

        {!readOnly && <button
          type="button"
          onClick={onClose}
          className="bg-slate-100/70 hover:bg-slate-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60 text-slate-700 dark:text-zinc-300 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer"
        >
          Discard
        </button>}

        {/* Draft Release Action */}
        {!readOnly && isDraft && onReleaseDraft && (
          <button
            type="button"
            onClick={async () => {
              setIsReleasing(true);
              try {
                await onReleaseDraft(request);
              } finally {
                setIsReleasing(false);
              }
            }}
            disabled={isReleasing}
            className="text-white px-3.5 py-1.5 rounded-xl text-xs font-display font-semibold flex items-center space-x-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            <Send className={`w-3.5 h-3.5 ${isReleasing ? "" : ""}`} />
            <span>{isReleasing ? "Releasing..." : "Release to Workflow"}</span>
          </button>
        )}

        {/* Feasibility Conversion Shortcut */}
        {!readOnly && trackType === "feasibility_check" &&
          activeRequest.marketingDecision === "Accepted" &&
          !activeRequest.convertedRequestCode && !activeRequest.convertedSrNumber && !activeRequest.convertedSampleRequestId && (
            <button
              type="button"
              onClick={onConvertToSampling}
              disabled={isConverting}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-3.5 py-1.5 rounded-xl text-xs font-display font-semibold flex items-center space-x-1.5 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span>{isConverting ? "Creating Request..." : "Convert to Commercial Request"}</span>
            </button>
          )}

        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1" />

        <button
          type="button"
          onClick={onCopyCode}
          className="text-slate-600 hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary-subtle)] font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
          title="Copy reference code"
        >
          {copiedCode ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{copiedCode ? "Copied" : "Copy Code"}</span>
        </button>

      </div>

      {/* Right: Modern Luminous Workflow Stepper (Replacing Old Polygon Chevrons) */}
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 p-1 bg-slate-100/60 dark:bg-white/5 rounded-xl">
          {steps.map((st, i) => (
            <React.Fragment key={i}>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-display transition-all select-none ${
                  st.status === "done"
                    ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                    : st.status === "active"
                    ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-bold shadow-xs ring-1 ring-[var(--accent-primary)]/40"
                    : "text-slate-400 dark:text-zinc-500 font-medium"
                }`}
              >
                {st.status === "done" ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                ) : st.status === "active" ? (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
                )}
                <span>{st.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-300 dark:text-zinc-700 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Modal Close [X] */}
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InspectorControlPanel;
