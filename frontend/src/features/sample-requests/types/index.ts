import type { CreativeDesignSubmission } from "@/features/creative/types";

export type SampleStatus =
  | "Draft (Pre-SMT)"
  | "Creative"
  | "Studio"
  | "SAMP"
  | "In Plant Work"
  | "Dispatched / Closed"
  | "Actual Deal"
  | "Draft (Pre-PMT)"
  | "Sampling Review (PMT)"
  | "Released"
  | "In Plant Execution"
  | "QC Inspection"
  | "Dispatched"
  | "Customer Review"
  | "Approved / Closed";

export interface SampleRequestItem {
  id: string;
  srNumber: string;
  year: string;
  productDescription: string;
  customer: string;
  targetPlant: string;
  dateRequestCreated: string;
  createdBy: string;
  materialCode: string;
  requestCode?: string;
  barcode?: string;
  customerProductCode?: string;
  sourceSampleCode?: string;
  sourceRequestId?: number;
  sourceSampleRequestId?: number;
  sampleRequiredDate?: string;
  productType?: string;
  productTypeNavneet?: string;
  productTypeNewCustomer?: string;
  productCategory?: string;
  productSubCategory?: string;
  productThirdCategory?: string;
  productImagePath?: string;
  designsCustomerCreative?: string;
  brandName?: string;
  unitPcPack?: string | number;
  qtyPerPack?: string | number;
  qtyDesignCosting?: string | number;
  costingRequiredDate?: string | null;
  costingCounterDate?: string | null;
  costingOutputPath?: string | null;
  productArtworkNos?: string | number;
  targetArtworkDateCreative?: string;
  targetArtworkDateStudio?: string;
  qtyForSampling?: string | number;
  qtyForMockup?: string | number;
  mockupRequired?: string;
  mockupWorkflowState?: MockupWorkflowState;
  status: SampleStatus | string;
  creationMode?: "material_code" | "binding" | string;
  programYear?: string;
  programName?: string;
  programCampaignTitle?: string;
  programMaterials?: ProgramMaterialItem[];
  customDetails?: Array<{
    id?: number;
    className: string;
    characteristicName: string;
    value: string | null;
    uom?: string | null;
  }>;
  requestTypes?: RequestType[];
  requestKind?: "sample" | "design" | "feasibility" | "program";
  designRequestId?: number;
  designRequestStatus?: string;
  designRemarks?: string | null;
  creativeSubmissions?: CreativeDesignSubmission[];
  marketingDesignDecision?: "awaiting_marketing_review" | "remaining_requested" | "accepted" | null;
  remainingDesignCount?: number;
  numberOfDesigns?: number;
  designRequiredDate?: string | null;
  trend?: string | null;
  targetAudience?: string | null;
  referenceImage?: string | null;
  // Creative Studio Workflow, Task Claim & 2-Day Counter Date SLA
  releasedAt?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
    designRequestCreatedAt?: string | null;
  isCounterDateActive?: boolean;
  proposedTargetDate?: string | null;
  counterDateReason?: string | null;
  counterDateRequestedAt?: string | null;
  counterDateDecision?: "pending" | "accepted" | "rejected" | "auto_accepted" | null;
  counterDateDecisionAt?: string | null;
  counterDateDecisionNotes?: string | null;
  counterDateRequestedBy?: string | null;
  workflowEvents?: Array<Record<string, any>>;
  workflowNotes?: Array<Record<string, any>>;
  createdAt: string;
  updatedAt?: string;
  plantFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  plantFeasibilityRemark?: string | null;
  samplingFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  samplingFeasibilityRemark?: string | null;
  samplingFeasibilityApprovedBy?: string | null;
  samplingFeasibilityApprovedDate?: string | null;
  feasibilityClosedAt?: string | null;
  feasibilityClosedBy?: "plant" | "sampling" | null;
  isRespondedOnTime?: boolean | null;
  sampCounterDate?: string | null;
  sampCounterDateReason?: string | null;
  sampCounterDateProposedAt?: string | null;
  sampCounterDateProposedBy?: string | null;
  counterDateDecisionBy?: string | null;
  counterDateDecisionRemark?: string | null;
  counterDateDecisionDueAt?: string | null;
  counterDateWaitWorkdays?: number | null;
  sampSlaPausedWorkdays?: number;
  marketingDecision?: "Accepted" | "Rejected" | null;
  marketingDecisionBy?: string | null;
  marketingDecisionAt?: string | null;
  marketingDecisionRemark?: string | null;
  takenBySamp?: string | null;
  takenBySampUserId?: number | null;
  takenAtSamp?: string | null;
  convertedSampleRequestId?: number | string | null;
  convertedSrNumber?: string | null;
  convertedRequestTypes?: Array<"sample" | "costing">;
  convertedAt?: string | null;
  convertedBy?: string | null;
  activities?: FeasibilityActivityItem[];
  referenceImages?: string[];
  referenceImageNames?: string[];
  referenceLinks?: string[];
  descriptionNotes?: string;
  feasibilityType?: string;
  customFeasibilityType?: string | null;
  feasibilityDescription?: string;
  marketingRemarks?: string | null;
  feasibilityConditions?: string | null;
  leadTimeNote?: string | null;
  // Program Planning Dual Reviews (Sampling & Plant)
  samplingSeenAt?: string | null;
  samplingSeenBy?: string | null;
  samplingVerdict?: string | null;
  samplingRemark?: string | null;
  samplingSignedAt?: string | null;
  samplingSignedBy?: string | null;
  plantSeenAt?: string | null;
  plantSeenBy?: string | null;
  plantVerdict?: string | null;
  plantRemark?: string | null;
  plantSignedAt?: string | null;
  plantSignedBy?: string | null;
}

