import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { isAdmin, UserProfile } from "@/features/auth";
import { useBusinessYear } from "@/context/BusinessYearContext";
import type { SampleRequestItem, ProductSearchResult } from "@/features/sample-requests/types";
import { fetchAllMarketingRequestsApi } from "@/infrastructure/api";
import { SampFeasibilityReviewPage } from "./feasibility/SampFeasibilityReviewPage";
import { SamplingProgramPlanningView } from "./programs/SamplingProgramPlanningView";
import { SamplingReviewQueuePage } from "./sampling/SamplingReviewQueuePage";
import { SamplingOverviewPage } from "./overview/SamplingOverviewPage";
import { CatalogProductInspectModal } from "@/features/sample-requests/components/staging/CatalogProductInspectModal";
import { TeamHeadReadOnlyNotice } from "@/components/ui/TeamHeadReadOnlyNotice";
import { CheckCircle2 } from "lucide-react";

const ProgramPlanningInspectorModal = React.lazy(() =>
  import("@/features/sample-requests/programs/components/ProgramPlanningInspectorModal").then((m) => ({
    default: m.ProgramPlanningInspectorModal,
  }))
);

export type SampSubView = "overview" | "sampling" | "feasibility" | "programs";

export interface SamplingTeamDeskProps {
  user?: UserProfile | null;
}

export const SamplingTeamDesk: React.FC<SamplingTeamDeskProps> = ({ user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const admin = isAdmin(user);
  const isReadOnly = Boolean(user?.is_team_head) && !admin;

  const { selectedYear } = useBusinessYear();

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

  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProgramForReview, setSelectedProgramForReview] = useState<SampleRequestItem | null>(null);
  const [selectedSampleForInspect, setSelectedSampleForInspect] = useState<SampleRequestItem | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const activeView: SampSubView = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/feasibility")) return "feasibility";
    if (path.includes("/sampling")) return "sampling";
    if (path.includes("/programs")) return "programs";

    const queryView = searchParams.get("view")?.toLowerCase();
    if (queryView === "feasibility") return "feasibility";
    if (queryView === "sampling") return "sampling";
    if (queryView === "programs") return "programs";

    return "overview";
  }, [location.pathname, searchParams]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const merged = await fetchAllMarketingRequestsApi(selectedYear);
      setRequests(merged);
    } catch (err) {
      console.error("Failed to load sampling team data:", err);
      showToast("Failed to fetch sampling work data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, showToast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const updated = (event as CustomEvent<SampleRequestItem | undefined>).detail;
      if (!updated || !String(updated.id).startsWith("program-")) {
        void loadRequests();
        return;
      }
      setRequests((current) =>
        current.map((item) => (String(item.id) === String(updated.id) ? updated : item))
      );
      setSelectedProgramForReview((current) =>
        current && String(current.id) === String(updated.id) ? updated : current
      );
    };
    const handleRefresh = () =>
      void loadRequests().finally(() => window.dispatchEvent(new Event("app:refresh-complete")));
    window.addEventListener("samp:requests-changed", handleChange);
    window.addEventListener("app:refresh-requested", handleRefresh);
    return () => {
      window.removeEventListener("samp:requests-changed", handleChange);
      window.removeEventListener("app:refresh-requested", handleRefresh);
    };
  }, [loadRequests]);

  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  // Map inspect product for CatalogProductInspectModal
  const inspectProduct = useMemo<ProductSearchResult | null>(() => {
    if (!selectedSampleForInspect) return null;
    const id = Number(selectedSampleForInspect.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return {
      id,
      sr_number: selectedSampleForInspect.srNumber,
      material_code: selectedSampleForInspect.materialCode,
      product_description: selectedSampleForInspect.productDescription,
      customer: selectedSampleForInspect.customer,
      target_plant: selectedSampleForInspect.targetPlant,
      product_category: selectedSampleForInspect.productCategory,
      product_sub_category: selectedSampleForInspect.productSubCategory,
      product_third_category: selectedSampleForInspect.productThirdCategory,
    };
  }, [selectedSampleForInspect]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text overflow-hidden relative">
      <TeamHeadReadOnlyNotice user={user} />

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed top-16 right-5 z-[70] flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl text-xs font-semibold border border-zinc-800 dark:border-zinc-200/80 max-w-sm animate-in fade-in slide-in-from-top-2 duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Sub-View Body ── */}
      {activeView === "overview" && (
        <SamplingOverviewPage
          requests={requests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          user={user}
          onNavigateToSampling={() => navigate("/samp-team-work/sampling")}
          onNavigateToFeasibility={() => navigate("/samp-team-work/feasibility")}
          onNavigateToPrograms={() => navigate("/samp-team-work/programs")}
          onInspectRequest={(req) => setSelectedSampleForInspect(req)}
        />
      )}

      {activeView === "sampling" && (
        <SamplingReviewQueuePage
          requests={requests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          uniquePlants={uniquePlants}
          uniqueCustomers={uniqueCustomers}
          readOnly={isReadOnly}
          onRefresh={loadRequests}
          showToast={showToast}
        />
      )}

      {activeView === "feasibility" && (
        <SampFeasibilityReviewPage
          requests={requests}
          isLoading={isLoading}
          selectedYear={selectedYear}
          selectedPlant={selectedPlant}
          uniquePlants={uniquePlants}
          uniqueCustomers={uniqueCustomers}
          user={user}
          isAdmin={admin}
          onRefresh={loadRequests}
          showToast={showToast}
        />
      )}

      {activeView === "programs" && (
        <SamplingProgramPlanningView
          requests={requests}
          isLoading={isLoading}
          selectedPlant={selectedPlant}
          uniquePlants={uniquePlants}
          user={user}
          isAdmin={admin}
          onInspectRequest={(req) => setSelectedProgramForReview(req)}
          onRefresh={loadRequests}
          showToast={showToast}
        />
      )}

      {/* ── Inspect Docket Modal ── */}
      {inspectProduct && (
        <CatalogProductInspectModal
          product={inspectProduct}
          onClose={() => setSelectedSampleForInspect(null)}
          heading="Product Technical Docket Review"
          intro="Review complete specifications, characteristics, classes and saved attributes."
          footer={
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--on-surface-subtle)]">
                Plant: {selectedSampleForInspect?.targetPlant || "Khaniwade"}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSampleForInspect(null)}
                className="px-4 py-1.5 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        />
      )}

      {/* ── Program Planning Review Modal ── */}
      <React.Suspense fallback={null}>
        <ProgramPlanningInspectorModal
          request={selectedProgramForReview}
          isOpen={Boolean(selectedProgramForReview)}
          onClose={() => setSelectedProgramForReview(null)}
          mode="sampling"
          userRole={user?.role || "Sampling Specialist"}
          currentUser={user}
          readOnly={isReadOnly}
        />
      </React.Suspense>
    </div>
  );
};

export default SamplingTeamDesk;
