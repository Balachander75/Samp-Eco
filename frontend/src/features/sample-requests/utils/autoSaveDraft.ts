import { StagedProductItem } from "../components/ProductStagingWorkspace";
import {
  createSampleRequestApi,
  createDesignRequestApi,
  updateSampleRequestApi,
} from "@/infrastructure/api";
import { CreateSampleRequestForm } from "../types";
import { API_BASE_URL, createApiHeaders } from "@/infrastructure/api/client";
import { UserProfile } from "@/features/auth";
import { getBusinessYearForDate } from "@/lib/businessYear";

export interface ProgramContextData {
  customer?: string;
  programName?: string;
  programYear?: string;
  year?: string;
  targetPlant?: string;
  parentRequestId?: string | number;
  parentSrNumber?: string;
}

export interface AutoSaveResult {
  success: boolean;
  count: number;
  customer: string;
  programName: string;
  requestId?: string | number;
  srNumber?: string;
  error?: string;
}

function draftKeyFor(item: StagedProductItem, user?: UserProfile | null): string {
  const owner = String(user?.userid || user?.name || "marketing").trim().slice(0, 60);
  return `samp-draft:${owner}:${item.id}`.slice(0, 160);
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
  if (!items || items.length === 0) {
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

  // A newly created request is completed with the first staged product. Remaining
  // products are created as their own requests under the same customer/program.
  // Existing staging sessions still use the batch path where available.
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
      items: items.map((prod) => ({
        product_description: prod.productDescription,
        material_code: prod.materialCode,
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
          null,
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
          creativeChangesRequired: Boolean(prod.hasCreativeChanges || prod.creativeCharacteristicsCleared || prod.creativePendingCharacteristicKeys?.length),
          marketingShutterstockNo: prod.mockupMetadata?.marketingShutterstockNo || "",
          marketingRemark: prod.mockupMetadata?.marketingRemark || "",
          qtyForMockup: prod.qtyForMockup || prod.mockupMetadata?.qtyForMockup || "1",
          requiredDate: prod.mockupMetadata?.requiredDate || prod.mockupRequiredDate || "",
          creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
          events: [],
        } : {},
        status: "Draft (Pre-SMT)",
        client_draft_key: draftKeyFor(prod, user),
        target_plant: prod.plant || targetPlant,
        unit_pc_pack: prod.unitPcPack || null,
        qty_per_pack: prod.qtyPerPack || null,
        qty_for_sampling: prod.qtyForSampling || null,
        qty_design_costing: prod.qtyDesignCosting || null,
        costing_required_date: prod.costingRequiredDate || null,
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
        reference_links: prod.designMetadata?.webLinks || [],
        remarks:
          prod.designMetadata?.remarks ||
          (prod.samplingMetadata?.partialRequirements
            ? `[Partial Scope]: ${prod.samplingMetadata.partialRequirements}`
            : null),
      })),
      };

      const res = await fetch(`${API_BASE_URL}/api/v1/sample-requests/batch`, {
        method: "POST",
        headers: createApiHeaders({ json: true }),
        body: JSON.stringify(batchPayload),
      });

      if (res.ok) {
        let firstId: string | number | undefined;
        let firstSr: string | undefined;
        try {
          const data = await res.json();
          if (data?.results && Array.isArray(data.results) && data.results.length === items.length && data.results.every((saved: any) => saved?.id && saved?.sr_number)) {
            firstId = data.results[0].id;
            firstSr = data.results[0].sr_number;
            data.results.forEach((saved: any, index: number) => {
              if (!items[index]) return;
              items[index].savedRequestId = saved.id;
              items[index].savedSrNumber = saved.sr_number;
              items[index].isDraftSaved = true;
            });
          }
        } catch {
          // ignore
        }
        if (firstId !== undefined && items.every((item) => item.savedRequestId !== undefined)) {
          return { success: true, count: items.length, customer, programName, requestId: firstId, srNumber: firstSr };
        }
      } else if (res.status >= 400 && res.status < 500 && res.status !== 404 && res.status !== 405) {
        let message = "The draft details were rejected. Check the required fields and try again.";
        try {
          const body = await res.json();
          if (typeof body?.detail === "string") message = body.detail;
          else if (Array.isArray(body?.detail)) message = body.detail.map((item: any) => item.msg).filter(Boolean).join("; ") || message;
        } catch {
          // Keep the actionable fallback message.
        }
        return { success: false, count: 0, customer, programName, error: message };
      }
    } catch (err) {
      console.warn("Batch draft save endpoint fallback:", err);
    }
  }

  // Attempt 2: Individual item creation fallback
  let savedCount = 0;
  let firstSavedId: string | number | undefined = programContext?.parentRequestId;
  let firstSavedSr: string | undefined = programContext?.parentSrNumber;

  for (const [index, prod] of items.entries()) {
    const payload: CreateSampleRequestForm = {
      customer,
      programName,
      programYear,
      year,
      targetPlant,
      productDescription: prod.productDescription,
      materialCode: prod.materialCode,
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
      referenceLinks: prod.designMetadata?.webLinks || [],
      trend: prod.designMetadata?.trend || undefined,
      targetAudience: prod.designMetadata?.targetAudience || undefined,
      numberOfDesigns: prod.designMetadata?.numberOfDesigns || 1,
      designRemarks: prod.designMetadata?.remarks || undefined,
      sourceSampleCode:
        prod.samplingMetadata?.sourceSrNumber ||
        prod.samplingMetadata?.selectedMaterialCode ||
        prod.catalogMetadata?.sourceMaterialCode,
      sourceSampleRequestId:
        prod.sourceSampleRequestId || prod.catalogMetadata?.sourceProductId || prod.samplingMetadata?.sourceSampleId,
      customDetails: prod.customDetails?.map((detail) => ({
        className: detail.className || detail.class_name || "Product",
        characteristicName: detail.characteristicName || detail.characteristic_name || "",
        value: detail.value,
        uom: detail.uom || null,
      })).filter((detail) => detail.characteristicName) || undefined,
      customBinding1: prod.samplingMetadata?.bindingType1 || prod.catalogMetadata?.bindingType1,
      customBinding2: prod.samplingMetadata?.bindingType2 || prod.catalogMetadata?.bindingType2,
      mockupRequired: prod.scopes.includes("mockup") ? "Yes" : undefined,
      mockupWorkflowState: prod.scopes.includes("mockup") ? {
        stage: "marketing",
        designNeeded: prod.mockupMetadata?.designNeeded ?? (prod.creationMode === "new" || prod.scopes.includes("design")),
        creativeChangesRequired: Boolean(prod.hasCreativeChanges || prod.creativeCharacteristicsCleared || prod.creativePendingCharacteristicKeys?.length),
        marketingShutterstockNo: prod.mockupMetadata?.marketingShutterstockNo || "",
        marketingRemark: prod.mockupMetadata?.marketingRemark || "",
          qtyForMockup: prod.qtyForMockup || prod.mockupMetadata?.qtyForMockup || "1",
        requiredDate: prod.mockupMetadata?.requiredDate || prod.mockupRequiredDate || "",
        creativePendingCharacteristicKeys: prod.creativePendingCharacteristicKeys || [],
        events: [],
      } : undefined,
      brandName: prod.brandName || undefined,
      unitPcPack: prod.unitPcPack || undefined,
      qtyPerPack: prod.qtyPerPack || undefined,
      qtyForSampling: prod.qtyForSampling || undefined,
      qtyDesignCosting: prod.qtyDesignCosting || undefined,
      costingRequiredDate: prod.costingRequiredDate || undefined,
    };

    try {
      if (prod.savedRequestId) {
        const updated = await updateSampleRequestApi(prod.savedRequestId, payload);
        if (!updated) throw new Error("The saved draft could not be updated.");
      } else if (index === 0 && programContext?.parentRequestId) {
        const updated = await updateSampleRequestApi(programContext.parentRequestId, payload);
        if (!updated) throw new Error("The sampling request could not be updated with the first product.");
        prod.savedRequestId = programContext.parentRequestId;
        prod.savedSrNumber = programContext.parentSrNumber;
      } else {
        const created = await createSampleRequestApi(payload);
        if (!created) throw new Error("A staged product could not be saved.");
        prod.savedRequestId = created.id;
        prod.savedSrNumber = created.srNumber;
        if (index === 0) {
          firstSavedId = created.id;
          firstSavedSr = created.srNumber;
        }
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

  return {
    success: savedCount === items.length,
    count: savedCount,
    customer,
    programName,
    requestId: firstSavedId,
    srNumber: firstSavedSr,
    error: savedCount === items.length ? undefined : `Saved ${savedCount} of ${items.length} products. Your staged data is still available; retry to finish saving the rest.`,
  };
}
