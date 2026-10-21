import { apiFetch } from "./client";

export type RequestClosureType = "design" | "mockup" | "sample" | "costing" | "feasibility";

export interface RequestClosureRecord {
  id: number;
  request_type: RequestClosureType;
  request_id: number;
  request_code: string | null;
  closed_by_user_id: number | null;
  closed_by: string;
  closed_by_team: string | null;
  reason: string | null;
  closed_at: string | null;
}

interface RequestClosureResponse {
  closure: RequestClosureRecord | null;
}

export function fetchRequestClosureApi(
  requestType: RequestClosureType,
  requestId: number,
): Promise<RequestClosureRecord | null> {
  return apiFetch<RequestClosureResponse>(
    `/api/v1/request-closures/${requestType}/${requestId}`,
  ).then((result) => result.closure || null);
}

export function closeRequestApi(
  requestType: RequestClosureType,
  requestId: number,
  reason: string,
): Promise<RequestClosureRecord> {
  return apiFetch<RequestClosureResponse>("/api/v1/request-closures", {
    method: "POST",
    jsonBody: {
      request_type: requestType,
      request_id: requestId,
      reason,
    },
  }).then((result) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("samp:requests-changed"));
    if (!result.closure) throw new Error("The server did not return the closure record.");
    return result.closure;
  });
}
