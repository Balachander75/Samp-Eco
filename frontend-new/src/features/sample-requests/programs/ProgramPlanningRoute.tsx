import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { isAdmin, isReadOnlyTeamHead } from "@/features/auth/permissions";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { usePlant } from "@/context/PlantContext";
import { SampleRequestItem } from "@/features/sample-requests/types";
import {
  deleteProgramRequestApi,
  fetchProgramRequestsApi,
} from "@/infrastructure/api/programsApi";
import { ProgramPlanningPage } from "./ProgramPlanningPage";
import { ProgramPlanningInspectorModal } from "./components/ProgramPlanningInspectorModal";
import { SamplingProgramPlanningView } from "@/features/samp-team/programs/SamplingProgramPlanningView";
import { PlantProgramPlanningView } from "@/features/plant/PlantProgramPlanningView";

export type ProgramPlanningMode = "marketing" | "sampling" | "plant";

interface ProgramPlanningRouteProps {
  user: UserProfile;
  mode: ProgramPlanningMode;
}

export const ProgramPlanningRoute: React.FC<ProgramPlanningRouteProps> = ({ user, mode }) => {
  const { selectedYear } = useBusinessYear();
  const { selectedPlant, plantOptions } = usePlant();
  const location = useLocation();
  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [toast, setToast] = useState("");
  const admin = isAdmin(user);
  const readOnly = isReadOnlyTeamHead(user);
  const selectedPlantLabel = useMemo(() => {
    if (!selectedPlant || selectedPlant === "ALL") return "ALL";
    const selected = selectedPlant.trim().toLowerCase();
    return plantOptions.find((plant) =>
      [plant.code, plant.name, plant.displayName].some((value) => value.trim().toLowerCase() === selected),
    )?.name || selectedPlant;
  }, [plantOptions, selectedPlant]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchProgramRequestsApi(selectedYear);
      setRequests(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load Program Planning requests.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const refresh = () => void loadRequests();
    window.addEventListener("samp:requests-changed", refresh);
    return () => window.removeEventListener("samp:requests-changed", refresh);
  }, [loadRequests]);

  useEffect(() => {
    const message = (location.state as { toastMessage?: unknown } | null)?.toastMessage;
    if (typeof message === "string" && message.trim()) setToast(message);
  }, [location.state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const uniquePlants = useMemo(
    () => Array.from(new Set(requests.map((request) => request.targetPlant?.trim()).filter((value): value is string => Boolean(value)))).sort(),
    [requests],
  );
  const uniqueCustomers = useMemo(
    () => Array.from(new Set(requests.map((request) => request.customer?.trim()).filter((value): value is string => Boolean(value)))).sort(),
    [requests],
  );

  const handleDeleteRequest = useCallback(async (request: SampleRequestItem, event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!window.confirm(`Delete Program Planning request ${request.requestCode || request.materialCode || request.id}? This cannot be undone.`)) return;
    const deleted = await deleteProgramRequestApi(request.id);
    if (!deleted) {
      setToast("Could not delete this Program Planning request.");
      return;
    }
    if (selectedRequest?.id === request.id) setSelectedRequest(null);
    setToast("Program Planning request deleted.");
    await loadRequests();
  }, [loadRequests, selectedRequest?.id]);

  const commonPageProps = {
    requests,
    isLoading,
    onInspectRequest: setSelectedRequest,
    onRefresh: loadRequests,
    showToast: setToast,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error && (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          <span>{error}</span>
          <button type="button" onClick={() => void loadRequests()} className="shrink-0 font-semibold underline underline-offset-2 transition-colors cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {mode === "marketing" ? (
        <ProgramPlanningPage
          {...commonPageProps}
          selectedYear={selectedYear}
          selectedPlant={selectedPlantLabel}
          uniquePlants={uniquePlants}
          uniqueCustomers={uniqueCustomers}
          user={user}
          isAdmin={admin}
          isReadOnly={readOnly}
          onOpenNewModal={() => undefined}
          onDeleteRequest={handleDeleteRequest}
        />
      ) : mode === "sampling" ? (
        <SamplingProgramPlanningView
          {...commonPageProps}
          selectedPlant={selectedPlantLabel}
          uniquePlants={uniquePlants}
          user={user}
          isAdmin={admin}
        />
      ) : (
        <PlantProgramPlanningView
          {...commonPageProps}
          selectedPlant={selectedPlant}
        />
      )}

      {selectedRequest && (
        <ProgramPlanningInspectorModal
          request={selectedRequest}
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          mode={mode}
          currentUser={user}
          readOnly={readOnly}
          onDeleteRequest={mode === "marketing" && admin ? handleDeleteRequest : undefined}
        />
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[120] max-w-sm rounded-xl border border-[var(--border-strong)] bg-[var(--surface-lowest)] px-4 py-3 text-xs font-medium text-[var(--on-surface)] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default ProgramPlanningRoute;
