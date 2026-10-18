import { apiFetch } from "./client";
import {
  SampleRequestItem,
  ProgramMaterialItem,
  ProgramRequestRecord,
  ProgramActivityItem,
  CreateProgramRequestPayload,
  AddProgramMaterialPayload,
  ProgramOutputPayload,
  ProgramSeenPayload,
  ProgramActivityReplyPayload,
} from "@/features/sample-requests/types";
import { getBusinessYearForDate } from "@/lib/businessYear";

export function mapProgramMaterial(item: Record<string, unknown>): ProgramMaterialItem {
  return {
    id: item.id != null ? Number(item.id) : undefined,
    materialType: typeof item.material_type === "string" ? item.material_type : undefined,
    supplierName: typeof item.supplier_name === "string" ? item.supplier_name : undefined,
    grade: typeof item.grade === "string" ? item.grade : undefined,
    colorVariant: typeof item.color_variant === "string" ? item.color_variant : undefined,
    caliperWt: typeof item.caliper_wt === "string" ? item.caliper_wt : undefined,
    quantity: item.quantity != null ? String(item.quantity) : undefined,
    unit: typeof item.unit === "string" && item.unit ? item.unit : undefined,
    remark: typeof item.remark === "string" ? item.remark : undefined,
    sampRemark: typeof item.samp_remark === "string" ? item.samp_remark : undefined,
    promotedSampleRequestId: item.promoted_sample_request_id != null ? Number(item.promoted_sample_request_id) : undefined,
    promotedSrNumber: typeof item.promoted_sr_number === "string" ? item.promoted_sr_number : undefined,
    createdAt: typeof item.created_at === "string" ? item.created_at : undefined,
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : undefined,
  };
}

export function mapProgramActivity(item: Record<string, unknown>): ProgramActivityItem {
  return {
    id: Number(item.id),
    programRequestId: Number(item.program_request_id),
    actorId: item.actor_id != null ? Number(item.actor_id) : undefined,
    actorName: String(item.actor_name || "System Operator"),
    actorDepartment: String(item.actor_department || "System"),
    action: String(item.action || "LOG"),
    payload: (typeof item.payload === "object" && item.payload !== null ? item.payload : {}) as Record<string, any>,
    createdAt: String(item.created_at || ""),
    pinnedByMarketing: Boolean(item.pinned_by_marketing),
    pinnedBy: typeof item.pinned_by === "string" ? item.pinned_by : null,
    pinnedAt: typeof item.pinned_at === "string" ? item.pinned_at : null,
  };
}

export function mapProgramResponse(item: Record<string, unknown>): ProgramRequestRecord {
  const rawMaterials = Array.isArray(item.materials) ? item.materials : [];
  const rawActivities = Array.isArray(item.activities) ? item.activities : [];
  return {
    id: Number(item.id),
    requestCode: String(item.request_code || ""),
    srNumber: String(item.sr_number || ""),
    customerName: String(item.customer_name || ""),
    targetPlant: String(item.target_plant || ""),
    programCampaignTitle: String(item.program_campaign_title || ""),
    programYear: String(item.program_year || "2026-2027"),
    status: String(item.status || "Pending SAMP Review"),
    isActive: item.is_active !== false,
    createdBy: typeof item.created_by === "string" ? item.created_by : null,
    samplingSeenAt: typeof item.sampling_seen_at === "string" ? item.sampling_seen_at : null,
    samplingSeenBy: typeof item.sampling_seen_by === "string" ? item.sampling_seen_by : null,
    samplingVerdict: typeof item.sampling_verdict === "string" ? item.sampling_verdict : null,
    samplingRemark: typeof item.sampling_remark === "string" ? item.sampling_remark : null,
    samplingSignedAt: typeof item.sampling_signed_at === "string" ? item.sampling_signed_at : null,
    samplingSignedBy: typeof item.sampling_signed_by === "string" ? item.sampling_signed_by : null,
    plantSeenAt: typeof item.plant_seen_at === "string" ? item.plant_seen_at : null,
    plantSeenBy: typeof item.plant_seen_by === "string" ? item.plant_seen_by : null,
    plantVerdict: typeof item.plant_verdict === "string" ? item.plant_verdict : null,
    plantRemark: typeof item.plant_remark === "string" ? item.plant_remark : null,
    plantSignedAt: typeof item.plant_signed_at === "string" ? item.plant_signed_at : null,
    plantSignedBy: typeof item.plant_signed_by === "string" ? item.plant_signed_by : null,
    samplingClaimedByUserId: item.sampling_claimed_by_user_id != null ? Number(item.sampling_claimed_by_user_id) : null,
    samplingClaimedBy: typeof item.sampling_claimed_by === "string" ? item.sampling_claimed_by : null,
    plantClaimedByUserId: item.plant_claimed_by_user_id != null ? Number(item.plant_claimed_by_user_id) : null,
    plantClaimedBy: typeof item.plant_claimed_by === "string" ? item.plant_claimed_by : null,
    createdAt: String(item.created_at || ""),
    updatedAt: String(item.updated_at || ""),
    materials: rawMaterials.map((m: any) => mapProgramMaterial(m)),
    activities: rawActivities.map((a: any) => mapProgramActivity(a)),
  };
}

