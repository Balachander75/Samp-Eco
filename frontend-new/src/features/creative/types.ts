export interface CreativeDesignOutputRow {
  designNumber: string;
  description: string;
  shutterstockNo: string;
  remarks: string;
}

export interface CreativeDesignSubmission {
  submittedAt: string;
  designFileUrl: string;
  rows: CreativeDesignOutputRow[];
}

export interface DesignRequest {
  id: number;
  sampleRequestId?: number | null;
  srNumber?: string;
  requestCode?: string;
  customerName: string;
  programName: string;
  programYear: string;
  targetPlant?: string;
  numberOfDesigns: number;
  trend?: string | null;
  targetAudience?: string | null;
  referenceImage?: string | null;
  productDescription: string;
  designRequiredDate?: string | null;
  designRemarks?: string | null;
  referenceImages?: string[];
  referenceLinks?: string[];
  creativeSubmissions?: CreativeDesignSubmission[];
  marketingDecision?: "awaiting_marketing_review" | "remaining_requested" | "accepted" | null;
  remainingDesignCount?: number;
  acceptedDesignNumbers?: string[];
  releasedAt?: string | null;
  claimedBy?: string | null;
  claimedByUserId?: number | null;
  claimedAt?: string | null;
  samplingClaimedBy?: string | null;
  samplingClaimedByUserId?: number | null;
  samplingClaimedAt?: string | null;
  isCounterDateActive?: boolean;
  counterDateOriginalTargetDate?: string | null;
  proposedTargetDate?: string | null;
  counterDateReason?: string | null;
  counterDateRequestedAt?: string | null;
  counterDateDecision?: "pending" | "accepted" | "rejected" | "auto_accepted" | null;
  counterDateDecisionAt?: string | null;
  counterDateDecisionNotes?: string | null;
  counterDateRequestedBy?: string | null;
  workflowEvents?: Array<Record<string, any>>;
  workflowNotes?: Array<Record<string, any>>;
  workflowState?: Record<string, any>;
  status: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignRequestForm {
  customerName: string;
  programName: string;
  programYear: string;
  numberOfDesigns: string;
  trend: string;
  targetAudience: string;
  referenceImage: string;
  productDescription: string;
  designRequiredDate: string;
  designRemarks?: string;
  referenceImages?: string[];
  referenceLinks?: string[];
}

export interface CreativeBriefItem {
  id: string;
  artCode: string;
  srNumber: string;
  title: string;
  brand: string;
  category: "Notebook Covers" | "Rigid Packaging" | "Tin / Metal Containers" | "Stationery Packs";
  variantsCount: number;
  designer: string;
  colorSpecs: string;
  proofVersion: string;
  proofStatus: "Brief Intake" | "In Concept" | "Client Review" | "Revisions Requested" | "Prepress Approved";
  dueDate: string;
  dimensions: string;
  finishingNotes: string;
  cmykCheckPassed: boolean;
  resolutionDpi: number;
  bleedMm: number;
  clientFeedback?: string;
  accentColor: string;
}
