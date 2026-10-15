import { apiFetch, API_BASE_URL, apiRawFetch } from "./client";
import {
  SampleRequestItem,
  FeasibilityRequestPayload,
  FeasibilityRequestRecord,
} from "@/features/sample-requests/types";
import { getBusinessYearForDate } from "@/lib/businessYear";

export function cleanFeasibilityDescription(text?: string | null): string {
  if (!text) return "—";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^\[[^\]]+\]\s*/, "");
  cleaned = cleaned.replace(/^(new_category|new_format|new_finish|new_accessories|bespoke|other|feasibility_check|feasibility):\s*/i, "");
  cleaned = cleaned.replace(/^(New Category|New Format|New Finish|New Accessories|Other Custom|Custom Evaluation):\s*/i, "");
  cleaned = cleaned.split(/Attached Images:|Reference Web Links:|Marketing Remarks:/i)[0].trim();
  return cleaned || "—";
}

export function mapFeasibilityResponse(item: Record<string, unknown>): FeasibilityRequestRecord {
  const rawActivities = Array.isArray(item.activities) ? item.activities : [];
  const activities = rawActivities.map((act: any) => ({
    id: Number(act.id),
    feasibilityRequestId: Number(act.feasibility_request_id || item.id),
    actorId: act.actor_id != null ? Number(act.actor_id) : null,
    actorName: String(act.actor_name || "Unknown"),
    actorDepartment: String(act.actor_department || "Operations"),
    action: String(act.action || "EVENT"),
    payload: act.payload && typeof act.payload === "object" ? act.payload : {},
    createdAt: String(act.created_at || ""),
  }));

  return {
    id: Number(item.id),
    requestCode: String(item.request_code || ""),
    customer: String(item.customer || ""),
    targetPlant: typeof item.target_plant === "string" ? item.target_plant : null,
    feasibilityType: String(item.feasibility_type || ""),
    customFeasibilityType: typeof item.custom_feasibility_type === "string" ? item.custom_feasibility_type : null,
    descriptionNotes: String(item.description_notes || ""),
    requiredDate: String(item.required_date || ""),
    marketingRemarks: typeof item.marketing_remarks === "string" ? item.marketing_remarks : null,
    referenceImages: Array.isArray(item.reference_images) ? (item.reference_images as string[]) : [],
    referenceImageNames: Array.isArray(item.reference_image_names) ? (item.reference_image_names as string[]) : [],
    referenceLinks: Array.isArray(item.reference_links) ? (item.reference_links as string[]) : [],
    createdBy: typeof item.created_by === "string" ? item.created_by : null,
    requestCreatedBy: typeof item.request_created_by === "string"
      ? item.request_created_by
      : typeof item.created_by === "string" ? item.created_by : null,
    status: String(item.status || "Pending Feasibility"),
    requestRaisedAt: String(item.request_raised_at || ""),
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : null,
    samplingFeasibilityResponse: (item.sampling_feasibility_response || null) as any,
    samplingFeasibilityRemark: typeof item.sampling_feasibility_remark === "string" ? item.sampling_feasibility_remark : null,
    feasibilityConditions: typeof item.feasibility_conditions === "string" ? item.feasibility_conditions : null,
    leadTimeNote: typeof item.lead_time_note === "string" ? item.lead_time_note : null,
    samplingFeasibilityApprovedBy: typeof item.sampling_feasibility_approved_by === "string" ? item.sampling_feasibility_approved_by : null,
    feasibilityClosedAt: typeof item.feasibility_closed_at === "string" ? item.feasibility_closed_at : null,
    feasibilityClosedBy: typeof item.feasibility_closed_by === "string" ? item.feasibility_closed_by : null,
    isRespondedOnTime: item.is_responded_on_time != null ? Boolean(item.is_responded_on_time) : null,
    sampCounterDate: typeof item.samp_counter_date === "string" ? item.samp_counter_date : null,
    sampCounterDateReason: typeof item.samp_counter_date_reason === "string" ? item.samp_counter_date_reason : null,
    sampCounterDateProposedAt: typeof item.samp_counter_date_proposed_at === "string" ? item.samp_counter_date_proposed_at : null,
    sampCounterDateProposedBy: typeof item.samp_counter_date_proposed_by === "string" ? item.samp_counter_date_proposed_by : null,
    counterDateDecision: (item.counter_date_decision || null) as any,
    counterDateDecisionAt: typeof item.counter_date_decision_at === "string" ? item.counter_date_decision_at : null,
    counterDateDecisionBy: typeof item.counter_date_decision_by === "string" ? item.counter_date_decision_by : null,
    counterDateDecisionRemark: typeof item.counter_date_decision_remark === "string" ? item.counter_date_decision_remark : null,
    counterDateDecisionDueAt: typeof item.counter_date_decision_due_at === "string" ? item.counter_date_decision_due_at : null,
    counterDateWaitWorkdays: item.counter_date_wait_workdays != null ? Number(item.counter_date_wait_workdays) : null,
    sampSlaPausedWorkdays: Number(item.samp_sla_paused_workdays || 0),
    marketingDecision: (item.marketing_decision || null) as any,
    marketingDecisionBy: typeof item.marketing_decision_by === "string" ? item.marketing_decision_by : null,
    marketingDecisionAt: typeof item.marketing_decision_at === "string" ? item.marketing_decision_at : null,
    marketingDecisionRemark: typeof item.marketing_decision_remark === "string" ? item.marketing_decision_remark : null,
    takenBySamp: typeof item.taken_by_samp === "string" ? item.taken_by_samp : null,
    takenBySampUserId: item.taken_by_samp_user_id != null ? Number(item.taken_by_samp_user_id) : null,
    takenAtSamp: typeof item.taken_at_samp === "string" ? item.taken_at_samp : null,
    convertedSampleRequestId: item.converted_sample_request_id != null ? Number(item.converted_sample_request_id) : null,
    convertedSrNumber: typeof item.converted_sr_number === "string" ? item.converted_sr_number : null,
    convertedRequestTypes: Array.isArray(item.converted_request_types)
      ? item.converted_request_types.filter((value): value is "sample" | "costing" => value === "sample" || value === "costing")
      : [],
    convertedAt: typeof item.converted_at === "string" ? item.converted_at : null,
    convertedBy: typeof item.converted_by === "string" ? item.converted_by : null,
    activities,
  };
}

