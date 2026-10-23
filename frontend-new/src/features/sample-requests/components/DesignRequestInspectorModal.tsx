import { UniversalChatterFeed, UniversalChatterEvent } from "./common/UniversalChatterFeed";
import { RequestClosedStamp } from "./common/RequestClosedWatermark";
import { SamplingResponsePanel } from "./common/SamplingResponsePanel";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ExternalLink, CheckCircle2, Clock } from "lucide-react";
import { DesignFollowupArtwork, DesignFollowupScope, DesignFollowupSelection, SampleRequestItem } from "../types";
import {
  submitCreativeDesignOutputApi,
  recordMarketingDesignDecisionApi,
  requestPostDesignDeliverablesApi,
  claimDesignRequestApi,
  claimSamplingDesignRequestApi,
  proposeDesignCounterDateApi,
  decideDesignCounterDateApi,
  mapDesignRequestToSampleRequest,
  fetchDesignRequestsApi,
} from "@/infrastructure/api/sampleRequestsApi";
import type { UserProfile } from "@/features/auth/types";
import { isAdmin as isAdminUser, isReadOnlyTeamHead, hasWorkflowTeam } from "@/features/auth/permissions";
import { readAuthUser } from "@/lib/session";
import {
  mergeWithWorkflowState,
  checkCounterDateSla,
} from "../utils/designWorkflowStorage";
import {
  DesignBriefTab,
  DesignDeliverablesTab,
  DesignNextWorkTab,
  DesignReferenceAsset,
  ImageLightboxModal,
  DesignControlPanel,
  DesignSheetHeader,
  MarketingCounterDateBanner,
} from "./inspector";
import { FeasibilityCounterDateModal } from "./feasibility";

interface ChatterMessage {
  id: string;
  actorName: string;
  actorDepartment: string;
  action: string;
  title: string;
  body: string;
  timestamp: string;
  badge?: {
    text: string;
    variant: "purple" | "teal" | "amber" | "emerald" | "rose" | "neutral";
  };
  isNote?: boolean;
}

export interface DesignRequestInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  mode?: "marketing" | "creative" | "sampling";
  showToast?: (message: string) => void;
}

type TabType = "specs" | "deliverables" | "signoff" | "next_work";

function getReferenceUrl(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const asset = value as Record<string, unknown>;
  for (const key of ["url", "href", "src", "path"]) {
    if (typeof asset[key] === "string" && asset[key].trim()) return asset[key].trim();
  }
  return "";
}

function getDesignStageIndex(r: SampleRequestItem | null): number {
  if (!r) return 0;
  const s = String(r.designRequestStatus || r.status || "").toLowerCase();
  const decision = String(r.marketingDesignDecision || "").toLowerCase();
  if (s.includes("approved") || s.includes("closed") || decision === "accepted") return 3;
  if (
    s.includes("marketing review") ||
    decision === "awaiting_marketing_review" ||
    s.includes("client review") ||
    s.includes("awaiting")
  )
    return 2;
  if (
    s.includes("creative") ||
    s.includes("concept") ||
    s.includes("remaining requested") ||
    decision === "remaining_requested"
  )
    return 1;
  return 0;
}

function formatDate(val?: string | null): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return val;
  }
}

