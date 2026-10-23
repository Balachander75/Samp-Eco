import { Ban, Loader2, Layers, ShieldCheck, Factory } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem, AddProgramMaterialPayload } from "../../types";
import {
  fetchProgramRequestApi,
  markProgramSeenApi,
  mapProgramRequestToSampleRequest,
  submitProgramOutputApi,
  claimProgramTaskApi,
  addProgramMaterialApi,
  deleteProgramMaterialApi,
  pauseProgramRequestApi,
  dismantleProgramRequestApi,
} from "@/infrastructure/api/programsApi";

// Modular Sub-Components matching Feasibility Inspector
import { ProgramPlanningControlPanel } from "./ProgramPlanningControlPanel";
import { ProgramPlanningSheetHeader } from "./ProgramPlanningSheetHeader";
import { ProgramPlanningMaterialMatrixTab } from "./ProgramPlanningMaterialMatrixTab";
import { ProgramPlanningSampReviewTab } from "./ProgramPlanningSampReviewTab";
import { ProgramPlanningPlantReviewTab } from "./ProgramPlanningPlantReviewTab";
import { ProgramPlanningChatterFeed } from "./ProgramPlanningChatterFeed";
import { SamplingResponsePanel } from "../../components/common/SamplingResponsePanel";

export interface ProgramPlanningInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "marketing" | "sampling" | "plant";
  userRole?: string;
  user?: UserProfile | null;
  currentUser?: UserProfile | null;
  readOnly?: boolean;
  onRefresh?: () => Promise<void>;
}

export type ProgramInspectorTab = "matrix" | "samp" | "plant";

