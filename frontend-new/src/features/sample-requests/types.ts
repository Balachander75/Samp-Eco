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
  targetPlant?: string | null;
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
  plantFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  plantFeasibilityRemark?: string | null;
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
  convertedRequestCode?: string | null;
  convertedRequestTypes?: Array<"sample" | "mockup" | "costing">;
  convertedAt?: string | null;
  convertedBy?: string | null;
  activities?: FeasibilityActivityItem[];
  referenceImageNames?: string[];
}

export type RequestType = "design" | "mockup" | "sample" | "costing";

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
  plantRemark?: string;
  promotedSampleRequestId?: number | null;
  promotedSrNumber?: string | null;
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
  plant_remark?: string | null;
}

export interface ProgramActivityItem {
  id: number;
  programRequestId: number;
  actorId?: number | null;
  actorName: string;
  actorDepartment: string;
  action: string;
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
  isActive?: boolean;
  createdBy?: string | null;
  samplingSeenAt?: string | null;
  samplingSeenBy?: string | null;
  samplingVerdict?: string | null;
  samplingRemark?: string | null;
  samplingSignedAt?: string | null;
  samplingSignedBy?: string | null;
  samplingClaimedByUserId?: number | null;
  samplingClaimedBy?: string | null;
  plantSeenAt?: string | null;
  plantSeenBy?: string | null;
  plantVerdict?: string | null;
  plantRemark?: string | null;
  plantSignedAt?: string | null;
  plantSignedBy?: string | null;
  plantClaimedByUserId?: number | null;
  plantClaimedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  materials: ProgramMaterialItem[];
  activities?: ProgramActivityItem[];
}

export interface CreateProgramRequestPayload {
  customer_name: string;
  target_plant: string;
  program_campaign_title: string;
  program_year: string;
  created_by?: string | null;
  materials: AddProgramMaterialPayload[];
}

export interface ProgramOutputPayload {
  department: "sampling" | "plant";
  remark: string;
}

export interface ProgramClaimPayload {
  department: "sampling" | "plant";
}

export interface ProgramActivityReplyPayload {
  remark: string;
}

export interface ProgramSeenPayload {
  department: "sampling" | "plant";
  actor_name?: string | null;
}

export interface SampleRequestItem {
  id: string | number;
  srNumber?: string;
  year?: string;
  productDescription?: string;
  customer?: string;
  targetPlant?: string;
  dateRequestCreated?: string;
  createdBy?: string;
  requestCreatedBy?: string;
  createdByUserId?: number | null;
  materialCode?: string;
  requestCode?: string;
  requestCodes?: Partial<Record<"design" | "mockup" | "costing", string>>;
  barcode?: string;
  customerProductCode?: string;
  sourceSampleCode?: string;
  sourceRequestId?: number;
  sourceSampleRequestId?: number;
  sampleRequiredDate?: string;
  costingRequiredDate?: string | null;
  costingCreativeInputNeeded?: boolean;
  costingCreativeInputRemark?: string | null;
  costingCounterDate?: string | null;
  costingOutputPath?: string | null;
  status?: SampleStatus | string;
  isActive?: boolean;
  is_closed?: boolean;
  closure?: any;
  creationMode?: string;
  programYear?: string;
  programName?: string;
  programCampaignTitle?: string;
  programMaterials?: ProgramMaterialItem[];
  samplingSeenAt?: string | null;
  samplingSeenBy?: string | null;
  samplingVerdict?: string | null;
  samplingRemark?: string | null;
  samplingSignedAt?: string | null;
  samplingSignedBy?: string | null;
  samplingClaimedByUserId?: number | null;
  samplingClaimedBy?: string | null;
  plantSeenAt?: string | null;
  plantSeenBy?: string | null;
  plantVerdict?: string | null;
  plantRemark?: string | null;
  plantSignedAt?: string | null;
  plantSignedBy?: string | null;
  plantClaimedByUserId?: number | null;
  plantClaimedBy?: string | null;
  requestTypes?: RequestType[];
  scopeReferenceImages?: Partial<Record<"sample" | "mockup" | "costing", Array<{
    id: number;
    name: string;
    contentType?: string;
    originalSizeBytes?: number | null;
    sizeBytes?: number;
    url?: string;
  }>>>;
  requestKind?: "sample" | "design" | "feasibility" | "program";
  updatedAt?: string;
  samplingFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  samplingFeasibilityRemark?: string | null;
  samplingFeasibilityApprovedBy?: string | null;
  plantFeasibilityResponse?: "Yes" | "No" | "Maybe" | null;
  plantFeasibilityRemark?: string | null;
  feasibilityClosedAt?: string | null;
  feasibilityClosedBy?: "plant" | "sampling" | string | null;
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
  marketingDecision?: "Accepted" | "Rejected" | "accepted" | "remaining_requested" | string | null;
  marketingDecisionBy?: string | null;
  marketingDecisionAt?: string | null;
  marketingDecisionRemark?: string | null;
  takenBySamp?: string | null;
  takenBySampUserId?: number | null;
  takenAtSamp?: string | null;
  convertedSampleRequestId?: number | string | null;
  convertedSrNumber?: string | null;
  convertedRequestCode?: string | null;
  convertedRequestTypes?: Array<"sample" | "mockup" | "costing">;
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
  requiredDate?: string;
  requestRaisedAt?: string;
  createdAt?: string;
  productImagePath?: string;
  referenceImage?: string | null;
  productType?: string;
  productTypeNavneet?: string;
  productTypeNewCustomer?: string;

