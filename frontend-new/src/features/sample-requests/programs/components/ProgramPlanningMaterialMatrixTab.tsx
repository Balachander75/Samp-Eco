import React, { useState } from "react";
import { createPortal } from "react-dom";
import { SampleRequestItem, AddProgramMaterialPayload, ProgramActivityItem } from "../../types";
import { formatOdooLogDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";
import {
  Clipboard,
  Clock,
  Plus,
  PackagePlus,
  Loader2,
  Check,
  AlertCircle,
  X,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  ShieldCheck,
  Edit3,
  UserCheck,
  ShieldAlert,
  Factory,
  Lock,
} from "lucide-react";
import {
  addProgramNoteApi,
  updateSingleMaterialSampRemarkApi,
} from "@/infrastructure/api/programsApi";

export interface ProgramPlanningMaterialMatrixTabProps {
  activeRequest: SampleRequestItem;
  mode?: "marketing" | "sampling" | "plant";
  readOnly?: boolean;
  onNavigateToTab?: (tab: "samp" | "plant" | "marketing") => void;
  onAddMaterial?: (payload: AddProgramMaterialPayload) => Promise<void>;
  onPromoteSku?: (materialId: number | string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onClaimTask?: (dept: "sampling" | "plant") => Promise<void>;
  isClaiming?: boolean;
  currentUser?: UserProfile | null;
}

function getInitials(name?: string | null): string {
  if (!name) return "US";
  const clean = String(name).trim();
  if (!clean) return "US";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase() || "US";
  }
  return clean.slice(0, 2).toUpperCase() || "US";
}

export const ProgramPlanningMaterialMatrixTab: React.FC<ProgramPlanningMaterialMatrixTabProps> = ({
  activeRequest,
  mode = "marketing",
  readOnly = false,
  onAddMaterial,
  onPromoteSku,
  onRefreshData,
  onClaimTask,
  isClaiming = false,
  currentUser,
}) => {
  const materials = activeRequest.programMaterials || [];
  const skuCount = materials.length;
  const activities = (activeRequest.activities || []) as unknown as ProgramActivityItem[];

  const currentUserId = currentUser?.id != null ? String(currentUser.id) : null;
  const currentUserName = currentUser?.name?.toLowerCase().trim();
  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  const isSamplingDesk = mode === "sampling";
  const isPlantDesk = mode === "plant";

  const isSamplingClaimed = Boolean(
    activeRequest.samplingClaimedByUserId || activeRequest.samplingClaimedBy
  );
  const isSamplingClaimedByMe = Boolean(
    (activeRequest.samplingClaimedByUserId &&
      currentUserId &&
      String(activeRequest.samplingClaimedByUserId) === currentUserId) ||
      (activeRequest.samplingClaimedBy &&
        currentUserName &&
        activeRequest.samplingClaimedBy.toLowerCase().trim() === currentUserName) ||
      isAdmin
  );

  const isPlantClaimed = Boolean(
    activeRequest.plantClaimedByUserId || activeRequest.plantClaimedBy
  );
  const isPlantClaimedByMe = Boolean(
    (activeRequest.plantClaimedByUserId &&
      currentUserId &&
      String(activeRequest.plantClaimedByUserId) === currentUserId) ||
      (activeRequest.plantClaimedBy &&
        currentUserName &&
        activeRequest.plantClaimedBy.toLowerCase().trim() === currentUserName) ||
      isAdmin
  );

  const canAddSku = mode === "marketing" && !readOnly && Boolean(onAddMaterial);
  const [isAddingSku, setIsAddingSku] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [promotingId, setPromotingId] = useState<string | number | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  // Row expansion & Context comments
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number | string>>(new Set());
  const [rowNotesInput, setRowNotesInput] = useState<Record<string, string>>({});
  const [isPostingRowNote, setIsPostingRowNote] = useState<Record<string, boolean>>({});
  const [rowNoteError, setRowNoteError] = useState<Record<string, string | null>>({});

  // Inline edit for SAMP remark (Sampling desk)
  const [editingSampRemarkId, setEditingSampRemarkId] = useState<number | string | null>(null);
  const [inlineSampRemark, setInlineSampRemark] = useState("");
  const [isSavingSampRemark, setIsSavingSampRemark] = useState(false);

  const toggleRowExpanded = (id: number | string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getRowActivities = (matId?: number | string) => {
    if (matId == null) return [];
    return activities.filter(
      (act) =>
        act.payload?.material_id === matId ||
        act.payload?.materialId === matId ||
        String(act.payload?.material_id) === String(matId) ||
        String(act.payload?.materialId) === String(matId)
    );
  };

  const handlePostRowNote = async (matId: number | string) => {
    const key = String(matId);
    const note = (rowNotesInput[key] || "").trim();
    if (!note || isPostingRowNote[key] || !activeRequest?.id) return;

    if (isSamplingDesk && !isSamplingClaimedByMe) {
      setRowNoteError((prev) => ({
        ...prev,
        [key]: "Please claim this review task above before posting technical notes.",
      }));
      return;
    }
    if (isPlantDesk && !isPlantClaimedByMe) {
      setRowNoteError((prev) => ({
        ...prev,
        [key]: "Please claim plant review task above before posting tooling notes.",
      }));
      return;
    }

    setIsPostingRowNote((prev) => ({ ...prev, [key]: true }));
    setRowNoteError((prev) => ({ ...prev, [key]: null }));
    try {
      await addProgramNoteApi(activeRequest.id, note, matId);
      setRowNotesInput((prev) => ({ ...prev, [key]: "" }));
      await onRefreshData?.();
    } catch (err: any) {
      setRowNoteError((prev) => ({
        ...prev,
        [key]: err?.message || "Failed to post note for this SKU.",
      }));
    } finally {
      setIsPostingRowNote((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSaveInlineSampRemark = async (matId: number | string) => {
    if (isSavingSampRemark || !activeRequest?.id) return;
    if (!isSamplingClaimedByMe) {
      console.warn("Must claim SAMP task before updating inline remark.");
      return;
    }
    setIsSavingSampRemark(true);
    try {
      await updateSingleMaterialSampRemarkApi(activeRequest.id, matId, inlineSampRemark.trim());
      setEditingSampRemarkId(null);
      await onRefreshData?.();
    } catch (err: any) {
      console.error("Failed to update SAMP remark:", err);
    } finally {
      setIsSavingSampRemark(false);
    }
  };

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
    <div className="space-y-4 select-text">
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

      {/* ── Task Ownership Required Banner (Sampling Desk) ── */}
      {isSamplingDesk && !readOnly && !isSamplingClaimed && (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-500/10 dark:border-amber-700/50 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                Task Ownership Required (Sampling Desk)
              </h4>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                Marketing has assigned this campaign to the Sampling Desk. You must claim task ownership before evaluating substrates or adding line observations.
              </p>
            </div>
          </div>
          {onClaimTask && (
            <button
              type="button"
              onClick={() => onClaimTask("sampling")}
              disabled={isClaiming}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isClaiming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>{isClaiming ? "Claiming Review..." : "Claim Review & Take Ownership"}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Task Ownership Banner (Plant Desk) ── */}
      {isPlantDesk && !readOnly && !isPlantClaimed && (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-500/10 dark:border-amber-700/50 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-200">
                Plant Feasibility Unclaimed (Plant {activeRequest.targetPlant || "1505"})
              </h4>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                Claim this task to verify factory tooling, machine schedule, and confirm conversion feasibility.
              </p>
            </div>
          </div>
          {onClaimTask && (
            <button
              type="button"
              onClick={() => onClaimTask("plant")}
              disabled={isClaiming}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              {isClaiming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              <span>{isClaiming ? "Claiming..." : "Claim Plant Review & Take Ownership"}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Substrate Matrix Table ── */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-2xs">
        {/* Table Top Bar */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5 bg-[var(--surface-low)] flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center">
              <Clipboard className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold font-display text-[var(--on-surface)]">
                Material Specification Matrix
              </h2>
              <p className="text-[11px] text-[var(--on-surface-muted)] font-mono">
                {skuCount} {skuCount === 1 ? "line configured" : "lines configured"} · Click "Thread" to collaborate on any SKU
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

        {/* Streamlined Clean Table Content */}
        {materials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] text-[10.5px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3 min-w-[220px]">Substrate &amp; Specs</th>
                  <th className="px-4 py-3 min-w-[120px] text-right">Planned Volume</th>
                  <th className="px-4 py-3 min-w-[200px]">Marketing Directive</th>
                  <th className="px-4 py-3 min-w-[170px]">SAMP Lab Review</th>
                  <th className="px-4 py-3 min-w-[120px] text-center">SKU Thread</th>
                  <th className="px-4 py-3 min-w-[150px] text-center">Commercial Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {materials.map((mat, idx) => {
                  const rowId = mat.id ?? idx;
                  const isExpanded = expandedRowIds.has(rowId);
                  const rowActs = getRowActivities(mat.id);
                  const rowCommentCount = rowActs.length;

                  // Specs string
                  const specsParts = [
                    mat.caliperWt,
                    mat.grade,
                    mat.supplierName,
                    mat.colorVariant,
                  ].filter(Boolean);

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        className={`align-middle transition-colors ${
                          isExpanded
                            ? "bg-[var(--surface-low)]"
                            : "hover:bg-[var(--surface-low)]/70"
                        }`}
                      >
                        {/* Index */}
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-[11px] text-[var(--on-surface-subtle)]">
                          {String(idx + 1).padStart(2, "0")}
                        </td>

                        {/* Substrate & Specs Grouped Together */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-xs text-[var(--on-surface)]">
                            {mat.materialType || "—"}
                          </div>
                          {specsParts.length > 0 && (
                            <div className="text-[11px] font-mono text-[var(--on-surface-muted)] mt-0.5">
                              {specsParts.join(" · ")}
                            </div>
                          )}
                        </td>

                        {/* Planned Volume */}
                        <td className="px-4 py-3.5 text-right font-mono text-xs">
                          <span className="font-bold text-[var(--on-surface)]">
                            {mat.quantity ? Number(mat.quantity).toLocaleString() : "—"}
                          </span>{" "}
                          <span className="text-[10.5px] text-[var(--on-surface-muted)] font-normal">
                            {mat.unit || "pcs"}
                          </span>
                        </td>

                        {/* Marketing Directive */}
                        <td className="px-4 py-3.5 text-xs text-[var(--on-surface-muted)] max-w-[240px]">
                          {mat.remark ? (
                            <div className="line-clamp-2 hover:line-clamp-none transition-all text-[11px] leading-relaxed">
                              {mat.remark}
                            </div>
                          ) : (
                            <span className="text-[var(--on-surface-subtle)] font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* SAMP Lab Review */}
                        <td className="px-4 py-3.5 text-xs">
                          {mat.sampRemark ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate max-w-[140px]" title={mat.sampRemark}>
                                {mat.sampRemark}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
                              <Clock className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                              <span>Pending review</span>
                            </span>
                          )}
                        </td>

                        {/* SKU Context Thread Toggle */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowExpanded(rowId)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                              isExpanded
                                ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-2xs"
                                : rowCommentCount > 0
                                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/20"
                                : "bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border-[var(--border-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                            }`}
                            title="Expand conversation thread for this SKU"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{rowCommentCount > 0 ? `${rowCommentCount} Notes` : "Thread"}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </td>

                        {/* Sampling Promotion */}
                        <td className="px-4 py-3.5 text-center">
                          {mat.promotedSrNumber ? (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              title={`Commercial sample request ${mat.promotedSrNumber}`}
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
                              title="Promote SKU specification to Commercial Sample Request"
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
                      </tr>

                      {/* ── EXPANDED ROW CONTEXT THREAD ── */}
                      {isExpanded && (
                        <tr className="bg-[var(--surface-lowest)]/95 border-y-2 border-[var(--accent-primary)]/30">
                          <td colSpan={7} className="p-4 sm:p-5 space-y-3.5">
                            {/* SKU Sub-Header */}
                            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">
                                  SKU #{idx + 1} Thread:
                                </span>
                                <span className="text-xs font-bold text-[var(--on-surface)]">
                                  {mat.materialType || "Substrate Line"}
                                </span>
                                <span className="text-[11px] font-mono text-[var(--on-surface-muted)]">
                                  ({rowActs.length} {rowActs.length === 1 ? "note" : "notes"})
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleRowExpanded(rowId)}
                                className="px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-low)] text-[11px] text-[var(--on-surface-muted)] transition cursor-pointer"
                              >
                                Collapse
                              </button>
                            </div>

                            {/* Dual Directives & Lab Review Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Directive */}
                              <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent-primary)] block">
                                  Marketing Directive &amp; Purpose
                                </span>
                                <p className="text-xs text-[var(--on-surface)] leading-relaxed">
                                  {mat.remark || "No directive specified for this substrate."}
                                </p>
                              </div>

                              {/* SAMP Lab Review */}
                              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    SAMP Lab Technical Evaluation
                                  </span>
                                  {mode === "sampling" && !readOnly && mat.id && editingSampRemarkId !== mat.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!isSamplingClaimedByMe) {
                                          if (onClaimTask) {
                                            onClaimTask("sampling");
                                          }
                                          return;
                                        }
                                        setEditingSampRemarkId(mat.id!);
                                        setInlineSampRemark(mat.sampRemark || "");
                                      }}
                                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>{isSamplingClaimedByMe ? "Edit" : "Claim to Edit"}</span>
                                    </button>
                                  )}
                                </div>

                                {editingSampRemarkId === mat.id ? (
                                  <div className="space-y-2 pt-1">
                                    <textarea
                                      rows={2}
                                      value={inlineSampRemark}
                                      onChange={(e) => setInlineSampRemark(e.target.value)}
                                      placeholder="Enter SAMP lab technical observation..."
                                      className="w-full p-2 rounded-xl border border-emerald-500/40 bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingSampRemarkId(null)}
                                        disabled={isSavingSampRemark}
                                        className="px-2.5 py-0.5 rounded-lg border border-[var(--border-subtle)] text-[11px] text-[var(--on-surface-muted)] cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveInlineSampRemark(mat.id!)}
                                        disabled={isSavingSampRemark}
                                        className="px-3 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                      >
                                        {isSavingSampRemark ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Check className="w-3 h-3" />
                                        )}
                                        <span>Save</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-[var(--on-surface)] leading-relaxed">
                                    {mat.sampRemark || (
                                      <span className="text-[var(--on-surface-muted)] italic">
                                        Pending laboratory evaluation.
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Threaded Discussion Between Marketing, SAMP, and Plant for this SKU */}
                            <div className="space-y-2 pt-1">
                              {rowActs.length === 0 ? (
                                <div className="p-3 rounded-xl border border-dashed border-[var(--border-subtle)] text-[11px] text-[var(--on-surface-subtle)] bg-[var(--surface-base)]">
                                  No dedicated notes posted for this SKU line yet. Use the reply box below to ask questions or provide remarks specifically for this material.
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {rowActs.map((act) => {
                                    const isActSamp = act.actorDepartment?.toLowerCase().includes("samp");
                                    const isActPlant = act.actorDepartment?.toLowerCase().includes("plant");
                                    const isActMarketing = act.actorDepartment?.toLowerCase().includes("marketing");

                                    return (
                                      <div
                                        key={act.id}
                                        className="p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1 shadow-2xs"
                                      >
                                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-[var(--border-subtle)]">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-5 h-5 rounded-full text-white font-bold text-[9px] font-mono flex items-center justify-center shrink-0"
                                              style={{
                                                backgroundColor: isActSamp
                                                  ? "#059669"
                                                  : isActPlant
                                                  ? "#0d9488"
                                                  : isActMarketing
                                                  ? "var(--accent-primary)"
                                                  : "#64748b",
                                              }}
                                            >
                                              {getInitials(act.actorName)}
                                            </div>
                                            <span className="font-display font-bold text-xs text-[var(--on-surface)]">
                                              {act.actorName}
                                            </span>
                                            <span
                                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono border ${
                                                isActSamp
                                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                  : isActPlant
                                                  ? "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300"
                                                  : isActMarketing
                                                  ? "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300"
                                                  : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                                              }`}
                                            >
                                              {isActSamp ? "SAMP" : isActPlant ? "Plant" : isActMarketing ? "Marketing" : "System"}
                                            </span>
                                          </div>
                                          <span className="text-[9.5px] font-mono text-[var(--on-surface-subtle)]">
                                            {formatOdooLogDate(act.createdAt)}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap pt-0.5">
                                          {String(act.payload?.note || act.payload?.remark || "")}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Row Note Reply Input */}
                              {mat.id && !readOnly && (
                                isSamplingDesk && !isSamplingClaimed ? (
                                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                                      <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
                                      <span>Claim task ownership above before posting notes or replying on this SKU.</span>
                                    </div>
                                    {onClaimTask && (
                                      <button
                                        type="button"
                                        onClick={() => onClaimTask("sampling")}
                                        disabled={isClaiming}
                                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                      >
                                        {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                        <span>Claim Review</span>
                                      </button>
                                    )}
                                  </div>
                                ) : isPlantDesk && !isPlantClaimed ? (
                                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                                      <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 shrink-0" />
                                      <span>Claim plant review ownership above before posting tooling notes on this SKU.</span>
                                    </div>
                                    {onClaimTask && (
                                      <button
                                        type="button"
                                        onClick={() => onClaimTask("plant")}
                                        disabled={isClaiming}
                                        className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer"
                                      >
                                        {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                        <span>Claim Plant</span>
                                      </button>
                                    )}
                                  </div>
                                ) : isSamplingDesk && !isSamplingClaimedByMe ? (
                                  <div className="p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[11px] text-[var(--on-surface-muted)] flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    <span>Task owned by {activeRequest.samplingClaimedBy}. Discussion is read-only.</span>
                                  </div>
                                ) : isPlantDesk && !isPlantClaimedByMe ? (
                                  <div className="p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[11px] text-[var(--on-surface-muted)] flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span>Plant review owned by {activeRequest.plantClaimedBy}. Discussion is read-only.</span>
                                  </div>
                                ) : (
                                  <div className="pt-1">
                                    {rowNoteError[String(mat.id)] && (
                                      <div className="p-2 mb-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{rowNoteError[String(mat.id)]}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={rowNotesInput[String(mat.id)] || ""}
                                        onChange={(e) =>
                                          setRowNotesInput((prev) => ({
                                            ...prev,
                                            [String(mat.id)]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handlePostRowNote(mat.id!);
                                          }
                                        }}
                                        placeholder={
                                          mode === "sampling"
                                            ? "Add SAMP technical note or lab observation for this SKU..."
                                            : mode === "plant"
                                            ? "Add plant machine tooling or substrate handling note..."
                                            : "Reply or add marketing directive for this SKU..."
                                        }
                                        disabled={isPostingRowNote[String(mat.id)]}
                                        className="flex-1 h-8 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition"
                                      />
                                      <button
                                        type="button"
                                        disabled={
                                          !(rowNotesInput[String(mat.id)] || "").trim() ||
                                          isPostingRowNote[String(mat.id)]
                                        }
                                        onClick={() => handlePostRowNote(mat.id!)}
                                        className="h-8 px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                      >
                                        {isPostingRowNote[String(mat.id)] ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Send className="w-3.5 h-3.5" />
                                        )}
                                        <span>Post</span>
                                      </button>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center space-y-3">
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
