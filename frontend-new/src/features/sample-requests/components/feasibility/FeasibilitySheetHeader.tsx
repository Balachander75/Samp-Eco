import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { CheckCircle2, UserCheck } from "lucide-react";
import { indiaDateKey, operationalWorkdaysBetween } from "@/lib/operationalWorkdays";
import { TaskClaimBanner } from "@/components/ui/TaskClaimBanner";

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
  canMakeCommercialDecision = false,
  isClaiming = false,
  onClaimTask,
  onSelectTab,
  currentUserName,
  currentUserId,
}) => {
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
  const hasVerdict = Boolean(activeRequest.samplingFeasibilityResponse);
  const isConverted = Boolean(activeRequest.convertedRequestCode || activeRequest.convertedSrNumber);

  // Determine active stage (1: Intake, 2: Technical Review, 3: Commercial Decision & Convert)
  const currentStage = useMemo(() => {
    if (isConverted || activeRequest.marketingDecision === "Accepted") return 3;
    if (hasVerdict || activeRequest.counterDateDecision === "pending") return 3;
    return 2;
  }, [hasVerdict, isConverted, activeRequest.counterDateDecision, activeRequest.marketingDecision]);

  const extensionDays = useMemo(() => {
    if (!activeRequest.sampleRequiredDate || !activeRequest.sampCounterDate) return 0;
    const origKey = indiaDateKey(activeRequest.sampleRequiredDate);
    const propKey = indiaDateKey(activeRequest.sampCounterDate);
    if (!origKey || !propKey || propKey <= origKey) return 0;
    return operationalWorkdaysBetween(origKey, propKey);
  }, [activeRequest.sampleRequiredDate, activeRequest.sampCounterDate]);

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 sm:px-8 py-4 space-y-4">
      {/* ── 1. Top Identity Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-display font-bold text-[var(--on-surface)] truncate">
              {activeRequest.customer || "Commercial Account"}
            </h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              {activeRequest.requestCode || "FEASIBILITY"}
            </span>
            {activeRequest.targetPlant && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-700 border border-indigo-200/50">
                Plant {activeRequest.targetPlant}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--on-surface-muted)] mt-1 font-mono">
            <span>Raised by <strong className="text-[var(--on-surface)]">{activeRequest.createdBy || "Marketing"}</strong></span>
            <span>•</span>
            <span>Target Date: <strong className="text-[var(--on-surface)]">{activeRequest.sampleRequiredDate ? formatOdooDate(activeRequest.sampleRequiredDate) : "Immediate"}</strong></span>
          </div>
        </div>

        {/* Quick Action Pill on right */}
        <div className="flex items-center gap-2">
          {isClosed ? (
            <span className="px-3 py-1 rounded-xl bg-rose-500/10 text-rose-700 text-xs font-bold border border-rose-500/20">
              Request Closed
            </span>
          ) : isConverted ? (
            <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Converted to {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}</span>
            </span>
          ) : canClaim ? (
            <button
              type="button"
              onClick={onClaimTask}
              disabled={isClaiming}
              className="px-4 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isClaiming ? "Claiming..." : "Claim Technical Review"}</span>
            </button>
          ) : isClaimed ? (
            <span className="px-3 py-1 rounded-xl bg-[var(--surface-low)] text-[var(--on-surface)] text-xs font-semibold border border-[var(--border-subtle)] flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Assigned:</span>
              <strong className="truncate max-w-[130px]">{activeRequest.takenBySamp}</strong>
            </span>
          ) : null}
        </div>
      </div>

      {/* ── 2. The 3-Step Visual Journey Stepper (Informative Milestones) ── */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Step 1: Intake & Scope */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] select-none">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-bold">
                Step 1: Intake
              </div>
              <div className="text-xs font-bold text-[var(--on-surface)] truncate">
                Scope &amp; Product Specs
              </div>
            </div>
          </div>

          {/* Step 2: Technical Verdict (Sampling Team) */}
          <div
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all select-none ${
              hasVerdict
                ? "bg-[var(--surface-lowest)] border-emerald-300/60"
                : currentStage === 2
                ? "bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]/40 ring-1 ring-[var(--accent-primary)]/20"
                : "bg-[var(--surface-lowest)] border-[var(--border-subtle)]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                hasVerdict
                  ? "bg-emerald-500/15 text-emerald-600 font-bold text-xs"
                  : currentStage === 2
                  ? "bg-[var(--accent-primary)] text-white font-bold text-xs animate-pulse"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] text-xs"
              }`}
            >
              {hasVerdict ? <CheckCircle2 className="w-4 h-4" /> : "2"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-bold">
                Step 2: Technical Verdict
              </div>
              <div className="text-xs font-bold text-[var(--on-surface)] truncate">
                {hasVerdict ? (
                  <span
                    className={
                      activeRequest.samplingFeasibilityResponse === "Yes"
                        ? "text-emerald-600 font-bold"
                        : activeRequest.samplingFeasibilityResponse === "No"
                        ? "text-rose-600 font-bold"
                        : "text-amber-600 font-bold"
                    }
                  >
                    {activeRequest.samplingFeasibilityResponse === "Yes"
                      ? "Feasible"
                      : activeRequest.samplingFeasibilityResponse === "No"
                      ? "Not Feasible"
                      : "Conditional"}
                  </span>
                ) : isClaimed ? (
                  "Sampling Review in Progress"
                ) : (
                  "Pending Reviewer Claim"
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Commercial Conversion (Marketing) */}
          <div
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all select-none ${
              isConverted
                ? "bg-emerald-500/10 border-emerald-300"
                : currentStage === 3
                ? "bg-amber-500/10 border-amber-300/80 ring-1 ring-amber-500/20"
                : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] opacity-75"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                isConverted
                  ? "bg-emerald-600 text-white font-bold text-xs"
                  : currentStage === 3
                  ? "bg-amber-600 text-white font-bold text-xs"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] text-xs"
              }`}
            >
              {isConverted ? <CheckCircle2 className="w-4 h-4" /> : "3"}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-bold">
                Step 3: Marketing Action
              </div>
              <div className="text-xs font-bold text-[var(--on-surface)] truncate">
                {isConverted
                  ? "Commercial Sample Request Created"
                  : activeRequest.counterDateDecision === "pending"
                  ? "Review Date Proposal"
                  : hasVerdict
                  ? "Ready for Commercial Sign-off"
                  : "Awaiting Technical Verdict"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Next Action Guidance Banner (In Plain English) ── */}
      {!isClosed && !isConverted && (
        <div
          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
            activeRequest.counterDateDecision === "pending"
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : hasVerdict && canMakeCommercialDecision
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : !hasVerdict && isClaimedByCurrentUser
              ? "bg-sky-50 border-sky-200 text-sky-900"
              : canClaim
              ? "bg-indigo-50 border-indigo-200 text-indigo-900"
              : "bg-[var(--surface-base)] border-[var(--border-subtle)] text-[var(--on-surface-muted)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/70 border border-current">
              Next Action
            </span>
            <span>
              {activeRequest.counterDateDecision === "pending"
                ? sourceDesk === "samp"
                  ? `Counter-date proposed: ${formatOdooDate(activeRequest.sampCounterDate || "")}${extensionDays > 0 ? ` (+${extensionDays} workdays)` : ""}. Waiting for Marketing decision.`
                  : `Sampling team proposed a revised date of ${formatOdooDate(activeRequest.sampCounterDate || "")}${extensionDays > 0 ? ` (+${extensionDays} workday extension)` : ""}. Marketing must decide.`
                : hasVerdict && canMakeCommercialDecision
                ? `Sampling verdict recorded (${activeRequest.samplingFeasibilityResponse}). Ready to convert to Sample Request.`
                : !hasVerdict && isClaimedByCurrentUser
                ? "You claimed this task. Select your technical verdict below (Feasible / Conditional / Not Feasible)."
                : canClaim
                ? "Sampling review is waiting to be claimed by a technical team specialist."
                : "Evaluation in progress by Sampling Team."}
            </span>
          </div>

          {activeRequest.counterDateDecision === "pending" && onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab("decision")}
              className="font-bold underline text-xs cursor-pointer hover:opacity-80"
            >
              Take Decision →
            </button>
          )}

          {hasVerdict && canMakeCommercialDecision && onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab("decision")}
              className="font-bold underline text-xs cursor-pointer hover:opacity-80"
            >
              Proceed to Convert →
            </button>
          )}
        </div>
      )}

      {isClaimed && (
        <TaskClaimBanner
          claimedBy={activeRequest.takenBySamp}
          claimedAt={activeRequest.takenAtSamp}
          isClaimedByCurrentUser={isClaimedByCurrentUser}
          compact
        />
      )}
    </div>
  );
};

export default FeasibilitySheetHeader;
