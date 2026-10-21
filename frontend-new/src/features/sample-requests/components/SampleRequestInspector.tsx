import { readAuthUser } from "@/lib/session";
import type { UserProfile } from "@/features/auth";
import { UniversalChatterFeed, UniversalChatterEvent } from "./common/UniversalChatterFeed";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Calendar,
  AlertTriangle,
  Layers,
  Palette,
  Send,
  Clock,
  CheckCircle2,
  Beaker,
  Factory,
  Search,
  FileText,
  Box,
  Truck,
  Lock,
  Edit3,
  Download,
  Printer,
  FileSpreadsheet,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import {
  SampleRequestItem,
  MockupWorkflowState,
  ProgramMaterialItem,
} from "../types";
import {
  fetchProductDetailsApi,
  saveProductDetailsApi,
  ProductDetailItem,
} from "@/infrastructure/api/masterApi";
import {
  releaseSampleToPlantApi,
  submitSamplingFeedbackApi,
  sendMockupRequestToStudioApi,
  submitStudioMockupToMarketingApi,
  decideSamplingCreativeArtworkApi,
  claimMockupRequestApi,
  decideMockupMarketingAcceptanceApi,
  rejectStudioMockupRevisionApi,
} from "@/infrastructure/api/sampleRequestsApi";
import { formatOdooDate } from "../utils/dateUtils";
import { ImageLightboxModal } from "./inspector/ImageLightboxModal";
import { fetchSampleRequestByIdApi } from "@/infrastructure/api/sampleRequestsApi";
import { isMockupCreativeCharacteristic } from "./staging/mockupCreativeFields";
import { MockupControlPanel, MockupSheetHeader } from "./mockup";
import type { RequestClosureTarget } from "./common/RequestClosureControl";
import { ProductDocketView } from "./staging/ProductDocketView";
import { DocketSkeleton } from "@/components/ui/loading";
import type { ProductSearchResult } from "../types";
import { getPrimaryRequestCode } from "../sampling/utils/requestTypeUtils";

const getDisplayedRequestCode = getPrimaryRequestCode;

// Domain Parsers & Types Re-exports for backward compatibility
import {
  ParsedMatrixRow,
  ParsedImageRef,
  ParsedFeasibilityDetails,
  FEASIBILITY_TYPES,
  getFeasibilityTypeDisplay,
  getFeasibilityTypeId,
  parseFeasibilityDetails,
  formatAddedDate,
  parseProgramMatrix,
} from "../utils/feasibilityParsers";

export type { ParsedMatrixRow, ParsedImageRef, ParsedFeasibilityDetails };
export {
  FEASIBILITY_TYPES,
  getFeasibilityTypeDisplay,
  getFeasibilityTypeId,
  parseFeasibilityDetails,
  formatAddedDate,
  parseProgramMatrix,
};

export interface SampleRequestInspectorProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateFeasibility?: (
    requestId: string | number,
    team: "plant" | "sampling",
    response: "Yes" | "No" | "Maybe",
    remark?: string
  ) => Promise<void> | void;
  onMarketingApprove?: (
    requestId: string | number,
    approved: boolean,
    remark?: string
  ) => Promise<void> | void;
  onMaterialsUpdated?: (
    requestId: string | number,
    updatedMaterials: ProgramMaterialItem[]
  ) => void;
  onReleaseDraft?: (request: SampleRequestItem) => Promise<void> | void;
  isAdmin?: boolean;
  readOnly?: boolean;
  role?: "marketing" | "creative" | "studio" | "sampling" | "plant";
  actorName?: string;
  actorUserId?: number;
  onRefresh?: () => Promise<void> | void;
}

type InspectorTab = "specs" | "creative" | "studio" | "sampling" | "plant";

const KHANIWADE_PLANT_TARGET = "1505 - Khaniwade";

interface ChatterMessage {
  id: string;
  actorName: string;
  actorDepartment: string;
  action: string;
  title: string;
  body: string;
  timestamp: string;
  isNote?: boolean;
}

