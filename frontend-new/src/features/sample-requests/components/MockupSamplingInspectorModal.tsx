import { UniversalChatterFeed, UniversalChatterEvent } from "./common/UniversalChatterFeed";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Package,
  Palette,
  Printer,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  UserCheck,
  X,
  ZoomIn,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import type { UserProfile } from "@/features/auth";
import { reviewRequestWorkflowApi, type RequestWorkflowRecord } from "@/infrastructure/api";
import { claimMockupRequestApi, fetchSampleRequestByIdApi } from "@/infrastructure/api/sampleRequestsApi";
import {
  fetchProductClassSpecificationsApi,
  type ProductDetailItem,
} from "@/infrastructure/api/masterApi";
import { formatWorkflowAction } from "./workflowPresentation";
import { StatusPill } from "@/components/ui/StatusPill";
import { ScopeReferenceImagesGallery } from "@/features/sample-requests/components/staging/ScopeReferenceImagesGallery";
import { ProductDocketView } from "@/features/sample-requests/components/staging/ProductDocketView";
import { RequestClosedStamp } from "./common/RequestClosedWatermark";
import type { ProductSearchResult, SampleRequestItem } from "../types";

interface MockupSamplingInspectorModalProps {
  record: RequestWorkflowRecord;
  user?: UserProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

type MockupTab = "scope" | "specs" | "output" | "review" | "history";

const stageSequence = [
  { key: "marketing", label: "1. Intake" },
  { key: "creative", label: "2. Creative" },
  { key: "studio", label: "3. Studio CAD" },
  { key: "creative_approval", label: "4. Creative QA" },
  { key: "sampling_review", label: "5. Sampling Review" },
  { key: "awaiting_marketing_acceptance", label: "6. Marketing Final" },
  { key: "done", label: "7. Closed" },
];

const stageLabels: Record<string, string> = {
  marketing: "Marketing intake",
  creative: "Creative review",
  studio: "Studio CAD mockup",
  creative_approval: "Creative QA review",
  sampling_review: "Sampling review (PMT)",
  awaiting_marketing_acceptance: "Marketing final acceptance",
  done: "Closed / Approved",
};

function formatDate(value: unknown) {
  if (!value) return "—";
  const str = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(str) ? `${str}T00:00:00` : str);
  return Number.isNaN(date.getTime())
    ? str
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function readOnlyTeamHead(user?: UserProfile | null) {
  return (
    Boolean(user?.is_team_head) &&
    !["admin", "administrator"].includes(String(user?.role || "").toLowerCase())
  );
}

const QUICK_REVIEW_CHIPS = [
  "CAD dieline dimensions verified",
  "Board GSM & caliper feasible",
  "Fold crease lines aligned",
  "Die cut & stripping feasible",
  "Prepress artwork resolution OK",
  "Tooling / cylinder feasible",
];

export const MockupSamplingInspectorModal: React.FC<MockupSamplingInspectorModalProps> = ({
  record,
  user,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<MockupTab>("scope");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Specifications state
  const [productSpecifications, setProductSpecifications] = useState<ProductDetailItem[]>([]);
  const [isLoadingSpecifications, setIsLoadingSpecifications] = useState(false);
  const [specSearchQuery, setSpecSearchQuery] = useState("");
  const [specViewMode, setSpecViewMode] = useState<"all" | "configured" | "docket">("all");
  const [scopeReferenceImages, setScopeReferenceImages] = useState<NonNullable<SampleRequestItem["scopeReferenceImages"]>>({});

  const dialogRef = useRef<HTMLElement>(null);
  const data = (record.workflow_data || {}) as Record<string, any>;
  const requestData = (record.request_data || {}) as Record<string, any>;

  const selectedMockupDesigns = Array.isArray(data.designFollowups?.mockup?.designs)
    ? (data.designFollowups.mockup.designs as Array<Record<string, string>>)
    : [];

  const claim = data.claimedByUserId == null ? null : String(data.claimedByUserId);
  const isClaimedByMe = Boolean(claim && user?.id != null && claim === String(user.id));
  const isClaimed = Boolean(data.claimedBy || claim);
  const isReadOnly = readOnlyTeamHead(user);
  const [localClosed, setLocalClosed] = useState(false);
  const [closureData, setClosureData] = useState<any>(record.closure || null);

  useEffect(() => {
    const handleClosed = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      if (
        detail &&
        (String(detail.requestId) === String(record.sample_request_id) ||
         String(detail.requestId) === String(record.workflow_id))
      ) {
        setLocalClosed(true);
        if (detail.closure) setClosureData(detail.closure);
      }
    };
    window.addEventListener("app:request-closed", handleClosed);
    return () => window.removeEventListener("app:request-closed", handleClosed);
  }, [record.sample_request_id, record.workflow_id]);

  const isClosed = Boolean(
    localClosed ||
    record.is_closed ||
    record.closure != null ||
    closureData != null ||
    record.current_stage === "done" ||
    record.status === "Approved / Closed" ||
    record.status === "Closed" ||
    record.closed_at != null
  );
  const canReview = record.current_stage === "sampling_review" && !isReadOnly && isClaimedByMe && !isClosed;
  const isSamplingReview = record.current_stage === "sampling_review";

  const outputPath = typeof data.mockupUrl === "string" ? data.mockupUrl.trim() : "";
  const outputHref = /^https?:\/\//i.test(outputPath) ? outputPath : undefined;
  const isImageOutput = Boolean(
    outputPath && /\.(?:png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i.test(outputPath)
  );

  const canApprove = canReview && Boolean(outputPath);

  // Fetch product specifications on mount
  useEffect(() => {
    let active = true;
    setIsLoadingSpecifications(true);
    setScopeReferenceImages({});
    fetchProductClassSpecificationsApi(record.sample_request_id)
      .then((specs) => {
        if (active) setProductSpecifications(specs);
      })
      .catch(() => {
        if (active) setProductSpecifications([]);
      })
      .finally(() => {
        if (active) setIsLoadingSpecifications(false);
      });
    fetchSampleRequestByIdApi(record.sample_request_id)
      .then((request) => {
        if (active) setScopeReferenceImages(request.scopeReferenceImages || {});
      })
      .catch((reason) => console.warn("Could not load Mockup reference images:", reason));
    return () => {
      active = false;
    };
  }, [record.sample_request_id]);

  // Lock body scroll and handle escape
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !claiming) {
        if (lightboxUrl) {
          setLightboxUrl(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [saving, claiming, lightboxUrl, onClose]);

  const handleCopyCode = () => {
    if (!record.sr_number) return;
    navigator.clipboard.writeText(record.sr_number);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleChip = (chip: string) => {
    if (selectedChips.includes(chip)) {
      setSelectedChips((prev) => prev.filter((c) => c !== chip));
    } else {
      setSelectedChips((prev) => [...prev, chip]);
      setNote((prev) => (prev ? `${prev.trim()}\n✓ ${chip}` : `✓ ${chip}`));
    }
  };

  const submitDecision = async (decision: "approve" | "return") => {
    if (decision === "return" && !note.trim()) {
      setError("Please add a clear technical note for Studio before returning the mockup.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reviewRequestWorkflowApi("mockup", record.sample_request_id, {
        decision,
        remark: note.trim(),
      });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save Sampling decision.");
    } finally {
      setSaving(false);
    }
  };

  const claimTask = async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimMockupRequestApi(record.sample_request_id);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not claim this Sampling review.");
    } finally {
      setClaiming(false);
    }
  };

  const isMissingSpecificationValue = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    const str = String(value).trim().toUpperCase();
    return str === "" || str === "NA" || str === "N/A" || str === "NULL" || str === "NONE" || str === "—" || str === "-";
  };