export interface MockupWorkflowEvent {
  action: string;
  title: string;
  actorName: string;
  actorDepartment: string;
  timestamp: string;
  mockupUrl?: string;
  remark?: string | null;
}

export interface MockupWorkflowState {
  stage: "marketing" | "awaiting_design_acceptance" | "creative" | "studio" | "creative_approval" | "awaiting_marketing_acceptance" | "done" | string;
  designNeeded?: boolean;
  marketingShutterstockNo?: string;
  marketingRemark?: string;
  creativeShutterstockNo?: string;
  creativeRemark?: string;
  creativeCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
  creativeRequiredCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
  creativePendingCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
  creativeCharacteristicsClearedAt?: string;
  qtyForMockup?: string;
  requiredDate?: string;
  marketingRequiredDate?: string;
  studioSystemRequiredDate?: string;
  creativeSystemRequiredDate?: string;
  creativeDateDecisionDueAt?: string;
  creativeDateDecision?: "confirmed" | "proposed";
  creativeInputDate?: string;
  creativeConfirmedDate?: string | null;
  creativeProposedDate?: string | null;
  creativeDateDecisionAt?: string;
  creativeDateDecisionLate?: boolean;
  studioEarliestStartDate?: string;
  creativeChangesRequired?: boolean;
  studioSubmittedAt?: string;
  submittedToCreativeAt?: string;
  submittedToCreativeBy?: string;
  creativeApprovalDueAt?: string;
  creativeApprovalActualAt?: string;
  creativeApprovalLate?: boolean;
  creativeApprovalDecision?: "accept" | "request_revision";
  creativeApprovedAt?: string;
  creativeRevisionRemark?: string;
  marketingDecision?: "accept" | "request_revision";
  marketingRevisionRemark?: string;
  releasedToCreativeAt?: string;
  sentToStudioAt?: string;
  sentToStudioBy?: string;
  mockupUrl?: string;
  submittedToMarketingAt?: string;
  submittedToMarketingBy?: string;
  claimedBy?: string;
  claimedByUserId?: number;
  claimedAt?: string;
  claimedStage?: "creative" | "studio" | "creative_approval";
  plantReleasedAt?: string;
  plantReleasedBy?: string;
  plantReleaseTarget?: string;
  samplingRemark?: string;
  samplingFeedback?: string;
  samplingFeedbackAt?: string;
  samplingFeedbackBy?: string;
  events?: MockupWorkflowEvent[];
}

export interface FeasibilityActivityItem {
  id: number;
  feasibilityRequestId: number;
  actorId?: number | null;
  actorName: string;
  actorDepartment: string;
  action: "CREATED" | "VIEWED" | "TASK_CLAIMED" | "SAMP_EVALUATED" | "MARKETING_DECIDED" | "CONVERTED_TO_SAMPLING" | string;
  payload: Record<string, any>;
  createdAt: string;
}

export interface FeasibilityRequestPayload {
  customer: string;
  feasibilityType: string;
  customFeasibilityType?: string | null;
  descriptionNotes: string;
  requiredDate: string;
  marketingRemarks?: string | null;
  referenceImages?: string[];
  referenceImageNames?: string[];
  referenceLinks?: string[];
}

export interface FeasibilitySampVerdictPayload {
  response: "Yes" | "No" | "Maybe";
  remark?: string | null;
  conditions?: string | null;
  lead_time_note?: string | null;
}

export interface FeasibilityMarketingDecisionPayload {
  decision: "Accepted" | "Rejected";
  decision_remark?: string | null;
}

