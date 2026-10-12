import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Palette,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  User,
  Clock,
  Sparkles,
  Link2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ChevronRight,
  Send,
  Plus,
  Trash2,
  Maximize2,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Building,
  Tag,
  Hash,
  Users,
  Factory,
  Package,
} from "lucide-react";
import { SampleRequestItem } from "../types";
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
import { API_BASE_URL } from "@/infrastructure/api/client";
import { formatOdooLogDate } from "../utils/dateUtils";
import {
  mergeWithWorkflowState,
  checkCounterDateSla,
} from "../utils/designWorkflowStorage";
import {
  DesignClaimStrip,
  DesignCounterDateModal,
  MarketingCounterDateBanner,
} from "./inspector";

export interface DesignRequestInspectorModalProps {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  mode?: "marketing" | "creative";
  showToast?: (message: string) => void;
}

type TabType = "specs" | "deliverables" | "signoff" | "next_work";

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

interface DesignReferenceAsset {
  url: string;
  label: string;
  kind: "image" | "link";
}

function getReferenceUrl(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const asset = value as Record<string, unknown>;
  for (const key of ["url", "href", "src", "path"]) {
    if (typeof asset[key] === "string" && asset[key].trim()) return asset[key].trim();
  }
  return "";
}

function resolveReferenceImageUrl(url: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(url)) return url;
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  return `${baseUrl}/${url.replace(/^\/+/, "")}`;
}

function resolveReferenceLinkUrl(url: string): string {
  if (/^(?:https?:|mailto:)/i.test(url)) return url;
  return `https://${url.replace(/^\/\//, "")}`;
}

function isHttpLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const DesignReferenceImage: React.FC<{
  reference: DesignReferenceAsset;
  onPreview: (url: string) => void;
}> = ({ reference, onPreview }) => {
  const [hasLoadError, setHasLoadError] = useState(false);
  const imageUrl = resolveReferenceImageUrl(reference.url);

  useEffect(() => setHasLoadError(false), [imageUrl]);

  return (
    <div className="group relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-zinc-900">
      {hasLoadError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-600 dark:text-zinc-300">
          <ImageIcon className="h-6 w-6 text-slate-400" />
          <span>Preview unavailable</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[var(--accent-primary)] underline underline-offset-2 dark:text-emerald-300"
          >
            Open original image
          </a>
        </div>
      ) : (
        <img
          src={imageUrl}
          alt={reference.label}
          loading="lazy"
          onError={() => setHasLoadError(true)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      )}
      {!hasLoadError && (
        <button
          type="button"
          onClick={() => onPreview(imageUrl)}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/85 px-2.5 py-1.5 text-xs font-semibold text-white opacity-100 transition-opacity focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={`Preview ${reference.label}`}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Preview
        </button>
      )}
    </div>
  );
};

