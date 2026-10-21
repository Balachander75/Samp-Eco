import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { SampleRequestItem, AddProgramMaterialPayload } from "../../types";
import {
  Clipboard,
  Plus,
  PackagePlus,
  AlertCircle,
  Check,
  X,
  Loader2,
  Trash2,
} from "lucide-react";

export interface ProgramPlanningMaterialMatrixTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onNavigateToTab?: (tab: "samp" | "plant" | "matrix") => void;
  onAddMaterial?: (payload: AddProgramMaterialPayload) => Promise<void>;
  onDeleteMaterial?: (materialId: number | string) => Promise<any>;
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

export const ProgramPlanningMaterialMatrixTab: React.FC<ProgramPlanningMaterialMatrixTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onAddMaterial,
  onDeleteMaterial,
  onRefreshData,
}) => {
  const materials = activeRequest.programMaterials || [];
  const skuCount = materials.length;

  const canManageSku = mode === "marketing" && !readOnly;
  const canAddSku = canManageSku && Boolean(onAddMaterial);
  const [isAddingSku, setIsAddingSku] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);  // Row Action States
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Summary statistics
  const summaryStats = useMemo(() => {
    let totalQty = 0;
    materials.forEach((m) => {
      const q = parseFloat(String(m.quantity || "0").replace(/,/g, ""));
      if (!isNaN(q)) totalQty += q;
    });
    return { totalQty };
  }, [materials]);

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
      setAddError("Please enter a material type.");
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
      }, 600);
    } catch (err: any) {
      setAddError(err?.message || "Failed to add SKU to program plan.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeleteRow = async (matId: number | string) => {
    if (!onDeleteMaterial || deletingId) return;
    if (!window.confirm("Remove this SKU line from the material matrix?")) return;
    setDeletingId(matId);
    setActionError(null);
    try {
      await onDeleteMaterial(matId);
      await onRefreshData?.();
    } catch (err: any) {
      setActionError(err?.message || "Failed to remove SKU line.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-2 select-text">
      {actionError && (
        <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="cursor-pointer text-rose-600 hover:text-rose-900 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Substrate Matrix Table ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs">
        {/* Table Top Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5 bg-[var(--surface-low)] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Clipboard className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-display text-[var(--on-surface)]">
                Material Specification Matrix
              </h2>
              <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
                {skuCount} {skuCount === 1 ? "SKU" : "SKUs"}
              </span>
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
                className="h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add SKU Line</span>
              </button>
            )}
          </div>
        </div>

        {/* High-Density Spreadsheet Matrix Table */}
        {materials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-3 py-2 w-12 text-center border-r border-[var(--border-subtle)]">#</th>
                  <th className="px-3.5 py-2 min-w-[220px] border-r border-[var(--border-subtle)]">Substrate &amp; Specifications</th>
                  <th className="px-3.5 py-2 min-w-[120px] text-right border-r border-[var(--border-subtle)]">Planned Volume</th>
                  <th className="px-3.5 py-2 min-w-[220px] border-r border-[var(--border-subtle)]">SAMP &amp; Plant Feedback</th>
                  <th className="px-3.5 py-2 min-w-[180px] border-r border-[var(--border-subtle)]">Marketing Directive</th>
                  {canManageSku && onDeleteMaterial && <th className="px-3 py-2 w-14 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => {
                  const rowId = mat.id ?? idx;
                  const specsParts = [
                    mat.caliperWt,
                    mat.grade,
                    mat.supplierName,
                    mat.colorVariant,
                  ].filter(Boolean);

                  return (
                    <tr
                      key={rowId}
                      className="hover:bg-[var(--surface-low)]/70 transition-colors align-top"
                    >
                      {/* Index */}
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-[10.5px] text-[var(--on-surface-subtle)] border-r border-[var(--border-subtle)] pt-3">
                        {String(idx + 1).padStart(2, "0")}
                      </td>

                      {/* Substrate & Specs */}
                      <td className="px-3.5 py-2.5 border-r border-[var(--border-subtle)]">
                        <div className="font-semibold text-xs text-[var(--on-surface)] leading-tight">
                          {mat.materialType || "—"}
                        </div>
                        {specsParts.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {specsParts.map((spec, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Planned Volume */}
                      <td className="px-3.5 py-2.5 text-right font-mono text-xs border-r border-[var(--border-subtle)] whitespace-nowrap pt-3">
                        <span className="font-bold text-[var(--on-surface)]">
                          {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                        </span>{" "}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                          {mat.unit || "pcs"}
                        </span>
                      </td>

                      {/* SAMP & Plant Feedback */}
                      <td className="px-3.5 py-2.5 border-r border-[var(--border-subtle)]">
                        <div className="space-y-1.5">
                          {mat.sampRemark && (
                            <div className="flex items-start gap-1.5 text-[10.5px] text-emerald-800 dark:text-emerald-300">
                              <span className="px-1 py-0.2 rounded font-mono font-bold text-[8.5px] bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border border-emerald-500/25 shrink-0 mt-0.5">SAMP</span>
                              <span className="line-clamp-2 leading-tight">{mat.sampRemark}</span>
                            </div>
                          )}
                          {mat.plantRemark && (
                            <div className="flex items-start gap-1.5 text-[10.5px] text-teal-800 dark:text-teal-300">
                              <span className="px-1 py-0.2 rounded font-mono font-bold text-[8.5px] bg-teal-500/15 text-teal-900 dark:text-teal-200 border border-teal-500/25 shrink-0 mt-0.5">PLANT</span>
                              <span className="line-clamp-2 leading-tight">{mat.plantRemark}</span>
                            </div>
                          )}
                          {!mat.sampRemark && !mat.plantRemark && (
                            <span className="text-[10.5px] font-mono text-[var(--on-surface-subtle)]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Marketing Directive & Application */}
                      <td className="px-3.5 py-2.5 text-xs text-[var(--on-surface)] border-r border-[var(--border-subtle)] pt-3">
                        {mat.remark ? (
                          <div className="text-[11px] leading-snug line-clamp-2">
                            {mat.remark}
                          </div>
                        ) : (
                          <span className="text-[var(--on-surface-subtle)] font-mono text-[10.5px]">
                            — Standard production —
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {canManageSku && onDeleteMaterial && (
                        <td className="px-3 py-2.5 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(mat.id!)}
                            disabled={deletingId === mat.id}
                            className="h-6 w-6 mx-auto rounded-md hover:bg-rose-500/10 text-[var(--on-surface-subtle)] hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                            title="Remove SKU line"
                          >
                            {deletingId === mat.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* High-Density Footer Summary Strip */}
            <div className="px-4 py-2 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[10.5px] font-mono text-[var(--on-surface-muted)] flex-wrap gap-2 select-none">
              <div className="flex items-center gap-3">
                <span>
                  Total SKUs: <strong className="text-[var(--on-surface)]">{materials.length}</strong>
                </span>
                <span className="opacity-40">·</span>
                <span>
                  Sum Volume:{" "}
                  <strong className="text-[var(--on-surface)]">
                    {summaryStats.totalQty.toLocaleString()} units
                  </strong>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--surface-low)] text-[var(--on-surface-muted)] mx-auto flex items-center justify-center">
              <PackagePlus className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display font-bold text-sm text-[var(--on-surface)]">
                No Material SKUs Configured Yet
              </p>
              <p className="text-xs text-[var(--on-surface-muted)] max-w-sm mx-auto mt-0.5">
                Add substrate specifications to start multi-department program planning.
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
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add First SKU Line</span>
              </button>
            )}
          </div>
        )}
      </div>

      

      {/* ── Add SKU Specification Popup Modal ── */}
      {isAddingSku &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs select-text animate-in fade-in duration-150"
            onClick={() => !isSubmitting && setIsAddingSku(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.35)] overflow-hidden space-y-4 p-5 sm:p-6 transition-all"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-[var(--on-surface)]">
                      Add SKU Material Specification
                    </h3>
                    <p className="text-xs text-[var(--on-surface-muted)]">
                      Configure substrate characteristics for seasonal planning
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingSku(false)}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddSkuSubmit} className="space-y-4 text-xs">
                {addError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}
                {addSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>SKU specification added successfully!</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Material Type */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Material Type <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Folding Box Board, Kraft Paper, Greyboard"
                      value={draftMaterial.material_type || ""}
                      onChange={(e) =>
                        setDraftMaterial((prev) => ({ ...prev, material_type: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                    />
                  </div>

                  {/* Supplier Info */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Supplier / Mill
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ITC Ltd, Century Pulp, Bilt"
                      value={draftMaterial.supplier_name || ""}
                      onChange={(e) =>
                        setDraftMaterial((prev) => ({ ...prev, supplier_name: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                    />
                  </div>

                  {/* Grade */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Grade
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cyber XL Pac, Super Kraft"
                      value={draftMaterial.grade || ""}
                      onChange={(e) =>
                        setDraftMaterial((prev) => ({ ...prev, grade: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                    />
                  </div>

                  {/* Color / Variant */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Color / Variant
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Natural White, Golden Brown, Bleached"
                      value={draftMaterial.color_variant || ""}
                      onChange={(e) =>
                        setDraftMaterial((prev) => ({ ...prev, color_variant: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                    />
                  </div>

                  {/* Caliper / Weight */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Caliper / Weight (GSM/Microns)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 300 GSM, 450 Microns, 1.8mm"
                      value={draftMaterial.caliper_wt || ""}
                      onChange={(e) =>
                        setDraftMaterial((prev) => ({ ...prev, caliper_wt: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all font-sans shadow-2xs"
                    />
                  </div>

                  {/* Planned Quantity & Unit */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                      Planned Volume &amp; Unit <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 50000"
                        value={draftMaterial.quantity || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, quantity: e.target.value }))
                        }
                        className="flex-1 h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] font-mono text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all shadow-2xs"
                      />
                      <input
                        type="text"
                        placeholder="pcs"
                        value={draftMaterial.unit || "pcs"}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        className="w-20 h-9 px-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] font-mono text-xs text-[var(--on-surface)] text-center focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Directive & Application Remark */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    Marketing Directive / Application Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Outer lid wrap with soft touch lamination; grain parallel to spine"
                    value={draftMaterial.remark || ""}
                    onChange={(e) =>
                      setDraftMaterial((prev) => ({ ...prev, remark: e.target.value }))
                    }
                    className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20 transition-all resize-none shadow-2xs font-sans"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setIsAddingSku(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{isSubmitting ? "Adding..." : "Add to Material Matrix"}</span>
                  </button>
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