export const ProgramPlanningInspectorModal: React.FC<ProgramPlanningInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  mode = "marketing",
  userRole: _userRole,
  user,
  currentUser,
  readOnly = false,
  onRefresh,
}) => {
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<ProgramInspectorTab>(
    mode === "sampling" ? "samp" : mode === "plant" ? "plant" : "matrix"
  );

  const effectiveUser = currentUser || user;
  const isSampling = mode === "sampling";
  const isPlant = mode === "plant";

  useEffect(() => {
    setLocalOverride(null);
    setActiveTab(mode === "sampling" ? "samp" : mode === "plant" ? "plant" : "matrix");
  }, [request?.id, mode]);

  // Load fresh detail from backend on open
  useEffect(() => {
    if (!isOpen || !request?.id) return;
    let cancelled = false;
    fetchProgramRequestApi(request.id)
      .then((latest) => {
        if (!cancelled) setLocalOverride(latest);
      })
      .catch((err) => {
        console.warn("Could not load latest program planning detail:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, request?.id]);

  const activeRequest = localOverride || request;

  // Auto-mark seen status for Sampling or Plant team
  useEffect(() => {
    if (!isOpen || !activeRequest?.id) return;
    const department = isSampling ? "sampling" : isPlant ? "plant" : null;
    if (!department) return;
    if (department === "sampling" && activeRequest.samplingSeenAt) return;
    if (department === "plant" && activeRequest.plantSeenAt) return;

    markProgramSeenApi(activeRequest.id, {
      department,
      actor_name: effectiveUser?.name || effectiveUser?.userid,
    })
      .then((updated) => {
        setLocalOverride(mapProgramRequestToSampleRequest(updated));
        window.dispatchEvent(new CustomEvent("samp:requests-changed"));
        onRefresh?.();
      })
      .catch(() => {});
  }, [
    isOpen,
    isPlant,
    isSampling,
    activeRequest?.id,
    activeRequest?.samplingSeenAt,
    activeRequest?.plantSeenAt,
    effectiveUser?.name,
    effectiveUser?.userid,
    onRefresh,
  ]);

  // Copy code handler
  const handleCopyCode = () => {
    const code =
      activeRequest?.requestCode ||
      activeRequest?.materialCode ||
      (activeRequest?.id ? `PP-${activeRequest.id}` : "");
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const [isClaiming, setIsClaiming] = useState(false);

  // Claim department task handler (Sampling or Plant)
  const handleClaimTask = async (department: "sampling" | "plant") => {
    if (!activeRequest?.id || isClaiming) return;
    setIsClaiming(true);
    try {
      const updated = await claimProgramTaskApi(activeRequest.id, department);
      setLocalOverride(mapProgramRequestToSampleRequest(updated));
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      console.error(`Failed to claim ${department} review task:`, err);
      throw err;
    } finally {
      setIsClaiming(false);
    }
  };

  // Submit department output handler (SAMP / Plant)
  const handleSaveOutput = async (remark: string) => {
    if (!activeRequest?.id) return;
    // Strict guard: Only Sampling or Plant can submit department output!
    const department = isSampling ? "sampling" : isPlant ? "plant" : null;
    if (!department) {
      console.warn("Marketing desk cannot submit on behalf of Sampling or Plant.");
      return;
    }
    const updated = await submitProgramOutputApi(activeRequest.id, {
      department,
      remark,
    });
    setLocalOverride(mapProgramRequestToSampleRequest(updated));
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    await onRefresh?.();
  };


  // Add SKU Material specification row
  const handleAddMaterial = async (payload: AddProgramMaterialPayload) => {
    if (!activeRequest?.id) return;
    const updated = await addProgramMaterialApi(activeRequest.id, payload);
    setLocalOverride(mapProgramRequestToSampleRequest(updated));
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    await onRefresh?.();
  };

  // Refresh latest data helper
  const handleRefreshData = async () => {
    if (!activeRequest?.id) return;
    try {
      const latest = await fetchProgramRequestApi(activeRequest.id);
      setLocalOverride(latest);
      await onRefresh?.();
    } catch (err) {
      console.warn("Could not refresh data:", err);
    }
  };



  const [isDeletingMaterial, setIsDeletingMaterial] = useState<string | number | null>(null);

  // Delete SKU Material specification row
  const handleDeleteMaterial = async (materialId: number | string) => {
    if (!activeRequest?.id || isDeletingMaterial) return;
    setIsDeletingMaterial(materialId);
    try {
      const updated = await deleteProgramMaterialApi(activeRequest.id, materialId);
      setLocalOverride(mapProgramRequestToSampleRequest(updated));
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      console.error("Failed to delete material line:", err);
      throw err;
    } finally {
      setIsDeletingMaterial(null);
    }
  };


  const [isDismantleModalOpen, setIsDismantleModalOpen] = useState(false);
  const [dismantleReason, setDismantleReason] = useState("");
  const [isDismantling, setIsDismantling] = useState(false);
  const [dismantleError, setDismantleError] = useState<string | null>(null);

  const handleConfirmDismantle = async () => {
    if (!activeRequest?.id || isDismantling) return;
    setIsDismantling(true);
    setDismantleError(null);
    try {
      const updated = await dismantleProgramRequestApi(activeRequest.id, dismantleReason);
      setLocalOverride(mapProgramRequestToSampleRequest(updated));
      setIsDismantleModalOpen(false);
      setDismantleReason("");
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err: any) {
      setDismantleError(err?.message || "Failed to dismantle program.");
    } finally {
      setIsDismantling(false);
    }
  };

  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const userTeam = (effectiveUser?.team || user?.team || "").toLowerCase();
  const isAdmin = effectiveUser?.role?.toLowerCase() === "admin" || _userRole === "admin";
  const isMarketing = userTeam === "marketing" || mode === "marketing" || isAdmin;
  const isDismantled = activeRequest?.status === "Dismantled";
  const canPause = isMarketing && !isDismantled;
  const canDismantle = isMarketing && !isDismantled;

  const handleTogglePause = async () => {
    if (!activeRequest?.id || isTogglingPause) return;
    const currentlyActive = activeRequest.isActive !== false;
    setIsTogglingPause(true);
    try {
      const updated = await pauseProgramRequestApi(activeRequest.id, currentlyActive);
      setLocalOverride(mapProgramRequestToSampleRequest(updated));
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err) {
      console.error("Failed to toggle program pause state:", err);
    } finally {
      setIsTogglingPause(false);
    }
  };

  if (!isOpen || !activeRequest) return null;

  const materials = activeRequest.programMaterials || [];
  const hasSampNote = Boolean(activeRequest.samplingRemark?.trim());
  const hasPlantNote = Boolean(activeRequest.plantRemark?.trim());

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-[var(--overlay-backdrop)] backdrop-blur-sm select-text animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[92vw] xl:max-w-6xl 2xl:max-w-7xl h-[88vh] max-h-[88vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.3)] overflow-hidden select-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP CONTROL PANEL */}
        <ProgramPlanningControlPanel
          activeRequest={activeRequest}
          copiedCode={copiedCode}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          readOnly={readOnly || isDismantled}
          canPause={canPause}
          isTogglingPause={isTogglingPause}
          onTogglePause={handleTogglePause}
          canDismantle={canDismantle}
          isDismantling={isDismantling}
          onDismantle={() => {
            setDismantleReason("");
            setDismantleError(null);
            setIsDismantleModalOpen(true);
          }}
          mode={mode}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG CHATTER) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: WORKSPACE CANVAS */}
          <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)]">
            {/* ── 1. PRIMARY SECTION TABS (TOP) ── */}
            <div className="px-6 sm:px-8 pt-2.5 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-6 text-xs font-semibold overflow-x-auto scrollbar-none">
                  {/* Tab 1: Substrate Matrix */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("matrix")}
                    className={`pb-2.5 border-b-2 font-display transition-all cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "matrix"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>1. Substrate &amp; SKU Matrix</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--surface-base)] text-[var(--on-surface)] border border-[var(--border-subtle)]">
                      {materials.length} {materials.length === 1 ? "SKU" : "SKUs"}
                    </span>
                  </button>

                  {/* Tab 2: Sampling Team Review */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("samp")}
                    className={`pb-2.5 border-b-2 font-display transition-all cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "samp"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>2. Sampling Team Review</span>
                    {hasSampNote ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-emerald-500/10 text-emerald-700  border border-emerald-500/25">
                        ✓ Reviewed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-medium bg-[var(--surface-base)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                        {activeRequest.samplingClaimedBy ? "In Review" : "Pending Claim"}
                      </span>
                    )}
                  </button>

                  {/* Tab 3: Plant Production Review */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("plant")}
                    className={`pb-2.5 border-b-2 font-display transition-all cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "plant"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <Factory className="w-3.5 h-3.5" />
                    <span>3. Plant Production Review</span>
                    {hasPlantNote ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-teal-500/10 text-teal-700  border border-teal-500/25">
                        ✓ Confirmed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-medium bg-[var(--surface-base)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                        {activeRequest.plantClaimedBy ? "In Review" : "Pending Claim"}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* ── 2. SCROLLABLE DOCUMENT WORKSPACE ── */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <ProgramPlanningSheetHeader
                  activeRequest={activeRequest}
                  mode={mode}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                  onClaimTask={handleClaimTask}
                  isClaiming={isClaiming}
                  currentUser={effectiveUser}
                  isAdmin={effectiveUser?.role?.toLowerCase() === "admin"}
                />

                {/* ── 3. ACTIVE TAB CONTENT ── */}
                <div className="px-6 sm:px-8 pb-8 pt-4 space-y-6">
                {activeTab === "matrix" && (
                  <ProgramPlanningMaterialMatrixTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onAddMaterial={handleAddMaterial}
                    onDeleteMaterial={handleDeleteMaterial}
                    onRefreshData={handleRefreshData}
                    onClaimTask={handleClaimTask}
                    isClaiming={isClaiming}
                    currentUser={effectiveUser}
                  />
                )}

                {activeTab === "samp" && (
                  <ProgramPlanningSampReviewTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onSaveOutput={handleSaveOutput}
                    onRefreshData={handleRefreshData}
                    onClaimTask={handleClaimTask}
                    isClaiming={isClaiming}
                    currentUser={effectiveUser}
                  />
                )}

                {activeTab === "plant" && (
                  <ProgramPlanningPlantReviewTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onSaveOutput={handleSaveOutput}
                    onRefreshData={handleRefreshData}
                    onClaimTask={handleClaimTask}
                    isClaiming={isClaiming}
                    currentUser={effectiveUser}
                  />
                )}
                <SamplingResponsePanel
                  className="mt-6"
                  response={activeRequest.samplingRemark}
                  reviewer={activeRequest.samplingSignedBy}
                  respondedAt={activeRequest.samplingSignedAt}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: TIME LOG CHATTER FEED PANEL */}
          <ProgramPlanningChatterFeed
            activeRequest={activeRequest}
            onNoteAdded={handleRefreshData}
            currentUser={effectiveUser}
          />
        </div>
      </div>
    </div>

      {/* ── Confirm Dismantle Program Modal ── */}
      {isDismantleModalOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-[var(--overlay-backdrop)] backdrop-blur-xs select-text animate-in fade-in duration-150"
          onClick={() => !isDismantling && setIsDismantleModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[var(--surface-base)] border border-rose-300/70  rounded-2xl shadow-[0_24px_70px_-12px_rgba(225,29,72,0.25)] overflow-hidden p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-600  flex items-center justify-center shrink-0 border border-rose-500/20">
                <Ban className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-[var(--on-surface)]">
                  Dismantle Program Plan?
                </h3>
                <p className="text-xs text-[var(--on-surface-muted)] mt-0.5">
                  This action is permanent and cannot be undone. Once dismantled, the program is completely terminated and cannot be resumed.
                </p>
              </div>
            </div>

            {dismantleError && (
              <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-700  text-xs font-semibold">
                {dismantleError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                Dismantle Reason (Optional)
              </label>
              <textarea
                rows={2}
                value={dismantleReason}
                onChange={(e) => setDismantleReason(e.target.value)}
                placeholder="e.g. Seasonal campaign cancelled by customer / budget constraints"
                className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20 transition-all resize-none shadow-2xs font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsDismantleModalOpen(false)}
                disabled={isDismantling}
                className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] transition-all cursor-pointer"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleConfirmDismantle}
                disabled={isDismantling}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              >
                {isDismantling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>{isDismantling ? "Dismantling..." : "Confirm & Dismantle"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default ProgramPlanningInspectorModal;
