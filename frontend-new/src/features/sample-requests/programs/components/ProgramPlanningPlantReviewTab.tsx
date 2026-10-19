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
  FileCheck2,
} from "lucide-react";
import { updateBatchProgramPlantRemarksApi } from "@/infrastructure/api/programsApi";

export interface ProgramPlanningPlantReviewTabProps {
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

export const ProgramPlanningPlantReviewTab: React.FC<ProgramPlanningPlantReviewTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onSaveOutput,
  onRefreshData,
  onClaimTask,
  isClaiming = false,
  currentUser,
}) => {
  const isPlantDesk = mode === "plant";

  // Claim & Ownership Verification
  const claimUserId = activeRequest.plantClaimedByUserId != null ? String(activeRequest.plantClaimedByUserId) : null;
  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;
  const isClaimed = Boolean(claimUserId);
  const isClaimedByMe = Boolean(claimUserId && currentUserId && claimUserId === currentUserId);
  const isAdmin = currentUser?.role?.toLowerCase() === "admin" || currentUser?.role?.toLowerCase() === "administrator";

  // Every Plant response must be submitted by the reviewer who owns the claim.
  const canSubmitReview = isPlantDesk && !readOnly && isClaimedByMe;

  const [draftRemark, setDraftRemark] = useState(activeRequest.plantRemark || "");
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
    setDraftRemark(activeRequest.plantRemark || "");
    const initialMap: Record<string, string> = {};
    (activeRequest.programMaterials || []).forEach((m) => {
      if (m.id != null) {
        initialMap[String(m.id)] = m.plantRemark || "";
      }
    });
    setLineRemarks(initialMap);
  }, [activeRequest.id, activeRequest.plantRemark, activeRequest.programMaterials]);

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

  const handleSaveLineRemarks = async () => {
    if (isSavingLines) return;
    setIsSavingLines(true);
    setLineError(null);
    setLineSuccess(false);
    try {
      const payload = Object.entries(lineRemarks).map(([matId, text]) => ({
        material_id: Number(matId),
        plant_remark: text.trim(),
      }));
      await updateBatchProgramPlantRemarksApi(activeRequest.id, payload);
      setLineSuccess(true);
      setTimeout(() => setLineSuccess(false), 3000);
      await onRefreshData?.();
    } catch (err: any) {
      setLineError(err?.message || "Could not save plant material line remarks.");
    } finally {
      setIsSavingLines(false);
    }
  };

  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  return (
    <div className="py-2 space-y-3 select-text text-xs">
      {/* ── Claim Banner Strip ── */}
      {isPlantDesk && !readOnly ? (
        !isClaimed ? (
          <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/30 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-bold text-xs text-amber-950 dark:text-amber-200">
                  Plant Feasibility Task Unclaimed (Plant {activeRequest.targetPlant || "1505"})
                </h4>
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80">
                  Claim this program request first to verify machine tooling availability and submit formal plant feasibility sign-off.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClaimTask?.("plant")}
              disabled={isClaiming}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
            >
              {isClaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
              <span>{isClaiming ? "Claiming Plant Task..." : "Claim Plant Task"}</span>
            </button>
          </div>
        ) : !isClaimedByMe ? (
          <div className="p-2.5 rounded-xl border border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/30 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-700 dark:text-sky-300 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs text-sky-950 dark:text-sky-200">
                Assigned to {activeRequest.plantClaimedBy || "Another Plant Reviewer"}
              </h4>
              <p className="text-[11px] text-sky-900/80 dark:text-sky-300/80">
                This factory review is currently claimed and being handled by {activeRequest.plantClaimedBy}.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onClaimTask?.("plant")}
                disabled={isClaiming}
                className="ml-auto shrink-0 px-2.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-semibold disabled:opacity-50"
              >
                {isClaiming ? "Claiming..." : "Take Over Review"}
              </button>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl border border-teal-300 bg-teal-50/80 dark:border-teal-900/50 dark:bg-teal-950/30 flex items-center justify-between gap-2.5 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                <UserCheck className="w-3.5 h-3.5" />
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
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-300/50">
              Active Plant Owner
            </span>
          </div>
        )
      ) : (
        /* Marketing / ReadOnly Perspective: Informational Intake Status */
        !isClaimed ? (
          <div className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] flex items-center gap-2.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
          <div className="p-2.5 rounded-xl border border-teal-200 bg-teal-50/50 dark:border-teal-900/40 dark:bg-teal-950/20 flex items-center gap-2.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
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
      <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)]">
        <div className="flex items-start justify-between gap-2.5 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-300/40">
                Plant Desk Stage
              </span>
              <h2 className="text-xs sm:text-sm font-bold font-display text-[var(--on-surface)]">
                Plant Feasibility &amp; Converting Machine Capacity
              </h2>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--on-surface-muted)] max-w-2xl leading-normal">
              Factory operations review target manufacturing lines, machine die-cutting schedules, warehousing space, and production shift capacity at Plant {activeRequest.targetPlant || "1505"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasPlantNote ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-display font-bold text-[11px] bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>Confirmed by {activeRequest.plantSignedBy || activeRequest.plantClaimedBy || "Plant Authority"}</span>
              </span>
            ) : isClaimed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-display font-semibold text-[11px] bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300">
                <Clock className="w-3 h-3" />
                <span>Claimed by {activeRequest.plantClaimedBy}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-display font-semibold text-[11px] bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
                <Clock className="w-3 h-3" />
                <span>Pending Claim</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section A: Primary Factory Feasibility Observation ── */}
      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
          <div>
            <h3 className="font-display font-bold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Plant Operational Review &amp; Capacity Allocation</span>
            </h3>
            <p className="text-[10.5px] text-[var(--on-surface-muted)]">
              Official capacity statement from the target manufacturing facility
            </p>
          </div>
          {activeRequest.plantSignedAt && (
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
              Confirmed on {formatOdooDate(activeRequest.plantSignedAt)}
            </span>
          )}
        </div>

        {submitError && (
          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>✓ Plant feasibility observation successfully recorded into program audit log!</span>
          </div>
        )}

        {canSubmitReview ? (
          <form onSubmit={handleSaveObservation} className="space-y-2">
            <textarea
              rows={3}
              maxLength={4000}
              value={draftRemark}
              onChange={(e) => setDraftRemark(e.target.value)}
              placeholder={`Enter manufacturing line availability, tooling verification, shift allocation, substrate storage notes for Plant ${activeRequest.targetPlant || "1505"}...`}
              className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-2.5 text-xs leading-relaxed text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none transition focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 font-sans shadow-2xs"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
                {draftRemark.length} / 4000 characters · Recorded for Plant {activeRequest.targetPlant || "1505"}
              </span>
              <button
                type="submit"
                disabled={!draftRemark.trim() || isSubmitting}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs leading-relaxed text-[var(--on-surface)] font-sans whitespace-pre-wrap">
            {activeRequest.plantRemark}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-dashed border-[var(--border-subtle)] text-center text-[11.5px] text-[var(--on-surface-subtle)]">
            No plant operational review has been recorded yet. Factory desk at Plant {activeRequest.targetPlant || "1505"} can add observations here.
          </div>
        )}
      </div>

      {/* ── Section B: Line-by-Line Material Assessment ── */}
      {materials.length > 0 && (
        <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 flex-wrap gap-2">
            <div>
              <h3 className="font-display font-bold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Line-by-Line Material Technical Annotations</span>
              </h3>
              <p className="text-[10.5px] text-[var(--on-surface-muted)]">
                Add factory converting, die-cut tooling, and machine feasibility annotations per SKU line
              </p>
            </div>

            {canSubmitReview && (
              <button
                type="button"
                onClick={handleSaveLineRemarks}
                disabled={isSavingLines}
                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs disabled:opacity-50"
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
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>✓ Line-by-line Plant remarks saved!</span>
            </div>
          )}

          {lineError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{lineError}</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full min-w-[940px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-low)] border-b border-[var(--border-subtle)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-2 py-1.5 w-10 text-center border-r border-[var(--border-subtle)]">#</th>
                  <th className="px-2.5 py-1.5 min-w-[130px] border-r border-[var(--border-subtle)]">Material Type</th>
                  <th className="px-2.5 py-1.5 min-w-[110px] border-r border-[var(--border-subtle)]">Supplier / Mill</th>
                  <th className="px-2 py-1.5 min-w-[90px] border-r border-[var(--border-subtle)]">Caliper / Wt</th>
                  <th className="px-2.5 py-1.5 min-w-[90px] border-r border-[var(--border-subtle)]">Grade</th>
                  <th className="px-2.5 py-1.5 min-w-[80px] text-right border-r border-[var(--border-subtle)]">Quantity</th>
                  <th className="px-2.5 py-1.5 min-w-[60px] text-center border-r border-[var(--border-subtle)]">Unit</th>
                  <th className="px-2.5 py-1.5 min-w-[180px] border-r border-[var(--border-subtle)]">SAMP Note</th>
                  <th className="px-2.5 py-1.5 min-w-[260px]">Plant Technical &amp; Machine Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => (
                  <tr key={mat.id ?? idx} className="align-middle hover:bg-[var(--surface-low)]/70 transition-colors">
                    {/* Index */}
                    <td className="px-2 py-1.5 text-center font-mono font-bold text-[10.5px] text-[var(--on-surface-subtle)] border-r border-[var(--border-subtle)]">
                      {String(idx + 1).padStart(2, "0")}
                    </td>

                    {/* Material Type */}
                    <td className="px-2.5 py-1.5 border-r border-[var(--border-subtle)]">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">
                        {mat.materialType || "—"}
                      </span>
                    </td>

                    {/* Supplier / Mill */}
                    <td className="px-2.5 py-1.5 text-xs text-[var(--on-surface-muted)] border-r border-[var(--border-subtle)]">
                      {mat.supplierName || "—"}
                    </td>

                    {/* Caliper / Wt */}
                    <td className="px-2 py-1.5 font-mono text-xs text-[var(--on-surface)] border-r border-[var(--border-subtle)]">
                      {mat.caliperWt || "—"}
                    </td>

                    {/* Grade */}
                    <td className="px-2.5 py-1.5 text-xs text-[var(--on-surface-muted)] border-r border-[var(--border-subtle)]">
                      {mat.grade || "—"}
                    </td>

                    {/* Quantity */}
                    <td className="px-2.5 py-1.5 font-mono font-bold text-xs text-right text-[var(--on-surface)] border-r border-[var(--border-subtle)]">
                      {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                    </td>

                    {/* Unit */}
                    <td className="px-2 py-1.5 text-center font-mono border-r border-[var(--border-subtle)]">
                      {mat.unit ? (
                        <span className="inline-block text-[9.5px] font-mono px-1 py-0.5 rounded bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium">
                          {mat.unit}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* SAMP Technical Note (Reference) */}
                    <td className="px-2.5 py-1.5 border-r border-[var(--border-subtle)]">
                      {mat.sampRemark ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                          {mat.sampRemark}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)] font-mono text-[10.5px]">Awaiting SAMP</span>
                      )}
                    </td>

                    {/* Plant Technical & Machine Remark */}
                    <td className="px-2.5 py-1.5">
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
                          placeholder={`Plant ${activeRequest.targetPlant || "1505"}: Tooling checked · Feasible on machine...`}
                          className="w-full h-7 px-2 rounded border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition"
                        />
                      ) : (
                        <span className="text-[var(--on-surface)] text-xs">
                          {mat.plantRemark ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/50">
                              {mat.plantRemark}
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

export default ProgramPlanningPlantReviewTab;
