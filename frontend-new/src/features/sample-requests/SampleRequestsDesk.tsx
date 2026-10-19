import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { isAdmin as isAdminUser } from "@/features/auth/permissions";
import { SampleRequestItem, ProgramMaterialItem } from "./types";
import {
  fetchAllMarketingRequestsApi,
  fetchMarketingSamplingRequestsApi,
  fetchDraftMarketingRequestsApi,
  fetchFeasibilityRequestsApi,
  fetchProgramRequestsApi,
  createSampleRequestApi,
  createFeasibilityRequestApi,
  recordFeasibilityMarketingDecisionApi,
  mapFeasibilityRequestToSampleRequest,
  updateSampleRequestApi,
  updateAnyRequestStatusApi,
  releaseDraftRequestsApi,
} from "@/infrastructure/api";
import {
  getRequestTrackType,
  getRequestTrackBadge,
  getStageIdForRequest,
  getDraftReleaseStatus,
  isOpenFeasibilityReview,
  isDesignRequest,
} from "./utils/trackTypes";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { Building2 } from "lucide-react";
import { TeamHeadReadOnlyNotice } from "@/components/ui/TeamHeadReadOnlyNotice";
import { getRequestRequiredDate } from "./sampling/utils/requestTypeUtils";

// Keep each large sub-desk out of the initial request-workspace chunk.
const MarketingOverviewPage = React.lazy(() =>
  import("./overview/MarketingOverviewPage").then((module) => ({ default: module.MarketingOverviewPage }))
);
const SamplingRequestsPage = React.lazy(() =>
  import("./sampling/SamplingRequestsPage").then((module) => ({ default: module.SamplingRequestsPage }))
);
const FeasibilityRequestsPage = React.lazy(() =>
  import("./feasibility/FeasibilityRequestsPage").then((module) => ({ default: module.FeasibilityRequestsPage }))
);
const ProgramPlanningPage = React.lazy(() =>
  import("./programs/ProgramPlanningPage").then((module) => ({ default: module.ProgramPlanningPage }))
);

// Code-split heavy modal sheets & dialogs for fast initial load
const SampleRequestInspector = React.lazy(() =>
  import("./components/SampleRequestInspector").then((m) => ({ default: m.SampleRequestInspector }))
);
const DesignRequestInspectorModal = React.lazy(() =>
  import("./components/DesignRequestInspectorModal").then((m) => ({ default: m.DesignRequestInspectorModal }))
);
const FeasibilityInspectorModal = React.lazy(() =>
  import("./components/FeasibilityInspectorModal").then((m) => ({ default: m.FeasibilityInspectorModal }))
);
const NewSampleRequestModal = React.lazy(() =>
  import("./components/NewSampleRequestModal").then((m) => ({ default: m.NewSampleRequestModal }))
);
const NewProgramPlanningModal = React.lazy(() =>
  import("./programs/components/NewProgramPlanningModal").then((m) => ({ default: m.NewProgramPlanningModal }))
);
const ProgramPlanningInspectorModal = React.lazy(() =>
  import("./programs/components/ProgramPlanningInspectorModal").then((m) => ({ default: m.ProgramPlanningInspectorModal }))
);

// Re-export for any external consumers
export {
  getRequestTrackType,
  getRequestTrackBadge,
  getStageIdForRequest,
  isOpenFeasibilityReview,
};

export interface SampleRequestsDeskProps {
  user?: UserProfile | null;
}

const isMockupWorkflowRequest = (request?: Partial<SampleRequestItem> | null) =>
  Boolean(
    request &&
      ((request.requestTypes || []).includes("mockup") ||
        String(request.mockupRequired || "").toLowerCase() === "yes")
  );

export type MarketingSubView = "overview" | "sampling" | "feasibility" | "programs";

