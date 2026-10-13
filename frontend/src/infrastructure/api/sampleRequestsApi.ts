import { apiFetch, API_BASE_URL, createApiHeaders } from "./client";
import {
  SampleRequestItem,
  CreateSampleRequestForm,
  BatchCreateSampleRequestPayload,
  BatchCreateSampleRequestResponse,
  DesignRequest,
  DesignRequestForm,
} from "@/features/sample-requests/types";
import { getBusinessYearForDate } from "@/lib/businessYear";
import { readAuthUser } from "@/lib/session";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import { fetchFeasibilityRequestsApi, deleteFeasibilityRequestApi } from "./feasibilityApi";
import { fetchProgramRequestsApi, deleteProgramRequestApi } from "./programsApi";

type ApiSampleRequest = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function designText(value: unknown, defaults: string[] = []): string {
  const raw = text(value);
  const normalized = raw.trim().toLocaleLowerCase();
  return defaults.some((placeholder) => normalized === placeholder.toLocaleLowerCase()) ? "" : raw;
}

function textOrNumber(value: unknown): string | number {
  return typeof value === "number" ? value : text(value);
}

export function mapDesignRequest(item: Record<string, unknown>): DesignRequest {
  const workflow = (item.workflow_state && typeof item.workflow_state === "object"
    ? item.workflow_state
    : item.workflowState && typeof item.workflowState === "object"
      ? item.workflowState
      : {}) as Record<string, any>;
  return {
    id: Number(item.id),
    srNumber: typeof item.sr_number === "string" ? item.sr_number : typeof item.srNumber === "string" ? item.srNumber : undefined,
    requestCode: typeof item.request_code === "string" ? item.request_code : typeof item.requestCode === "string" ? item.requestCode : undefined,
    customerName: designText(item.customer_name ?? item.customer, ["General Customer", "General Customer Account", "General Account"]),
    programName: designText(item.program_name ?? item.programName, ["Marketing Intake Program", "Standard Season Program", "General Program"]),
    programYear: String(item.program_year || item.programYear || ""),
    targetPlant: typeof item.target_plant === "string" ? item.target_plant : typeof item.targetPlant === "string" ? item.targetPlant : undefined,
    numberOfDesigns: Number(item.number_of_designs || item.numberOfDesigns || 1),
    trend: typeof item.trend === "string" ? designText(item.trend, ["None specified"]) || null : null,
    targetAudience: typeof item.target_audience === "string"
      ? designText(item.target_audience, ["General Audience", "General"]) || null
      : typeof item.targetAudience === "string"
        ? designText(item.targetAudience, ["General Audience", "General"]) || null
        : null,
    referenceImage: typeof item.reference_image === "string" ? item.reference_image : typeof item.referenceImage === "string" ? item.referenceImage : null,
    productDescription: designText(item.product_description ?? item.productDescription, ["Creative Design Brief"]),
    designRequiredDate: typeof item.design_required_date === "string" ? item.design_required_date : typeof item.designRequiredDate === "string" ? item.designRequiredDate : null,
    designRemarks: typeof item.design_remarks === "string" ? item.design_remarks : typeof item.designRemarks === "string" ? item.designRemarks : null,
    referenceImages: Array.isArray(item.reference_images) ? item.reference_images as string[] : Array.isArray(item.referenceImages) ? item.referenceImages as string[] : [],
    referenceLinks: Array.isArray(item.reference_links) ? item.reference_links as string[] : Array.isArray(item.referenceLinks) ? item.referenceLinks as string[] : [],
    creativeSubmissions: (Array.isArray(item.creative_submissions) ? item.creative_submissions : Array.isArray(item.creativeSubmissions) ? item.creativeSubmissions : []).map((batch: any) => ({
      submittedAt: String(batch.submitted_at || batch.submittedAt || ""),
      designFileUrl: String(batch.design_file_url || batch.designFileUrl || ""),
      rows: (Array.isArray(batch.rows) ? batch.rows : []).map((row: any) => ({
        designNumber: String(row.design_number || row.designNumber || ""),
        description: String(row.description || ""),
        shutterstockNo: String(row.shutterstock_no || row.shutterstockNo || ""),
        remarks: String(row.remarks || ""),
      })),
    })),
    marketingDecision: (item.marketing_decision || item.marketingDecision || null) as DesignRequest["marketingDecision"],
    remainingDesignCount: Number(item.remaining_design_count ?? item.remainingDesignCount ?? 0),
    releasedAt: workflow.releasedAt || workflow.released_at || null,
    claimedBy: workflow.claimedBy || workflow.claimed_by || null,
    claimedAt: workflow.claimedAt || workflow.claimed_at || null,
    isCounterDateActive: Boolean(workflow.isCounterDateActive ?? workflow.is_counter_date_active ?? false),
    proposedTargetDate: workflow.proposedTargetDate || workflow.proposed_target_date || null,
    counterDateReason: workflow.counterDateReason || workflow.counter_date_reason || null,
    counterDateRequestedAt: workflow.counterDateRequestedAt || workflow.counter_date_requested_at || null,
    counterDateRequestedBy: workflow.counterDateRequestedBy || workflow.counter_date_requested_by || null,
    counterDateDecision: workflow.counterDateDecision || workflow.counter_date_decision || null,
    counterDateDecisionAt: workflow.counterDateDecisionAt || workflow.counter_date_decision_at || null,
    counterDateDecisionNotes: workflow.counterDateDecisionNotes || workflow.counter_date_decision_notes || null,
    workflowEvents: Array.isArray(workflow.events) ? workflow.events : [],
    workflowNotes: Array.isArray(workflow.notes) ? workflow.notes : [],
    status: String(item.status || "Draft (Pre-SMT)"),
    createdBy: designText(item.created_by ?? item.createdBy, ["Marketing Specialist", "Marketing Team (Corporate)", "Marketing", "Admin"]),
    updatedBy: String(item.updated_by || item.updatedBy || ""),
    createdAt: String(item.created_at || item.createdAt || ""),
    updatedAt: String(item.updated_at || item.updatedAt || ""),
  };
}