const DesignReferencePanel: React.FC<{
  references: DesignReferenceAsset[];
  onPreview: (url: string) => void;
}> = ({ references, onPreview }) => (
  <section className="space-y-4 border-t border-slate-100 pt-5 dark:border-white/10">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Marketing references &amp; moodboard</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Images and links attached to this design brief.
        </p>
      </div>
      <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
        {references.length} {references.length === 1 ? "attachment" : "attachments"}
      </span>
    </div>

    {references.length === 0 ? (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
        <ImageIcon className="h-5 w-5 shrink-0" />
        <span>No reference images or links were added to this brief.</span>
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {references.map((reference, index) => (
          <article
            key={`${reference.kind}-${index}`}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            {reference.kind === "image" ? (
              <DesignReferenceImage reference={reference} onPreview={onPreview} />
            ) : (
              <div className="flex min-h-36 flex-col items-start justify-center gap-2 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
                <Link2 className="h-5 w-5 text-[var(--accent-primary)] dark:text-emerald-300" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{reference.label}</span>
                <a
                  href={resolveReferenceLinkUrl(reference.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="max-w-full break-all text-xs text-[var(--accent-primary)] underline underline-offset-2 dark:text-emerald-300"
                  title={reference.url}
                >
                  {reference.url}
                </a>
                <a
                  href={resolveReferenceLinkUrl(reference.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)]"
                >
                  Open link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {reference.kind === "image" && (
              <div className="border-t border-slate-100 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                {reference.label}
              </div>
            )}
          </article>
        ))}
      </div>
    )}
  </section>
);

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
    setFollowupError(null);
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
  const [selectedFollowups, setSelectedFollowups] = useState<Array<"mockup" | "sample">>([]);
  const [isAddingFollowups, setIsAddingFollowups] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Chatter State
  const [noteInput, setNoteInput] = useState("");
  const [chatterFilter, setChatterFilter] = useState<"all" | "audit" | "notes">("all");
  const [internalNotes, setInternalNotes] = useState<ChatterMessage[]>([]);
  const chatterEndRef = useRef<HTMLDivElement | null>(null);

  // Creative deliverable matrix state lives in this inspector workspace.
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
    return activeRequest.srNumber || `DSG-${activeRequest.id}`;
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

  // Notes are part of the backend design workflow record.
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
            timestamp: typeof event.timestamp === "string" ? event.timestamp : activeRequest.updatedAt || activeRequest.createdAt,
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
      new Date(activeRequest.releasedAt).getTime() - new Date(activeRequest.designRequestCreatedAt || activeRequest.createdAt).getTime() > 60_000
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

    // Oldest first, matching the feasibility activity feed.
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

  // Add Internal Chatter Note
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

  // ── TASK CLAIMING HANDLERS ──
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

  // ── COUNTER DATE PROPOSAL & DECISION HANDLERS ──
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

  // Marketing Decision Handler
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

  // ── EARLY RETURN AFTER ALL HOOKS ──
  if (!isOpen || !activeRequest) return null;

  const isAwaitingReview =
    activeRequest.marketingDesignDecision === "awaiting_marketing_review" ||
    activeStage === 2;
  const isClosed = activeStage === 3;
  const isAcceptedByMarketing = mode === "marketing" && activeRequest.marketingDesignDecision === "accepted";
  const includedFollowups = activeRequest.requestTypes || [];
  const isCounterDatePending = Boolean(
    activeRequest.isCounterDateActive || activeRequest.counterDateDecision === "pending"
  );
  const requestStageLabel = String(activeRequest.designRequestStatus || activeRequest.status || "").toLowerCase();
  const isCreativeWorkStage = activeStage === 1 || requestStageLabel.includes("target date counter proposed");
  const canSubmitCreativeOutput = mode === "creative" && isCreativeWorkStage && !isAwaitingReview && !isClosed && remainingCount > 0;
  const canCloseInspector = !isSubmittingOutput && !isDeciding && !isPostingNote && !isAddingFollowups;

  const handleAddFollowups = async () => {
    if (!effectiveDesignId || selectedFollowups.length === 0 || isAddingFollowups) return;
    setIsAddingFollowups(true);
    setFollowupError(null);
    try {
      const saved = await requestPostDesignDeliverablesApi(effectiveDesignId, selectedFollowups);
      const addedTypes = selectedFollowups.filter((scope) => !(includedFollowups as string[]).includes(scope));
      setLocalOverride({ ...activeRequest, ...saved, id: activeRequest.id, requestKind: activeRequest.requestKind || "sample" });
      setSelectedFollowups([]);
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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs animate-smooth-backdrop sm:p-4"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && canCloseInspector) onClose();
      }}
    >
      <>
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
            <button type="button" onClick={() => canCloseInspector && onClose()} disabled={!canCloseInspector} className="inline-flex items-center rounded-xl bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-wait disabled:opacity-60">
              Save &amp; Close
            </button>
            <button type="button" onClick={() => canCloseInspector && onClose()} disabled={!canCloseInspector} className="rounded-xl bg-[var(--surface-low)] px-3.5 py-1.5 text-xs font-medium text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] disabled:cursor-wait disabled:opacity-60">
              Discard
            </button>
            <span className="mx-1 hidden h-4 w-px bg-[var(--border-subtle)] sm:block" />
            <button type="button" onClick={handleCopyCode} className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]" title="Copy request code">
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
                { label: "4. Next Work", state: activeStage >= 3 ? ((includedFollowups as string[]).some((value) => value === "mockup" || value === "sample") ? "done" as const : "active" as const) : "pending" as const },
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
            <button type="button" onClick={() => canCloseInspector && onClose()} disabled={!canCloseInspector} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] disabled:cursor-wait disabled:opacity-60" aria-label="Close">
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
                      Design Request
                    </span>
                  </div>

                </div>

                {/* Document Hero & Primary Details */}
                <div className="px-4 py-4 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 font-display">
                        {activeRequest.customer || ""}
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                          {activeRequest.createdBy ? <>Initiated by <span className="font-semibold text-slate-800 dark:text-zinc-200">{activeRequest.createdBy}</span></> : ""}
                          {activeRequest.createdBy && (activeRequest.dateRequestCreated || activeRequest.createdAt) ? " · " : ""}
                          {formatDate(activeRequest.dateRequestCreated || activeRequest.createdAt)}
                      </p>
                    </div>

                    {/* Context Badges */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-[var(--accent-primary)] dark:bg-emerald-950/50 dark:text-emerald-300 border border-[var(--accent-primary)]/20">
                        Design Request
                      </span>
                      <StatusPill
                        status={activeRequest.designRequestStatus || activeRequest.status || "Creative"}
                        size="md"
                      />
                    </div>
                  </div>

                  {/* 4-Point Metadata Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-3.5 border-t border-slate-100 dark:border-white/5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Current Deadline
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900 dark:text-zinc-100">
                        <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>
                          {formatDate(activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)}
                        </span>
                      </div>
                      {mode === "creative" && isCounterDatePending && (
                        <p className="mt-1 text-[10px] leading-relaxed text-amber-800 dark:text-amber-300">
                          Marketing's date remains the active deadline until the counter is accepted.
                        </p>
                      )}

                      {/* Counter-Date Proposal Trigger for Creative */}
                      {mode === "creative" && (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {isCounterDatePending ? (
                            <span
                              role="status"
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                            >
                              <Clock className="h-3 w-3" /> Awaiting Marketing
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={!activeRequest.claimedBy || !slaStatus.isEligible}
                                onClick={() => {
                                  setWorkflowError(null);
                                  setIsCounterDateModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] dark:text-emerald-300 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                                title={
                                  !activeRequest.claimedBy
                                    ? slaStatus.isEligible
                                      ? "Claim task first to propose a counter date"
                                      : "The 48-hour claim and counter-date window has expired"
                                    : !slaStatus.isEligible
                                    ? slaStatus.label === "Counter proposal already used"
                                      ? "Only one counter-date proposal is allowed for this request"
                                      : "The 48-hour counter-date window from Marketing's release has expired"
                                    : "Propose a revised completion date within 48 hours of Marketing's release"
                                }
                              >
                                <Clock className="w-3 h-3" />
                                <span>Propose Date</span>
                              </button>
                              <span
                                className={`text-[10px] font-mono ${
                                  slaStatus.isEligible
                                    ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                    : "text-zinc-500 dark:text-zinc-400"
                                }`}
                                title={slaStatus.isEligible ? "Counter-date proposal window" : "Counter-date proposal window closed"}
                              >
                                {slaStatus.isEligible
                                  ? activeRequest.claimedBy ? slaStatus.label : "Claim task to propose"
                                  : slaStatus.label}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Artworks Required
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                        <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        <span>{requestedCount} Artworks</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Theme / Trend
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-800 dark:text-zinc-200 font-semibold truncate">
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{activeRequest.trend || ""}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Target Audience
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-800 dark:text-zinc-200 font-semibold truncate">
                        <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{activeRequest.targetAudience || ""}</span>
                      </div>
                    </div>
                  </div>
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
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold">
                        {deliveredCount}/{requestedCount}
                      </span>
                      {isAwaitingReview && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white  font-bold">
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
                  <div className="space-y-6">
                    {/* Technical Description & Scope Box (Matches Image 1) */}
                    <div>
                      <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        Technical Description &amp; Product Scope
                      </h3>
                      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-white/[0.02] text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[70px]">
                        {activeRequest.productDescription || ""}
                      </div>
                    </div>

                    {/* Art Direction & Aesthetic Theme */}
                    <div>
                      <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        Art Direction &amp; Aesthetic Theme
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <div className="text-xs text-[var(--accent-primary)] dark:text-emerald-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Theme / Trend</span>
                          </div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {activeRequest.trend || ""}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20 space-y-1.5">
                          <div className="text-xs text-teal-800 dark:text-teal-300 font-bold flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>Target Audience</span>
                          </div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {activeRequest.targetAudience || ""}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Direction & Finishing Specifications */}
                    <div>
                      <h3 className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        Additional Direction &amp; Finishing Specifications
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2">
                          <div className="text-xs text-zinc-500 font-medium">Program Specification</div>
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {activeRequest.programName || ""}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono">
                            Year: {activeRequest.programYear || ""}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-2">
                          <div className="text-xs text-zinc-500 font-medium">Finishing Notes / Remarks</div>
                          <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                            {activeRequest.designRemarks || ""}
                          </div>
                        </div>
                      </div>
                    </div>
                    <DesignReferencePanel references={references} onPreview={setLightboxImage} />
                  </div>
                )}

                {activeTab === "deliverables" && (
                  <div className="space-y-6">
                    {/* Deliverable Progress Card */}
                    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-mono font-bold uppercase text-zinc-500">
                            Deliverable Fulfillment
                          </div>
                          <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                            {deliveredCount} of {requestedCount} Artworks Completed
                          </div>
                        </div>

                        {canSubmitCreativeOutput && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSubmitError(null);
                                setShowSubmitForm((visible) => !visible);
                              }}
                              disabled={!activeRequest.claimedBy || isSubmittingOutput}
                              aria-expanded={showSubmitForm}
                              aria-controls="creative-output-matrix"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              title={!activeRequest.claimedBy ? "Claim the task before submitting artwork" : "Open the artwork submission matrix in this inspector"}
                            >
                              {showSubmitForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              <span>{showSubmitForm ? "Close Matrix" : "Submit Artwork Matrix"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                        role="progressbar"
                        aria-label="Artwork deliverables completed"
                        aria-valuemin={0}
                        aria-valuemax={requestedCount}
                        aria-valuenow={deliveredCount}
                      >
                        <div
                          className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round((deliveredCount / Math.max(1, requestedCount)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Inline creative submission matrix */}
                    {canSubmitCreativeOutput && showSubmitForm && (
                      <form
                        id="creative-output-matrix"
                        aria-labelledby="creative-output-matrix-title"
                        aria-busy={isSubmittingOutput}
                        onSubmit={handleSubmitOutput}
                        className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-zinc-900/40 dark:ring-zinc-800"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-zinc-100">
                              <FolderOpen className="h-4 w-4 text-[var(--accent-primary)] dark:text-emerald-300" />
                              <h3 id="creative-output-matrix-title">Artwork submission matrix</h3>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)] dark:bg-emerald-950/50 dark:text-emerald-300">
                                Batch #{submissions.length + 1}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                              Shutterstock No. and remark are optional individually; enter at least one for each artwork.
                            </p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/5 dark:text-zinc-300">
                            {remainingCount} remaining
                          </span>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                          <div>
                            <label htmlFor="creative-output-file-link" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Artwork folder or design file link/path <span className="text-rose-500">*</span>
                            </label>
                            <input
                              id="creative-output-file-link"
                              type="text"
                              required
                              disabled={isSubmittingOutput}
                              maxLength={2048}
                              value={designFileUrl}
                              onChange={(e) => setDesignFileUrl(e.target.value)}
                              placeholder="Paste a share link or file/folder path"
                              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                            <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Paste any reference text that helps the team locate the artwork files. URLs and paths also work.</p>
                          </div>
                          <div>
                            <label htmlFor="creative-output-count" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Artworks in this batch
                            </label>
                            <input
                              id="creative-output-count"
                              type="number"
                              min={1}
                              max={remainingCount}
                              disabled={isSubmittingOutput}
                              value={outputCount}
                              onChange={(e) => handleOutputCountChange(Number(e.target.value))}
                              className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-mono text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                            />
                          </div>
                        </div>

                        {/* Dynamic Rows */}
                        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-zinc-800">
                          <div className="min-w-[520px]">
                            <div className="grid grid-cols-[52px_minmax(180px,1.2fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                              <span>Code</span>
                              <span>Marketing Description</span>
                              <span>Shutterstock No. (optional)</span>
                              <span>Creative Remark (optional)</span>
                            </div>
                            {outputRows.map((row, index) => (
                              <div
                                key={index}
                                className="grid grid-cols-[52px_minmax(180px,1.2fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)] items-center gap-2 border-t border-slate-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70"
                              >
                                <span className="font-mono text-xs font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                                  D{deliveredCount + index + 1}
                                </span>
                                <span className="min-w-0 text-xs font-medium text-slate-700 dark:text-zinc-200">
                                  {activeRequest.productDescription.trim()} - D{deliveredCount + index + 1}
                                </span>
                                <input
                                  type="text"
                                  disabled={isSubmittingOutput}
                                  maxLength={100}
                                  aria-label={`Artwork D${deliveredCount + index + 1} Shutterstock number`}
                                  placeholder="Enter Shutterstock No."
                                  value={row.shutterstockNo}
                                  onChange={(e) =>
                                    setOutputRows((curr) =>
                                      curr.map((r, i) => (i === index ? { ...r, shutterstockNo: e.target.value } : r))
                                    )
                                  }
                                  className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                />
                                <input
                                  type="text"
                                  disabled={isSubmittingOutput}
                                  maxLength={1000}
                                  aria-label={`Artwork D${deliveredCount + index + 1} creative remark`}
                                  placeholder="Optional remark"
                                  value={row.remarks}
                                  onChange={(e) =>
                                    setOutputRows((curr) =>
                                      curr.map((r, i) => (i === index ? { ...r, remarks: e.target.value } : r))
                                    )
                                  }
                                  className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {submitError && (
                          <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{submitError}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isSubmittingOutput}
                            onClick={() => { setShowSubmitForm(false); setSubmitError(null); }}
                            className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/5"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmittingOutput || !designFileUrl.trim() || outputRows.some((row) => !row.shutterstockNo.trim() && !row.remarks.trim())}
                            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSubmittingOutput ? "Submitting…" : "Submit batch to Marketing"}</span>
                          </button>
                        </div>
                      </form>
                    )}

                    {mode === "creative" && (isAwaitingReview || isRemainingRequested) && (
                      <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/25 dark:text-amber-200 dark:ring-amber-900/50">
                        {isRemainingRequested ? (
                          <>
                            <strong className="font-semibold">Marketing requested the remaining artwork.</strong>{" "}
                            Submit the next batch whenever it is ready; this request stays with Creative until Marketing accepts it. {remainingCount} remaining.
                          </>
                        ) : (
                          <>
                            <strong className="font-semibold">Waiting for Marketing review.</strong>{" "}
                            The submitted batch is saved in this request. Marketing can accept it or request the remaining artwork.
                          </>
                        )}
                      </div>
                    )}

                    {/* Marketing Review Verdict Spotlight */}
                    {mode === "marketing" && (isAwaitingReview || isRemainingRequested) && (
                      <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.03] dark:border-[var(--accent-primary)]/40 dark:bg-[var(--accent-primary)]/10 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Marketing Review &amp; Commercial Sign-Off</span>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Creative Studio has submitted <strong>{deliveredCount} of {requestedCount}</strong> requested artworks.
                          {isRemainingRequested && remainingCount > 0
                            ? <> Creative is continuing the remaining work ({remainingCount} left); you can accept the delivered set whenever it is ready.</>
                            : " Review the deliverables and select your verdict."}
                        </p>

                        {decisionError && (
                          <div className="flex items-center gap-2 rounded bg-rose-50 p-2 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{decisionError}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isDeciding}
                            onClick={() => handleMarketingDecision("accept")}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isDeciding ? "Processing..." : isRemainingRequested ? "Accept Delivered Designs & Close" : "Accept & Continue"}</span>
                          </button>

                          {!isRemainingRequested && remainingCount > 0 && (
                            <button
                              type="button"
                              disabled={isDeciding}
                              onClick={() => handleMarketingDecision("request_remaining")}
                              className="inline-flex items-center gap-1.5 rounded border border-[var(--accent-primary)]/40 bg-white px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Request Remaining Artworks ({remainingCount})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {mode === "marketing" && isAcceptedByMarketing && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3">
                        <p className="text-xs text-[var(--on-surface-muted)]">Artwork accepted. Mockup or Sampling can be added from the Next Work stage.</p>
                        <button type="button" onClick={() => setActiveTab("next_work")} className="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)]">
                          Open Next Work
                        </button>
                      </div>
                    )}

                    {/* Submissions History List */}
                    {submissions.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
                        <Layers className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                        <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          No artwork outputs submitted yet.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {submissions.map((batch, bIdx) => (
                          <div
                            key={bIdx}
                            className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                  Batch #{bIdx + 1}
                                </span>
                                <span className="text-zinc-400">•</span>
                                <span className="text-zinc-500 font-mono">
                                  {formatDate(batch.submittedAt)}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300">
                                  {batch.rows.length} Artworks
                                </span>
                              </div>

                              {batch.designFileUrl && (isHttpLink(batch.designFileUrl) ? (
                                <a
                                  href={batch.designFileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-semibold transition"
                                >
                                  <span>Open Artwork Files</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleCopyArtworkPath(batch.designFileUrl)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-semibold transition"
                                  title={batch.designFileUrl}
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>{copiedArtworkPath === batch.designFileUrl ? "Path Copied" : "Copy Artwork Path"}</span>
                                </button>
                              ))}
                            </div>

                            <table className="w-full text-left text-xs">
                              <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-[10.5px] uppercase font-mono text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                  <th className="px-3.5 py-2 w-16">Code</th>
                                  <th className="px-3.5 py-2">Marketing Description</th>
                                  <th className="px-3.5 py-2">Shutterstock No.</th>
                                  <th className="px-3.5 py-2">Creative Remark</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {batch.rows.map((row: any) => (
                                  <tr key={row.designNumber}>
                                    <td className="px-3.5 py-2.5 font-mono font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                                      {row.designNumber}
                                    </td>
                                    <td className="px-3.5 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                                      {row.description}
                                    </td>
                                    <td className="px-3.5 py-2.5 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                                      {row.shutterstockNo || "—"}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-zinc-600 dark:text-zinc-400">
                                      {row.remarks || ""}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB 4: COMMERCIAL SIGN-OFF ── */}
                {activeTab === "signoff" && (
                  <div className="space-y-4">
                    {isClosed ? (
                      <div className="p-6 rounded-lg border border-emerald-200 bg-emerald-50/70 text-center dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
                        <h4 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                          Design request approved
                        </h4>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 max-w-md mx-auto">
                          Marketing accepted the submitted artwork. This design request is now closed.
                        </p>
                      </div>
                    ) : (
                      <div className="p-6 rounded-lg border border-zinc-200 bg-zinc-50 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
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

                {activeTab === "next_work" && mode === "marketing" && isAcceptedByMarketing && (
                  <section className="space-y-4" aria-labelledby="design-followup-title">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <h3 id="design-followup-title" className="text-sm font-semibold text-[var(--on-surface)]">
                          Next Work
                        </h3>
                        <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
                          Artwork is accepted. Add Mockup, Sampling, or both to this same request.
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-medium text-[var(--on-surface-muted)]">
                        {refCode}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { value: "mockup" as const, title: "Mockup", detail: "Route the accepted artwork into the Creative mockup workflow.", icon: Package },
                        { value: "sample" as const, title: "Sampling", detail: "Add the request to the existing SAMP review workflow.", icon: Factory },
                      ]).map((option) => {
                        const Icon = option.icon;
                        const included = (includedFollowups as string[]).includes(option.value);
                        const selected = selectedFollowups.includes(option.value);
                        return (
                          <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-4 transition ${included ? "opacity-75" : "hover:border-[var(--accent-primary)]/50"}`}>
                            <input
                              type="checkbox"
                              checked={included || selected}
                              disabled={included || isAddingFollowups}
                              onChange={(event) => {
                                setFollowupError(null);
                                setSelectedFollowups((current) => event.target.checked
                                  ? [...current, option.value]
                                  : current.filter((value) => value !== option.value));
                              }}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
                              aria-label={`Add ${option.title} to this request`}
                            />
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--on-surface)]">
                                {option.title}
                                {included && <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">Already added</span>}
                              </span>
                              <span className="mt-1 block text-[11px] leading-4 text-[var(--on-surface-muted)]">{option.detail}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {followupError && (
                      <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{followupError}</span>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!effectiveDesignId || selectedFollowups.length === 0 || isAddingFollowups}
                        onClick={() => void handleAddFollowups()}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {isAddingFollowups ? "Adding…" : "Add to this request"}
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: AUDIT TRAIL & CHATTER (IMAGE 1 EXACT DESIGN) ── */}
          <div className="relative z-10 flex h-[34dvh] max-h-[300px] w-full shrink-0 flex-col overflow-hidden border-t border-slate-100 bg-[var(--surface-lowest)] select-text border-[var(--border-subtle)] lg:h-full lg:max-h-none lg:w-[390px] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_36px_rgba(11,28,48,0.03)]">
            {/* Chatter Header with Indicator & Filter Tabs */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 "></span>
                <div>
                  <span className="block font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                    Activity
                  </span>
                  <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                    Marketing and Creative updates
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {chatterEvents.length}
                </span>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800 p-0.5 rounded text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setChatterFilter("all")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "all"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setChatterFilter("audit")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "audit"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                >
                  Audit
                </button>
                <button
                  type="button"
                  onClick={() => setChatterFilter("notes")}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    chatterFilter === "notes"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                  }`}
                >
                  Notes
                </button>
              </div>
            </div>

            {/* Note Composer */}
            <form
              onSubmit={handlePostNote}
              className="p-3 border-b border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/20"
            >
              <div className="relative">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Add a short note..."
                  maxLength={2000}
                  disabled={isPostingNote}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  disabled={!noteInput.trim() || isPostingNote}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition hover:text-[var(--accent-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Post note"
                  aria-label={isPostingNote ? "Saving note" : "Post note"}
                >
                  {isPostingNote ? <Clock className="h-3.5 w-3.5 " /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="mt-1 px-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                Visible to Marketing and Creative Studio · {noteInput.length}/2000
              </div>
            </form>

            {/* Chronological Stream */}
            <div className="flex-1 overflow-y-auto bg-[var(--surface-lowest)] p-3.5 space-y-3">
              {filteredChatter.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 font-mono text-[11px]">
                  No chatter entries found.
                </div>
              ) : (
                filteredChatter.map((evt) => {
                  const actorDeptStr = typeof evt.actorDepartment === "string" ? evt.actorDepartment : String(evt.actorDepartment || "");
                  const actionStr = typeof evt.action === "string" ? evt.action : String(evt.action || "");
                  const isSystemEvent = ["REQUEST_RELEASED", "TASK_CLAIMED", "TASK_UNCLAIMED"].includes(actionStr);
                  const isMarketing = actorDeptStr.toLowerCase().includes("marketing") || actionStr.includes("INTAKE");
                  const isCreative = actorDeptStr.toLowerCase().includes("creative");
                  const safeActorName = typeof evt.actorName === "string" ? evt.actorName : String(evt.actorName || "");
                  const initials = safeActorName
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  if (isSystemEvent) {
                    const releaseEvent = actionStr === "REQUEST_RELEASED";
                    return (
                      <div key={evt.id} className="flex justify-center py-1.5 select-none">
                        <div className={`inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full border px-3 py-1 text-center text-[11px] font-medium ${releaseEvent
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/50 dark:text-sky-200"
                        }`}>
                          <span className="font-semibold">{evt.title}</span>
                          <span>{safeActorName}</span>
                          <span className="text-[10px] opacity-75">· {formatOdooLogDate(evt.timestamp)}</span>
                        </div>
                      </div>
                    );
                  }

                  const bubbleTone = evt.isNote
                    ? "border-amber-200/80 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25"
                    : isMarketing
                    ? "border-emerald-200/70 bg-white dark:border-emerald-900/40 dark:bg-zinc-900"
                    : "border-sky-200/70 bg-sky-50 dark:border-sky-900/40 dark:bg-zinc-900";
                  const avatarTone = isMarketing
                    ? "bg-[var(--accent-primary)] text-white"
                    : isCreative
                    ? "bg-purple-600 text-white"
                    : "bg-amber-500 text-white";

                  return (
                    <div key={evt.id} className={`flex max-w-[94%] flex-col text-xs select-text ${isMarketing ? "items-start" : "ml-auto items-end"}`}>
                      <article className={`w-full rounded-2xl ${isMarketing ? "rounded-tl-sm" : "rounded-tr-sm"} border p-3 shadow-[0_2px_8px_rgba(11,28,48,0.04)] ${bubbleTone}`}>
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-1.5 dark:border-white/10">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold ${avatarTone}`}>
                              {initials}
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-zinc-900 dark:text-zinc-100">{safeActorName}</span>
                              <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">{actorDeptStr || "Team"}</span>
                            </div>
                          </div>
                          <time className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                            {formatOdooLogDate(evt.timestamp)}
                          </time>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{evt.title}</span>
                          {evt.badge && (
                            <span className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
                              {evt.badge.text}
                            </span>
                          )}
                        </div>
                        {evt.body && (
                          <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">{evt.body}</p>
                        )}
                      </article>
                    </div>
                  );
                })
              )}
              <div ref={chatterEndRef} />
            </div>
          </div>
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

      {/* Lightbox Image Preview Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl bg-black">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black transition"
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
      </>
    </div>,
    document.body
  );
};

export default DesignRequestInspectorModal;