export const SampleRequestInspector: React.FC<SampleRequestInspectorProps> = ({
  request,
  isOpen,
  onClose,
  isAdmin = false,
  readOnly = false,
  role = "marketing",
  actorName,
  actorUserId,
  onRefresh,
}) => {
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);
  const activeRequest = localOverride || request;

  // Active Tab: defaulted intelligently based on user role
  const currentUser = useMemo(() => {
    const sessionUser = readAuthUser<UserProfile>();
    if (sessionUser) return sessionUser;
    if (actorName) {
      return {
        id: actorUserId || 0,
        name: actorName,
        userid: actorName.toLowerCase().replace(/\s+/g, "."),
        team: role,
        role: role,
      } as UserProfile;
    }
    return null;
  }, [actorName, actorUserId, role]);

  const initialTab = useMemo<InspectorTab>(() => {
    if (role === "creative") return "creative";
    if (role === "studio") return "studio";
    if (role === "sampling") return "sampling";
    if (role === "plant") return "plant";
    return "specs";
  }, [role]);

  const [activeTab, setActiveTab] = useState<InspectorTab>(initialTab);
  const [copiedCode, setCopiedCode] = useState(false);

  // Specifications & Characteristics state
  const [productDetails, setProductDetails] = useState<ProductDetailItem[]>([]);
  const [scopeReferenceImages, setScopeReferenceImages] = useState<NonNullable<SampleRequestItem["scopeReferenceImages"]>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [charSearchQuery, setCharSearchQuery] = useState("");
  const [charFilter, setCharFilter] = useState<"all" | "configured" | "docket">("docket");
  const [isExportingDocketPdf, setIsExportingDocketPdf] = useState(false);
  const [isExportingDocketCsv, setIsExportingDocketCsv] = useState(false);

  // Creative section state
  const [creativeShutterstockNo, setCreativeShutterstockNo] = useState("");
  const [creativeRemark, setCreativeRemark] = useState("");
  const [isSavingCreative, setIsSavingCreative] = useState(false);
  const [creativeFeedback, setCreativeFeedback] = useState<string | null>(null);
  const [mockupDecisionRemark, setMockupDecisionRemark] = useState("");
  const [mockupDecisionFeedback, setMockupDecisionFeedback] = useState<string | null>(null);
  const [isSavingMockupDecision, setIsSavingMockupDecision] = useState(false);

  // Task Claiming State
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Studio section state
  const [studioMockupUrl, setStudioMockupUrl] = useState("");
  const [studioRevisionRejectRemark, setStudioRevisionRejectRemark] = useState("");
  const [isRejectingStudioRevision, setIsRejectingStudioRevision] = useState(false);
  const [isSavingStudio, setIsSavingStudio] = useState(false);
  const [studioFeedback, setStudioFeedback] = useState<string | null>(null);

  // Sampling Team section state (No Feasible/Infeasible selection as requested)
  const [samplingRemark, setSamplingRemark] = useState("");
  const [targetPlant, setTargetPlant] = useState(KHANIWADE_PLANT_TARGET);
  const [isReleasingToPlant, setIsReleasingToPlant] = useState(false);
  const [isSavingSamplingFeedback, setIsSavingSamplingFeedback] = useState(false);
  const [samplingFeedbackMessage, setSamplingFeedbackMessage] = useState<string | null>(null);

  // Chatter State
  const [internalNotes, setInternalNotes] = useState<ChatterMessage[]>([]);

  // Lightbox Preview Image state
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeHandlerRef = useRef(onClose);
  const selectedPreviewImageRef = useRef(selectedPreviewImage);
  closeHandlerRef.current = onClose;
  selectedPreviewImageRef.current = selectedPreviewImage;

  // Reset and synchronize on request id change
  useEffect(() => {
    setLocalOverride(null);
    setCreativeFeedback(null);
    setStudioFeedback(null);
    setSamplingFeedbackMessage(null);
    setClaimError(null);
    setActiveTab(initialTab);
    setCharFilter("docket");
    setCopiedCode(false);
    setScopeReferenceImages({});
  }, [request?.id, initialTab]);

  // Load internal notes from localStorage
  useEffect(() => {
    if (!activeRequest?.id) return;
    try {
      const stored = localStorage.getItem(`samp_notes_${activeRequest.id}`);
      if (stored) {
        setInternalNotes(JSON.parse(stored));
      } else {
        setInternalNotes([]);
      }
    } catch {
      setInternalNotes([]);
    }
  }, [activeRequest?.id]);

  // Load custom specifications / details for this product
  useEffect(() => {
    if (!isOpen || !activeRequest?.id) return;
    const numericId = Number(String(activeRequest.id).replace(/^sample-/, ""));
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    let cancelled = false;
    setIsLoadingDetails(true);
    setScopeReferenceImages(activeRequest.scopeReferenceImages || {});

    fetchProductDetailsApi(numericId, false)
      .then((details: any[]) => {
        if (cancelled) return;
        setProductDetails(details);
      })
      .catch((err: any) => {
        console.warn("Could not load product inspection details:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });

    fetchSampleRequestByIdApi(numericId)
      .then((detail) => {
        if (!cancelled) setScopeReferenceImages(detail.scopeReferenceImages || {});
      })
      .catch((err: any) => console.warn("Could not load request reference images:", err));

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeRequest?.id]);

  // Prepopulate state from mockupWorkflowState / sample request fields
  useEffect(() => {
    if (!activeRequest) return;
    const ws: Partial<MockupWorkflowState> = activeRequest.mockupWorkflowState || {};
    setCreativeShutterstockNo(ws.creativeShutterstockNo || "");
    setCreativeRemark(ws.creativeRemark || "");
    setStudioMockupUrl(ws.mockupUrl || "");
    setStudioRevisionRejectRemark(ws.studioRevisionRejectRemark || "");
    setMockupDecisionRemark(ws.marketingRevisionRemark || ws.creativeRevisionRemark || "");
    setSamplingRemark(ws.samplingFeedback || activeRequest.samplingRemark || "");
    const savedPlant = activeRequest.targetPlant || ws.plantReleaseTarget;
    const hasAlreadyBeenReleased = Boolean(
      ws.plantReleasedAt || String(activeRequest.status || "").toLowerCase().includes("released to plant")
    );
    setTargetPlant(hasAlreadyBeenReleased && savedPlant ? savedPlant : KHANIWADE_PLANT_TARGET);
  }, [activeRequest]);

  // Keep keyboard focus inside the inspector and return it to the opener.
  useEffect(() => {
    if (!isOpen || !activeRequest) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedPreviewImageRef.current) {
          setSelectedPreviewImage(null);
        } else {
          closeHandlerRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusableSelector = "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [contenteditable='true'], [tabindex]:not([tabindex='-1'])";
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
      if (!focusables.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, activeRequest?.id]);

  const handleCopyCode = () => {
    if (!activeRequest) return;
    const code = getDisplayedRequestCode(activeRequest);
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Group characteristics by class
  const groupedCharacteristics = useMemo(() => {
    const map = new Map<string, ProductDetailItem[]>();
    const query = charSearchQuery.toLowerCase().trim();

    productDetails.forEach((detail) => {
      const isConfigured = detail.value && !["NA", "N/A", "NULL", "NONE", "-"].includes(detail.value.trim().toUpperCase());

      if (charFilter === "configured" && !isConfigured) return;

      if (query) {
        const matchesClass = detail.className.toLowerCase().includes(query);
        const matchesName = detail.characteristicName.toLowerCase().includes(query);
        const matchesVal = (detail.value || "").toLowerCase().includes(query);
        if (!matchesClass && !matchesName && !matchesVal) return;
      }

      const list = map.get(detail.className) || [];
      list.push(detail);
      map.set(detail.className, list);
    });

    return Array.from(map.entries());
  }, [productDetails, charSearchQuery, charFilter]);

  const sampleDocketProduct = useMemo<ProductSearchResult & { brand?: string; brandName?: string }>(() => {
    if (!activeRequest) return {} as any;
    return {
      id: Number(String(activeRequest.id).replace(/^sample-/, "")),
      sr_number: getDisplayedRequestCode(activeRequest),
      material_code: activeRequest.materialCode || "",
      product_description: activeRequest.productDescription || "",
      customer: activeRequest.customer || "",
      target_plant: activeRequest.targetPlant || "",
      source_sample_code: [activeRequest.barcode, activeRequest.customerProductCode].filter(Boolean).join(" / "),
      product_category: activeRequest.productCategory || "",
      product_sub_category: activeRequest.productSubCategory || "",
      product_third_category: activeRequest.productThirdCategory || "",
      brand: activeRequest.brandName || "",
      brandName: activeRequest.brandName || "",
    };
  }, [activeRequest]);

  // Workflow Gates & Status Flags
  const ws: Partial<MockupWorkflowState> = activeRequest?.mockupWorkflowState || {};
  const isDirectCatalogSample = useMemo(() => {
    if (!activeRequest) return false;
    const scopes = activeRequest.requestTypes || [];
    const isMockup = scopes.includes("mockup");
    const isDesign = scopes.includes("design");
    const hasCreative = (activeRequest as any).hasCreativeChanges ||
      (activeRequest as any).creativeCharacteristicsCleared ||
      ws.creativeChangesRequired ||
      ws.samplingRouting?.creativeChangesRequired;
    return !isMockup && !isDesign && !hasCreative;
  }, [activeRequest, ws]);

  const requestTypes = activeRequest?.requestTypes || [];
  const isMockupRequest = requestTypes.includes("mockup") || String(activeRequest?.mockupRequired || "").toLowerCase() === "yes";
  const hasSampleScope = requestTypes.includes("sample");
  const closureRequests: RequestClosureTarget[] = [];
  const requestIdText = String(activeRequest?.id || "");
  const isProgramRequest = activeRequest?.requestKind === "program" || requestIdText.startsWith("program-");
  if (activeRequest && !isProgramRequest) {
    if (activeRequest.requestKind === "feasibility" || requestIdText.startsWith("feasibility-")) {
      const feasibilityId = Number(requestIdText.replace(/^feasibility-/, ""));
      if (feasibilityId > 0) closureRequests.push({ type: "feasibility", id: feasibilityId });
    } else {
      if (activeRequest.designRequestId && Number(activeRequest.designRequestId) > 0) {
        closureRequests.push({ type: "design", id: activeRequest.designRequestId });
      }
      if (isMockupRequest) closureRequests.push({ type: "mockup", id: activeRequest.id });
      if (hasSampleScope) closureRequests.push({ type: "sample", id: activeRequest.id });
      if (requestTypes.includes("costing")) closureRequests.push({ type: "costing", id: activeRequest.id });
      if (!closureRequests.length) closureRequests.push({ type: "sample", id: activeRequest.id });
    }
  }
  const visibleClosureRequests = closureRequests.filter(({ type }) => {
    if (isAdmin) return true;
    if (role === "marketing") return true;
    if (role === "creative" || role === "studio") return ["design", "mockup", "costing"].includes(type);
    if (role === "sampling") return ["mockup", "sample", "feasibility"].includes(type);
    if (role === "plant") return type === "sample";
    return false;
  });
  const canCloseRequest = Boolean(
    isAdmin ||
    (activeRequest && !readOnly && !currentUser?.is_team_head && visibleClosureRequests.some(({ type }) => {
      if (role === "marketing") return true;
      if (role === "creative" || role === "studio") return ["design", "mockup", "costing"].includes(type);
      if (role === "sampling") return ["mockup", "sample", "feasibility"].includes(type);
      if (role === "plant") return type === "sample";
      return false;
    }))
  );
  const isMockupOnly = isMockupRequest && !hasSampleScope;
  const isSamplingCreativeTask = hasSampleScope && !isMockupRequest
    && ws.samplingRouting?.creativeChangesRequired === true;
  const isCreativeBypassed = isMockupRequest && ws.designNeeded === false;

  const isCreativeDone = useMemo(() => {
    if (!activeRequest) return false;
    if (isDirectCatalogSample) return true;
    if (ws?.designNeeded === false && !ws?.creativeChangesRequired) return true;
    return Boolean(
      ws?.creativeCharacteristicsClearedAt ||
      ws?.creativeShutterstockNo ||
      ws?.creativeRemark ||
      ws?.stage === "studio" ||
      ws?.stage === "sampling" ||
      ws?.stage === "done" ||
      String(activeRequest.status || "").toLowerCase().includes("studio") ||
      String(activeRequest.status || "").toLowerCase().includes("sampling") ||
      String(activeRequest.status || "").toLowerCase().includes("released to plant")
    );
  }, [activeRequest, isDirectCatalogSample, ws]);

  const isStudioDone = useMemo(() => {
    if (!activeRequest) return false;
    if (isDirectCatalogSample) return true;
    return Boolean(
      ws?.mockupUrl ||
      ws?.stage === "sampling" ||
      ws?.stage === "done" ||
      String(activeRequest.status || "").toLowerCase().includes("sampling") ||
      String(activeRequest.status || "").toLowerCase().includes("released to plant")
    );
  }, [activeRequest, isDirectCatalogSample, ws]);

  const isReleasedToPlant = useMemo(() => {
    if (!activeRequest) return false;
    const s = String(activeRequest.status || "").toLowerCase();
    return s.includes("released to plant") || Boolean(ws?.plantReleasedAt);
  }, [activeRequest, ws]);
  const isPlantSampleTask = hasSampleScope && isReleasedToPlant;
  const isResample = Boolean(
    (activeRequest as any)?.isResample ||
    ws?.isResample ||
    ws?.samplingRouting?.isResample ||
    activeRequest?.creationMode === "resample"
  );

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ id: InspectorTab; label: string; icon: LucideIcon; badge?: string; count?: number }> = [
      { id: "specs", label: "Specifications & Scope", icon: FileText, count: productDetails.length },
    ];
    if (!isCreativeBypassed) {
      tabs.push({ id: "creative", label: "Creative Studio", icon: Palette, badge: isCreativeDone ? "Done" : "Pending" });
    }
    tabs.push({ id: "studio", label: "Studio Prepress & CAD", icon: Box, badge: isStudioDone ? "CAD Ready" : "Pending" });
    if (!isMockupOnly) {
      tabs.push({ id: "sampling", label: isResample ? "Plant Resample Route" : "Sampling Team Review", icon: Beaker, badge: isReleasedToPlant ? "Released" : "Review" });
      tabs.push({ id: "plant", label: "Plant Execution", icon: Factory, badge: "Open" });
    }
    return tabs;
  }, [isCreativeBypassed, isCreativeDone, isMockupOnly, isReleasedToPlant, isResample, isStudioDone, productDetails.length]);

  useEffect(() => {
    if (visibleTabs.some((tab) => tab.id === activeTab)) return;
    const fallbackTab = (role === "sampling" && visibleTabs.some((tab) => tab.id === "sampling"))
      ? "sampling"
      : isCreativeBypassed ? "studio" : "specs";
    setActiveTab(visibleTabs.some((tab) => tab.id === fallbackTab) ? fallbackTab : "specs");
  }, [activeTab, isCreativeBypassed, role, visibleTabs]);

  // Claim Status Logic
  const isTaskClaimed = Boolean(ws.claimedByUserId != null || ws.claimedBy);
  const claimedBy = ws.claimedBy || null;

  // Role Claim Verification
  const isClaimedByMe = Boolean(isTaskClaimed && (
    ws.claimedByUserId != null
      ? actorUserId != null && Number(ws.claimedByUserId) === Number(actorUserId)
      : actorName && claimedBy?.trim().toLocaleLowerCase() === actorName.trim().toLocaleLowerCase()
  ));

  const activeWorkflowStage = ws.stage || (isPlantSampleTask ? "plant" : "");
  const isTaskClaimedForActiveStage = Boolean(
    isTaskClaimed && (ws.claimedStage ? ws.claimedStage === activeWorkflowStage : true)
  );

  // Field Editing Permissions:
  // - Creative can enter Shutterstock No / Remarks once claimed when stage is creative.
  // - Studio can enter the prepress CAD URL once claimed when stage is studio.
  const canCreativeEdit = (role === "creative" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "creative";
  const canStudioEdit = (role === "studio" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "studio";
  const isSamplingStage = ws.stage === "sampling_review" || ws.stage === "sampling" || String(activeRequest?.status || "").toLowerCase().includes("sampling") || (!isReleasedToPlant && (activeRequest?.requestTypes || []).includes("sample"));
  const canSamplingReleaseVariant = (role === "sampling" || isAdmin) && !readOnly && (!isTaskClaimedForActiveStage || isClaimedByMe) && isSamplingStage && !isReleasedToPlant;
  const canCreativeApproveSampleArtwork = (role === "creative" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "creative_approval";
  const creativeDueAt = ws.samplingRouting?.creativeDueAt ? new Date(ws.samplingRouting.creativeDueAt) : null;
  const creativeIsLate = Boolean(ws.stage === "creative" && creativeDueAt && Date.now() > creativeDueAt.getTime());
  const isMarketingDecisionStage = ws.stage === "awaiting_marketing_acceptance" || ws.stage === "awaiting_marketing_direction";
  // Marketing owns the decision stage directly; claims are reserved for shared operational queues.
  const canMarketingDecide = (role === "marketing" || isAdmin) && !readOnly && isMarketingDecisionStage;
  const claimableStage = ["creative", "creative_approval", "studio", "sampling_review", "plant"].includes(String(activeWorkflowStage));
  const roleOwnsClaimableStage = role !== "marketing" && (
    isAdmin ||
    (role === "creative" && ["creative", "creative_approval"].includes(String(activeWorkflowStage))) ||
    (role === "studio" && activeWorkflowStage === "studio") ||
    (role === "sampling" && activeWorkflowStage === "sampling_review") ||
    (role === "plant" && activeWorkflowStage === "plant")
  );
  const hasMockupClaimTask = (isMockupRequest || isSamplingCreativeTask || isPlantSampleTask) && claimableStage && roleOwnsClaimableStage;
  const studioPreviewHref = /^https?:\/\//i.test(studioMockupUrl.trim()) ? studioMockupUrl.trim() : "";

  // Dynamic Chatter Stream Compilation
  const chatterEvents = useMemo<ChatterMessage[]>(() => {
    if (!activeRequest) return [];
    const events: ChatterMessage[] = [];

    // Base Intake Event
    const isMockup = (activeRequest.requestTypes || []).includes("mockup") || String(activeRequest.mockupRequired || "").toLowerCase() === "yes";
    const mockupOnly = isMockup && !(activeRequest.requestTypes || []).includes("sample");
    events.push({
      id: "event-init",
      actorName: activeRequest.createdBy || "Commercial Team",
      actorDepartment: "Marketing Intake",
      action: "REQUEST_CREATED",
      title: mockupOnly ? "Mockup request created" : "Commercial request staged",
      body: mockupOnly
        ? `Mockup request configured for ${activeRequest.customer || "Commercial Client"}.`
        : `Request configured for ${activeRequest.customer || "Commercial Client"}.${activeRequest.targetPlant ? ` Target dispatch plant set to ${activeRequest.targetPlant}.` : ""}`,
      timestamp: activeRequest.dateRequestCreated || activeRequest.createdAt || new Date().toISOString(),
    });

    if (ws.releasedToCreativeAt) {
      events.push({
        id: "event-creative-released",
        actorName: "Marketing Specialist",
        actorDepartment: "Commercial Desk",
        action: "ROUTED_CREATIVE",
        title: "Routed to Creative Work",
        body: "Specifications modified during staging; creative characteristics cleared for design customization.",
        timestamp: ws.releasedToCreativeAt,
      });
    }

    if (ws.creativeShutterstockNo || ws.creativeRemark) {
      events.push({
        id: "event-creative-submitted",
        actorName: ws.claimedBy || "Creative Lead",
        actorDepartment: "Creative Studio",
        action: "CREATIVE_RELEASED",
        title: "Creative Specs Released to Studio",
        body: `Shutterstock Ref: ${ws.creativeShutterstockNo || "None"} | Notes: ${ws.creativeRemark || "Artwork details confirmed"}`,
        timestamp: ws.sentToStudioAt || new Date().toISOString(),
      });
    }

    if (ws.mockupUrl) {
      events.push({
        id: "event-studio-artwork",
        actorName: "Studio Prepress Engineer",
        actorDepartment: "Studio CAD",
        action: "STUDIO_COMPLETED",
        title: "CAD & Artwork Released",
        body: `Dieline and production artwork delivered: ${ws.mockupUrl}`,
        timestamp: ws.studioSubmittedAt || ws.submittedToMarketingAt || new Date().toISOString(),
      });
    }

    for (const event of ws.events || []) {
      events.push({
        id: `workflow-${event.id || `${event.action}-${event.timestamp}`}`,
        actorName: event.actorName || "Operations",
        actorDepartment: event.actorDepartment || "Workflow",
        action: event.action,
        title: event.title || event.action.replace(/_/g, " "),
        body: event.remark || "Mockup workflow decision recorded.",
        timestamp: event.timestamp,
      });
    }

    if (ws.samplingFeedback || activeRequest.samplingRemark) {
      events.push({
        id: "event-sampling-eval",
        actorName: ws.samplingFeedbackBy || "Sampling Team Lead",
        actorDepartment: "Sampling PMT",
        action: "SAMPLING_EVALUATED",
        title: "Sampling Technical Evaluation",
        body: ws.samplingFeedback || activeRequest.samplingRemark || "Sample technical specifications validated.",
        timestamp: ws.samplingFeedbackAt || new Date().toISOString(),
      });
    }

    if ((ws.plantReleasedAt || isReleasedToPlant) && !(ws.events || []).some((event) => ["RESAMPLE_SENT_DIRECTLY_TO_PLANT", "SAMPLING_RELEASED_VARIANT_TO_PLANT"].includes(event.action))) {
      events.push({
        id: "event-plant-release",
        actorName: ws.plantReleasedBy || "Sampling Team",
        actorDepartment: "Plant Dispatch",
        action: "RELEASED_TO_PLANT",
        title: `Officially Released to Plant (${ws.plantReleaseTarget || activeRequest.targetPlant || "Khaniwade"})`,
        body: "Sampling package approved and transferred to plant production line queue.",
        timestamp: ws.plantReleasedAt || new Date().toISOString(),
      });
    }

    // Merge internal notes
    const combined = [...events, ...internalNotes];
    return combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeRequest, internalNotes, isReleasedToPlant, ws]);

  const universalChatterEvents = useMemo<UniversalChatterEvent[]>(() => {
    return chatterEvents.map((evt) => {
      const isSystem = !evt.isNote && ["REQUEST_CREATED", "ROUTED_CREATIVE", "RELEASED_TO_PLANT", "STATUS_CHANGED"].includes(evt.action);
      return {
        id: evt.id,
        kind: isSystem ? "system_announcement" : "bubble",
        actorName: evt.actorName || "Desk",
        actorDepartment: evt.actorDepartment || "Marketing",
        summary: evt.body || evt.title,
        timestamp: evt.timestamp,
      };
    });
  }, [chatterEvents]);

  // ── ACTION HANDLERS ──

  // 0. Claim Task Action
  const handleClaimTask = async () => {
    if (!activeRequest) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const updated = await claimMockupRequestApi(activeRequest.id);
      setLocalOverride(updated);
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setClaimError(err?.message || "Failed to claim task. Please retry.");
    } finally {
      setIsClaiming(false);
    }
  };

  // 1. Creative Save & Release to Studio CAD
  const handleCreativeRelease = async () => {
    if (!activeRequest) return;
    if (isSamplingCreativeTask && (!creativeShutterstockNo.trim() || !creativeRemark.trim())) {
      setCreativeFeedback("Enter both the Shutterstock reference and Creative remark before sending this variant to Studio.");
      return;
    }
    if (!isSamplingCreativeTask && !creativeShutterstockNo.trim() && !creativeRemark.trim()) {
      setCreativeFeedback("Please enter either a Shutterstock Number or a Remark (at least one is mandatory).");
      return;
    }
    setIsSavingCreative(true);
    setCreativeFeedback(null);
    try {
      if (isSamplingCreativeTask) {
        const savedDetails = await saveProductDetailsApi(Number(activeRequest.id), productDetails.map((detail) => ({
          className: detail.className,
          characteristicName: detail.characteristicName,
          value: detail.value == null ? null : String(detail.value),
          uom: detail.uom || null,
        })));
        if (!savedDetails) throw new Error("Creative specifications could not be saved. Please retry.");
      }
      const updated = await sendMockupRequestToStudioApi(activeRequest.id, actorName, {
        shutterstockNo: creativeShutterstockNo.trim(),
        remark: creativeRemark.trim(),
        creativeInputNeeded: !isSamplingCreativeTask,
      });

      setLocalOverride(updated);
      setCreativeFeedback(isSamplingCreativeTask
        ? "Creative specifications completed and sent to Studio for artwork."
        : "Creative specifications submitted and released to Studio CAD.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setCreativeFeedback(err?.message || "Failed to release specifications. Please retry.");
    } finally {
      setIsSavingCreative(false);
    }
  };

  const handleCreativeArtworkDecision = async (decision: "accept" | "request_revision") => {
    if (!activeRequest) return;
    if (decision === "request_revision" && !mockupDecisionRemark.trim()) {
      setCreativeFeedback("Add a revision note before returning artwork to Studio.");
      return;
    }
    setIsSavingMockupDecision(true);
    setCreativeFeedback(null);
    try {
      const updated = await decideSamplingCreativeArtworkApi(activeRequest.id, decision, mockupDecisionRemark.trim(), actorName);
      setLocalOverride(updated);
      setMockupDecisionRemark("");
      setCreativeFeedback(decision === "accept" ? "Artwork approved and sent to Sampling." : "Artwork returned to Studio for revision.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setCreativeFeedback(err?.message || "Could not save the Creative artwork decision.");
    } finally {
      setIsSavingMockupDecision(false);
    }
  };

  const handleMockupReviewDecision = async (decision: "accept" | "request_revision" | "request_new_mockup") => {
    if (!activeRequest) return;
    if (decision === "request_revision" && !mockupDecisionRemark.trim()) {
      setMockupDecisionFeedback("Please provide a revision note explaining what Studio should modify.");
      return;
    }
    setIsSavingMockupDecision(true);
    setMockupDecisionFeedback(null);
    try {
      const updated = await decideMockupMarketingAcceptanceApi(activeRequest.id, decision, mockupDecisionRemark.trim(), actorName);
      setLocalOverride(updated);
      setMockupDecisionRemark("");
      setMockupDecisionFeedback(
        decision === "accept" ? "Mockup accepted and finalized."
          : decision === "request_revision" ? "Revision request sent to Studio."
            : "New mockup requested from Studio."
      );
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setMockupDecisionFeedback(err?.message || "Could not save the mockup decision.");
    } finally {
      setIsSavingMockupDecision(false);
    }
  };

  // 2. Studio Artwork Submission & Release
  const handleStudioSubmit = async () => {
    if (!activeRequest || !studioMockupUrl.trim()) return;
    setIsSavingStudio(true);
    setStudioFeedback(null);
    try {
      const updated = await submitStudioMockupToMarketingApi(
        activeRequest.id,
        studioMockupUrl.trim(),
        actorName
      );
      setLocalOverride(updated);
      setStudioFeedback(isSamplingCreativeTask
        ? "Artwork submitted to Creative for approval."
        : "Studio output submitted directly to Marketing for acceptance.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setStudioFeedback(err?.message || "Failed to submit studio output. Please retry.");
    } finally {
      setIsSavingStudio(false);
    }
  };

  const handleStudioRevisionUnable = async () => {
    if (!activeRequest || !studioRevisionRejectRemark.trim()) return;
    setIsRejectingStudioRevision(true);
    setStudioFeedback(null);
    try {
      const updated = await rejectStudioMockupRevisionApi(activeRequest.id, studioRevisionRejectRemark.trim(), actorName);
      setLocalOverride(updated);
      setStudioFeedback("Marketing has been asked to choose whether to request a new mockup or close this request.");
      setStudioRevisionRejectRemark("");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setStudioFeedback(err?.message || "Could not return this revision to Marketing.");
    } finally {
      setIsRejectingStudioRevision(false);
    }
  };

  // 3. Sampling Team Feedback
  const handleSaveSamplingFeedback = async () => {
    if (!activeRequest || !samplingRemark.trim()) return;
    setIsSavingSamplingFeedback(true);
    setSamplingFeedbackMessage(null);
    try {
      const updated = await submitSamplingFeedbackApi(activeRequest.id, samplingRemark.trim());
      setLocalOverride(updated);
      setSamplingFeedbackMessage("✓ Technical evaluation remarks saved.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setSamplingFeedbackMessage(err?.message || "Could not save sampling feedback.");
    } finally {
      setIsSavingSamplingFeedback(false);
    }
  };

  // 4. Sampling Team Release Sample to Plant (Direct Release, No Feasible/Infeasible Buttons)
  const handleReleaseToPlant = async () => {
    if (!activeRequest) return;
    setIsReleasingToPlant(true);
    setSamplingFeedbackMessage(null);
    try {
      const updated = await releaseSampleToPlantApi(activeRequest.id, {
        targetPlant: KHANIWADE_PLANT_TARGET,
        samplingRemark: samplingRemark.trim(),
        actorName,
      });
      setLocalOverride(updated);
      setSamplingFeedbackMessage(`✓ Sample officially released to Plant (${KHANIWADE_PLANT_TARGET})!`);
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setSamplingFeedbackMessage(err?.message || "Failed to release sample to plant.");
    } finally {
      setIsReleasingToPlant(false);
    }
  };

  // ── EARLY RETURN AFTER ALL HOOKS ──
  if (!isOpen || !activeRequest) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--on-surface)]/40 backdrop-blur-xs animate-smooth-backdrop sm:p-4 select-text"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-inspector-title"
        className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] select-text xl:max-w-7xl animate-smooth-modal font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. TOP CONTROL PANEL (EXACT FEASIBILITY CHECK STYLE) ── */}
        <MockupControlPanel
          activeRequest={activeRequest}
          copiedCode={copiedCode}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          role={role}
          activeTab={activeTab}
          onSelectTab={(tabId) => setActiveTab(tabId)}
          isCreativeDone={isCreativeDone}
          isStudioDone={isStudioDone}
          isReleasedToPlant={isReleasedToPlant}
          closureRequests={visibleClosureRequests}
          canCloseRequest={canCloseRequest}
          onRequestClosed={onRefresh}
        />

        {/* ── 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + CHATTER) ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          
          {/* ── LEFT: FORM SHEET (DOCUMENT BODY) ── */}
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto bg-[var(--bg-app)] p-4 md:p-6">
            <div className={`mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden transition-all duration-300 ${
              activeTab === "specs" && charFilter === "docket" ? "max-w-[98%]" : "max-w-4xl"
            }`}>
              
              {/* ── 1. PRIMARY SECTION TABS (TOP - EXACT FEASIBILITY CHECK STYLE) ── */}
              <div className="px-6 sm:px-8 pt-3 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                  {visibleTabs.map((tab, idx) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                          isActive
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                            : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                        }`}
                      >
                        <span>{idx + 1}. {tab.label}</span>
                        {tab.count !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-base)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                            {tab.count}
                          </span>
                        )}
                        {tab.badge && (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                            tab.badge === "Done" || tab.badge === "Released" || tab.badge === "CAD Ready"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : tab.badge === "Open"
                              ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                              : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 2. DOCUMENT HERO & HEADER STRIP (EXACT FEASIBILITY CHECK STYLE) ── */}
              <MockupSheetHeader
                activeRequest={activeRequest}
                role={role}
                isClaimed={isTaskClaimed}
                claimedBy={claimedBy || undefined}
                canClaim={hasMockupClaimTask && !isTaskClaimed}
                isClaiming={isClaiming}
                onClaimTask={handleClaimTask}
                currentUserName={actorName || currentUser?.name || currentUser?.userid}
                currentUserId={actorUserId || currentUser?.id}
              />

              {claimError && (
                <div className="mx-6 sm:mx-8 mt-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">
                  {claimError}
                </div>
              )}

              {/* ── SAMPLING PMT ACTION & PLANT DISPATCH CONSOLE ── */}
              {(role === "sampling" || isAdmin) && !isMockupOnly && (
                <div className="px-4 sm:px-8 pt-3">
                  {isResample ? (
                    <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/25 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Factory className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-blue-950 dark:text-blue-200">
                              Direct Repeat Resample Route · Bypassed PMT Review
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200">
                              DIRECT TO PLANT
                            </span>
                          </div>
                          <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1">
                            Repeat order without creative modifications. Dispatched directly to <strong>{targetPlant || activeRequest.targetPlant || "Khaniwade"}</strong>.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : isReleasedToPlant ? (
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-950 dark:text-emerald-200">
                              Sample Successfully Released to Plant ({targetPlant})
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                              PRODUCTION IN PROGRESS
                            </span>
                          </div>
                          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                            Technical verification complete. Dispatched to plant manufacturing line queue.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/20 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Beaker className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider font-mono">
                            Sampling PMT Technical Verification &amp; Plant Dispatch
                          </h3>
                          <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80">
                            Assign manufacturing plant, input machine guidelines, and officially release this sample to production.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-[var(--on-surface)] uppercase font-mono">
                            Target Plant Destination
                          </label>
                          <select
                            value={targetPlant}
                            disabled={readOnly}
                            onChange={(e) => setTargetPlant(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-teal-500 focus:outline-none"
                          >
                            <option value={KHANIWADE_PLANT_TARGET}>Khaniwade Plant (1505)</option>
                          </select>
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="block text-[11px] font-bold text-[var(--on-surface)] uppercase font-mono">
                            Sampling Machine Guidelines &amp; Remarks
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              disabled={readOnly}
                              value={samplingRemark}
                              onChange={(e) => setSamplingRemark(e.target.value)}
                              placeholder="Tooling notes, board GSM adjustments, cylinder code, etc."
                              className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-teal-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={isSavingSamplingFeedback || !samplingRemark.trim() || !canSamplingReleaseVariant}
                              onClick={handleSaveSamplingFeedback}
                              className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-low)] text-xs font-semibold text-[var(--on-surface)] transition cursor-pointer disabled:opacity-50"
                            >
                              {isSavingSamplingFeedback ? "Saving…" : "Save Notes"}
                            </button>
                            <button
                              type="button"
                              disabled={isReleasingToPlant || !canSamplingReleaseVariant}
                              onClick={handleReleaseToPlant}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Factory className="w-3.5 h-3.5" />
                              <span>{isReleasingToPlant ? "Releasing…" : "Release to Plant"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {samplingFeedbackMessage && (
                        <div className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                          samplingFeedbackMessage.startsWith("✓")
                            ? "bg-emerald-100/70 text-emerald-900 border border-emerald-300"
                            : "bg-rose-100/70 text-rose-900 border border-rose-300"
                        }`}>
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{samplingFeedbackMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB CONTENT BODY ── */}
              <div className="p-4 sm:p-8 space-y-6">

                {/* ═════════ TAB 1: SPECIFICATIONS & SCOPE ═════════ */}
                {activeTab === "specs" && (
                  <div className="space-y-6">
                    {(role === "marketing" || isAdmin) && isMarketingDecisionStage && (
                      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-sm space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"><CheckCircle2 className="h-5 w-5" /></div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-bold text-[var(--on-surface)]">{ws.stage === "awaiting_marketing_direction" ? "Studio needs a decision" : "Mockup ready for Marketing review"}</h2>
                            <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
                              {ws.stage === "awaiting_marketing_direction"
                                ? "Studio cannot complete the requested change. Choose whether to send a new mockup directly to Studio or close this request."
                                : "Review the Studio mockup. Accept it or return it to Studio with the changes you need."}
                            </p>
                          </div>
                        </div>
                        {ws.stage === "awaiting_marketing_direction" ? (
                          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                            <span className="font-semibold">Studio’s note: </span>{ws.studioRevisionRejectRemark || "Studio cannot complete the requested revision."}
                          </div>
                        ) : studioPreviewHref ? (
                          <a href={studioPreviewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-container)]"><ExternalLink className="h-3.5 w-3.5" />Open Studio mockup</a>
                        ) : (
                          <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2 text-xs font-mono text-[var(--on-surface)] break-all">{ws.mockupUrl || "Studio output is missing."}</div>
                        )}
                        {ws.stage === "awaiting_marketing_acceptance" && (
                          <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-[var(--on-surface)]">Revision note <span className="font-normal text-[var(--on-surface-subtle)]">(required only when returning)</span></span>
                            <textarea rows={2} maxLength={1000} value={mockupDecisionRemark} onChange={(event) => setMockupDecisionRemark(event.target.value)} disabled={!canMarketingDecide} placeholder="Describe what Studio should change..." className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60" />
                          </label>
                        )}
                        {mockupDecisionFeedback && <p role="status" className="text-xs text-[var(--on-surface-muted)]">{mockupDecisionFeedback}</p>}
                        <div className="flex flex-wrap justify-end gap-2">
                          {ws.stage === "awaiting_marketing_direction" ? <>
                            <button type="button" disabled={!canMarketingDecide || isSavingMockupDecision} onClick={() => void handleMockupReviewDecision("request_new_mockup")} className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{isSavingMockupDecision ? "Saving..." : "Request new mockup from Studio"}</button>
                          </> : <>
                            <button type="button" disabled={!canMarketingDecide || isSavingMockupDecision || !mockupDecisionRemark.trim()} onClick={() => void handleMockupReviewDecision("request_revision")} className="rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-50">{isSavingMockupDecision ? "Saving..." : "Return to Studio"}</button>
                            <button type="button" disabled={!canMarketingDecide || isSavingMockupDecision} onClick={() => void handleMockupReviewDecision("accept")} className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{isSavingMockupDecision ? "Saving..." : hasSampleScope ? "Accept Mockup & Continue Sampling" : "Accept & Close Mockup"}</button>
                          </>}
                        </div>
                        {hasSampleScope && ws.stage === "awaiting_marketing_acceptance" && <p className="text-[11px] text-[var(--on-surface-subtle)]">Sampling remains open after the mockup is accepted.</p>}
                      </section>
                    )}
                    {/* Key Technical Information Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Customer / Brand</span>
                        <p className="text-xs font-semibold text-[var(--on-surface)]">{activeRequest.customer || "Commercial Account"}</p>
                        {activeRequest.brandName && (
                          <p className="text-[11px] text-[var(--on-surface-muted)]">Brand: {activeRequest.brandName}</p>
                        )}
                      </div>

                      {(!isMockupRequest || hasSampleScope) && <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Target Manufacturing Plant</span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                          <Factory className="w-3.5 h-3.5 text-teal-600" />
                          <span>{activeRequest.targetPlant || "Khaniwade Plant"}</span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">Sample Dispatch Destination</p>
                      </div>}

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Due &amp; Required Dates</span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isMockupRequest && !hasSampleScope ? "Mockup Required" : "Sample Due"}: {formatOdooDate(isMockupRequest && !hasSampleScope ? ws.requiredDate : activeRequest.sampleRequiredDate) || "Immediate"}</span>
                        </div>
                        {isMockupRequest && hasSampleScope && <p className="text-[11px] text-[var(--on-surface-muted)]">Mockup Required: {formatOdooDate(ws.requiredDate) || "—"}</p>}
                        {activeRequest.targetArtworkDateCreative && (
                          <p className="text-[11px] text-[var(--on-surface-muted)]">Artwork Target: {formatOdooDate(activeRequest.targetArtworkDateCreative)}</p>
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Deliverable Quantities</span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {hasSampleScope && <span className="font-semibold text-[var(--on-surface)]">Sampling: <strong className="font-mono text-emerald-600 font-bold">{activeRequest.qtyForSampling || 1}</strong> pcs</span>}
                          {isMockupRequest && <span className="font-semibold text-[var(--on-surface)]">Mockup: <strong className="font-mono text-[var(--accent-primary)] font-bold">{activeRequest.qtyForMockup || ws.qtyForMockup || "—"}</strong> pcs</span>}
                        </div>
                        {hasSampleScope && <p className="text-[11px] text-[var(--on-surface-muted)]">Pack: {activeRequest.qtyPerPack || "Standard"} / unit</p>}
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Material Reference</span>
                        <p className="text-xs font-mono font-bold text-[var(--on-surface)]">{activeRequest.materialCode || "Custom Staged Material"}</p>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">Mode: {activeRequest.creationMode || "Material & Binding Staged"}</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Category Taxonomy</span>
                        <p className="text-xs font-semibold text-[var(--on-surface)]">{activeRequest.productCategory || "Paper Stationery"}</p>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">{activeRequest.productSubCategory || "Books & Formats"}</p>
                      </div>
                    </div>

                    {(["sample", "mockup", "costing"] as const).some((scope) => (scopeReferenceImages[scope] || []).length > 0) && (
                      <section aria-label="Request reference images" className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Request Reference Images</h3>
                          <span className="text-[10px] text-[var(--on-surface-muted)]">Compressed attachments</span>
                        </div>
                        <div className="space-y-3">
                          {(["sample", "mockup", "costing"] as const).map((scope) => {
                            const images = scopeReferenceImages[scope] || [];
                            if (!images.length) return null;
                            return (
                              <div key={scope} className="flex flex-wrap items-center gap-2.5">
                                <span className="w-16 shrink-0 text-[10px] font-semibold capitalize text-[var(--on-surface-muted)]">{scope}</span>
                                {images.map((image) => (
                                  image.url ? (
                                    <button key={image.id} type="button" onClick={() => setSelectedPreviewImage(image.url || null)} className="group flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-left transition hover:border-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                                      <img src={image.url} alt={image.name} className="h-11 w-11 rounded-md object-cover" />
                                      <span className="max-w-40 truncate text-[10px] font-medium text-[var(--on-surface)]">{image.name}</span>
                                    </button>
                                  ) : (
                                    <span key={image.id} className="text-[10px] text-[var(--on-surface-muted)]">{image.name}</span>
                                  )
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Characteristics Explorer (Creative can edit all fields when claimed) */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-teal-600" />
                              <span>Product Characteristics &amp; Classes ({productDetails.length})</span>
                            </h3>
                            {canCreativeEdit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]">
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>Editable by Creative</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--on-surface-muted)]">
                            {canCreativeEdit
                              ? "As claimed Creative lead, you have permission to feed and modify any technical specifications below."
                              : "Technical specifications staged from Master Catalog & Binding."}
                          </p>
                        </div>

                        {/* Search & Filter pills */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={charSearchQuery}
                              onChange={(e) => setCharSearchQuery(e.target.value)}
                              placeholder="Search specs..."
                              className="pl-8 pr-3 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] w-36 sm:w-44"
                            />
                          </div>

                          {charFilter === "docket" && groupedCharacteristics.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isExportingDocketPdf}
                                onClick={async () => {
                                  try {
                                    setIsExportingDocketPdf(true);
                                    const { downloadProductDocketPdf } = await import("./staging/productDocketPdf");
                                    await downloadProductDocketPdf(sampleDocketProduct, groupedCharacteristics);
                                  } catch (err) {
                                    console.error("Failed to download PDF:", err);
                                  } finally {
                                    setIsExportingDocketPdf(false);
                                  }
                                }}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2 text-[10px] font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-low)] cursor-pointer disabled:opacity-50"
                                title="Download Complete Technical Docket PDF"
                              >
                                {isExportingDocketPdf ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-rose-500" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                <span>{isExportingDocketPdf ? "PDF..." : "PDF"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isExportingDocketCsv}
                                onClick={async () => {
                                  try {
                                    setIsExportingDocketCsv(true);
                                    const { downloadProductDocketCsv } = await import("./staging/productDocketPdf");
                                    await downloadProductDocketCsv(sampleDocketProduct, groupedCharacteristics);
                                  } catch (err) {
                                    console.error("Failed to download CSV:", err);
                                  } finally {
                                    setIsExportingDocketCsv(false);
                                  }
                                }}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-emerald-300/60 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60 cursor-pointer disabled:opacity-50"
                                title="Export Docket Specifications to CSV (Excel Ready)"
                              >
                                {isExportingDocketCsv ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-emerald-600" />
                                ) : (
                                  <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                )}
                                <span>{isExportingDocketCsv ? "CSV..." : "CSV"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const { printProductDocketView } = await import("./staging/productDocketPdf");
                                    printProductDocketView(sampleDocketProduct, `sample-request-docket-${activeRequest.id}`);
                                  } catch (err) {
                                    console.error("Failed to print docket:", err);
                                  }
                                }}
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 text-[10px] font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60 cursor-pointer"
                                title="Print or Save Complete Docket as PDF"
                              >
                                <Printer className="h-3 w-3" /> Print
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-1 bg-[var(--surface-low)] p-0.5 rounded-lg text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={() => setCharFilter("all")}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                charFilter === "all" ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs" : "text-[var(--on-surface-subtle)]"
                              }`}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setCharFilter("configured")}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                charFilter === "configured" ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs" : "text-[var(--on-surface-subtle)]"
                              }`}
                            >
                              Configured
                            </button>
                            <button
                              type="button"
                              onClick={() => setCharFilter("docket")}
                              aria-pressed={charFilter === "docket"}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                charFilter === "docket" ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs" : "text-[var(--on-surface-subtle)]"
                              }`}
                            >
                              Docket
                            </button>
                          </div>
                        </div>
                      </div>

                      {isLoadingDetails ? (
                        <DocketSkeleton sections={2} />
                      ) : groupedCharacteristics.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[var(--on-surface-subtle)] font-mono">
                          No characteristics matched your filter.
                        </div>
                      ) : charFilter === "docket" ? (
                        <>
                        <div className="overflow-x-auto rounded-xl border border-slate-300 bg-slate-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-950 sm:p-3">
                          <div className="min-w-[960px]">
                            <ProductDocketView
                              product={sampleDocketProduct}
                              classGroups={groupedCharacteristics}
                              searchQuery={charSearchQuery}
                              containerId={`sample-request-docket-${activeRequest.id}`}
                            />
                          </div>
                        </div>
                        <div className="hidden">
                          <table className="w-full min-w-[640px] text-left text-xs">
                            <thead className="bg-[var(--surface-low)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)]">
                              <tr>
                                <th className="px-3.5 py-2 font-semibold">Product class</th>
                                <th className="px-3.5 py-2 font-semibold">Characteristic</th>
                                <th className="px-3.5 py-2 font-semibold">Value</th>
                                <th className="px-3.5 py-2 font-semibold">UOM</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedCharacteristics.flatMap(([className, items]) => items.map((item, index) => (
                                <tr key={`${className}-${item.id || index}`} className="border-t border-[var(--border-subtle)]/70 hover:bg-[var(--surface-low)]/60">
                                  <td className="px-3.5 py-2 font-semibold text-[var(--on-surface)]">{className}</td>
                                  <td className="px-3.5 py-2 text-[var(--on-surface)]">{item.characteristicName}</td>
                                  <td className="px-3.5 py-2 font-mono text-[var(--on-surface)]">{item.value || <span className="font-sans italic text-[var(--on-surface-subtle)]">—</span>}</td>
                                  <td className="px-3.5 py-2 font-mono text-[11px] text-[var(--on-surface-muted)]">{item.uom || "—"}</td>
                                </tr>
                              ))) }
                            </tbody>
                          </table>
                        </div>
                        </>
                      ) : (
                        <div className="space-y-3 pt-2">
                          {groupedCharacteristics.map(([className, items]) => (
                            <div key={className} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] overflow-hidden">
                              <div className="px-3.5 py-2 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs">
                                <span className="font-bold text-[var(--on-surface)] uppercase font-mono tracking-wider">{className}</span>
                                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">{items.length} properties</span>
                              </div>
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)] bg-[var(--surface-lowest)]/50">
                                    <th className="px-3.5 py-1.5 font-semibold w-1/3">Characteristic</th>
                                    <th className="px-3.5 py-1.5 font-semibold">Value</th>
                                    <th className="px-3.5 py-1.5 font-semibold w-24">UOM</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((it, idx) => {
                                    const currentVal = it.value || "";

                                    return (
                                      <tr key={idx} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--surface-low)]/50 transition">
                                        <td className="px-3.5 py-2 font-medium text-[var(--on-surface)]">
                                          <span>{it.characteristicName}</span>
                                        </td>
                                        <td className="px-3.5 py-2">
                                          {isSamplingCreativeTask && canCreativeEdit && isMockupCreativeCharacteristic(it.className, it.characteristicName) ? (
                                            <input
                                              aria-label={`${it.className} ${it.characteristicName}`}
                                              value={currentVal}
                                              onChange={(event) => setProductDetails((current) => current.map((detail) =>
                                                detail.className === it.className && detail.characteristicName === it.characteristicName
                                                  ? { ...detail, value: event.target.value }
                                                  : detail))}
                                              className="w-full min-w-32 rounded-md border border-[var(--accent-primary)]/40 bg-[var(--surface-lowest)] px-2 py-1 font-mono text-xs text-[var(--on-surface)] outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30"
                                              placeholder="Creative value required"
                                            />
                                          ) : (
                                          <span className="font-mono text-[var(--on-surface)]">
                                            {currentVal || <span className="text-[var(--on-surface-subtle)] italic">—</span>}
                                          </span>
                                          )}
                                        </td>
                                        <td className="px-3.5 py-2 text-[var(--on-surface-muted)] font-mono text-[11px]">
                                          {it.uom || "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═════════ TAB 2: CREATIVE STUDIO ═════════ */}
                {!isCreativeBypassed && activeTab === "creative" && (
                  <div className="space-y-5">
                    {ws.designNeeded === false ? (
                      <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                            Creative Stage Bypassed
                          </h3>
                        </div>
                        <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90">
                          Marketing chose <strong>"No new design needed"</strong> during mockup configuration. The Creative team was eliminated from this request and the work routed directly to Studio CAD.
                        </p>
                        <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Marketing Shutterstock Ref</span>
                            <p className="font-mono font-semibold text-emerald-950 dark:text-emerald-100 mt-0.5">
                              {ws.creativeShutterstockNo || ws.marketingShutterstockNo || "None specified"}
                            </p>
                          </div>
                          <div>
                            <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Marketing Styling Remark</span>
                            <p className="font-medium text-emerald-950 dark:text-emerald-100 mt-0.5">
                              {ws.creativeRemark || ws.marketingRemark || "None specified"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : isSamplingCreativeTask && ws.stage === "creative_approval" ? (
                      <div className="rounded-2xl bg-emerald-50/70 p-5 space-y-4 dark:bg-emerald-950/20">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                          <div>
                            <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">Review Studio artwork</h3>
                            <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">Claim this Creative review, inspect the submitted artwork, then approve it for Sampling or return it to Studio with a clear revision note.</p>
                          </div>
                        </div>
                        {ws.mockupUrl && <a href={/^https?:\/\//i.test(ws.mockupUrl) ? ws.mockupUrl : undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[var(--surface-lowest)] px-3 py-2 text-xs font-semibold text-[var(--accent-primary-strong)]"><ExternalLink className="h-3.5 w-3.5" />Open Studio artwork</a>}
                        {creativeIsLate && <p className="text-xs font-semibold text-rose-700">Creative response is overdue.</p>}
                        <textarea rows={2} maxLength={1000} value={mockupDecisionRemark} onChange={(event) => setMockupDecisionRemark(event.target.value)} disabled={!canCreativeApproveSampleArtwork || isSavingMockupDecision} placeholder="Revision note for Studio (required only when returning)" className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--on-surface)] disabled:opacity-60" />
                        {creativeFeedback && <p role="status" className="text-xs text-[var(--on-surface-muted)]">{creativeFeedback}</p>}
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={!canCreativeApproveSampleArtwork || isSavingMockupDecision || !mockupDecisionRemark.trim()} onClick={() => void handleCreativeArtworkDecision("request_revision")} className="rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50">{isSavingMockupDecision ? "Saving..." : "Return to Studio"}</button>
                          <button type="button" disabled={!canCreativeApproveSampleArtwork || isSavingMockupDecision} onClick={() => void handleCreativeArtworkDecision("accept")} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50">{isSavingMockupDecision ? "Saving..." : "Approve for Sampling"}</button>
                        </div>
                      </div>
                    ) : isCreativeDone && ws.stage !== "creative" ? (
                      <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                            {isSamplingCreativeTask ? "Variant Specifications Sent to Studio" : "Creative Specifications Released to Studio CAD"}
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                          <div>
                            <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Asset / Shutterstock Ref</span>
                            <p className="font-mono font-semibold text-emerald-950 dark:text-emerald-100 mt-0.5">
                              {ws.creativeShutterstockNo || "—"}
                            </p>
                          </div>
                          <div>
                            <span className="font-mono text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Creative Remarks</span>
                            <p className="font-medium text-emerald-950 dark:text-emerald-100 mt-0.5">
                              {ws.creativeRemark || "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-sm space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--on-surface)]">Creative Brief &amp; Specifications</h3>
                          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
                            {isSamplingCreativeTask
                              ? "Complete the blank Creative-owned characteristics in Specifications, add the Shutterstock reference and remark, then send the variant to Studio for artwork."
                              : "Provide a Shutterstock asset reference number or styling guidelines. At least one is mandatory before releasing to Studio CAD."}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-[var(--on-surface)] font-mono">
                              Creative Asset / Shutterstock Reference No
                              {isSamplingCreativeTask && <span className="text-rose-500 ml-1 font-sans text-[11px] font-normal">(Required)</span>}
                              {!isSamplingCreativeTask && !creativeRemark.trim() && (
                                <span className="text-rose-500 ml-1 font-sans text-[11px] font-normal">(Required if no remark)</span>
                              )}
                            </label>
                            <input
                              type="text"
                              disabled={!canCreativeEdit}
                              value={creativeShutterstockNo}
                              onChange={(e) => setCreativeShutterstockNo(e.target.value)}
                              placeholder={canCreativeEdit ? "e.g. SHUTTER-8923482 or asset reference" : "Locked (Claim task to edit)"}
                              className={`w-full px-3 py-2 rounded-lg border bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-mono disabled:opacity-60 ${
                                !creativeShutterstockNo.trim() && !creativeRemark.trim()
                                  ? "border-amber-400 dark:border-amber-700"
                                  : "border-[var(--border-subtle)]"
                              }`}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-[var(--on-surface)] font-mono">
                              Creative Design Remarks &amp; Styling Guidelines
                              {isSamplingCreativeTask && <span className="text-rose-500 ml-1 font-sans text-[11px] font-normal">(Required)</span>}
                              {!isSamplingCreativeTask && !creativeShutterstockNo.trim() && (
                                <span className="text-rose-500 ml-1 font-sans text-[11px] font-normal">(Required if no Shutterstock No.)</span>
                              )}
                            </label>
                            <textarea
                              rows={3}
                              disabled={!canCreativeEdit}
                              value={creativeRemark}
                              onChange={(e) => setCreativeRemark(e.target.value)}
                              placeholder={canCreativeEdit ? "Provide specific aesthetic, printing, color match, or dieline guidelines..." : "Locked (Claim task to edit)"}
                              className={`w-full px-3 py-2 rounded-lg border bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-60 ${
                                !creativeShutterstockNo.trim() && !creativeRemark.trim()
                                  ? "border-amber-400 dark:border-amber-700"
                                  : "border-[var(--border-subtle)]"
                              }`}
                            />
                          </div>

                          {creativeFeedback && (
                            <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                              creativeFeedback.includes("released") || creativeFeedback.includes("submitted")
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-200"
                            }`}>
                              {creativeFeedback.includes("released") || creativeFeedback.includes("submitted") ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                              )}
                              <span>{creativeFeedback}</span>
                            </div>
                          )}
                          {isSamplingCreativeTask && ws.stage === "creative" && creativeDueAt && (
                            <div className={`rounded-lg border px-3 py-2 text-xs ${creativeIsLate ? "border-rose-200 bg-rose-50 text-rose-800" : "border-[var(--border-subtle)] bg-[var(--surface-low)] text-[var(--on-surface-muted)]"}`}>
                              {creativeIsLate ? "Creative response overdue" : "Creative response due"}: {creativeDueAt.toLocaleString()}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-[var(--on-surface-subtle)]">
                              {canCreativeEdit
                                ? isSamplingCreativeTask ? "Save Creative-owned characteristics and references, then send the variant to Studio." : "Changes will be committed upon release to Studio."
                                : "Claim task to unlock actions."}
                            </span>

                            <button
                              type="button"
                              disabled={isSavingCreative || !canCreativeEdit || (isSamplingCreativeTask && (!creativeShutterstockNo.trim() || !creativeRemark.trim())) || (!isSamplingCreativeTask && !creativeShutterstockNo.trim() && !creativeRemark.trim())}
                              onClick={handleCreativeRelease}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isSavingCreative ? "Sending..." : isSamplingCreativeTask ? "Complete & Send to Studio" : "Release to Studio CAD"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═════════ TAB 3: STUDIO CAD & PREPRESS ═════════ */}
                {activeTab === "studio" && (
                  <div className="space-y-5">
                    {/* Handoff Context (Read-Only Context for Studio) */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                        {ws.designNeeded === false ? "Design Reference from Marketing (Creative Bypassed)" : "Handoff Received from Creative Studio"}
                      </span>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--on-surface)]">Asset Reference:</span>
                        <span className="font-mono text-[var(--accent-primary-strong)] font-bold">
                          {ws.creativeShutterstockNo || ws.marketingShutterstockNo || "Direct catalog reference"}
                        </span>
                      </div>
                      {(ws.creativeRemark || ws.marketingRemark) && (
                        <p className="text-xs italic text-[var(--on-surface-muted)] bg-[var(--surface-low)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                          "{ws.creativeRemark || ws.marketingRemark}"
                        </p>
                      )}
                      {(ws.samplingRouting?.studioRevisionRemark || ws.marketingRevisionRemark) && (
                        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-100">
                          <span className="font-bold">{ws.samplingRouting?.studioRevisionRemark ? "Creative revision request: " : "Marketing request: "}</span>{ws.samplingRouting?.studioRevisionRemark || ws.marketingRevisionRemark}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--on-surface-muted)]">
                        <span>Marketing due: <strong className="font-mono text-[var(--on-surface)]">{ws.requiredDate || "—"}</strong></span>
                      </div>
                    </div>

                    {/* Studio Output URL & Action (Editable ONLY by Studio when claimed) */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                            Studio CAD Dieline / Artwork Output Link
                          </label>
                          {!canStudioEdit && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--on-surface-subtle)]">
                              <Lock className="w-3 h-3" />
                              <span>Studio Exclusive Field</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">
                          Paste the cloud storage path or preview URL for the technical dieline and artwork.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={2048}
                            disabled={!canStudioEdit}
                            value={studioMockupUrl}
                            onChange={(e) => setStudioMockupUrl(e.target.value)}
                            placeholder={canStudioEdit ? "https://artwork.navneet.com/cad/dieline-0021.pdf" : "Output link managed by Studio Prepress"}
                            className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-mono disabled:opacity-60"
                          />
                          {studioPreviewHref && (
                            <a
                              href={studioPreviewHref}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-xs font-bold text-[var(--on-surface)] border border-[var(--border-subtle)] flex items-center gap-1.5 shrink-0"
                            >
                              <span>Test Link</span>
                              <ExternalLink className="w-3.5 h-3.5 text-[var(--on-surface-subtle)]" />
                            </a>
                          )}
                        </div>
                      </div>

                      {studioFeedback && (
                        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                          studioFeedback.startsWith("Studio output submitted") || studioFeedback.startsWith("Artwork submitted") || studioFeedback.startsWith("Marketing has been asked")
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                        }`}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{studioFeedback}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          disabled={isSavingStudio || !studioMockupUrl.trim() || !canStudioEdit}
                          onClick={handleStudioSubmit}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSavingStudio ? "Saving..." : isSamplingCreativeTask ? "Submit Artwork to Creative" : "Release Mockup to Marketing"}</span>
                        </button>
                      </div>
                      {ws.marketingRevisionRemark && ws.stage === "studio" && (
                        <div className="space-y-3 border-t border-[var(--border-subtle)] pt-4">
                          <div>
                            <h3 className="text-xs font-bold text-[var(--on-surface)]">Can’t complete this request?</h3>
                            <p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">Send a reason to Marketing. They will choose whether to request a new mockup or close the request.</p>
                          </div>
                          <textarea
                            rows={2}
                            maxLength={1000}
                            disabled={!canStudioEdit || isRejectingStudioRevision}
                            value={studioRevisionRejectRemark}
                            onChange={(event) => setStudioRevisionRejectRemark(event.target.value)}
                            placeholder="Explain what prevents Studio from making this change..."
                            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={!canStudioEdit || isRejectingStudioRevision || !studioRevisionRejectRemark.trim()}
                              onClick={() => void handleStudioRevisionUnable()}
                              className="rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30 disabled:opacity-50"
                            >
                              {isRejectingStudioRevision ? "Sending to Marketing..." : "Return to Marketing"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ═════════ TAB 4: SAMPLING TEAM REVIEW & RELEASE (NO FEASIBILITY CHOICE) ═════════ */}
                {activeTab === "sampling" && !isMockupOnly && (
                  <div className="space-y-5">
                    {/* Status check alert */}
                    {isReleasedToPlant ? (
                      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-emerald-900 dark:text-emerald-200">
                            Sample Released to Plant
                          </p>
                          <p className="text-emerald-800/80 dark:text-emerald-300/80">
                            Technical review complete. This sample was dispatched to the plant production line at {targetPlant}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/20 flex items-start gap-3">
                        <Beaker className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-teal-900 dark:text-teal-200">
                            Sampling Team Technical Verification &amp; Release
                          </p>
                          <p className="text-teal-800/80 dark:text-teal-300/80">
                            Review specifications and CAD deliverables. When ready, enter your technical remarks and release the sample directly to the manufacturing plant.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Sampling Technical Review Form (Feasibility selector removed) */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                          Target Manufacturing Plant
                        </label>
                        <select
                          value={targetPlant}
                          disabled={readOnly}
                          onChange={(e) => setTargetPlant(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        >
                          <option value={KHANIWADE_PLANT_TARGET}>Khaniwade Plant (1505)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                          Sampling Team Technical Remarks / Machine Instructions
                        </label>
                        <textarea
                          rows={3}
                          disabled={readOnly}
                          value={samplingRemark}
                          onChange={(e) => setSamplingRemark(e.target.value)}
                          placeholder="Add machine guidelines, board gsm adjustments, or plant tooling notes..."
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-teal-500 focus:outline-none"
                        />
                      </div>

                      {samplingFeedbackMessage && (
                        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                          samplingFeedbackMessage.startsWith("✓")
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                        }`}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{samplingFeedbackMessage}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          disabled={isSavingSamplingFeedback || !samplingRemark.trim() || !canSamplingReleaseVariant}
                          onClick={handleSaveSamplingFeedback}
                          className="px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-low)] text-xs font-bold text-[var(--on-surface)] transition cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSamplingFeedback ? "Saving..." : "Save Remarks Only"}
                        </button>

                        <button
                          type="button"
                          disabled={isReleasingToPlant || !canSamplingReleaseVariant}
                          onClick={handleReleaseToPlant}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          <Factory className="w-3.5 h-3.5" />
                          <span>{isReleasingToPlant ? "Releasing to Plant..." : "Release Sample to Plant"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═════════ TAB 5: PLANT EXECUTION (KEPT OPEN & LIVE) ═════════ */}
                {activeTab === "plant" && !isMockupOnly && (
                  <div className="space-y-5">
                    {/* Live Plant Production Status Banner */}
                    <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/25 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Factory className="w-4 h-4 text-teal-600" />
                          <h3 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider font-mono">
                            Plant Production Desk: Live Operations Status
                          </h3>
                        </div>
                        <p className="text-xs text-teal-900/80 dark:text-teal-300/80">
                          {isReleasedToPlant
                            ? `Active at ${targetPlant || activeRequest.targetPlant || "Khaniwade"} Plant. Production queue ticket active.`
                            : "Plant queue is open and monitoring incoming release authorization from Sampling Team."}
                        </p>
                      </div>

                      <a
                        href="/plant-execution"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-xs shrink-0"
                      >
                        <span>Open Plant Desk</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Plant Logistics & Production Progress */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-4">
                      <h4 className="text-xs font-bold text-[var(--on-surface)] uppercase font-mono tracking-wider flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-teal-600" />
                        <span>Manufacturing &amp; Logistics Tracking</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                          <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] uppercase">Target Facility</span>
                          <p className="text-xs font-bold text-[var(--on-surface)]">{targetPlant || activeRequest.targetPlant || "Khaniwade Plant"}</p>
                          <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium">Line: Commercial Samples</span>
                        </div>

                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                          <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] uppercase">Sampling Authorization</span>
                          <p className="text-xs font-bold text-[var(--on-surface)]">{isReleasedToPlant ? "Released by Sampling" : "Pending Release"}</p>
                          <span className="text-[10px] text-[var(--on-surface-muted)]">
                            {ws.plantReleasedAt ? formatOdooDate(ws.plantReleasedAt) : "Awaiting sign-off"}
                          </span>
                        </div>

                        <div className="p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                          <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] uppercase">Dispatch Target SLA</span>
                          <p className="text-xs font-bold text-[var(--on-surface)]">{formatOdooDate(activeRequest.sampleRequiredDate) || "48 Hours"}</p>
                          <span className="text-[10px] text-[var(--accent-primary)] font-medium">Express Prototype Batch</span>
                        </div>
                      </div>

                      {/* Plant Execution Milestone Checklist */}
                      <div className="pt-2 space-y-2">
                        <span className="text-[11px] font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                          Plant Production Milestones
                        </span>
                        <div className="space-y-1.5">
                          {[
                            { step: "1. Technical Docket Handoff & Stock Allocation", done: isReleasedToPlant },
                            { step: "2. Tooling / Dieline Setup & Paper Proofing", done: isReleasedToPlant && Boolean(ws.mockupUrl) },
                            { step: "3. Printing, Lamination & Surface Embellishment", done: false },
                            { step: "4. Precision Binding, Inspection & Dispatch to Client", done: false },
                          ].map((m, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs">
                              {m.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-[var(--on-surface-subtle)] shrink-0" />
                              )}
                              <span className={m.done ? "font-semibold text-[var(--on-surface)]" : "text-[var(--on-surface-muted)]"}>
                                {m.step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* ── RIGHT: AUDIT & ACTIVITY LOG ── */}
          <UniversalChatterFeed
            title="Audit & Activity Log"
            events={universalChatterEvents}
            currentUser={currentUser}
            className="w-full lg:w-80 xl:w-96"
          />

        </div>
      </div>

      {/* Lightbox Preview */}
      {selectedPreviewImage && (
        <ImageLightboxModal
          selectedImage={selectedPreviewImage}
          images={[{ id: "preview-1", name: "Attachment", url: selectedPreviewImage }]}
          onClose={() => setSelectedPreviewImage(null)}
          onNavigate={() => {}}
        />
      )}
    </div>,
    document.body
  );
};

export default SampleRequestInspector;