export function mapDesignRequestToSampleRequest(item: DesignRequest): SampleRequestItem {
  const createdDate = item.createdAt ? item.createdAt.split("T")[0] : "";
  return {
    id: `design-${item.id}`,
    srNumber: item.srNumber || "",
    year: item.programYear || "",
    productDescription: item.productDescription,
    customer: item.customerName,
    targetPlant: item.targetPlant || "",
    dateRequestCreated: createdDate,
    createdBy: item.createdBy || "",
    materialCode: item.requestCode || "",
    sampleRequiredDate: item.designRequiredDate || undefined,
    status: item.status || "Draft (Pre-SMT)",
    programYear: item.programYear,
    programName: item.programName,
    requestKind: "design",
    designRequestId: item.id,
    numberOfDesigns: item.numberOfDesigns,
    trend: item.trend,
    targetAudience: item.targetAudience,
    referenceImage: item.referenceImage,
    designRemarks: item.designRemarks,
    referenceImages: item.referenceImages,
    referenceLinks: item.referenceLinks,
    creativeSubmissions: item.creativeSubmissions,
    marketingDesignDecision: item.marketingDecision,
    remainingDesignCount: item.remainingDesignCount,
    releasedAt: item.releasedAt,
    designRequestCreatedAt: item.createdAt,
    claimedBy: item.claimedBy,
    claimedAt: item.claimedAt,
    isCounterDateActive: item.isCounterDateActive,
    proposedTargetDate: item.proposedTargetDate,
    counterDateReason: item.counterDateReason,
    counterDateRequestedAt: item.counterDateRequestedAt,
    counterDateRequestedBy: item.counterDateRequestedBy,
    counterDateDecision: item.counterDateDecision,
    counterDateDecisionAt: item.counterDateDecisionAt,
    counterDateDecisionNotes: item.counterDateDecisionNotes,
    workflowEvents: item.workflowEvents,
    workflowNotes: item.workflowNotes,
    designRequestStatus: item.status,
    targetArtworkDateCreative: item.designRequiredDate || undefined,
    createdAt: item.createdAt,
    requestTypes: ["design"],
    creationMode: "marketing_request",
  };
}

export async function fetchDesignRequestsApi(year?: string, draftOnly = false): Promise<DesignRequest[]> {
  const params = new URLSearchParams();
  if (year && year.toUpperCase() !== "ALL") params.set("year", year);
  if (draftOnly) params.set("draft_only", "true");
  const query = params.size ? `?${params.toString()}` : "";
  const data = await apiFetch<Record<string, unknown>[]>(`/api/v1/design-requests${query}`);
  return (data || []).map(mapDesignRequest);
}

export async function fetchDesignRequestApi(id: number): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}`);
  return mapDesignRequest(data);
}

export async function createDesignRequestApi(form: DesignRequestForm): Promise<DesignRequest | null> {
  try {
    const data = await apiFetch<Record<string, unknown>>("/api/v1/design-requests", {
      method: "POST",
      jsonBody: {
        customer_name: form.customerName.trim(),
        program_name: form.programName.trim(),
        program_year: form.programYear.trim(),
        number_of_designs: Number(form.numberOfDesigns),
        trend: form.trend.trim() || null,
        target_audience: form.targetAudience.trim() || null,
        reference_image: form.referenceImage.trim() || null,
        reference_images: form.referenceImages || [],
        reference_links: form.referenceLinks || [],
        product_description: form.productDescription.trim(),
        design_required_date: form.designRequiredDate || null,
        design_remarks: form.designRemarks?.trim() || null,
      },
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return mapDesignRequest(data);
  } catch (err) {
    console.error("Error creating design request:", err);
    return null;
  }
}

export async function updateDesignRequestApi(id: number, form: Partial<DesignRequestForm>): Promise<DesignRequest | null> {
  try {
    const body: Record<string, unknown> = {};
    if (form.customerName !== undefined) body.customer_name = form.customerName.trim();
    if (form.programName !== undefined) body.program_name = form.programName.trim();
    if (form.programYear !== undefined) body.program_year = form.programYear.trim();
    if (form.numberOfDesigns !== undefined) body.number_of_designs = Number(form.numberOfDesigns);
    if (form.trend !== undefined) body.trend = form.trend?.trim() || null;
    if (form.targetAudience !== undefined) body.target_audience = form.targetAudience?.trim() || null;
    if (form.referenceImage !== undefined) body.reference_image = form.referenceImage?.trim() || null;
    if (form.referenceImages !== undefined) body.reference_images = form.referenceImages;
    if (form.referenceLinks !== undefined) body.reference_links = form.referenceLinks;
    if (form.productDescription !== undefined) body.product_description = form.productDescription.trim();
    if (form.designRequiredDate !== undefined) body.design_required_date = form.designRequiredDate || null;
    if (form.designRemarks !== undefined) body.design_remarks = form.designRemarks?.trim() || null;

    const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}`, {
      method: "PATCH",
      jsonBody: body,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return mapDesignRequest(data);
  } catch (err) {
    console.error(`Error updating design request ${id}:`, err);
    return null;
  }
}

export async function deleteDesignRequestApi(id: number): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/design-requests/${id}`, { method: "DELETE" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return true;
  } catch (err) {
    console.error(`Error deleting design request ${id}:`, err);
    return false;
  }
}

export async function releaseDesignRequestApi(id: number): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/release`, {
    method: "POST",
    jsonBody: {},
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapDesignRequest(data);
}

