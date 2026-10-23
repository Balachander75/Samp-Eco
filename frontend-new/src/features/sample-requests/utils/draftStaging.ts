import type { SampleRequestItem } from "../types";
import type { DeliverableScopeId, StagedProductItem } from "../types/staging";
import { getPrimaryRequestCode, getRequestRequiredDate, getRequestTypes } from "../sampling/utils/requestTypeUtils";
import { getSampleTrack } from "./sampleRouting";

/** Restore a saved request as a complete staged product when reopening a draft. */
export function mapDraftItemToStagedProduct(item: SampleRequestItem): StagedProductItem {
  const scopes = getRequestTypes(item).filter((scope): scope is DeliverableScopeId =>
    ["design", "mockup", "sample", "costing"].includes(scope),
  );
  const state = item.mockupWorkflowState;
  const samplingRemarks =
    state?.samplingRouting?.partialRequirements || (item as any).remarks || item.marketingRemarks || item.descriptionNotes || "";
  const sourceCode = item.sourceSampleCode || (item as any).source_sample_code || "";
  const primaryRequestCode = getPrimaryRequestCode(item);
  const sampleTrack = getSampleTrack(item);
  const rawCreationMode = String(item.creationMode || "").toLowerCase();
  const creationMode: StagedProductItem["creationMode"] =
    rawCreationMode === "new" || rawCreationMode === "binding" || rawCreationMode === "material_code"
      ? rawCreationMode
      : item.materialCode?.toUpperCase().startsWith("NEW-") || item.materialCode?.toUpperCase().startsWith("TMP-")
        ? "new"
        : "material_code";
  const referenceImages = (item.referenceImages || []).map((url, index) => ({
    id: `reference-${item.id}-${index}`,
    url,
    name: item.referenceImageNames?.[index] || `Attachment ${index + 1}`,
  }));
  const scopeReferenceImages = Object.fromEntries(
    Object.entries(item.scopeReferenceImages || {}).map(([scope, images]) => [
      scope,
      (images || []).filter((image) => Boolean(image.url)).map((image, index) => ({
        id: String(image.id ?? `${scope}-${index}`),
        url: image.url!,
        name: image.name || `Attachment ${index + 1}`,
        originalSizeBytes: image.originalSizeBytes ?? undefined,
        size: image.sizeBytes ? String(image.sizeBytes) : undefined,
      })),
    ]),
  ) as StagedProductItem["scopeReferenceImages"];
  const mockupDesign = state?.designFollowups?.mockup?.designs?.[0];

  return {
    id: `draft-staged-${item.id}`,
    materialCode: item.materialCode || "",
    productDescription: item.productDescription || "",
    scopes,
    timestamp: item.createdAt || item.dateRequestCreated || "",
    stagedDate: item.dateRequestCreated || item.createdAt || "",
    creationMode,
    savedRequestId: item.id,
    savedSrNumber: primaryRequestCode,
    savedRequestCode: primaryRequestCode,
    savedRequestCodes: item.requestCodes as Record<string, string> | undefined,
    isDraftSaved: true,
    sourceSampleRequestId: item.sourceSampleRequestId,
    sourceSampleCode: sourceCode || undefined,
    sourceRequestCode: (item as any).sourceRequestCode || (item.sourceRequestId ? String(item.sourceRequestId) : undefined),
    customBinding1: (item as any).customBinding1 || (item as any).bindingType1,
    customBinding2: (item as any).customBinding2 || (item as any).bindingType2,
    customDetails: item.customDetails,
    plant: item.targetPlant,
    unitPcPack: item.unitPcPack != null ? String(item.unitPcPack) : undefined,
    qtyForSampling: item.qtyForSampling != null ? String(item.qtyForSampling) : undefined,
    qtyDesignCosting: item.qtyDesignCosting != null ? String(item.qtyDesignCosting) : undefined,
    qtyForMockup: item.qtyForMockup != null ? String(item.qtyForMockup) : undefined,
    qtyPerPack: item.qtyPerPack != null ? String(item.qtyPerPack) : undefined,
    brandName: item.brandName,
    customerProductCode: item.customerProductCode,
    barcode: item.barcode,
    productType: item.productType,
    productCategory: item.productCategory,
    productSubCategory: item.productSubCategory,
    productThirdCategory: item.productThirdCategory,
    sampleRequiredDate: getRequestRequiredDate(item, "sample"),
    mockupRequiredDate: getRequestRequiredDate(item, "mockup"),
    costingRequiredDate: getRequestRequiredDate(item, "costing"),
    requestTypeTimestamps: (item as any).requestTypeTimestamps || (item as any).request_type_timestamps,
    hasCreativeChanges: Boolean(state?.creativeChangesRequired || state?.samplingRouting?.creativeChangesRequired),
    creativePendingCharacteristicKeys: state?.creativePendingCharacteristicKeys || state?.samplingRouting?.creativePendingCharacteristicKeys || [],
    variantNumber: state?.samplingRouting?.variantNumber,
    sampleTrack,
    scopeReferenceImages,
    designMetadata: scopes.includes("design") ? {
      numberOfDesigns: Number(item.numberOfDesigns || item.designsCustomerCreative || item.productArtworkNos) || 1,
      designRequiredDate: item.designRequiredDate || item.targetArtworkDateCreative || "",
      trend: item.trend || "",
      targetAudience: item.targetAudience || "",
      remarks: item.designRemarks || samplingRemarks,
      images: referenceImages,
      webLinks: item.referenceLinks || [],
      referenceImage: item.productImagePath || item.referenceImage || referenceImages[0]?.url || "",
    } : undefined,
    mockupMetadata: scopes.includes("mockup") ? {
      designNeeded: state?.designNeeded ?? true,
      marketingShutterstockNo: state?.marketingShutterstockNo || "",
      marketingRemark: state?.marketingRemark || "",
      qtyForMockup: item.qtyForMockup != null ? String(item.qtyForMockup) : "1",
      requiredDate: getRequestRequiredDate(item, "mockup") || "",
      designArtwork: mockupDesign,
    } : undefined,
    samplingMetadata: scopes.includes("sample") ? {
      sampleType: item.productType === "Partial Sample" ? "partial" : "full",
      sampleTrack,
      isResample: state?.isResample || state?.samplingRouting?.isResample,
      partialRequirements: item.productType === "Partial Sample" ? samplingRemarks : undefined,
      searchMode: creationMode === "binding" ? "binding" : creationMode === "new" ? "new" : "material_code",
      sourceSampleId: item.sourceSampleRequestId,
      sourceSrNumber: sourceCode,
      selectedMaterialCode: item.materialCode || undefined,
      bindingType1: (item as any).customBinding1 || (item as any).bindingType1 || "",
      bindingType2: (item as any).customBinding2 || (item as any).bindingType2 || "",
      customerReference: item.customerProductCode || "",
      targetPlant: item.targetPlant || "",
    } : undefined,
  };
}
