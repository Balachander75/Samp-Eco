import React from "react";
import { SampleRequestItem } from "../../types";
import { RequestClosureControl, type RequestClosureTarget } from "../common/RequestClosureControl";
import {
  Copy,
  Check,
  X,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Clock,
} from "lucide-react";

export interface DesignControlPanelProps {
  activeRequest: SampleRequestItem;
  refCode: string;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  mode?: "marketing" | "creative" | "sampling";
  activeTab?: "specs" | "deliverables" | "signoff" | "next_work";
  onSelectTab?: (tab: "specs" | "deliverables" | "signoff" | "next_work") => void;
  activeStage: number;
  deliveredCount: number;
  requestedCount: number;
  isAwaitingReview: boolean;
  isClosed: boolean;
  isAcceptedByMarketing: boolean;
  closureRequests?: RequestClosureTarget[];
  canCloseRequest?: boolean;
  onRequestClosed?: () => void | Promise<void>;
}

export const DesignControlPanel: React.FC<DesignControlPanelProps> = ({
  activeRequest,
  refCode,
  copiedCode,
  onClose,
  onCopyCode,
  mode = "marketing",
  activeTab = "specs",
  onSelectTab,
  activeStage,
  deliveredCount,
  requestedCount,
  isAwaitingReview,
  isClosed,
  isAcceptedByMarketing,
  closureRequests = [],
  canCloseRequest = false,
  onRequestClosed,
}) => {
  const isCreativeMode = mode === "creative";
  const isSamplingMode = mode === "sampling";

  const isCreativeDone = deliveredCount >= requestedCount && requestedCount > 0;
  const isCreativeActive = activeStage === 1 || !isCreativeDone;

  const isReviewDone = isClosed || isAcceptedByMarketing;
  const isReviewActive = activeStage === 2 || isAwaitingReview;

  const includedFollowups = (activeRequest.requestTypes || []) as string[];
  const isNextWorkDone = isClosed && includedFollowups.some((v) => v === "mockup" || v === "sample");
  const isNextWorkActive = isAcceptedByMarketing && !isNextWorkDone;

  const steps = [
    {
      tabId: "specs" as const,
      label: "1. Scope & Brief",
      status: "done" as const,
      isActiveTab: activeTab === "specs",
    },
    {
      tabId: "deliverables" as const,
      label: isCreativeDone
        ? `2. Output (${deliveredCount}/${requestedCount})`
        : `2. Creative Output`,
      status: isCreativeDone
        ? ("done" as const)
        : isCreativeActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: isCreativeMode && isCreativeActive,
      isActiveTab: activeTab === "deliverables",
    },
    {
      tabId: "signoff" as const,
      label: isReviewDone
        ? `3. Decision: Accepted`
        : isReviewActive
        ? `3. Marketing Review`
        : `3. Commercial Decision`,
      status: isReviewDone
        ? ("done" as const)
        : isReviewActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: !isCreativeMode && isReviewActive,
      isActiveTab: activeTab === "signoff",
    },
    {
      tabId: "next_work" as const,
      label: isNextWorkDone ? `4. Followup Added` : `4. Next Work`,
      status: isNextWorkDone
        ? ("done" as const)
        : isNextWorkActive
        ? ("active" as const)
        : ("pending" as const),
      isCurrentFocus: !isCreativeMode && isNextWorkActive,
      isActiveTab: activeTab === "next_work",
    },
  ];

  const getRoleStatusIndicator = () => {
    if (isSamplingMode) {
      if (isClosed || isAcceptedByMarketing) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Review Complete
          </span>
        );
      }
      if (activeRequest.samplingClaimedBy) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            Assigned: {activeRequest.samplingClaimedBy}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" />
          Sampling Claim Required
        </span>
      );
    }
    if (isCreativeMode) {
      if (isAwaitingReview) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 font-bold">
            <CheckCircle2 className="w-3 h-3" />
            Submitted to Marketing
          </span>
        );
      }
      if (activeRequest.claimedBy) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Assigned: {activeRequest.claimedBy}
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
      if (isClosed || isAcceptedByMarketing) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Artwork Accepted
          </span>
        );
      }
      if (isAwaitingReview) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 font-bold">
            <AlertCircle className="w-3 h-3" />
            Marketing Review Ready
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          <Clock className="w-3 h-3" />
          In Creative Studio
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
          <span>{refCode}</span>
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
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border ${
            isCreativeMode
              ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
              : isSamplingMode
              ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20"
              : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
          }`}
        >
          {isCreativeMode
            ? "Creative Studio"
            : isSamplingMode
            ? "Sampling PMT"
            : "Marketing Desk"}
        </span>

        {mode === "marketing" && (
          <RequestClosureControl
            requests={closureRequests}
            canClose={canCloseRequest}
            onClosed={onRequestClosed}
          />
        )}

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

export default DesignControlPanel;
