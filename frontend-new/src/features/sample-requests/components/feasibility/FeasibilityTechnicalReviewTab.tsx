import React, { useState, useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { OperationalDatePicker } from "@/components/erp";
import { operationalWorkdaysBetween } from "@/lib/operationalWorkdays";
import { getNextWorkingDate } from "@/lib/holidayUtils";
import {
  ClipboardCheck,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck,
  Lock,
  Calendar,
  CalendarClock,
  Send,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

export interface FeasibilityTechnicalReviewTabProps {
  activeRequest: SampleRequestItem;
  canEvaluateTechnical: boolean;
  isClaiming: boolean;
  sampVerdictChoice: "Yes" | "No" | "Maybe";
  sampVerdictRemark: string;
  sampConditions?: string;
  sampLeadTimeNote?: string;
  sampVerdictError?: string | null;
  claimError?: string | null;
  isSubmittingSampVerdict: boolean;
  onClaimTask: () => void;
  onSampVerdictChoiceChange: (choice: "Yes" | "No" | "Maybe") => void;
  onSampVerdictRemarkChange: (remark: string) => void;
  onSampConditionsChange?: (value: string) => void;
  onSampLeadTimeNoteChange?: (value: string) => void;
  currentUserId?: number;
  currentUserName?: string;
  isAdmin: boolean;
  onSubmitSampVerdict: () => void;
  counterDate?: string;
  counterDateReason?: string;
  counterDateError?: string | null;
  isSubmittingCounterDate?: boolean;
  onCounterDateChange?: (value: string) => void;
  onCounterDateReasonChange?: (value: string) => void;
  onProposeCounterDate?: () => void;
  onProposeCounterDateDirect?: (newDate: string, reason: string) => Promise<void> | void;
  onOpenCounterDateModal?: () => void;
  canMakeCommercialDecision?: boolean;
  onNavigateToDecision?: () => void;
}

export const FeasibilityTechnicalReviewTab: React.FC<FeasibilityTechnicalReviewTabProps> = ({
  activeRequest,
  canEvaluateTechnical,
  isClaiming,
  sampVerdictChoice,
  sampVerdictRemark,
  sampConditions = "",
  sampLeadTimeNote = "",
  sampVerdictError,
  claimError,
  isSubmittingSampVerdict,
  onClaimTask,
  onSampVerdictChoiceChange,
  onSampVerdictRemarkChange,
  onSampConditionsChange,
  onSampLeadTimeNoteChange,
  currentUserId,
  currentUserName,
  isAdmin,
  onSubmitSampVerdict,
  counterDate = "",
  counterDateReason = "",
  counterDateError,
  isSubmittingCounterDate = false,
  onCounterDateChange,
  onCounterDateReasonChange,
  onProposeCounterDate,
  onProposeCounterDateDirect,
  onOpenCounterDateModal: _onOpenCounterDateModal,
  canMakeCommercialDecision = false,
  onNavigateToDecision,
}) => {
  // Local state for inline counter-date composer
  const [showCounterDateComposer, setShowCounterDateComposer] = useState(false);
  const [localProposedDate, setLocalProposedDate] = useState(counterDate);
  const [localReason, setLocalReason] = useState(counterDateReason);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAdvancedNotes, setShowAdvancedNotes] = useState(Boolean(sampConditions || sampLeadTimeNote));

  const isCreator = Boolean(
    (activeRequest.createdByUserId != null && currentUserId != null && activeRequest.createdByUserId === currentUserId) ||
      (activeRequest.createdBy &&
        currentUserName &&
        activeRequest.createdBy.trim().toLowerCase() === currentUserName.trim().toLowerCase())
  );

  const claimBelongsToOther = Boolean(
    activeRequest.takenBySamp &&
      (activeRequest.takenBySampUserId != null
        ? activeRequest.takenBySampUserId !== currentUserId
        : activeRequest.takenBySamp !== currentUserName)
  );

  const originalDateOnly = (activeRequest.sampleRequiredDate || "").split("T", 1)[0].slice(0, 10);
  const minSelectableDate = originalDateOnly
    ? getNextWorkingDate(originalDateOnly, 1)
    : new Date().toISOString().slice(0, 10);

  const extensionWorkdays = useMemo(() => {
    if (!localProposedDate || !originalDateOnly) return 0;
    if (localProposedDate <= originalDateOnly) return 0;
    return operationalWorkdaysBetween(originalDateOnly, localProposedDate);
  }, [localProposedDate, originalDateOnly]);

  const activeExtensionDays = useMemo(() => {
    if (!activeRequest.sampleRequiredDate || !activeRequest.sampCounterDate) return 0;
    const origKey = (activeRequest.sampleRequiredDate || "").split("T", 1)[0].slice(0, 10);
    const propKey = (activeRequest.sampCounterDate || "").split("T", 1)[0].slice(0, 10);
    if (!origKey || !propKey || propKey <= origKey) return 0;
    return operationalWorkdaysBetween(origKey, propKey);
  }, [activeRequest.sampleRequiredDate, activeRequest.sampCounterDate]);

  const handleInlineSubmitCounterDate = async () => {
    if (!localProposedDate.trim()) {
      setLocalError("Please select a proposed target date.");
      return;
    }
    if (originalDateOnly && localProposedDate <= originalDateOnly) {
      setLocalError("Proposed date must be after the current required date.");
      return;
    }
    if (!localReason.trim()) {
      setLocalError("Please provide a technical reason / justification.");
      return;
    }

    setLocalError(null);
    try {
      if (onProposeCounterDateDirect) {
        await onProposeCounterDateDirect(localProposedDate.trim(), localReason.trim());
        setShowCounterDateComposer(false);
      } else if (onProposeCounterDate) {
        onCounterDateChange?.(localProposedDate.trim());
        onCounterDateReasonChange?.(localReason.trim());
        await onProposeCounterDate();
        setShowCounterDateComposer(false);
      }
    } catch (err: any) {
      setLocalError(err?.message || "Failed to submit proposed counter date.");
    }
  };

  const isEvaluated = Boolean(activeRequest.samplingFeasibilityResponse);

  return (
    <div className="py-4 space-y-4">
      {/* ── 1. COMPACT TIMELINE & REQUIRED DATE STRIP ── */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Target Required Date */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
                Required Target Date
              </span>
              <span className="font-mono font-bold text-xs text-[var(--on-surface)]">
                {activeRequest.sampleRequiredDate ? formatOdooDate(activeRequest.sampleRequiredDate) : "—"}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[var(--border-subtle)] hidden sm:block" />

          {/* Assigned Reviewer */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
                Sampling Reviewer
              </span>
              <span className="font-sans font-bold text-xs text-[var(--on-surface)]">
                {activeRequest.takenBySamp || (
                  <span className="text-amber-600 dark:text-amber-400 italic">Pending Claim</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Propose Revised Date Action Button */}
        {canEvaluateTechnical && activeRequest.takenBySamp && !claimBelongsToOther && !activeRequest.sampCounterDate && !isEvaluated && (
          <button
            type="button"
            onClick={() => {
              setShowCounterDateComposer((prev) => !prev);
              setLocalError(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border shadow-2xs ${
              showCounterDateComposer
                ? "bg-[var(--surface-low)] text-[var(--on-surface)] border-[var(--border-strong)]"
                : "bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] text-[var(--accent-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{showCounterDateComposer ? "Close Date Form" : "Need More Time? Propose Revised Date"}</span>
          </button>
        )}
      </div>

      {/* ── 1B. INLINE PRODUCT SCOPE SUMMARY (SO REVIEWER NEVER HAS TO BOUNCE TO TAB 1) ── */}
      {(activeRequest.productDescription || activeRequest.feasibilityDescription || activeRequest.productCategory) && (
        <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
            <span>Product Scope Under Evaluation</span>
            {activeRequest.productCategory && (
              <span className="text-[var(--accent-primary)] font-semibold">{activeRequest.productCategory}</span>
            )}
          </div>
          <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap">
            {activeRequest.productDescription || activeRequest.feasibilityDescription}
          </p>
        </div>
      )}

      {/* ── 2. INLINE COUNTER-DATE PROPOSAL FORM (COMPACT & SLEEK) ── */}
      {showCounterDateComposer && !activeRequest.sampCounterDate && !isEvaluated && (
        <div className="p-4 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-low)] space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="font-display font-bold text-xs text-[var(--on-surface)]">
                Propose Revised Feasibility Target Date
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCounterDateComposer(false)}
              className="text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] text-xs cursor-pointer px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Target Date Input */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--on-surface-subtle)] mb-1">
                Proposed Target Date:
              </label>
              <OperationalDatePicker
                value={localProposedDate}
                onChange={(val) => {
                  setLocalProposedDate(val);
                  setLocalError(null);
                }}
                minDate={minSelectableDate}
                placeholder="Select revised date"
                className="w-full text-xs"
              />
              {extensionWorkdays > 0 && (
                <span className="inline-block mt-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{extensionWorkdays} operational workdays extension
                </span>
              )}
            </div>

            {/* Technical Reason */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--on-surface-subtle)] mb-1">
                Technical Justification / Rationale:
              </label>
              <input
                type="text"
                value={localReason}
                onChange={(e) => {
                  setLocalReason(e.target.value);
                  setLocalError(null);
                }}
                placeholder="e.g. Die cutting mould fabrication lead time"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          {(localError || counterDateError) && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
              {localError || counterDateError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setShowCounterDateComposer(false)}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInlineSubmitCounterDate}
              disabled={isSubmittingCounterDate}
              className="px-4 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingCounterDate ? "Submitting Proposal..." : "Send Date Proposal"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 3. SLEEK COUNTER-DATE STATUS CARD (IF PROPOSED) ── */}
      {activeRequest.sampCounterDate && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs ${
            activeRequest.counterDateDecision === "pending"
              ? "bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/50 text-amber-950 dark:text-amber-200"
              : activeRequest.counterDateDecision === "accepted"
              ? "bg-emerald-50/70 border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-900/50 text-emerald-950 dark:text-emerald-200"
              : "bg-rose-50/70 border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-900/50 text-rose-950 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeRequest.counterDateDecision === "pending"
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : activeRequest.counterDateDecision === "accepted"
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
              }`}
            >
              <CalendarClock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">
                  Proposed Target Date: <span className="font-mono">{formatOdooDate(activeRequest.sampCounterDate)}</span>
                  {activeExtensionDays > 0 && (
                    <span className="ml-1 text-[11px] font-mono opacity-85">
                      (+{activeExtensionDays} workdays)
                    </span>
                  )}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    activeRequest.counterDateDecision === "pending"
                      ? "bg-amber-200/70 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                      : activeRequest.counterDateDecision === "accepted"
                      ? "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                      : "bg-rose-200/70 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200"
                  }`}
                >
                  {activeRequest.counterDateDecision === "pending" && "Pending Marketing Review"}
                  {activeRequest.counterDateDecision === "accepted" && "Accepted by Marketing"}
                  {activeRequest.counterDateDecision === "rejected" && "Rejected by Marketing"}
                </span>
              </div>
              {activeRequest.sampCounterDateReason && (
                <p className="text-[11px] opacity-85 truncate mt-0.5 font-sans">
                  Justification: {activeRequest.sampCounterDateReason}
                </p>
              )}
            </div>
          </div>

          <div className="text-[11px] font-mono shrink-0 opacity-80 text-right">
            {activeRequest.counterDateDecision === "pending" && "Marketing response due within 4 days"}
            {activeRequest.counterDateDecision === "accepted" && "Schedule successfully updated"}
            {activeRequest.counterDateDecision === "rejected" && (
              <span>{activeRequest.counterDateDecisionNotes ? `Note: ${activeRequest.counterDateDecisionNotes}` : "Original date retained"}</span>
            )}
          </div>
        </div>
      )}

      {/* ── 4. MAIN WORKSPACE: EVALUATED LOCKED VIEW OR VERDICT FORM ── */}
      {isEvaluated ? (
        /* ── EVALUATED SIGN-OFF CARD (LOCKED) ── */
        <div className="p-5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-4 shadow-2xs">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                Technical Verdict:
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-display font-bold border ${
                  activeRequest.samplingFeasibilityResponse === "Yes"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : activeRequest.samplingFeasibilityResponse === "No"
                    ? "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {activeRequest.samplingFeasibilityResponse === "Yes" && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                {activeRequest.samplingFeasibilityResponse === "No" && <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
                {activeRequest.samplingFeasibilityResponse === "Maybe" && <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />}
                <span>
                  {activeRequest.samplingFeasibilityResponse === "Yes" && "Feasible (Standard Tooling)"}
                  {activeRequest.samplingFeasibilityResponse === "No" && "Not Feasible"}
                  {activeRequest.samplingFeasibilityResponse === "Maybe" && "Conditional Feasibility"}
                </span>
              </span>
            </div>
            <div className="text-xs text-[var(--on-surface-muted)] font-mono">
              Evaluated by:{" "}
              <span className="font-bold text-[var(--on-surface)]">
                {activeRequest.samplingFeasibilityApprovedBy || "Sampling Team Engineer"}
              </span>
            </div>
          </div>

          {activeRequest.samplingFeasibilityRemark && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block mb-1 font-semibold">
                Technical Assessment Remarks:
              </span>
              <div className="text-xs text-[var(--on-surface)] font-sans leading-relaxed whitespace-pre-wrap p-3 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs">
                {activeRequest.samplingFeasibilityRemark}
              </div>
            </div>
          )}

          {(activeRequest.feasibilityConditions || activeRequest.leadTimeNote) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {activeRequest.feasibilityConditions && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 shadow-2xs">
                  <div className="mb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Conditions / Constraints
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface)]">
                    {activeRequest.feasibilityConditions}
                  </p>
                </div>
              )}
              {activeRequest.leadTimeNote && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 shadow-2xs">
                  <div className="mb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                    Lead-Time Note
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface)]">
                    {activeRequest.leadTimeNote}
                  </p>
                </div>
              )}
            </div>
          )}

          {canMakeCommercialDecision && onNavigateToDecision && (
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-end">
              <button
                type="button"
                onClick={onNavigateToDecision}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              >
                <span>Proceed to Commercial Decision</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : canEvaluateTechnical && isCreator && !isAdmin ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-6 text-center space-y-2">
          <Lock className="mx-auto h-6 w-6 text-amber-600 dark:text-amber-400" />
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Separation of Duties (Maker-Checker Rule)
          </h3>
          <p className="text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto leading-relaxed">
            You created this feasibility request as Requester. In accordance with enterprise governance, technical evaluation must be independently claimed and assessed by a separate Sampling Team reviewer.
          </p>
        </div>
      ) : canEvaluateTechnical && claimBelongsToOther ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-6 text-center">
          <Lock className="mx-auto mb-2 h-6 w-6 text-[var(--on-surface-muted)]" />
          <h3 className="text-sm font-bold text-[var(--on-surface)]">
            Someone else is working on this task
          </h3>
          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
            Reserved for {activeRequest.takenBySamp}. You can view the request, but only the claimant can edit or submit the technical assessment.
          </p>
        </div>
      ) : canEvaluateTechnical ? (
        !activeRequest.takenBySamp ? (
          /* ── STEP 1: MUST CLAIM TASK FIRST ── */
          <div className="space-y-4">
            {isCreator && isAdmin && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Admin Self-Review:</strong> You created this request. Operating with Super Admin privileges.</span>
              </div>
            )}
            {claimError && (
              <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-2 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{claimError}</span>
              </div>
            )}
            <div className="p-8 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-low)] text-center space-y-3.5 shadow-2xs">
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-lowest)] text-[var(--accent-primary)] flex items-center justify-center mx-auto shadow-2xs border border-[var(--border-subtle)]">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-[var(--on-surface)]">
                  Claim Task to Begin Technical Review
                </h3>
              </div>
              <button
                type="button"
                onClick={onClaimTask}
                disabled={isClaiming}
                className="inline-flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer transition disabled:opacity-50"
              >
                <Clock className={`w-4 h-4 ${isClaiming ? "animate-spin" : ""}`} />
                <span>{isClaiming ? "Claiming..." : "Claim Feasibility Task"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── STEP 2: TASK CLAIMED — ACTIVE TECHNICAL SIGN-OFF FORM ── */
          <div className="space-y-4 p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="font-display font-bold text-xs text-[var(--on-surface)]">
                  Sampling Team Technical Sign-Off
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--accent-primary)] font-semibold bg-[var(--surface-lowest)] px-3 py-1 rounded-lg border border-[var(--border-subtle)] shadow-2xs">
                <Check className="w-3.5 h-3.5" />
                <span>Assigned to: {activeRequest.takenBySamp}</span>
              </div>
            </div>

            {isCreator && isAdmin && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Admin Self-Review:</strong> You created this request. Operating with Super Admin privileges.</span>
              </div>
            )}

            {/* 3 Tactical Verdict Cards */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display font-bold text-[var(--on-surface)] mb-2">
                  Technical Verdict Choice:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Yes: Feasible */}
                  <button
                    type="button"
                    onClick={() => onSampVerdictChoiceChange("Yes")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col justify-between gap-2 ${
                      sampVerdictChoice === "Yes"
                        ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-display font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                        <span>Feasible (Yes)</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--on-surface-subtle)] font-normal leading-snug">
                      Machine specs, die moulds &amp; materials fully compatible.
                    </span>
                  </button>

                  {/* Maybe: Conditional */}
                  <button
                    type="button"
                    onClick={() => onSampVerdictChoiceChange("Maybe")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col justify-between gap-2 ${
                      sampVerdictChoice === "Maybe"
                        ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/20 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-display font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                        <span>Conditional (Maybe)</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--on-surface-subtle)] font-normal leading-snug">
                      Feasible subject to tooling mods or custom substrate.
                    </span>
                  </button>

                  {/* No: Not Feasible */}
                  <button
                    type="button"
                    onClick={() => onSampVerdictChoiceChange("No")}
                    className={`p-3.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col justify-between gap-2 ${
                      sampVerdictChoice === "No"
                        ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 ring-2 ring-rose-500/20 shadow-xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-display font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                        <XCircle className="w-4 h-4 stroke-[2.2]" />
                        <span>Not Feasible (No)</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--on-surface-subtle)] font-normal leading-snug">
                      Exceeds plant capabilities, speed or tonnage limits.
                    </span>
                  </button>
                </div>
              </div>

              {/* Technical Assessment & Findings Remark */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--on-surface-subtle)] mb-1">
                  Technical Assessment &amp; Findings:{" "}
                  {sampVerdictChoice === "Yes" ? (
                    <span className="text-[10px] text-[var(--on-surface-subtle)] font-normal">(Optional notes)</span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">(Required explanation)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={sampVerdictRemark}
                  onChange={(e) => onSampVerdictRemarkChange(e.target.value)}
                  required={sampVerdictChoice !== "Yes"}
                  placeholder={
                    sampVerdictChoice === "Yes"
                      ? "Optional technical remarks, machine allocation notes, or recommendations..."
                      : "Explain the technical bottlenecks, required tooling, or non-feasibility reasons..."
                  }
                  className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] shadow-2xs"
                />
              </div>

              {/* Toggle Advanced Technical Constraints / Lead Time */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedNotes((prev) => !prev)}
                  className="text-[11px] font-mono text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] flex items-center gap-1 cursor-pointer select-none"
                >
                  {showAdvancedNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showAdvancedNotes ? "Hide Additional Notes" : "Add Conditions / Lead Time Notes (Optional)"}</span>
                </button>

                {showAdvancedNotes && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1 font-semibold">
                        Conditions / Customer Prerequisites:
                      </label>
                      <input
                        type="text"
                        value={sampConditions}
                        onChange={(e) => onSampConditionsChange?.(e.target.value)}
                        placeholder="e.g. Client must provide approved foil sample"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1 font-semibold">
                        Estimated Lead-Time Note:
                      </label>
                      <input
                        type="text"
                        value={sampLeadTimeNote}
                        onChange={(e) => onSampLeadTimeNoteChange?.(e.target.value)}
                        placeholder="e.g. 5-7 working days from die receipt"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {sampVerdictError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  {sampVerdictError}
                </p>
              )}

              {/* Submit Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <div className="text-[11px] font-mono text-[var(--on-surface-subtle)]">
                  {activeRequest.counterDateDecision === "pending" ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Marketing date review in progress
                    </span>
                  ) : (
                    <span>Evaluator: {activeRequest.takenBySamp}</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onSubmitSampVerdict}
                  disabled={isSubmittingSampVerdict}
                  className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-display font-bold px-6 py-2.5 rounded-xl shadow-2xs cursor-pointer transition flex items-center gap-2 disabled:opacity-50 active:scale-98"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isSubmittingSampVerdict ? "Submitting Sign-Off..." : "Submit Technical Sign-Off"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )
      ) : (activeRequest.is_closed || activeRequest.closure != null || String(activeRequest.status || "").toLowerCase().includes("closed")) ? (
        <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 text-center space-y-2 shadow-2xs">
          <h3 className="text-sm font-display font-bold text-rose-800 dark:text-rose-200">
            Request Closed
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-400 max-w-md mx-auto leading-relaxed">
            This request was officially closed. All further inputs and task claims are permanently locked.
          </p>
        </div>
      ) : (
        /* ── MARKETING VIEW: AWAITING SAMPLING TEAM EVALUATION ── */
        <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-center space-y-3 shadow-2xs">
          <Clock className="w-8 h-8 text-[var(--accent-primary)] mx-auto" />
          <div>
            <h3 className="text-sm font-display font-bold text-[var(--on-surface)]">
              Awaiting Technical Evaluation by Sampling Team
            </h3>
            <p className="text-xs text-[var(--on-surface-muted)] mt-1 max-w-md mx-auto leading-relaxed">
              This feasibility check has been dispatched to the SAMP Team. A sampling engineer will
              claim this task and evaluate machine compatibility, tooling, and lead time.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--on-surface)] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
            <span>
              {activeRequest.takenBySamp
                ? `In Technical Review by ${activeRequest.takenBySamp}`
                : "Awaiting SAMP Team Engineer Claim"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeasibilityTechnicalReviewTab;
