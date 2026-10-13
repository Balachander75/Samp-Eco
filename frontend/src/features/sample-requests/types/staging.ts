export type DeliverableScopeId = "design" | "mockup" | "sample" | "costing";

export interface DeliverableDefinition {
  id: DeliverableScopeId;
  label: string;
}

export const DELIVERABLES: DeliverableDefinition[] = [
  { id: "design", label: "Design" },
  { id: "mockup", label: "Mockup" },
  { id: "sample", label: "Sampling" },
  { id: "costing", label: "Costing" },
];

export interface StagedProductItem {
  id: string;
  materialCode: string;
  productDescription: string;
  scopes: DeliverableScopeId[];
  timestamp: string;
  stagedDate?: string;
  creationMode?: "material_code" | "binding" | "custom" | "new";
  savedRequestId?: string | number;
  savedSrNumber?: string;
  isDraftSaved?: boolean;
  sourceSampleRequestId?: number;
  sourceSampleCode?: string;
  customBinding1?: string;
  customBinding2?: string;
  customDetails?: Array<{
    class_name?: string;
    className?: string;
    characteristic_name?: string;
    characteristicName?: string;
    value: string | null;
    uom?: string | null;
  }>;
  hasCreativeChanges?: boolean;
  creativeCharacteristicsCleared?: boolean;
  creativePendingCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
  requestTypeTimestamps?: Record<string, string | null>;
  plant?: string;
  unitPcPack?: string;
  qtyForSampling?: string;
  qtyDesignCosting?: string;
  qtyPerPack?: string;
  qtyForMockup?: string;
  mockupRequiredDate?: string;
  costingRequiredDate?: string;
  customerProductCode?: string;
  barcode?: string;
  brandName?: string;
  productType?: string;
  productCategory?: string;
  productSubCategory?: string;
  productThirdCategory?: string;
  sampleRequiredDate?: string;
  designMetadata?: {
    numberOfDesigns: number;
    designRequiredDate: string;
    trend: string;
    targetAudience: string;
    remarks?: string;
    images: Array<{ id: string; url: string; name: string; size?: string }>;
    webLinks: string[];
    referenceImage: string;
  };
  mockupMetadata?: {
    designNeeded: boolean;
    marketingShutterstockNo?: string;
    marketingRemark?: string;
    qtyForMockup?: string;
    requiredDate?: string;
  };
  samplingMetadata?: {
    sampleType: "full" | "partial";
    partialRequirements?: string;
    searchMode: "material_code" | "binding" | "new";
    sourceSampleId?: number;
    sourceSrNumber?: string;
    selectedMaterialCode?: string;
    bindingType1?: string;
    bindingType2?: string;
    customerReference?: string;
    targetPlant?: string;
  };
  catalogMetadata?: {
    sourceProductId?: number;
    sourceRequestNumber?: string;
    sourceMaterialCode?: string;
    sourceDescription: string;
    bindingType1?: string;
    bindingType2?: string;
  };
}

export const cleanPlantName = (plant?: string): string => {
  if (!plant) return "";
  return plant.replace(/^\d{4}-?\s*/, "").trim() || plant;
};
