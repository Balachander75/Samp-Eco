import type { CreativeBriefItem, SampleRequestItem } from "@/features/sample-requests/types";
import { isDirectPlantResampleRequest } from "@/features/sample-requests/utils/sampleRouting";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import {
  fetchCostingWorkflowsApi,
  fetchFeasibilityRequestsApi,
  fetchMarketingSamplingRequestsApi,
  fetchPlantSamplingQueueApi,
  fetchProgramRequestsApi,
  fetchSampleRequestsApi,
  fetchSamplingWorkflowReviewsApi,
  fetchCreativeBriefsApi,
  type RequestWorkflowRecord,
} from "@/infrastructure/api";

export interface SidebarBadgeAccess {
  marketing: boolean;
  samp: boolean;
  creativeStudio: boolean;
  costing: boolean;
  plant: boolean;
}

function isPendingWorkStatus(status?: string | null): boolean {
  const normalized = String(status || "").toLowerCase();
  return !["closed", "complete", "completed", "rejected", "cancelled", "canceled", "dispatched", "approved"]
    .some((term) => normalized.includes(term));
}

function isPendingMarketingSample(request: SampleRequestItem): boolean {
  return getRequestTrackType(request) === "marketing_request" && isPendingWorkStatus(request.status);
}

function isPendingFeasibilityForMarketing(request: SampleRequestItem): boolean {
  const status = String(request.status || "").toLowerCase();
  const decisionComplete = Boolean(request.marketingDecision)
    || status.includes("approved")
    || status.includes("rejected")
    || status.includes("closed");
  return !decisionComplete
    && !request.convertedRequestCode
    && !request.convertedSrNumber
    && !request.convertedSampleRequestId;
}

function hasSampProgramNote(request: SampleRequestItem): boolean {
  return Boolean(request.samplingRemark?.trim());
}

function hasPlantProgramNote(request: SampleRequestItem): boolean {
  return Boolean(request.plantRemark?.trim());
}

function isCreativeDesignRequest(request: SampleRequestItem): boolean {
  if (isDirectPlantResampleRequest(request) || String(request.srNumber || "").startsWith("SR-25-0001")) return false;

  const srNumber = String(request.srNumber || "").toUpperCase();
  const materialCode = String(request.materialCode || "").toUpperCase();
  const requestCode = String(request.requestCode || "").toUpperCase();
  if (
    getRequestTrackType(request) === "program_planning" ||
    request.requestKind === "program" ||
    requestCode.startsWith("PP-") ||
    srNumber.startsWith("PG-") ||
    materialCode.startsWith("PG-")
  ) return false;

  const scopes = request.requestTypes || [];
  const hasExplicitDesignRequest = scopes.includes("design") || Number(request.designRequestId) > 0;
  if (!hasExplicitDesignRequest) return false;

  const status = String(request.status || "").toLowerCase();
  if (status.includes("draft") || status.includes("smt") || status.includes("pending allocation")) return false;

  const designStatus = String(request.designRequestStatus || request.status || "").toLowerCase();
  return request.marketingDesignDecision !== "awaiting_marketing_review"
    && request.marketingDesignDecision !== "accepted"
    && !designStatus.includes("approved / closed");
}

function isCreativeSamplingRequest(request: SampleRequestItem): boolean {
  if (isDirectPlantResampleRequest(request) || String(request.srNumber || "").startsWith("SR-25-0001")) return false;

  const srNumber = String(request.srNumber || "").toUpperCase();
  const materialCode = String(request.materialCode || "").toUpperCase();
  const requestCode = String(request.requestCode || "").toUpperCase();
  if (
    getRequestTrackType(request) === "program_planning" ||
    request.requestKind === "program" ||
    request.creationMode === "program_planning" ||
    requestCode.startsWith("PP-") ||
    srNumber.includes("-PG-") ||
    srNumber.startsWith("PG-") ||
    materialCode.startsWith("PG-")
  ) return false;

  const status = String(request.status || "").toLowerCase();
  if (status.includes("draft") || status.includes("smt") || status.includes("pending allocation")) return false;

  const scopes = request.requestTypes || [];
  const hasMockup = scopes.includes("mockup") || String(request.mockupRequired || "").toLowerCase() === "yes";
  const hasSample = scopes.includes("sample");
  const mockupState = request.mockupWorkflowState;
  const stage = String(mockupState?.stage || "").toLowerCase();
  const routedAwayFromCreative = hasMockup && (
    mockupState?.designNeeded === false ||
    mockupState?.creativeBypassed === true ||
    (Boolean(stage) && !["creative", "creative_approval"].includes(stage))
  );

  return (hasMockup || hasSample) && !routedAwayFromCreative && isPendingWorkStatus(request.status);
}

function isPendingCreativeBrief(brief: CreativeBriefItem): boolean {
  return !String(brief.id || "").startsWith("CB-2024-")
    && !String(brief.srNumber || "").startsWith("SR-25-")
    && isPendingWorkStatus(brief.proofStatus);
}

