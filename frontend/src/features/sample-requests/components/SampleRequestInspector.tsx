import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Building2,
  Package,
  Sparkles,
  AlertTriangle,
  Layers,
  Palette,
  FolderOpen,
  Send,
  Clock,
  CheckCircle2,
  ChevronRight,
  Beaker,
  Factory,
  ArrowRight,
  Search,
  ShieldCheck,
  Tag,
  FileText,
  LoaderCircle,
  Box,
  Image as ImageIcon,
  MessageSquare,
  Truck,
  UserCheck,
  ShieldAlert,
  Lock,
  Edit3,
} from "lucide-react";
import {
  SampleRequestItem,
  MockupWorkflowState,
  ProgramMaterialItem,
  AddProgramMaterialPayload,
} from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
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
  claimMockupRequestApi,
  saveMockupCreativeDateApi,
  decideMockupCreativeApprovalApi,
  decideMockupMarketingAcceptanceApi,
} from "@/infrastructure/api/sampleRequestsApi";
import { formatOdooLogDate, formatOdooDate } from "../utils/dateUtils";
import { StatusPill } from "@/components/ui/StatusPill";
import { ImageLightboxModal } from "./inspector/ImageLightboxModal";
import {
  isMockupCreativeCharacteristic,
  creativeCharacteristicKey,
} from "./staging/mockupCreativeFields";

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
  emptyNewRow,
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
  onDeleteRequest?: (request: SampleRequestItem) => void;
  onReleaseDraft?: (request: SampleRequestItem) => Promise<void> | void;
  isAdmin?: boolean;
  readOnly?: boolean;
  role?: "marketing" | "creative" | "studio" | "sampling" | "plant";
  actorName?: string;
  actorUserId?: number;
  onRefresh?: () => Promise<void> | void;
}