  const configuredSpecs = useMemo(() => {
    return productSpecifications.filter((item) => !isMissingSpecificationValue(item.value));
  }, [productSpecifications]);

  const docketClassGroups = useMemo<[string, ProductDetailItem[]][]>(() => {
    const map = new Map<string, ProductDetailItem[]>();
    productSpecifications.forEach((item) => {
      const current = map.get(item.className) || [];
      current.push(item);
      map.set(item.className, current);
    });
    return Array.from(map.entries());
  }, [productSpecifications]);

  const docketProduct = useMemo<ProductSearchResult & { brand?: string }>(() => {
    const reqData = (record.request_data || {}) as Record<string, any>;
    return {
      id: Number(record.sample_request_id),
      sr_number: record.sr_number,
      material_code: record.material_code || "",
      product_description: record.product_description || "",
      customer: record.customer || "",
      target_plant: (reqData.target_plant as string) || (reqData.plant as string) || "",
      source_sample_code: [reqData.barcode, reqData.customer_product_code].filter(Boolean).join(" / ") || "NA",
      brand: record.brand_name || "",
    } as ProductSearchResult & { brand?: string };
  }, [record]);

  // Group specs by class
  const filteredSpecs = useMemo(() => {
    const list = specViewMode === "configured" ? configuredSpecs : productSpecifications;
    const q = specSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.className.toLowerCase().includes(q) ||
        s.characteristicName.toLowerCase().includes(q) ||
        String(s.value || "").toLowerCase().includes(q)
    );
  }, [productSpecifications, configuredSpecs, specViewMode, specSearchQuery]);

  const specificationGroups = useMemo(() => {
    const groups = new Map<string, ProductDetailItem[]>();
    filteredSpecs.forEach((item) => {
      const current = groups.get(item.className) || [];
      current.push(item);
      groups.set(item.className, current);
    });
    return Array.from(groups.entries()).map(([className, items]) => ({
      className,
      items,
    }));
  }, [filteredSpecs]);

  const mockupChatterEvents = useMemo<UniversalChatterEvent[]>(() => {
    return (record.logs || []).map((log) => {
      const hasRemark = Boolean(log.details?.remark) || Boolean(log.details?.note);
      const remarkText = String(log.details?.remark || log.details?.note || "").trim();
      const isSystem = !hasRemark;

      return {
        id: log.id,
        kind: isSystem ? "system_announcement" : "bubble",
        actorName: log.actor_name || "Team Member",
        actorDepartment: log.actor_team || "Mockup",
        summary: hasRemark ? remarkText : `${log.actor_name || "User"} - ${formatWorkflowAction(log.action)}`,
        timestamp: log.created_at,
        badge: log.from_stage && log.to_stage && log.from_stage !== log.to_stage ? {
          text: `${stageLabels[log.from_stage] || log.from_stage} → ${stageLabels[log.to_stage] || log.to_stage}`,
          variant: "info",
        } : undefined,
      };
    });
  }, [record.logs]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--on-surface)]/40 backdrop-blur-xs animate-smooth-backdrop sm:p-4 select-text"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !claiming) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mockup-inspector-title"
        className="relative flex h-[92vh] max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs shadow-2xl xl:max-w-7xl animate-smooth-modal font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {isClosed && <RequestClosedStamp label="REQUEST WAS CLOSED" />}
        {/* ── 1. ERP TOP CONTROL PANEL ── */}
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--on-surface-muted)]">
              <span>Request Workflows</span>
              <span className="text-[var(--on-surface-subtle)]">/</span>
              <span>Commercial Mockups</span>
              <span className="text-[var(--on-surface-subtle)]">/</span>
              <span className="font-bold text-[var(--on-surface)]">{record.sr_number}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy SR Number"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] cursor-pointer"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>


            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>



        {/* ── 2. STAGE PROGRESSION RAIL ── */}
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50 px-4 py-2.5 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs min-w-max">
            {stageSequence.map((stage, idx) => {
              const currentStageIndex = stageSequence.findIndex((s) => s.key === record.current_stage);
              const isPast = idx < currentStageIndex;
              const isCurrent = stage.key === record.current_stage;
              return (
                <React.Fragment key={stage.key}>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                      isCurrent
                        ? "bg-[var(--accent-primary)] text-white shadow-xs"
                        : isPast
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "text-[var(--on-surface-subtle)] bg-transparent"
                    }`}
                  >
                    {isPast ? (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    ) : null}
                    <span>{stage.label}</span>
                  </div>
                  {idx < stageSequence.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-[var(--border-strong)] shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── 3. MAIN WORKSPACE VIEWPORT ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--bg-app)] p-4 md:p-6 space-y-4">
          <div className={`mx-auto w-full rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden transition-all duration-200 ${"max-w-6xl"}`}>
            {/* Dossier Header & Ribbon */}
            <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-base)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-2.5 sm:px-8">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">
                    {record.sr_number}
                  </span>
                  <span className="text-[var(--border-strong)]">/</span>
                  <span className="text-[11px] font-semibold text-[var(--on-surface-muted)]">
                    Commercial 3D CAD Mockup Dossier
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-500/20">
                    <Boxes className="w-3 h-3 text-indigo-600" />
                    <span>Studio CAD &amp; Dieline</span>
                  </span>
                  <StatusPill status={record.status} size="md" />
                </div>
              </div>

              {/* Title & Headline */}
              <div className="px-4 py-4 sm:px-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1
                      id="mockup-inspector-title"
                      className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--on-surface)] font-display"
                    >
                      {record.customer || "Commercial Account"}
                    </h1>
                    <p className="text-xs text-[var(--on-surface-muted)] mt-1">
                      {record.product_description || "Commercial Mockup Package"}
                      {record.brand_name ? ` · Brand: ${record.brand_name}` : ""}
                      {record.created_at ? ` · Created: ${formatDate(record.created_at)}` : ""}
                    </p>
                  </div>

                  {/* Claim Status Indicator */}
                  <div className="flex items-center gap-2.5">
                    {isClaimedByMe ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-300 text-xs font-bold">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>Claimed by you</span>
                      </span>
                    ) : isClaimed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-300 text-xs font-semibold">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Claimed by {data.claimedBy || "another teammate"}</span>
                      </span>
                    ) : isClosed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-300 text-xs font-bold">
                        <span>Request Closed</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={claiming || isReadOnly}
                        onClick={claimTask}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>{claiming ? "Claiming..." : "Claim Review Task"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Summary KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Mockup Volume</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--on-surface)]">
                      {data.qtyForMockup || requestData.quantity || 1} pcs
                    </p>
                    <p className="text-[10px] text-[var(--on-surface-subtle)]">Physical structural sample</p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Required Target</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--on-surface)]">
                      {formatDate(data.requiredDate || requestData.required_date)}
                    </p>
                    <p className="text-[10px] text-[var(--on-surface-subtle)]">Commercial Target Deadline</p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                      <Tag className="w-3.5 h-3.5 text-teal-600" />
                      <span>Material Reference</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[var(--on-surface)] truncate">
                      {display(record.material_code)}
                    </p>
                    <p className="text-[10px] text-[var(--on-surface-subtle)] truncate">
                      {display(requestData.category || "Paper Stationery")}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <span>Creative Reference</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-[var(--on-surface)] truncate">
                      {display(data.creativeShutterstockNo || data.marketingShutterstockNo || "Direct Catalog")}
                    </p>
                    <p className="text-[10px] text-[var(--on-surface-subtle)] truncate">Asset specification ref</p>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation Strip ── */}
              <div className="px-4 sm:px-8 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex items-center gap-6 overflow-x-auto text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("output")}
                  className={`pb-3 pt-3 border-b-2 transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "output"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>1. CAD / Mockup Deliverables</span>
                  {outputPath ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200/50">
                      ✓ Attached
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200/50">
                      Pending CAD
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("specs")}
                  className={`pb-3 pt-3 border-b-2 transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "specs"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. Product BOM &amp; Classes</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                    {productSpecifications.length} Specs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("review")}
                  className={`pb-3 pt-3 border-b-2 transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "review"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>3. Sampling PMT Sign-Off</span>
                  {isClosed ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                      ✓ Approved
                    </span>
                  ) : isSamplingReview ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                      Action Required
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`pb-3 pt-3 border-b-2 transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                    activeTab === "history"
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                      : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                  }`}
                >
                  <Clock3 className="w-3.5 h-3.5" />
                  <span>4. Activity &amp; Audit Trail</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                    {record.logs.length}
                  </span>
                </button>
              </div>
            </div>

            {/* ── Document Body Content ── */}
            <div className="p-4 sm:p-8 space-y-6">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* ═════════ TAB 1: CAD / MOCKUP DELIVERABLES & PREVIEW ═════════ */}
              {activeTab === "output" && (
                <div className="space-y-6">
                  {/* Studio Output Artifact Card */}
                  <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                          Studio Output Deliverable
                        </span>
                        <h2 className="text-sm font-bold text-[var(--on-surface)]">
                          CAD Structural Dieline &amp; Prepress Artwork File
                        </h2>
                        <p className="text-xs text-[var(--on-surface-muted)]">
                          Verify physical dieline dimensions, tuck-in flaps, crease scores, and board flute thickness before approval.
                        </p>
                      </div>

                      {outputHref && (
                        <a
                          href={outputHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold shadow-xs transition"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Launch External Link</span>
                        </a>
                      )}
                    </div>

                    {outputPath ? (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="break-all font-mono text-xs text-[var(--on-surface)] select-all font-semibold">
                            {outputPath}
                          </span>
                        </div>

                        {/* If Image Output, show live preview card */}
                        {isImageOutput && (
                          <div className="relative group overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] max-h-96 flex items-center justify-center p-2">
                            <img
                              src={outputPath}
                              alt="Mockup CAD preview"
                              className="max-h-80 object-contain rounded-lg transition group-hover:scale-[1.01]"
                            />
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(outputPath)}
                              className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-semibold shadow-md transition cursor-pointer"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                              <span>Enlarge Image</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-6 text-center space-y-2 dark:border-amber-800 dark:bg-amber-950/20">
                        <Boxes className="h-8 w-8 text-amber-600 mx-auto" />
                        <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Studio Dieline Output Pending
                        </h4>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 max-w-md mx-auto">
                          Studio has not yet linked the final CAD dieline file. Return to Studio with a revision note if urgent.
                        </p>
                      </div>
                    )}

                    {/* Studio Revision Notes or Marketing Requests */}
                    {(data.creativeRemark || data.marketingRemark || data.marketingRevisionRemark) && (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-4 space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                          Handoff Instructions &amp; Brief History
                        </span>
                        {data.marketingRemark && (
                          <p className="text-xs text-[var(--on-surface)]">
                            <strong className="text-[var(--on-surface-muted)]">Marketing Brief: </strong>
                            {data.marketingRemark}
                          </p>
                        )}
                        {data.creativeRemark && (
                          <p className="text-xs text-[var(--on-surface)]">
                            <strong className="text-[var(--on-surface-muted)]">Creative Instructions: </strong>
                            {data.creativeRemark}
                          </p>
                        )}
                        {data.marketingRevisionRemark && (
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            <strong>Marketing Revision Note: </strong>
                            {data.marketingRevisionRemark}
                          </p>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Accepted Designs Matrix for this Mockup */}
                  {selectedMockupDesigns.length > 0 && (
                    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4 text-[var(--accent-primary)]" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)]">
                          Accepted Graphic Design Variants ({selectedMockupDesigns.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {selectedMockupDesigns.map((d, idx) => (
                          <div
                            key={d.designNumber || idx}
                            className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] space-y-1"
                          >
                            <span className="text-[10px] font-mono font-bold text-[var(--accent-primary)]">
                              Variant #{d.designNumber || idx + 1}
                            </span>
                            <p className="text-xs font-semibold text-[var(--on-surface)]">
                              {d.description || "Commercial Design"}
                            </p>
                            {d.shutterstockNo && (
                              <p className="text-[10px] font-mono text-[var(--on-surface-muted)]">
                                Ref: {d.shutterstockNo}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* ═════════ TAB 1: SPECIFICATIONS & SCOPE ═════════ */}
              {activeTab === "scope" && (
                <div className="space-y-6">
                  {/* ── Section 1: Specification & Scope ── */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
                      <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)] font-mono">
                        1. Specification & Scope
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Customer / Brand</span>
                        <p className="text-xs font-semibold text-[var(--on-surface)]">{record.customer || "Commercial Account"}</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Required Due Date</span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{formatDate(String(record.due_date || data.requiredDate || requestData.due_date || "")) || "Immediate"}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Deliverable Quantity</span>
                        <p className="text-xs font-semibold text-[var(--on-surface)]">Mockup: <strong className="font-mono text-[var(--accent-primary)] font-bold">{String(requestData.qty_for_mockup || data.qty_for_mockup || 1)}</strong> pcs</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Material / Reference</span>
                        <p className="text-xs font-mono font-bold text-[var(--on-surface)]">{String(record.material_code || requestData.material_code || "Custom Mockup")}</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Category Taxonomy</span>
                        <p className="text-xs font-semibold text-[var(--on-surface)]">{String(record.product_category || "Paper Stationery")}</p>
                      </div>
                    </div>

                    {(data.creativeRemark || data.marketingRemark || data.marketingRevisionRemark) && (
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-3.5 space-y-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Brief & Instructions</span>
                        {data.marketingRemark && <p className="text-xs text-[var(--on-surface)]"><strong>Marketing Brief:</strong> {data.marketingRemark}</p>}
                        {data.creativeRemark && <p className="text-xs text-[var(--on-surface)]"><strong>Creative Instructions:</strong> {data.creativeRemark}</p>}
                        {data.marketingRevisionRemark && <p className="text-xs text-amber-800 dark:text-amber-300"><strong>Revision Note:</strong> {data.marketingRevisionRemark}</p>}
                      </div>
                    )}

                    <ScopeReferenceImagesGallery
                      images={scopeReferenceImages}
                      scopes={["mockup"]}
                      onPreview={setLightboxUrl}
                    />
                  </section>

                                    </div>
                )}

                {/* ═════════ TAB 2: PRODUCT CLASSES & SPECIFICATIONS ═════════ */}
                {activeTab === "specs" && (
                  <div className="space-y-5">
                    {/* ── Section 2: Product Classes & Specifications ── */}
                  <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 pt-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)] font-mono">
                      2. Product Classes & Specifications
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                      {productSpecifications.length} Specs
                    </span>
                  </div>
                  {/* Search Bar and View Mode Filters for Specs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--on-surface-subtle)]" />
                      <input
                        type="text"
                        placeholder="Search specification classes, characteristics, values..."
                        value={specSearchQuery}
                        onChange={(e) => setSpecSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {specViewMode === "docket" && docketClassGroups.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { downloadProductDocketPdf } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                await downloadProductDocketPdf(docketProduct, docketClassGroups);
                              } catch (err) {
                                console.error("Failed to download PDF:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-semibold text-rose-800 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 cursor-pointer"
                            title="Download Complete Technical Docket PDF"
                          >
                            <Download className="h-3.5 w-3.5 text-rose-600" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { downloadProductDocketCsv } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                await downloadProductDocketCsv(docketProduct, docketClassGroups);
                              } catch (err) {
                                console.error("Failed to download CSV:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 cursor-pointer"
                            title="Export Structured Docket to Excel / CSV (UI Styled)"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel / CSV
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { printProductDocketView } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                printProductDocketView(docketProduct, `mockup-docket-${record.sample_request_id}`);
                              } catch (err) {
                                console.error("Failed to print docket:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60 cursor-pointer"
                            title="Print or Save Complete Docket as PDF"
                          >
                            <Printer className="h-3.5 w-3.5" /> Print
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1 bg-[var(--surface-lowest)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => setSpecViewMode("all")}
                          className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                            specViewMode === "all"
                              ? "bg-[var(--surface-low)] text-[var(--on-surface)] font-bold shadow-2xs"
                              : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          <span>All Specs</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] font-normal border border-[var(--border-subtle)]">
                            {productSpecifications.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecViewMode("configured")}
                          className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                            specViewMode === "configured"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                              : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Configured</span>
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300/40">
                            {configuredSpecs.length}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpecViewMode("docket")}
                          className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                            specViewMode === "docket"
                              ? "bg-[var(--surface-low)] text-[var(--on-surface)] font-bold shadow-2xs"
                              : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          <span>Official Docket</span>
                        </button>
                      </div>

                      {specViewMode === "docket" && docketClassGroups.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { downloadProductDocketPdf } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                await downloadProductDocketPdf(docketProduct, docketClassGroups);
                              } catch (err) {
                                console.error("Failed to download PDF:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-[10px] font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-low)] cursor-pointer"
                            title="Download Complete Technical Docket PDF"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { downloadProductDocketCsv } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                await downloadProductDocketCsv(docketProduct, docketClassGroups);
                              } catch (err) {
                                console.error("Failed to download CSV:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-emerald-300/60 bg-emerald-50 px-2.5 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60 cursor-pointer"
                            title="Export Structured Docket to Excel / CSV (UI Styled)"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Excel / CSV
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { printProductDocketView } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                printProductDocketView(docketProduct, `mockup-docket-${record.sample_request_id}`);
                              } catch (err) {
                                console.error("Failed to print docket:", err);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 dark:hover:bg-sky-900/60 cursor-pointer"
                            title="Print or Save Complete Docket as PDF"
                          >
                            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isLoadingSpecifications ? (
                    <div className="p-8 text-center text-xs text-[var(--on-surface-muted)]">
                      Loading product specifications…
                    </div>
                  ) : specViewMode === "docket" ? (
                    <div className="w-full max-w-full overflow-hidden">
                      <ProductDocketView
                        product={docketProduct}
                        classGroups={docketClassGroups}
                        searchQuery={specSearchQuery}
                        containerId={`mockup-docket-${record.sample_request_id}`}
                      />
                    </div>
                  ) : specificationGroups.length > 0 ? (
                    <div className="space-y-4">
                      {specificationGroups.map((group) => (
                        <div
                          key={group.className}
                          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] overflow-hidden"
                        >
                          <div className="bg-[var(--surface-low)] px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-[var(--on-surface)] uppercase">
                              {group.className}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                              {group.items.length} items
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border-subtle)]">
                            {group.items.map((item) => (
                              <div
                                key={item.characteristicName}
                                className="bg-[var(--surface-lowest)] p-3 space-y-1"
                              >
                                <dt className="text-[10px] font-mono text-[var(--on-surface-subtle)] uppercase truncate">
                                  {item.characteristicName}
                                </dt>
                                <dd className="text-xs font-semibold text-[var(--on-surface)] break-words">
                                  {display(item.value)}
                                  {item.uom ? ` ${item.uom}` : ""}
                                </dd>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-6 text-center text-xs text-[var(--on-surface-muted)]">
                      No matching specifications found for this product.
                    </div>
                  )}
                </div>
              )}

              {/* ═════════ TAB 3: SAMPLING PMT SIGN-OFF & DECISION ═════════ */}
              {activeTab === "review" && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  {isClosed ? (
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-emerald-900 dark:text-emerald-200">
                          Mockup Approved &amp; Closed
                        </p>
                        <p className="text-emerald-800/80 dark:text-emerald-300/80">
                          Sampling PMT evaluation completed and forwarded. Commercial sign-off recorded.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/20 flex items-start gap-3">
                      <Boxes className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-teal-900 dark:text-teal-200">
                          Sampling Team Technical CAD &amp; Physical Verification
                        </p>
                        <p className="text-teal-800/80 dark:text-teal-300/80">
                          Check Studio dielines against product specifications. When verified, approve the mockup for Marketing final sign-off or return to Studio with adjustments.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Decision Form Section */}
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-4">
                    {/* Quick Verification Chips */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono">
                        Quick Feasibility Checklist
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_REVIEW_CHIPS.map((chip) => {
                          const active = selectedChips.includes(chip);
                          return (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => toggleChip(chip)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                active
                                  ? "bg-teal-50 border-teal-500 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
                                  : "bg-[var(--surface-low)] border-[var(--border-subtle)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                              }`}
                            >
                              {active ? "✓ " : "+ "}
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Review Note */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="mockup-notes"
                        className="block text-xs font-bold text-[var(--on-surface)] uppercase tracking-wider font-mono"
                      >
                        Technical Review Remarks / Instructions
                        <span className="font-normal text-[var(--on-surface-subtle)] ml-1">
                          (Required only when returning)
                        </span>
                      </label>
                      <textarea
                        id="mockup-notes"
                        rows={4}
                        maxLength={4000}
                        disabled={!canReview && !isClaimedByMe}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Detail the technical verification, crease alignment, flute adjustments, or instructions for Studio..."
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none disabled:opacity-60"
                      />
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-[11px] text-[var(--on-surface-subtle)]">
                        {!isClaimedByMe
                          ? "Claim task above to unlock decision controls."
                          : !outputPath
                          ? "CAD dieline link must be present to approve."
                          : "Approval automatically forwards this mockup to Marketing for final acceptance."}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={saving || !isClaimedByMe || !note.trim()}
                          onClick={() => submitDecision("return")}
                          className="px-4 py-2 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 transition cursor-pointer disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Return to Studio for Revision"}
                        </button>

                        <button
                          type="button"
                          disabled={saving || !isClaimedByMe || !canApprove}
                          onClick={() => submitDecision("approve")}
                          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{saving ? "Approving..." : "Approve for Marketing"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════ TAB 4: AUDIT TRAIL & ACTIVITY LOG ═════════ */}
              {activeTab === "history" && (
                <div className="h-[480px] rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-lowest)]">
                  <UniversalChatterFeed
                    title="Audit & Activity Log"
                    events={mockupChatterEvents}
                    currentUser={user}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. FOOTER CONTROLS ── */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-3 sm:px-6">
          <p className="hidden items-center gap-1.5 text-[11px] text-[var(--on-surface-subtle)] sm:flex">
            <Clock3 className="h-3.5 w-3.5" />
            <span>Last Activity: {formatDateTime(record.updated_at)}</span>
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="min-h-9 rounded-xl border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-50 transition cursor-pointer"
            >
              Close
            </button>

            {canReview && (
              <>
                <button
                  type="button"
                  disabled={saving || !isClaimedByMe || !note.trim()}
                  onClick={() => submitDecision("return")}
                  className="min-h-9 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100 px-4 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? "Saving…" : "Return to Studio"}
                </button>
                <button
                  type="button"
                  disabled={saving || !isClaimedByMe || !canApprove}
                  onClick={() => submitDecision("approve")}
                  className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-bold text-white shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>{saving ? "Saving…" : "Approve for Marketing"}</span>
                </button>
              </>
            )}
          </div>
        </footer>

        {/* Lightbox Modal for CAD Artwork Image */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-smooth-backdrop"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]">
              <img
                src={lightboxUrl}
                alt="Enlarged reference image"
                className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute -top-3 -right-3 rounded-full bg-white p-2 text-black shadow-lg hover:bg-zinc-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
};

export default MockupSamplingInspectorModal;