function isStandaloneDesignRequest(request: SampleRequestItem): boolean {
  return (
    String(request.id).startsWith("design-") ||
    (request.requestKind === "design" && Boolean(request.designRequestId))
  );
}

export async function updateAnyRequestStatusApi(
  request: SampleRequestItem,
  status: string
): Promise<void> {
  if (isStandaloneDesignRequest(request)) {
    const designId = request.designRequestId || Number(String(request.id).replace(/^design-/, ""));
    if (!Number.isInteger(designId) || designId <= 0) {
      throw new Error("Design request ID is missing.");
    }
    if (status !== "Creative") {
      throw new Error("Design drafts can only be released to Creative from this action.");
    }
    await releaseDesignRequestApi(designId);
    return;
  }

  const updated = await updateSampleRequestApi(request.id, { status });
  if (!updated) {
    throw new Error(`Request ${request.srNumber || request.id} was not updated.`);
  }
}

export async function releaseDraftRequestsApi(
  requests: SampleRequestItem[],
  status = "Creative"
): Promise<void> {
  const sampleRequests: SampleRequestItem[] = [];
  const directDesigns: SampleRequestItem[] = [];
  for (const request of requests) {
    (isStandaloneDesignRequest(request) ? directDesigns : sampleRequests).push(request);
  }

  if (sampleRequests.length > 0) {
    const result = await batchUpdateStatusApi(sampleRequests.map((request) => request.id), status);
    if (!result.success || result.updatedCount !== sampleRequests.length) {
      throw new Error(`Released ${result.updatedCount} of ${sampleRequests.length} sample requests.`);
    }
  }
  for (const request of directDesigns) {
    await updateAnyRequestStatusApi(request, status);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
}

export async function releaseSampleRequestIdsApi(ids: Array<string | number>, status: string): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));
  if (!uniqueIds.length) throw new Error("No saved sample requests were found to release.");
  const result = await batchUpdateStatusApi(uniqueIds, status);
  if (!result.success || result.updatedCount !== uniqueIds.length) {
    throw new Error(`Released ${result.updatedCount} of ${uniqueIds.length} requests to ${status}.`);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
}

export async function createDesignBriefFromSampleApi(sampleRequestId: string | number, brief: {
  productDescription: string;
  numberOfDesigns: number;
  designRequiredDate: string;
  trend: string;
  targetAudience: string;
  designRemarks: string;
  referenceImages: string[];
  referenceLinks: string[];
}): Promise<DesignRequest> {
  const data = await apiFetch<{ data: Record<string, unknown> }>(`/api/v1/sample-requests/${sampleRequestId}/design-brief`, {
    method: "POST",
    jsonBody: {
      product_description: brief.productDescription,
      number_of_designs: brief.numberOfDesigns,
      design_required_date: brief.designRequiredDate,
      trend: brief.trend,
      target_audience: brief.targetAudience,
      design_remarks: brief.designRemarks,
      reference_images: brief.referenceImages,
      reference_links: brief.referenceLinks,
      reference_image: brief.referenceImages[0] || null,
    },
  });
  return mapDesignRequest(data.data);
}

function notifyDesignWorkflowUpdated(id?: number | string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    window.dispatchEvent(new CustomEvent("samp:design-workflow-updated", { detail: { id, requestId: id } }));
  }
}