  // Design Request & Staging Attributes
  designRequestId?: number;
  sampleRequestId?: number | null;
  designRequestStatus?: string;
  designRequestCreatedAt?: string | null;
  designRemarks?: string | null;
  creativeSubmissions?: any[];
  marketingDesignDecision?: "awaiting_marketing_review" | "remaining_requested" | "accepted" | null;
  remainingDesignCount?: number;
  numberOfDesigns?: number;
  designRequiredDate?: string | null;
  trend?: string | null;
  targetAudience?: string | null;
  releasedAt?: string | null;
  claimedBy?: string | null;
  claimedByUserId?: number | null;
  claimedAt?: string | null;
  isCounterDateActive?: boolean;
  proposedTargetDate?: string | null;
  counterDateReason?: string | null;
  counterDateRequestedAt?: string | null;
  counterDateDecisionNotes?: string | null;
  counterDateRequestedBy?: string | null;
  workflowEvents?: Array<Record<string, any>>;
  workflowNotes?: Array<Record<string, any>>;
  workflowState?: Record<string, any>;
  designsCustomerCreative?: string;
  productArtworkNos?: string | number;
  targetArtworkDateCreative?: string;
  targetArtworkDateStudio?: string;
  mockupRequired?: string;
  mockupWorkflowState?: MockupWorkflowState;
  productCategory?: string;
  productSubCategory?: string;
  productThirdCategory?: string;
  unitPcPack?: string | number;
  qtyPerPack?: string | number;
  qtyForSampling?: string | number;
  qtyForMockup?: string | number;
  qtyDesignCosting?: string | number;
  brandName?: string;
  customDetails?: Array<{
    id?: number;
    className?: string;
    class_name?: string;
    characteristicName?: string;
    characteristic_name?: string;
    value: string | null;
    uom?: string | null;
  }>;
}

export interface MockupWorkflowEvent {
  id?: string;
  action: string;
  title: string;
  actorName: string;
  actorDepartment: string;
  timestamp: string;
  mockupUrl?: string;
  remark?: string | null;
}

export type DesignFollowupScope = "mockup" | "sample";

export interface DesignFollowupArtwork {
  designNumber: string;
  description: string;
  shutterstockNo: string;
  remarks: string;
  designFileUrl: string;
  submittedAt: string;
}

export interface DesignFollowupSelection {
  designs: DesignFollowupArtwork[];
  requestedAt?: string;
  requestedBy?: string;
}