export function mapProgramRequestToSampleRequest(record: ProgramRequestRecord): SampleRequestItem {
  const createdDate = record.createdAt ? record.createdAt.split("T")[0] : "";
  const matrixSummary =
    record.materials.length > 0
      ? "\n\nMaterial Specification Matrix:\n" +
        record.materials
          .map(
            (r, i) =>
              `#${i + 1} | Type: ${r.materialType || "—"} | Supplier: ${r.supplierName || "—"} | Grade: ${r.grade || "—"} | Color: ${r.colorVariant || "—"} | Caliper: ${r.caliperWt || "—"} | Qty: ${r.quantity || "—"} | Unit: ${r.unit || "—"} | Remark: ${r.remark || "—"}${r.sampRemark ? ` | SAMP Remark: ${r.sampRemark}` : ""}`
          )
          .join("\n")
      : "";

  return {
    id: `program-${record.id}`,
    requestCode: record.requestCode,
    srNumber: record.srNumber,
    materialCode: record.requestCode,
    customer: record.customerName,
    targetPlant: record.targetPlant,
    productDescription: `[Seasonal Program: ${record.programCampaignTitle}]\nProgram Year: ${record.programYear}\nTarget Plant: ${record.targetPlant}${matrixSummary}`,
    year: record.programYear && String(record.programYear).includes("-") ? String(record.programYear) : getBusinessYearForDate(createdDate),
    programYear: record.programYear,
    programName: record.programCampaignTitle,
    programCampaignTitle: record.programCampaignTitle,
    programMaterials: record.materials,
    activities: (record.activities || []) as any,
    status: record.status,
    isActive: record.isActive !== false,
    createdBy: record.createdBy || "Marketing Team",
    samplingSeenAt: record.samplingSeenAt,
    samplingSeenBy: record.samplingSeenBy,
    samplingVerdict: record.samplingVerdict,
    samplingRemark: record.samplingRemark,
    samplingSignedAt: record.samplingSignedAt,
    samplingSignedBy: record.samplingSignedBy,
    samplingClaimedByUserId: record.samplingClaimedByUserId,
    samplingClaimedBy: record.samplingClaimedBy,
    plantSeenAt: record.plantSeenAt,
    plantSeenBy: record.plantSeenBy,
    plantVerdict: record.plantVerdict,
    plantRemark: record.plantRemark,
    plantSignedAt: record.plantSignedAt,
    plantSignedBy: record.plantSignedBy,
    plantClaimedByUserId: record.plantClaimedByUserId,
    plantClaimedBy: record.plantClaimedBy,
    samplingFeasibilityResponse: record.samplingVerdict ? (record.samplingVerdict.toLowerCase().includes("feasible") ? "Yes" : record.samplingVerdict.toLowerCase().includes("not") ? "No" : "Maybe") : null,
    samplingFeasibilityRemark: record.samplingRemark,
    samplingFeasibilityApprovedBy: record.samplingSignedBy,
    plantFeasibilityResponse: record.plantVerdict ? (record.plantVerdict.toLowerCase().includes("feasible") || record.plantVerdict.toLowerCase().includes("confirmed") ? "Yes" : record.plantVerdict.toLowerCase().includes("not") ? "No" : "Maybe") : null,
    plantFeasibilityRemark: record.plantRemark,
    dateRequestCreated: createdDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    creationMode: "program_planning",
    requestKind: "program",
    requestTypes: [],
  };
}

function dispatchProgramRequestChanged(record: ProgramRequestRecord): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("samp:requests-changed", {
    detail: mapProgramRequestToSampleRequest(record),
  }));
}