export const DesignRequestInspectorModal: React.FC<DesignRequestInspectorModalProps> = ({
  request,
  isOpen,
  onClose,
  onRefresh,
  mode = "marketing",
  showToast,
}) => {
  const navigate = useNavigate();
  const currentUser = useMemo(() => readAuthUser<UserProfile>(), []);
  const isGlobalAdmin = isAdminUser(currentUser);
  // ── HOOKS DECLARED UNCONDITIONALLY AT THE TOP ──
  const [activeTab, setActiveTab] = useState<TabType>("specs");
  const [copiedCode, setCopiedCode] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Workflow Reactive Synchronization State
  const [workflowVersion, setWorkflowVersion] = useState(0);
  const [isCounterDateModalOpen, setIsCounterDateModalOpen] = useState(false);
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);
  const [slaClockNow, setSlaClockNow] = useState(() => Date.now());
  const [localClosed, setLocalClosed] = useState(false);
  const [closureData, setClosureData] = useState<any>((request as any)?.closure || null);
  const requestUpdatedAtRef = useRef(request?.updatedAt);

  useEffect(() => {
    setLocalOverride(null);
    setActiveTab("specs");
    setIsCounterDateModalOpen(false);
    setSelectedFollowups([]);
    setSelectedFollowupDesigns({ mockup: [], sample: [] });
    setFollowupError(null);
    setMockupHandoffDialog(null);
    setSelectedMarketingDesignNumbers([]);
    setLocalClosed(false);
    setClosureData((request as any)?.closure || null);
    requestUpdatedAtRef.current = request?.updatedAt;
  }, [request?.id]);

  useEffect(() => {
    const previousUpdatedAt = requestUpdatedAtRef.current;
    const nextUpdatedAt = request?.updatedAt;
    if (previousUpdatedAt && nextUpdatedAt && previousUpdatedAt !== nextUpdatedAt) {
      setLocalOverride(null);
    }
    requestUpdatedAtRef.current = nextUpdatedAt;
  }, [request?.updatedAt]);

  useEffect(() => {
    if (!isOpen || (mode !== "creative" && mode !== "sampling")) return;
    setSlaClockNow(Date.now());
    const timer = window.setInterval(() => setSlaClockNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, mode]);

  // Synchronize across browser tabs and components via window events
  useEffect(() => {
    const handleStorageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!request?.id) return;
      const targetId = customEvent.detail?.id || customEvent.detail?.requestId;
      if (
        !targetId ||
        String(targetId) === String(request.id) ||
        String(targetId).includes(String(request.id)) ||
        String(request.id).includes(String(targetId))
      ) {
        setWorkflowVersion((v) => v + 1);
      }
    };
    window.addEventListener("samp:design-workflow-updated", handleStorageUpdate as EventListener);
    return () => {
      window.removeEventListener("samp:design-workflow-updated", handleStorageUpdate as EventListener);
    };
  }, [request?.id]);

  // Merge request with local workflow engine state and memory overrides
  const activeRequest = useMemo(() => {
    if (localOverride) return localOverride;
    if (!request) return null;
    return mergeWithWorkflowState(request);
  }, [request, localOverride, workflowVersion]);
  const designWorkflowState = (activeRequest as any)?.workflowState || {};
  const designSamplingEvents = Array.isArray((activeRequest as any)?.workflowEvents)
    ? (activeRequest as any).workflowEvents
    : Array.isArray(designWorkflowState.events) ? designWorkflowState.events : [];
  const latestDesignSamplingEvent = [...designSamplingEvents].reverse().find((event: Record<string, any>) =>
    (String(event.actorDepartment || "").toLowerCase().includes("sampling")
      || String(event.action || "").toLowerCase().startsWith("sampling"))
      && String(event.remark || event.body || "").trim()
  );

  const hasVerifiedClaimOwnership = Boolean(
    activeRequest?.claimedByUserId != null && currentUser?.id != null &&
    String(activeRequest.claimedByUserId) === String(currentUser.id)
  );
  const hasVerifiedSamplingClaimOwnership = Boolean(
    activeRequest?.samplingClaimedByUserId != null && currentUser?.id != null &&
    String(activeRequest.samplingClaimedByUserId) === String(currentUser.id)
  );
  // SLA Calculation for 48h Counter-Date Negotiation
  const slaStatus = useMemo(() => {
    if (!activeRequest) return { isEligible: false, hoursRemaining: 0, label: "Expired", deadlineIso: "" };
    if (activeRequest.isCounterDateActive || activeRequest.counterDateDecision === "pending") {
      const currentSla = checkCounterDateSla(activeRequest, slaClockNow);
      return { ...currentSla, isEligible: false, label: "Awaiting Marketing decision" };
    }
    if (
      activeRequest.counterDateRequestedAt ||
      activeRequest.proposedTargetDate ||
      activeRequest.counterDateDecision
    ) {
      return {
        isEligible: false,
        hoursRemaining: 0,
        label: "Counter proposal already used",
        deadlineIso: "",
      };
    }
    const stage = String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase();
    if (!stage.includes("creative") && !stage.includes("target date counter proposed")) {
      return {
        isEligible: false,
        hoursRemaining: 0,
        label: stage.startsWith("draft") ? "Available after Marketing release" : "Creative work is closed",
        deadlineIso: "",
      };
    }
    return checkCounterDateSla(activeRequest, slaClockNow);
  }, [activeRequest, slaClockNow]);

  // Marketing Decision State
  const [isDeciding, setIsDeciding] = useState(false);
  const marketingDecisionInFlightRef = useRef(false);
  const [selectedMarketingDesignNumbers, setSelectedMarketingDesignNumbers] = useState<string[]>([]);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [selectedFollowups, setSelectedFollowups] = useState<DesignFollowupScope[]>([]);
  const [selectedFollowupDesigns, setSelectedFollowupDesigns] = useState<Record<DesignFollowupScope, string[]>>({
    mockup: [],
    sample: [],
  });
  const [isAddingFollowups, setIsAddingFollowups] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [mockupHandoffDialog, setMockupHandoffDialog] = useState<"missing_stock" | "product_required" | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Chatter State
  const [internalNotes, setInternalNotes] = useState<ChatterMessage[]>([]);

  // Creative deliverable matrix state lives in this inspector workspace
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [designFileUrl, setDesignFileUrl] = useState("");
  const [copiedArtworkPath, setCopiedArtworkPath] = useState("");
  const [outputCount, setOutputCount] = useState(1);
  const [outputRows, setOutputRows] = useState<Array<{ shutterstockNo: string; remarks: string }>>([]);
  const [isSubmittingOutput, setIsSubmittingOutput] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const targetDialog = event.target instanceof Element
        ? event.target.closest<HTMLElement>('[role="dialog"][aria-modal="true"]')
        : null;
      if (targetDialog && !targetDialog.hasAttribute("data-inspector-root")) return;
      event.preventDefault();
      if (isCounterDateModalOpen) return;
      if (!isSubmittingOutput && !isDeciding && !isAddingFollowups) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCounterDateModalOpen, isSubmittingOutput, isDeciding, isAddingFollowups, onClose]);

  // Computed Values - Resolves DesignRequest primary ID without collisions
  const effectiveDesignId = useMemo(() => {
    if (!activeRequest) return null;
    if (activeRequest.designRequestId != null) {
      const num = Number(activeRequest.designRequestId);
      if (Number.isInteger(num) && num > 0) return num;
    }
    const idStr = String(activeRequest.id || "");
    if (idStr.startsWith("design-")) {
      const num = parseInt(idStr.replace("design-", ""), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    if (activeRequest.requestKind === "design") {
      const numDirect = Number(activeRequest.id);
      if (Number.isInteger(numDirect) && numDirect > 0) {
        return numDirect;
      }
    }
    return null;
  }, [activeRequest]);

  // Fallback: If opened without designRequestId, auto-resolve by DR request code
  useEffect(() => {
    if (!isOpen || !activeRequest || effectiveDesignId != null) return;
    const designCode =
      activeRequest.requestCode?.startsWith("DR-")
        ? activeRequest.requestCode
        : (activeRequest.requestCodes as any)?.design;
    if (!designCode) return;
    let cancelled = false;
    fetchDesignRequestsApi(undefined, false)
      .then((records) => {
        if (cancelled) return;
        const matched = records.find((item) => item.requestCode === designCode);
        if (matched) {
          const mapped = mapDesignRequestToSampleRequest(matched);
          setLocalOverride((prev) => (prev ? { ...prev, ...mapped, designRequestId: matched.id } : mapped));
        }
      })
      .catch((err) => {
        console.warn("Could not auto-resolve design request by code:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeRequest?.requestCode, activeRequest?.requestCodes, effectiveDesignId]);

  // Synchronize request closure events from window dispatch
  useEffect(() => {
    const handleClosed = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      const targetId = detail?.requestId;
      const normalizedTargetId = Number(String(targetId ?? "").replace(/^design-/i, ""));
      const designIds = [
        request?.designRequestId,
        request?.id,
        activeRequest?.designRequestId,
        activeRequest?.id,
        effectiveDesignId,
      ].map((value) => Number(String(value ?? "").replace(/^design-/i, "")));
      if (
        detail &&
        detail.requestType === "design" &&
        Number.isSafeInteger(normalizedTargetId) &&
        designIds.some((id) => Number.isSafeInteger(id) && id === normalizedTargetId)
      ) {
        setLocalClosed(true);
        if (detail.closure) setClosureData(detail.closure);
      }
    };
    window.addEventListener("app:request-closed", handleClosed);
    return () => window.removeEventListener("app:request-closed", handleClosed);
  }, [request?.id, request?.designRequestId, activeRequest?.id, activeRequest?.designRequestId, effectiveDesignId]);

  const activeStage = useMemo(() => getDesignStageIndex(activeRequest), [activeRequest]);
  const isClosed = Boolean(
    localClosed ||
    activeStage === 3 ||
    activeRequest?.status === "Closed" ||
    Boolean((activeRequest as any)?.is_closed) ||
    closureData != null
  );
  const isRemainingRequested = Boolean(
    activeRequest?.marketingDesignDecision === "remaining_requested" ||
    String(activeRequest?.designRequestStatus || activeRequest?.status || "").toLowerCase().includes("remaining requested")
  );

  const refCode = useMemo(() => {
    if (!activeRequest) return "";
    return activeRequest.requestCode || activeRequest.srNumber || `DR-${activeRequest.id}`;
  }, [activeRequest]);

  const requestedCount = useMemo(() => {
    if (!activeRequest) return 1;
    return Number(activeRequest.numberOfDesigns || activeRequest.productArtworkNos || activeRequest.designsCustomerCreative || 1);
  }, [activeRequest]);

  const submissions = useMemo(() => {
    return activeRequest?.creativeSubmissions || [];
  }, [activeRequest]);

  const deliveredCount = useMemo(() => {
    return submissions.reduce((sum, batch) => sum + (batch.rows?.length || 0), 0);
  }, [submissions]);

  const remainingCount = useMemo(() => {
    return Math.max(0, requestedCount - deliveredCount);
  }, [requestedCount, deliveredCount]);

  const availableDesigns: DesignFollowupArtwork[] = useMemo(() => {
    const submittedDesigns = (submissions || []).flatMap((batch: any) =>
      (Array.isArray(batch?.rows) ? batch.rows : []).map((row: any, index: number) => ({
        designNumber: String(row.designNumber || `D${index + 1}`),
        description: String(row.description || ""),
        shutterstockNo: String(row.shutterstockNo || ""),
        remarks: String(row.remarks || ""),
        designFileUrl: String(batch.designFileUrl || ""),
        submittedAt: String(batch.submittedAt || ""),
      }))
    );
    const acceptedNumbers = activeRequest?.acceptedDesignNumbers || [];
    return activeRequest?.marketingDesignDecision === "accepted" && acceptedNumbers.length
      ? submittedDesigns.filter((design) => acceptedNumbers.includes(design.designNumber))
      : submittedDesigns;
  }, [submissions, activeRequest?.acceptedDesignNumbers, activeRequest?.marketingDesignDecision]);

  useEffect(() => {
    setShowSubmitForm(false);
    setDesignFileUrl("");
    setSubmitError(null);
  }, [request?.id]);

  useEffect(() => {
    setOutputCount(1);
    setOutputRows([
      {
        shutterstockNo: "",
        remarks: "",
      },
    ]);
  }, [request?.id, deliveredCount]);

  useEffect(() => {
    if (!activeRequest?.id) return;
    setInternalNotes((activeRequest.workflowNotes || []) as ChatterMessage[]);
  }, [activeRequest?.id, activeRequest?.workflowNotes]);

  const applyWorkflowResponse = useCallback((record: Awaited<ReturnType<typeof claimDesignRequestApi>>) => {
    if (!activeRequest) return;
    const mapped = mapDesignRequestToSampleRequest(record);
    setLocalOverride({ ...activeRequest, ...mapped, id: activeRequest.id });
    setWorkflowError(null);
    setWorkflowVersion((v) => v + 1);
  }, [activeRequest]);

  const references = useMemo(() => {
    if (!activeRequest) return [];
    const list: DesignReferenceAsset[] = [];
    const imageUrls = new Set<string>();
    const linkUrls = new Set<string>();
    const addImage = (url: string | null | undefined, label: string) => {
      const cleanUrl = typeof url === "string" ? url.trim() : "";
      if (!cleanUrl || imageUrls.has(cleanUrl)) return;
      imageUrls.add(cleanUrl);
      list.push({ url: cleanUrl, label, kind: "image" });
    };
    const addLink = (url: string, label: string) => {
      const cleanUrl = url.trim();
      if (!cleanUrl || linkUrls.has(cleanUrl)) return;
      linkUrls.add(cleanUrl);
      list.push({ url: cleanUrl, label, kind: "link" });
    };

    const requestWithRawReferences = activeRequest as SampleRequestItem & Record<string, unknown>;
    const referenceLinks = [
      ...(Array.isArray(activeRequest.referenceLinks) ? activeRequest.referenceLinks : []),
      ...(Array.isArray(requestWithRawReferences.reference_links) ? requestWithRawReferences.reference_links as unknown[] : []),
    ];
    const isExternalNonImageLink = (url: string) => {
      const isWebUrl =
        /^(?:https?:\/\/|www\.)/i.test(url) || /^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/i.test(url);
      return isWebUrl && !/\.(?:png|jpe?g|webp|gif|svg|avif|bmp)(?:[?#].*)?$/i.test(url);
    };
    const isKnownLink = (url: string) =>
      referenceLinks.some((value) => getReferenceUrl(value).toLowerCase() === url.toLowerCase());
    const addImageOrLegacyLink = (value: unknown, label: string) => {
      const url = getReferenceUrl(value);
      if (!url) return;
      if (isKnownLink(url) || isExternalNonImageLink(url)) {
        addLink(url, "Reference Link");
      } else {
        addImage(url, label);
      }
    };

    addImageOrLegacyLink(activeRequest.productImagePath, "Product Reference Image");
    addImageOrLegacyLink(activeRequest.referenceImage, "Primary Reference Image");
    const rawImages = [
      ...(Array.isArray(activeRequest.referenceImages) ? activeRequest.referenceImages : []),
      ...(Array.isArray(requestWithRawReferences.reference_images) ? requestWithRawReferences.reference_images as unknown[] : []),
    ];
    rawImages.forEach((value, index) => {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : null;
      addImageOrLegacyLink(value, typeof item?.name === "string" ? item.name : `Reference Image ${index + 1}`);
    });
    referenceLinks.forEach((value, index) => {
      const url = getReferenceUrl(value);
      if (url) addLink(url, `Reference Link ${index + 1}`);
    });
    return list;
  }, [activeRequest]);

  const previewableImages = useMemo(
    () =>
      references
        .filter((r) => r.kind === "image")
        .map((r, i) => ({
          id: `design-ref-${i}-${r.url}`,
          url: r.url,
          name: r.label || `Reference Asset ${i + 1}`,
        })),
    [references]
  );

  const movePreview = (direction: -1 | 1) => {
    const currentIndex = previewableImages.findIndex((image) => image.url === lightboxImage);
    if (previewableImages.length < 2 || currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + previewableImages.length) % previewableImages.length;
    setLightboxImage(previewableImages[nextIndex].url || null);
  };

  // Dynamic Chatter Stream Compilation
  const chatterEvents = useMemo<ChatterMessage[]>(() => {
    if (!activeRequest) return [];
    const events: ChatterMessage[] = [];

    if (activeRequest.workflowEvents?.length) {
      const auditEvents: ChatterMessage[] = activeRequest.workflowEvents
        .map((event, idx) => {
          const action = typeof event.action === "string" ? event.action : "UPDATE";
          const eventTitle = typeof event.title === "string" ? event.title : "";
          const eventBody = typeof event.body === "string" ? event.body : "";
          const isDraftRelease = action === "REQUEST_RELEASED" && (
            eventTitle.toLowerCase().includes("marketing draft") || eventBody.toLowerCase().includes("pre-smt")
          );
          return {
            ...event,
            id: String(event.id || `audit-event-${idx}`),
            actorName: typeof event.actorName === "string" ? event.actorName : "",
            actorDepartment: typeof event.actorDepartment === "string" ? event.actorDepartment : "",
            action,
            title: action === "NOTE_POSTED"
              ? "Internal Note"
              : isDraftRelease
              ? "Released from Marketing Draft"
              : eventTitle || "Workflow update",
            body: isDraftRelease
              ? "Marketing released this request from the pre-SMT draft queue to Creative."
              : eventBody,
            timestamp: typeof event.timestamp === "string" ? event.timestamp : (activeRequest.updatedAt || activeRequest.createdAt || new Date().toISOString()),
            isNote: Boolean(event.isNote || action === "NOTE_POSTED"),
          };
        });
      const recordedIds = new Set(auditEvents.map((event) => event.id));
      const notes: ChatterMessage[] = internalNotes
        .filter((note) => !recordedIds.has(String(note.id || "")))
        .map((note, idx) => ({
          ...note,
          id: String(note.id || `note-${idx}`),
          actorName: typeof note.actorName === "string" ? note.actorName : "",
          actorDepartment: typeof note.actorDepartment === "string" ? note.actorDepartment : "",
          action: typeof note.action === "string" ? note.action : "NOTE",
          title: typeof note.title === "string" ? note.title : "Internal Note",
          body: typeof note.body === "string" ? note.body : "",
          timestamp: typeof note.timestamp === "string" ? note.timestamp : ((note as any).createdAt || new Date().toISOString()),
          isNote: true,
        }));
      return [...auditEvents, ...notes].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    // 1. Brief Creation Event
    events.push({
      id: "event-intake",
      actorName: activeRequest.createdBy || "",
      actorDepartment: "Marketing",
      action: "INTAKE_CREATED",
      title: "Design Brief Logged into System",
      body: `Initial graphic design brief submitted for review (${requestedCount} artwork variants requested).`,
      timestamp: activeRequest.designRequestCreatedAt || activeRequest.createdAt || activeRequest.dateRequestCreated || "",
      badge: { text: "Intake", variant: "purple" },
    });

    const releasedFromDraft = Boolean(
      activeRequest.releasedAt && (activeRequest.designRequestCreatedAt || activeRequest.createdAt) &&
      new Date(activeRequest.releasedAt).getTime() - new Date(activeRequest.designRequestCreatedAt || activeRequest.createdAt || 0).getTime() > 60_000
    );
    if (!String(activeRequest.status || "").toLowerCase().startsWith("draft")) {
      events.push({
        id: "event-release",
        actorName: activeRequest.createdBy || "",
        actorDepartment: "Marketing",
        action: "REQUEST_RELEASED",
        title: releasedFromDraft ? "Released from Marketing Draft" : "Design request released to Creative",
        body: releasedFromDraft
          ? "Marketing released this request from the pre-SMT draft queue to Creative."
          : "The design brief entered the Creative workflow.",
        timestamp: activeRequest.releasedAt || activeRequest.createdAt || "",
        badge: { text: "Released", variant: "emerald" },
      });
    }

    // 2. Task Claim Event
    if (activeRequest.claimedBy) {
      events.push({
        id: "event-claimed",
        actorName: activeRequest.claimedBy,
        actorDepartment: "Creative Studio",
        action: "TASK_CLAIMED",
        title: "Task Claimed by Creative Designer",
        body: `Designer ${activeRequest.claimedBy} officially claimed ownership of this design request.`,
        timestamp: activeRequest.claimedAt || activeRequest.updatedAt || "",
        badge: { text: "Claimed", variant: "purple" },
      });
    }

    // 3. Counter Target Date Proposal Event
    if (activeRequest.proposedTargetDate) {
      events.push({
        id: "event-counter-proposal",
        actorName: activeRequest.counterDateRequestedBy || activeRequest.claimedBy || "",
        actorDepartment: "Creative Studio",
        action: "COUNTER_DATE_PROPOSED",
        title: "Target Date Revision Countered",
        body: `Proposed revised completion date: ${formatDate(activeRequest.proposedTargetDate)}${activeRequest.counterDateReason ? `. Reason: "${activeRequest.counterDateReason}"` : ""}`,
        timestamp: activeRequest.counterDateRequestedAt || activeRequest.updatedAt || "",
        badge: { text: "Counter Date", variant: "amber" },
      });
    }

    // 4. Counter Target Date Decision Event
    if (activeRequest.counterDateDecision) {
      events.push({
        id: "event-counter-decision",
        actorName: "",
        actorDepartment: "Marketing",
        action: `COUNTER_DATE_${activeRequest.counterDateDecision.toUpperCase()}`,
        title: `Counter Target Date ${activeRequest.counterDateDecision === "accepted" ? "Accepted" : "Rejected"}`,
        body:
          activeRequest.counterDateDecision === "accepted"
            ? `Marketing accepted revised target date: ${formatDate(activeRequest.targetArtworkDateCreative)}.`
            : "Marketing rejected the counter date and retained the original deadline.",
        timestamp: activeRequest.counterDateDecisionAt || activeRequest.updatedAt || "",
        badge: {
          text: activeRequest.counterDateDecision === "accepted" ? "Date Accepted" : "Date Retained",
          variant: activeRequest.counterDateDecision === "accepted" ? "emerald" : "rose",
        },
      });
    }

    // 5. Submissions Events
    submissions.forEach((batch, idx) => {
      events.push({
        id: `event-batch-${idx}`,
        actorName: activeRequest.claimedBy || "",
        actorDepartment: "Creative Studio",
        action: "DELIVERABLE_SUBMITTED",
        title: `Artwork Batch #${idx + 1} Submitted`,
        body: `${batch.rows.length} artwork(s) uploaded${batch.designFileUrl ? ` to ${batch.designFileUrl}` : ""}.`,
        timestamp: batch.submittedAt || "",
        badge: { text: "Submitted", variant: "teal" },
      });
    });

    // 6. Marketing Review Decision Event
    if (activeRequest.marketingDesignDecision === "accepted" || activeStage === 3) {
      events.push({
        id: "event-approved",
        actorName: "",
        actorDepartment: "Marketing",
        action: "MARKETING_APPROVED",
        title: "Commercial Decision: Accepted & Closed",
        body: "All creative deliverables verified and approved for production.",
        timestamp: activeRequest.updatedAt || "",
        badge: { text: "Accepted", variant: "emerald" },
      });
    } else if (activeRequest.marketingDesignDecision === "remaining_requested") {
      events.push({
        id: "event-revision",
        actorName: "",
        actorDepartment: "Marketing",
        action: "REVISION_REQUESTED",
        title: "Remaining Artworks Requested",
        body: `Marketing returned ${remainingCount} remaining artwork(s) to Creative Studio for completion.`,
        timestamp: activeRequest.updatedAt || "",
        badge: { text: "Revisions", variant: "amber" },
      });
    }

    // 7. Merge Internal Notes
    internalNotes.forEach((n) => {
      if (n && typeof n === "object") {
        events.push({
          ...n,
          actorName: typeof n.actorName === "string" ? n.actorName : String(n.actorName || ""),
          actorDepartment: typeof n.actorDepartment === "string" ? n.actorDepartment : "",
          action: typeof n.action === "string" ? n.action : "NOTE",
        });
      }
    });

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [activeRequest, requestedCount, submissions, activeStage, remainingCount, internalNotes]);

  const universalChatterEvents = useMemo<UniversalChatterEvent[]>(() => {
    return chatterEvents.map((msg) => {
      const isNote = Boolean(msg.isNote);
      const isSystem = !isNote && (
        msg.action.includes("CREATE") ||
        msg.action.includes("CLAIM") ||
        msg.action.includes("ASSIGN") ||
        msg.action.includes("RELEASE") ||
        msg.action.includes("STATUS") ||
        msg.action.includes("DATE") ||
        msg.action.includes("START") ||
        msg.action.includes("CLOSE")
      );

      return {
        id: msg.id,
        kind: isSystem ? "system_announcement" : "bubble",
        actorName: msg.actorName || "Designer",
        actorDepartment: msg.actorDepartment || "Studio",
        summary: msg.body || msg.title,
        timestamp: msg.timestamp,
        badge: msg.badge
          ? {
              text: msg.badge.text,
              variant:
                msg.badge.variant === "emerald"
                  ? "success"
                  : msg.badge.variant === "rose"
                  ? "danger"
                  : msg.badge.variant === "amber"
                  ? "warning"
                  : "info",
            }
          : undefined,
      };
    });
  }, [chatterEvents]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(refCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleCopyArtworkPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedArtworkPath(path);
      setTimeout(() => setCopiedArtworkPath(""), 1500);
    } catch {
      setCopiedArtworkPath("");
    }
  };


  const isCreativeUser = Boolean(
    currentUser && (isGlobalAdmin || hasWorkflowTeam(currentUser, "creative"))
  );
  const isSamplingUser = Boolean(
    currentUser && (isGlobalAdmin || hasWorkflowTeam(currentUser, "samp"))
  );
  const isMarketingUser = Boolean(
    currentUser && hasWorkflowTeam(currentUser, "marketing") && !isGlobalAdmin
  );
  const requestStageLabel = String(activeRequest?.designRequestStatus || activeRequest?.status || "").toLowerCase();
  const isCreativeWorkStage = activeStage === 1 || requestStageLabel.includes("target date counter proposed");
  const isOpenDesignWork = requestStageLabel.includes("creative") || requestStageLabel.includes("target date counter proposed");

  // Business rule: Marketing users cannot claim tasks or start working on creative deliverables.
  // Creative owns the artwork claim; Sampling has a separate review claim so the two teams do not overwrite each other.
  const canClaim = Boolean(
    !isClosed &&
    !isReadOnlyTeamHead(currentUser) &&
    ((mode === "creative" && isCreativeUser && !isMarketingUser && !activeRequest?.claimedBy && isCreativeWorkStage) ||
      (mode === "sampling" && isSamplingUser && !activeRequest?.samplingClaimedBy && isOpenDesignWork))
  );

  const canProposeCounterDate = Boolean(
    !isClosed &&
    !(activeRequest?.isCounterDateActive || activeRequest?.counterDateDecision === "pending") &&
    slaStatus.isEligible &&
    ((mode === "creative" && hasVerifiedClaimOwnership) ||
      (mode === "sampling" && hasVerifiedSamplingClaimOwnership))
  );

  const handleClaim = async () => {
    if (isClaiming || !activeRequest || !effectiveDesignId || !canClaim) return;
    const name = currentUser?.name || currentUser?.userid || "Creative Designer (Studio)";
    setIsClaiming(true);
    setWorkflowError(null);
    try {
      const saved = mode === "sampling"
        ? await claimSamplingDesignRequestApi(effectiveDesignId)
        : await claimDesignRequestApi(effectiveDesignId, name);
      applyWorkflowResponse(saved);
      if (showToast) showToast("Task successfully claimed!");
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setWorkflowError(err?.message || "Could not claim this task.");
      if (onRefresh) {
        try {
          await onRefresh();
        } catch {
          // Keep the claim conflict visible; the request list can be refreshed manually.
        }
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleProposeCounterDate = async (proposedDate: string, reason: string) => {
    if (!activeRequest || !effectiveDesignId) throw new Error("Design request reference ID could not be resolved.");
    const ownsCounterDateClaim = mode === "sampling" ? hasVerifiedSamplingClaimOwnership : hasVerifiedClaimOwnership;
    if (!ownsCounterDateClaim) throw new Error("Claim this task before proposing a counter date.");
    const saved = await proposeDesignCounterDateApi(
      effectiveDesignId,
      proposedDate,
      reason,
      (mode === "sampling" ? activeRequest.samplingClaimedBy : activeRequest.claimedBy) || undefined,
      mode === "sampling" ? "sampling" : "creative",
    );
    applyWorkflowResponse(saved);
    if (showToast) showToast("Counter target date proposed to Marketing!");
    if (onRefresh) {
      try {
        await onRefresh();
      } catch {
        setWorkflowError("The counter date was sent, but the request list could not refresh. Refresh the page to sync it.");
      }
    }
  };

  const handleCounterDateDecision = async (decision: "accepted" | "rejected", notes?: string) => {
    if (!activeRequest || !effectiveDesignId) return;
    setWorkflowError(null);
    try {
      const saved = await decideDesignCounterDateApi(effectiveDesignId, decision, notes);
      applyWorkflowResponse(saved);
    } catch (error: any) {
      throw new Error(error?.message || "Could not save the counter-date decision.");
    }
    const isAccepted = decision === "accepted";
    if (showToast) {
      showToast(
        isAccepted
          ? "Counter target date accepted and updated!"
          : "Counter date rejected. Original deadline retained."
      );
    }
    if (onRefresh) {
      try {
        await onRefresh();
      } catch {
        setWorkflowError("The Marketing decision was saved, but the request list could not refresh. Refresh the page to sync it.");
      }
    }
  };

  const handleOutputCountChange = (count: number) => {
    const requestedRows = Number.isFinite(count) ? Math.trunc(count) : 1;
    const safeCount = Math.max(1, Math.min(remainingCount, requestedRows));
    setOutputCount(safeCount);
    setOutputRows((current) =>
      Array.from({ length: safeCount }, (_, index) => current[index] || ({ shutterstockNo: "", remarks: "" }))
    );
  };

  const handleSubmitOutput = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingOutput) return;
    if (!activeRequest || !effectiveDesignId) {
      setSubmitError("This design request is missing its backend reference. Refresh the request and try again.");
      return;
    }
    if (!hasVerifiedClaimOwnership) {
      setSubmitError(activeRequest.claimedBy
        ? `This task is assigned to ${activeRequest.claimedBy}. Only the assigned designer can submit artwork.`
        : "Claim this design task before submitting artwork.");
      return;
    }
    if (!designFileUrl.trim()) {
      setSubmitError("Add an artwork folder/file link or path before submitting.");
      return;
    }
    const incompleteIndex = outputRows.findIndex((row) => !row.shutterstockNo.trim() && !row.remarks.trim());
    if (incompleteIndex >= 0) {
      setSubmitError(`Artwork D${deliveredCount + incompleteIndex + 1} needs a Shutterstock No. or remark.`);
      return;
    }

    setIsSubmittingOutput(true);
    setSubmitError(null);
    try {
      const saved = await submitCreativeDesignOutputApi(
        effectiveDesignId,
        {
          designFileUrl: designFileUrl.trim(),
          rows: outputRows.map((row) => ({
            shutterstockNo: row.shutterstockNo.trim(),
            remarks: row.remarks.trim(),
          })),
        },
        activeRequest.claimedBy || undefined
      );
      applyWorkflowResponse(saved);
      setShowSubmitForm(false);
      setDesignFileUrl("");
      if (showToast) {
        showToast(isRemainingRequested && remainingCount > outputRows.length
          ? "Batch added. You can continue submitting the requested artwork in more batches."
          : "Artwork submitted to Marketing for review.");
      }
      if (onRefresh) {
        try {
          await onRefresh();
        } catch {
          setWorkflowError("Artwork was saved, but the request list could not refresh. Refresh the page to sync it.");
        }
      }
    } catch (error: any) {
      setSubmitError(error?.message || "Could not submit artwork. Check the link and try again.");
    } finally {
      setIsSubmittingOutput(false);
    }
  };

  const handleMarketingDecision = async (decision: "accept" | "request_remaining", designNumbers?: string[]) => {
    if (!activeRequest || marketingDecisionInFlightRef.current) return;
    if (decision === "accept" && !designNumbers?.length) {
      setDecisionError("Select at least one design to accept.");
      return;
    }
    if (!effectiveDesignId) {
      setDecisionError("Design request reference ID could not be resolved.");
      return;
    }
    marketingDecisionInFlightRef.current = true;
    setIsDeciding(true);
    setDecisionError(null);
    try {
      const saved = await recordMarketingDesignDecisionApi(effectiveDesignId, decision, designNumbers);
      applyWorkflowResponse(saved);
      setSelectedMarketingDesignNumbers([]);

      if (showToast) {
        showToast(
          decision === "accept"
            ? `${designNumbers?.length || 0} selected design${designNumbers?.length === 1 ? "" : "s"} accepted. Choose Mockup or Sampling from Next Work.`
            : `Creative can now submit the ${remainingCount} remaining design(s) in as many batches as needed.`
        );
      }
      if (onRefresh) await onRefresh();
      if (decision === "request_remaining") setActiveTab("deliverables");
    } catch (err: any) {
      console.error("Marketing decision failed:", err);
      setDecisionError(err?.message || "Could not record design decision. Please try again.");
    } finally {
      marketingDecisionInFlightRef.current = false;
      setIsDeciding(false);
    }
  };

  const handleToggleFollowup = (val: DesignFollowupScope) => {
    setFollowupError(null);
    setSelectedFollowups((current) =>
      current.includes(val) ? current.filter((v) => v !== val) : [...current, val]
    );
  };

  const handleToggleFollowupDesign = (scope: DesignFollowupScope, designNumber: string) => {
    setFollowupError(null);
    setSelectedFollowupDesigns((current) => {
      const selected = current[scope];
      return {
        ...current,
        [scope]: selected.includes(designNumber)
          ? selected.filter((value) => value !== designNumber)
          : [...selected, designNumber],
      };
    });
  };

  const handleSetFollowupDesigns = (scope: DesignFollowupScope, designNumbers: string[]) => {
    setFollowupError(null);
    setSelectedFollowupDesigns((current) => ({
      ...current,
      [scope]: [...new Set(designNumbers)],
    }));
  };

  const handleAddFollowups = async () => {
    if (!activeRequest || !effectiveDesignId || selectedFollowups.length === 0 || isAddingFollowups) return;
    const selectedDesignsByScope: Partial<Record<DesignFollowupScope, string[]>> = {};
    selectedFollowups.forEach((scope) => {
      selectedDesignsByScope[scope] = selectedFollowupDesigns[scope];
    });
    if (selectedFollowups.some((scope) => !selectedDesignsByScope[scope]?.length)) {
      setFollowupError("Select at least one design for each chosen follow-up.");
      return;
    }
    if (selectedFollowups.includes("mockup")) {
      const selectedNumbers = new Set(selectedFollowupDesigns.mockup);
      const missingStock = availableDesigns.filter((design) => selectedNumbers.has(design.designNumber) && !design.shutterstockNo.trim());
      if (missingStock.some((design) => !design.remarks.trim())) {
        const withoutReference = missingStock.filter((design) => !design.remarks.trim()).map((design) => design.designNumber);
        setFollowupError("Creative has not provided a Shutterstock number or remark for " + withoutReference.join(", ") + ". Ask Creative to add a reference before continuing.");
        return;
      }
      setFollowupError(null);
      setMockupHandoffDialog(missingStock.length ? "missing_stock" : "product_required");
      return;
    }
    setIsAddingFollowups(true);
    setFollowupError(null);
    try {
      await requestPostDesignDeliverablesApi(effectiveDesignId, selectedFollowups, selectedDesignsByScope);
      const addedTypes = selectedFollowups.filter((scope) => !(includedFollowups as string[]).includes(scope));
      const selectedArtworkByScope: Partial<Record<DesignFollowupScope, DesignFollowupSelection>> = {};
      selectedFollowups.forEach((scope) => {
        selectedArtworkByScope[scope] = {
          designs: availableDesigns.filter((design) => selectedFollowupDesigns[scope].includes(design.designNumber)),
          requestedAt: new Date().toISOString(),
        };
      });
      setLocalOverride({
        ...activeRequest,
        requestTypes: [...new Set([...(activeRequest.requestTypes || []), ...selectedFollowups])],
        mockupWorkflowState: {
          ...activeRequest.mockupWorkflowState,
          stage: activeRequest.mockupWorkflowState?.stage || "creative",
          designFollowups: {
            ...activeRequest.mockupWorkflowState?.designFollowups,
            ...selectedArtworkByScope,
          },
        },
      });
      setSelectedFollowups([]);
      setSelectedFollowupDesigns({ mockup: [], sample: [] });
      if (showToast) {
        showToast(addedTypes.length
          ? `${addedTypes.map((scope) => scope === "mockup" ? "Mockup" : "Sampling").join(" and ")} added to this request.`
          : "Those deliverables are already part of this request.");
      }
      if (onRefresh) {
        try {
          await onRefresh();
        } catch {
          setWorkflowError("The follow-up work was saved, but the request list could not refresh. Refresh the page to sync it.");
        }
      }
    } catch (error: any) {
      setFollowupError(error?.message || "Could not add the follow-up work. Please try again.");
    } finally {
      setIsAddingFollowups(false);
    }
  };

  // ── EARLY RETURN AFTER ALL HOOKS ──
  const handleContinueToProductStaging = async () => {
    if (!activeRequest || !effectiveDesignId || isAddingFollowups) return;
    const artwork = availableDesigns.filter((design) => selectedFollowupDesigns.mockup.includes(design.designNumber));
    setIsAddingFollowups(true);
    setFollowupError(null);
    try {
      if (selectedFollowups.includes("sample")) {
        await requestPostDesignDeliverablesApi(effectiveDesignId, ["sample"], { sample: selectedFollowupDesigns.sample });
      }
      navigate("/sample-requests/product-staging", {
        state: {
          customer: activeRequest.customer || "",
          programName: activeRequest.programName || "",
          programYear: activeRequest.programYear || "2026",
          year: activeRequest.year || "",
          targetPlant: activeRequest.targetPlant || "",
          designMockupHandoff: {
            designRequestId: effectiveDesignId,
            sourceSrNumber: activeRequest.srNumber || "",
            designs: artwork,
          },
        },
      });
    } catch (error: any) {
      setFollowupError(error?.message || "Could not start Product Staging for these designs.");
    } finally {
      setIsAddingFollowups(false);
    }
  };

  const isAwaitingReview =
    activeRequest?.marketingDesignDecision === "awaiting_marketing_review" ||
    activeStage === 2;
  const isAcceptedByMarketing = mode === "marketing" && activeRequest?.marketingDesignDecision === "accepted";
  const acceptedDesignCount = activeRequest?.acceptedDesignNumbers?.length ||
    (activeRequest?.marketingDesignDecision === "accepted" ? deliveredCount : 0);
  const canSubmitCreativeOutput = Boolean(
    mode === "creative" &&
    isCreativeUser &&
    !isMarketingUser &&
    !isReadOnlyTeamHead(currentUser) &&
    hasVerifiedClaimOwnership &&
    isCreativeWorkStage &&
    !isAwaitingReview &&
    !isClosed &&
    remainingCount > 0
  );
  const includedFollowups = (activeRequest?.requestTypes || []) as string[];
  const isCounterDatePending = Boolean(
    activeRequest?.isCounterDateActive || activeRequest?.counterDateDecision === "pending"
  );
  const isCounterDateVisible = Boolean(
    activeRequest?.proposedTargetDate &&
      (isCounterDatePending || ["accepted", "rejected", "auto_accepted"].includes(String(activeRequest?.counterDateDecision || "")))
  );
  const counterDateProposerTitle = activeRequest?.workflowEvents?.find(
    (event: any) => event.action === "COUNTER_DATE_PROPOSED"
  )?.actorDepartment === "Sampling PMT" ? "Sampling Team" : "Creative Studio";
  const isCreator = Boolean(
    (activeRequest?.createdByUserId && currentUser?.id && Number(activeRequest.createdByUserId) === Number(currentUser.id)) ||
    (activeRequest?.createdBy && (
      (currentUser?.userid && activeRequest.createdBy.toLowerCase() === currentUser.userid.toLowerCase()) ||
      (currentUser?.name && activeRequest.createdBy.toLowerCase() === currentUser.name.toLowerCase())
    ))
  );
  // STRICT RULE: Close request is ONLY available to the Marketing user who raised the request (or admin)
  const canCloseDesignRequest = Boolean(
    !isReadOnlyTeamHead(currentUser) && (isGlobalAdmin || (isMarketingUser && isCreator))
  );
  const canCloseInspector = !isSubmittingOutput && !isDeciding && !isAddingFollowups;

  const designRequestId = Number(
    effectiveDesignId ||
    activeRequest?.designRequestId ||
    String(activeRequest?.id || "").replace(/^design-/, "")
  ) || 0;

  if (!isOpen || !activeRequest) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-[var(--overlay-backdrop)]"
      onClick={(event) => {
        if (event.target === event.currentTarget && canCloseInspector) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-inspector-title"
        data-inspector-root="true"
        className="relative w-full max-w-[92vw] xl:max-w-6xl 2xl:max-w-7xl h-[88vh] max-h-[88vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] overflow-hidden select-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {isClosed && <RequestClosedStamp label="REQUEST WAS CLOSED" />}
        {/* 1. TOP CONTROL PANEL */}
        <DesignControlPanel
          activeRequest={activeRequest}
          refCode={refCode}
          copiedCode={copiedCode}
          onClose={onClose}
          onCopyCode={handleCopyCode}
          mode={mode}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          activeStage={activeStage}
          deliveredCount={deliveredCount}
          requestedCount={requestedCount}
          isAwaitingReview={isAwaitingReview}
          isClosed={isClosed}
          isAcceptedByMarketing={isAcceptedByMarketing}
          closureRequests={designRequestId > 0 ? [{ type: "design", id: designRequestId }] : []}
          canCloseRequest={canCloseDesignRequest}
          onRequestClosed={onRefresh}
        />



        {/* 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + TIME LOG) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: FORM SHEET (DOCUMENT BODY) */}
          <div className="min-h-0 min-w-0 flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)]">
            {/* ── 1. PRIMARY SECTION TABS (TOP OF SHEET) ── */}
            <div className="px-6 sm:px-8 pt-2.5 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] shrink-0">
              <div className="flex items-center space-x-6 text-xs font-semibold overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveTab("specs")}
                  className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "specs"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <span>1. Scope &amp; Design Brief</span>
                  {references.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-base)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                      {references.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("deliverables")}
                  className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "deliverables"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <span>2. Creative Deliverables &amp; Review</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums bg-[var(--surface-base)] text-[var(--on-surface)] border border-[var(--border-subtle)]">
                    {deliveredCount}/{requestedCount}
                  </span>
                  {isAwaitingReview && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-amber-50 text-amber-800  ">
                      Review Pending
                    </span>
                  )}
                  {isCounterDateVisible && (
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-display font-bold ${
                      activeRequest.counterDateDecision === "rejected"
                        ? "bg-rose-50 text-rose-800  "
                        : activeRequest.counterDateDecision === "accepted" || activeRequest.counterDateDecision === "auto_accepted"
                        ? "bg-emerald-50 text-emerald-800  "
                        : "bg-amber-50 text-amber-800  "
                    }`}>
                      {activeRequest.counterDateDecision === "rejected"
                        ? "Date Declined"
                        : activeRequest.counterDateDecision === "accepted" || activeRequest.counterDateDecision === "auto_accepted"
                        ? "Date Accepted"
                        : "Date Proposal"}
                    </span>
                  )}
                  {isRemainingRequested && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-rose-50 text-rose-800  ">
                      Revisions
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("signoff")}
                  className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "signoff"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <span>3. Commercial Sign-Off</span>
                  {isClosed && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-display font-bold bg-emerald-50 text-emerald-700  ">
                      ✓ Approved
                    </span>
                  )}
                </button>

                {mode === "marketing" && isAcceptedByMarketing && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("next_work")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "next_work"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <span>4. Next Work</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                      Mockup / Sampling
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* ── 2. SCROLLABLE DOCUMENT WORKSPACE ── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {workflowError && (
                <div role="alert" className="mx-6 sm:mx-8 mt-4 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium    shadow-2xs">
                  {workflowError}
                </div>
              )}

              {mode === "marketing" && activeRequest.mockupWorkflowState?.stage === "marketing" && activeRequest.mockupWorkflowState.mockupUrl && (
                <div className="mx-6 sm:mx-8 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3   shadow-2xs">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900 ">Studio mockup ready</p>
                    <p className="mt-0.5 text-xs text-emerald-800/80 ">Studio submitted the mockup for this request.</p>
                  </div>
                  <a
                    href={activeRequest.mockupWorkflowState.mockupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 shadow-2xs"
                  >
                    <span>Open mockup</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* ── 2. DOCUMENT HERO & HEADER STRIP ── */}
              <DesignSheetHeader
                activeRequest={activeRequest}
                mode={mode}
                currentUserName={currentUser?.name}
                currentUserId={currentUser?.id}
                isClaimed={Boolean(mode === "sampling" ? activeRequest.samplingClaimedBy : activeRequest.claimedBy)}
                claimedBy={(mode === "sampling" ? activeRequest.samplingClaimedBy : activeRequest.claimedBy) || undefined}
                canClaim={canClaim}
                isClaiming={isClaiming}
                onClaim={() => handleClaim()}
              />

              {/* ── 3. ACTIVE TAB CONTENT ── */}
              <div className="px-6 sm:px-8 pb-8 pt-4 space-y-6">
                {/* ── TAB 1: SCOPE & DESIGN BRIEF ── */}
                {activeTab === "specs" && (
                  <div className="py-4">
                    <DesignBriefTab
                      activeRequest={activeRequest}
                      references={references}
                      onPreviewImage={setLightboxImage}
                      mode={mode}
                    />
                  </div>
                )}

                {/* ── TAB 2: DELIVERABLES & REVIEW ── */}
                {activeTab === "deliverables" && (
                  <div className="space-y-4 py-4">
                    {canProposeCounterDate && (mode === "creative" || mode === "sampling") && (
                      <section
                        aria-label="Counter-date proposal"
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3  "
                      >
                        <div className="flex min-w-0 items-start gap-2.5">
                          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 " />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-amber-950 ">Need a revised target date?</p>
                            <p className="mt-0.5 text-[11px] text-amber-800 ">
                              Send a counter-date proposal to Marketing while the 48-hour window is open.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsCounterDateModalOpen(true)}
                          className="shrink-0 rounded-lg bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30"
                        >
                          Propose date
                        </button>
                      </section>
                    )}
                    {isCounterDateVisible && activeRequest.proposedTargetDate && (
                      <MarketingCounterDateBanner
                        originalDate={formatDate(
                          activeRequest.counterDateOriginalTargetDate ||
                          activeRequest.workflowState?.counterDateOriginalTargetDate ||
                          (activeRequest.counterDateDecision === "accepted" || activeRequest.counterDateDecision === "auto_accepted"
                            ? ""
                            : activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)
                        )}
                        proposedDate={formatDate(activeRequest.proposedTargetDate)}
                        reason={activeRequest.counterDateReason}
                        claimedBy={activeRequest.counterDateRequestedBy}
                        requestedAt={activeRequest.counterDateRequestedAt}
                        isMarketingMode={mode === "marketing"}
                        proposerTitle={counterDateProposerTitle}
                        decision={activeRequest.counterDateDecision || "pending"}
                        decisionNotes={activeRequest.counterDateDecisionNotes}
                        decisionAt={activeRequest.counterDateDecisionAt}
                        onAccept={() => handleCounterDateDecision("accepted")}
                        onReject={(notes) => handleCounterDateDecision("rejected", notes)}
                      />
                    )}
                    <DesignDeliverablesTab
                      activeRequest={activeRequest}
                      mode={mode}
                      deliveredCount={deliveredCount}
                      requestedCount={requestedCount}
                      remainingCount={remainingCount}
                      isAwaitingReview={isAwaitingReview}
                      isRemainingRequested={isRemainingRequested}
                      canSubmitCreativeOutput={canSubmitCreativeOutput}
                      showSubmitForm={showSubmitForm}
                      onToggleSubmitForm={() => {
                        setSubmitError(null);
                        setShowSubmitForm((visible) => !visible);
                      }}
                      designFileUrl={designFileUrl}
                      onChangeDesignFileUrl={setDesignFileUrl}
                      outputCount={outputCount}
                      onChangeOutputCount={handleOutputCountChange}
                      outputRows={outputRows}
                      onChangeOutputRows={setOutputRows}
                      isSubmittingOutput={isSubmittingOutput}
                      submitError={submitError}
                      onSubmitBatch={handleSubmitOutput}
                      onCancelSubmit={() => {
                        setShowSubmitForm(false);
                        setSubmitError(null);
                      }}
                      isDeciding={isDeciding}
                      decisionError={decisionError}
                      onMarketingDecision={handleMarketingDecision}
                      selectedMarketingDesignNumbers={selectedMarketingDesignNumbers}
                      onToggleMarketingDesign={(designNumber) => {
                        setDecisionError(null);
                        setSelectedMarketingDesignNumbers((current) => current.includes(designNumber)
                          ? current.filter((number) => number !== designNumber)
                          : [...current, designNumber]);
                      }}
                      isAcceptedByMarketing={isAcceptedByMarketing}
                      onOpenNextWork={() => setActiveTab("next_work")}
                      submissions={submissions}
                      copiedArtworkPath={copiedArtworkPath}
                      onCopyArtworkPath={handleCopyArtworkPath}
                    />
                  </div>
                )}

                {/* ── TAB 3: COMMERCIAL SIGN-OFF ── */}
                {activeTab === "signoff" && (
                  <div className="py-4 space-y-4">
                    {isClosed || isAcceptedByMarketing ? (
                      <div className="p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center shadow-2xs space-y-3">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                        <div>
                          <h4 className="text-base font-bold text-emerald-600 ">
                            Design Request Approved &amp; Signed Off
                          </h4>
                          <p className="text-xs text-[var(--on-surface-muted)] mt-1 max-w-md mx-auto">
                            Marketing approved {acceptedDesignCount} selected design{acceptedDesignCount === 1 ? "" : "s"}. This design cycle is completed.
                          </p>
                        </div>
                        {mode === "marketing" && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setActiveTab("next_work")}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                            >
                              <span>Configure Next Work (Mockup / Sampling)</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : mode === "marketing" && (isAwaitingReview || isRemainingRequested || deliveredCount > 0) ? (
                      <div className="p-5 rounded-2xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.03] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)]">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Commercial Review &amp; Sign-Off</span>
                          </div>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                            {deliveredCount}/{requestedCount} Artworks Delivered
                          </span>
                        </div>
                        <p className="text-xs text-[var(--on-surface-muted)] leading-relaxed">
                          Select the client-approved design(s) in Creative Deliverables before signing off. You can approve a design already delivered while Creative is still working on the remaining request.
                        </p>
                        {decisionError && (
                          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 ">
                            {decisionError}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setActiveTab("deliverables")}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Select Designs to Accept</span>
                          </button>
                          {remainingCount > 0 && !isRemainingRequested && (
                            <button
                              type="button"
                              disabled={isDeciding}
                              onClick={() => handleMarketingDecision("request_remaining")}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] text-xs font-semibold text-[var(--on-surface)] transition cursor-pointer"
                            >
                              <span>Request Remaining ({remainingCount})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-center shadow-2xs space-y-2">
                        <Clock className="mx-auto h-10 w-10 text-[var(--on-surface-muted)]/60" />
                        <h4 className="text-sm font-semibold text-[var(--on-surface)]">
                          Awaiting Creative Studio Submission
                        </h4>
                        <p className="text-xs text-[var(--on-surface-muted)] max-w-md mx-auto leading-relaxed">
                          Creative deliverables are currently in progress ({deliveredCount} of {requestedCount} artworks ready). Once submitted by the designer, Marketing can review and execute commercial sign-off here.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 4: NEXT WORK ── */}
                {activeTab === "next_work" && mode === "marketing" && isAcceptedByMarketing && (
                  <DesignNextWorkTab
                    refCode={refCode}
                    includedFollowups={includedFollowups}
                    selectedFollowups={selectedFollowups}
                    selectedDesigns={selectedFollowupDesigns}
                    availableDesigns={availableDesigns}
                    onToggleFollowup={handleToggleFollowup}
                    onToggleDesign={handleToggleFollowupDesign}
                    onSetDesigns={handleSetFollowupDesigns}
                    isAddingFollowups={isAddingFollowups}
                    followupError={followupError}
                    onAddFollowups={handleAddFollowups}
                    effectiveDesignId={effectiveDesignId}
                  />
                )}
                <SamplingResponsePanel
                  className="mt-6"
                  response={activeRequest.samplingRemark
                    || (activeRequest as any).samplingFeedback
                    || (activeRequest as any).samplingReviewRemark
                    || designWorkflowState.samplingFeedback
                    || designWorkflowState.samplingReviewRemark
                    || latestDesignSamplingEvent?.remark
                    || latestDesignSamplingEvent?.body}
                  decision={(activeRequest as any).samplingReviewDecision || designWorkflowState.samplingReviewDecision}
                  reviewer={(activeRequest as any).samplingReviewedBy || (activeRequest as any).samplingFeedbackBy || designWorkflowState.samplingReviewedBy || latestDesignSamplingEvent?.actorName}
                  respondedAt={(activeRequest as any).samplingReviewedAt || (activeRequest as any).samplingFeedbackAt || designWorkflowState.samplingReviewedAt || latestDesignSamplingEvent?.timestamp}
                />
              </div>
            </div>
          </div>

          {/* ── RIGHT: AUDIT TRAIL & CHATTER ── */}
          <UniversalChatterFeed
            title="Audit & Activity Log"
            events={universalChatterEvents}
            currentUser={currentUser}
          />
        </div>
      </div>

      {/* Counter Target Date Proposal Modal */}
      {isCounterDateModalOpen && (
        <FeasibilityCounterDateModal
          isOpen={isCounterDateModalOpen}
          onClose={() => setIsCounterDateModalOpen(false)}
          originalDate={activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate || ""}
          isEligible={canProposeCounterDate}
          statusLabel={slaStatus.label}
          onSubmitCounterDate={handleProposeCounterDate}
        />
      )}

      {mockupHandoffDialog === "missing_stock" && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[var(--overlay-backdrop)] p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="mockup-stock-confirm-title" className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-2xl">
            <h3 id="mockup-stock-confirm-title" className="text-sm font-bold text-[var(--on-surface)]">Continue without a Shutterstock number?</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--on-surface-muted)]">
              Creative left a remark for the selected design(s), but no Shutterstock number. If you continue, Product Staging will let you choose a Material Code or Binding, then each selected design will be sent as its own Mockup request directly to Studio.
            </p>
            <div className="mt-3 space-y-2">
              {availableDesigns.filter((design) => selectedFollowupDesigns.mockup.includes(design.designNumber) && !design.shutterstockNo.trim()).map((design) => (
                <div key={design.designNumber} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--on-surface)]">{design.designNumber}{design.description ? " · " + design.description : ""}</p>
                  <p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">{design.remarks}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isAddingFollowups} onClick={() => setMockupHandoffDialog(null)} className="h-9 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] disabled:opacity-50">Go back</button>
              <button type="button" disabled={isAddingFollowups} onClick={handleContinueToProductStaging} className="h-9 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">
                {isAddingFollowups ? "Opening Product Staging…" : "Yes, continue"}
              </button>
            </div>
          </section>
        </div>
      )}

      {mockupHandoffDialog === "product_required" && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[var(--overlay-backdrop)] p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="mockup-product-required-title" className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-2xl">
            <h3 id="mockup-product-required-title" className="text-sm font-bold text-[var(--on-surface)]">Choose the product for each Mockup</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--on-surface-muted)]">
              {selectedFollowupDesigns.mockup.length} separate Mockup request(s) will be created. Select a Material Code or Binding product in Product Staging, then set the required date. Each request will include its selected product and Creative reference before going to Studio.
            </p>
            {followupError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700 ">{followupError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isAddingFollowups} onClick={() => setMockupHandoffDialog(null)} className="h-9 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isAddingFollowups} onClick={handleContinueToProductStaging} className="h-9 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">
                {isAddingFollowups ? "Opening Product Staging…" : "Choose product"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Full Resolution Image Lightbox Modal */}
      <ImageLightboxModal
        selectedImage={lightboxImage}
        images={previewableImages}
        onClose={() => setLightboxImage(null)}
        onNavigate={movePreview}
        onSelectImage={(url) => setLightboxImage(url)}
      />
    </div>,
    document.body
  );
};

export default DesignRequestInspectorModal;
