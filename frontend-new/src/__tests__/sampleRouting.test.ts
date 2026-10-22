import { describe, it, expect } from "vitest";
import { getAutomaticSampleRoute, isDirectPlantResampleRequest } from "../features/sample-requests/utils/sampleRouting";
import { getDraftReleaseStatus } from "../features/sample-requests/utils/trackTypes";
import type { StagedProductItem } from "../features/sample-requests/types/staging";

describe("Sample Routing & Resample Auto-Detection", () => {
  it("auto-detects unchanged catalog product by raw material code as a direct resample to plant", () => {
    const item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes"> = {
      scopes: ["sample"],
      materialCode: "MAT-10042",
      creationMode: "material_code",
      hasCreativeChanges: false,
      creativeCharacteristicsCleared: false,
      creativePendingCharacteristicKeys: [],
    };

    const route = getAutomaticSampleRoute(item);
    expect(route.hasExistingProduct).toBe(true);
    expect(route.creativeChangesRequired).toBe(false);
    expect(route.isResample).toBe(true);
    expect(isDirectPlantResampleRequest(item as any)).toBe(true);

    const releaseStatus = getDraftReleaseStatus(item as any);
    expect(releaseStatus).toBe("Released to Plant");
  });

  it("auto-detects unchanged catalog product by source ID as a direct resample to plant", () => {
    const item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes"> = {
      scopes: ["sample"],
      sourceSampleRequestId: 45,
      hasCreativeChanges: false,
      creativeCharacteristicsCleared: false,
    };

    const route = getAutomaticSampleRoute(item);
    expect(route.hasExistingProduct).toBe(true);
    expect(route.isResample).toBe(true);
    expect(isDirectPlantResampleRequest(item as any)).toBe(true);

    const releaseStatus = getDraftReleaseStatus(item as any);
    expect(releaseStatus).toBe("Released to Plant");
  });

  it("routes brand new product with blank characteristics to Sampling Review (PMT), NEVER direct to plant", () => {
    const item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes"> = {
      scopes: ["sample"],
      creationMode: "new",
      materialCode: "NEW-PRODUCT-01",
      hasCreativeChanges: false,
      creativeCharacteristicsCleared: false,
    };

    const route = getAutomaticSampleRoute(item);
    expect(route.hasExistingProduct).toBe(false);
    expect(route.isResample).toBe(false);
    expect(isDirectPlantResampleRequest(item as any)).toBe(false);

    const releaseStatus = getDraftReleaseStatus(item as any);
    expect(releaseStatus).toBe("Sampling Review (PMT)");
  });

  it("routes brand new product with searchMode 'new' to Sampling Review (PMT)", () => {
    const item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes"> = {
      scopes: ["sample"],
      samplingMetadata: {
        sampleType: "full",
        searchMode: "new",
      },
      hasCreativeChanges: false,
    };

    const route = getAutomaticSampleRoute(item);
    expect(route.hasExistingProduct).toBe(false);
    expect(route.isResample).toBe(false);
    expect(isDirectPlantResampleRequest(item as any)).toBe(false);

    const releaseStatus = getDraftReleaseStatus(item as any);
    expect(releaseStatus).toBe("Sampling Review (PMT)");
  });

  it("routes catalog product with modified specs to Creative, not Plant", () => {
    const item: Partial<StagedProductItem> & Pick<StagedProductItem, "scopes"> = {
      scopes: ["sample"],
      materialCode: "MAT-20099",
      creationMode: "material_code",
      hasCreativeChanges: true,
      creativePendingCharacteristicKeys: [
        { className: "Book", characteristicName: "Binding Style" },
      ],
    };

    const route = getAutomaticSampleRoute(item);
    expect(route.hasExistingProduct).toBe(true);
    expect(route.creativeChangesRequired).toBe(true);
    expect(route.isResample).toBe(false);
    expect(isDirectPlantResampleRequest(item as any)).toBe(false);

    const releaseStatus = getDraftReleaseStatus({
      ...item,
      mockupWorkflowState: {
        samplingRouting: {
          creativeChangesRequired: true,
        },
      },
    } as any);
    expect(releaseStatus).toBe("Creative");
  });
});
