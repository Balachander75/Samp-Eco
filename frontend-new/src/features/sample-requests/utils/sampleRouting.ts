import type { StagedProductItem } from "../types/staging";
import type { SampleRequestItem } from "../types";

export interface AutomaticSampleRoute {
  isResample: boolean;
  creativeChangesRequired: boolean;
  hasExistingProduct: boolean;
}

/** Decide the first handoff for a sample from its source and saved characteristic edits. */
export function getAutomaticSampleRoute(item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes">): AutomaticSampleRoute {
  const isExplicitlyNew = item.creationMode === "new" || item.samplingMetadata?.searchMode === "new";
  const matCode = String(item.materialCode || "").trim().toUpperCase();
  const hasExistingProduct = !isExplicitlyNew && Boolean(
    item.sourceSampleCode ||
    item.catalogMetadata?.sourceMaterialCode ||
    item.samplingMetadata?.selectedMaterialCode ||
    (item.creationMode && item.creationMode !== "new") ||
    (item.samplingMetadata?.searchMode && item.samplingMetadata?.searchMode !== "new") ||
    (matCode && !matCode.startsWith("TMP-") && !matCode.startsWith("NEW-")) ||
    item.sourceSampleRequestId ||
    item.catalogMetadata?.sourceProductId ||
    item.samplingMetadata?.sourceSampleId
  );
  if (!item.scopes.includes("sample")) {
    return { isResample: false, creativeChangesRequired: false, hasExistingProduct };
  }

  const creativeChangesRequired = Boolean(
    item.hasCreativeChanges ||
    item.creativeCharacteristicsCleared ||
    item.creativePendingCharacteristicKeys?.length ||
    item.variantNumber
  );
  return {
    // Only a standalone, unchanged Sampling request can skip straight to Plant.
    isResample: item.scopes.length === 1 && hasExistingProduct && !creativeChangesRequired,
    creativeChangesRequired,
    hasExistingProduct,
  };
}

/** Identify a sample request that bypasses Creative and Studio and is released to Plant. */
export function isDirectPlantResampleRequest(request: Partial<SampleRequestItem>): boolean {
  if (String(request.creationMode || (request as any).creation_mode || "").toLowerCase() === "new") {
    return false;
  }
  const rawScopes = request.requestTypes || (request as any).request_types || (request as any).scopes;
  const scopes = Array.isArray(rawScopes) ? rawScopes.map((scope) => String(scope).toLowerCase()) : [];
  if (scopes.length && (scopes.length !== 1 || scopes[0] !== "sample")) return false;

  const state = {
    ...((request.workflowState || {}) as Record<string, any>),
    ...((request.mockupWorkflowState || {}) as Record<string, any>),
  };
  const routing = (state.samplingRouting || (request as any).samplingRouting || {}) as Record<string, any>;
  const creativeChangesRequired = Boolean(
    (request as any).hasCreativeChanges ||
    (request as any).creativeCharacteristicsCleared ||
    (request as any).creativePendingCharacteristicKeys?.length ||
    state.creativeChangesRequired ||
    state.hasCreativeChanges ||
    state.creativeCharacteristicsCleared ||
    state.creativePendingCharacteristicKeys?.length ||
    state.isDesignVariant ||
    state.variantNumber ||
    routing.creativeChangesRequired ||
    routing.hasCreativeChanges ||
    routing.creativeCharacteristicsCleared ||
    routing.isDesignVariant ||
    routing.variantNumber ||
    routing.creativePendingCharacteristicKeys?.length
  );
  if (creativeChangesRequired) return false;

  const explicitResample = Boolean(
    (request as any).isResample ||
    (request as any).is_resample ||
    state.isResample ||
    state.is_resample ||
    routing.isResample ||
    routing.is_resample ||
    String(request.creationMode || (request as any).creation_mode || "").toLowerCase() === "resample"
  );
  if (explicitResample) return true;

  const route = getAutomaticSampleRoute({
    ...request,
    scopes: (scopes.length ? scopes : ["sample"]) as any,
  } as any);
  return route.isResample;
}