export interface FeasibilityRequestRecord extends FeasibilityRequestPayload {
  id: number;
  requestCode: string;
  status: string;
  createdBy?: string | null;
  requestCreatedBy?: string | null;
  createdByUserId?: number | null;
  requestRaisedAt: string;
  updatedAt?: string | null;
  samplingFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  samplingFeasibilityRemark?: string | null;
  samplingFeasibilityApprovedBy?: string | null;
  feasibilityClosedAt?: string | null;
  feasibilityClosedBy?: string | null;
  isRespondedOnTime?: boolean | null;
  sampCounterDate?: string | null;
  sampCounterDateReason?: string | null;
  sampCounterDateProposedAt?: string | null;
  sampCounterDateProposedBy?: string | null;
  counterDateDecision?: "pending" | "accepted" | "rejected" | "auto_accepted" | null;
  counterDateDecisionAt?: string | null;
  counterDateDecisionBy?: string | null;
  counterDateDecisionRemark?: string | null;
  counterDateDecisionDueAt?: string | null;
  counterDateWaitWorkdays?: number | null;
  sampSlaPausedWorkdays?: number;
  marketingDecision?: "Accepted" | "Rejected" | null;
  marketingDecisionBy?: string | null;
  marketingDecisionAt?: string | null;
  marketingDecisionRemark?: string | null;
  takenBySamp?: string | null;
  takenBySampUserId?: number | null;
  takenAtSamp?: string | null;
  targetPlant?: string | null;
  feasibilityConditions?: string | null;
  leadTimeNote?: string | null;
  convertedSampleRequestId?: number | string | null;
  convertedSrNumber?: string | null;
  convertedRequestTypes?: Array<"sample" | "costing">;
  convertedAt?: string | null;
  convertedBy?: string | null;
  activities?: (FeasibilityActivityItem | ProgramActivityItem)[];
  referenceImageNames?: string[];
}


export interface CreateSampleRequestForm {
  clientDraftKey?: string;
  year?: string;
  programYear?: string;
  productDescription?: string;
  programName?: string;
  customer: string;
  targetPlant: string;
  materialCode?: string;
  barcode?: string;
  customerProductCode?: string;
  sourceSampleCode?: string;
  sampleRequiredDate?: string;
  productType?: string;
  brandName?: string;
  productTypeNavneet?: string;
  productTypeNewCustomer?: string;
  unitPcPack?: string | number;
  qtyPerPack?: string | number;
  qtyDesignCosting?: string | number;
  costingRequiredDate?: string | null;
  costingCounterDate?: string | null;
  costingOutputPath?: string | null;
  productArtworkNos?: string | number;
  targetArtworkDateCreative?: string;
  targetArtworkDateStudio?: string;
  qtyForSampling?: string | number;
  qtyForMockup?: string | number;
  mockupRequired?: string;
  mockupWorkflowState?: MockupWorkflowState;
  designsCustomerCreative?: string;
  productImagePath?: string;
  dateRequestCreated?: string;
  createdBy?: string;
  status?: string;
  creationMode?: "material_code" | "binding" | string;
  sourceRequestId?: number;
  sourceSampleRequestId?: number;
  customBinding1?: string;
  customBinding2?: string;
  customDetails?: Array<{
    id?: number;
    className: string;
    characteristicName: string;
    value: string | null;
    uom?: string | null;
  }>;
  requestTypes?: RequestType[];
  requestTypeSelectedAt?: RequestTypeSelectedAt;
  plantFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  plantFeasibilityRemark?: string | null;
  samplingFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  samplingFeasibilityRemark?: string | null;
  feasibilityClosedAt?: string | null;
  feasibilityClosedBy?: "plant" | "sampling" | null;
  referenceImages?: string[];
  referenceLinks?: string[];
  trend?: string;
  targetAudience?: string;
  numberOfDesigns?: number;
  designRemarks?: string;
}

export type RequestType = "design" | "mockup" | "sample" | "costing";

export type RequestTypeSelectedAt = Partial<Record<RequestType, string | null>>;

// Re-export Master and Catalog domain types (see src/types/master.ts)
export type {
  PlantItem,
  CreatePlantForm,
  CustomerItem,
  BindingHierarchyResponse,
  ProductSearchResult,
} from "@/types/master";

export interface StagedProductItem {
  id: string; // unique client id
  materialCode: string;
  sourceSampleCode?: string;
  productDescription: string;
  barcode?: string;
  customerProductCode?: string;
  productType?: string;
  productCategory?: string;
  productSubCategory?: string;
  productThirdCategory?: string;
  sourceSampleRequestId?: number;
  sourceRequestId?: number;
  creationMode: "material_code" | "binding" | "custom" | "new";
  bindingType1: string;
  bindingType2: string;
  originalBindingType1?: string;
  originalBindingType2?: string;
  isBindingEdited?: boolean;
  detailsCount?: number;
  customer?: string;
  targetPlant?: string;
  srNumber?: string;
  editedDetails?: Array<{
    id?: number;
    sampleRequestId?: number;
    className: string;
    characteristicName: string;
    value: string | null;
    uom?: string | null;
    options?: string[];
  }>;
  requestTypes?: RequestType[];
  requestTypeSelectedAt?: RequestTypeSelectedAt;
}

