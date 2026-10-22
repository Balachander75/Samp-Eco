import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";

function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return "";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDate(val?: string | null): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return val;
  }
}

export interface DesignSheetHeaderProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "creative" | "sampling";
  currentUserName?: string;
  currentUserId?: number;
  isClaimed: boolean;
  claimedBy?: string;
  isClaimedByCurrentUser?: boolean;
  canClaim: boolean;
  isClaiming: boolean;
  onClaim: () => void;
  canReleaseClaim: boolean;
  isReleasingClaim: boolean;
  onReleaseClaim: () => void;
  isCounterDatePending: boolean;
  onCounterDateDecision?: (decision: "accepted" | "rejected", notes?: string) => Promise<void> | void;
  onOpenCounterDateModal?: () => void;
  onSelectTab?: (tab: "specs" | "deliverables" | "signoff" | "next_work") => void;
}

export const DesignSheetHeader: React.FC<DesignSheetHeaderProps> = ({
  activeRequest,
  mode = "marketing",
  currentUserName,
  currentUserId,
  isClaimed,
  claimedBy,
  isClaimedByCurrentUser: _isClaimedByCurrentUser = false,
  canClaim,
  isClaiming,
  onClaim,
  canReleaseClaim,
  isReleasingClaim,
  onReleaseClaim,
  isCounterDatePending,
  onCounterDateDecision,
  onOpenCounterDateModal,
  onSelectTab,
}) => {
  const lastViewer = useMemo(() => {
    const activities = (activeRequest.workflowEvents || activeRequest.activities || []) as any[];
    const myName = (currentUserName || "").trim().toLowerCase();
    for (let i = activities.length - 1; i >= 0; i--) {
      const act = activities[i];
      if (act.action === "VIEWED" || act.action === "REQUEST_VIEWED") {
        const isSelf =
          (currentUserId != null && act.actorId === currentUserId) ||
          (myName && (act.actorName || "").trim().toLowerCase() === myName);
        if (!isSelf) {
          return {
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || "Creative Studio",
            timeAgo: formatRelativeTime(act.createdAt || act.timestamp),
          };
        }
      }
    }
    return null;
  }, [activeRequest.workflowEvents, activeRequest.activities, currentUserId, currentUserName]);

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 sm:px-8 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ── Left: Customer Account & Metadata ── */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight text-[var(--on-surface)] truncate">
            {activeRequest.customer || "Unassigned Customer Account"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--on-surface-muted)] mt-0.5 font-mono">
            <span>
              Raised by <strong className="font-semibold text-[var(--on-surface)]">{activeRequest.createdBy || "Marketing"}</strong>
            </span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>
              on {formatDate(activeRequest.dateRequestCreated || activeRequest.createdAt)}
            </span>
            {lastViewer && (
              <>
                <span className="text-[var(--border-strong)] hidden sm:inline">·</span>
                <span className="text-[11px] text-[var(--on-surface-subtle)]">
                  Reviewed by {lastViewer.actorName} {lastViewer.timeAgo}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Right: Sleek Badges & Compact Actions ── */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Pending Counter-Date Compact Micro-Pill */}
          {isCounterDatePending && activeRequest.proposedTargetDate && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs shadow-2xs">
              <span className="font-semibold">
                Revised Target: <span className="font-mono font-bold">{formatDate(activeRequest.proposedTargetDate)}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                Waiting Decision
              </span>
              {mode === "marketing" && (
                <div className="flex items-center gap-1.5 ml-0.5">
                  {onCounterDateDecision ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onCounterDateDecision("accepted")}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer shadow-2xs transition active:scale-95"
                        title="Accept revised target date"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onCounterDateDecision("rejected")}
                        className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold cursor-pointer shadow-2xs transition active:scale-95"
                        title="Reject revised target date"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCounterDateModal) onOpenCounterDateModal();
                        else if (onSelectTab) onSelectTab("deliverables");
                      }}
                      className="text-[11px] text-[var(--accent-primary)] hover:underline font-bold ml-0.5 cursor-pointer flex items-center gap-0.5"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reviewer / Claim Pill */}
          {isClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="font-medium">
                Designer: <strong className="font-semibold">{claimedBy}</strong>
              </span>
              {canReleaseClaim && (
                <button
                  type="button"
                  onClick={onReleaseClaim}
                  disabled={isReleasingClaim}
                  className="ml-1 text-[10.5px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold cursor-pointer underline disabled:opacity-50"
                  title="Admin: Reassign task claim"
                >
                  {isReleasingClaim ? "Releasing…" : "Reassign"}
                </button>
              )}
            </div>
          ) : canClaim ? (
            <button
              type="button"
              onClick={onClaim}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <span>{isClaiming ? "Claiming…" : "Claim Task"}</span>
            </button>
          ) : (activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase().includes("closed")) ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs shadow-2xs font-bold">
              <span>Request Closed</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs shadow-2xs font-medium">
              <span>Pending Designer Claim</span>
            </span>
          )}

          {/* Status Pill */}
          <StatusPill
            status={(activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase().includes("closed")) ? "Closed" : (activeRequest.designRequestStatus || activeRequest.status || "Creative")}
            size="md"
          />
        </div>
      </div>
    </div>
  );
};

export default DesignSheetHeader;
