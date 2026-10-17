import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Palette,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { DesignFollowupArtwork, DesignFollowupScope, DesignFollowupSelection, SampleRequestItem } from "../types";
import {
  submitCreativeDesignOutputApi,
  recordMarketingDesignDecisionApi,
  requestPostDesignDeliverablesApi,
  claimDesignRequestApi,
  proposeDesignCounterDateApi,
  decideDesignCounterDateApi,
  addDesignWorkflowNoteApi,
  mapDesignRequestToSampleRequest,
} from "@/infrastructure/api/sampleRequestsApi";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  mergeWithWorkflowState,
  checkCounterDateSla,
} from "../utils/designWorkflowStorage";
import {
  DesignClaimStrip,
  DesignCounterDateModal,
  MarketingCounterDateBanner,
  DesignBriefTab,
  DesignDeliverablesTab,
  DesignChatterStream,
  DesignNextWorkTab,
  DesignMetadataStrip,
  ChatterMessage,
  DesignReferenceAsset,
} from "./inspector";

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
  // ── HOOKS DECLARED UNCONDITIONALLY AT THE TOP ──
  const [activeTab, setActiveTab] = useState<TabType>("specs");
  const [copiedCode, setCopiedCode] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Workflow Reactive Synchronization State
  const [workflowVersion, setWorkflowVersion] = useState(0);
  const [isCounterDateModalOpen, setIsCounterDateModalOpen] = useState(false);
  const [localOverride, setLocalOverride] = useState<SampleRequestItem | null>(null);
  const [slaClockNow, setSlaClockNow] = useState(() => Date.now());
  const requestUpdatedAtRef = useRef(request?.updatedAt);

  useEffect(() => {
    setLocalOverride(null);
    setActiveTab("specs");
    setIsCounterDateModalOpen(false);
    setSelectedFollowups([]);
    setSelectedFollowupDesigns({ mockup: [], sample: [] });
    setFollowupError(null);
    setMockupHandoffDialog(null);
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
    if (!isOpen || mode !== "creative") return;
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
    const stage = String(activeRequest.status || "").toLowerCase();
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
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Chatter State
  const [noteInput, setNoteInput] = useState("");
  const [chatterFilter, setChatterFilter] = useState<"all" | "audit" | "notes">("all");
  const [internalNotes, setInternalNotes] = useState<ChatterMessage[]>([]);
  const chatterEndRef = useRef<HTMLDivElement | null>(null);

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
      event.preventDefault();
      if (isCounterDateModalOpen) return;
      if (!isSubmittingOutput && !isDeciding && !isPostingNote && !isAddingFollowups) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCounterDateModalOpen, isSubmittingOutput, isDeciding, isPostingNote, isAddingFollowups, onClose]);

  // Computed Values
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
    const numDirect = Number(activeRequest.id);
    if (Number.isInteger(numDirect) && numDirect > 0) {
      return numDirect;
    }
    return null;
  }, [activeRequest]);

  const activeStage = useMemo(() => getDesignStageIndex(activeRequest), [activeRequest]);
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
    addImageOrLegacyLink(activeRequest.referenceImage, "Primary Moodboard Image");
    const rawImages = [
      ...(Array.isArray(activeRequest.referenceImages) ? activeRequest.referenceImages : []),
      ...(Array.isArray(requestWithRawReferences.reference_images) ? requestWithRawReferences.reference_images as unknown[] : []),
    ];
    rawImages.forEach((value, index) => {
      const item = value && typeof value === "object" ? value as Record<string, unknown> : null;
      addImageOrLegacyLink(value, typeof item?.name === "string" ? item.name : `Moodboard Image ${index + 1}`);
    });
    referenceLinks.forEach((value, index) => {
      const url = getReferenceUrl(value);
      if (url) addLink(url, `Reference Link ${index + 1}`);
    });
    return list;
  }, [activeRequest]);

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

  const filteredChatter = useMemo(() => {
    if (chatterFilter === "audit") return chatterEvents.filter((e) => !e.isNote);
    if (chatterFilter === "notes") return chatterEvents.filter((e) => e.isNote);
    return chatterEvents;
  }, [chatterEvents, chatterFilter]);

  useEffect(() => {
    chatterEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [filteredChatter.length, isOpen, request?.id]);

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

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPostingNote || !noteInput.trim() || !effectiveDesignId) return;
    setIsPostingNote(true);
    setWorkflowError(null);
    try {
      const saved = await addDesignWorkflowNoteApi(
        effectiveDesignId,
        noteInput.trim(),
        mode === "creative" ? "Creative Studio" : "Marketing"
      );
      applyWorkflowResponse(saved);
      setNoteInput("");
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setWorkflowError(err?.message || "Could not save the note. Please retry.");
    } finally {
      setIsPostingNote(false);
    }
  };

  const handleClaim = async () => {
    if (isClaiming || !activeRequest || !effectiveDesignId) return;
    const name = "Creative Designer (Studio)";
    setIsClaiming(true);
    setWorkflowError(null);
    try {
      const saved = await claimDesignRequestApi(effectiveDesignId, name);
      applyWorkflowResponse(saved);
      if (showToast) showToast("Task successfully claimed!");
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      setWorkflowError(err?.message || "Could not claim this task.");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleProposeCounterDate = async (proposedDate: string, reason: string) => {
    if (!activeRequest || !effectiveDesignId) throw new Error("Design request reference ID could not be resolved.");
    const saved = await proposeDesignCounterDateApi(effectiveDesignId, proposedDate, reason, activeRequest.claimedBy || undefined);
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
    if (!activeRequest.claimedBy) {
      setSubmitError("Claim this design task before submitting artwork.");
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
        activeRequest.claimedBy
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

  const handleMarketingDecision = async (decision: "accept" | "request_remaining") => {
    if (!activeRequest) return;
    if (!effectiveDesignId) {
      setDecisionError("Design request reference ID could not be resolved.");
      return;
    }
    setIsDeciding(true);
    setDecisionError(null);
    try {
      const saved = await recordMarketingDesignDecisionApi(effectiveDesignId, decision);
      applyWorkflowResponse(saved);

      if (showToast) {
        showToast(
          decision === "accept"
            ? "Artwork accepted. Choose Mockup or Sampling from the Next Work stage."
            : `Creative can now submit the ${remainingCount} remaining design(s) in as many batches as needed.`
        );
      }
      if (onRefresh) await onRefresh();
      if (decision === "request_remaining") setActiveTab("deliverables");
    } catch (err: any) {
      console.error("Marketing decision failed:", err);
      setDecisionError(err?.message || "Could not record design decision. Please try again.");
    } finally {
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

  if (!isOpen || !activeRequest) return null;

  const isAwaitingReview =
    activeRequest.marketingDesignDecision === "awaiting_marketing_review" ||
    activeStage === 2;
  const isClosed = activeStage === 3;
  const isAcceptedByMarketing = mode === "marketing" && activeRequest.marketingDesignDecision === "accepted";
  const includedFollowups = (activeRequest.requestTypes || []) as string[];
  const availableDesigns: DesignFollowupArtwork[] = (activeRequest.creativeSubmissions || []).flatMap((batch: any) =>
    (Array.isArray(batch?.rows) ? batch.rows : []).map((row: any, index: number) => ({
      designNumber: String(row.designNumber || `D${index + 1}`),
      description: String(row.description || ""),
      shutterstockNo: String(row.shutterstockNo || ""),
      remarks: String(row.remarks || ""),
      designFileUrl: String(batch.designFileUrl || ""),
      submittedAt: String(batch.submittedAt || ""),
    })),
  );
  const isCounterDatePending = Boolean(
    activeRequest.isCounterDateActive || activeRequest.counterDateDecision === "pending"
  );
  const requestStageLabel = String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase();
  const isCreativeWorkStage = activeStage === 1 || requestStageLabel.includes("target date counter proposed");
  const canSubmitCreativeOutput = mode === "creative" && isCreativeWorkStage && !isAwaitingReview && !isClosed && remainingCount > 0;
  const canCloseInspector = !isSubmittingOutput && !isDeciding && !isPostingNote && !isAddingFollowups;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs animate-smooth-backdrop sm:p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && canCloseInspector) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-inspector-title"
        className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] select-text xl:max-w-7xl animate-smooth-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 1. TOP CONTROL PANEL (MODERN ERP STYLE) ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5 shadow-2xs sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => canCloseInspector && onClose()}
              disabled={!canCloseInspector}
              className="inline-flex items-center rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              Save &amp; Close
            </button>
            <button
              type="button"
              onClick={() => canCloseInspector && onClose()}
              disabled={!canCloseInspector}
              className="rounded-xl bg-[var(--surface-low)] px-3.5 py-1.5 text-xs font-medium text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
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
            <div className="hidden min-w-0 items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-1 sm:flex">
              {[
                { label: "1. Intake", state: "done" as const },
                { label: "2. Creative Studio", state: activeStage > 1 ? "done" as const : activeStage === 1 ? "active" as const : "pending" as const },
                { label: "3. Marketing Review", state: activeStage > 2 ? "done" as const : activeStage === 2 ? "active" as const : "pending" as const },
                { label: "4. Next Work", state: activeStage >= 3 ? (includedFollowups.some((value) => value === "mockup" || value === "sample") ? "done" as const : "active" as const) : "pending" as const },
              ].map((step, index, steps) => (
                <React.Fragment key={step.label}>
                  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] ${step.state === "done" ? "bg-[var(--surface-lowest)] font-bold text-[var(--accent-primary)] shadow-2xs" : step.state === "active" ? "border border-[var(--accent-primary)] bg-[var(--surface-lowest)] font-bold text-[var(--on-surface)] shadow-2xs" : "font-medium text-[var(--on-surface-subtle)]"}`}>
                    {step.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> : step.state === "active" ? <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />}
                    {step.label}
                  </span>
                  {index < steps.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--border-strong)]" />}
                </React.Fragment>
              ))}
            </div>
            <button
              type="button"
              onClick={() => canCloseInspector && onClose()}
              disabled={!canCloseInspector}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── 2. MAIN WORKSPACE VIEWPORT (SPLIT: FORM SHEET + CHATTER) ── */}
        {workflowError && (
          <div role="alert" className="shrink-0 px-5 py-2 bg-rose-50 text-rose-800 border-b border-rose-200 text-xs font-medium dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900">
            {workflowError}
          </div>
        )}

        {mode === "marketing" && activeRequest.mockupWorkflowState?.stage === "marketing" && activeRequest.mockupWorkflowState.mockupUrl && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Studio mockup ready</p>
              <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">Studio submitted the mockup for this request.</p>
            </div>
            <a
              href={activeRequest.mockupWorkflowState.mockupUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
            >
              Open mockup <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* ── LEFT: FORM SHEET (DOCUMENT BODY) ── */}
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto bg-[var(--bg-app)] p-4 md:p-6">
            <div className="max-w-4xl mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden">
              {/* Sheet Header */}
              <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
                {/* Request reference */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 sm:px-8">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                      {refCode}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700">/</span>
                    <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                      {mode === "sampling" ? "Sampling PMT Technical Review" : "Design Request"}
                    </span>
                  </div>
                </div>

                {/* Document Hero & Primary Details */}
                <div className="px-4 py-4 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 id="design-inspector-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 font-display">
                        {activeRequest.customer || ""}
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        {activeRequest.productDescription || "Commercial Creative Design Brief"}
                        {activeRequest.createdBy ? <> · Initiated by <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest.createdBy}</span></> : ""}
                        {activeRequest.createdBy && (activeRequest.dateRequestCreated || activeRequest.createdAt) ? " · " : ""}
                        {formatDate(activeRequest.dateRequestCreated || activeRequest.createdAt)}
                      </p>
                    </div>

                    {/* Context Badges */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${
                        mode === "sampling"
                          ? "bg-purple-50 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-500/20"
                          : "bg-emerald-50 text-[var(--accent-primary)] dark:bg-emerald-950/50 dark:text-emerald-300 border-[var(--accent-primary)]/20"
                      }`}>
                        <Palette className="w-3.5 h-3.5" />
                        <span>{mode === "sampling" ? "Sampling Review (Design Brief)" : "Design Request"}</span>
                      </span>
                      <StatusPill
                        status={activeRequest.designRequestStatus || activeRequest.status || "Creative"}
                        size="md"
                      />
                    </div>
                  </div>

                  {mode === "sampling" && (
                    <div className="mt-4 p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/20 flex items-start gap-3">
                      <Palette className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <div className="space-y-0.5 text-xs">
                        <p className="font-bold text-purple-950 dark:text-purple-200">
                          Sampling PMT Feasibility &amp; Technical Reference View
                        </p>
                        <p className="text-purple-900/80 dark:text-purple-300/80">
                          Review design trends, target audience, moodboard assets, and submitted artwork variants to prepare tooling, color separations, and die estimations.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 4-Point Metadata Strip (Memoized Component) */}
                  <DesignMetadataStrip
                    activeRequest={activeRequest}
                    mode={mode}
                    requestedCount={requestedCount}
                    isCounterDatePending={isCounterDatePending}
                    slaStatus={slaStatus}
                    onOpenCounterDateModal={() => {
                      setWorkflowError(null);
                      setIsCounterDateModalOpen(true);
                    }}
                  />
                </div>

                {/* Workflow Negotiation & Task Claim Strips */}
                <div className="px-8 space-y-2.5 pb-2.5">
                  {/* Counter Date Negotiation Banner */}
                  {isCounterDatePending && (
                    <MarketingCounterDateBanner
                      originalDate={formatDate(activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)}
                      proposedDate={formatDate(activeRequest.proposedTargetDate)}
                      reason={activeRequest.counterDateReason}
                      claimedBy={activeRequest.counterDateRequestedBy || activeRequest.claimedBy}
                      requestedAt={activeRequest.counterDateRequestedAt}
                      isMarketingMode={mode === "marketing"}
                      onAccept={() => handleCounterDateDecision("accepted")}
                      onReject={(notes) => handleCounterDateDecision("rejected", notes)}
                    />
                  )}

                  {/* Task Ownership & Claim Strip */}
                  <DesignClaimStrip
                    claimedBy={activeRequest.claimedBy}
                    claimedAt={activeRequest.claimedAt}
                    isCreativeMode={mode === "creative"}
                    isClaiming={isClaiming}
                    canClaim={isCreativeWorkStage && slaStatus.isEligible}
                    claimDisabledReason={
                      isCreativeWorkStage
                        ? slaStatus.label
                        : "This design request must be released to Creative before it can be claimed."
                    }
                    slaLabel={mode === "creative" ? slaStatus.label : undefined}
                    onClaim={() => handleClaim()}
                  />
                </div>

                {/* Notebook Tab Strip */}
                <div className="px-8 pb-1 pt-3">
                  <div className="border-b border-slate-100 dark:border-white/10 flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setActiveTab("specs")}
                      className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === "specs"
                          ? "border-[var(--accent-primary)] text-[var(--accent-primary)] dark:text-emerald-300 font-bold"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Scope &amp; Design Brief</span>
                      {references.length > 0 && (
                        <span className="rounded-full border border-[var(--accent-primary)]/20 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-[var(--accent-primary)] dark:bg-emerald-950/40 dark:text-emerald-300">
                          {references.length}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("deliverables")}
                      className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === "deliverables"
                          ? "border-[var(--accent-primary)] text-[var(--accent-primary)] dark:text-emerald-300 font-bold"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Creative Deliverables &amp; Review</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold font-mono tabular-nums">
                        {deliveredCount}/{requestedCount}
                      </span>
                      {isAwaitingReview && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                          Pending
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("signoff")}
                      className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-1.5 whitespace-nowrap ${
                        activeTab === "signoff"
                          ? "border-[var(--accent-primary)] text-[var(--accent-primary)] dark:text-emerald-300 font-bold"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Commercial Sign-Off</span>
                    </button>

                    {mode === "marketing" && isAcceptedByMarketing && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("next_work")}
                        className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-1.5 whitespace-nowrap ${
                          activeTab === "next_work"
                            ? "border-[var(--accent-primary)] text-[var(--accent-primary)] dark:text-emerald-300 font-bold"
                            : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        <span>4. Next Work</span>
                        <span className="rounded-full bg-[var(--accent-primary-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-primary)]">Optional</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tab Contents Area */}
              <div className="px-8 py-5 space-y-5">
                {/* ── TAB 1: SCOPE & DESIGN BRIEF ── */}
                {activeTab === "specs" && (
                  <DesignBriefTab
                    activeRequest={activeRequest}
                    references={references}
                    onPreviewImage={setLightboxImage}
                  />
                )}

                {/* ── TAB 2: DELIVERABLES & REVIEW ── */}
                {activeTab === "deliverables" && (
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
                    isAcceptedByMarketing={isAcceptedByMarketing}
                    onOpenNextWork={() => setActiveTab("next_work")}
                    submissions={submissions}
                    copiedArtworkPath={copiedArtworkPath}
                    onCopyArtworkPath={handleCopyArtworkPath}
                  />
                )}

                {/* ── TAB 3: COMMERCIAL SIGN-OFF ── */}
                {activeTab === "signoff" && (
                  <div className="space-y-4">
                    {isClosed ? (
                      <div className="p-6 rounded-lg border border-emerald-200 bg-emerald-50/70 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-2xs">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
                        <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                          Design request approved
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 max-w-md mx-auto">
                          Marketing accepted the submitted artwork. This design request is now closed.
                        </p>
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg border border-zinc-200 bg-zinc-50 text-center dark:border-zinc-800 dark:bg-zinc-900/40 shadow-2xs">
                        <Clock className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          Awaiting Marketing decision
                        </h4>
                        <p className="text-xs text-zinc-500 mt-1">
                          Marketing has not accepted the submitted artwork yet.
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
              </div>
            </div>
          </div>

          {/* ── RIGHT: AUDIT TRAIL & CHATTER ── */}
          <DesignChatterStream
            filteredChatter={filteredChatter}
            totalEventsCount={chatterEvents.length}
            noteInput={noteInput}
            onChangeNoteInput={setNoteInput}
            isPostingNote={isPostingNote}
            onPostNote={handlePostNote}
            chatterFilter={chatterFilter}
            onChangeChatterFilter={setChatterFilter}
            chatterEndRef={chatterEndRef}
          />
        </div>
      </div>

      {/* Counter Target Date Proposal Modal */}
      {isCounterDateModalOpen && (
        <DesignCounterDateModal
          isOpen={isCounterDateModalOpen}
          onClose={() => setIsCounterDateModalOpen(false)}
          originalDate={activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate || ""}
          isSlaEligible={slaStatus.isEligible}
          slaLabel={slaStatus.label}
          onSubmitCounterDate={handleProposeCounterDate}
        />
      )}

      {mockupHandoffDialog === "missing_stock" && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/60 p-4">
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
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="mockup-product-required-title" className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 shadow-2xl">
            <h3 id="mockup-product-required-title" className="text-sm font-bold text-[var(--on-surface)]">Choose the product for each Mockup</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--on-surface-muted)]">
              {selectedFollowupDesigns.mockup.length} separate Mockup request(s) will be created. Select a Material Code or Binding product in Product Staging, then set the required date. Each request will include its selected product and Creative reference before going to Studio.
            </p>
            {followupError && <p role="alert" className="mt-3 text-xs font-medium text-rose-700 dark:text-rose-300">{followupError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={isAddingFollowups} onClick={() => setMockupHandoffDialog(null)} className="h-9 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={isAddingFollowups} onClick={handleContinueToProductStaging} className="h-9 rounded-lg bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">
                {isAddingFollowups ? "Opening Product Staging…" : "Choose product"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Reference preview"
              className="max-h-[85vh] max-w-[85vw] object-contain"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default DesignRequestInspectorModal;
