import type { StagedProductItem, SampleTrack } from "../types/staging";
import type { SampleRequestItem } from "../types";

export type { SampleTrack };

export interface SampleTrackInfo {
  track: SampleTrack;
  label: string;
  badgeLabel: string;
  badgeClass: string;
  tagClass: string;
  description: string;
  isFullSample: boolean;
  sampleTypeBadge: {
    label: string;
    badgeClass: string;
    icon: string;
  };
}

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

/**
 * Determine the specific sample track based on business rules:
 * 1. resample: existing product picked from material/binding with zero spec changes, released as is
 * 2. design_change: cloned from action button (specs unchanged, creative fields emptied)
 * 3. new_sample: completely new sample from scratch
 * 4. normal_sample: existing product picked, but specifications were modified (creative fields emptied)
 */
export function getSampleTrack(item: Partial<StagedProductItem> | Partial<SampleRequestItem>): SampleTrack {
  const explicitTrack = (item as any).sampleTrack
    || (item as any).samplingMetadata?.sampleTrack
    || (item as any).workflowState?.sampleTrack
    || (item as any).mockupWorkflowState?.sampleTrack
    || (item as any).samplingRouting?.sampleTrack;

  if (explicitTrack === "resample" || explicitTrack === "design_change" || explicitTrack === "new_sample" || explicitTrack === "normal_sample") {
    return explicitTrack;
  }

  // 1. Cloned / Design Variant: Created by cloning an existing product via Action Button
  const isVariant = Boolean(
    (item as any).variantNumber ||
    (item as any).variantBaseDescription ||
    (item as any).isDesignVariant ||
    (item as any).workflowState?.isDesignVariant ||
    (item as any).mockupWorkflowState?.isDesignVariant ||
    String((item as any).productDescription || "").match(/\s+D\d+$/i)
  );

  const isExplicitlyNew =
    String((item as any).creationMode || (item as any).creation_mode || "").toLowerCase() === "new" ||
    (item as any).samplingMetadata?.searchMode === "new";

  const matCode = String((item as any).materialCode || (item as any).material_code || "").trim().toUpperCase();

  const hasExistingProduct = !isExplicitlyNew && Boolean(
    (item as any).sourceSampleCode ||
    (item as any).catalogMetadata?.sourceMaterialCode ||
    (item as any).samplingMetadata?.selectedMaterialCode ||
    ((item as any).creationMode && (item as any).creationMode !== "new") ||
    ((item as any).samplingMetadata?.searchMode && (item as any).samplingMetadata?.searchMode !== "new") ||
    (matCode && !matCode.startsWith("TMP-") && !matCode.startsWith("NEW-")) ||
    (item as any).sourceSampleRequestId ||
    (item as any).catalogMetadata?.sourceProductId ||
    (item as any).samplingMetadata?.sourceSampleId
  );

  // 2. Brand New Sample: created from scratch without existing catalog product
  if (isExplicitlyNew || !hasExistingProduct) {
    return "new_sample";
  }

  // 3. Design Change: cloned via action button
  if (isVariant) {
    return "design_change";
  }

  // 4. Normal Sample: existing product picked, but specifications modified
  const hasSpecChanges = Boolean(
    (item as any).hasCreativeChanges ||
    (item as any).creativeCharacteristicsCleared ||
    (item as any).hasCustomDetailsChanges ||
    ((item as any).creativePendingCharacteristicKeys && (item as any).creativePendingCharacteristicKeys.length > 0)
  );

  if (hasSpecChanges) {
    return "normal_sample";
  }

  // 5. Resample: existing product, zero changes
  return "resample";
}

export function getSampleTrackInfo(item: Partial<StagedProductItem> | Partial<SampleRequestItem>): SampleTrackInfo {
  const track = getSampleTrack(item);

  const rawSampleType =
    (item as any).samplingMetadata?.sampleType ||
    (item as any).sampleType ||
    ((item as any).productType === "Partial Sample" ? "partial" : "full");

  const isFullSample = rawSampleType !== "partial";

  let label = "Resample";
  let badgeLabel = "✓ Resample";
  let badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60";
  let tagClass = "text-emerald-700 dark:text-emerald-300";
  let description = "Direct repeat order without specification changes. Released straight to Plant.";

  if (track === "design_change") {
    label = "Design Change";
    badgeLabel = "🎨 Design Change";
    badgeClass = "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/60";
    tagClass = "text-purple-700 dark:text-purple-300";
    description = "Cloned product specifications. Creative artwork fields are cleared for new creative generation.";
  } else if (track === "new_sample") {
    label = "New Sample";
    badgeLabel = "✨ New Sample";
    badgeClass = "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800/60";
    tagClass = "text-blue-700 dark:text-blue-300";
    description = "Completely new product specifications created from scratch.";
  } else if (track === "normal_sample") {
    label = "Normal Sample";
    badgeLabel = "⚙️ Normal Sample";
    badgeClass = "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60";
    tagClass = "text-amber-700 dark:text-amber-300";
    description = "Existing product with modified specifications. Creative artwork fields reset for revised design.";
  }

  const sampleTypeBadge = isFullSample
    ? {
        label: "● Full Sample",
        badgeClass: "bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800/60 font-bold",
        icon: "●",
      }
    : {
        label: "◐ Partial Sample",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/60 font-bold",
        icon: "◐",
      };

  return {
    track,
    label,
    badgeLabel,
    badgeClass,
    tagClass,
    description,
    isFullSample,
    sampleTypeBadge,
  };
}
