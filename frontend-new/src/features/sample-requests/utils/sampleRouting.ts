import type { StagedProductItem } from "../types/staging";
import type { SampleRequestItem } from "../types";

export interface AutomaticSampleRoute {
  isResample: boolean;
  creativeChangesRequired: boolean;
  hasExistingProduct: boolean;
}

/** Decide the first handoff for a sample from its source and saved characteristic edits. */
export function getAutomaticSampleRoute(item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes">): AutomaticSampleRoute {
  const hasExistingProduct = Boolean(
    item.sourceSampleRequestId ||
    item.catalogMetadata?.sourceProductId ||
    item.samplingMetadata?.sourceSampleId
  );
  if (!item.scopes.includes("sample")) {
    return { isResample: false, creativeChangesRequired: false, hasExistingProduct };
  }

  const creativeChangesRequired = !hasExistingProduct || Boolean(
    item.hasCreativeChanges ||
    item.creativeCharacteristicsCleared ||
    item.creativePendingCharacteristicKeys?.length ||
    item.variantNumber
  );
  return {
    isResample: hasExistingProduct && !creativeChangesRequired,
    creativeChangesRequired,
    hasExistingProduct,
  };
}

/** Identify a sample request that bypasses Creative and Studio and is released to Plant. */
export function isDirectPlantResampleRequest(request: Partial<SampleRequestItem>): boolean {
  const state = {
    ...((request.workflowState || {}) as Record<string, any>),
    ...((request.mockupWorkflowState || {}) as Record<string, any>),
  };
  const routing = (state.samplingRouting || (request as any).samplingRouting || {}) as Record<string, any>;
  return Boolean(
    (request as any).isResample ||
    (request as any).is_resample ||
    state.isResample ||
    state.is_resample ||
    routing.isResample ||
    routing.is_resample ||
    String(request.creationMode || (request as any).creation_mode || "").toLowerCase() === "resample"
  );
}