type InspectorTab = "specs" | "creative" | "studio" | "sampling" | "plant";

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
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [charSearchQuery, setCharSearchQuery] = useState("");
  const [charFilter, setCharFilter] = useState<"all" | "creative" | "configured">("all");

  // All characteristics values dictionary (Creative can modify ANY field)
  const [allCharValues, setAllCharValues] = useState<Record<string, string>>({});

  // Creative section state
  const [creativeShutterstockNo, setCreativeShutterstockNo] = useState("");
  const [creativeRemark, setCreativeRemark] = useState("");
  const [isSavingCreative, setIsSavingCreative] = useState(false);
  const [creativeFeedback, setCreativeFeedback] = useState<string | null>(null);
  const [creativeDateDecision, setCreativeDateDecision] = useState<"confirmed" | "proposed">("confirmed");
  const [creativeInputDate, setCreativeInputDate] = useState("");
  const [mockupDecisionRemark, setMockupDecisionRemark] = useState("");
  const [mockupDecisionFeedback, setMockupDecisionFeedback] = useState<string | null>(null);
  const [isSavingMockupDecision, setIsSavingMockupDecision] = useState(false);

  // Task Claiming State
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Studio section state
  const [studioMockupUrl, setStudioMockupUrl] = useState("");
  const [isSavingStudio, setIsSavingStudio] = useState(false);
  const [studioFeedback, setStudioFeedback] = useState<string | null>(null);

  // Sampling Team section state (No Feasible/Infeasible selection as requested)
  const [samplingRemark, setSamplingRemark] = useState("");
  const [targetPlant, setTargetPlant] = useState("Khaniwade");
  const [isReleasingToPlant, setIsReleasingToPlant] = useState(false);
  const [isSavingSamplingFeedback, setIsSavingSamplingFeedback] = useState(false);
  const [samplingFeedbackMessage, setSamplingFeedbackMessage] = useState<string | null>(null);

  // Chatter State
  const [noteInput, setNoteInput] = useState("");
  const [chatterFilter, setChatterFilter] = useState<"all" | "audit" | "notes">("all");
  const [internalNotes, setInternalNotes] = useState<ChatterMessage[]>([]);
  const [isPostingNote, setIsPostingNote] = useState(false);
  const chatterEndRef = useRef<HTMLDivElement | null>(null);

  // Lightbox Preview Image state
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // Reset and synchronize on request id change
  useEffect(() => {
    setLocalOverride(null);
    setCreativeFeedback(null);
    setStudioFeedback(null);
    setSamplingFeedbackMessage(null);
    setClaimError(null);
    setActiveTab(initialTab);
    setCopiedCode(false);
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

    fetchProductDetailsApi(numericId, false)
      .then((details) => {
        if (cancelled) return;
        setProductDetails(details);

        // Populate all characteristics values dictionary
        const initialDict: Record<string, string> = {};
        details.forEach((d) => {
          const key = creativeCharacteristicKey(d.className, d.characteristicName);
          initialDict[key] = d.value || "";
        });
        setAllCharValues(initialDict);
      })
      .catch((err) => {
        console.warn("Could not load product inspection details:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });

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
    setCreativeDateDecision(ws.creativeDateDecision || "confirmed");
    setCreativeInputDate(ws.creativeInputDate || ws.creativeSystemRequiredDate || "");
    setMockupDecisionRemark(ws.marketingRevisionRemark || ws.creativeRevisionRemark || "");
    setSamplingRemark(ws.samplingFeedback || activeRequest.samplingRemark || "");
    setTargetPlant(activeRequest.targetPlant || ws.plantReleaseTarget || "Khaniwade");
  }, [activeRequest]);

  // Keyboard navigation: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedPreviewImage) {
          setSelectedPreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, selectedPreviewImage]);

  const handleCopyCode = () => {
    if (!activeRequest) return;
    const code = activeRequest.srNumber || `SR-${activeRequest.id}`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Group characteristics by class
  const groupedCharacteristics = useMemo(() => {
    const map = new Map<string, ProductDetailItem[]>();
    const query = charSearchQuery.toLowerCase().trim();

    productDetails.forEach((detail) => {
      const isCreative = isMockupCreativeCharacteristic(detail.className, detail.characteristicName);
      const isConfigured = detail.value && !["NA", "N/A", "NULL", "NONE", "-"].includes(detail.value.trim().toUpperCase());

      if (charFilter === "creative" && !isCreative) return;
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

  // Creative characteristics specifically
  const creativeCharacteristics = useMemo(() => {
    const listed = activeRequest?.mockupWorkflowState?.creativeCharacteristicKeys || [];
    const listedKeys = new Set(listed.map((item) => creativeCharacteristicKey(item.className, item.characteristicName)));
    return productDetails.filter((d) =>
      isMockupCreativeCharacteristic(d.className, d.characteristicName) &&
      (!listedKeys.size || listedKeys.has(creativeCharacteristicKey(d.className, d.characteristicName)))
    );
  }, [productDetails, activeRequest?.mockupWorkflowState?.creativeCharacteristicKeys]);

  // Workflow Gates & Status Flags
  const isDirectCatalogSample = useMemo(() => {
    if (!activeRequest) return false;
    const scopes = activeRequest.requestTypes || [];
    const isMockup = scopes.includes("mockup");
    const isDesign = scopes.includes("design");
    const hasCreative = (activeRequest as any).hasCreativeChanges || (activeRequest as any).creativeCharacteristicsCleared;
    return !isMockup && !isDesign && !hasCreative;
  }, [activeRequest]);

  const ws: Partial<MockupWorkflowState> = activeRequest?.mockupWorkflowState || {};

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

  // Claim Status Logic
  const isTaskClaimed = Boolean(ws.claimedBy);
  const claimedBy = ws.claimedBy || null;
  const claimedAt = ws.claimedAt || null;

  // Role Claim Verification
  const isClaimedByMe = Boolean(isAdmin || (isTaskClaimed && (
    ws.claimedByUserId != null
      ? actorUserId != null && Number(ws.claimedByUserId) === Number(actorUserId)
      : actorName && claimedBy?.trim().toLocaleLowerCase() === actorName.trim().toLocaleLowerCase()
  )));

  // Field Editing Permissions:
  // - Creative can edit all characteristics and creative fields once claimed.
  // - Studio can edit the prepress CAD URL once claimed.
  // - Creative CANNOT edit studio output.
  // - Studio CANNOT edit creative characteristics.
  const canCreativeEdit = (role === "creative" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "creative";
  const canCreativeApprove = (role === "creative" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "creative_approval";
  const canStudioEdit = (role === "studio" || isAdmin) && !readOnly && isClaimedByMe && ws.stage === "studio";
  const hasMockupClaimTask = (role === "creative" && ["creative", "creative_approval"].includes(String(ws.stage))) || (role === "studio" && ws.stage === "studio");
  const studioPreviewHref = /^https?:\/\//i.test(studioMockupUrl.trim()) ? studioMockupUrl.trim() : "";
  const localToday = new Date();
  const creativeDateMin = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, "0")}-${String(localToday.getDate()).padStart(2, "0")}`;
  const creativeDateMax = ws.requiredDate
    ? new Date(new Date(`${ws.requiredDate}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)
    : undefined;

  // Dynamic Chatter Stream Compilation
  const chatterEvents = useMemo<ChatterMessage[]>(() => {
    if (!activeRequest) return [];
    const events: ChatterMessage[] = [];

    // Base Intake Event
    events.push({
      id: "event-init",
      actorName: activeRequest.createdBy || "Commercial Team",
      actorDepartment: "Marketing Intake",
      action: "REQUEST_CREATED",
      title: "Commercial Sample Staged",
      body: `Sample request configured for ${activeRequest.customer || "Commercial Client"}. Target dispatch plant set to ${activeRequest.targetPlant || "Khaniwade"}.`,
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

    if (ws.claimedBy) {
      events.push({
        id: "event-claimed",
        actorName: ws.claimedBy,
        actorDepartment: ws.claimedStage === "studio" ? "Studio Prepress" : "Creative Studio",
        action: "TASK_CLAIMED",
        title: `Task Claimed by ${ws.claimedBy}`,
        body: `Task officially claimed for operational execution.`,
        timestamp: ws.claimedAt || new Date().toISOString(),
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

    for (const event of (ws.events || []).filter((item) => [
      "CREATIVE_DATE_DECIDED",
      "MOCKUP_CREATIVE_FIELDS_PREPARED",
      "CREATIVE_APPROVED_MOCKUP",
      "CREATIVE_REQUESTED_STUDIO_REVISION",
      "MARKETING_ACCEPTED_MOCKUP",
      "MARKETING_REQUESTED_STUDIO_REVISION",
    ].includes(item.action))) {
      events.push({
        id: `workflow-${event.action}-${event.timestamp}`,
        actorName: event.actorName,
        actorDepartment: event.actorDepartment,
        action: event.action,
        title: event.title,
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

    if (ws.plantReleasedAt || isReleasedToPlant) {
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

  const filteredChatter = useMemo(() => {
    if (chatterFilter === "all") return chatterEvents;
    if (chatterFilter === "notes") return chatterEvents.filter((e) => e.isNote);
    if (chatterFilter === "audit") return chatterEvents.filter((e) => !e.isNote);
    return chatterEvents;
  }, [chatterEvents, chatterFilter]);

  // Post internal note handler
  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim() || !activeRequest?.id) return;
    setIsPostingNote(true);

    const newNote: ChatterMessage = {
      id: `note-${Date.now()}`,
      actorName: actorName || (role === "sampling" ? "Sampling Reviewer" : role === "creative" ? "Creative Lead" : role === "studio" ? "Studio Prepress" : "Commercial Team"),
      actorDepartment: role === "sampling" ? "Sampling Review" : role === "creative" ? "Creative" : role === "studio" ? "Studio" : "Commercial",
      action: "NOTE_POSTED",
      title: "Team Note",
      body: noteInput.trim(),
      timestamp: new Date().toISOString(),
      isNote: true,
    };

    const updatedNotes = [...internalNotes, newNote];
    setInternalNotes(updatedNotes);
    try {
      localStorage.setItem(`samp_notes_${activeRequest.id}`, JSON.stringify(updatedNotes));
    } catch (err) {
      console.warn("Could not save note to local storage:", err);
    }
    setNoteInput("");
    setIsPostingNote(false);
  };

  // ── ACTION HANDLERS ──

  // 0. Claim Task Action
  const handleClaimTask = async () => {
    if (!activeRequest) return;
    setIsClaiming(true);
    setClaimError(null);
    try {
      const updated = await claimMockupRequestApi(activeRequest.id);
      setLocalOverride(updated);

      const claimNote: ChatterMessage = {
        id: `claim-${Date.now()}`,
        actorName: actorName || (role === "creative" ? "Creative Designer" : role === "studio" ? "Studio Prepress" : "Sampling Specialist"),
        actorDepartment: role === "creative" ? "Creative Studio" : role === "studio" ? "Studio CAD" : "Sampling Review",
        action: "TASK_CLAIMED",
        title: `Task Claimed by ${actorName || "Team Member"}`,
        body: `Task claimed for ${role.toUpperCase()} operations. Field edit permissions unlocked.`,
        timestamp: new Date().toISOString(),
      };
      const updatedNotes = [...internalNotes, claimNote];
      setInternalNotes(updatedNotes);
      try {
        localStorage.setItem(`samp_notes_${activeRequest.id}`, JSON.stringify(updatedNotes));
      } catch {}

      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setClaimError(err?.message || "Failed to claim task. Please retry.");
    } finally {
      setIsClaiming(false);
    }
  };

  // 1. Creative Save & Release to Studio + Marketing
  const handleCreativeRelease = async () => {
    if (!activeRequest) return;
    setIsSavingCreative(true);
    setCreativeFeedback(null);
    try {
      const numericId = Number(String(activeRequest.id).replace(/^sample-/, ""));
      // Save only the explicitly routed Creative fields.
      if (productDetails.length > 0 && Number.isInteger(numericId) && numericId > 0) {
        const allowed = new Set((ws.creativeCharacteristicKeys || []).map((item) => creativeCharacteristicKey(item.className, item.characteristicName)));
        const payload = productDetails.filter((d) => allowed.has(creativeCharacteristicKey(d.className, d.characteristicName))).map((d) => {
          const key = creativeCharacteristicKey(d.className, d.characteristicName);
          const editedVal = allCharValues[key];
          return {
            className: d.className,
            characteristicName: d.characteristicName,
            value: editedVal !== undefined ? (editedVal.trim() || null) : d.value,
            uom: d.uom || null,
          };
        });
        if (payload.length) await saveProductDetailsApi(numericId, payload);
      }

      // Send to Studio & Marketing
      const updated = await sendMockupRequestToStudioApi(activeRequest.id, actorName, {
        shutterstockNo: creativeShutterstockNo.trim(),
        remark: creativeRemark.trim(),
      });

      setLocalOverride(updated);
      setCreativeFeedback("Creative brief sent to Studio. Creative approval follows the Studio output.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setCreativeFeedback(err?.message || "Failed to release creative specifications. Please retry.");
    } finally {
      setIsSavingCreative(false);
    }
  };

  const handleSaveCreativeDate = async () => {
    if (!activeRequest || !creativeInputDate) return;
    setIsSavingMockupDecision(true);
    setMockupDecisionFeedback(null);
    try {
      const updated = await saveMockupCreativeDateApi(activeRequest.id, creativeDateDecision, creativeInputDate, actorName);
      setLocalOverride(updated);
      setMockupDecisionFeedback("Creative input date saved.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setMockupDecisionFeedback(err?.message || "Could not save the Creative input date.");
    } finally {
      setIsSavingMockupDecision(false);
    }
  };

  const handleMockupReviewDecision = async (team: "creative" | "marketing", decision: "accept" | "request_revision") => {
    if (!activeRequest) return;
    setIsSavingMockupDecision(true);
    setMockupDecisionFeedback(null);
    try {
      const updated = team === "creative"
        ? await decideMockupCreativeApprovalApi(activeRequest.id, decision, mockupDecisionRemark.trim(), actorName)
        : await decideMockupMarketingAcceptanceApi(activeRequest.id, decision, mockupDecisionRemark.trim(), actorName);
      setLocalOverride(updated);
      setMockupDecisionRemark("");
      setMockupDecisionFeedback(decision === "accept" ? "Mockup approved and handed to the next stage." : "Revision request sent to Studio.");
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
      setStudioFeedback("Studio output submitted to Creative for approval.");
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setStudioFeedback(err?.message || "Failed to submit studio output. Please retry.");
    } finally {
      setIsSavingStudio(false);
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
        targetPlant,
        samplingRemark: samplingRemark.trim(),
      });
      setLocalOverride(updated);
      setSamplingFeedbackMessage(`✓ Sample officially released to Plant (${targetPlant})!`);
      if (onRefresh) void onRefresh();
    } catch (err: any) {
      setSamplingFeedbackMessage(err?.message || "Failed to release sample to plant.");
    } finally {
      setIsReleasingToPlant(false);
    }
  };

  // ── EARLY RETURN AFTER ALL HOOKS ──
  if (!isOpen || !activeRequest) return null;

  const code = activeRequest.srNumber || `SR-${activeRequest.id}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--on-surface)]/40 backdrop-blur-xs animate-smooth-backdrop sm:p-4 select-text"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-inspector-title"
        className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] select-text xl:max-w-7xl animate-smooth-modal font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. TOP CONTROL PANEL (EXACT ERP STYLE LIKE DESIGN REQUEST) ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5 shadow-2xs sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] cursor-pointer"
            >
              Save &amp; Close
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[var(--surface-low)] px-3.5 py-1.5 text-xs font-medium text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] cursor-pointer"
            >
              Discard
            </button>
            <span className="mx-1 hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] cursor-pointer"
              title="Copy request code"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-[var(--on-surface-subtle)]" />}
              <span>{copiedCode ? "Copied" : "Copy Code"}</span>
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            {/* 5-Section Workflow Pipeline Breadcrumb */}
            <div className="hidden min-w-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-1 md:flex">
              {[
                { id: "specs" as const, label: "1. Specs & Scope", done: true, active: activeTab === "specs" },
                { id: "creative" as const, label: "2. Creative", done: isCreativeDone, active: activeTab === "creative" },
                { id: "studio" as const, label: "3. Studio CAD", done: isStudioDone, active: activeTab === "studio" },
                { id: "sampling" as const, label: "4. Sampling Team", done: isReleasedToPlant, active: activeTab === "sampling" },
                { id: "plant" as const, label: "5. Plant Execution", done: isReleasedToPlant, active: activeTab === "plant" },
              ].map((step, idx, arr) => (
                <React.Fragment key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTab(step.id)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] transition cursor-pointer ${
                      step.active
                        ? "border border-[var(--accent-primary)] bg-[var(--surface-lowest)] font-bold text-[var(--on-surface)] shadow-2xs"
                        : step.done
                        ? "bg-[var(--surface-lowest)] font-bold text-[var(--accent-primary)] shadow-2xs"
                        : "font-medium text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    ) : step.active ? (
                      <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />
                    )}
                    <span>{step.label}</span>
                  </button>
                  {idx < arr.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--border-strong)]" />}
                </React.Fragment>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + CHATTER) ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          
          {/* ── LEFT: FORM SHEET (DOCUMENT BODY) ── */}
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto bg-[var(--bg-app)] p-4 md:p-6">
            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              
              {/* Paper Sheet Header */}
              <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
                {/* Reference Code & Type Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 sm:px-8">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">
                      {code}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">/</span>
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                      Commercial Sample Request
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDirectCatalogSample ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Direct Sampling Route (Unchanged Catalog)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] border border-[var(--accent-primary)]/20">
                        <Sparkles className="w-3 h-3" />
                        <span>Creative Specification Route</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Document Hero & Primary Details */}
                <div className="px-4 py-4 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 font-display">
                        {activeRequest.customer || "Commercial Account"}
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        {activeRequest.productDescription || "Sample Product Package"}
                        {activeRequest.createdBy ? <> · Initiated by <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest.createdBy}</span></> : ""}
                        {activeRequest.dateRequestCreated || activeRequest.createdAt ? ` · ${formatOdooDate(activeRequest.dateRequestCreated || activeRequest.createdAt)}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-500/20">
                        Sample Request
                      </span>
                      <StatusPill
                        status={activeRequest.status || "Brief Intake"}
                        size="md"
                      />
                    </div>
                  </div>
                </div>

                {/* 5-Section Nav Tabs Ribbon on Paper */}
                <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 sm:px-8 py-1.5 overflow-x-auto">
                  {[
                    { id: "specs" as const, label: "1. Specifications & Scope", icon: FileText, count: productDetails.length },
                    { id: "creative" as const, label: "2. Creative Studio", icon: Palette, badge: isCreativeDone ? "Done" : "Pending" },
                    { id: "studio" as const, label: "3. Studio Prepress & CAD", icon: Box, badge: isStudioDone ? "CAD Ready" : "Pending" },
                    { id: "sampling" as const, label: "4. Sampling Team Review", icon: Beaker, badge: isReleasedToPlant ? "Released" : "Review" },
                    { id: "plant" as const, label: "5. Plant Execution", icon: Factory, badge: "Open" },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                          isActive
                            ? "bg-[var(--surface-low)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-2xs"
                            : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--surface-container)] text-[var(--on-surface-subtle)]">
                            {tab.count}
                          </span>
                        )}
                        {tab.badge && (
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            tab.badge === "Done" || tab.badge === "Released" || tab.badge === "CAD Ready"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : tab.badge === "Open"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }`}>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── OPERATIONAL TASK CLAIM BANNER (REQUIRED FOR EDITING) ── */}
              {hasMockupClaimTask && <div className="px-4 sm:px-8 pt-4">
                {isTaskClaimed ? (
                  <div className="p-3 rounded-xl border border-emerald-200/90 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-950 dark:text-emerald-200">
                            Task Claimed by {claimedBy}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            ASSIGNED
                          </span>
                        </div>
                        {claimedAt && (
                          <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>Claimed on {formatOdooLogDate(claimedAt)}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300 font-medium">
                      {isClaimedByMe ? "Editing rights are active for your claim." : "This task is locked to the assigned team member."}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-950 dark:text-amber-200">
                            Unclaimed Operational Task
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            PENDING CLAIM
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                          {role === "creative" && ws.stage === "creative_approval"
                            ? "Review the Studio output, then approve it or request a revision."
                            : role === "creative"
                            ? "Creative team must claim this task to begin editing specifications and releasing to Studio."
                            : role === "studio"
                            ? "Studio prepress must claim this task to provide CAD dieline links."
                            : "Claim this deliverable to unlock editing rights and register your operational log."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isClaiming || readOnly || (isTaskClaimed && !isClaimedByMe)}
                      onClick={handleClaimTask}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isClaiming ? "Claiming..." : isTaskClaimed ? `Claimed by ${claimedBy}` : "Claim Task Now"}</span>
                    </button>
                  </div>
                )}
                {claimError && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium border border-rose-200">
                    {claimError}
                  </div>
                )}
              </div>}

              {/* ── TAB CONTENT BODY ── */}
              <div className="p-4 sm:p-8 space-y-6">

                {/* ═════════ TAB 1: SPECIFICATIONS & SCOPE ═════════ */}
                {activeTab === "specs" && (
                  <div className="space-y-6">
                    {role === "marketing" && ws.stage === "awaiting_marketing_acceptance" && (
                      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-sm space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"><CheckCircle2 className="h-5 w-5" /></div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-bold text-[var(--on-surface)]">Mockup ready for Marketing acceptance</h2>
                            <p className="mt-1 text-xs text-[var(--on-surface-muted)]">Creative has approved the Studio output. Accept it to close the mockup scope, or return it to Studio with a revision note.</p>
                          </div>
                        </div>
                        {studioPreviewHref ? (
                          <a href={studioPreviewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-container)]"><ExternalLink className="h-3.5 w-3.5" />Open Studio mockup</a>
                        ) : (
                          <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2 text-xs font-mono text-[var(--on-surface)] break-all">{ws.mockupUrl || "Studio output is missing."}</div>
                        )}
                        <label className="block space-y-1.5">
                          <span className="text-xs font-semibold text-[var(--on-surface)]">Revision note <span className="font-normal text-[var(--on-surface-subtle)]">(required only when returning)</span></span>
                          <textarea rows={2} maxLength={1000} value={mockupDecisionRemark} onChange={(event) => setMockupDecisionRemark(event.target.value)} disabled={readOnly} placeholder="Describe what Studio should change..." className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60" />
                        </label>
                        {mockupDecisionFeedback && <p role="status" className="text-xs text-[var(--on-surface-muted)]">{mockupDecisionFeedback}</p>}
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" disabled={readOnly || isSavingMockupDecision || !mockupDecisionRemark.trim()} onClick={() => void handleMockupReviewDecision("marketing", "request_revision")} className="rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-50">{isSavingMockupDecision ? "Saving…" : "Return to Studio"}</button>
                          <button type="button" disabled={readOnly || isSavingMockupDecision} onClick={() => void handleMockupReviewDecision("marketing", "accept")} className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{isSavingMockupDecision ? "Saving…" : activeRequest.requestTypes?.includes("sample") ? "Accept Mockup & Continue Sampling" : "Accept & Close Mockup"}</button>
                        </div>
                        {activeRequest.requestTypes?.includes("sample") && <p className="text-[11px] text-[var(--on-surface-subtle)]">Sampling remains open after the mockup is accepted.</p>}
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

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Target Manufacturing Plant</span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                          <Factory className="w-3.5 h-3.5 text-teal-600" />
                          <span>{activeRequest.targetPlant || "Khaniwade Plant"}</span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">Sample Dispatch Destination</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Due &amp; Required Dates</span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Sample Due: {formatOdooDate(activeRequest.sampleRequiredDate) || "Immediate"}</span>
                        </div>
                        {activeRequest.targetArtworkDateCreative && (
                          <p className="text-[11px] text-[var(--on-surface-muted)]">Artwork Target: {formatOdooDate(activeRequest.targetArtworkDateCreative)}</p>
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Deliverable Quantities</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="font-semibold text-[var(--on-surface)]">Sampling: <strong className="font-mono text-emerald-600 font-bold">{activeRequest.qtyForSampling || 1}</strong> pcs</span>
                          <span className="text-[var(--border-strong)]">|</span>
                          <span className="font-semibold text-[var(--on-surface)]">Mockup: <strong className="font-mono text-[var(--accent-primary)] font-bold">{activeRequest.qtyForMockup || 0}</strong> pcs</span>
                        </div>
                        <p className="text-[11px] text-[var(--on-surface-muted)]">Pack: {activeRequest.qtyPerPack || "Standard"} / unit</p>
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
                              onClick={() => setCharFilter("creative")}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                charFilter === "creative" ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-bold shadow-2xs" : "text-[var(--on-surface-subtle)]"
                              }`}
                            >
                              Creative
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
                          </div>
                        </div>
                      </div>

                      {isLoadingDetails ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[var(--on-surface-subtle)]">
                          <LoaderCircle className="w-4 h-4 animate-spin text-teal-600" />
                          <span>Loading product specifications...</span>
                        </div>
                      ) : groupedCharacteristics.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[var(--on-surface-subtle)] font-mono">
                          No characteristics matched your filter.
                        </div>
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
                                    const key = creativeCharacteristicKey(it.className, it.characteristicName);
                                    const isCreative = isMockupCreativeCharacteristic(it.className, it.characteristicName);
                                    const isRoutedCreative = (ws.creativeCharacteristicKeys || []).some((item) => creativeCharacteristicKey(item.className, item.characteristicName) === key);
                                    const currentVal = allCharValues[key] !== undefined ? allCharValues[key] : (it.value || "");

                                    return (
                                      <tr key={idx} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--surface-low)]/50 transition">
                                        <td className={`px-3.5 py-2 font-medium text-[var(--on-surface)] flex items-center gap-2 ${isCreative ? "border-y border-l border-rose-500 bg-rose-50/50 dark:border-rose-400 dark:bg-rose-950/20" : ""}`}>
                                          <span>{it.characteristicName}</span>
                                          {isCreative && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]">
                                              Creative
                                            </span>
                                          )}
                                        </td>
                                        <td className={`px-3.5 py-2 ${isCreative ? "border-y border-rose-500 bg-rose-50/50 dark:border-rose-400 dark:bg-rose-950/20" : ""}`}>
                                          {canCreativeEdit && isRoutedCreative ? (
                                            <input
                                              type="text"
                                              value={currentVal}
                                              onChange={(e) => setAllCharValues({ ...allCharValues, [key]: e.target.value })}
                                              placeholder="Enter value..."
                                              className="w-full px-2.5 py-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                                            />
                                          ) : (
                                            <span className="font-mono text-[var(--on-surface)]">
                                              {currentVal || <span className="text-[var(--on-surface-subtle)] italic">—</span>}
                                            </span>
                                          )}
                                        </td>
                                        <td className={`px-3.5 py-2 text-[var(--on-surface-muted)] font-mono text-[11px] ${isCreative ? "border-y border-r border-rose-500 bg-rose-50/50 dark:border-rose-400 dark:bg-rose-950/20" : ""}`}>
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
                {activeTab === "creative" && (
                  <div className="space-y-5">
                    {ws.stage === "creative" && (
                      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-bold text-[var(--on-surface)]">Creative input date</h3>
                            <p className="mt-1 text-xs text-[var(--on-surface-muted)]">Confirm the system date or propose another date within 24 hours of handoff. Studio starts at least one day after this date.</p>
                          </div>
                          <span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[10px] font-semibold text-[var(--on-surface-muted)]">Marketing due {ws.requiredDate || "—"}</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
                          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Creative date decision">
                            {(["confirmed", "proposed"] as const).map((decision) => (
                              <button key={decision} type="button" disabled={!canCreativeEdit} aria-pressed={creativeDateDecision === decision} onClick={() => setCreativeDateDecision(decision)} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold capitalize transition ${creativeDateDecision === decision ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"} disabled:opacity-50`}>{decision === "confirmed" ? "Confirm system date" : "Propose another date"}</button>
                            ))}
                          </div>
                          <label className="block space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--on-surface-subtle)]">Creative input date · System {ws.creativeSystemRequiredDate || "—"}</span>
                            <input type="date" min={creativeDateMin} max={creativeDateMax} disabled={!canCreativeEdit} value={creativeInputDate} onChange={(event) => setCreativeInputDate(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-xs text-[var(--on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-50" />
                          </label>
                        </div>
                        {ws.creativeDateDecisionDueAt && <p className="text-[11px] text-[var(--on-surface-subtle)]">Date response due {formatOdooLogDate(ws.creativeDateDecisionDueAt)}{ws.creativeDateDecisionLate ? " · response was late" : ""}</p>}
                        {mockupDecisionFeedback && <p role="status" className="text-xs text-[var(--on-surface-muted)]">{mockupDecisionFeedback}</p>}
                        <div className="flex justify-end">
                          <button type="button" disabled={!canCreativeEdit || isSavingMockupDecision || !creativeInputDate} onClick={() => void handleSaveCreativeDate()} className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{isSavingMockupDecision ? "Saving…" : "Save date decision"}</button>
                        </div>
                      </section>
                    )}
                    {ws.stage === "creative_approval" && (
                      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-sm space-y-4">
                        <div>
                          <h3 className="text-sm font-bold text-[var(--on-surface)]">Review Studio mockup</h3>
                          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">Check the output before sending it to Marketing. You may approve it or return it to Studio with a clear revision note.</p>
                        </div>
                        {studioPreviewHref ? <a href={studioPreviewHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-container)]"><ExternalLink className="h-3.5 w-3.5" />Open Studio mockup</a> : <div className="rounded-lg bg-[var(--surface-low)] px-3 py-2 text-xs font-mono text-[var(--on-surface)] break-all">{ws.mockupUrl || "Studio output is missing."}</div>}
                        <label className="block space-y-1.5"><span className="text-xs font-semibold text-[var(--on-surface)]">Revision note <span className="font-normal text-[var(--on-surface-subtle)]">(required only when returning)</span></span><textarea rows={2} maxLength={1000} value={mockupDecisionRemark} onChange={(event) => setMockupDecisionRemark(event.target.value)} disabled={!canCreativeApprove} placeholder="Describe what Studio should change..." className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 disabled:opacity-60" /></label>
                        {ws.creativeRevisionRemark && <p className="rounded-lg bg-[var(--surface-low)] p-3 text-xs text-[var(--on-surface-muted)]">Prior revision: {ws.creativeRevisionRemark}</p>}
                        {mockupDecisionFeedback && <p role="status" className="text-xs text-[var(--on-surface-muted)]">{mockupDecisionFeedback}</p>}
                        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={!canCreativeApprove || isSavingMockupDecision || !mockupDecisionRemark.trim()} onClick={() => void handleMockupReviewDecision("creative", "request_revision")} className="rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-50">Return to Studio</button><button type="button" disabled={!canCreativeApprove || isSavingMockupDecision} onClick={() => void handleMockupReviewDecision("creative", "accept")} className="rounded-lg bg-[var(--accent-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{isSavingMockupDecision ? "Saving…" : "Approve for Marketing"}</button></div>
                      </section>
                    )}
                    {ws.stage !== "creative_approval" && <>
                    {/* Route context banner */}
                    {isDirectCatalogSample ? (
                      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-emerald-900 dark:text-emerald-200">
                            Direct Sampling Route: Creative Stage Auto-Approved
                          </p>
                          <p className="text-emerald-800/80 dark:text-emerald-300/80">
                            Because this sample uses existing catalog material without custom alterations, it bypassed creative hold and routed directly to the Sampling Team.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary-subtle)]/35 flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-[var(--accent-primary-strong)]">
                            Creative Design Customization Required
                          </p>
                          <p className="text-[var(--on-surface-muted)]">
                            Product specifications were customized during staging. Creative fields are highlighted below for Creative Studio to complete and release to Marketing &amp; Studio.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Creative Highlighted Characteristics Inputs */}
                    {creativeCharacteristics.length > 0 && (
                      <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-[var(--on-surface)] uppercase font-mono tracking-wider flex items-center gap-2">
                            <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            <span>Highlighted Creative Characteristics ({creativeCharacteristics.length})</span>
                          </h4>
                          <span className="text-[10px] font-mono text-[var(--accent-primary-strong)] font-bold">
                            Design Field Fill
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {creativeCharacteristics.map((char) => {
                            const key = creativeCharacteristicKey(char.className, char.characteristicName);
                            const val = allCharValues[key] !== undefined ? allCharValues[key] : (char.value || "");
                            const isRoutedCreative = (ws.creativeCharacteristicKeys || []).some((item) => creativeCharacteristicKey(item.className, item.characteristicName) === key);
                            return (
                              <div key={key} className="p-3 rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--surface-base)] space-y-1.5">
                                <label className="block text-[11px] font-semibold text-[var(--on-surface)]">
                                  {char.characteristicName} <span className="text-[var(--accent-primary)] text-[10px]">({char.className})</span>
                                </label>
                                <input
                                  type="text"
                                  disabled={!canCreativeEdit || !isRoutedCreative}
                                  value={val}
                                  onChange={(e) => setAllCharValues({ ...allCharValues, [key]: e.target.value })}
                                  placeholder={canCreativeEdit && isRoutedCreative ? `Enter ${char.characteristicName.toLowerCase()}...` : "Read only or not routed to Creative"}
                                  className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-[var(--accent-primary)] focus:outline-none disabled:opacity-60"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Creative Assets & Remarks */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                          Creative Asset / Shutterstock Reference No
                        </label>
                        <input
                          type="text"
                          disabled={!canCreativeEdit}
                          value={creativeShutterstockNo}
                          onChange={(e) => setCreativeShutterstockNo(e.target.value)}
                          placeholder={canCreativeEdit ? "e.g. SHUTTER-8923482 or asset URL" : "Locked (Claim task to edit)"}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] font-mono disabled:opacity-60"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                          Creative Design Remarks &amp; Styling Guidelines
                        </label>
                        <textarea
                          rows={3}
                          disabled={!canCreativeEdit}
                          value={creativeRemark}
                          onChange={(e) => setCreativeRemark(e.target.value)}
                          placeholder={canCreativeEdit ? "Provide specific aesthetic, printing, color match, or binding instructions for Studio prepress..." : "Locked (Claim task to edit)"}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] disabled:opacity-60"
                        />
                      </div>

                      {creativeFeedback && (
                        <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                          creativeFeedback.startsWith("Creative brief sent")
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                        }`}>
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>{creativeFeedback}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-[var(--on-surface-subtle)]">
                          {canCreativeEdit ? "Edits will be saved to specifications upon release." : "Claim task to release specifications."}
                        </span>

                        <button
                          type="button"
                          disabled={isSavingCreative || !canCreativeEdit}
                          onClick={handleCreativeRelease}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" />
                            <span>{isSavingCreative ? "Sending..." : "Send brief to Studio"}</span>
                        </button>
                      </div>
                    </div>
                    </>}
                  </div>
                )}

                {/* ═════════ TAB 3: STUDIO CAD & PREPRESS ═════════ */}
                {activeTab === "studio" && (
                  <div className="space-y-5">
                    {/* Creative Handoff Context (Read-Only Context for Studio) */}
                    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                        Handoff Received from Creative Studio
                      </span>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--on-surface)]">Asset Reference:</span>
                        <span className="font-mono text-[var(--accent-primary-strong)] font-bold">
                          {ws.creativeShutterstockNo || "Direct catalog reference"}
                        </span>
                      </div>
                      {ws.creativeRemark && (
                        <p className="text-xs italic text-[var(--on-surface-muted)] bg-[var(--surface-low)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                          "{ws.creativeRemark}"
                        </p>
                      )}
                      {(ws.creativeRevisionRemark || ws.marketingRevisionRemark) && (
                        <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-100">
                          <span className="font-bold">Revision requested: </span>{ws.marketingRevisionRemark || ws.creativeRevisionRemark}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--on-surface-muted)]">
                        <span>Marketing due: <strong className="font-mono text-[var(--on-surface)]">{ws.requiredDate || "—"}</strong></span>
                        {ws.studioEarliestStartDate && <span>Studio earliest start: <strong className="font-mono text-[var(--on-surface)]">{ws.studioEarliestStartDate}</strong></span>}
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
                          studioFeedback.startsWith("Studio output submitted")
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
                          <span>{isSavingStudio ? "Saving..." : "Submit mockup to Creative approval"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ═════════ TAB 4: SAMPLING TEAM REVIEW & RELEASE (NO FEASIBILITY CHOICE) ═════════ */}
                {activeTab === "sampling" && (
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
                          <option value="Khaniwade">Khaniwade Plant (Standard &amp; Books)</option>
                          <option value="Palghar">Palghar Plant (Exports &amp; Formats)</option>
                          <option value="Daman">Daman Plant (Specialty &amp; Packaging)</option>
                          <option value="Silvassa">Silvassa Plant (Hardcase Binding)</option>
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
                          disabled={isSavingSamplingFeedback || !samplingRemark.trim() || readOnly}
                          onClick={handleSaveSamplingFeedback}
                          className="px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-low)] text-xs font-bold text-[var(--on-surface)] transition cursor-pointer disabled:opacity-50"
                        >
                          {isSavingSamplingFeedback ? "Saving..." : "Save Remarks Only"}
                        </button>

                        <button
                          type="button"
                          disabled={isReleasingToPlant || readOnly}
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
                {activeTab === "plant" && (
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

          {/* ── RIGHT: LIVE CHATTER & ACTIVITY STREAM (LIKE DESIGN REQUEST) ── */}
          <aside className="w-full lg:w-80 xl:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col min-h-0">
            {/* Chatter Header */}
            <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">Activity Stream</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface-container)] text-[var(--on-surface-muted)] font-bold">
                  {chatterEvents.length}
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-[var(--surface-lowest)] p-0.5 rounded-lg text-[10px] font-mono border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setChatterFilter("all")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "all" ? "bg-[var(--accent-primary)] text-white font-bold" : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setChatterFilter("audit")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "audit" ? "bg-[var(--accent-primary)] text-white font-bold" : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  Audit
                </button>
                <button
                  type="button"
                  onClick={() => setChatterFilter("notes")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "notes" ? "bg-[var(--accent-primary)] text-white font-bold" : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  Notes
                </button>
              </div>
            </div>

            {/* Note Composer */}
            <form onSubmit={handlePostNote} className="p-3 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
              <div className="relative">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Post an operational note..."
                  maxLength={1000}
                  disabled={isPostingNote}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] py-2 pl-3 pr-9 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                <button
                  type="submit"
                  disabled={!noteInput.trim() || isPostingNote}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--on-surface-subtle)] hover:text-[var(--accent-primary)] disabled:opacity-30 cursor-pointer"
                  title="Post note"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-1 px-1 text-[10px] text-[var(--on-surface-subtle)]">
                Visible to Commercial, Creative, Studio &amp; Plant
              </div>
            </form>

            {/* Chronological Message Stream */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[var(--surface-lowest)]">
              {filteredChatter.length === 0 ? (
                <div className="py-12 text-center text-[var(--on-surface-subtle)] font-mono text-[11px]">
                  No chatter entries found.
                </div>
              ) : (
                filteredChatter.map((evt) => {
                  const isNote = evt.isNote;
                  const isSystem = ["REQUEST_CREATED", "ROUTED_CREATIVE", "RELEASED_TO_PLANT"].includes(evt.action);
                  const initials = (evt.actorName || "OP")
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  if (isSystem) {
                    return (
                      <div key={evt.id} className="flex justify-center py-1">
                        <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal-500/20 bg-teal-50/50 dark:bg-teal-950/30 px-3 py-1 text-[11px] text-teal-900 dark:text-teal-200">
                          <span className="font-semibold">{evt.title}</span>
                          <span className="text-[10px] opacity-75">· {formatOdooLogDate(evt.timestamp)}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        isNote
                          ? "border-amber-200/80 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20"
                          : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold flex items-center justify-center">
                            {initials}
                          </span>
                          <span className="font-bold text-[var(--on-surface)]">{evt.actorName}</span>
                          <span className="text-[10px] text-[var(--on-surface-subtle)]">({evt.actorDepartment})</span>
                        </div>
                        <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
                          {formatOdooLogDate(evt.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--on-surface)] leading-relaxed">{evt.body}</p>
                    </div>
                  );
                })
              )}
              <div ref={chatterEndRef} />
            </div>
          </aside>

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