export function mapFeasibilityRequestToSampleRequest(item: FeasibilityRequestRecord): SampleRequestItem {
  const createdAt = item.requestRaisedAt || "";
  const description = item.customFeasibilityType || item.feasibilityType;
  const cleanDesc = cleanFeasibilityDescription(item.descriptionNotes);
  const rawNotes = item.descriptionNotes || "";
  const extractedLinks: string[] = [];
  if (rawNotes) {
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = urlRegex.exec(rawNotes)) !== null) {
      const found = match[1].trim();
      if (found && !extractedLinks.includes(found)) extractedLinks.push(found);
    }
  }
  const finalReferenceLinks = Array.from(new Set([...(item.referenceLinks || []), ...extractedLinks]));

  return {
    id: `feasibility-${item.id}`,
    srNumber: "",
    year: getBusinessYearForDate(createdAt),
    productDescription: cleanDesc,
    customer: item.customer,
    targetPlant: item.targetPlant || "",
    dateRequestCreated: createdAt ? createdAt.split("T")[0] : "",
    createdBy: item.createdBy || "",
    requestCreatedBy: item.requestCreatedBy || item.createdBy || "",
    createdByUserId: item.createdByUserId || null,
    materialCode: item.requestCode,
    sampleRequiredDate: item.requiredDate,
    status: item.status,
    creationMode: "feasibility_check",
    programName: description,
    programYear: createdAt ? createdAt.slice(0, 4) : "",
    requestTypes: item.convertedRequestTypes || [],
    requestKind: "feasibility",
    createdAt,
    productImagePath: item.referenceImages?.[0] || undefined,
    referenceImage: item.referenceImages?.[0] || null,
    referenceImages: item.referenceImages || [],
    referenceImageNames: item.referenceImageNames || [],
    referenceLinks: finalReferenceLinks,
    descriptionNotes: item.descriptionNotes,
    feasibilityType: item.feasibilityType,
    customFeasibilityType: item.customFeasibilityType,
    feasibilityDescription: cleanDesc,
    marketingRemarks: item.marketingRemarks,
    samplingFeasibilityResponse: item.samplingFeasibilityResponse,
    samplingFeasibilityRemark: item.samplingFeasibilityRemark,
    feasibilityConditions: item.feasibilityConditions,
    leadTimeNote: item.leadTimeNote,
    samplingFeasibilityApprovedBy: item.samplingFeasibilityApprovedBy,
    feasibilityClosedAt: item.feasibilityClosedAt,
    feasibilityClosedBy: item.feasibilityClosedBy as any,
    isRespondedOnTime: item.isRespondedOnTime,
    sampCounterDate: item.sampCounterDate,
    sampCounterDateReason: item.sampCounterDateReason,
    sampCounterDateProposedAt: item.sampCounterDateProposedAt,
    sampCounterDateProposedBy: item.sampCounterDateProposedBy,
    counterDateDecision: item.counterDateDecision,
    counterDateDecisionAt: item.counterDateDecisionAt,
    counterDateDecisionBy: item.counterDateDecisionBy,
    counterDateDecisionRemark: item.counterDateDecisionRemark,
    counterDateDecisionDueAt: item.counterDateDecisionDueAt,
    counterDateWaitWorkdays: item.counterDateWaitWorkdays,
    sampSlaPausedWorkdays: item.sampSlaPausedWorkdays,
    marketingDecision: item.marketingDecision,
    marketingDecisionBy: item.marketingDecisionBy,
    marketingDecisionAt: item.marketingDecisionAt,
    marketingDecisionRemark: item.marketingDecisionRemark,
    takenBySamp: item.takenBySamp,
    takenAtSamp: item.takenAtSamp,
    convertedSampleRequestId: item.convertedSampleRequestId,
    convertedSrNumber: item.convertedSrNumber,
    convertedRequestTypes: item.convertedRequestTypes,
    convertedAt: item.convertedAt,
    convertedBy: item.convertedBy,
    activities: (item.activities || []) as any,
  };
}

