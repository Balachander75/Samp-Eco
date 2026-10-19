import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { fetchCreativeBriefsApi } from "@/infrastructure/api/downstreamApi";
import { fetchAllMarketingRequestsApi } from "@/infrastructure/api/sampleRequestsApi";
import { fetchCostingWorkflowsApi, type RequestWorkflowRecord } from "@/infrastructure/api/workflowApi";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { CreativeBriefItem, SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import { isDirectPlantResampleRequest } from "@/features/sample-requests/utils/sampleRouting";
import { TopLoadingBar, WorkspaceSkeleton } from "@/components/ui/loading";
import { TeamHeadReadOnlyNotice } from "@/components/ui/TeamHeadReadOnlyNotice";
import { isReadOnlyTeamHead, isAdmin as isAdminUser } from "@/features/auth/permissions";

const CreativeOverviewPage = React.lazy(() =>
  import("./CreativeOverviewPage").then((m) => ({ default: m.CreativeOverviewPage }))
);
const CreativeDesignPage = React.lazy(() =>
  import("./CreativeDesignPage").then((m) => ({ default: m.CreativeDesignPage }))
);
const CreativeSamplingMockupPage = React.lazy(() =>
  import("./CreativeSamplingMockupPage").then((m) => ({ default: m.CreativeSamplingMockupPage }))
);
const CreativeCostingPage = React.lazy(() =>
  import("./CreativeCostingPage").then((m) => ({ default: m.CreativeCostingPage }))
);
const MockupWorkflowInspectorModal = React.lazy(() =>
  import("@/features/sample-requests/components/staging/MockupWorkflowInspectorModal").then((m) => ({
    default: m.MockupWorkflowInspectorModal,
  }))
);

const DesignRequestInspectorModal = React.lazy(() =>
  import("@/features/sample-requests/components/DesignRequestInspectorModal").then((m) => ({
    default: m.DesignRequestInspectorModal,
  }))
);

const hasMockupScope = (request: SampleRequestItem) =>
  (request.requestTypes || []).includes("mockup") || String(request.mockupRequired || "").toLowerCase() === "yes";

const isMockupRoutedAwayFromCreative = (request: SampleRequestItem) => {
  if (!hasMockupScope(request)) return false;

  const state = request.mockupWorkflowState;
  if (state?.designNeeded === false || state?.creativeBypassed === true) return true;

  const stage = String(state?.stage || "").toLowerCase();
  return Boolean(stage) && !["creative", "creative_approval"].includes(stage);
};

export interface CreativeWorkDeskProps {
  user?: UserProfile | null;
}

export const CreativeWorkDesk: React.FC<CreativeWorkDeskProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedYear } = useBusinessYear();
  const isAdmin = isAdminUser(user);

  // Active sub-view for the Creative department desk.
  const activeView: "overview" | "design" | "sampling" | "costing" = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/costing")) return "costing";
    if (path.includes("/design")) return "design";
    if (path.includes("/sampling") || path.includes("/mockup")) return "sampling";
    return "overview";
  }, [location.pathname]);

  const handleSelectTab = (tab: "overview" | "design" | "sampling" | "costing") => {
    if (tab === "overview") navigate("/creative-work");
    else if (tab === "design") navigate("/creative-work/design");
    else if (tab === "sampling") navigate("/creative-work/sampling");
    else if (tab === "costing") navigate("/creative-work/costing");
  };

  // Plant state
  const [selectedPlant, setSelectedPlant] = useState<string>(() => {
    try {
      return localStorage.getItem("samp_active_plant") || "ALL";
    } catch {
      return "ALL";
    }
  });

  useEffect(() => {
    const handlePlantChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ plant: string }>;
      if (customEvent.detail?.plant) {
        setSelectedPlant(customEvent.detail.plant);
      }
    };
    window.addEventListener("app:plant-changed", handlePlantChanged);
    return () => window.removeEventListener("app:plant-changed", handlePlantChanged);
  }, []);

  // Data state
  const [briefs, setBriefs] = useState<CreativeBriefItem[]>([]);
  const [allRequests, setAllRequests] = useState<SampleRequestItem[]>([]);
  const [costingRequests, setCostingRequests] = useState<RequestWorkflowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inspector states
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [isDesignInspectorOpen, setIsDesignInspectorOpen] = useState(false);
  const [isMockupInspectorOpen, setIsMockupInspectorOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Load briefs & sample requests
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [liveBriefs, requests, costingWorkflows] = await Promise.all([
        fetchCreativeBriefsApi().catch(() => []),
        fetchAllMarketingRequestsApi(selectedYear),
        fetchCostingWorkflowsApi(selectedYear, "creative").catch(() => []),
      ]);

      const cleanBriefs = (Array.isArray(liveBriefs) ? liveBriefs : []).filter(
        (b) => !String(b.id || "").startsWith("CB-2024-") && !String(b.srNumber || "").startsWith("SR-25-")
      );
      const cleanRequests = (Array.isArray(requests) ? requests : []).filter(
        (r) => !String(r.srNumber || "").startsWith("SR-25-0001") && !isDirectPlantResampleRequest(r)
      );

      setBriefs(cleanBriefs);
      setAllRequests(cleanRequests);
      setCostingRequests(costingWorkflows.filter((record) => record.workflow_type === "costing" && record.current_stage === "creative"));
    } catch (err) {
      console.error("Failed to load creative data:", err);
      showToast("Could not load design requests from the backend. Retry in a moment.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleFocus = () => void loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadData]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      event.preventDefault();
      void loadData().finally(() => window.dispatchEvent(new Event("app:refresh-complete")));
    };
    const handleRequestsChanged = () => void loadData();
    window.addEventListener("app:refresh-requested", handleRefresh);
    window.addEventListener("samp:requests-changed", handleRequestsChanged);
    window.addEventListener("samp:design-workflow-updated", handleRequestsChanged);
    return () => {
      window.removeEventListener("app:refresh-requested", handleRefresh);
      window.removeEventListener("samp:requests-changed", handleRequestsChanged);
      window.removeEventListener("samp:design-workflow-updated", handleRequestsChanged);
    };
  }, [loadData]);

  // Design scoped requests
  const designRequests = useMemo(() => {
    return allRequests.filter((r) => {
      const srCode = String(r.srNumber || "").toUpperCase();
      const materialCode = String(r.materialCode || "").toUpperCase();
      const requestCode = String(r.requestCode || "").toUpperCase();
      if (
        getRequestTrackType(r) === "program_planning" ||
        r.requestKind === "program" ||
        requestCode.startsWith("PP-") ||
        srCode.startsWith("PG-") ||
        materialCode.startsWith("PG-")
      ) {
        return false;
      }
      const scopes = r.requestTypes || [];
      const s = String(r.status || "").toLowerCase();
      const hasExplicitDesignRequest = scopes.includes("design") || Number(r.designRequestId) > 0;
      // Creative's Design queue only contains Design-scoped work or a linked Design request.
      if (!hasExplicitDesignRequest) return false;
      // Exclude unreleased drafts - only show once released to Creative
      if (s.includes("draft") || s.includes("smt") || s.includes("pending allocation")) return false;

      // Keep a claimed task in the assignee's queue. Global admins and
      // read-only team heads retain visibility for oversight and recovery.
      if (r.claimedBy && !isAdmin && !isReadOnlyTeamHead(user)) {
        const ownerMatches = r.claimedByUserId != null && user?.id != null
          ? String(r.claimedByUserId) === String(user.id)
          : [user?.name, user?.userid].some((value) =>
              Boolean(value) && String(r.claimedBy).trim().toLowerCase() === String(value).trim().toLowerCase()
            );
        if (!ownerMatches) return false;
      }

      const designState = String(r.designRequestStatus || r.status || "").toLowerCase();
      if (
        r.marketingDesignDecision === "awaiting_marketing_review" ||
        r.marketingDesignDecision === "accepted" ||
        designState.includes("approved / closed")
      ) {
        return false;
      }
      return true;
    });
  }, [allRequests, isAdmin, user]);

  // Sampling & Mockup requests (come together)
  const samplingMockupRequests = useMemo(() => {
    return allRequests.filter((r) => {
      const srCode = String(r.srNumber || "").toUpperCase();
      const materialCode = String(r.materialCode || "").toUpperCase();
      const requestCode = String(r.requestCode || "").toUpperCase();
      if (
        getRequestTrackType(r) === "program_planning" ||
        r.requestKind === "program" ||
        r.creationMode === "program_planning" ||
        requestCode.startsWith("PP-") ||
        srCode.includes("-PG-") ||
        srCode.startsWith("PG-") ||
        materialCode.startsWith("PG-")
      ) {
        return false;
      }
      const s = String(r.status || "").toLowerCase();
      // Exclude unreleased drafts
      if (s.includes("draft") || s.includes("smt") || s.includes("pending allocation")) return false;

      const scopes = r.requestTypes || [];
      const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
      const hasSample = scopes.includes("sample");
      if (hasMockup && isMockupRoutedAwayFromCreative(r)) return false;
      return hasMockup || hasSample;
    });
  }, [allRequests]);

  // Counts for tabs

  // Handlers for Inspect
  const handleInspectDesignRequest = (req: SampleRequestItem) => {
    setSelectedRequest(req);
    setIsDesignInspectorOpen(true);
  };

  const handleInspectBrief = (brief: CreativeBriefItem) => {
    const adapted: SampleRequestItem = {
      id: brief.id,
      srNumber: brief.srNumber || brief.artCode,
      productDescription: brief.title,
      customer: brief.brand,
      programName: (brief as any).programName || "",
      programYear: "",
      year: "",
      dateRequestCreated: "",
      createdBy: (brief as any).createdBy || "",
      targetPlant: "",
      createdAt: "",
      sampleRequiredDate: brief.dueDate,
      status: brief.proofStatus,
      materialCode: brief.artCode,
      requestTypes: ["design"],
      requestKind: "design",
      numberOfDesigns: brief.variantsCount,
      designRemarks: (brief as any).designRemarks || "",
      targetAudience: (brief as any).targetAudience || "",
      trend: (brief as any).trend || "",
      designRequestStatus: brief.proofStatus,
    };
    setSelectedRequest(adapted);
    setIsDesignInspectorOpen(true);
  };

  const handleInspectSamplingMockup = (req: SampleRequestItem) => {
    try {
      setSelectedRequest(req);
      setIsMockupInspectorOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not inspect deliverable.");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--on-surface)] overflow-hidden select-text relative">
      <TeamHeadReadOnlyNotice user={user} />



      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-2xl border border-zinc-700/50 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {isLoading && <TopLoadingBar isLoading={true} />}

      {/* Active Sub-View Body */}
      <React.Suspense fallback={<WorkspaceSkeleton />}>
      {activeView === "overview" && (
        <CreativeOverviewPage
          briefs={briefs}
          designRequests={designRequests}
          samplingMockupRequests={samplingMockupRequests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          user={user}
          isAdmin={isAdmin}
          onNavigateToTab={(tab) => handleSelectTab(tab)}
          onInspectBrief={handleInspectBrief}
          onInspectRequest={(req) => {
            setSelectedRequest(req);
            setIsMockupInspectorOpen(true);
          }}
          onRefresh={loadData}
        />
      )}

      {activeView === "design" && (
        <CreativeDesignPage
          briefs={briefs}
          designRequests={designRequests}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          user={user}
          isAdmin={isAdmin}
          onInspectBrief={handleInspectBrief}
          onInspectRequest={handleInspectDesignRequest}
          onRefresh={loadData}
        />
      )}

      {activeView === "sampling" && (
        <CreativeSamplingMockupPage
          requests={samplingMockupRequests}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          isLoading={isLoading}
          readOnly={isReadOnlyTeamHead(user)}
          onInspectRequest={handleInspectSamplingMockup}
          onRefresh={loadData}
        />
      )}

      {activeView === "costing" && (
        <CreativeCostingPage
          requests={costingRequests}
          isLoading={isLoading}
          user={user}
          selectedYear={selectedYear}
          onRefresh={loadData}
        />
      )}
      </React.Suspense>

      {/* Modals & Inspectors */}
      <React.Suspense fallback={null}>
        {selectedRequest && isMockupInspectorOpen && (
          <MockupWorkflowInspectorModal
            request={selectedRequest}
            role="creative"
            readOnly={isReadOnlyTeamHead(user)}
            actorName={user?.name || user?.userid}
            actorUserId={user?.id}
            onClose={() => setIsMockupInspectorOpen(false)}
            onRefresh={loadData}
          />
        )}
        {selectedRequest && isDesignInspectorOpen && (
          <DesignRequestInspectorModal
            request={selectedRequest}
            isOpen={isDesignInspectorOpen}
            onClose={() => setIsDesignInspectorOpen(false)}
            onRefresh={loadData}
            mode="creative"
            showToast={showToast}
          />
        )}
      </React.Suspense>
    </div>
  );
};

export default CreativeWorkDesk;