export interface MockupWorkflowState {
  stage: "marketing" | "awaiting_design_acceptance" | "creative" | "studio" | "creative_approval" | "sampling_review" | "awaiting_marketing_acceptance" | "awaiting_marketing_direction" | "done" | string;
  designNeeded?: boolean;
  isResample?: boolean;
  creativeBypassed?: boolean;
  designFollowups?: Partial<Record<DesignFollowupScope, DesignFollowupSelection>>;
  creativeInputNeeded?: boolean;
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
  samplingRouting?: {
    stage?: "marketing" | "creative" | "studio" | "creative_approval" | "sampling_review" | "plant" | string;
    creativeChangesRequired?: boolean;
    isResample?: boolean;
    isDesignVariant?: boolean;
    variantNumber?: number;
    creativePendingCharacteristicKeys?: Array<{ className: string; characteristicName: string }>;
    changedAt?: string;
    creativeDueAt?: string;
    creativeDelayed?: boolean;
    studioRevisionRemark?: string;
    creativeArtworkDecision?: "accept" | "request_revision";
    creativeArtworkDecisionAt?: string;
    samplingReleasedAt?: string;
    samplingReleasedBy?: string;
  };
  studioSubmittedAt?: string;
  submittedToCreativeAt?: string;
  submittedToCreativeBy?: string;
  creativeApprovalDueAt?: string;
  creativeApprovalActualAt?: string;
  creativeApprovalLate?: boolean;
  creativeApprovalDecision?: "accept" | "request_revision";
  creativeApprovedAt?: string;
  creativeRevisionRemark?: string;
  marketingDecision?: "accept" | "request_revision" | "request_new_mockup" | "close";
  marketingRevisionRemark?: string;
  releasedToCreativeAt?: string;
  sentToStudioAt?: string;
  sentToStudioBy?: string;
  mockupUrl?: string;
  mockupRevisionHistory?: Array<{ url: string; submittedAt?: string; submittedBy?: string; archivedAt?: string }>;
  mockupRevisionNumber?: number;
  studioRevisionRejectRemark?: string;
  submittedToMarketingAt?: string;
  submittedToMarketingBy?: string;
  claimedBy?: string;
  claimedByUserId?: number;
  claimedAt?: string;
  claimedStage?: "creative" | "studio" | "creative_approval" | "sampling_review" | "awaiting_marketing_acceptance" | "awaiting_marketing_direction";
  plantReleasedAt?: string;
  plantReleasedBy?: string;
  plantReleaseTarget?: string;
  samplingRemark?: string;
  samplingFeedback?: string;
  samplingFeedbackAt?: string;
  samplingFeedbackBy?: string;
  samplingReviewDecision?: "approve" | "return";
  samplingReviewRemark?: string;
  samplingReviewedAt?: string;
  samplingReviewedBy?: string;
  events?: MockupWorkflowEvent[];
}

export type RequestTypeSelectedAt = Partial<Record<RequestType, string | null>>;

export interface CreateSampleRequestForm {
  clientDraftKey?: string;
  srNumber?: string;
  year?: string;
  programYear?: string;
  productDescription?: string;
  programName?: string;
  customer: string;
  targetPlant: string;
  materialCode?: string;
  sourceRequestCode?: string;
  barcode?: string;
  customerProductCode?: string;
  sourceSampleCode?: string;
  sampleRequiredDate?: string;
  productType?: string;
  productCategory?: string;
  productSubCategory?: string;
  productThirdCategory?: string;
  brandName?: string;
  productTypeNavneet?: string;
  productTypeNewCustomer?: string;
  unitPcPack?: string | number;
  qtyPerPack?: string | number;
  qtyDesignCosting?: string | number;
  costingRequiredDate?: string | null;
  costingCreativeInputNeeded?: boolean;
  costingCreativeInputRemark?: string | null;
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
    className?: string;
    class_name?: string;
    characteristicName?: string;
    characteristic_name?: string;
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
  scopeReferenceImages?: Partial<Record<"sample" | "mockup" | "costing", Array<{
    url: string;
    name?: string;
    originalSizeBytes?: number;
  }>>>;
  trend?: string;
  targetAudience?: string;
  numberOfDesigns?: number;
  designRemarks?: string;
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
  creation_mode: "material_code" | "binding" | string;
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
  items: Array<Record<string, any>>;
}

export interface BatchCreateSampleRequestResponse {
  success: boolean;
  message: string;
  total_created: number;
  requests: SampleRequestItem[];
}

export type {
  DesignRequest,
  CreativeDesignOutputRow,
  CreativeDesignSubmission,
  DesignRequestForm,
  CreativeBriefItem,
} from "@/features/creative/types";

export type {
  PlantItem,
  CreatePlantForm,
  CustomerItem,
  BindingHierarchyResponse,
  ProductSearchResult,
} from "@/types/master";

export interface DielineItem {
  id: string;
  dielineCode: string;
  srNumber: string;
  boxFormat: "Rigid Box" | "Folding Carton" | "Flute Corrugated" | "Blister / Sleeve";
  title: string;
  client: string;
  dimensions: string;
  substrate: string;
  caliperMicrons: number;
  machineCompatibility: string;
  status: "CAD Intake" | "Dieline Construction" | "3D Simulation" | "Plotter Sample Tested" | "Laser Die Cleared";
  dueDate: string;
  targetPlant: string;
  fluteGrade?: string;
  grainDirection: "Parallel to Spine" | "Perpendicular to Crease";
  fileFormats: string[];
}

export interface CostingItem {
  id: string;
  costingCode: string;
  srNumber: string;
  customer: string;
  productTitle: string;
  targetVolume: number;
  substrateUnitCost: number;
  conversionUnitCost: number;
  netUnitCost: number;
  marginPct: number;
  quotedUnitPrice: number;
  totalProjectValue: number;
  status: "Spec Review" | "Substrate Pricing" | "Margin Review" | "Quote Released" | "Won Deal";
  dueDate: string;
  targetPlant: string;
  substrateSpec: string;
}