export async function fetchFeasibilityRequestsApi(
  options?: string | { year?: string; status?: string }
): Promise<SampleRequestItem[]> {
  const year = typeof options === "string" ? options : options?.year;
  const status = typeof options === "object" ? options?.status : undefined;
  const searchParams = new URLSearchParams();
  if (year && year.toUpperCase() !== "ALL") searchParams.set("year", year);
  if (status && status.toUpperCase() !== "ALL") searchParams.set("status", status);
  const queryString = searchParams.toString();
  const query = queryString ? `?${queryString}` : "";
  const data = await apiFetch<Record<string, unknown>[]>(`/api/v1/feasibility-requests${query}`);
  return data.map((item) => mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(item)));
}

export async function fetchFeasibilityRequestApi(id: number | string): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}`);
  return mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
}

export async function createFeasibilityRequestApi(
  payload: FeasibilityRequestPayload
): Promise<FeasibilityRequestRecord> {
  const data = await apiFetch<Record<string, unknown>>("/api/v1/feasibility-requests", {
    method: "POST",
    jsonBody: {
      customer: payload.customer,
      feasibility_type: payload.feasibilityType,
      custom_feasibility_type: payload.customFeasibilityType ? payload.customFeasibilityType.trim().slice(0, 25) : null,
      description_notes: (payload.descriptionNotes || "").trim().slice(0, 75),
      required_date: payload.requiredDate,
      target_plant: payload.targetPlant || null,
      marketing_remarks: payload.marketingRemarks ? payload.marketingRemarks.trim().slice(0, 100) : null,
      reference_images: payload.referenceImages || [],
      reference_image_names: payload.referenceImageNames || [],
      reference_links: payload.referenceLinks || [],
    },
  });

  const result = mapFeasibilityResponse(data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return result;
}

export async function fetchFeasibilityImageObjectUrl(url: string): Promise<string> {
  const targetUrl = /^(?:https?:|data:|blob:)/i.test(url) ? url : `${API_BASE_URL}${url}`;
  const response = await apiRawFetch(targetUrl);
  if (!response.ok) throw new Error(`Failed to load reference image: ${response.statusText}`);
  return URL.createObjectURL(await response.blob());
}

export async function recordFeasibilitySampVerdictApi(
  id: number | string,
  payload: {
    response: "Yes" | "No" | "Maybe";
    remark?: string | null;
    conditions?: string | null;
    lead_time_note?: string | null;
  }
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/samp-verdict`, {
    method: "PUT",
    jsonBody: payload,
  });
  return mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
}

