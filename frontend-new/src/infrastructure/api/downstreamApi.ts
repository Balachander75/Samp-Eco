import { apiFetch } from "./client";
import { DielineItem, CreativeBriefItem, CostingItem } from "@/features/sample-requests/types";

// ==========================================
// STUDIO DIELINES API
// ==========================================

export async function fetchStudioDielinesApi(): Promise<DielineItem[]> {
  try {
    const data = await apiFetch<DielineItem[]>("/api/v1/studio/dielines");
    return data || [];
  } catch (err) {
    console.error("fetchStudioDielinesApi error:", err);
    return [];
  }
}

export async function updateStudioDielineApi(
  id: string,
  payload: Partial<DielineItem>
): Promise<DielineItem | null> {
  try {
    return await apiFetch<DielineItem>(`/api/v1/studio/dielines/${id}`, {
      method: "PATCH",
      jsonBody: payload,
    });
  } catch (err) {
    console.error("updateStudioDielineApi error:", err);
    return null;
  }
}

// ==========================================
// CREATIVE BRIEFS API
// ==========================================

export async function fetchCreativeBriefsApi(): Promise<CreativeBriefItem[]> {
  try {
    const data = await apiFetch<CreativeBriefItem[]>("/api/v1/creative/briefs");
    return data || [];
  } catch (err) {
    console.error("fetchCreativeBriefsApi error:", err);
    return [];
  }
}

export async function updateCreativeBriefApi(
  id: string,
  payload: Partial<CreativeBriefItem>
): Promise<CreativeBriefItem | null> {
  try {
    return await apiFetch<CreativeBriefItem>(`/api/v1/creative/briefs/${id}`, {
      method: "PATCH",
      jsonBody: payload,
    });
  } catch (err) {
    console.error("updateCreativeBriefApi error:", err);
    return null;
  }
}

// ==========================================
// COSTING ESTIMATIONS API
// ==========================================

export async function fetchCostingEstimationsApi(): Promise<CostingItem[]> {
  try {
    const data = await apiFetch<CostingItem[]>("/api/v1/costing/estimations");
    return data || [];
  } catch (err) {
    console.error("fetchCostingEstimationsApi error:", err);
    return [];
  }
}

export async function updateCostingEstimationApi(
  id: string,
  payload: Partial<CostingItem>
): Promise<CostingItem | null> {
  try {
    return await apiFetch<CostingItem>(`/api/v1/costing/estimations/${id}`, {
      method: "PATCH",
      jsonBody: payload,
    });
  } catch (err) {
    console.error("updateCostingEstimationApi error:", err);
    return null;
  }
}