function isPendingStudioRequest(request: SampleRequestItem): boolean {
  if (isDirectPlantResampleRequest(request)) return false;
  const stage = String(request.mockupWorkflowState?.stage || "").toLowerCase();
  const status = String(request.status || "").toLowerCase();
  return (stage === "studio" || (!stage && status.includes("studio"))) && isPendingWorkStatus(status);
}

function isPendingSamplingReview(record: RequestWorkflowRecord): boolean {
  if (record.workflow_type === "design") {
    const status = String(record.status || "").toLowerCase();
    return !status.includes("draft")
      && !status.includes("smt")
      && !status.includes("pending allocation")
      && isPendingWorkStatus(status);
  }

  return record.current_stage === "sampling_review" && record.reviewer_status !== "approved";
}

function safeLoad<T>(load: () => Promise<T[]>, enabled: boolean): Promise<T[]> {
  if (!enabled) return Promise.resolve([]);
  return load().catch(() => []);
}

export async function fetchSidebarBadges(year: string, access: SidebarBadgeAccess): Promise<Record<string, number>> {
  const needsMarketingSampling = access.marketing || access.creativeStudio;
  const needsFeasibility = access.marketing || access.samp;
  const needsPrograms = access.marketing || access.samp || access.plant;

  const [marketingSampling, feasibility, programs, sampReviews, creativeBriefs, creativeCosting, studioRequests, plantSampling, costingWorkflows] = await Promise.all([
    safeLoad(() => fetchMarketingSamplingRequestsApi(year), needsMarketingSampling),
    safeLoad(() => fetchFeasibilityRequestsApi({ year }), needsFeasibility),
    safeLoad(() => fetchProgramRequestsApi(year), needsPrograms),
    safeLoad(() => fetchSamplingWorkflowReviewsApi(year), access.samp),
    safeLoad(() => fetchCreativeBriefsApi(), access.creativeStudio),
    safeLoad(() => fetchCostingWorkflowsApi(year, "creative"), access.creativeStudio),
    safeLoad(() => fetchSampleRequestsApi(year, false, "mockup"), access.creativeStudio),
    safeLoad(() => fetchPlantSamplingQueueApi(year), access.plant),
    safeLoad(() => fetchCostingWorkflowsApi(year), access.costing),
  ]);

  const samplingCount = access.marketing
    ? marketingSampling.filter(isPendingMarketingSample).length
    : 0;
  const marketingFeasibilityCount = access.marketing
    ? feasibility.filter(isPendingFeasibilityForMarketing).length
    : 0;
  const sampFeasibilityCount = access.samp
    ? feasibility.filter((request) => !request.samplingFeasibilityResponse).length
    : 0;
  const programCount = access.marketing || access.samp
    ? programs.filter((request) => !hasSampProgramNote(request)).length
    : 0;
  const sampSamplingCount = access.samp
    ? sampReviews.filter(isPendingSamplingReview).length
    : 0;
  const plantProgramCount = access.plant
    ? programs.filter((request) => !hasPlantProgramNote(request)).length
    : 0;
  const plantSamplingCount = access.plant ? plantSampling.length : 0;

  const creativeDesignCount = access.creativeStudio
    ? marketingSampling.filter(isCreativeDesignRequest).length
      + creativeBriefs.filter(isPendingCreativeBrief).length
    : 0;
  const creativeSamplingCount = access.creativeStudio
    ? marketingSampling.filter(isCreativeSamplingRequest).length
    : 0;
  const creativeCostingCount = access.creativeStudio
    ? creativeCosting.filter((record) => record.workflow_type === "costing" && record.current_stage === "creative").length
    : 0;
  const studioQueueCount = access.creativeStudio
    ? studioRequests.filter(isPendingStudioRequest).length
    : 0;
  const costingQueueCount = access.costing
    ? costingWorkflows.filter((record) => record.current_stage === "costing").length
    : 0;

  return {
    ...(access.marketing && {
      marketing: samplingCount + marketingFeasibilityCount + programCount,
      sampling: samplingCount,
      pendingFeas: marketingFeasibilityCount,
      programs: programCount,
    }),
    ...(access.creativeStudio && {
      creative: creativeDesignCount + creativeSamplingCount + creativeCostingCount,
      creativeDesign: creativeDesignCount,
      creativeSampling: creativeSamplingCount,
      creativeCosting: creativeCostingCount,
      studio: studioQueueCount,
      studioMockup: studioQueueCount,
      studioSampling: studioQueueCount,
    }),
    ...(access.samp && {
      samp: sampSamplingCount + sampFeasibilityCount + programCount,
      sampSampling: sampSamplingCount,
      sampFeasibility: sampFeasibilityCount,
      sampPrograms: programCount,
    }),
    ...(access.costing && {
      costing: costingQueueCount,
      costingQueue: costingQueueCount,
    }),
    ...(access.plant && {
      plant: plantSamplingCount + plantProgramCount,
      plantSampling: plantSamplingCount,
      plantPrograms: plantProgramCount,
    }),
  };
}
