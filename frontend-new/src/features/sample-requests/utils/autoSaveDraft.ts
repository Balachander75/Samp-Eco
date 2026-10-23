import { StagedProductItem } from "../types/staging";
import {
  createSampleRequestApi,
  updateSampleRequestApi,
} from "@/infrastructure/api";
import { CreateSampleRequestForm } from "../types";
import { apiRawFetch } from "@/infrastructure/api/client";
import { UserProfile } from "@/features/auth";
import { getBusinessYearForDate } from "@/lib/businessYear";
import { getAutomaticSampleRoute } from "./sampleRouting";
import { convertFeasibilityToSamplingApi } from "@/infrastructure/api/feasibilityApi";

export interface ProgramContextData {
  customer?: string;
  programName?: string;
  programYear?: string;
  year?: string;
  targetPlant?: string;
  parentRequestId?: string | number;
  parentSrNumber?: string;
  feasibilityRequestId?: number | string;
  feasibilityRequestType?: "sample" | "mockup" | "costing";
  feasibilityRequestTypes?: Array<"sample" | "mockup" | "costing">;
  feasibilityRequestCode?: string;
  feasibilityDescription?: string;
  feasibilityRequiredDate?: string;
  feasibilityReferenceLinks?: string[];
}

export interface AutoSaveResult {
  success: boolean;
  count: number;
  customer: string;
  programName: string;
  requestId?: string | number;
  srNumber?: string;
  savedIds?: Array<string | number>;
  error?: string;
}

function draftKeyFor(item: StagedProductItem, user?: UserProfile | null): string {
  const owner = String(user?.userid || user?.name || "marketing").trim().slice(0, 60);
  return `samp-draft:${owner}:${item.id}`.slice(0, 160);
}

function isSampleRequestNotFoundError(error: unknown): boolean {
  return error instanceof Error && /sample request not found/i.test(error.message);
}

async function linkStagedFeasibilityRequest(
  items: StagedProductItem[],
  context?: ProgramContextData | null,
): Promise<void> {
  if (!context?.feasibilityRequestId) return;
  const types = (context.feasibilityRequestTypes && context.feasibilityRequestTypes.length > 0)
    ? context.feasibilityRequestTypes
    : context.feasibilityRequestType
    ? [context.feasibilityRequestType]
    : undefined;
  if (!types || types.length === 0) return;
  const stagedRequestId = items[0]?.savedRequestId;
  if (!stagedRequestId) throw new Error("The staged product was saved, but its request ID was not returned for feasibility linking.");
  await convertFeasibilityToSamplingApi(
    context.feasibilityRequestId,
    types,
    stagedRequestId,
  );
}

/**
 * Automatically persists staged products directly into the Draft queue (status: "Draft (Pre-SMT)").
 * Uses the atomic batch endpoint if available, with resilient fallback to individual creation.
 */
