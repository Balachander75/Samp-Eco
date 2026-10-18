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
  promoteProgramSkuApi,
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
  userRole,
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

  // Promote SKU Material specification row to a commercial Sample Request
  const handlePromoteSku = async (materialId: number | string) => {
    if (!activeRequest?.id) return;
    try {
      const res = await promoteProgramSkuApi(activeRequest.id, materialId, ["sample"]);
      setLocalOverride(mapProgramRequestToSampleRequest(res.program));
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
      await onRefresh?.();
    } catch (err: any) {
      console.error("Failed to promote program SKU:", err);
      throw err;
    }
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
  const userTeam = (effectiveUser?.team || user?.team || "").toLowerCase();
  const userRoleStr = (userRole || effectiveUser?.role || "").toLowerCase();
  const isMarketing = userTeam === "marketing" || mode === "marketing";
  const canPause = !readOnly && isMarketing;
  const isMarketingOrAdmin =
    isMarketing ||
    userRoleStr.includes("marketing") ||
    userRoleStr.includes("admin");
  const canPromote = !readOnly && isMarketingOrAdmin;

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
        {/* 1. TOP CONTROL PANEL */}
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
          mode={mode}
        />

        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG CHATTER) */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: WORKSPACE CANVAS */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[var(--bg-app)]">
            {/* Dual Sign-Off Executive Snapshot */}
            <ProgramPlanningSheetHeader
              activeRequest={activeRequest}
              mode={mode}
              onNavigateToTab={(tab) => setActiveTab(tab)}
              onClaimTask={handleClaimTask}
              isClaiming={isClaiming}
              currentUser={effectiveUser}
              isAdmin={effectiveUser?.role?.toLowerCase() === "admin"}
            />

            {/* Sleek Minimalist Tab Strip */}
            <div className="border-b border-[var(--border-subtle)] flex items-center space-x-6 text-xs font-semibold overflow-x-auto pt-1">
              {/* Tab 1: Substrate Matrix */}
              <button
                type="button"
                onClick={() => setActiveTab("matrix")}
                className={`pb-2.5 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "matrix"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                }`}
              >
                <span>1. Substrate Matrix</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                  {materials.length} SKUs
                </span>
              </button>

              {/* Tab 2: SAMP Technical Review */}
              <button
                type="button"
                onClick={() => setActiveTab("samp")}
                className={`pb-2.5 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "samp"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                }`}
              >
                <span>2. SAMP Review Details</span>
                {hasSampNote ? (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
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
                className={`pb-2.5 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "plant"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                }`}
              >
                <span>3. Plant Capacity Details</span>
                {hasPlantNote ? (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                    ✓ Confirmed
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                    {activeRequest.plantSeenAt ? "In Review" : "Awaiting"}
                  </span>
                )}
              </button>

              {/* Tab 4: Marketing Directives */}
              <button
                type="button"
                onClick={() => setActiveTab("marketing")}
                className={`pb-2.5 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                  activeTab === "marketing"
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                    : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                }`}
              >
                <span>4. Executive Directives</span>
                {pinnedCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
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
                onPromoteSku={canPromote ? handlePromoteSku : undefined}
                onRefreshData={handleRefreshData}
                onClaimTask={handleClaimTask}
                isClaiming={isClaiming}
                currentUser={effectiveUser}
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

          {/* RIGHT: TIME LOG CHATTER FEED PANEL */}
          <ProgramPlanningChatterFeed
            activeRequest={activeRequest}
            onNoteAdded={handleRefreshData}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProgramPlanningInspectorModal;
