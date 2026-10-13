import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { claimMockupRequestApi, fetchSampleRequestsApi } from "@/infrastructure/api/sampleRequestsApi";
import { useBusinessYear } from "@/context/BusinessYearContext";
import type { UserProfile } from "@/features/auth";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import { MockupWorkflowInspectorModal } from "@/features/sample-requests/components/staging/MockupWorkflowInspectorModal";
import { MockupWorkflowQueuePage } from "@/features/sample-requests/components/staging/MockupWorkflowQueuePage";
import { StudioOverviewPage } from "./StudioOverviewPage";
import { StudioArtworkPage } from "./StudioArtworkPage";
import { TeamHeadReadOnlyNotice } from "@/components/ui/TeamHeadReadOnlyNotice";
import { isReadOnlyTeamHead } from "@/features/auth/permissions";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface StudioWorkDeskProps {
  user?: UserProfile | null;
}

export const StudioWorkDesk: React.FC<StudioWorkDeskProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedYear } = useBusinessYear();

  // Active view: "overview" | "mockup" | "sampling"
  const activeView: "overview" | "mockup" | "sampling" = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/mockup")) {
      return "mockup";
    }
    if (path.includes("/sampling") || path.includes("/prepress") || path.includes("/tooling") || path.includes("/artwork")) {
      return "sampling";
    }
    return "overview";
  }, [location.pathname]);

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
  const [mockupRequests, setMockupRequests] = useState<SampleRequestItem[]>([]);
  const [samplingRequests, setSamplingRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inspector state
  const [selectedMockupRequest, setSelectedMockupRequest] = useState<SampleRequestItem | null>(null);
  const [isMockupInspectorOpen, setIsMockupInspectorOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Load real sample requests
  const loadStudioData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sampleRequests = await fetchSampleRequestsApi(selectedYear).catch(() => []);
      const allRequests = Array.isArray(sampleRequests) ? sampleRequests : [];

      // Filter Mockup requests: has mockup in requestTypes or mockupRequired === "yes"
      const mockups = allRequests.filter((request) => {
        const isMockup =
          (request.requestTypes || []).includes("mockup") ||
          String(request.mockupRequired || "").toLowerCase() === "yes";
        const state = request.mockupWorkflowState;
        return isMockup && state?.stage === "studio";
      });

      // Filter Sampling requests: has "sample" in requestTypes
      const samplings = allRequests.filter((request) => {
        return (request.requestTypes || []).includes("sample");
      });

      setMockupRequests(mockups);
      setSamplingRequests(samplings);
    } catch (err) {
      console.error("Failed to load studio data:", err);
      setMockupRequests([]);
      setSamplingRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  useEffect(() => {
    const handleFocus = () => void loadStudioData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadStudioData]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      event.preventDefault();
      void loadStudioData().finally(() => window.dispatchEvent(new Event("app:refresh-complete")));
    };
    window.addEventListener("app:refresh-requested", handleRefresh);
    return () => window.removeEventListener("app:refresh-requested", handleRefresh);
  }, [loadStudioData]);

  // Open inspector and claim if necessary
  const handleInspectRequest = async (request: SampleRequestItem) => {
    try {
      const isStudioStage = request.mockupWorkflowState?.stage === "studio";
      const isClaimedByAnother =
        Boolean(request.mockupWorkflowState?.claimedBy) &&
        request.mockupWorkflowState?.claimedByUserId !== user?.id;

      if (isStudioStage && !isReadOnlyTeamHead(user) && !isClaimedByAnother) {
        const task = await claimMockupRequestApi(request.id).catch(() => request);
        setSelectedMockupRequest(task);
      } else {
        setSelectedMockupRequest(request);
      }
      setIsMockupInspectorOpen(true);
    } catch {
      setSelectedMockupRequest(request);
      setIsMockupInspectorOpen(true);
    }
  };

  const handleExportCSV = () => {
    const combinedMap = new Map<string | number, SampleRequestItem>();
    mockupRequests.forEach((r) => combinedMap.set(r.id, r));
    samplingRequests.forEach((r) => {
      if (!combinedMap.has(r.id)) combinedMap.set(r.id, r);
    });
    const items = Array.from(combinedMap.values());
    const dateStr = new Date().toISOString().split("T")[0];

    exportRecordsToCsv({
      filename: `studio_deliverables_${dateStr}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.id },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        { header: "Material Code", accessor: (r) => r.materialCode },
        { header: "Plant", accessor: (r) => r.targetPlant },
        { header: "Due Date", accessor: (r) => r.sampleRequiredDate },
        {
          header: "Studio Output (Link / Path)",
          accessor: (r) => r.mockupWorkflowState?.mockupUrl || "Awaiting Output",
        },
        { header: "Stage", accessor: (r) => r.mockupWorkflowState?.stage || r.status },
      ],
      data: items,
    });
    showToast(`Exported ${items.length} deliverables to CSV`);
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

      {/* Active Sub-View Body */}
      {activeView === "overview" && (
        <StudioOverviewPage
          mockupRequests={mockupRequests}
          samplingRequests={samplingRequests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          onNavigateToMockup={() => navigate("/studio-work/mockup")}
          onNavigateToSampling={() => navigate("/studio-work/sampling")}
          onInspectRequest={handleInspectRequest}
          onRefresh={loadStudioData}
          onExportCSV={handleExportCSV}
        />
      )}

      {activeView === "mockup" && (
        <MockupWorkflowQueuePage
          requests={mockupRequests}
          role="studio"
          isLoading={isLoading}
          readOnly={isReadOnlyTeamHead(user)}
          onRefresh={loadStudioData}
          onInspect={handleInspectRequest}
        />
      )}

      {activeView === "sampling" && (
        <StudioArtworkPage
          samplingRequests={samplingRequests}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          isLoading={isLoading}
          readOnly={isReadOnlyTeamHead(user)}
          onInspectRequest={handleInspectRequest}
          onExportCSV={handleExportCSV}
          onRefresh={loadStudioData}
        />
      )}

      {/* Mockup / Deliverable Workflow Inspector Modal */}
      <MockupWorkflowInspectorModal
        request={selectedMockupRequest}
        role="studio"
        readOnly={isReadOnlyTeamHead(user)}
        actorName={user?.name || user?.userid}
        actorUserId={user?.id}
        onClose={() => setIsMockupInspectorOpen(false)}
        onRefresh={loadStudioData}
      />
    </div>
  );
};

export default StudioWorkDesk;
