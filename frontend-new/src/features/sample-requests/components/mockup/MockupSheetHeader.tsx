import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { StatusPill } from "@/components/ui/StatusPill";

const formatRelativeTime = (timestamp?: string): string => {
  if (!timestamp) return "";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export interface MockupSheetHeaderProps {
  activeRequest: SampleRequestItem;
  role?: "marketing" | "creative" | "studio" | "sampling" | "plant";
  isClaimed: boolean;
  claimedBy?: string;
  canClaim: boolean;
  isClaiming: boolean;
  onClaimTask?: () => void;
  currentUserName?: string;
  currentUserId?: number;
}

export const MockupSheetHeader: React.FC<MockupSheetHeaderProps> = ({
  activeRequest,
  role = "marketing",
  isClaimed,
  claimedBy,
  canClaim,
  isClaiming,
  onClaimTask,
  currentUserName,
  currentUserId,
}) => {
  const ws = (activeRequest.mockupWorkflowState || {}) as Record<string, any>;

  const lastViewer = useMemo(() => {
    const activities = (activeRequest.activities || []) as any[];
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
            actorDepartment: act.actorDepartment || "Operations",
            timeAgo: formatRelativeTime(act.createdAt || act.timestamp),
          };
        }
      }
    }
    return null;
  }, [activeRequest.activities, currentUserId, currentUserName]);

  // SLA Required Date
  const requiredDate =
    ws.requiredDate ||
    activeRequest.sampleRequiredDate ||
    (activeRequest as any).requiredDate;

  // Physical Dummy / Prototype Quantity
  const qtyForMockup =
    ws.qtyForMockup ||
    activeRequest.qtyForMockup ||
    (activeRequest as any).quantity;

  const dateCreated =
    activeRequest.dateRequestCreated ||
    activeRequest.createdAt;

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 sm:px-8 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* ── Left: Customer Account & Metadata ── */}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight text-[var(--on-surface)] truncate">
            {activeRequest.customer || "Commercial Account"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--on-surface-muted)] mt-0.5 font-mono">
            <span>
              Raised by <strong className="font-semibold text-[var(--on-surface)]">{activeRequest.createdBy || "Marketing"}</strong>
            </span>
            <span className="text-[var(--border-strong)]">·</span>
            <span>
              on {dateCreated ? formatOdooDate(dateCreated) : "—"}
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

        {/* ── Right: Sleek Badges & Compact Actions (Feasibility Check Style) ── */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Target SLA Date Pill */}
          {requiredDate && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Target Date:</span>
              <span className="font-bold text-xs font-mono">{formatOdooDate(requiredDate)}</span>
            </div>
          )}

          {/* Quantity of Prototypes/Dummies Pill */}
          {qtyForMockup != null && String(qtyForMockup).trim() !== "" && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Qty:</span>
              <span className="font-bold text-xs font-mono">
                {qtyForMockup} {Number(qtyForMockup) === 1 ? "Prototype" : "Prototypes"}
              </span>
            </div>
          )}

          {/* Reviewer / Claim Pill */}
          {(activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.status || "").toLowerCase().includes("closed")) ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs shadow-2xs font-bold">
              <span>Request Closed</span>
            </div>
          ) : isClaimed && claimedBy ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Assigned:</span>
              <span className="font-bold text-xs truncate max-w-[150px]">{claimedBy}</span>
            </div>
          ) : canClaim ? (
            <button
              type="button"
              onClick={onClaimTask}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <span>{isClaiming ? "Claiming..." : "Claim Task"}</span>
            </button>
          ) : role !== "marketing" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs shadow-2xs">
              <span className="font-medium text-[11px]">Unclaimed Task</span>
            </div>
          ) : null}

          {/* Status Pill */}
          <StatusPill status={(activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.status || "").toLowerCase().includes("closed")) ? "Closed" : (activeRequest.status || "Brief Intake")} size="md" />
        </div>
      </div>
    </div>
  );
};

export default MockupSheetHeader;