export async function autoSaveStagedProductsToDraft(
  items: StagedProductItem[],
  programContext?: ProgramContextData | null,
  user?: UserProfile | null
): Promise<AutoSaveResult> {
  const validItems = (items || []).filter((item) => Boolean(item.productDescription && item.productDescription.trim()));
  if (validItems.length === 0) {
    return { success: false, count: 0, customer: "", programName: "" };
  }

  const customer = programContext?.customer?.trim() || "";
  const programName = programContext?.programName?.trim() || "";
  const rawYear = programContext?.programYear || "";
  const programYear = String(rawYear).replace(/BTS/gi, "").trim();
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const year = (programContext?.year && programContext.year.includes("-"))
    ? programContext.year
    : getBusinessYearForDate(dateStr);
  const targetPlant = programContext?.targetPlant?.trim() || "";
  const createdBy = user?.name || user?.userid || "";

  if (!programContext?.parentRequestId) {
    try {
      const batchPayload = {
        customer,
        program_name: programName,
        program_year: programYear,
        year,
        target_plant: targetPlant,
        created_by: createdBy,
        date_request_created: dateStr,
        items: validItems.map((prod) => ({
          product_description: prod.productDescription,
          material_code: prod.materialCode,
          source_request_code: prod.sourceRequestCode || null,
          source_sample_request_id:
            prod.sourceSampleRequestId ||
            prod.catalogMetadata?.sourceProductId ||
            prod.samplingMetadata?.sourceSampleId ||
            null,
          source_sample_code:
            prod.sourceSampleCode ||
            prod.samplingMetadata?.sourceSrNumber ||
            prod.samplingMetadata?.selectedMaterialCode ||
            prod.catalogMetadata?.sourceMaterialCode ||
            (prod.creationMode !== "new" && prod.materialCode && !prod.materialCode.startsWith("TMP-") && !prod.materialCode.startsWith("NEW-") ? prod.materialCode : null),
          creation_mode:
            prod.creationMode ||
            (prod.samplingMetadata?.searchMode === "binding" ? "binding" : "material_code"),
          request_types: prod.scopes,
          request_type_timestamps: prod.requestTypeTimestamps || null,
          custom_binding_1:
            prod.customBinding1 ||
            prod.samplingMetadata?.bindingType1 ||
            prod.catalogMetadata?.bindingType1 ||
            null,
          custom_binding_2:
            prod.customBinding2 ||
            prod.samplingMetadata?.bindingType2 ||
            prod.catalogMetadata?.bindingType2 ||
            null,
          custom_details: prod.customDetails || null,
          mockup_required: prod.scopes.includes("mockup") ? "Yes" : null,
          mockup_workflow_state: prod.scopes.includes("mockup") ? {
            stage: "marketing",
            designNeeded: prod.mockupMetadata?.designNeeded ?? (prod.creationMode === "new" || prod.scopes.includes("design")),
            creativeChangesRequired: (prod.scopes.includes("sample") && getAutomaticSampleRoute(prod).creativeChangesRequired) || Boolean(prod.hasCreativeChanges || prod.creativeCharacteristicsCleared || prod.creativePendingCharacteristicKeys?.length),
            marketingShutterstockNo: prod.mockupMetadata?.marketingShutterstockNo || "",
            marketingRemark: prod.mockupMetadata?.marketingRemark || "",
            qtyForMockup: prod.qtyForMockup || prod.mockupMetadata?.qtyForMockup || "1",
            requiredDate: prod.mockupMetadata?.requiredDate || prod.mockupRequiredDate || "",
            creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
            events: [],
            ...(prod.mockupMetadata?.designArtwork ? {
              designFollowups: {
                mockup: {
                  designs: [prod.mockupMetadata.designArtwork],
                  requestedAt: new Date().toISOString(),
                },
              },
            } : {}),
            isResample: getAutomaticSampleRoute(prod).isResample,
            ...(prod.scopes.includes("sample") ? {
              samplingRouting: {
                stage: "marketing",
                sampleTrack: prod.sampleTrack || prod.samplingMetadata?.sampleTrack,
                sampleType: prod.samplingMetadata?.sampleType || (String(prod.productType || "").toLowerCase().includes("partial") ? "partial" : "full"),
                partialRequirements: prod.samplingMetadata?.partialRequirements || "",
                isResample: getAutomaticSampleRoute(prod).isResample,
                creativeChangesRequired: getAutomaticSampleRoute(prod).creativeChangesRequired,
                isDesignVariant: Boolean(prod.variantNumber),
                variantNumber: prod.variantNumber,
                creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
              },
            } : {}),
          } : prod.scopes.includes("sample") ? {
            isResample: getAutomaticSampleRoute(prod).isResample,
            samplingRouting: {
              stage: "marketing",
              sampleTrack: prod.sampleTrack || prod.samplingMetadata?.sampleTrack,
              sampleType: prod.samplingMetadata?.sampleType || (String(prod.productType || "").toLowerCase().includes("partial") ? "partial" : "full"),
              partialRequirements: prod.samplingMetadata?.partialRequirements || "",
              isResample: getAutomaticSampleRoute(prod).isResample,
              creativeChangesRequired: getAutomaticSampleRoute(prod).creativeChangesRequired,
              isDesignVariant: Boolean(prod.variantNumber),
              variantNumber: prod.variantNumber,
              creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
            },
          } : {},
          status: "Draft (Pre-SMT)",
          client_draft_key: draftKeyFor(prod, user),
          target_plant: prod.plant || targetPlant,
          unit_pc_pack: prod.unitPcPack || null,
          qty_per_pack: prod.qtyPerPack || null,
          qty_for_sampling: prod.qtyForSampling || null,
          qty_design_costing: prod.qtyDesignCosting || null,
          costing_required_date: prod.costingRequiredDate || null,
          costing_creative_input_needed: prod.costingCreativeInputNeeded === true,
          costing_creative_input_remark: prod.costingCreativeInputNeeded ? prod.costingCreativeInputRemark?.trim() || null : null,
          customer_product_code: prod.customerProductCode || null,
          barcode: prod.barcode || null,
          brand_name: prod.brandName || null,
          product_type: prod.productType || (prod.samplingMetadata ? (prod.samplingMetadata.sampleType === "full" ? "Full Sample" : "Partial Sample") : null),
          product_category: prod.productCategory || null,
          product_sub_category: prod.productSubCategory || null,
          product_third_category: prod.productThirdCategory || null,
          number_of_designs: prod.designMetadata?.numberOfDesigns || 1,
          product_artwork_nos: prod.designMetadata?.numberOfDesigns ? String(prod.designMetadata.numberOfDesigns) : null,
          designs_customer_creative: prod.designMetadata?.numberOfDesigns ? String(prod.designMetadata.numberOfDesigns) : null,
          sample_required_date: prod.sampleRequiredDate || prod.designMetadata?.designRequiredDate || null,
          target_artwork_date_creative: prod.designMetadata?.designRequiredDate || null,
          trend: prod.designMetadata?.trend || null,
          target_audience: prod.designMetadata?.targetAudience || null,
          product_image_path: prod.designMetadata?.referenceImage || null,
          reference_images: prod.designMetadata?.images?.map((img) => img.url) || [],
          reference_links: Array.from(new Set([
            ...(prod.designMetadata?.webLinks || []),
            ...(programContext?.feasibilityReferenceLinks || []),
          ])),
          scope_reference_images: Object.fromEntries(
            Object.entries(prod.scopeReferenceImages || {}).map(([scope, images]) => [
              scope,
              (images || []).map((image) => ({ url: image.url, name: image.name, original_size_bytes: image.originalSizeBytes })),
            ]),
          ),
          remarks:
            prod.designMetadata?.remarks ||
            (prod.samplingMetadata?.partialRequirements
              ? `[Partial Scope]: ${prod.samplingMetadata.partialRequirements}`
              : null),
        })),
      };

      const res = await apiRawFetch("/api/v1/sample-requests/batch", {
        method: "POST",
        jsonBody: batchPayload,
      });

      if (res.ok) {
        let firstId: string | number | undefined;
        let firstSr: string | undefined;
        const savedIds: Array<string | number> = [];
        try {
          const data = await res.json();
          const resultsList = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : null;
          if (resultsList && resultsList.length === validItems.length) {
            resultsList.forEach((saved: any, index: number) => {
              const id = saved?.id;
              const rawCodes = saved?.request_codes || saved?.requestCodes;
              const firstCode = rawCodes && typeof rawCodes === 'object' ? Object.values(rawCodes)[0] : undefined;
              const sr = saved?.sr_number || saved?.srNumber || saved?.request_code || saved?.requestCode || (typeof firstCode === 'string' ? firstCode : undefined);
              if (id !== undefined && id !== null) {
                if (firstId === undefined) {
                  firstId = id;
                  firstSr = sr;
                }
                savedIds.push(id);
                if (validItems[index]) {
                  validItems[index].savedRequestId = id;
                  validItems[index].savedSrNumber = sr;
                  validItems[index].savedRequestCode = sr;
                  validItems[index].isDraftSaved = true;
                }
                if (items[index]) {
                  items[index].savedRequestId = id;
                  items[index].savedSrNumber = sr;
                  items[index].savedRequestCode = sr;
                  items[index].isDraftSaved = true;
                }
              }
            });
          }
        } catch {
          // ignore
        }
        if (firstId !== undefined && savedIds.length === validItems.length && validItems.every((item) => item.savedRequestId !== undefined)) {
          try {
            await linkStagedFeasibilityRequest(validItems, programContext);
          } catch (err) {
            return {
              success: false,
              count: validItems.length,
              customer,
              programName,
              requestId: firstId,
              srNumber: firstSr,
              savedIds,
              error: `Draft saved, but it could not be linked to feasibility: ${err instanceof Error ? err.message : "Please retry."}`,
            };
          }
          return { success: true, count: validItems.length, customer, programName, requestId: firstId, srNumber: firstSr, savedIds };
        }
      } else if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 405) {
        let message = "The draft details were rejected. Check the required fields and try again.";
        try {
          const body = await res.json();
          if (typeof body?.detail === "string") message = body.detail;
          else if (Array.isArray(body?.detail)) message = body.detail.map((item: any) => item.msg).filter(Boolean).join("; ") || message;
        } catch {
          // Keep fallback
        }
        return { success: false, count: 0, customer, programName, error: message };
      }
    } catch (err) {
      console.warn("Batch draft save endpoint fallback:", err);
    }
  }

  // Fallback to individual item creation
  let savedCount = 0;
  let firstSavedId: string | number | undefined = programContext?.parentRequestId;
  let firstSavedSr: string | undefined = programContext?.parentSrNumber;

  for (const [index, prod] of validItems.entries()) {
    const payload: CreateSampleRequestForm = {
      customer,
      programName,
      programYear,
      year,
      targetPlant,
      productDescription: prod.productDescription,
      materialCode: prod.materialCode,
      sourceRequestCode: prod.sourceRequestCode,
      barcode: prod.barcode || "",
      customerProductCode: prod.customerProductCode || "",
      sampleRequiredDate: prod.sampleRequiredDate || prod.designMetadata?.designRequiredDate,
      dateRequestCreated: dateStr,
      createdBy,
      status: "Draft (Pre-SMT)",
      creationMode: prod.creationMode || "marketing_request",
      requestTypes: prod.scopes,
      productArtworkNos: prod.designMetadata?.numberOfDesigns ? String(prod.designMetadata.numberOfDesigns) : undefined,
      designsCustomerCreative: prod.designMetadata?.numberOfDesigns ? String(prod.designMetadata.numberOfDesigns) : undefined,
      targetArtworkDateCreative: prod.designMetadata?.designRequiredDate,
      clientDraftKey: draftKeyFor(prod, user),
      productImagePath: prod.designMetadata?.referenceImage || undefined,
      referenceImages: prod.designMetadata?.images?.map((img) => img.url) || [],
      referenceLinks: Array.from(new Set([
        ...(prod.designMetadata?.webLinks || []),
        ...(programContext?.feasibilityReferenceLinks || []),
      ])),
      scopeReferenceImages: Object.fromEntries(
        Object.entries(prod.scopeReferenceImages || {}).map(([scope, images]) => [
          scope,
          (images || []).map((image) => ({ url: image.url, name: image.name, originalSizeBytes: image.originalSizeBytes })),
        ]),
      ),
      trend: prod.designMetadata?.trend || undefined,
      targetAudience: prod.designMetadata?.targetAudience || undefined,
      numberOfDesigns: prod.designMetadata?.numberOfDesigns || 1,
      designRemarks: prod.designMetadata?.remarks || undefined,
      sourceSampleCode:
        prod.sourceSampleCode ||
        prod.samplingMetadata?.sourceSrNumber ||
        prod.samplingMetadata?.selectedMaterialCode ||
        prod.catalogMetadata?.sourceMaterialCode ||
        (prod.creationMode !== "new" && prod.materialCode && !prod.materialCode.startsWith("TMP-") && !prod.materialCode.startsWith("NEW-") ? prod.materialCode : undefined),
      sourceSampleRequestId:
        prod.sourceSampleRequestId || prod.catalogMetadata?.sourceProductId || prod.samplingMetadata?.sourceSampleId,
      requestTypeSelectedAt: prod.requestTypeTimestamps,
      customDetails: prod.customDetails?.map((detail) => ({
        className: detail.className || detail.class_name || "Product",
        characteristicName: detail.characteristicName || detail.characteristic_name || "",
        value: detail.value,
        uom: detail.uom || null,
      })).filter((detail) => detail.characteristicName) || undefined,
      customBinding1: prod.samplingMetadata?.bindingType1 || prod.catalogMetadata?.bindingType1,
      customBinding2: prod.samplingMetadata?.bindingType2 || prod.catalogMetadata?.bindingType2,
      mockupRequired: prod.scopes.includes("mockup") ? "Yes" : undefined,
      productType: prod.productType || (prod.samplingMetadata?.sampleType === "partial" ? "Partial Sample" : prod.scopes.includes("sample") ? "Full Sample" : undefined),
      mockupWorkflowState: prod.scopes.includes("mockup") ? {
        stage: "marketing",
        isResample: getAutomaticSampleRoute(prod).isResample,
        designNeeded: prod.mockupMetadata?.designNeeded ?? (prod.creationMode === "new" || prod.scopes.includes("design")),
        creativeChangesRequired: (prod.scopes.includes("sample") && getAutomaticSampleRoute(prod).creativeChangesRequired) || Boolean(prod.hasCreativeChanges || prod.creativeCharacteristicsCleared || prod.creativePendingCharacteristicKeys?.length),
        marketingShutterstockNo: prod.mockupMetadata?.marketingShutterstockNo || "",
        marketingRemark: prod.mockupMetadata?.marketingRemark || "",
        qtyForMockup: prod.qtyForMockup || prod.mockupMetadata?.qtyForMockup || "1",
        requiredDate: prod.mockupMetadata?.requiredDate || prod.mockupRequiredDate || "",
        creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
        events: [],
        ...(prod.mockupMetadata?.designArtwork ? {
          designFollowups: {
            mockup: {
              designs: [prod.mockupMetadata.designArtwork],
              requestedAt: new Date().toISOString(),
            },
          },
        } : {}),
        ...(prod.scopes.includes("sample") ? {
          samplingRouting: {
            stage: "marketing",
            sampleTrack: prod.sampleTrack || prod.samplingMetadata?.sampleTrack,
            sampleType: prod.samplingMetadata?.sampleType || (String(prod.productType || "").toLowerCase().includes("partial") ? "partial" : "full"),
            partialRequirements: prod.samplingMetadata?.partialRequirements || "",
            isResample: getAutomaticSampleRoute(prod).isResample,
            creativeChangesRequired: getAutomaticSampleRoute(prod).creativeChangesRequired,
            isDesignVariant: Boolean(prod.variantNumber),
            variantNumber: prod.variantNumber,
            creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
          },
        } : {}),
      } : prod.scopes.includes("sample") ? {
        stage: "marketing",
        isResample: getAutomaticSampleRoute(prod).isResample,
        samplingRouting: {
          stage: "marketing",
          sampleTrack: prod.sampleTrack || prod.samplingMetadata?.sampleTrack,
          sampleType: prod.samplingMetadata?.sampleType || (String(prod.productType || "").toLowerCase().includes("partial") ? "partial" : "full"),
          partialRequirements: prod.samplingMetadata?.partialRequirements || "",
          isResample: getAutomaticSampleRoute(prod).isResample,
          creativeChangesRequired: getAutomaticSampleRoute(prod).creativeChangesRequired,
          isDesignVariant: Boolean(prod.variantNumber),
          variantNumber: prod.variantNumber,
          creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
        },
      } : undefined,
      brandName: prod.brandName || undefined,
      productCategory: prod.productCategory || undefined,
      productSubCategory: prod.productSubCategory || undefined,
      productThirdCategory: prod.productThirdCategory || undefined,
      unitPcPack: prod.unitPcPack || undefined,
      qtyPerPack: prod.qtyPerPack || undefined,
      qtyForSampling: prod.qtyForSampling || undefined,
      qtyDesignCosting: prod.qtyDesignCosting || undefined,
      costingRequiredDate: prod.costingRequiredDate || undefined,
      costingCreativeInputNeeded: prod.costingCreativeInputNeeded === true,
      costingCreativeInputRemark: prod.costingCreativeInputNeeded ? prod.costingCreativeInputRemark?.trim() || undefined : undefined,
    };

    const createAndRecordDraft = async () => {
      const created = await createSampleRequestApi(payload);
      if (!created) throw new Error("A staged product could not be saved.");
      const createdCode = created.srNumber || created.requestCode || (created.requestCodes && Object.values(created.requestCodes)[0] as string | undefined);
      prod.savedRequestId = created.id;
      prod.savedSrNumber = createdCode;
      prod.savedRequestCode = createdCode;
      if (index === 0) {
        firstSavedId = created.id;
        firstSavedSr = createdCode;
      }
    };

    try {
      if (prod.savedRequestId) {
        try {
          const updated = await updateSampleRequestApi(prod.savedRequestId, payload);
          if (!updated) throw new Error("The saved draft could not be updated.");
          const updatedCode = updated.srNumber || updated.requestCode || (updated.requestCodes && Object.values(updated.requestCodes)[0] as string | undefined);
          if (updatedCode) {
            prod.savedSrNumber = updatedCode;
            prod.savedRequestCode = updatedCode;
          }
        } catch (err) {
          if (!isSampleRequestNotFoundError(err)) throw err;
          console.warn(`Staged draft ${prod.savedRequestId} no longer exists; creating a replacement draft.`);
          prod.savedRequestId = undefined;
          prod.savedSrNumber = undefined;
          await createAndRecordDraft();
        }
      } else if (index === 0 && programContext?.parentRequestId) {
        try {
          const updated = await updateSampleRequestApi(programContext.parentRequestId, payload);
          if (!updated) throw new Error("The sampling request could not be updated with the first product.");
          prod.savedRequestId = programContext.parentRequestId;
          prod.savedSrNumber = programContext.parentSrNumber;
        } catch (err) {
          if (!isSampleRequestNotFoundError(err)) throw err;
          console.warn(`Parent sample request ${programContext.parentRequestId} no longer exists; creating a replacement draft.`);
          await createAndRecordDraft();
        }
      } else {
        await createAndRecordDraft();
      }
      prod.isDraftSaved = true;
      savedCount++;
    } catch (err) {
      console.error("Individual draft auto-save error:", err);
      if (index === 0 && programContext?.parentRequestId && !prod.savedRequestId) {
        return { success: false, count: 0, customer, programName };
      }
    }
  }

  const savedIds = validItems.map((i) => i.savedRequestId).filter((id): id is string | number => id !== undefined && id !== null);

  if (savedCount === validItems.length) {
    try {
      await linkStagedFeasibilityRequest(validItems, programContext);
    } catch (err) {
      return {
        success: false,
        count: savedCount,
        customer,
        programName,
        requestId: firstSavedId,
        srNumber: firstSavedSr,
        savedIds,
        error: `Draft saved, but it could not be linked to feasibility: ${err instanceof Error ? err.message : "Please retry."}`,
      };
    }
  }

  return {
    success: savedCount === validItems.length,
    count: savedCount,
    customer,
    programName,
    requestId: firstSavedId,
    srNumber: firstSavedSr,
    savedIds,
    error: savedCount === validItems.length ? undefined : `Saved ${savedCount} of ${validItems.length} products. Your staged data is still available; retry to finish saving the rest.`,
  };
}
