import { apiFetch } from "./client";

export interface RequestWorkflowLog {
  id: number;
  actor_name: string;
  actor_team: string;
  action: string;
  from_stage?: string | null;
  to_stage?: string | null;
  from_status?: string | null;
  to_status?: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface RequestWorkflowRecord {
  workflow_type: "costing" | "mockup" | "sample" | "design";
  workflow_id: number;
  sample_request_id: number;
  request_code: string;
  sr_number: string | null;
  customer: string;
  brand_name?: string | null;
  material_code: string;
  product_description: string;
  status: string;
  current_stage: string;
  request_types: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  created_by?: string | null;
  created_by_user_id?: number | null;
  request_data?: Record<string, unknown>;
  costing_creative_input_needed?: boolean;
  costing_creative_input_remark?: string | null;
  creative_due_at?: string | null;
  workflow_data?: Record<string, unknown>;
  costing_output_path?: string | null;
  costing_notes?: string | null;
  reviewer_status: string;
  reviewer_notes?: string | null;
  reviewer_name?: string | null;
  reviewed_at?: string | null;
  claimed_by?: string | null;
  claimed_by_user_id?: number | null;
  claimed_at?: string | null;
  is_claimed?: boolean;
  is_claimed_by_me?: boolean;
  marketing_decision?: string | null;
  is_closed?: boolean;
  closure?: any;
  logs: RequestWorkflowLog[];
}

export function fetchCostingWorkflowsApi(year?: string, stage?: string): Promise<RequestWorkflowRecord[]> {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (stage) params.set("stage", stage);
  const queryString = params.toString();
  const query = queryString ? `?${queryString}` : "";
  return apiFetch<RequestWorkflowRecord[]>(`/api/v1/workflows/costing${query}`);
}

export function fetchSamplingWorkflowReviewsApi(year?: string): Promise<RequestWorkflowRecord[]> {
  const query = year ? `?year=${encodeURIComponent(year)}` : "";
  return apiFetch<RequestWorkflowRecord[]>(`/api/v1/workflows/reviews${query}`);
}

export function submitCostingWorkflowApi(sampleRequestId: string | number): Promise<RequestWorkflowRecord> {
  return apiFetch<RequestWorkflowRecord>(`/api/v1/workflows/costing/${sampleRequestId}/submit`, {
    method: "POST",
    jsonBody: {},
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    return result;
  });
}

export function releaseCostingWorkflowApi(
  sampleRequestId: number,
  payload: {
    specifications: { className: string; characteristicName: string; value: string | null; uom?: string | null }[];
    note?: string;
  },
): Promise<RequestWorkflowRecord> {
  return apiFetch<RequestWorkflowRecord>(`/api/v1/workflows/costing/${sampleRequestId}/release-to-costing`, {
    method: "POST",
    jsonBody: {
      specifications: payload.specifications.map((item) => ({
        class_name: item.className,
        characteristic_name: item.characteristicName,
        value: item.value,
        uom: item.uom,
      })),
      note: payload.note,
    },
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    return result;
  });
}

export function completeCostingWorkflowApi(
  sampleRequestId: number,
  payload: { outputPath: string; notes?: string },
): Promise<RequestWorkflowRecord> {
  return apiFetch<RequestWorkflowRecord>(`/api/v1/workflows/costing/${sampleRequestId}/complete`, {
    method: "POST",
    jsonBody: { costing_output_path: payload.outputPath, notes: payload.notes },
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    return result;
  });
}

export function claimCostingWorkflowApi(sampleRequestId: number): Promise<RequestWorkflowRecord> {
  return apiFetch<RequestWorkflowRecord>(`/api/v1/workflows/costing/${sampleRequestId}/claim`, {
    method: "POST",
    jsonBody: {},
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    return result;
  });
}

export function reviewRequestWorkflowApi(
  type: RequestWorkflowRecord["workflow_type"],
  sampleRequestId: number,
  payload: { decision: "approve" | "return"; remark?: string },
): Promise<RequestWorkflowRecord> {
  return apiFetch<RequestWorkflowRecord>(`/api/v1/workflows/${type}/${sampleRequestId}/review`, {
    method: "POST",
    jsonBody: payload,
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    return result;
  });
}
