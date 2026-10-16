import React, { useState, useEffect } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Factory,
  CheckCircle2,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  Check,
  ShieldAlert,
  UserCheck,
  Lock,
} from "lucide-react";

export interface ProgramPlanningPlantReviewTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onSaveOutput: (remark: string) => Promise<void>;
  onClaimTask?: (department: "sampling" | "plant") => Promise<void>;
  isClaiming?: boolean;
  currentUser?: {
    id?: number | string;
    userid?: string;
    name?: string;
    role?: string;
    team?: string;
  } | null;
}

export const ProgramPlanningPlantReviewTab: React.FC<ProgramPlanningPlantReviewTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onSaveOutput,
  onClaimTask,
  isClaiming = false,
  currentUser,
}) => {
  const isPlantDesk = mode === "plant";

  // Claim & Ownership Verification
  const claimUserId = activeRequest.plantClaimedByUserId != null ? String(activeRequest.plantClaimedByUserId) : null;
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;
  const currentUserName = currentUser?.name?.toLowerCase().trim() || currentUser?.userid?.toLowerCase().trim();
  const claimedByName = activeRequest.plantClaimedBy?.toLowerCase().trim();

  const isClaimed = Boolean(claimUserId || activeRequest.plantClaimedBy);
  const isClaimedByMe = Boolean(
    (claimUserId && currentUserId && claimUserId === currentUserId) ||
    (claimedByName && currentUserName && claimedByName === currentUserName)
  );
  const isAdmin = currentUser?.role?.toLowerCase() === "admin" || currentUser?.role?.toLowerCase() === "administrator";

  // STRICT RULE: Marketing is strictly forbidden from submitting on behalf of Plant!
  // Only Plant desk users who have claimed the task (or root admin) can submit remarks.
  const canSubmitReview = isPlantDesk && !readOnly && (isClaimedByMe || isAdmin);

  const [draftRemark, setDraftRemark] = useState(activeRequest.plantRemark || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    setDraftRemark(activeRequest.plantRemark || "");
  }, [activeRequest.id, activeRequest.plantRemark]);

  const handleSaveObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftRemark.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await onSaveOutput(draftRemark.trim());
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err: any) {
      setSubmitError(err?.message || "Could not save Plant feasibility observation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  return (
    <div className="py-5 space-y-6 select-text text-xs">
      {/* ── Claim Banner Strip ── */}
      {isPlantDesk && !readOnly ? (
        !isClaimed ? (
          <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-amber-950 dark:text-amber-200">
                  Plant Feasibility Task Unclaimed (Plant {activeRequest.targetPlant || "1505"})
                </h4>
                <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                  Claim this program request first to verify machine tooling availability and submit formal plant feasibility sign-off.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClaimTask?.("plant")}
              disabled={isClaiming}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              <span>{isClaiming ? "Claiming Plant Task..." : "Claim Plant Task"}</span>
            </button>
          </div>
        ) : !isClaimedByMe && !isAdmin ? (
          <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/30 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-sky-950 dark:text-sky-200">
                Assigned to {activeRequest.plantClaimedBy || "Another Plant Reviewer"}
              </h4>
              <p className="text-xs text-sky-900/80 dark:text-sky-300/80 mt-0.5">
                This factory review is currently claimed and being handled by {activeRequest.plantClaimedBy}.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl border border-teal-300 bg-teal-50/80 dark:border-teal-900/50 dark:bg-teal-950/30 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-xs text-teal-950 dark:text-teal-200">
                  Claimed by You ({activeRequest.plantClaimedBy || currentUser?.name})
                </h4>
                <p className="text-[11px] text-teal-900/80 dark:text-teal-300/80">
                  You have active plant ownership. Review target hub capacity and enter formal sign-off below.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-300/50">
              Active Plant Owner
            </span>
          </div>
        )
      ) : (
        /* Marketing / ReadOnly Perspective: Informational Intake Status */
        !isClaimed ? (
          <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)] flex items-center gap-3 shadow-2xs">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <h4 className="font-display font-bold text-xs text-[var(--on-surface)]">
                Awaiting Plant Review Claim
              </h4>
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                This program plan has been dispatched to Plant {activeRequest.targetPlant || "1505"}. Awaiting claim and capacity verification by plant operations.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/20 flex items-center gap-3 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <h4 className="font-display font-bold text-xs text-[var(--on-surface)]">
                Under Plant Feasibility Evaluation by {activeRequest.plantClaimedBy}
              </h4>
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                Plant engineer has claimed this request and is conducting manufacturing feasibility review.
              </p>
            </div>
          </div>
        )
      )}

      {/* ── Editorial Header Banner ── */}
      <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300/40">
                Plant Desk Stage
              </span>
              <h2 className="text-base font-bold font-display text-[var(--on-surface)]">
                Plant Feasibility &amp; Converting Machine Capacity
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--on-surface-muted)] max-w-2xl leading-relaxed">
              Factory operations review target manufacturing lines, machine die-cutting schedules, warehousing space, and production shift capacity at Plant {activeRequest.targetPlant || "1505"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPlantNote ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-bold text-xs bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmed by {activeRequest.plantSignedBy || activeRequest.plantClaimedBy || "Plant Authority"}</span>
              </span>
            ) : isClaimed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-semibold text-xs bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Claimed by {activeRequest.plantClaimedBy}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-semibold text-xs bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Pending Claim</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section A: Primary Factory Feasibility Observation ── */}
      <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--on-surface)] flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Plant Operational Review &amp; Capacity Allocation</span>
            </h3>
            <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
              Official capacity statement from the target manufacturing facility
            </p>
          </div>
          {activeRequest.plantSignedAt && (
            <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
              Confirmed on {formatOdooDate(activeRequest.plantSignedAt)}
            </span>
          )}
        </div>

        {submitError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>✓ Plant feasibility observation successfully recorded into program audit log!</span>
          </div>
        )}

        {canSubmitReview ? (
          <form onSubmit={handleSaveObservation} className="space-y-3">
            <textarea
              rows={4}
              maxLength={4000}
              value={draftRemark}
              onChange={(e) => setDraftRemark(e.target.value)}
              placeholder={`Enter manufacturing line availability, tooling verification, shift allocation, substrate storage notes for Plant ${activeRequest.targetPlant || "1505"}...`}
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5 text-xs sm:text-[13px] leading-relaxed text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 font-sans shadow-2xs"
            />
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">
                {draftRemark.length} / 4000 characters · Recorded for Plant {activeRequest.targetPlant || "1505"}
              </span>
              <button
                type="submit"
                disabled={!draftRemark.trim() || isSubmitting}
                className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Factory Capacity Note</span>
              </button>
            </div>
          </form>
        ) : hasPlantNote ? (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] leading-relaxed text-[var(--on-surface)] font-sans whitespace-pre-wrap">
            {activeRequest.plantRemark}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--on-surface-subtle)]">
            No plant operational review has been recorded yet. Factory desk at Plant {activeRequest.targetPlant || "1505"} can add observations here.
          </div>
        )}
      </div>

    </div>
  );
};

export default ProgramPlanningPlantReviewTab;