export async function recordFeasibilityMarketingDecisionApi(
  id: number | string,
  payload: {
    decision: "Accepted" | "Rejected";
    decision_remark?: string | null;
  }
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/marketing-decision`, {
    method: "POST",
    jsonBody: payload,
  });
  return mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
}

export async function proposeFeasibilityCounterDateApi(
  id: number | string,
  proposedDate: string,
  reason: string
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/counter-date`, {
    method: "POST",
    jsonBody: { proposed_date: proposedDate, reason },
  });
  return mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
}

export async function decideFeasibilityCounterDateApi(
  id: number | string,
  decision: "accepted" | "rejected",
  decisionRemark?: string
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/counter-date-decision`, {
    method: "POST",
    jsonBody: { decision, decision_remark: decisionRemark || null },
  });
  return mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
}

export async function claimFeasibilityTaskApi(
  id: number | string
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/claim`, {
    method: "POST",
  });
  const result = mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return result;
}

export async function convertFeasibilityToSamplingApi(
  id: number | string,
  requestTypes: Array<"sample" | "costing"> = ["sample"]
): Promise<{ feasibility: SampleRequestItem; sampleRequestId: number; sampleSrNumber: string; requestTypes: Array<"sample" | "costing"> }> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<{ feasibility: Record<string, unknown>; sample_request_id: number; sample_sr_number: string; request_types: Array<"sample" | "costing"> }>(
    `/api/v1/feasibility-requests/${Number(rawId)}/convert-to-sampling`,
    {
      method: "POST",
      jsonBody: { request_types: requestTypes },
    }
  );
  const feasibility = mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data.feasibility));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return {
    feasibility,
    sampleRequestId: data.sample_request_id,
    sampleSrNumber: data.sample_sr_number,
    requestTypes: data.request_types || requestTypes,
  };
}

export async function addFeasibilityNoteApi(
  id: number | string,
  note: string
): Promise<SampleRequestItem> {
  const rawId = String(id).replace(/^feasibility-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/feasibility-requests/${Number(rawId)}/notes`, {
    method: "POST",
    jsonBody: { note },
  });
  const result = mapFeasibilityRequestToSampleRequest(mapFeasibilityResponse(data));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return result;
}

export async function recordFeasibilityViewedApi(
  id: number | string
): Promise<void> {
  try {
    const rawId = String(id).replace(/^feasibility-/, "");
    await apiFetch(`/api/v1/feasibility-requests/${Number(rawId)}/viewed`, {
      method: "POST",
    });
  } catch (err) {
    console.debug("Telemetry view tracking skipped:", err);
  }
}

export async function deleteFeasibilityRequestApi(requestId: number | string): Promise<boolean> {
  const cleanId = String(requestId).replace(/^feasibility-/, "");
  try {
    await apiFetch(`/api/v1/feasibility-requests/${cleanId}`, { method: "DELETE" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return true;
  } catch (err) {
    console.error("Error deleting feasibility request:", err);
    throw err;
  }
}