export interface BatchSampleRequestItemPayload {
  material_code: string;
  product_description?: string;
  barcode?: string | null;
  customer_product_code?: string | null;
  source_sample_code?: string | null;
  product_type?: string | null;
  product_category?: string | null;
  product_sub_category?: string | null;
  product_third_category?: string | null;
  source_sample_request_id?: number;
  creation_mode: "material_code" | "binding";
  custom_binding_1?: string | null;
  custom_binding_2?: string | null;
  custom_details?: Array<{
    class_name: string;
    characteristic_name: string;
    value: string | null;
    uom: string | null;
  }>;
  request_types?: RequestType[];
  request_type_selected_at?: RequestTypeSelectedAt;
}

export interface BatchCreateSampleRequestPayload {
  customer: string;
  program_name: string;
  program_year: string;
  target_plant?: string;
  created_by?: string;
  date_request_created?: string;
  sample_required_date?: string;
  items: BatchSampleRequestItemPayload[];
}

export interface BatchCreateSampleRequestResponse {
  success: boolean;
  message: string;
  total_created: number;
  requests: SampleRequestItem[];
}

// Re-export Creative domain types (see features/creative/types.ts)
export type {
  DesignRequest,
  CreativeDesignOutputRow,
  CreativeDesignSubmission,
  DesignRequestForm,
  CreativeBriefItem,
} from "@/features/creative/types";

// Re-export Studio domain types (see features/studio/types.ts)
export type { DielineItem } from "@/features/studio/types";

// Re-export Costing domain types (see features/costing/types.ts)
export type { CostingItem } from "@/features/costing/types";

export interface ProgramMaterialItem {
  id?: number | string;
  materialType?: string;
  supplierName?: string;
  grade?: string;
  colorVariant?: string;
  caliperWt?: string;
  quantity?: string;
  unit?: string;
  remark?: string;
  sampRemark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddProgramMaterialPayload {
  material_type?: string | null;
  supplier_name?: string | null;
  grade?: string | null;
  color_variant?: string | null;
  caliper_wt?: string | null;
  quantity?: string | null;
  unit?: string | null;
  remark?: string | null;
  samp_remark?: string | null;
}

export interface ProgramActivityItem {
  id: number;
  programRequestId: number;
  actorId?: number | null;
  actorName: string;
  actorDepartment: string;
  action: "CREATED" | "NOTE_POSTED" | "STATUS_UPDATED" | "MATERIAL_ADDED" | "MATERIAL_DELETED" | "SAMP_REMARK_UPDATED" | "SAMP_REMARKS_UPDATED" | "UPDATED" | string;
  payload: Record<string, any>;
  createdAt: string;
  pinnedByMarketing?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: string | null;
}

export interface ProgramRequestRecord {
  id: number;
  requestCode: string;
  srNumber: string;
  customerName: string;
  targetPlant: string;
  programCampaignTitle: string;
  programYear: string;
  status: string;
  createdBy?: string | null;
  samplingSeenAt?: string | null;
  samplingSeenBy?: string | null;
  samplingVerdict?: string | null;
  samplingRemark?: string | null;
  samplingSignedAt?: string | null;
  samplingSignedBy?: string | null;
  plantSeenAt?: string | null;
  plantSeenBy?: string | null;
  plantVerdict?: string | null;
  plantRemark?: string | null;
  plantSignedAt?: string | null;
  plantSignedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  materials: ProgramMaterialItem[];
  activities?: ProgramActivityItem[];
}

export interface ProgramOutputPayload {
  department: "sampling" | "plant";
  remark: string;
}

export interface ProgramActivityReplyPayload {
  remark: string;
}

export interface ProgramSeenPayload {
  department: "sampling" | "plant";
  actor_name?: string | null;
}

export interface CreateProgramRequestPayload {
  customer_name: string;
  target_plant: string;
  program_campaign_title: string;
  program_year: string;
  created_by?: string | null;
  materials: Array<{
    material_type?: string | null;
    supplier_name?: string | null;
    grade?: string | null;
    color_variant?: string | null;
    caliper_wt?: string | null;
    quantity?: string | null;
    unit?: string | null;
    remark?: string | null;
    samp_remark?: string | null;
  }>;
}