export async function fetchProgramRequestsApi(year?: string): Promise<SampleRequestItem[]> {
  const query = year && year.toUpperCase() !== "ALL" ? `?year=${encodeURIComponent(year)}` : "";
  const data = await apiFetch<Record<string, unknown>[]>(`/api/v1/program-requests${query}`);
  return data.map((item) => mapProgramRequestToSampleRequest(mapProgramResponse(item)));
}

export async function fetchProgramRequestApi(requestId: number | string): Promise<SampleRequestItem> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(`/api/v1/program-requests/${Number(cleanId)}`);
  return mapProgramRequestToSampleRequest(mapProgramResponse(data));
}

export async function createProgramRequestApi(
  payload: CreateProgramRequestPayload
): Promise<ProgramRequestRecord> {
  const data = await apiFetch<Record<string, unknown>>("/api/v1/program-requests", {
    method: "POST",
    jsonBody: payload,
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function addProgramNoteApi(
  requestId: number | string,
  note: string
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/notes`,
    {
      method: "POST",
      jsonBody: { note },
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function updateSingleMaterialSampRemarkApi(
  requestId: number | string,
  materialId: number | string,
  sampRemark: string
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/materials/${materialId}/samp-remark`,
    {
      method: "PATCH",
      jsonBody: { samp_remark: sampRemark },
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function updateBatchProgramSampRemarksApi(
  requestId: number | string,
  remarks: Array<{ material_id: number; samp_remark: string }>
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/samp-remarks`,
    {
      method: "PUT",
      jsonBody: { remarks },
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function addProgramMaterialApi(
  requestId: number | string,
  payload: AddProgramMaterialPayload
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/materials`,
    {
      method: "POST",
      jsonBody: payload,
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function deleteProgramMaterialApi(
  requestId: number | string,
  materialId: number | string
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/materials/${materialId}`,
    {
      method: "DELETE",
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function deleteProgramRequestApi(requestId: number | string): Promise<boolean> {
  const cleanId = String(requestId).replace(/^program-/, "");
  try {
    await apiFetch(`/api/v1/program-requests/${cleanId}`, { method: "DELETE" });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    }
    return true;
  } catch (err) {
    console.error("Error deleting program request from DB:", err);
    return false;
  }
}

export async function updateProgramRequestStatusApi(
  requestId: number | string,
  status: string
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}`,
    {
      method: "PUT",
      jsonBody: { status },
    }
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return mapProgramResponse(data);
}

export async function submitProgramOutputApi(
  requestId: number | string,
  payload: ProgramOutputPayload
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/outputs`,
    {
      method: "POST",
      jsonBody: payload,
    }
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function pinProgramActivityApi(
  requestId: number | string,
  activityId: number,
  pinned: boolean,
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/activities/${activityId}/pin`,
    { method: "POST", jsonBody: { pinned } },
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function replyToProgramActivityApi(
  requestId: number | string,
  activityId: number,
  payload: ProgramActivityReplyPayload,
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/activities/${activityId}/reply`,
    { method: "POST", jsonBody: payload },
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function markProgramSeenApi(
  requestId: number | string,
  payload: ProgramSeenPayload
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/seen`,
    {
      method: "POST",
      jsonBody: payload,
    }
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function claimProgramTaskApi(
  requestId: number | string,
  department: "sampling" | "plant"
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/claim`,
    {
      method: "POST",
      jsonBody: { department },
    }
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function pauseProgramRequestApi(
  requestId: number | string,
  paused: boolean
): Promise<ProgramRequestRecord> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/pause`,
    {
      method: "POST",
      jsonBody: { paused },
    }
  );
  const record = mapProgramResponse(data);
  dispatchProgramRequestChanged(record);
  return record;
}

export async function promoteProgramSkuApi(
  requestId: number | string,
  materialId: number | string,
  requestTypes: string[] = ["sample"]
): Promise<{
  program: ProgramRequestRecord;
  sampleRequestId: number;
  sampleSrNumber: string;
  alreadyPromoted?: boolean;
}> {
  const cleanId = String(requestId).replace(/^program-/, "");
  const data = await apiFetch<Record<string, unknown>>(
    `/api/v1/program-requests/${cleanId}/materials/${materialId}/promote-to-sampling`,
    {
      method: "POST",
      jsonBody: { request_types: requestTypes },
    }
  );
  const record = mapProgramResponse(data.program as Record<string, unknown>);
  dispatchProgramRequestChanged(record);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("samp:requests-changed"));
  }
  return {
    program: record,
    sampleRequestId: Number(data.sample_request_id),
    sampleSrNumber: String(data.sample_sr_number || ""),
    alreadyPromoted: Boolean(data.already_promoted),
  };
}

