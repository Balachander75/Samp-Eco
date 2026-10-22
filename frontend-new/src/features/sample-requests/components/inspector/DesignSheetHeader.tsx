import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { StatusPill } from "@/components/ui/StatusPill";
import { TaskClaimBanner } from "@/components/ui/TaskClaimBanner";

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
  canClaim: boolean;
  isClaiming: boolean;
  onClaim: () => void;
}

export const DesignSheetHeader: React.FC<DesignSheetHeaderProps> = ({
  activeRequest,
  mode = "marketing",
  currentUserName,
  currentUserId,
  isClaimed,
  claimedBy,
  canClaim,
  isClaiming,
  onClaim,
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

  const claimOwnerId = mode === "sampling" ? activeRequest.samplingClaimedByUserId : activeRequest.claimedByUserId;
  const claimOwnerName = mode === "sampling" ? activeRequest.samplingClaimedBy : activeRequest.claimedBy;
  const claimTime = mode === "sampling" ? activeRequest.samplingClaimedAt : activeRequest.claimedAt;
  const isClaimedByCurrentUser = Boolean(
    claimOwnerName && (
      claimOwnerId != null && currentUserId != null
        ? String(claimOwnerId) === String(currentUserId)
        : Boolean(currentUserName && claimOwnerName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    )
  );

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
          {/* Reviewer / Claim Pill */}
          {isClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Assigned:</span>
              <strong className="font-bold text-xs truncate max-w-[150px]">{claimedBy}</strong>
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
              <span>{mode === "sampling" ? "Pending Sampling Claim" : "Pending Designer Claim"}</span>
            </span>
          )}

          {/* Status Pill */}
          <StatusPill
            status={(activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase().includes("closed")) ? "Closed" : (activeRequest.designRequestStatus || activeRequest.status || "Creative")}
            size="md"
          />
        </div>
      </div>
      {isClaimed && (
        <TaskClaimBanner
          claimedBy={claimOwnerName}
          claimedAt={claimTime}
          isClaimedByCurrentUser={isClaimedByCurrentUser}
          compact
          className="mt-3"
        />
      )}
    </div>
  );
};

export default DesignSheetHeader;
