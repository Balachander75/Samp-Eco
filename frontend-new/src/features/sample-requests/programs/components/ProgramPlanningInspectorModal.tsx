import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem, AddProgramMaterialPayload } from "../../types";
import {
  fetchProgramRequestApi,
  markProgramSeenApi,
  mapProgramRequestToSampleRequest,
  submitProgramOutputApi,
  pinProgramActivityApi,
  replyToProgramActivityApi,
  claimProgramTaskApi,
  addProgramMaterialApi,
  pauseProgramRequestApi,
} from "@/infrastructure/api/programsApi";

// Modular Sub-Components matching Feasibility Inspector
import { ProgramPlanningControlPanel } from "./ProgramPlanningControlPanel";
import { ProgramPlanningSheetHeader } from "./ProgramPlanningSheetHeader";
import { ProgramPlanningMaterialMatrixTab } from "./ProgramPlanningMaterialMatrixTab";
import { ProgramPlanningSampReviewTab } from "./ProgramPlanningSampReviewTab";
import { ProgramPlanningPlantReviewTab } from "./ProgramPlanningPlantReviewTab";
import { ProgramPlanningMarketingTab } from "./ProgramPlanningMarketingTab";
import { ProgramPlanningChatterFeed } from "./ProgramPlanningChatterFeed";

export interface ProgramPlanningInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  mode?: "marketing" | "sampling" | "plant";
  userRole?: string;
  user?: UserProfile | null;
  currentUser?: UserProfile | null;
  onDeleteRequest?: (req: SampleRequestItem) => void;
  readOnly?: boolean;
  onRefresh?: () => Promise<void>;
}

export type ProgramInspectorTab = "matrix" | "samp" | "plant" | "marketing";

export const ProgramPlanningInspectorModal: React.FC<ProgramPlanningInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  mode = "marketing",
  user,
  currentUser,
  onDeleteRequest,
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

  // Pin output handler
  const handlePinActivity = async (activityId: number, pinned: boolean) => {
    if (!activeRequest?.id) return;
    const updated = await pinProgramActivityApi(activeRequest.id, activityId, pinned);
    setLocalOverride(mapProgramRequestToSampleRequest(updated));
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    await onRefresh?.();
  };

  // Reply to output handler
  const handleReplyActivity = async (activityId: number, remark: string) => {
    if (!activeRequest?.id) return;
    const updated = await replyToProgramActivityApi(activeRequest.id, activityId, { remark });
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

  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const isMarketing = effectiveUser?.team === "marketing" || user?.team === "marketing";
  const canPause = !readOnly && isMarketing;

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
  const pinnedCount = ((activeRequest.activities || []) as any[]).filter(
    (act) => act.pinned_by_marketing || act.pinnedByMarketing
  ).length;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 select-text"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[96vw] xl:max-w-7xl h-[92vh] max-h-[92vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] overflow-hidden select-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. TOP CONTROL PANEL WITH STEPPER */}
        <ProgramPlanningControlPanel
          activeRequest={activeRequest}
          copiedCode={copiedCode}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          onDeleteRequest={onDeleteRequest}
          readOnly={readOnly}
          canPause={canPause}
          isTogglingPause={isTogglingPause}
          onTogglePause={handleTogglePause}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG CHATTER) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: FORM SHEET (DOCUMENT BODY) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[var(--bg-app)]">
            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              {/* Dossier Header */}
              <ProgramPlanningSheetHeader
                activeRequest={activeRequest}
              />

              {/* Notebook Tab Strip matching Feasibility Inspector */}
              <div className="px-6 sm:px-8 pb-6 pt-3">
                <div className="border-b border-[var(--border-subtle)] flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                  {/* Tab 1: Material Matrix */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("matrix")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "matrix"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>1. Material Allocation Matrix</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                      {materials.length} SKUs
                    </span>
                  </button>

                  {/* Tab 2: SAMP Technical Review */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("samp")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "samp"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>2. SAMP Technical Review</span>
                    {hasSampNote ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        ✓ Reviewed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                        {activeRequest.samplingSeenAt ? "In Review" : "Awaiting Review"}
                      </span>
                    )}
                  </button>

                  {/* Tab 3: Plant Feasibility */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("plant")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "plant"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>3. Plant Feasibility &amp; Capacity</span>
                    {hasPlantNote ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                        ✓ Confirmed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                        {activeRequest.plantSeenAt ? "In Review" : "Awaiting"}
                      </span>
                    )}
                  </button>

                  {/* Tab 4: Marketing Review & Pinning */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("marketing")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "marketing"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>4. Marketing Review &amp; Directives</span>
                    {pinnedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                        {pinnedCount} Pinned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                        {hasSampNote || hasPlantNote ? "Ready" : "Overview"}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab 1 Content: Material Allocation Matrix */}
                {activeTab === "matrix" && (
                  <ProgramPlanningMaterialMatrixTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onAddMaterial={handleAddMaterial}
                  />
                )}

                {/* Tab 2 Content: SAMP Technical Review */}
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

                {/* Tab 3 Content: Plant Feasibility & Capacity */}
                {activeTab === "plant" && (
                  <ProgramPlanningPlantReviewTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onSaveOutput={handleSaveOutput}
                    onClaimTask={handleClaimTask}
                    isClaiming={isClaiming}
                    currentUser={effectiveUser}
                  />
                )}

                {/* Tab 4 Content: Marketing Review & Directives */}
                {activeTab === "marketing" && (
                  <ProgramPlanningMarketingTab
                    activeRequest={activeRequest}
                    mode={mode}
                    readOnly={readOnly}
                    onPinActivity={handlePinActivity}
                    onReplyActivity={handleReplyActivity}
                  />
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: TIME LOG CHATTER FEED PANEL */}
          <ProgramPlanningChatterFeed activeRequest={activeRequest} />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProgramPlanningInspectorModal;
