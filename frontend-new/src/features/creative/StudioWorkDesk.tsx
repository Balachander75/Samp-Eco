import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { UserProfile } from "@/features/auth";
import { isReadOnlyTeamHead } from "@/features/auth/permissions";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import { MockupWorkflowInspectorModal } from "@/features/sample-requests/components/staging/MockupWorkflowInspectorModal";
import { MockupWorkflowQueuePage } from "@/features/sample-requests/components/staging/MockupWorkflowQueuePage";
import { fetchSampleRequestsApi } from "@/infrastructure/api/sampleRequestsApi";
import { isDirectPlantResampleRequest } from "@/features/sample-requests/utils/sampleRouting";
import { useBusinessYear } from "@/context/BusinessYearContext";

interface StudioWorkDeskProps {
  user?: UserProfile | null;
}

export const StudioWorkDesk: React.FC<StudioWorkDeskProps> = ({ user }) => {
  const location = useLocation();
  const { selectedYear } = useBusinessYear();
  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await fetchSampleRequestsApi(selectedYear, false, "mockup");
      const studioRows = rows.filter((request) => {
        if (isDirectPlantResampleRequest(request)) return false;
        const stage = String(request.mockupWorkflowState?.stage || "").toLowerCase();
        const status = String(request.status || "").toLowerCase();
        return stage === "studio" || (!stage && status.includes("studio"));
      });
      setRequests(studioRows);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("samp:requests-changed", refresh);
    window.addEventListener("app:refresh-requested", refresh);
    return () => {
      window.removeEventListener("samp:requests-changed", refresh);
      window.removeEventListener("app:refresh-requested", refresh);
    };
  }, [load]);

  const pageRole = useMemo(() => "studio" as const, []);

  const inspect = (request: SampleRequestItem) => {
    setSelectedRequest(request);
  };

  const isSamplingRoute = location.pathname.toLowerCase().includes("/sampling");

  return (
    <>
      <MockupWorkflowQueuePage
        requests={requests}
        role={pageRole}
        isLoading={isLoading}
        readOnly={isReadOnlyTeamHead(user)}
        onInspect={(request) => void inspect(request)}
        onRefresh={load}
      />
      {selectedRequest && <MockupWorkflowInspectorModal
        request={selectedRequest}
        role="studio"
        readOnly={isReadOnlyTeamHead(user)}
        actorName={user?.name || user?.userid}
        actorUserId={user?.id}
        onClose={() => setSelectedRequest(null)}
        onRefresh={load}
      />}
      {isSamplingRoute && <span className="sr-only">Studio sampling route</span>}
    </>
  );
};

export default StudioWorkDesk;
