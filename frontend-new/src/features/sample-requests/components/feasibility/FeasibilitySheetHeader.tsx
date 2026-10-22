import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { ArrowRight } from "lucide-react";
import { indiaDateKey, operationalWorkdaysBetween } from "@/lib/operationalWorkdays";
import { TaskClaimBanner } from "@/components/ui/TaskClaimBanner";

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

export interface FeasibilitySheetHeaderProps {
  activeRequest: SampleRequestItem;
  classificationLabel?: string;
  sourceDesk?: "marketing" | "samp";
  canEvaluateTechnical?: boolean;
  canMakeCommercialDecision?: boolean;
  isClaiming?: boolean;
  onClaimTask?: () => void;
  onOpenCounterDateModal?: () => void;
  onCounterDateDecision?: (accepted: boolean, notes?: string) => Promise<void> | void;
  onSelectTab?: (tab: "specs" | "review" | "decision") => void;
  currentUserName?: string;
  currentUserId?: number;
}

export const FeasibilitySheetHeader: React.FC<FeasibilitySheetHeaderProps> = ({
  activeRequest,
  sourceDesk = "marketing",
  canEvaluateTechnical = false,
  isClaiming = false,
  onClaimTask,
  onSelectTab,
  currentUserName,
  currentUserId,
}) => {
  const lastViewer = useMemo(() => {
    const activities = activeRequest.activities || [];
    const myName = (currentUserName || "").trim().toLowerCase();
    for (let i = activities.length - 1; i >= 0; i--) {
      const act = activities[i];
      if (act.action === "VIEWED") {
        const isSelf =
          (currentUserId != null && act.actorId === currentUserId) ||
          (myName && (act.actorName || "").trim().toLowerCase() === myName);
        if (!isSelf) {
          return {
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || "Operations",
            timeAgo: formatRelativeTime(act.createdAt),
          };
        }
      }
    }
    return null;
  }, [activeRequest.activities, currentUserId, currentUserName]);

  const extensionDays = useMemo(() => {
    if (!activeRequest.sampleRequiredDate || !activeRequest.sampCounterDate) return 0;
    const origKey = indiaDateKey(activeRequest.sampleRequiredDate);
    const propKey = indiaDateKey(activeRequest.sampCounterDate);
    if (!origKey || !propKey || propKey <= origKey) return 0;
    return operationalWorkdaysBetween(origKey, propKey);
  }, [activeRequest.sampleRequiredDate, activeRequest.sampCounterDate]);

  const isClosed = Boolean(
    activeRequest.is_closed ||
    activeRequest.closure != null ||
    String(activeRequest.status || "").toLowerCase().includes("closed")
  );
  const isClaimed = Boolean(activeRequest.takenBySamp);
  const isClaimedByCurrentUser = Boolean(
    activeRequest.takenBySamp && (
      activeRequest.takenBySampUserId != null && currentUserId != null
        ? String(activeRequest.takenBySampUserId) === String(currentUserId)
        : Boolean(currentUserName && activeRequest.takenBySamp.trim().toLowerCase() === currentUserName.trim().toLowerCase())
    )
  );
  const canClaim = Boolean(!isClosed && canEvaluateTechnical && !activeRequest.takenBySamp && !activeRequest.samplingFeasibilityResponse);

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
              on{" "}
              {activeRequest.dateRequestCreated
                ? formatOdooDate(activeRequest.dateRequestCreated)
                : activeRequest.createdAt
                ? formatOdooDate(activeRequest.createdAt)
                : "—"}
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
          {activeRequest.counterDateDecision === "pending" && activeRequest.sampCounterDate && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs shadow-2xs">
              <span className="font-semibold">
                Revised Date: <span className="font-mono font-bold">{formatOdooDate(activeRequest.sampCounterDate)}</span>
                {extensionDays > 0 && <span className="ml-1 opacity-80">(+{extensionDays}d)</span>}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                Waiting Decision
              </span>
              {sourceDesk === "marketing" && onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab("decision")}
                  className="text-[11px] text-[var(--accent-primary)] hover:underline font-bold ml-0.5 cursor-pointer flex items-center gap-0.5"
                >
                  <span>Review</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Reviewer / Claim Pill */}
          {isClosed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs shadow-2xs font-bold">
              <span>Request Closed</span>
            </div>
          ) : isClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface)] shadow-2xs">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Assigned:</span>
              <span className="font-bold text-xs truncate max-w-[150px]">{activeRequest.takenBySamp}</span>
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
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs shadow-2xs">
              <span className="font-medium text-[11px]">Unclaimed Feasibility</span>
            </div>
          )}
        </div>
      </div>
      {isClaimed && (
        <TaskClaimBanner
          claimedBy={activeRequest.takenBySamp}
          claimedAt={activeRequest.takenAtSamp}
          isClaimedByCurrentUser={isClaimedByCurrentUser}
          compact
          className="mt-3"
        />
      )}
    </div>
  );
};

export default FeasibilitySheetHeader;
