import React, { useState } from "react";
import { createPortal } from "react-dom";
import { SampleRequestItem, AddProgramMaterialPayload } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Clipboard,
  Clock,
  Plus,
  PackagePlus,
  Loader2,
  Check,
  AlertCircle,
  Calendar,
  X,
} from "lucide-react";

export interface ProgramPlanningMaterialMatrixTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onNavigateToTab?: (tab: "samp" | "plant" | "marketing") => void;
  onAddMaterial?: (payload: AddProgramMaterialPayload) => Promise<void>;
  onPromoteSku?: (materialId: number | string) => Promise<void>;
}

export const ProgramPlanningMaterialMatrixTab: React.FC<ProgramPlanningMaterialMatrixTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onAddMaterial,
  onPromoteSku,
}) => {
  const materials = activeRequest.programMaterials || [];
  const skuCount = materials.length;

  const canAddSku = mode === "marketing" && !readOnly && Boolean(onAddMaterial);
  const [isAddingSku, setIsAddingSku] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [promotingId, setPromotingId] = useState<string | number | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const handlePromoteClick = async (matId: number | string) => {
    if (!onPromoteSku || promotingId !== null) return;
    setPromoteError(null);
    setPromotingId(matId);
    try {
      await onPromoteSku(matId);
    } catch (err: any) {
      setPromoteError(err?.message || "Failed to promote SKU to sample request.");
    } finally {
      setPromotingId(null);
    }
  };

  const [draftMaterial, setDraftMaterial] = useState<AddProgramMaterialPayload>({
    material_type: "",
    supplier_name: "",
    grade: "",
    color_variant: "",
    caliper_wt: "",
    quantity: "",
    unit: "pcs",
    remark: "",
  });

  const handleAddSkuSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftMaterial.material_type?.trim()) {
      setAddError("Please specify a material type.");
      return;
    }
    if (
      !draftMaterial.quantity?.trim() ||
      isNaN(Number(draftMaterial.quantity)) ||
      Number(draftMaterial.quantity) <= 0
    ) {
      setAddError("Please enter a valid numeric planned volume.");
      return;
    }
    if (!onAddMaterial || isSubmitting) return;

    setIsSubmitting(true);
    setAddError(null);
    try {
      await onAddMaterial({
        material_type: draftMaterial.material_type.trim(),
        supplier_name: draftMaterial.supplier_name?.trim() || null,
        grade: draftMaterial.grade?.trim() || null,
        color_variant: draftMaterial.color_variant?.trim() || null,
        caliper_wt: draftMaterial.caliper_wt?.trim() || null,
        quantity: draftMaterial.quantity.trim(),
        unit: draftMaterial.unit?.trim() || "pcs",
        remark: draftMaterial.remark?.trim() || null,
      });
      setAddSuccess(true);
      setDraftMaterial({
        material_type: "",
        supplier_name: "",
        grade: "",
        color_variant: "",
        caliper_wt: "",
        quantity: "",
        unit: "pcs",
        remark: "",
      });
      setTimeout(() => {
        setAddSuccess(false);
        setIsAddingSku(false);
      }, 900);
    } catch (err: any) {
      setAddError(err?.message || "Failed to add SKU to program plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-4 space-y-4 select-text">
      {promoteError && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{promoteError}</span>
          <button
            type="button"
            onClick={() => setPromoteError(null)}
            className="p-1 hover:opacity-75 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Material Specification Matrix Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs">
        {/* Table Header Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5 bg-[var(--surface-low)] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
              <Clipboard className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold font-display text-[var(--on-surface)]">
                Marketing Material Specification Matrix
              </h2>
              <p className="text-[11px] text-[var(--on-surface-muted)] font-mono">
                {skuCount} {skuCount === 1 ? "substrate line" : "substrate lines"} configured
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canAddSku && (
              <button
                type="button"
                onClick={() => {
                  setAddError(null);
                  setAddSuccess(false);
                  setIsAddingSku(true);
                }}
                className="h-8 px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add SKU Specification</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {materials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-3.5 py-3 w-12 text-center">#</th>
                  <th className="px-3.5 py-3 min-w-[150px]">Material Type</th>
                  <th className="px-3.5 py-3 min-w-[110px] text-right">Planned Qty</th>
                  <th className="px-3.5 py-3 min-w-[80px] text-center">Unit</th>
                  <th className="px-3.5 py-3 min-w-[110px]">Caliper / Wt</th>
                  <th className="px-3.5 py-3 min-w-[130px]">Supplier / Mill</th>
                  <th className="px-3.5 py-3 min-w-[120px]">Grade / Brand</th>
                  <th className="px-3.5 py-3 min-w-[130px]">Color / Finish</th>
                  <th className="px-3.5 py-3 min-w-[180px]">Marketing Directive</th>
                  <th className="px-3.5 py-3 min-w-[180px]">SAMP Review</th>
                  <th className="px-3.5 py-3 min-w-[160px] text-center">Sampling Promotion</th>
                  <th className="px-3.5 py-3 min-w-[120px] text-center">Added Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => (
                  <tr
                    key={mat.id ?? idx}
                    className="align-middle hover:bg-[var(--surface-low)]/80 transition-colors"
                  >
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

                    {/* Planned Quantity */}
                    <td className="px-3.5 py-3 text-right font-mono font-bold text-xs text-[var(--on-surface)]">
                      {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                    </td>

                    {/* Measurement Unit */}
                    <td className="px-3.5 py-3 text-center font-mono">
                      {mat.unit ? (
                        <span className="inline-block text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium">
                          {mat.unit}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* Caliper / Weight */}
                    <td className="px-3.5 py-3 font-mono text-xs text-[var(--on-surface)]">
                      {mat.caliperWt || "—"}
                    </td>

                    {/* Supplier / Mill */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface)] font-medium">
                      {mat.supplierName || "—"}
                    </td>

                    {/* Grade / Brand */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface-muted)]">
                      {mat.grade || "—"}
                    </td>

                    {/* Color / Surface Finish */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface-muted)]">
                      {mat.colorVariant || "—"}
                    </td>

                    {/* Marketing Directive */}
                    <td className="px-3.5 py-3 text-xs text-[var(--on-surface-muted)] max-w-[220px]">
                      {mat.remark ? (
                        <div className="p-1.5 rounded-lg bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-[11px] leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
                          {mat.remark}
                        </div>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)] font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* SAMP Lab Review */}
                    <td className="px-3.5 py-3 text-xs max-w-[220px]">
                      {mat.sampRemark ? (
                        <div className="px-2 py-1 rounded-lg text-[11px] font-sans font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                          {mat.sampRemark}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
                          <Clock className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                          <span>Pending review</span>
                        </span>
                      )}
                    </td>

                    {/* Sampling Promotion */}
                    <td className="px-3.5 py-3 text-center">
                      {mat.promotedSrNumber ? (
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          title={`Promoted to commercial sample request ${mat.promotedSrNumber}`}
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{mat.promotedSrNumber}</span>
                        </div>
                      ) : !readOnly && onPromoteSku && mat.id ? (
                        <button
                          type="button"
                          disabled={promotingId !== null}
                          onClick={() => handlePromoteClick(mat.id!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white border border-[var(--accent-primary)]/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Promote this SKU specification to a commercial Sample Request"
                        >
                          {promotingId === mat.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Promoting...</span>
                            </>
                          ) : (
                            <>
                              <PackagePlus className="w-3.5 h-3.5" />
                              <span>Promote to Sample</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)] font-mono text-[11px]">
                          Planned
                        </span>
                      )}
                    </td>

                    {/* Added Date */}
                    <td className="px-3.5 py-3 text-center font-mono text-[10.5px] text-[var(--on-surface-subtle)] whitespace-nowrap">
                      {mat.createdAt ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                          <span>{formatOdooDate(mat.createdAt)}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-muted)]">Initial Launch</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-low)] text-[var(--on-surface-muted)] mx-auto flex items-center justify-center">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-[var(--on-surface)]">
                No Material SKUs Configured Yet
              </p>
              <p className="text-xs text-[var(--on-surface-muted)] max-w-sm mx-auto mt-1">
                This program plan currently has no configured material lines. Add your first substrate specification to initiate review.
              </p>
            </div>
            {canAddSku && (
              <button
                type="button"
                onClick={() => {
                  setAddError(null);
                  setAddSuccess(false);
                  setIsAddingSku(true);
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First SKU Specification</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Add SKU Specification Popup Modal ── */}
      {isAddingSku &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-text animate-in fade-in duration-150"
            onClick={() => !isSubmitting && setIsAddingSku(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.35)] overflow-hidden text-xs space-y-4 p-5 sm:p-6 transition-all"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                    <PackagePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[var(--on-surface)]">
                      Add New SKU Material Specification
                    </h3>
                    <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
                      Configure substrate specifications and volume allocation for this program plan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingSku(false)}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-xl text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] cursor-pointer transition disabled:opacity-50"
                  title="Close popup (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form with 3 Sections */}
              <form onSubmit={handleAddSkuSubmit} className="space-y-4">
                {/* Feedback Banners */}
                {addError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                {addSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>✓ SKU successfully added to matrix and recorded into audit history!</span>
                  </div>
                )}

                {/* Section 1: Core Specifications & Volume */}
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-2 flex items-center gap-1.5">
                    <span>01. Core Specifications &amp; Volume</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {/* Material Type */}
                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Material Type <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={draftMaterial.material_type || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, material_type: e.target.value }))
                        }
                        placeholder="e.g. FBB Board, Grey Board"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>

                    {/* Planned Quantity */}
                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Planned Quantity <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={draftMaterial.quantity || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, quantity: e.target.value }))
                        }
                        placeholder="e.g. 25000"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>

                    {/* Measurement Unit */}
                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Measurement Unit
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.unit ?? ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        placeholder="e.g. pcs, sheets, rolls, kg"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>

                    {/* Caliper / Weight */}
                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Caliper / Weight
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.caliper_wt || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, caliper_wt: e.target.value }))
                        }
                        placeholder="e.g. 300 GSM, 1.8mm"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Mill Sourcing & Finish */}
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-2 flex items-center gap-1.5">
                    <span>02. Sourcing &amp; Surface Properties</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Supplier / Mill
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.supplier_name || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, supplier_name: e.target.value }))
                        }
                        placeholder="e.g. ITC, Century, BILT"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Grade / Brand
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.grade || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, grade: e.target.value }))
                        }
                        placeholder="e.g. Cyber Premium, SBS"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-1">
                        Color / Surface Finish
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.color_variant || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, color_variant: e.target.value }))
                        }
                        placeholder="e.g. Natural White, Gloss Coated"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Marketing Directives */}
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] mb-2 flex items-center gap-1.5">
                    <span>03. Marketing Directives &amp; Application</span>
                  </div>
                  <textarea
                    rows={2}
                    value={draftMaterial.remark || ""}
                    onChange={(e) =>
                      setDraftMaterial((prev) => ({ ...prev, remark: e.target.value }))
                    }
                    placeholder="Specific substrate requirements, intended use (e.g. Front Cover, Inner Leaves), grain orientation, lamination notes..."
                    className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 transition shadow-2xs resize-none"
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                    <span>Will record timestamp &amp; creator in audit trail</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSku(false)}
                      disabled={isSubmitting}
                      className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-9 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm &amp; Add SKU</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ProgramPlanningMaterialMatrixTab;
