import React from "react";
import { SampleRequestItem } from "../../types";
import { Copy, Check, X, CheckCircle2, ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";

export interface FeasibilityControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  mode?: "marketing" | "samp";
}

export const FeasibilityControlPanel: React.FC<FeasibilityControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  mode = "marketing",
}) => {
  const code =
    activeRequest.materialCode ||
    activeRequest.requestCode ||
    (activeRequest.id ? `FC-${String(activeRequest.id).padStart(4, "0")}` : "FC-0000");

  // Stepper state computation
  const isReviewDone = Boolean(activeRequest.samplingFeasibilityResponse);
  const isReviewActive = !isReviewDone;

  const isDecisionDone = Boolean(activeRequest.marketingDecision);
  const isDecisionActive = isReviewDone && !isDecisionDone;

  const convertedCode = activeRequest.convertedRequestCode || activeRequest.convertedSrNumber;
  const isConvertedDone = Boolean(convertedCode || activeRequest.convertedSampleRequestId);
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
      label: "3. Commercial Decision",
      status: isDecisionDone
        ? ("done" as const)
        : isDecisionActive
        ? ("active" as const)
        : ("pending" as const),
      badge: activeRequest.marketingDecision,
    },
    {
      label: isConvertedDone
        ? `4. Converted: ${convertedCode || "Created"}`
        : "4. Conversion",
      status: isConvertedDone
        ? ("done" as const)
        : isConvertedActive
        ? ("active" as const)
        : ("pending" as const),
    },
  ];

  return (
    <header className="px-4 py-2.5 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0 shadow-2xs select-text">
      {/* ── Left: Request ID, Customer, Classification & Status ── */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onCopyCode}
          className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          title="Click to copy request code"
        >
          <span>{code}</span>
          {copiedCode ? (
            <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>

        <div className="h-3.5 w-px bg-[var(--border-subtle)] hidden sm:block shrink-0" />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-[var(--on-surface)] truncate font-display tracking-tight">
              {activeRequest.customer || "Client Feasibility Check"}
            </h1>
            <span className="hidden sm:inline-block max-w-[130px] truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.2 font-mono text-[10px] font-semibold text-[var(--on-surface)]">
              {activeRequest.customFeasibilityType || activeRequest.feasibilityType || "New Scope"}
            </span>
            {activeRequest.status && (
              <StatusPill
                status={activeRequest.status}
                tone={
                  activeRequest.status.toLowerCase().includes("yes") || activeRequest.status.toLowerCase().includes("accepted")
                    ? "success"
                    : activeRequest.status.toLowerCase().includes("no") || activeRequest.status.toLowerCase().includes("rejected")
                    ? "danger"
                    : activeRequest.status.toLowerCase().includes("maybe")
                    ? "info"
                    : "warning"
                }
                size="xs"
              />
            )}
          </div>
          <div className="text-[10.5px] text-[var(--on-surface-muted)] truncate flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[var(--on-surface)]">
              Target: {activeRequest.sampleRequiredDate || "Flexible"}
            </span>
            {activeRequest.takenBySamp && (
              <>
                <span className="opacity-40">·</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  SAMP: {activeRequest.takenBySamp}
                </span>
              </>
            )}
            {activeRequest.createdBy && (
              <>
                <span className="hidden md:inline opacity-40">·</span>
                <span className="hidden md:inline text-[var(--on-surface-subtle)] font-mono text-[10px]">
                  Raised by {activeRequest.createdBy}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Stepper & Close Action ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Stepper */}
        <div className="hidden lg:flex items-center gap-1 p-0.5 bg-[var(--surface-low)] rounded-xl border border-[var(--border-subtle)]">
          {steps.map((st, i) => (
            <React.Fragment key={i}>
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-sans transition-all select-none ${
                  st.status === "done"
                    ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] font-bold shadow-2xs"
                    : st.status === "active"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--accent-primary)]"
                    : "text-[var(--on-surface-subtle)] font-medium"
                }`}
              >
                {st.status === "done" ? (
                  <CheckCircle2 className="w-3 h-3 text-[var(--accent-primary)]" />
                ) : st.status === "active" ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                )}
                <span>{st.label}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-2.5 h-2.5 text-[var(--border-strong)] shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>

        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          {mode === "samp" ? "SAMP Lab" : "Marketing Desk"}
        </span>

        {/* Modal Close [X] */}
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition cursor-pointer active:scale-95 shadow-2xs"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default FeasibilityControlPanel;
