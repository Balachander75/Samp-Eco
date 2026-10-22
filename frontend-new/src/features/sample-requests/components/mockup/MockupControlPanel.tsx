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
  CircleSlash,
} from "lucide-react";

export interface MockupControlPanelProps {
  activeRequest: SampleRequestItem;
  copiedCode: boolean;
  onClose: () => void;
  onCopyCode: () => void;
  role?: "marketing" | "creative" | "studio" | "sampling" | "plant";
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
  isCreativeDone: boolean;
  isStudioDone: boolean;
  isReleasedToPlant: boolean;
  closureRequests?: RequestClosureTarget[];
  canCloseRequest?: boolean;
  onRequestClosed?: () => void | Promise<void>;
}

export const MockupControlPanel: React.FC<MockupControlPanelProps> = ({
  activeRequest,
  copiedCode,
  onClose,
  onCopyCode,
  role = "marketing",
  activeTab = "specs",
  onSelectTab,
  isCreativeDone,
  isStudioDone,
  isReleasedToPlant,
  closureRequests = [],
  canCloseRequest = false,
  onRequestClosed,
}) => {
  const code =
    activeRequest.materialCode ||
    activeRequest.requestCode ||
    (activeRequest.requestCodes as any)?.mockup ||
    activeRequest.srNumber ||
    (activeRequest.id ? `MK-${String(activeRequest.id).padStart(4, "0")}` : "MK-0000");

  const ws = (activeRequest.mockupWorkflowState || {}) as Record<string, any>;
  const isCreativeBypassed = ws.designNeeded === false;
  const isStudioOutputReady = Boolean(ws.mockupUrl);
  const isMarketingAccepted =
    ws.stage === "done" ||
    ws.marketingDecision === "accept" ||
    String(activeRequest.status || "").toLowerCase().includes("approved");
  const isMarketingReviewReady =
    ws.stage === "awaiting_marketing_acceptance" || ws.stage === "awaiting_marketing_direction";
  const isClosed = Boolean(
    activeRequest.is_closed ||
    ws.is_closed ||
    String(activeRequest.status || "").toLowerCase() === "closed" ||
    String(activeRequest.status || "").toLowerCase() === "approved / closed" ||
    activeRequest.closure != null ||
    ws.stage === "done"
  );

  const steps = [
    {
      tabId: "specs" as const,
      label: "1. Scope & Specs",
      status: "done" as const,
      isActiveTab: activeTab === "specs",
    },
    {
      tabId: "creative" as const,
      label: isCreativeBypassed
        ? "2. Creative (Bypassed)"
        : isCreativeDone
        ? "2. Creative Output"
        : "2. Creative Intake",
      status: isCreativeBypassed || isCreativeDone
        ? ("done" as const)
        : ws.stage === "creative"
        ? ("active" as const)
        : ("pending" as const),
      isActiveTab: activeTab === "creative",
    },
    {
      tabId: "studio" as const,
      label: isStudioOutputReady ? "3. CAD Output" : "3. Studio CAD",
      status: isStudioDone || isStudioOutputReady
        ? ("done" as const)
        : ws.stage === "studio"
        ? ("active" as const)
        : ("pending" as const),
      isActiveTab: activeTab === "studio",
    },
    {
      tabId: "sampling" as const,
      label: isReleasedToPlant ? "4. Sampling (Released)" : "4. Technical Review",
      status: isReleasedToPlant
        ? ("done" as const)
        : ws.stage === "sampling_review" || ws.stage === "sampling"
        ? ("active" as const)
        : ("pending" as const),
      isActiveTab: activeTab === "sampling",
    },
    {
      tabId: "plant" as const,
      label: isMarketingAccepted
        ? "5. Accepted"
        : isMarketingReviewReady
        ? "5. Marketing Review"
        : "5. Sign-off",
      status: isMarketingAccepted
        ? ("done" as const)
        : isMarketingReviewReady
        ? ("active" as const)
        : ("pending" as const),
      isActiveTab: activeTab === "plant",
    },
  ];

  const getRoleDeskBadge = () => {
    switch (role) {
      case "creative":
        return {
          label: "Creative Studio",
          className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
        };
      case "studio":
        return {
          label: "Studio CAD Desk",
          className: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
        };
      case "sampling":
        return {
          label: "Sampling PMT",
          className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
        };
      case "plant":
        return {
          label: "Plant Execution",
          className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
        };
      case "marketing":
      default:
        return {
          label: "Marketing Desk",
          className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
        };
    }
  };

  const getRoleStatusIndicator = () => {
    if (isClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
          <CircleSlash className="w-3 h-3" />
          Request Closed
        </span>
      );
    }
    if (role === "marketing") {
      if (isMarketingAccepted) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Accepted / Closed
          </span>
        );
      }
      if (isMarketingReviewReady) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 font-bold">
            <AlertCircle className="w-3 h-3" />
            Marketing Decision Ready
          </span>
        );
      }
      if (ws.stage === "studio") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            <Clock className="w-3 h-3" />
            In Studio CAD
          </span>
        );
      }
      if (ws.stage === "creative") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            <Clock className="w-3 h-3" />
            In Creative Studio
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
          <Clock className="w-3 h-3" />
          Stage: {ws.stage || "Intake"}
        </span>
      );
    }

    if (role === "studio") {
      if (ws.claimedBy) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            Assigned: {ws.claimedBy}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" />
          Claim Required
        </span>
      );
    }

    if (role === "creative") {
      if (ws.claimedBy) {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
            Assigned: {ws.claimedBy}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          <AlertCircle className="w-3 h-3" />
          Claim Required
        </span>
      );
    }

    return null;
  };

  const deskBadge = getRoleDeskBadge();

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
            <React.Fragment key={st.label}>
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
                }`}
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
          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border ${deskBadge.className}`}
        >
          <span>{deskBadge.label}</span>
        </span>

        {role === "marketing" && (
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

export default MockupControlPanel;