export async function submitCreativeDesignOutputApi(id: number, payload: {
  designFileUrl: string;
  rows: Array<{ shutterstockNo: string; remarks: string }>;
}, designerName?: string): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/creative-output`, {
    method: "PUT",
    jsonBody: {
      design_file_url: payload.designFileUrl,
      designer_name: designerName,
      rows: payload.rows.map((row) => ({ shutterstock_no: row.shutterstockNo, remarks: row.remarks })),
    },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export async function recordMarketingDesignDecisionApi(id: number, decision: "accept" | "request_remaining"): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/marketing-decision`, {
    method: "POST",
    jsonBody: { decision },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export async function requestPostDesignDeliverablesApi(
  id: number,
  deliverables: Array<"mockup" | "sample">,
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/design-requests/${id}/request-followup`, {
    method: "POST",
    jsonBody: { deliverables },
  });
  notifyDesignWorkflowUpdated(id);
  return mapSampleRequest(data);
}

export async function claimDesignRequestApi(id: number, designerName: string): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/claim`, {
    method: "POST",
    jsonBody: { designer_name: designerName },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export async function proposeDesignCounterDateApi(id: number, proposedDate: string, reason: string, designerName?: string): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/counter-date-proposal`, {
    method: "POST",
    jsonBody: { proposed_date: proposedDate, reason, designer_name: designerName },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export async function decideDesignCounterDateApi(id: number, decision: "accepted" | "rejected", notes?: string): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/counter-date-decision`, {
    method: "POST",
    jsonBody: { decision, notes },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export async function addDesignWorkflowNoteApi(id: number, body: string, actorDepartment: string): Promise<DesignRequest> {
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/design-requests/${id}/notes`, {
    method: "POST",
    jsonBody: { body, actor_department: actorDepartment },
  });
  notifyDesignWorkflowUpdated(id);
  return mapDesignRequest(data);
}

export function mapSampleRequest(item: ApiSampleRequest, fallbackDate = ""): SampleRequestItem {
  return {
    id: text(item.id),
    srNumber: text(item.sr_number ?? (item as any).srNumber),
    year: text(item.year),
    productDescription: text(item.product_description ?? (item as any).productDescription),
    programName: text(item.program_name ?? (item as any).programName),
    customer: text(item.customer),
    targetPlant: text(item.target_plant ?? (item as any).targetPlant),
    dateRequestCreated: text(item.date_request_created ?? (item as any).dateRequestCreated, fallbackDate),
    createdBy: text(item.created_by ?? (item as any).createdBy),
    materialCode: text(item.material_code ?? (item as any).materialCode),
    barcode: text(item.barcode),
    customerProductCode: text(item.customer_product_code ?? (item as any).customerProductCode),
    sourceSampleCode: text(item.source_sample_code ?? (item as any).sourceSampleCode),
    sourceRequestId: item.source_request_id ? Number(item.source_request_id) : undefined,
    sourceSampleRequestId: item.source_sample_request_id
      ? Number(item.source_sample_request_id)
      : item.source_request_id
      ? Number(item.source_request_id)
      : undefined,
    sampleRequiredDate: text(item.sample_required_date ?? (item as any).sampleRequiredDate),
    productType: text(item.product_type ?? (item as any).productType),
    productTypeNavneet: text(item.product_type_navneet ?? (item as any).productTypeNavneet ?? item.product_type),
    productTypeNewCustomer: text(item.product_type_new_customer ?? (item as any).productTypeNewCustomer),
    productCategory: text(item.product_category ?? (item as any).productCategory),
    productSubCategory: text(item.product_sub_category ?? (item as any).productSubCategory),
    productThirdCategory: text(item.product_third_category ?? (item as any).productThirdCategory),
    productImagePath: text(item.product_image_path ?? (item as any).productImagePath),
    designsCustomerCreative: text(item.designs_customer_creative ?? (item as any).designsCustomerCreative),
    brandName: text(item.brand_name ?? (item as any).brandName),
    unitPcPack: textOrNumber(item.unit_pc_pack ?? (item as any).unitPcPack),
    qtyPerPack: textOrNumber(item.qty_per_pack ?? (item as any).qtyPerPack),
    qtyDesignCosting: textOrNumber(item.qty_design_costing ?? (item as any).qtyDesignCosting),
    costingRequiredDate: text(item.costing_required_date ?? (item as any).costingRequiredDate) || null,
    costingCounterDate: text(item.costing_counter_date ?? (item as any).costingCounterDate) || null,
    costingOutputPath: text(item.costing_output_path ?? (item as any).costingOutputPath) || null,
    customDetails: (() => {
      const details = item.custom_details ?? (item as any).customDetails;
      if (!Array.isArray(details)) return [];
      return details.map((detail: any) => ({
        id: detail.id,
        className: text(detail.class_name ?? detail.className),
        characteristicName: text(detail.characteristic_name ?? detail.characteristicName),
        value: detail.value == null ? null : String(detail.value),
        uom: text(detail.uom) || null,
      }));
    })(),
    productArtworkNos: textOrNumber(item.product_artwork_nos ?? (item as any).productArtworkNos),
    targetArtworkDateCreative: text(item.target_artwork_date_creative ?? (item as any).targetArtworkDateCreative),
    targetArtworkDateStudio: text(item.target_artwork_date_studio ?? (item as any).targetArtworkDateStudio),
    qtyForSampling: textOrNumber(item.qty_for_sampling ?? (item as any).qtyForSampling),
    mockupRequired: text(item.mockup_required ?? (item as any).mockupRequired),
    mockupWorkflowState: (() => {
      const state = item.mockup_workflow_state ?? (item as any).mockupWorkflowState;
      return state && typeof state === "object" ? state as SampleRequestItem["mockupWorkflowState"] : undefined;
    })(),
    status: text(item.status, "Draft (Pre-SMT)"),
    creationMode: text(item.creation_mode ?? (item as any).creationMode, "material_code"),
    programYear: text(item.program_year ?? (item as any).programYear),
    requestTypes: (() => {
      const rawTypes = item.request_types || (item as any).requestTypes;
      if (Array.isArray(rawTypes) && rawTypes.length > 0) {
        const filtered = (rawTypes as any[]).filter((value): value is "design" | "mockup" | "sample" | "costing" =>
          ["design", "mockup", "sample", "costing"].includes(String(value))
        );
        if (filtered.length > 0) return filtered;
      }
      return ["sample"];
    })(),
    createdAt: item.created_at ? text(item.created_at).split("T")[0] : (item as any).createdAt ? text((item as any).createdAt).split("T")[0] : fallbackDate,
    plantFeasibilityResponse: (item.plant_feasibility_response || (item as any).plantFeasibilityResponse || null) as any,
    plantFeasibilityRemark: text(item.plant_feasibility_remark || (item as any).plantFeasibilityRemark) || null,
    samplingFeasibilityResponse: (item.sampling_feasibility_response || (item as any).samplingFeasibilityResponse || null) as any,
    samplingFeasibilityRemark: text(item.sampling_feasibility_remark || (item as any).samplingFeasibilityRemark) || null,
    feasibilityClosedAt: text(item.feasibility_closed_at || (item as any).feasibilityClosedAt) || null,
    feasibilityClosedBy: (item.feasibility_closed_by || (item as any).feasibilityClosedBy || null) as any,
    referenceImages: Array.isArray(item.reference_images)
      ? (item.reference_images as string[])
      : Array.isArray((item as any).referenceImages)
      ? ((item as any).referenceImages as string[])
      : [],
    referenceLinks: (() => {
      const explicitLinks: string[] = Array.isArray(item.reference_links)
        ? (item.reference_links as string[])
        : Array.isArray((item as any).referenceLinks)
        ? ((item as any).referenceLinks as string[])
        : [];
      return explicitLinks;
    })(),
    trend: text(item.trend ?? (item as any).trend) || null,
    targetAudience: text(item.target_audience ?? (item as any).targetAudience) || null,
    designRemarks: text(item.design_remarks ?? (item as any).designRemarks) || null,
    numberOfDesigns: Number(item.number_of_designs ?? (item as any).numberOfDesigns ?? item.product_artwork_nos ?? (item as any).productArtworkNos) || 0,
    designRequiredDate: text(item.design_required_date ?? (item as any).designRequiredDate) || null,
  };
}

export async function fetchSampleRequestsApi(year?: string, draftOnly = false, requestType?: "design" | "mockup" | "sample" | "costing"): Promise<SampleRequestItem[]> {
  try {
    const params = new URLSearchParams();
    if (year && year.toUpperCase() !== "ALL") params.set("year", year);
    if (draftOnly) params.set("draft_only", "true");
    if (requestType) params.set("request_type", requestType);
    const query = params.size ? `?${params.toString()}` : "";
    const data = await apiFetch<ApiSampleRequest[]>(`/api/v1/sample-requests${query}`);
    return (data || []).map((item) => mapSampleRequest(item));
  } catch (err) {
    console.error("Error fetching sample requests:", err);
    return [];
  }
}

export async function claimMockupRequestApi(
  sampleRequestId: string | number
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/claim`, {
    method: "POST",
    jsonBody: {},
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapSampleRequest(data);
}

export async function sendMockupRequestToStudioApi(
  sampleRequestId: string | number,
  actorName?: string,
  creativeDetails?: { shutterstockNo?: string; remark?: string }
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/send-to-studio`, {
    method: "POST",
    jsonBody: {
      actor_name: actorName,
      creative_shutterstock_no: creativeDetails?.shutterstockNo,
      creative_remark: creativeDetails?.remark,
    },
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapSampleRequest(data);
}

export async function saveMockupCreativeDateApi(
  sampleRequestId: string | number,
  decision: "confirmed" | "proposed",
  date: string,
  actorName?: string,
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/creative-date`, {
    method: "POST",
    jsonBody: { decision, date, actor_name: actorName },
  });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  return mapSampleRequest(data);
}

export async function decideMockupCreativeApprovalApi(
  sampleRequestId: string | number,
  decision: "accept" | "request_revision",
  remark?: string,
  actorName?: string,
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/creative-approval`, {
    method: "POST",
    jsonBody: { decision, remark, actor_name: actorName },
  });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  return mapSampleRequest(data);
}

export async function decideMockupMarketingAcceptanceApi(
  sampleRequestId: string | number,
  decision: "accept" | "request_revision",
  remark?: string,
  actorName?: string,
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/marketing-decision`, {
    method: "POST",
    jsonBody: { decision, remark, actor_name: actorName },
  });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  return mapSampleRequest(data);
}

export async function submitStudioMockupToMarketingApi(
  sampleRequestId: string | number,
  mockupUrl: string,
  actorName?: string
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/mockup/submit`, {
    method: "POST",
    jsonBody: { mockup_url: mockupUrl, actor_name: actorName },
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapSampleRequest(data);
}

export async function releaseSampleToPlantApi(
  sampleRequestId: string | number,
  payload: { targetPlant?: string; samplingRemark?: string }
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/release-to-plant`, {
    method: "POST",
    jsonBody: {
      target_plant: payload.targetPlant,
      sampling_remark: payload.samplingRemark,
    },
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapSampleRequest(data);
}

export async function submitSamplingFeedbackApi(
  sampleRequestId: string | number,
  feedback: string
): Promise<SampleRequestItem> {
  const data = await apiFetch<ApiSampleRequest>(`/api/v1/sample-requests/${sampleRequestId}/sampling-feedback`, {
    method: "POST",
    jsonBody: { feedback },
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapSampleRequest(data);
}

const marketingRequestsCache = new Map<string, {
  expiresAt: number;
  data?: SampleRequestItem[];
  pending?: Promise<SampleRequestItem[]>;
}>();
let marketingRequestsCacheListenerInstalled = false;

export async function fetchAllMarketingRequestsApi(year?: string): Promise<SampleRequestItem[]> {
  if (typeof window !== "undefined" && !marketingRequestsCacheListenerInstalled) {
    window.addEventListener("samp:requests-changed", () => marketingRequestsCache.clear());
    marketingRequestsCacheListenerInstalled = true;
  }
  const authUser = readAuthUser<{ id?: number; userid?: string }>();
  const cacheKey = `${authUser?.id ?? authUser?.userid ?? "anonymous"}:${year?.trim() || "ALL"}`;
  const cached = marketingRequestsCache.get(cacheKey);
  if (cached?.pending) return cached.pending;
  if (cached?.data && cached.expiresAt > Date.now()) return cached.data;

  const pending = loadAllMarketingRequestsApi(year);
  marketingRequestsCache.set(cacheKey, { expiresAt: 0, pending });
  try {
    const data = await pending;
    marketingRequestsCache.set(cacheKey, { expiresAt: Date.now() + 15_000, data });
    return data;
  } catch (err) {
    marketingRequestsCache.delete(cacheKey);
    throw err;
  }
}

/** Load only the Sample and Design draft queues for the Marketing draft workspace. */
export async function fetchDraftMarketingRequestsApi(year?: string): Promise<SampleRequestItem[]> {
  const [sampleRequests, designRequests] = await Promise.all([
    fetchSampleRequestsApi(year, true),
    fetchDesignRequestsApi(year, true),
  ]);
  return mergeSampleAndDesignRequests(sampleRequests, designRequests, year);
}

/** Load the Sample and Design workstream without unrelated Feasibility/Program records. */
export async function fetchMarketingSamplingRequestsApi(year?: string): Promise<SampleRequestItem[]> {
  const [sampleRequests, designRequests] = await Promise.all([
    fetchSampleRequestsApi(year),
    fetchDesignRequestsApi(year),
  ]);
  return mergeSampleAndDesignRequests(sampleRequests, designRequests, year);
}

async function loadAllMarketingRequestsApi(year?: string): Promise<SampleRequestItem[]> {
  try {
    const [samplingRequests, feasibilityRequests, programRequests] = await Promise.all([
      fetchMarketingSamplingRequestsApi(year),
      fetchFeasibilityRequestsApi(year).catch(() => []),
      fetchProgramRequestsApi(year).catch(() => []),
    ]);
    let allItems = [...samplingRequests, ...feasibilityRequests, ...programRequests];

    if (year && year.toUpperCase() !== "ALL") {
      allItems = allItems.filter((r) => {
        const itemYear = r.year && r.year.includes("-") ? r.year : getBusinessYearForDate(r.dateRequestCreated || r.createdAt);
        return itemYear === year;
      });
    }

    return allItems.sort((a, b) => {
      const da = new Date(a.createdAt || a.dateRequestCreated || 0).getTime();
      const db = new Date(b.createdAt || b.dateRequestCreated || 0).getTime();
      return db - da;
    });
  } catch (err) {
    console.error("Error fetching all marketing requests:", err);
    throw err;
  }
}

function mergeSampleAndDesignRequests(
  sampleRequests: SampleRequestItem[],
  designRequests: DesignRequest[],
  year?: string,
): SampleRequestItem[] {
  const mappedDesignRequests = designRequests.map(mapDesignRequestToSampleRequest);
  const designBySrNumber = new Map(
    mappedDesignRequests.filter((item) => item.srNumber).map((item) => [item.srNumber, item]),
  );
  const sampleSrNumbers = new Set(sampleRequests.filter((item) => item.srNumber).map((item) => item.srNumber));
  const mergedSamples = sampleRequests.map((sample) => {
    const design = sample.srNumber ? designBySrNumber.get(sample.srNumber) : undefined;
    return design ? {
      ...sample,
      status: design.marketingDesignDecision === "accepted" &&
        (sample.requestTypes || []).some((type) => type === "mockup" || type === "sample")
        ? sample.status
        : design.status,
      designRequestId: design.designRequestId,
      designRequestStatus: design.designRequestStatus,
      numberOfDesigns: design.numberOfDesigns || sample.numberOfDesigns,
      trend: design.trend || sample.trend,
      targetAudience: design.targetAudience || sample.targetAudience,
      referenceImage: design.referenceImage || sample.productImagePath,
      designRemarks: design.designRemarks || sample.designRemarks,
      referenceImages: design.referenceImages?.length ? design.referenceImages : sample.referenceImages,
      referenceLinks: design.referenceLinks?.length ? design.referenceLinks : sample.referenceLinks,
      creativeSubmissions: design.creativeSubmissions,
      marketingDesignDecision: design.marketingDesignDecision,
      remainingDesignCount: design.remainingDesignCount,
      releasedAt: design.releasedAt,
      designRequestCreatedAt: design.designRequestCreatedAt,
      claimedBy: design.claimedBy,
      claimedAt: design.claimedAt,
      isCounterDateActive: design.isCounterDateActive,
      proposedTargetDate: design.proposedTargetDate,
      counterDateReason: design.counterDateReason,
      counterDateRequestedAt: design.counterDateRequestedAt,
      counterDateRequestedBy: design.counterDateRequestedBy,
      counterDateDecision: design.counterDateDecision,
      counterDateDecisionAt: design.counterDateDecisionAt,
      counterDateDecisionNotes: design.counterDateDecisionNotes,
      workflowEvents: design.workflowEvents,
      workflowNotes: design.workflowNotes,
      targetArtworkDateCreative: design.designRequiredDate || sample.targetArtworkDateCreative,
    } : sample;
  });
  const mappedDesignOnly = mappedDesignRequests.filter((design) =>
    !design.srNumber || !sampleSrNumbers.has(design.srNumber),
  );
  let result = [...mergedSamples, ...mappedDesignOnly];
  if (year && year.toUpperCase() !== "ALL") {
    result = result.filter((item) => {
      const itemYear = item.year && item.year.includes("-")
        ? item.year
        : getBusinessYearForDate(item.dateRequestCreated || item.createdAt);
      return itemYear === year;
    });
  }
  return result.sort((a, b) => {
    const dateA = new Date(a.createdAt || a.dateRequestCreated || 0).getTime();
    const dateB = new Date(b.createdAt || b.dateRequestCreated || 0).getTime();
    return dateB - dateA;
  });
}

export async function createSampleRequestApi(form: CreateSampleRequestForm): Promise<SampleRequestItem | null> {
  try {
    const rawYear = form.programYear || "2026";
    const selectedYear = String(rawYear).replace(/BTS/gi, "").trim() || "2026";
    const rawDate = form.dateRequestCreated || new Date().toISOString().split("T")[0];
    const calcBy = getBusinessYearForDate(rawDate);
    const itemYear = form.year && form.year.includes("-") ? form.year : calcBy;

    const payload = {
      client_draft_key: form.clientDraftKey || null,
      sr_number: (form as any).srNumber || (form as any).sr_number || undefined,
      year: itemYear,
      program_year: selectedYear,
      program_name: form.programName ? form.programName.trim() : null,
      product_description: form.productDescription || form.programName || "Standard Notebook Specification",
      customer: form.customer || "",
      target_plant: form.targetPlant || null,
      date_request_created: form.dateRequestCreated || new Date().toISOString().split("T")[0],
      created_by: form.createdBy || "Admin",
      material_code: form.materialCode || "",
      barcode: form.barcode || null,
      customer_product_code: form.customerProductCode || null,
      source_sample_code: form.sourceSampleCode || null,
      sample_required_date: form.sampleRequiredDate || null,
      product_type: form.productType || null,
      brand_name: form.brandName || null,
      product_type_navneet: form.productTypeNavneet || null,
      product_type_new_customer: form.productTypeNewCustomer || null,
      unit_pc_pack: form.unitPcPack != null ? String(form.unitPcPack) : null,
      qty_per_pack: form.qtyPerPack != null ? String(form.qtyPerPack) : null,
      qty_for_sampling: form.qtyForSampling != null ? String(form.qtyForSampling) : null,
      qty_design_costing: form.qtyDesignCosting != null ? String(form.qtyDesignCosting) : null,
      costing_required_date: form.costingRequiredDate || null,
      costing_counter_date: form.costingCounterDate || null,
      costing_output_path: form.costingOutputPath || null,
      mockup_required: form.mockupRequired || null,
      mockup_workflow_state: form.mockupWorkflowState || {},
      designs_customer_creative: form.designsCustomerCreative || null,
      product_artwork_nos: form.productArtworkNos != null ? String(form.productArtworkNos) : null,
      product_image_path: form.productImagePath || null,
      target_artwork_date_creative: form.targetArtworkDateCreative || null,
      target_artwork_date_studio: form.targetArtworkDateStudio || null,
      creation_mode: form.creationMode || "marketing_request",
      request_types: form.requestTypes || [],
      request_type_selected_at: form.requestTypeSelectedAt || {},
      custom_binding_1: form.customBinding1 || null,
      custom_binding_2: form.customBinding2 || null,
      custom_details: form.customDetails || null,
      status: form.status || "Draft (Pre-SMT)",
      source_sample_request_id: form.sourceRequestId,
      trend: form.trend || null,
      target_audience: form.targetAudience || null,
      targetAudience: form.targetAudience || null,
      number_of_designs: form.numberOfDesigns != null ? Number(form.numberOfDesigns) : null,
      design_remarks: form.designRemarks || null,
      designRemarks: form.designRemarks || null,
      reference_images: form.referenceImages || [],
      reference_links: form.referenceLinks || [],
      plant_feasibility_response: form.plantFeasibilityResponse || null,
      plant_feasibility_remark: form.plantFeasibilityRemark || null,
      sampling_feasibility_response: form.samplingFeasibilityResponse || null,
      sampling_feasibility_remark: form.samplingFeasibilityRemark || null,
    };

    const resJson = await apiFetch<any>("/api/v1/sample-requests", {
      method: "POST",
      jsonBody: payload,
    });
    const itemData = resJson?.data && typeof resJson.data === "object" ? resJson.data : resJson;
    const mapped = mapSampleRequest(itemData, new Date().toISOString().split("T")[0]);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return mapped;
  } catch (err) {
    console.error("Error creating sample request:", err);
    return null;
  }
}

export async function createSampleRequestBatchApi(
  payload: BatchCreateSampleRequestPayload
): Promise<BatchCreateSampleRequestResponse | null> {
  try {
    const data = await apiFetch<any>("/api/v1/sample-requests/batch", {
      method: "POST",
      jsonBody: payload,
    });
    const fallbackDate = new Date().toISOString().split("T")[0];
    const mappedRequests: SampleRequestItem[] = (data.requests || []).map((item: ApiSampleRequest) =>
      mapSampleRequest(item, fallbackDate)
    );
    return {
      success: true,
      message: data.message,
      total_created: data.total_created,
      requests: mappedRequests,
    };
  } catch (err) {
    console.error("Error creating sample requests batch:", err);
    throw err;
  }
}

export interface UpdateSampleRequestPayload extends Partial<CreateSampleRequestForm> {
  status?: string;
  samplingFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  samplingFeasibilityRemark?: string | null;
  plantFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  plantFeasibilityRemark?: string | null;
  feasibilityClosedAt?: string | null;
  feasibilityClosedBy?: "plant" | "sampling" | null;
  sampling_feasibility_response?: string | null;
  sampling_feasibility_remark?: string | null;
  plant_feasibility_response?: string | null;
  plant_feasibility_remark?: string | null;
  feasibility_closed_at?: string | null;
  feasibility_closed_by?: string | null;
  product_description?: string;
}

export async function updateSampleRequestApi(
  id: number | string,
  payload: UpdateSampleRequestPayload
): Promise<SampleRequestItem | null> {
  try {
    const rawYear = payload.programYear;
    const selectedYear = rawYear ? String(rawYear).replace(/BTS/gi, "").trim() : undefined;
    const bodyPayload = {
      material_code: payload.materialCode,
      product_description: payload.productDescription,
      customer: payload.customer,
      program_name: payload.programName,
      program_year: selectedYear,
      target_plant: payload.targetPlant,
      barcode: payload.barcode,
      customer_product_code: payload.customerProductCode,
      sample_required_date: payload.sampleRequiredDate || null,
      brand_name: payload.brandName,
      product_type: payload.productType,
      unit_pc_pack: payload.unitPcPack != null ? String(payload.unitPcPack) : undefined,
      qty_per_pack: payload.qtyPerPack != null ? String(payload.qtyPerPack) : undefined,
      qty_for_sampling: payload.qtyForSampling != null ? String(payload.qtyForSampling) : undefined,
      qty_design_costing: payload.qtyDesignCosting != null ? String(payload.qtyDesignCosting) : undefined,
      costing_required_date: payload.costingRequiredDate,
      costing_counter_date: payload.costingCounterDate,
      costing_output_path: payload.costingOutputPath,
      mockup_required: payload.mockupRequired,
      mockup_workflow_state: payload.mockupWorkflowState,
      designs_customer_creative: payload.designsCustomerCreative,
      product_artwork_nos: payload.productArtworkNos != null ? String(payload.productArtworkNos) : undefined,
      product_image_path: payload.productImagePath,
      creation_mode: payload.creationMode,
      request_types: payload.requestTypes,
      source_sample_code: payload.sourceSampleCode,
      custom_details: payload.customDetails !== undefined ? payload.customDetails.map((detail) => ({
        class_name: detail.className,
        characteristic_name: detail.characteristicName,
        value: detail.value,
        uom: detail.uom ?? null,
      })) : undefined,
      status: payload.status,
      trend: payload.trend !== undefined ? payload.trend : (payload as any).trend,
      target_audience: payload.targetAudience !== undefined ? payload.targetAudience : (payload as any).target_audience,
      targetAudience: payload.targetAudience !== undefined ? payload.targetAudience : (payload as any).target_audience,
      number_of_designs: payload.numberOfDesigns !== undefined ? payload.numberOfDesigns : (payload as any).number_of_designs,
      numberOfDesigns: payload.numberOfDesigns !== undefined ? payload.numberOfDesigns : (payload as any).number_of_designs,
      design_remarks: payload.designRemarks !== undefined ? payload.designRemarks : (payload as any).design_remarks,
      designRemarks: payload.designRemarks !== undefined ? payload.designRemarks : (payload as any).design_remarks,
      reference_images: payload.referenceImages !== undefined ? payload.referenceImages : (payload as any).reference_images,
      reference_links: payload.referenceLinks !== undefined ? payload.referenceLinks : (payload as any).reference_links,
      plant_feasibility_response: (payload as any).plantFeasibilityResponse ?? (payload as any).plant_feasibility_response,
      plant_feasibility_remark: (payload as any).plantFeasibilityRemark ?? (payload as any).plant_feasibility_remark,
      sampling_feasibility_response: (payload as any).samplingFeasibilityResponse ?? (payload as any).sampling_feasibility_response,
      sampling_feasibility_remark: (payload as any).samplingFeasibilityRemark ?? (payload as any).sampling_feasibility_remark,
      feasibility_closed_at: (payload as any).feasibilityClosedAt ?? (payload as any).feasibility_closed_at,
      feasibility_closed_by: (payload as any).feasibilityClosedBy ?? (payload as any).feasibility_closed_by,
    };

    const data: ApiSampleRequest = await apiFetch(`/api/v1/sample-requests/${id}`, {
      method: "PATCH",
      jsonBody: bodyPayload,
    });
    return mapSampleRequest(data, new Date().toISOString().split("T")[0]);
  } catch (err) {
    console.error(`Error updating sample request ${id}:`, err);
    throw err;
  }
}

export async function batchUpdateStatusApi(
  ids: (number | string)[],
  status: string
): Promise<{ success: boolean; updatedCount: number }> {
  try {
    const numericIds = ids.map((id) => Number(id)).filter((id) => !isNaN(id));
    const data = await apiFetch<{ success?: boolean; updated_count?: number; updatedCount?: number }>("/api/v1/sample-requests/batch-status", {
      method: "POST",
      jsonBody: {
        sample_request_ids: numericIds,
        status,
      },
    });
    return {
      success: Boolean(data.success),
      updatedCount: Number(data.updated_count ?? data.updatedCount ?? 0),
    };
  } catch (err) {
    console.error("Error batch updating status:", err);
    throw err;
  }
}

export async function deleteSampleRequestApi(id: number | string): Promise<boolean> {
  const cleanId = String(id).replace(/^sample-/, "");
  try {
    await apiFetch(`/api/v1/sample-requests/${cleanId}`, { method: "DELETE" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return true;
  } catch (err) {
    console.error("Error deleting sample request:", err);
    return false;
  }
}

export async function deleteAnyRequestApi(
  request: SampleRequestItem | { id: string | number; requestKind?: string; creationMode?: string; srNumber?: string }
): Promise<boolean> {
  const idStr = String(request.id || "");
  const track = getRequestTrackType(request as any);
  const srNumber = (request as any).srNumber;

  let success = false;
  if (idStr.startsWith("program-")) {
    success = await deleteProgramRequestApi(idStr);
  } else if (idStr.startsWith("feasibility-")) {
    success = await deleteFeasibilityRequestApi(idStr);
  } else if (isStandaloneDesignRequest(request as SampleRequestItem)) {
    const numId = Number((request as any).designRequestId || idStr.replace(/^design-/, ""));
    success = Number.isInteger(numId) && numId > 0 ? await deleteDesignRequestApi(numId) : false;
  } else if (track === "feasibility_check") {
    // Try feasibility table first, fallback to sample requests table
    success = await deleteFeasibilityRequestApi(idStr);
    if (!success) {
      success = await deleteSampleRequestApi(request.id);
    }
    if (!success && srNumber) {
      success = await deleteSampleRequestApi(srNumber);
    }
  } else if (track === "program_planning") {
    // Try program table first, fallback to sample requests table
    success = await deleteProgramRequestApi(idStr);
    if (!success) {
      success = await deleteSampleRequestApi(request.id);
    }
    if (!success && srNumber) {
      success = await deleteSampleRequestApi(srNumber);
    }
  } else {
    success = await deleteSampleRequestApi(request.id);
    if (!success && srNumber) {
      success = await deleteSampleRequestApi(srNumber);
    }
  }

  if (success && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return success;
}

export async function batchDeleteSampleRequestsApi(ids: (number | string)[]): Promise<boolean> {
  try {
    const results = await Promise.all(ids.map((id) => deleteSampleRequestApi(id)));
    return results.every(Boolean);
  } catch (err) {
    console.error("Error batch deleting sample requests:", err);
    return false;
  }
}

export async function batchDeleteAnyRequestsApi(requests: SampleRequestItem[]): Promise<boolean> {
  try {
    const results = await Promise.all(requests.map((req) => deleteAnyRequestApi(req)));
    return results.every(Boolean);
  } catch (err) {
    console.error("Error batch deleting requests:", err);
    return false;
  }
}
