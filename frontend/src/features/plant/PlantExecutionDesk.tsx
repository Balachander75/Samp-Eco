import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { isReadOnlyTeamHead } from "@/features/auth/permissions";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { usePlant } from "@/context/PlantContext";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { fetchAllMarketingRequestsApi } from "@/infrastructure/api";
import { PlantProgramPlanningView } from "./PlantProgramPlanningView";
import { CheckCircle2 } from "lucide-react";
import { TeamHeadReadOnlyNotice } from "@/components/ui/TeamHeadReadOnlyNotice";

const ProgramPlanningInspectorModal = React.lazy(() =>
  import("@/features/sample-requests/programs/components/ProgramPlanningInspectorModal").then((m) => ({
    default: m.ProgramPlanningInspectorModal,
  }))
);

export interface PlantExecutionDeskProps {
  user?: UserProfile | null;
}

export const PlantExecutionDesk: React.FC<PlantExecutionDeskProps> = ({ user }) => {
  const location = useLocation();
  const { selectedYear } = useBusinessYear();
  const { selectedPlant } = usePlant();

  const activeView: "overview" | "sampling" | "programs" = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/sampling")) return "sampling";
    if (path.includes("/programs")) return "programs";
    return "overview";
  }, [location.pathname]);

  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProgramForReview, setSelectedProgramForReview] = useState<SampleRequestItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Load requests from backend
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const merged = await fetchAllMarketingRequestsApi(selectedYear);
      setRequests(merged);
    } catch (err) {
      console.error("Failed to load requests for plant execution desk:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Listen to refresh events and data mutations
  useEffect(() => {
    const handleRequestsChanged = (event: Event) => {
      const updated = (event as CustomEvent<SampleRequestItem | undefined>).detail;
      if (!updated || !String(updated.id).startsWith("program-")) {
        void loadRequests();
        return;
      }
      setRequests((current) => current.map((item) =>
        String(item.id) === String(updated.id) ? updated : item,
      ));
      setSelectedProgramForReview((current) =>
        current && String(current.id) === String(updated.id) ? updated : current,
      );
    };
    const handleRefreshRequested = (e: Event) => {
      e.preventDefault();
      void loadRequests().finally(() => {
        window.dispatchEvent(new Event("app:refresh-complete"));
      });
    };

    window.addEventListener("samp:requests-changed", handleRequestsChanged);
    window.addEventListener("app:refresh-requested", handleRefreshRequested);

    return () => {
      window.removeEventListener("samp:requests-changed", handleRequestsChanged);
      window.removeEventListener("app:refresh-requested", handleRefreshRequested);
    };
  }, [loadRequests]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 select-text overflow-hidden">
      <TeamHeadReadOnlyNotice user={user} />
      {/* ── Toast Notification Pill ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold shadow-2xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {activeView === "programs" ? (
        <>
          {/* Focused Program Planning review workbench */}
          <PlantProgramPlanningView
            requests={requests}
            isLoading={isLoading}
            selectedPlant={selectedPlant}
            onInspectRequest={(req) => setSelectedProgramForReview(req)}
            onRefresh={loadRequests}
            showToast={showToast}
          />

          {/* Program Planning Inspector Modal (Plant Review mode) */}
          <React.Suspense fallback={null}>
            <ProgramPlanningInspectorModal
              request={selectedProgramForReview}
              isOpen={Boolean(selectedProgramForReview)}
              onClose={() => setSelectedProgramForReview(null)}
              mode="plant"
              userRole={user?.role || "Plant Reviewer"}
              currentUser={user}
              readOnly={isReadOnlyTeamHead(user)}
            />
          </React.Suspense>
        </>
      ) : (
        /* Blank workspace for Plant Overview and Plant Sampling for future design */
        <div className="flex-1 min-h-0 bg-[var(--surface-base)]" />
      )}
    </div>
  );
};

export default PlantExecutionDesk;
