import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  ChevronRight,
  AlertCircle,
  Pencil,
  X,
  Send,
  Building2,
} from "lucide-react";
import { UserProfile } from "@/features/auth";
import { createProgramRequestApi } from "@/infrastructure/api";
import { CreateProgramRequestPayload } from "../types";
import { useMasterData } from "../hooks/useMasterData";

export interface ProgramMaterialRow {
  id: string;
  materialType: string;
  supplierInfo: string;
  grade: string;
  colorVariant: string;
  caliperWt: string;
  qty: string;
  unit: string;
  remark: string;
}

export interface ProgramPlanningWorkspaceProps {
  user?: UserProfile | null;
}

interface LocationState {
  customer?: string;
  targetPlant?: string;
  programPlanName?: string;
  programName?: string;
  programPlanYear?: string;
  programYear?: string;
}

export const ProgramPlanningWorkspace: React.FC<ProgramPlanningWorkspaceProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};
  const { customers, plants, error: masterDataError } = useMasterData();

  const currentYearStr = new Date().getFullYear().toString();

  // Operational Campaign Parameters
  const [customer, setCustomer] = useState(state.customer || "");
  const [targetPlant, setTargetPlant] = useState(state.targetPlant || "");
  const [programPlanName, setProgramPlanName] = useState(
    state.programPlanName || state.programName || "Seasonal Scholastic Line"
  );
  const [programPlanYear, setProgramPlanYear] = useState(
    state.programPlanYear || state.programYear || currentYearStr
  );

  // Toggle inline editing of parameters
  const [isEditingSetup, setIsEditingSetup] = useState(false);

  // Material Specification Matrix
  const [materialRows, setMaterialRows] = useState<ProgramMaterialRow[]>([
    {
      id: "mat-1",
      materialType: "",
      supplierInfo: "",
      grade: "",
      colorVariant: "",
      caliperWt: "",
      qty: "",
      unit: "",
      remark: "",
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customers.length || !plants.length) return;
    setCustomer((current) => current || customers[0].name);
    setTargetPlant((current) => current || plants[0].name);
  }, [customers, plants]);

  useEffect(() => {
    if (masterDataError) setError(masterDataError);
  }, [masterDataError]);

  // Row Manipulation
  const handleAddRow = () => {
    const nextId = `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setMaterialRows((prev) => [
      ...prev,
      {
        id: nextId,
        materialType: "",
        supplierInfo: "",
        grade: "",
        colorVariant: "",
        caliperWt: "",
        qty: "",
        unit: "",
        remark: "",
      },
    ]);
    setTimeout(() => {
      const el = document.getElementById(`mat-type-${nextId}`);
      if (el) el.focus();
    }, 40);
  };

  const handleDuplicateRow = (row: ProgramMaterialRow) => {
    setMaterialRows((prev) => [
      ...prev,
      {
        ...row,
        id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setMaterialRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const updateRow = (id: string, field: keyof ProgramMaterialRow, value: string) => {
    setMaterialRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Live Summary Aggregations
  const summaryStats = useMemo(() => {
    const filledRows = materialRows.filter((r) => r.materialType.trim());
    const totalQty = filledRows.reduce((acc, r) => acc + (Number(r.qty) || 0), 0);
    return {
      totalConfigured: materialRows.length,
      totalFilled: filledRows.length,
      totalQty,
    };
  }, [materialRows]);

  // Submit to Backend & Send to Sampling Team
  const handleSubmitProgramRequest = async () => {
    if (!customer.trim()) {
      setError("Please specify a customer account.");
      return;
    }
    if (!targetPlant.trim()) {
      setError("Please specify a target manufacturing facility.");
      return;
    }
    if (!programPlanName.trim()) {
      setError("Please provide a program campaign title.");
      return;
    }

    const filledRows = materialRows.filter((r) => r.materialType.trim());
    if (filledRows.length === 0) {
      setError("Please enter at least one material specification row with a material type.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const apiPayload: CreateProgramRequestPayload = {
      customer_name: customer.trim(),
      target_plant: targetPlant.trim(),
      program_campaign_title: programPlanName.trim(),
      program_year: programPlanYear.trim(),
      created_by: user?.name || user?.userid || "Marketing Specialist",
      materials: filledRows.map((r) => ({
        material_type: r.materialType.trim() || null,
        supplier_name: r.supplierInfo.trim() || null,
        grade: r.grade.trim() || null,
        color_variant: r.colorVariant.trim() || null,
        caliper_wt: r.caliperWt.trim() || null,
        quantity: r.qty.trim() || null,
        unit: r.unit.trim() || null,
        remark: r.remark.trim() || null,
      })),
    };

    try {
      const record = await createProgramRequestApi(apiPayload);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      }
      navigate("/sample-requests/programs", {
        replace: true,
        state: {
          toastMessage: `✓ Program Request ${record.requestCode} submitted to Sampling Team!`,
        },
      });
      return;
    } catch (err: any) {
      // Program records must have one durable source of truth. Do not silently
      // create a sample-request fallback with a random code when this API fails.
      setError(err instanceof Error ? err.message : "Could not register the program request. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/60 text-slate-800 overflow-y-auto select-text">
      {/* ── 1. Page Header (Clean Editorial) ── */}
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 sticky top-0 z-20 shadow-2xs">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/sample-requests/programs")}
              className="p-2 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Return to Program Planning Desk"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                <span
                  onClick={() => navigate("/sample-requests/programs")}
                  className="hover:text-[var(--accent-primary)] cursor-pointer transition-colors"
                >
                  Marketing Work
                </span>
                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-slate-900 font-medium">Seasonal Program Planning</span>
              </div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight truncate mt-0.5 font-display">
                Seasonal Program Planning Workspace
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleSubmitProgramRequest}
              disabled={isSubmitting}
              className="h-9 px-5 rounded-xl text-white text-xs font-semibold shadow-[0_2px_10px_rgba(0,109,50,0.25)] hover:shadow-[0_4px_14px_rgba(0,109,50,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 tracking-tight shrink-0 active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              {isSubmitting ? (
                <span className="animate-spin text-white font-mono">•</span>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? "Submitting..." : "Create Program Request"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Body (Full Size, No Vacant Margins) */}
      <div className="flex-1 w-full px-5 sm:px-7 py-4 space-y-4">

        {/* Error Toast */}
        {error && (
          <div className="px-4 py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="p-1 cursor-pointer hover:bg-rose-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── 2. Master Parameters Ribbon Card ── */}
        <div className="rounded-2xl border border-slate-200/70 bg-white px-5 py-3.5 shadow-[0_2px_12px_rgba(11,28,48,0.02)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-primary)] text-white shadow-2xs">
                PLANNING FOR
              </span>

              <span className="font-bold text-slate-900 text-sm">
                {customer || "Unspecified Customer"}
              </span>

              <span className="text-slate-300">•</span>

              <span className="font-semibold text-[var(--accent-primary)] text-sm">
                &quot;{programPlanName}&quot;
              </span>

              <span className="text-slate-300">•</span>

              <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">
                Season {programPlanYear}
              </span>

              <span className="text-slate-300">•</span>

              <div className="flex items-center gap-1 font-mono text-slate-600 text-xs font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Plant: {targetPlant || "1505"}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingSetup((prev) => !prev)}
              className="text-xs font-semibold text-slate-500 hover:text-[var(--accent-primary)] flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors self-start md:self-auto px-2 py-1 rounded-lg hover:bg-slate-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{isEditingSetup ? "Close Editor" : "Edit Parameters"}</span>
            </button>
          </div>

          {/* Collapsible Parameter Editor (Direct inputs, no dropdown options) */}
          {isEditingSetup && (
            <div className="mt-3.5 pt-3.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs animate-in fade-in">
              <div>
                <label className="block text-[10.5px] font-mono font-bold uppercase text-slate-600 mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Customer account"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono font-bold uppercase text-slate-600 mb-1">
                  Program Title
                </label>
                <input
                  type="text"
                  value={programPlanName}
                  onChange={(e) => setProgramPlanName(e.target.value)}
                  placeholder="Program campaign title"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono font-bold uppercase text-slate-600 mb-1">
                  Program Year
                </label>
                <input
                  type="text"
                  value={programPlanYear}
                  onChange={(e) => setProgramPlanYear(e.target.value)}
                  placeholder="e.g. 2026"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white text-xs font-mono font-bold text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-mono font-bold uppercase text-slate-600 mb-1">
                  Target Facility
                </label>
                <input
                  type="text"
                  value={targetPlant}
                  onChange={(e) => setTargetPlant(e.target.value)}
                  placeholder="Target plant/facility"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 focus:bg-white text-xs font-semibold text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Material Specification Matrix (Proportional, Compact, 100% User-Input) ── */}
        <div className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden shadow-[0_4px_24px_rgba(11,28,48,0.03)]">
          {/* Matrix Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight font-display">
                Material Specification Matrix
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Specify raw materials, grades, calipers, and quantities planned for this program
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="h-7.5 px-2.5 rounded-lg text-white text-xs font-semibold shadow-2xs hover:opacity-95 transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Row</span>
            </button>
          </div>

          {/* Table Container with Proportional Balanced Columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 select-none">
                  <th className="py-2.5 px-2 w-9 text-center">#</th>
                  <th className="py-2.5 px-2 w-[22%] min-w-[150px]">Material Type *</th>
                  <th className="py-2.5 px-2 w-[15%] min-w-[110px]">Supplier Info</th>
                  <th className="py-2.5 px-2 w-[10%] min-w-[75px]">Grade</th>
                  <th className="py-2.5 px-2 w-[11%] min-w-[85px]">Color Variant</th>
                  <th className="py-2.5 px-2 w-[10%] min-w-[80px]">Caliper / Wt</th>
                  <th className="py-2.5 px-2 w-[9%] min-w-[75px] text-right">Qty</th>
                  <th className="py-2.5 px-2 w-[7%] min-w-[60px] text-center">Unit</th>
                  <th className="py-2.5 px-2 w-[16%] min-w-[120px]">Remark</th>
                  <th className="py-2.5 px-2 w-14 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {materialRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* # */}
                    <td className="py-1.5 px-1 text-center font-mono font-bold text-slate-400 text-[11px]">
                      {index + 1}
                    </td>

                    {/* Material Type (Pure user text input) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        id={`mat-type-${row.id}`}
                        type="text"
                        required
                        placeholder="Material type"
                        value={row.materialType}
                        onChange={(e) => updateRow(row.id, "materialType", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition font-semibold"
                      />
                    </td>

                    {/* Supplier Info (Pure user text input) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder="Supplier"
                        value={row.supplierInfo}
                        onChange={(e) => updateRow(row.id, "supplierInfo", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                      />
                    </td>

                    {/* Grade (Pure user text input) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder="Grade"
                        value={row.grade}
                        onChange={(e) => updateRow(row.id, "grade", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                      />
                    </td>

                    {/* Color Variant (Pure user text input) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder="Color"
                        value={row.colorVariant}
                        onChange={(e) => updateRow(row.id, "colorVariant", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                      />
                    </td>

                    {/* Caliper / WT (Pure user text input) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder="Caliper / Wt"
                        value={row.caliperWt}
                        onChange={(e) => updateRow(row.id, "caliperWt", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs font-mono text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                      />
                    </td>

                    {/* Qty (Pure user text input, right aligned) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder=""
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, "qty", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs font-mono text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition font-bold text-right"
                      />
                    </td>

                    {/* Unit (Pure user text input - no dropdown, centered) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder=""
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs font-mono text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition text-center"
                      />
                    </td>

                    {/* Remark (Pure user text input - press Tab on last row to auto-add) */}
                    <td className="py-1.5 px-1.5">
                      <input
                        type="text"
                        placeholder="Notes... (Tab to add)"
                        value={row.remark}
                        onChange={(e) => updateRow(row.id, "remark", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Tab" && !e.shiftKey && index === materialRows.length - 1) {
                            e.preventDefault();
                            handleAddRow();
                          }
                        }}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:bg-white text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/10 transition"
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-1.5 px-1 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleDuplicateRow(row)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Duplicate row"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          disabled={materialRows.length <= 1}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-rose-500/70 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Matrix Footer Counts */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
              <span>
                {summaryStats.totalConfigured} row{summaryStats.totalConfigured !== 1 ? "s" : ""} configured • {summaryStats.totalFilled} completed
              </span>
            </div>

            <div>
              Total Raw Materials Planned: <strong className="text-slate-900 font-bold">{summaryStats.totalQty.toLocaleString()} units</strong>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProgramPlanningWorkspace;
