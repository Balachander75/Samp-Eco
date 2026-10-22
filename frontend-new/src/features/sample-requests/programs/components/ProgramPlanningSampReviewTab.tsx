import React, { useState, useEffect } from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  CheckCircle2,
  Factory,
  Loader2,
  ShieldCheck,
  Check,
  Save,
  FileCheck2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { updateBatchProgramSampRemarksApi } from "@/infrastructure/api/programsApi";
import { TaskClaimBanner } from "@/components/ui/TaskClaimBanner";

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
  const claimOwner = activeRequest.samplingClaimedBy || null;
  const isClaimed = Boolean(claimUserId || claimOwner);
  const isClaimedByMe = Boolean(isClaimed && (
    claimUserId && currentUserId
      ? claimUserId === currentUserId
      : [currentUser?.name, currentUser?.userid].some((value) =>
          Boolean(value && claimOwner && value.trim().toLowerCase() === claimOwner.trim().toLowerCase())
        )
  ));

  // Every SAMP response must be submitted by the reviewer who owns the claim.
  const canSubmitReview = isSamplingDesk && !readOnly && isClaimedByMe;

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
    <div className="py-2 space-y-3 select-text text-xs">
      {/* ── 1. Compact Sampling Review Parameters & Ownership Strip ── */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Target Plant */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
              <Factory className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
                Destination
              </span>
              <span className="font-mono font-bold text-xs text-[var(--on-surface)]">
                {activeRequest.targetPlant?.toLowerCase().startsWith("plant") ? activeRequest.targetPlant : `Plant ${activeRequest.targetPlant || "1505"}`}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[var(--border-subtle)] hidden sm:block" />

          {/* Substrate SKUs */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
                Substrate Scope
              </span>
              <span className="font-sans font-bold text-xs text-[var(--on-surface)]">
                {materials.length} Material {materials.length === 1 ? "Line" : "Lines"}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[var(--border-subtle)] hidden sm:block" />

          {/* Assigned Reviewer */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0 border border-[var(--accent-primary)]/20">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
                Sampling Reviewer
              </span>
              <span className="font-sans font-bold text-xs text-[var(--on-surface)]">
                {activeRequest.samplingClaimedBy || (
                  <span className="text-amber-600 dark:text-amber-400 italic">Unclaimed</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Claim / Status Action Button on Right */}
        <div className="flex items-center gap-2">
          {hasSampNote ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Review Completed</span>
            </span>
          ) : isSamplingDesk && !readOnly && !isClaimed ? (
            <button
              type="button"
              onClick={() => onClaimTask?.("sampling")}
              disabled={isClaiming}
              className="px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50"
            >
              {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              <span>{isClaiming ? "Claiming..." : "Claim Sampling Task"}</span>
            </button>
          ) : isClaimedByMe ? (
            <span className="px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
              ✓ Active Owner
            </span>
          ) : isClaimed ? (
            <span className="px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
              Claimed by {activeRequest.samplingClaimedBy}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-medium bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25">
              Pending Claim
            </span>
          )}
        </div>
      </div>

      {/* ── Section A: Primary Technical Observation ── */}
      {isClaimed && (
        <TaskClaimBanner claimedBy={claimOwner} isClaimedByCurrentUser={isClaimedByMe} compact />
      )}
      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <div>
            <h3 className="font-display font-bold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>General Technical Sign-Off Observation</span>
            </h3>
            <p className="text-[10.5px] text-[var(--on-surface-muted)]">
              Authoritative technical review note visible to Marketing Desk and Plant Operations
            </p>
          </div>
          {activeRequest.samplingSignedAt && (
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
              Signed on {formatOdooDate(activeRequest.samplingSignedAt)}
            </span>
          )}
        </div>

        {submitError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Technical observation successfully recorded into program audit log</span>
          </div>
        )}

        {canSubmitReview ? (
          <form onSubmit={handleSaveObservation} className="space-y-2">
            <textarea
              rows={3}
              maxLength={4000}
              value={draftRemark}
              onChange={(e) => setDraftRemark(e.target.value)}
              placeholder="Enter technical observations, tooling compatibility, caliper tolerances, grain directions, or alternative substrate recommendations..."
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3 text-xs leading-relaxed text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 font-sans shadow-2xs"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
                {draftRemark.length} / 4000 characters · Saved to permanent audit chatter
              </span>
              <button
                type="submit"
                disabled={!draftRemark.trim() || isSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
              <span className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {activeRequest.samplingSignedBy || activeRequest.samplingClaimedBy || "Sampling Team Reviewer"}
              </span>
              {activeRequest.samplingSignedAt && (
                <span className="opacity-75">{formatOdooDate(activeRequest.samplingSignedAt)}</span>
              )}
            </div>
            <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap font-sans">
              {activeRequest.samplingRemark}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--on-surface-subtle)]">
            No technical review has been recorded yet. SAMP Team engineers can add observations here.
          </div>
        )}
      </div>

      {/* ── Section B: Line-by-Line Material Assessment ── */}
      {materials.length > 0 && (
        <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Line-by-Line Material Technical Annotations</span>
              </h3>
              <p className="text-[10.5px] text-[var(--on-surface-muted)]">
                Add specific technical remarks per material specification line item
              </p>
            </div>

            {canSubmitReview && (
              <button
                type="button"
                onClick={handleSaveLineRemarks}
                disabled={isSavingLines}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50"
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
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Line-by-line SAMP remarks saved</span>
            </div>
          )}

          {lineError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{lineError}</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full min-w-[880px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-3 py-2 w-12 text-center border-r border-[var(--border-subtle)]">#</th>
                  <th className="px-3.5 py-2 min-w-[140px] border-r border-[var(--border-subtle)]">Material Type</th>
                  <th className="px-3 py-2 min-w-[120px] border-r border-[var(--border-subtle)]">Supplier / Mill</th>
                  <th className="px-3 py-2 min-w-[100px] border-r border-[var(--border-subtle)]">Caliper / Wt</th>
                  <th className="px-3 py-2 min-w-[100px] border-r border-[var(--border-subtle)]">Grade</th>
                  <th className="px-3 py-2 min-w-[90px] text-right border-r border-[var(--border-subtle)]">Quantity</th>
                  <th className="px-2.5 py-2 min-w-[60px] text-center border-r border-[var(--border-subtle)]">Unit</th>
                  <th className="px-3.5 py-2 min-w-[280px]">SAMP Technical Evaluation Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => (
                  <tr key={mat.id ?? idx} className="align-middle hover:bg-[var(--surface-low)]/70 transition-colors">
                    {/* Index */}
                    <td className="px-3 py-2 text-center font-mono font-bold text-[10.5px] text-[var(--on-surface-subtle)] border-r border-[var(--border-subtle)]">
                      {String(idx + 1).padStart(2, "0")}
                    </td>

                    {/* Material Type */}
                    <td className="px-3.5 py-2 border-r border-[var(--border-subtle)]">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">
                        {mat.materialType || "—"}
                      </span>
                    </td>

                    {/* Supplier / Mill */}
                    <td className="px-3 py-2 text-xs text-[var(--on-surface-muted)] border-r border-[var(--border-subtle)]">
                      {mat.supplierName || "—"}
                    </td>

                    {/* Caliper / Wt */}
                    <td className="px-3 py-2 font-mono text-xs text-[var(--on-surface)] border-r border-[var(--border-subtle)]">
                      {mat.caliperWt || "—"}
                    </td>

                    {/* Grade */}
                    <td className="px-3 py-2 text-xs text-[var(--on-surface-muted)] border-r border-[var(--border-subtle)]">
                      {mat.grade || "—"}
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-2 font-mono font-bold text-xs text-right text-[var(--on-surface)] border-r border-[var(--border-subtle)]">
                      {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                    </td>

                    {/* Unit */}
                    <td className="px-2.5 py-2 text-center font-mono border-r border-[var(--border-subtle)]">
                      {mat.unit ? (
                        <span className="inline-block text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium">
                          {mat.unit}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* SAMP Technical Remark Input / Display */}
                    <td className="px-3.5 py-2">
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
                          placeholder="e.g. Substrate verified · Grain parallel · Alternative approved..."
                          className="w-full h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                        />
                      ) : (
                        <span className="text-[var(--on-surface)] text-xs">
                          {mat.sampRemark ? (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20">
                              {mat.sampRemark}
                            </span>
                          ) : (
                            <span className="text-[var(--on-surface-subtle)] font-mono text-[10.5px]">—</span>
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
