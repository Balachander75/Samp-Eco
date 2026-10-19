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
  Clock,
} from "lucide-react";

export interface ProgramPlanningMaterialMatrixTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onNavigateToTab?: (tab: "samp" | "plant" | "marketing" | "matrix") => void;
  onAddMaterial?: (payload: AddProgramMaterialPayload) => Promise<void>;
  onPromoteSku?: (materialId: number | string) => Promise<void>;
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
}) => {
  const materials = activeRequest.programMaterials || [];
  const skuCount = materials.length;

  const canAddSku = mode === "marketing" && !readOnly && Boolean(onAddMaterial);
  const [isAddingSku, setIsAddingSku] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

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

  return (
    <div className="space-y-2 select-text">
      {/* ── Substrate Matrix Table ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs">
        {/* Table Top Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3.5 py-2 bg-[var(--surface-low)] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <Clipboard className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-display text-[var(--on-surface)]">
                Material Specification Matrix
              </h2>
              <span className="px-1.5 py-0.2 rounded font-mono text-[9.5px] font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
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
                className="h-8 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
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
                  <th className="px-2.5 py-1.5 w-10 text-center border-r border-[var(--border-subtle)]">#</th>
                  <th className="px-3 py-1.5 min-w-[240px] border-r border-[var(--border-subtle)]">Substrate &amp; Specifications</th>
                  <th className="px-3 py-1.5 min-w-[120px] text-right border-r border-[var(--border-subtle)]">Planned Volume</th>
                  <th className="px-3 py-1.5 min-w-[280px]">Marketing Directive &amp; Application</th>
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
                      className="hover:bg-[var(--surface-low)]/80 transition-colors align-middle"
                    >
                      {/* Index */}
                      <td className="px-2.5 py-1.5 text-center font-mono font-bold text-[10.5px] text-[var(--on-surface-subtle)] border-r border-[var(--border-subtle)]">
                        {String(idx + 1).padStart(2, "0")}
                      </td>

                      {/* Substrate & Specs */}
                      <td className="px-3 py-1.5 border-r border-[var(--border-subtle)]">
                        <div className="font-semibold text-xs text-[var(--on-surface)] leading-tight">
                          {mat.materialType || "—"}
                        </div>
                        {specsParts.length > 0 && (
                          <div className="text-[10px] font-mono text-[var(--on-surface-muted)] truncate mt-0.5">
                            {specsParts.join(" · ")}
                          </div>
                        )}
                      </td>

                      {/* Planned Volume */}
                      <td className="px-3 py-1.5 text-right font-mono text-xs border-r border-[var(--border-subtle)] whitespace-nowrap">
                        <span className="font-bold text-[var(--on-surface)]">
                          {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                        </span>{" "}
                        <span className="text-[10px] text-[var(--on-surface-muted)] font-normal">
                          {mat.unit || "pcs"}
                        </span>
                      </td>

                      {/* Marketing Directive & Application */}
                      <td className="px-3 py-1.5 text-xs text-[var(--on-surface)]">
                        {mat.remark ? (
                          <div className="text-[11px] leading-snug line-clamp-2">
                            {mat.remark}
                          </div>
                        ) : (
                          <span className="text-[var(--on-surface-subtle)] font-mono text-[10.5px]">
                            — No special directive specified —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* High-Density Footer Summary Strip */}
            <div className="px-3.5 py-1.5 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[10.5px] font-mono text-[var(--on-surface-muted)] flex-wrap gap-2 select-none">
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
                    <p className="text-xs text-[var(--on-surface-muted)] mt-0.5">
                      Configure substrate properties, volume allocation, and directives.
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
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
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
                    <span>✓ SKU line successfully added to matrix!</span>
                  </div>
                )}

                {/* Section 1: Core Specifications & Volume */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                    01. Material &amp; Volume Target
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    {/* Material Type */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Material Type <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={draftMaterial.material_type || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, material_type: e.target.value }))
                        }
                        placeholder="e.g. FBB Board, Greyboard"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>

                    {/* Planned Quantity */}
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Volume <span className="text-rose-500">*</span>
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
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>

                    {/* Measurement Unit */}
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.unit ?? ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, unit: e.target.value }))
                        }
                        placeholder="pcs, sheets"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Mill Sourcing & Finish */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                    02. Sourcing &amp; Surface Properties
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Caliper / Weight
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.caliper_wt || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, caliper_wt: e.target.value }))
                        }
                        placeholder="e.g. 300 GSM"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] font-mono placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Supplier / Mill
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.supplier_name || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, supplier_name: e.target.value }))
                        }
                        placeholder="e.g. ITC, Century"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)] mb-1">
                        Grade / Brand
                      </label>
                      <input
                        type="text"
                        value={draftMaterial.grade || ""}
                        onChange={(e) =>
                          setDraftMaterial((prev) => ({ ...prev, grade: e.target.value }))
                        }
                        placeholder="e.g. Cyber Premium"
                        className="w-full h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Marketing Directives */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    03. Marketing Directives &amp; Application Scope
                  </label>
                  <textarea
                    rows={2}
                    value={draftMaterial.remark || ""}
                    onChange={(e) =>
                      setDraftMaterial((prev) => ({ ...prev, remark: e.target.value }))
                    }
                    placeholder="Specific substrate requirements, intended use (e.g. Outer Cover, Inner Leaves), grain orientation, lamination notes..."
                    className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs sm:text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)]/70 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition resize-none"
                  />
                </div>

                {/* Modal Footer Actions - Sized comfortably */}
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[11px] font-mono text-[var(--on-surface-subtle)] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                    <span>Auto-records into audit log</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingSku(false)}
                      disabled={isSubmitting}
                      className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] text-xs sm:text-sm font-semibold cursor-pointer transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-10 px-5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Add SKU Line</span>
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
