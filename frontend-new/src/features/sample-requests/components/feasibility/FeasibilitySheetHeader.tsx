import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { MarketingCounterDateBanner } from "../inspector/MarketingCounterDateBanner";
import { FeasibilityClaimStrip } from "./FeasibilityClaimStrip";

export interface FeasibilitySheetHeaderProps {
  activeRequest: SampleRequestItem;
  classificationLabel: string;
  sourceDesk?: "marketing" | "samp";
  canEvaluateTechnical?: boolean;
  canMakeCommercialDecision?: boolean;
  isClaiming?: boolean;
  onClaimTask?: () => void;
  onOpenCounterDateModal?: () => void;
  onCounterDateDecision?: (accepted: boolean, notes?: string) => Promise<void> | void;
}

export const FeasibilitySheetHeader: React.FC<FeasibilitySheetHeaderProps> = ({
  activeRequest,
  classificationLabel,
  sourceDesk = "marketing",
  canEvaluateTechnical = false,
  isClaiming = false,
  onClaimTask,
  onOpenCounterDateModal,
  onCounterDateDecision,
}) => {
  const code = activeRequest.materialCode || `FC-${String(activeRequest.id).padStart(4, "0")}`;
  const isEvaluated = Boolean(activeRequest.samplingFeasibilityResponse);

  return (
    <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
      {/* ── Top Bar: Reference Code & Flow Progression ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-3 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--surface-lowest)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-2xs">
            {code}
          </span>
          <span className="text-[var(--border-strong)]">/</span>
          <span className="text-xs font-display font-semibold text-[var(--on-surface-muted)] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>NPD Technical Feasibility Dossier</span>
          </span>
        </div>

        {/* Status Badges Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Feasibility Scope Badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)]">
            {classificationLabel}
          </span>

          {/* Technical Verdict Badge */}
          {activeRequest.samplingFeasibilityResponse === "Yes" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Feasible (Approved)</span>
            </span>
          ) : activeRequest.samplingFeasibilityResponse === "Maybe" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Conditional Feasibility</span>
            </span>
          ) : activeRequest.samplingFeasibilityResponse === "No" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
              <XCircle className="w-3.5 h-3.5" />
              <span>Not Feasible</span>
            </span>
          ) : activeRequest.takenBySamp ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300">
              <Clock className="w-3.5 h-3.5" />
              <span>In Trial ({activeRequest.takenBySamp})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-semibold bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              <span>Awaiting SAMP Claim</span>
            </span>
          )}

          {/* Converted Sampling Badge */}
          {(activeRequest.convertedRequestCode || activeRequest.convertedSrNumber) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-display font-bold bg-[var(--accent-primary)] text-white shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Request: {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Document Hero Section ── */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--on-surface)]">
              {activeRequest.customer || "Unassigned Customer Account"}
            </h1>
            <p className="text-xs text-[var(--on-surface-muted)] mt-1 flex items-center gap-1.5 font-mono">
              <span>Raised by</span>
              <span className="font-semibold text-[var(--on-surface)]">
                {activeRequest.createdBy || "Marketing"}
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
            </p>
          </div>
        </div>

        {/* ── 4-Card Executive Metrics Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {/* Card 1: Feasibility Type Scope */}
          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              Feasibility Type
            </span>
            <div
              className="font-display font-bold text-xs text-[var(--on-surface)] truncate"
              title={classificationLabel}
            >
              {classificationLabel}
            </div>
          </div>

          {/* Card 2: Target Required Date & Counter-Date Controls */}
          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              Required Target Date
            </span>
            <div className="font-mono font-bold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>
                {activeRequest.sampleRequiredDate
                  ? formatOdooDate(activeRequest.sampleRequiredDate)
                  : "Flexible"}
              </span>
            </div>

            {/* Counter-Date Status & Triggers */}
            {activeRequest.counterDateDecision === "pending" ? (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span
                  role="status"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <Clock className="h-3 w-3" /> Awaiting Marketing
                </span>
                {activeRequest.sampCounterDate && (
                  <span className="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300">
                    Proposed: {formatOdooDate(activeRequest.sampCounterDate)}
                  </span>
                )}
              </div>
            ) : canEvaluateTechnical && !activeRequest.samplingFeasibilityResponse ? (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={!activeRequest.takenBySamp || Boolean(activeRequest.sampCounterDate)}
                  onClick={onOpenCounterDateModal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] dark:text-emerald-300 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                  title={
                    !activeRequest.takenBySamp
                      ? "Claim task first to propose a counter date"
                      : activeRequest.sampCounterDate
                      ? "Only one counter-date proposal is allowed for this request"
                      : "Propose a revised required target date to Marketing"
                  }
                >
                  <Clock className="w-3 h-3" />
                  <span>Propose Date</span>
                </button>
                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                  {!activeRequest.takenBySamp
                    ? "Claim task to propose"
                    : activeRequest.sampCounterDate
                    ? "Proposal used"
                    : "Within 2-day policy"}
                </span>
              </div>
            ) : null}
          </div>

          {/* Card 3: SAMP Team Assignee */}
          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              SAMP Lab Reviewer
            </span>
            <div className="font-sans font-bold text-xs">
              {activeRequest.takenBySamp ? (
                <span className="text-[var(--on-surface)] truncate">
                  {activeRequest.takenBySamp}
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium italic">
                  Unclaimed
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Commercial Status */}
          <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              Commercial Sign-Off
            </span>
            <div className="font-sans font-bold text-xs">
              {(activeRequest.convertedRequestCode || activeRequest.convertedSrNumber) ? (
                <span className="text-emerald-600 dark:text-emerald-400">Commercial Request Created</span>
              ) : activeRequest.marketingDecision ? (
                <span
                  className={
                    activeRequest.marketingDecision === "Accepted"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  {activeRequest.marketingDecision}
                </span>
              ) : isEvaluated ? (
                <span className="text-purple-600 dark:text-purple-400">Ready for Marketing</span>
              ) : (
                <span className="text-[var(--on-surface-subtle)] font-medium">Pending Lab Trial</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Workflow Negotiation & Task Claim Strips ── */}
        <div className="mt-3.5 space-y-2.5">
          {/* Counter Date Negotiation Banner */}
          {activeRequest.counterDateDecision === "pending" && (
            <MarketingCounterDateBanner
              originalDate={formatOdooDate(activeRequest.sampleRequiredDate)}
              proposedDate={formatOdooDate(activeRequest.sampCounterDate)}
              reason={activeRequest.sampCounterDateReason}
              claimedBy={activeRequest.sampCounterDateProposedBy || activeRequest.takenBySamp}
              requestedAt={activeRequest.sampCounterDateProposedAt}
              isMarketingMode={sourceDesk === "marketing"}
              proposerTitle="Sampling Team"
              onAccept={() => onCounterDateDecision?.(true)}
              onReject={(notes) => onCounterDateDecision?.(false, notes)}
            />
          )}

          {/* Task Ownership & Claim Strip */}
          <FeasibilityClaimStrip
            claimedBy={activeRequest.takenBySamp}
            claimedAt={activeRequest.takenAtSamp}
            isSamplingMode={canEvaluateTechnical}
            isClaiming={isClaiming}
            canClaim={Boolean(canEvaluateTechnical && !activeRequest.takenBySamp && !activeRequest.samplingFeasibilityResponse)}
            claimDisabledReason={
              activeRequest.samplingFeasibilityResponse
                ? "Technical review has already been completed."
                : !canEvaluateTechnical
                ? "Only the Sampling Team can claim this task."
                : undefined
            }
            onClaim={() => onClaimTask?.()}
          />
        </div>
      </div>
    </div>
  );
};

export default FeasibilitySheetHeader;
