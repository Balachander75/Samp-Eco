import React, { useState, useEffect } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Check,
  Save,
  FileCheck2,
  AlertCircle,
  ShieldAlert,
  UserCheck,
  Lock,
} from "lucide-react";
import { updateBatchProgramSampRemarksApi } from "@/infrastructure/api/programsApi";

export interface ProgramPlanningSampReviewTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onSaveOutput: (remark: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
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

export const ProgramPlanningSampReviewTab: React.FC<ProgramPlanningSampReviewTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onSaveOutput,
  onRefreshData,
  onClaimTask,
  isClaiming = false,
  currentUser,
}) => {
  const isSamplingDesk = mode === "sampling";

  // Claim & Ownership Verification
  const claimUserId = activeRequest.samplingClaimedByUserId != null ? String(activeRequest.samplingClaimedByUserId) : null;
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;
  const currentUserName = currentUser?.name?.toLowerCase().trim() || currentUser?.userid?.toLowerCase().trim();
  const claimedByName = activeRequest.samplingClaimedBy?.toLowerCase().trim();

  const isClaimed = Boolean(claimUserId || activeRequest.samplingClaimedBy);
  const isClaimedByMe = Boolean(
    (claimUserId && currentUserId && claimUserId === currentUserId) ||
    (claimedByName && currentUserName && claimedByName === currentUserName)
  );
  const isAdmin = currentUser?.role?.toLowerCase() === "admin" || currentUser?.role?.toLowerCase() === "administrator";

  // STRICT RULE: Marketing is strictly forbidden from submitting on behalf of SAMP!
  // Only SAMP desk users who have claimed the task (or root admin) can submit remarks.
  const canSubmitReview = isSamplingDesk && !readOnly && (isClaimedByMe || isAdmin);

  const [draftRemark, setDraftRemark] = useState(activeRequest.samplingRemark || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Line-by-line remarks state
  const materials = activeRequest.programMaterials || [];
  const [lineRemarks, setLineRemarks] = useState<Record<string, string>>({});
  const [isSavingLines, setIsSavingLines] = useState(false);
  const [lineSuccess, setLineSuccess] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);

  useEffect(() => {
    setDraftRemark(activeRequest.samplingRemark || "");
    const initialMap: Record<string, string> = {};
    (activeRequest.programMaterials || []).forEach((m) => {
      if (m.id != null) {
        initialMap[String(m.id)] = m.sampRemark || "";
      }
    });
    setLineRemarks(initialMap);
  }, [activeRequest.id, activeRequest.samplingRemark, activeRequest.programMaterials]);

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
      setSubmitError(err?.message || "Could not save SAMP technical review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLineRemarks = async () => {
    if (isSavingLines) return;
    setIsSavingLines(true);
    setLineError(null);
    setLineSuccess(false);
    try {
      const payload = Object.entries(lineRemarks).map(([matId, text]) => ({
        material_id: Number(matId),
        samp_remark: text.trim(),
      }));
      await updateBatchProgramSampRemarksApi(activeRequest.id, payload);
      setLineSuccess(true);
      setTimeout(() => setLineSuccess(false), 3000);
      await onRefreshData?.();
    } catch (err: any) {
      setLineError(err?.message || "Could not save material line remarks.");
    } finally {
      setIsSavingLines(false);
    }
  };

  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());

  return (
    <div className="py-5 space-y-6 select-text text-xs">
      {/* ── Claim Banner Strip ── */}
      {isSamplingDesk && !readOnly ? (
        !isClaimed ? (
          <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display font-bold text-sm text-amber-950 dark:text-amber-200">
                  Sampling Technical Review Unclaimed
                </h4>
                <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                  You must claim this program request first to unlock material specifications and submit formal SAMP technical evaluation.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClaimTask?.("sampling")}
              disabled={isClaiming}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              <span>{isClaiming ? "Claiming Review..." : "Claim Technical Review"}</span>
            </button>
          </div>
        ) : !isClaimedByMe && !isAdmin ? (
          <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/30 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-sky-950 dark:text-sky-200">
                Assigned to {activeRequest.samplingClaimedBy || "Another SAMP Reviewer"}
              </h4>
              <p className="text-xs text-sky-900/80 dark:text-sky-300/80 mt-0.5">
                This technical review is currently claimed and being handled by {activeRequest.samplingClaimedBy}.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-xs text-emerald-950 dark:text-emerald-200">
                  Claimed by You ({activeRequest.samplingClaimedBy || currentUser?.name})
                </h4>
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                  You have active technical ownership. Complete line remarks and submit formal observation below.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50">
              Active Owner
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
                Awaiting Sampling Review Claim
              </h4>
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                This program plan has been released to Sampling Team. Awaiting claim and substrate evaluation by SAMP lab.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20 flex items-center gap-3 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-display font-bold text-xs text-[var(--on-surface)]">
                Under Technical Evaluation by {activeRequest.samplingClaimedBy}
              </h4>
              <p className="text-[11px] text-[var(--on-surface-muted)]">
                Sampling reviewer has claimed this request and is conducting technical evaluation.
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
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                SAMP Lab Stage
              </span>
              <h2 className="text-base font-bold font-display text-[var(--on-surface)]">
                Technical Feasibility &amp; Substrate Specifications
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--on-surface-muted)] max-w-2xl leading-relaxed">
              SAMP Lab evaluates substrate characteristics, machine tooling compatibility, paper grain orientation, and trial runs for all SKUs in this program plan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasSampNote ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Reviewed by {activeRequest.samplingSignedBy || activeRequest.samplingClaimedBy || "SAMP Team"}</span>
              </span>
            ) : isClaimed ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-display font-semibold text-xs bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300">
                <Clock className="w-3.5 h-3.5" />
                <span>Claimed by {activeRequest.samplingClaimedBy}</span>
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

      {/* ── Section A: Primary Technical Observation ── */}
      <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--on-surface)] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>General Technical Sign-Off Observation</span>
            </h3>
            <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
              Authoritative technical review note visible to Marketing Desk and Plant Operations
            </p>
          </div>
          {activeRequest.samplingSignedAt && (
            <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
              Signed on {formatOdooDate(activeRequest.samplingSignedAt)}
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
            <span>✓ Technical observation successfully recorded into program audit log!</span>
          </div>
        )}

        {canSubmitReview ? (
          <form onSubmit={handleSaveObservation} className="space-y-3">
            <textarea
              rows={4}
              maxLength={4000}
              value={draftRemark}
              onChange={(e) => setDraftRemark(e.target.value)}
              placeholder="Enter technical observations, tooling compatibility, caliper tolerances, grain directions, or alternative substrate recommendations..."
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5 text-xs sm:text-[13px] leading-relaxed text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 font-sans shadow-2xs"
            />
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">
                {draftRemark.length} / 4000 characters · Saved to permanent program audit chatter
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
                <span>Save Technical Observation</span>
              </button>
            </div>
          </form>
        ) : hasSampNote ? (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-[13px] leading-relaxed text-[var(--on-surface)] font-sans whitespace-pre-wrap">
            {activeRequest.samplingRemark}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--on-surface-subtle)]">
            No technical review has been recorded yet. SAMP Team engineers can add observations here.
          </div>
        )}
      </div>

      {/* ── Section B: Line-by-Line Material Assessment ── */}
      {materials.length > 0 && (
        <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Line-by-Line Material Technical Annotations</span>
              </h3>
              <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
                Add specific technical remarks per material specification line item
              </p>
            </div>

            {canSubmitReview && (
              <button
                type="button"
                onClick={handleSaveLineRemarks}
                disabled={isSavingLines}
                className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
              >
                {isSavingLines ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Line Remarks</span>
              </button>
            )}
          </div>

          {lineSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>✓ Line-by-line SAMP remarks saved!</span>
            </div>
          )}

          {lineError && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{lineError}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-low)] border-b border-[var(--border-subtle)] text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                  <th className="px-3.5 py-2.5 min-w-[140px]">Material Type</th>
                  <th className="px-3.5 py-2.5 min-w-[120px]">Supplier / Mill</th>
                  <th className="px-3.5 py-2.5 min-w-[100px]">Caliper / Wt</th>
                  <th className="px-3.5 py-2.5 min-w-[100px]">Grade</th>
                  <th className="px-3.5 py-2.5 min-w-[90px] text-right">Quantity</th>
                  <th className="px-3.5 py-2.5 min-w-[70px] text-center">Unit</th>
                  <th className="px-3.5 py-2.5 min-w-[280px]">SAMP Technical Evaluation Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => (
                  <tr key={mat.id ?? idx} className="align-middle hover:bg-[var(--surface-low)] transition-colors">
                    {/* Index */}
                    <td className="px-3.5 py-3 text-center font-mono font-bold text-[11px] text-[var(--on-surface-subtle)]">
                      {String(idx + 1).padStart(2, "0")}
                    </td>

                    {/* Material Type */}
                    <td className="px-3.5 py-3">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">
                        {mat.materialType || "—"}
                      </span>
                    </td>

                    {/* Supplier / Mill */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface-muted)]">
                      {mat.supplierName || "—"}
                    </td>

                    {/* Caliper / Wt */}
                    <td className="px-3.5 py-3 font-mono text-xs text-[var(--on-surface)]">
                      {mat.caliperWt || "—"}
                    </td>

                    {/* Grade */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface-muted)]">
                      {mat.grade || "—"}
                    </td>

                    {/* Quantity */}
                    <td className="px-3.5 py-3 font-mono font-bold text-xs text-right text-[var(--on-surface)]">
                      {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                    </td>

                    {/* Unit */}
                    <td className="px-3.5 py-3 text-center font-mono">
                      {mat.unit ? (
                        <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium">
                          {mat.unit}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* SAMP Technical Remark Input / Display */}
                    <td className="px-3.5 py-3">
                      {canSubmitReview && mat.id != null ? (
                        <input
                          type="text"
                          value={lineRemarks[String(mat.id)] || ""}
                          onChange={(e) =>
                            setLineRemarks((prev) => ({
                              ...prev,
                              [String(mat.id)]: e.target.value,
                            }))
                          }
                          placeholder="e.g. Approved · Caliper verified · Alternative 300 GSM tested"
                          className="w-full h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                        />
                      ) : (
                        <span className="text-[var(--on-surface)] text-xs">
                          {mat.sampRemark ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                              {mat.sampRemark}
                            </span>
                          ) : (
                            <span className="text-[var(--on-surface-subtle)] font-mono text-[11px]">—</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProgramPlanningSampReviewTab;
