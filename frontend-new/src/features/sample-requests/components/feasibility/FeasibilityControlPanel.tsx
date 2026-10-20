import React from "react";
import { SampleRequestItem } from "../../types";
import {
  Copy,
  Check,
  X,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Briefcase,
  AlertCircle,
  Clock,
} from "lucide-react";

export interface FeasibilityControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  mode?: "marketing" | "samp";
  activeTab?: "specs" | "review" | "decision";
  onSelectTab?: (tab: "specs" | "review" | "decision") => void;
}

export const FeasibilityControlPanel: React.FC<FeasibilityControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  mode = "marketing",
  activeTab = "specs",
  onSelectTab,
}) => {
  const code =
    activeRequest.materialCode ||
    activeRequest.requestCode ||
    (activeRequest.id ? `FC-${String(activeRequest.id).padStart(4, "0")}` : "FC-0000");

  const isSampMode = mode === "samp";

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
      tabId: "specs" as const,
      label: "1. Scope & Specs",
      status: "done" as const,
      isActiveTab: activeTab === "specs",
    },
    {
      tabId: "review" as const,
      label: isReviewDone
        ? `2. Review: ${activeRequest.samplingFeasibilityResponse}`
        : "2. Sampling Review",
      status: isReviewDone
        ? ("done" as const)
        : isReviewActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: isSampMode && isReviewActive,
      isActiveTab: activeTab === "review",
    },
    {
      tabId: "decision" as const,
      label: isDecisionDone
        ? `3. Decision: ${activeRequest.marketingDecision}`
        : "3. Commercial Decision",
      status: isDecisionDone
        ? ("done" as const)
        : isDecisionActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: !isSampMode && isDecisionActive,
      isActiveTab: activeTab === "decision",
    },
    {
      tabId: "decision" as const,
      label: isConvertedDone
        ? `4. Converted`
        : "4. Conversion",
      status: isConvertedDone
        ? ("done" as const)
        : isConvertedActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: !isSampMode && isConvertedActive,
      isActiveTab: false,
    },
  ];

  // Role-specific status pill for top bar
  const getRoleStatusIndicator = () => {
    if (isSampMode) {
      if (activeRequest.samplingFeasibilityResponse) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Verdict: {activeRequest.samplingFeasibilityResponse}
          </span>
        );
      }
      if (activeRequest.counterDateDecision === "pending") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Date Proposal Pending
          </span>
        );
      }
      if (activeRequest.takenBySamp) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
            Assigned: {activeRequest.takenBySamp}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" />
          Claim Required
        </span>
      );
    } else {
      // Marketing mode
      if (activeRequest.marketingDecision) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            {activeRequest.marketingDecision}
          </span>
        );
      }
      if (activeRequest.counterDateDecision === "pending") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 animate-pulse">
            <Clock className="w-3 h-3" />
            Action: Review Counter Date
          </span>
        );
      }
      if (activeRequest.samplingFeasibilityResponse) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 font-bold">
            <AlertCircle className="w-3 h-3" />
            Commercial Decision Ready
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          <Clock className="w-3 h-3" />
          Awaiting Technical Review
        </span>
      );
    }
  };

  return (
    <header className="px-4 py-2 bg-[var(--surface-base)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0 shadow-2xs select-text">
      {/* ── Left: Request Code + Stepper ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onCopyCode}
          className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/15 active:scale-95 transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
          title="Click to copy request code"
        >
          <span>{code}</span>
          {copiedCode ? (
            <Check className="w-3 h-3 text-emerald-500 stroke-[3]" />
          ) : (
            <Copy className="w-3 h-3 opacity-60" />
          )}
        </button>

        <div className="h-4 w-px bg-[var(--border-subtle)] hidden sm:block shrink-0" />

        {/* Stepper */}
        <div className="flex items-center gap-1 p-0.5 bg-[var(--surface-low)] rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
          {steps.map((st, i) => (
            <React.Fragment key={i}>
              <button
                type="button"
                onClick={() => onSelectTab?.(st.tabId)}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-sans transition-all select-none whitespace-nowrap cursor-pointer hover:opacity-90 ${
                  st.isActiveTab
                    ? "bg-[var(--accent-primary)] text-white font-bold shadow-2xs"
                    : st.status === "done"
                    ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] font-bold shadow-2xs"
                    : st.status === "active"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--accent-primary)]"
                    : "text-[var(--on-surface-subtle)] font-medium"
                } ${st.isCurrentFocus && !st.isActiveTab ? "ring-1 ring-[var(--accent-primary)]/40" : ""}`}
              >
                {st.isActiveTab ? (
                  <CheckCircle2 className="w-3 h-3 text-white" />
                ) : st.status === "done" ? (
                  <CheckCircle2 className="w-3 h-3 text-[var(--accent-primary)]" />
                ) : st.status === "active" ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)]" />
                )}
                <span>{st.label}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="w-2.5 h-2.5 text-[var(--border-strong)] shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Right: Role Status + Role Desk Badge + Close Action ── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Role-specific status pill */}
        <div className="hidden sm:block">
          {getRoleStatusIndicator()}
        </div>

        {/* Role Desk Badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border ${
            isSampMode
              ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
              : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
          }`}
        >
          {isSampMode ? (
            <>
              <FlaskConical className="w-3 h-3" />
              <span>Sampling Team</span>
            </>
          ) : (
            <>
              <Briefcase className="w-3 h-3" />
              <span>Marketing Desk</span>
            </>
          )}
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