export const SampleRequestsDesk: React.FC<SampleRequestsDeskProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isAdmin = isAdminUser(user);
  const isReadOnly = Boolean(user?.is_team_head) && !isAdmin;

  const { selectedYear } = useBusinessYear();

  // Active Plant state (synced with global app:plant-changed)
  const [selectedPlant, setSelectedPlant] = useState<string>(() => {
    try {
      return localStorage.getItem("samp_active_plant") || "ALL";
    } catch {
      return "ALL";
    }
  });

  useEffect(() => {
    const handlePlantChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ plant: string; label?: string }>;
      if (customEvent.detail?.plant) {
        setSelectedPlant(customEvent.detail.plant);
      }
    };
    window.addEventListener("app:plant-changed", handlePlantChanged);
    return () => window.removeEventListener("app:plant-changed", handlePlantChanged);
  }, []);

  // Primary Data State
  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const requestsLoadSequence = useRef(0);
  const [samplingDraftOnly, setSamplingDraftOnly] = useState(
    () => (location.state as { stage?: string } | null)?.stage === "draft",
  );

  // The Marketing team shares its workflow queue; the API applies role ownership.
  const visibleRequests = requests;

  // Inspector & Modal State
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isDesignReviewOpen, setIsDesignReviewOpen] = useState(false);
  const [isDesignRequestInspectorOpen, setIsDesignRequestInspectorOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isNewProgramModalOpen, setIsNewProgramModalOpen] = useState(false);
  const [modalInitialTrack, setModalInitialTrack] = useState<
    "marketing_request" | "feasibility_check" | "program_planning"
  >("feasibility_check");

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Determine active view based on path or query param
  const activeView: MarketingSubView = useMemo(() => {
    const path = location.pathname;
    if (path.includes("/sampling")) return "sampling";
    if (path.includes("/feasibility")) return "feasibility";
    if (path.includes("/programs")) return "programs";

    const queryView = searchParams.get("view");
    if (queryView === "sampling") return "sampling";
    if (queryView === "feasibility") return "feasibility";
    if (queryView === "programs") return "programs";

    return "overview";
  }, [location.pathname, searchParams]);

  // Handle external navigation states (e.g. from Dashboard, Quick Actions, or Program Workspace)
  useEffect(() => {
    if ((location.state as any)?.openMarketingSetup) {
      setModalInitialTrack("marketing_request");
      setIsNewModalOpen(true);
    }
    if ((location.state as any)?.toastMessage) {
      showToast((location.state as any).toastMessage);
    }
  }, [location.state, showToast]);

  // Fetch Requests from Backend API
  const loadRequests = useCallback(async () => {
    const sequence = ++requestsLoadSequence.current;
    setIsLoading(true);
    try {
      const merged = activeView === "sampling"
        ? samplingDraftOnly
          ? await fetchDraftMarketingRequestsApi(selectedYear)
          : await fetchMarketingSamplingRequestsApi(selectedYear)
        : activeView === "feasibility"
          ? await fetchFeasibilityRequestsApi(selectedYear)
          : activeView === "programs"
            ? await fetchProgramRequestsApi(selectedYear)
            : await fetchAllMarketingRequestsApi(selectedYear);
      if (sequence === requestsLoadSequence.current) setRequests(merged);
    } catch (err) {
      console.error("Failed to load sample requests:", err);
      if (sequence === requestsLoadSequence.current) {
        showToast("Could not load requests from the backend. Retry in a moment.");
      }
    } finally {
      if (sequence === requestsLoadSequence.current) setIsLoading(false);
    }
  }, [activeView, samplingDraftOnly, selectedYear, showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, location.state]);

  useEffect(() => {
    const handleFocus = () => void loadRequests();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadRequests]);

  useEffect(() => {
    if (!selectedRequest) return;
    const refreshed = requests.find((item) => String(item.id) === String(selectedRequest.id));
    if (refreshed && refreshed !== selectedRequest) setSelectedRequest(refreshed);
  }, [requests, selectedRequest?.id]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      event.preventDefault();
      void loadRequests().finally(() => {
        window.dispatchEvent(new Event("app:refresh-complete"));
      });
    };
    window.addEventListener("app:refresh-requested", handleRefresh);
    return () => window.removeEventListener("app:refresh-requested", handleRefresh);
  }, [loadRequests]);

  useEffect(() => {
    const handleProgramUpdate = (event: Event) => {
      const updated = (event as CustomEvent<SampleRequestItem | undefined>).detail;
      if (!updated || getRequestTrackType(updated) !== "program_planning") {
        void loadRequests();
        return;
      }
      setRequests((current) => current.map((item) =>
        String(item.id) === String(updated.id) ? updated : item,
      ));
      setSelectedRequest((current) =>
        current && String(current.id) === String(updated.id) ? updated : current,
      );
    };
    window.addEventListener("samp:requests-changed", handleProgramUpdate);
    return () => window.removeEventListener("samp:requests-changed", handleProgramUpdate);
  }, [loadRequests]);

  // Unique plants and customers dynamically derived from active DB records
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    visibleRequests.forEach((r) => {
      if (r.targetPlant && r.targetPlant.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [visibleRequests]);

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    visibleRequests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [visibleRequests]);

  // Open Inspector (or route Drafts directly to Product Staging)
  const handleInspectRequest = (req: SampleRequestItem) => {
    if (getStageIdForRequest(req) === "draft") {
      const stagingContext = {
        customer: req.customer || "",
        programName: req.programName || req.productDescription || "",
        programYear: req.programYear || "2026",
        year: req.year || "2026-27",
        targetPlant: req.targetPlant || "",
        parentRequestId: req.id,
        parentSrNumber: req.requestCode || req.srNumber || `SR-${req.id}`,
        parentRequestTypes: req.requestTypes || [],
        parentMockupWorkflowState: req.mockupWorkflowState,
        parentCreationMode: req.creationMode,
      };
      sessionStorage.setItem("samp_active_program_form", JSON.stringify(stagingContext));
      navigate("/sample-requests/product-staging", { state: stagingContext });
      return;
    }
    setSelectedRequest(req);
    if (isDesignRequest(req) && !isMockupWorkflowRequest(req)) {
      setIsDesignRequestInspectorOpen(true);
      return;
    }
    setIsInspectorOpen(true);
  };

  // Open Modal with specific track
  const handleOpenNewModal = (
    track: "marketing_request" | "feasibility_check" | "program_planning" = "feasibility_check"
  ) => {
    if (isReadOnly) return;
    if (track === "program_planning") {
      setIsNewProgramModalOpen(true);
      return;
    }
    setModalInitialTrack(track);
    setIsNewModalOpen(true);
  };

  // Marketing Feasibility Sign-off / Verdict Action
  const handleMarketingApproveFeasibility = async (
    requestId: string | number,
    approved: boolean,
    remark?: string
  ) => {
    const newStatus = approved ? "Approved by Marketing" : "Closed (Rejected)";
    const decision = approved ? "Accepted" : "Rejected";
    const nowIso = new Date().toISOString();
    const payload: Partial<SampleRequestItem> = {
      status: newStatus,
      marketingDecision: decision,
      marketingDecisionBy: user?.name || user?.userid || "Marketing Specialist",
      marketingDecisionAt: nowIso,
      marketingDecisionRemark: remark || null,
    };

    setRequests((prev) =>
      prev.map((r) =>
        String(r.id) === String(requestId)
          ? {
              ...r,
              ...payload,
            }
          : r
      )
    );

    if (selectedRequest && String(selectedRequest.id) === String(requestId)) {
      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              ...payload,
            }
          : null
      );
    }

    try {
      await recordFeasibilityMarketingDecisionApi(requestId, {
        decision,
        decision_remark: remark || null,
      });
      await loadRequests();
    } catch (err) {
      console.error("Failed to record marketing decision to backend:", err);
    }

    showToast(
      approved
        ? `✓ Feasibility request approved and completed by Marketing.`
        : `Feasibility request closed (rejected) by Marketing.`
    );
  };

  // Direct Status Update Handler (for quick status change)
  const handleUpdateStatus = async (reqId: string | number, newStatus: string) => {
    const requestItem = requests.find((r) => String(r.id) === String(reqId));
    setRequests((prev) =>
      prev.map((r) =>
        String(r.id) === String(reqId) ? { ...r, status: newStatus } : r
      )
    );
    if (selectedRequest && String(selectedRequest.id) === String(reqId)) {
      setSelectedRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    try {
      if (requestItem) await updateAnyRequestStatusApi(requestItem, newStatus);
      else await updateSampleRequestApi(reqId, { status: newStatus });
      await loadRequests();
      showToast(`✓ Request status updated to "${newStatus}"`);
    } catch (err) {
      console.error("Failed to update request status:", err);
      await loadRequests();
      showToast("Error updating request status.");
    }
  };

  // Release Marketing Request from Draft into Active Workflow
  const handleReleaseDraft = async (requestItem: SampleRequestItem) => {
    if (getRequestTrackType(requestItem) !== "marketing_request") {
      showToast("Only Marketing draft requests can be released to workflow.");
      return;
    }

    const newStatus = getDraftReleaseStatus(requestItem);

    try {
      await releaseDraftRequestsApi([requestItem], newStatus);

      setRequests((prev) =>
        prev.map((r) =>
          String(r.id) === String(requestItem.id) ? { ...r, status: newStatus } : r
        )
      );

      if (selectedRequest && String(selectedRequest.id) === String(requestItem.id)) {
        setSelectedRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
      }

      await loadRequests();

      const hasCosting = requestItem.requestTypes?.includes("costing") === true;
      const costingDestination = requestItem.costingCreativeInputNeeded === true ? "Creative first, then Costing" : "directly to Costing";
      const requestCode = requestItem.requestCode || requestItem.materialCode || requestItem.srNumber || requestItem.id;
      showToast(`✓ Request ${requestCode} released from Draft ${hasCosting ? `— Costing routed ${costingDestination}` : `into ${newStatus}`}!`);
    } catch (err) {
      console.error("Failed to release draft request:", err);
      showToast("Error releasing request from draft.");
    }
  };

  // Batch Release Draft Requests
  const handleBatchReleaseDraft = async (selectedIds: Set<string | number>) => {
    const draftItems = requests.filter(
      (r) =>
        selectedIds.has(r.id) &&
        getRequestTrackType(r) === "marketing_request" &&
        getStageIdForRequest(r) === "draft"
    );

    if (draftItems.length === 0) return;

    try {
      const groups = new Map<string, SampleRequestItem[]>();
      for (const item of draftItems) {
        const newStatus = getDraftReleaseStatus(item);
        groups.set(newStatus, [...(groups.get(newStatus) || []), item]);
      }
      for (const [newStatus, items] of groups) {
        await releaseDraftRequestsApi(items, newStatus);
      }

      await loadRequests();
      const creativeCostingCount = draftItems.filter((item) => item.requestTypes?.includes("costing") && item.costingCreativeInputNeeded === true).length;
      const directCostingCount = draftItems.filter((item) => item.requestTypes?.includes("costing") && item.costingCreativeInputNeeded !== true).length;
      const costingRoutes = [
        creativeCostingCount ? `${creativeCostingCount} through Creative` : "",
        directCostingCount ? `${directCostingCount} directly to Costing` : "",
      ].filter(Boolean).join("; ");
      showToast(`✓ Released ${draftItems.length} request(s) from Draft to active workflow${costingRoutes ? ` (${costingRoutes})` : ""}.`);
    } catch (err) {
      console.error("Failed to batch release draft requests:", err);
      await loadRequests();
      showToast("Error releasing selected requests from draft.");
    }
  };

  // Create Request Handler
  const handleCreateRequest = async (
    newForm: Partial<SampleRequestItem>
  ): Promise<boolean | SampleRequestItem> => {
    if (newForm.creationMode === "feasibility_check") {
      try {
        const created = await createFeasibilityRequestApi({
          customer: newForm.customer || "",
          feasibilityType: newForm.feasibilityType || "new_category",
          customFeasibilityType: newForm.customFeasibilityType ? newForm.customFeasibilityType.trim().slice(0, 25) : null,
          descriptionNotes: (newForm.feasibilityDescription || (newForm as any).descriptionNotes || newForm.productDescription || "").trim().slice(0, 75),
          requiredDate: newForm.sampleRequiredDate || "",
          marketingRemarks: newForm.marketingRemarks ? newForm.marketingRemarks.trim().slice(0, 100) : null,
          referenceImages: newForm.referenceImages || [],
          referenceImageNames: newForm.referenceImageNames || [],
          referenceLinks: newForm.referenceLinks || [],
        });
        setRequests((prev) => [mapFeasibilityRequestToSampleRequest(created), ...prev]);
        showToast(`Feasibility request ${created.requestCode} registered.`);
        return true;
      } catch (err) {
        console.error("Error creating feasibility request:", err);
        showToast(err instanceof Error ? err.message : "The feasibility request could not be saved.");
        return false;
      }
    }

    const payload: any = {
      ...newForm,
      createdAt: new Date().toISOString(),
    };

    try {
      const created = await createSampleRequestApi(payload);
      if (created) {
        setRequests((prev) => [created, ...prev]);
      } else {
        showToast("The sample request could not be saved to the backend.");
        return false;
      }
      showToast(`Sample Request ${created.srNumber} registered successfully!`);
      return created;
    } catch (err) {
      console.error("Error creating request:", err);
      showToast("The sample request could not be saved to the backend.");
      return false;
    }
  };

  const handleMaterialsUpdated = (
    requestId: string | number,
    updatedMaterials: ProgramMaterialItem[]
  ) => {
    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId || String(req.id) === String(requestId)) {
          return {
            ...req,
            programMaterials: updatedMaterials,
          };
        }
        return req;
      })
    );
    setSelectedRequest((prev) => {
      if (!prev) return null;
      if (prev.id === requestId || String(prev.id) === String(requestId)) {
        return {
          ...prev,
          programMaterials: updatedMaterials,
        };
      }
      return prev;
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    if (requests.length === 0) return;
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `sample_requests_${dateStr}.csv`,
      columns: [
        { header: "Sample Code", accessor: (r) => r.srNumber },
        { header: "Material Code", accessor: (r) => r.materialCode },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer", accessor: (r) => r.customer },
        { header: "Plant / Queue", accessor: (r) => r.targetPlant },
        { header: "Request Date", accessor: (r) => r.dateRequestCreated },
        { header: "Required Date", accessor: (r) => getRequestRequiredDate(r) },
        { header: "Status", accessor: (r) => r.status },
        { header: "Feasibility (Plant)", accessor: (r) => r.plantFeasibilityResponse || "Pending" },
        { header: "Feasibility (SAMP)", accessor: (r) => r.samplingFeasibilityResponse || "Pending" },
      ],
      data: visibleRequests,
    });
    showToast(`Exported ${visibleRequests.length} records to CSV`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--on-surface)] overflow-hidden select-none relative">
      <TeamHeadReadOnlyNotice user={user} />
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[100] max-w-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[12px] font-semibold px-4 py-3 rounded-2xl shadow-2xl border border-zinc-700/50 dark:border-zinc-300 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Shared Marketing workflow scope */}
      {!isAdmin && user ? (
        <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-6 py-2 flex items-center justify-between text-xs text-[var(--on-surface-muted)]">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>
              Marketing team queue <span className="text-[var(--on-surface-subtle)]">·</span> Shared request ownership
            </span>
          </div>
          <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">
            {visibleRequests.length} request{visibleRequests.length === 1 ? "" : "s"} visible
          </span>
        </div>
      ) : null}

      {/* Render Active Sub-Page */}
      <React.Suspense
        fallback={(
          <div className="flex min-h-48 flex-1 items-center justify-center p-6" role="status" aria-live="polite">
            <span className="text-sm text-[var(--on-surface-muted)]">Loading request workspace…</span>
          </div>
        )}
      >
      {activeView === "overview" && (
        <MarketingOverviewPage
          requests={visibleRequests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          user={user}
          isAdmin={isAdmin}
          onOpenNewModal={handleOpenNewModal}
          onInspectRequest={handleInspectRequest}
          onExportCSV={handleExportCSV}
        />
      )}

      {activeView === "sampling" && (
        <SamplingRequestsPage
          requests={visibleRequests}
          isLoading={isLoading}
          onDraftModeChange={setSamplingDraftOnly}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          uniquePlants={uniquePlants}
          uniqueCustomers={uniqueCustomers}
          user={user}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          onOpenNewModal={() => handleOpenNewModal("marketing_request")}
          onInspectRequest={handleInspectRequest}
          onReleaseDraft={handleReleaseDraft}
          onBatchReleaseDraft={handleBatchReleaseDraft}
          onRefresh={loadRequests}
          onExportCSV={handleExportCSV}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {activeView === "feasibility" && (
        <FeasibilityRequestsPage
          user={user}
          sourceDesk="marketing"
          isReadOnly={isReadOnly}
        />
      )}

      {activeView === "programs" && (
        <ProgramPlanningPage
          requests={visibleRequests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          uniqueCustomers={uniqueCustomers}
          user={user}
          isAdmin={isAdmin}
          isReadOnly={isReadOnly}
          onOpenNewModal={() => handleOpenNewModal("program_planning")}
          onInspectRequest={handleInspectRequest}
          onRefresh={loadRequests}
        />
      )}
      </React.Suspense>

      {/* Master Detail Inspector Drawer & Dialog Modals */}
      <React.Suspense fallback={null}>
        {selectedRequest && isDesignRequest(selectedRequest) && !isMockupWorkflowRequest(selectedRequest) ? (
          <DesignRequestInspectorModal
            request={selectedRequest}
            isOpen={isDesignRequestInspectorOpen || isDesignReviewOpen}
            onClose={() => {
              setIsDesignRequestInspectorOpen(false);
              setIsDesignReviewOpen(false);
            }}
            mode="marketing"
            showToast={showToast}
          />
        ) : selectedRequest && getRequestTrackType(selectedRequest) === "feasibility_check" ? (
          <FeasibilityInspectorModal
            request={selectedRequest}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            onRefresh={loadRequests}
            user={user}
            isAdmin={isAdmin}
            sourceDesk="marketing"
          />
        ) : selectedRequest && getRequestTrackType(selectedRequest) === "program_planning" ? (
          <ProgramPlanningInspectorModal
            request={selectedRequest}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            mode="marketing"
            userRole={isAdmin ? "admin" : "marketing"}
            currentUser={user}
            readOnly={isReadOnly}
            onRefresh={loadRequests}
          />
        ) : (
          <SampleRequestInspector
            request={selectedRequest}
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            onMarketingApprove={handleMarketingApproveFeasibility}
            onMaterialsUpdated={handleMaterialsUpdated}
            onReleaseDraft={handleReleaseDraft}
            isAdmin={isAdmin}
            readOnly={isReadOnly}
            role="marketing"
            actorName={user?.name || user?.userid}
            actorUserId={user?.id}
            onRefresh={loadRequests}
          />
        )}

        {/* New Sample Request Modal */}
        <NewSampleRequestModal
          isOpen={isNewModalOpen && !isReadOnly}
          onClose={() => {
            setIsNewModalOpen(false);
            setModalInitialTrack("feasibility_check");
          }}
          onSubmit={handleCreateRequest}
          initialTrack={modalInitialTrack}
          lockTrack={activeView !== "overview"}
          requestCreatedBy={user?.name || user?.userid}
        />

        {/* New Seasonal Program Planning Modal */}
        <NewProgramPlanningModal
          isOpen={isNewProgramModalOpen && !isReadOnly}
          onClose={() => setIsNewProgramModalOpen(false)}
          onProceed={(params) => {
            setIsNewProgramModalOpen(false);
            navigate("/sample-requests/program-planning", { state: params });
          }}
        />
      </React.Suspense>
    </div>
  );
};

export default SampleRequestsDesk;
