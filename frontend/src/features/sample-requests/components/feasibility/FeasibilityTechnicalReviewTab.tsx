import React from "react";
import { SampleRequestItem } from "../../types";
import { OperationalDatePicker } from "@/components/erp/OperationalDatePicker";
import { getNextWorkingDate } from "@/lib/holidayUtils";
import {
  ClipboardCheck,
  Check,
  AlertTriangle,
  XCircle,
  Clock,
  UserCheck,
  Lock,
  Calendar,
} from "lucide-react";

export interface FeasibilityTechnicalReviewTabProps {
  activeRequest: SampleRequestItem;
  canEvaluateTechnical: boolean;
  isClaiming: boolean;
  sampVerdictChoice: "Yes" | "No" | "Maybe";
  sampVerdictRemark: string;
  sampConditions: string;
  sampLeadTimeNote: string;
  sampVerdictError: string | null;
  isSubmittingSampVerdict: boolean;
  onClaimTask: () => void;
  onSampVerdictChoiceChange: (choice: "Yes" | "No" | "Maybe") => void;
  onSampVerdictRemarkChange: (remark: string) => void;
  onSampConditionsChange: (value: string) => void;
  onSampLeadTimeNoteChange: (value: string) => void;
  currentUserId?: number;
  currentUserName?: string;
  isAdmin: boolean;
  onSubmitSampVerdict: () => void;
  counterDate: string;
  counterDateReason: string;
  counterDateError: string | null;
  isSubmittingCounterDate: boolean;
  onCounterDateChange: (value: string) => void;
  onCounterDateReasonChange: (value: string) => void;
  onProposeCounterDate: () => void;
}

export const FeasibilityTechnicalReviewTab: React.FC<FeasibilityTechnicalReviewTabProps> = ({
  activeRequest,
  canEvaluateTechnical,
  isClaiming,
  sampVerdictChoice,
  sampVerdictRemark,
  sampConditions,
  sampLeadTimeNote,
  sampVerdictError,
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
  counterDate,
  counterDateReason,
  counterDateError,
  isSubmittingCounterDate,
  onCounterDateChange,
  onCounterDateReasonChange,
  onProposeCounterDate,
}) => {
  const claimBelongsToOther = Boolean(
    activeRequest.takenBySamp &&
      !isAdmin &&
      (activeRequest.takenBySampUserId != null
        ? activeRequest.takenBySampUserId !== currentUserId
        : activeRequest.takenBySamp !== currentUserName)
  );

  return (
    <div className="py-4 space-y-4">
      {activeRequest.samplingFeasibilityResponse ? (
        /* Evaluated Locked Card (SAMP Review Done) */
        <div className="p-5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-4">
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
                {activeRequest.samplingFeasibilityResponse === "Yes" && (
                  <Check className="w-3.5 h-3.5" />
                )}
                {activeRequest.samplingFeasibilityResponse === "No" && (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {activeRequest.samplingFeasibilityResponse === "Maybe" && (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeRequest.samplingFeasibilityResponse === "Yes" && "Feasible (Full Scope)"}
                  {activeRequest.samplingFeasibilityResponse === "No" && "Not Feasible (Unsupported)"}
                  {activeRequest.samplingFeasibilityResponse === "Maybe" && "Conditional Feasibility"}
                </span>
              </span>
            </div>
            <div className="text-xs text-[var(--on-surface-muted)] font-mono">
              Evaluated by:{" "}
              <span className="font-bold text-[var(--on-surface)]">
                {activeRequest.samplingFeasibilityApprovedBy || "SAMP Lab Engineer"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block mb-1.5 font-semibold">
              Technical Assessment & Findings:
            </span>
            <div className="text-xs text-[var(--on-surface)] font-sans leading-relaxed whitespace-pre-wrap p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs">
              {activeRequest.samplingFeasibilityRemark ||
                "Technical specifications verified feasible with plant tooling."}
            </div>
          </div>

          {(activeRequest.feasibilityConditions || activeRequest.leadTimeNote) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {activeRequest.feasibilityConditions && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5">
                  <div className="mb-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Conditions / Constraints
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface)]">
                    {activeRequest.feasibilityConditions}
                  </p>
                </div>
              )}
              {activeRequest.leadTimeNote && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5">
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

          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--on-surface-muted)]">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <Check className="w-3.5 h-3.5" /> Technical sign-off recorded. Ready for commercial review.
            </span>
            <span className="text-right font-mono text-[10px]">
              {activeRequest.feasibilityClosedAt && (
                <span>Completed {new Date(activeRequest.feasibilityClosedAt).toLocaleString()}</span>
              )}
            </span>
          </div>
        </div>
      ) : canEvaluateTechnical && claimBelongsToOther ? (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-6 text-center">
          <Lock className="mx-auto mb-2 h-6 w-6 text-[var(--on-surface-muted)]" />
          <h3 className="text-sm font-bold text-[var(--on-surface)]">
            Review owned by {activeRequest.takenBySamp}
          </h3>
          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
            Only the assigned SAMP reviewer or an Admin can submit the technical assessment.
          </p>
        </div>
      ) : canEvaluateTechnical ? (
        !activeRequest.takenBySamp ? (
          /* Step 1 for Sampling Team: Must Claim Task First */
          <div className="space-y-4">
            <div className="p-8 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-low)] text-center space-y-3.5">
              <div className="w-12 h-12 rounded-xl bg-[var(--surface-lowest)] text-[var(--accent-primary)] flex items-center justify-center mx-auto shadow-2xs border border-[var(--border-subtle)]">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-display font-bold text-[var(--on-surface)]">
                  Task Claim Required to Begin Technical Review
                </h3>
                <p className="text-xs text-[var(--on-surface-muted)] mt-1 max-w-md mx-auto leading-relaxed">
                  To ensure single ownership and avoid duplicate efforts across the SAMP Team, please
                  claim this feasibility check. The verdict form unlocks immediately once claimed.
                </p>
              </div>
              <button
                type="button"
                onClick={onClaimTask}
                disabled={isClaiming}
                className="inline-flex items-center gap-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-2xs cursor-pointer transition disabled:opacity-50"
              >
                <Clock className={`w-4 h-4 ${isClaiming ? "animate-spin" : ""}`} />
                <span>{isClaiming ? "Claiming Ownership..." : "Claim This Feasibility Check"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Task Claimed — Active Evaluation Form */
          <div className="space-y-4 p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="font-display font-bold text-xs text-[var(--on-surface)]">
                  SAMP Lab Technical Sign-Off Form
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--accent-primary)] font-semibold bg-[var(--surface-lowest)] px-3 py-1 rounded-lg border border-[var(--border-subtle)]">
                <Check className="w-3.5 h-3.5" />
                <span>Assigned to: {activeRequest.takenBySamp}</span>
              </div>
            </div>

            {/* Counter Date Status if active */}
            {activeRequest.sampCounterDate ? (
              <div
                className="rounded-xl p-4 bg-[var(--surface-lowest)] border border-[var(--border-subtle)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs font-bold text-[var(--on-surface)]">
                    {activeRequest.counterDateDecision === "pending"
                      ? "Date Proposal Sent to Marketing"
                      : "SAMP Proposed Date"}
                    : {activeRequest.sampCounterDate}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold font-mono ${
                      activeRequest.counterDateDecision === "pending"
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                        : activeRequest.counterDateDecision === "accepted" ||
                          activeRequest.counterDateDecision === "auto_accepted"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                        : "bg-[var(--surface-low)] text-[var(--on-surface-muted)]"
                    }`}
                  >
                    {activeRequest.counterDateDecision === "pending"
                      ? "Awaiting Marketing Decision"
                      : activeRequest.counterDateDecision === "auto_accepted"
                      ? "Auto-Accepted"
                      : activeRequest.counterDateDecision === "accepted"
                      ? "Accepted"
                      : "Rejected"}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--on-surface-muted)]">
                  {activeRequest.sampCounterDateReason}
                </p>
              </div>
            ) : canEvaluateTechnical && !activeRequest.samplingFeasibilityResponse ? (
              <section
                className="space-y-3 rounded-xl bg-[var(--surface-lowest)] p-4 border border-[var(--border-subtle)]"
                aria-labelledby="counter-date-title"
              >
                <div>
                  <h3
                    id="counter-date-title"
                    className="text-xs font-display font-bold text-[var(--on-surface)]"
                  >
                    Propose a Revised Required Date (Capacity / Tooling Constraint)
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--on-surface-muted)]">
                    Marketing can accept or reject the date. If there is no decision within 4
                    working days, the proposed date is accepted automatically.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(180px,0.8fr)_1.2fr]">
                  <OperationalDatePicker
                    value={counterDate}
                    onChange={onCounterDateChange}
                    minDate={
                      activeRequest.sampleRequiredDate
                        ? getNextWorkingDate(activeRequest.sampleRequiredDate, 1)
                        : undefined
                    }
                    label="Proposed working date"
                    placeholder="Choose revised date"
                  />
                  <label className="block text-xs font-semibold text-[var(--on-surface)]">
                    Reason for revised date
                    <textarea
                      value={counterDateReason}
                      onChange={(event) => onCounterDateReasonChange(event.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="Briefly explain the technical or capacity constraint..."
                      className="mt-1.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3 text-xs font-normal text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    />
                  </label>
                </div>
                {counterDateError && (
                  <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {counterDateError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={onProposeCounterDate}
                  disabled={!counterDate || !counterDateReason.trim() || isSubmittingCounterDate}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-4 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isSubmittingCounterDate
                    ? "Sending Proposal…"
                    : "Send Date Proposal to Marketing"}
                </button>
              </section>
            ) : null}

            {/* 3 Verdict Options */}
            <div>
              <label className="block text-xs font-display font-bold text-[var(--on-surface)] mb-2">
                Select Technical Verdict:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onSampVerdictChoiceChange("Yes")}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer select-none ${
                    sampVerdictChoice === "Yes"
                      ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] text-[var(--on-surface)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-display font-bold text-[var(--on-surface)]">
                      Yes (Feasible)
                    </span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-[10.5px] text-[var(--on-surface-muted)] font-normal leading-relaxed">
                    Standard manufacturability with existing plant machines, tooling, and materials.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSampVerdictChoiceChange("Maybe")}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer select-none ${
                    sampVerdictChoice === "Maybe"
                      ? "border-amber-500 bg-[var(--surface-lowest)] text-[var(--on-surface)] ring-2 ring-amber-500/20 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-display font-bold text-[var(--on-surface)]">
                      Maybe (Conditional)
                    </span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <p className="text-[10.5px] text-[var(--on-surface-muted)] font-normal leading-relaxed">
                    Feasible conditionally with custom tooling, special material grade, or pilot
                    batch.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onSampVerdictChoiceChange("No")}
                  className={`p-4 rounded-xl border text-left transition cursor-pointer select-none ${
                    sampVerdictChoice === "No"
                      ? "border-rose-500 bg-[var(--surface-lowest)] text-[var(--on-surface)] ring-2 ring-rose-500/20 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-display font-bold text-[var(--on-surface)]">
                      No (Not Feasible)
                    </span>
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <p className="text-[10.5px] text-[var(--on-surface-muted)] font-normal leading-relaxed">
                    Unsupported by plant infrastructure or requires unfeasible machinery
                    modifications.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface)]">
                  Conditions / Constraints{" "}
                  <span className="font-normal text-[var(--on-surface-muted)]">(when applicable)</span>
                </span>
                <textarea
                  rows={3}
                  value={sampConditions}
                  onChange={(e) => onSampConditionsChange(e.target.value)}
                  placeholder="List assumptions, limitations, or tooling constraints..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--on-surface)]">
                  Lead-Time Note{" "}
                  <span className="font-normal text-[var(--on-surface-muted)]">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  value={sampLeadTimeNote}
                  onChange={(e) => onSampLeadTimeNoteChange(e.target.value)}
                  placeholder="Estimated tooling or material preparation lead time..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </label>
            </div>

            {/* Technical Reason / Constraints */}
            <div>
              <label className="block text-xs font-display font-bold text-[var(--on-surface)] mb-1.5">
                Technical Explanation & Findings:
                {sampVerdictChoice === "No" || sampVerdictChoice === "Maybe" ? (
                  <span className="text-rose-600 dark:text-rose-400 ml-1 font-semibold">
                    * (Required for {sampVerdictChoice === "No" ? "Not Feasible" : "Conditional"})
                  </span>
                ) : (
                  <span className="text-[var(--on-surface-subtle)] ml-1 font-normal text-[11px]">
                    (Optional notes)
                  </span>
                )}
              </label>
              <textarea
                rows={3}
                value={sampVerdictRemark}
                onChange={(e) => onSampVerdictRemarkChange(e.target.value)}
                placeholder={
                  sampVerdictChoice === "Yes"
                    ? "Specify recommended material grade, plant machine line, or standard tooling parameters..."
                    : "Detail specific machinery constraints, tooling requirements, or conditional parameters..."
                }
                className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
              {sampVerdictError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                  {sampVerdictError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onSubmitSampVerdict}
                disabled={isSubmittingSampVerdict || activeRequest.counterDateDecision === "pending"}
                className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-display font-bold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {activeRequest.counterDateDecision === "pending"
                    ? "Waiting for Marketing Date Decision"
                    : isSubmittingSampVerdict
                    ? "Submitting Verdict..."
                    : "Submit Technical Verdict"}
                </span>
              </button>
            </div>
          </div>
        )
      ) : (
        /* Marketing Persona View: Awaiting SAMP Team Evaluation */
        <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-center space-y-3">
          <Clock className="w-8 h-8 text-[var(--accent-primary)] mx-auto" />
          <div>
            <h3 className="text-sm font-display font-bold text-[var(--on-surface)]">
              Awaiting Technical Evaluation by SAMP Lab
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
