import { UniversalChatterFeed, UniversalChatterEvent } from "./common/UniversalChatterFeed";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Package,
  Palette,
  Search,
  Tag,
  X,
  Download,
  Printer,
} from "lucide-react";
import type { UserProfile } from "@/features/auth";
import {
  claimCostingWorkflowApi,
  completeCostingWorkflowApi,
  releaseCostingWorkflowApi,
  reviewRequestWorkflowApi,
  type RequestWorkflowRecord,
} from "@/infrastructure/api";
import {
  fetchProductClassSpecificationsApi,
  type ProductDetailItem,
} from "@/infrastructure/api/masterApi";
import { isMockupCreativeCharacteristic } from "@/features/sample-requests/components/staging/mockupCreativeFields";
import { fetchSampleRequestByIdApi } from "@/infrastructure/api/sampleRequestsApi";
import { ScopeReferenceImagesGallery } from "@/features/sample-requests/components/staging/ScopeReferenceImagesGallery";
import { ProductDocketView } from "@/features/sample-requests/components/staging/ProductDocketView";
import type { ProductSearchResult, SampleRequestItem } from "@/features/sample-requests/types";
import { formatWorkflowAction } from "./workflowPresentation";
import { RequestClosedStamp } from "./common/RequestClosedWatermark";

export type InspectorMode = "creative" | "costing" | "sampling";
export type CostingTab = "scope" | "specs" | "output" | "commercial" | "review";

export interface CostingWorkflowInspectorModalProps {
  record: RequestWorkflowRecord;
  mode: InspectorMode;
  user?: UserProfile | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const stageLabels: Record<string, string> = {
  marketing: "Marketing Intake",
  creative: "Creative Review",
  costing: "Costing Work",
  sampling_review: "Sampling Review",
  done: "Closed",
};

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatDate(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
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

function isReadOnlyTeamHead(user?: UserProfile | null) {
  return (
    Boolean(user?.is_team_head) &&
    !["admin", "administrator"].includes(String(user?.role || "").toLowerCase())
  );
}

function externalUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : undefined;
}

function isMissingSpecificationValue(value: unknown) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return !normalized || ["NA", "N/A", "NAN", "NULL", "NONE", "-", "—"].includes(normalized);
}

export const CostingWorkflowInspectorModal: React.FC<CostingWorkflowInspectorModalProps> = ({
  record,
  mode,
  user,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<CostingTab>("scope");
  const [outputPath, setOutputPath] = useState(record.costing_output_path || "");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [locallyClaimedRequestId, setLocallyClaimedRequestId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Specifications state
  const [productSpecifications, setProductSpecifications] = useState<ProductDetailItem[]>([]);
  const [isLoadingSpecifications, setIsLoadingSpecifications] = useState(false);
  const [specificationsLoadError, setSpecificationsLoadError] = useState<string | null>(null);
  const [specSearchQuery, setSpecSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");
  const [specViewMode, setSpecViewMode] = useState<"all" | "configured" | "docket">("all");
  const [scopeReferenceImages, setScopeReferenceImages] = useState<NonNullable<SampleRequestItem["scopeReferenceImages"]>>({});

  const dialogRef = useRef<HTMLElement>(null);
  const readOnly = isReadOnlyTeamHead(user);
  const requestData = record.request_data || {};

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

  const isCreativeReview = record.current_stage === "creative";
  const isCostingWork = record.current_stage === "costing";
  const isSamplingReview = record.current_stage === "sampling_review";
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
  const isReturned = record.reviewer_status === "returned";

  const isGlobalAdmin = ["admin", "administrator"].includes(String(user?.role || "").toLowerCase());
  const isClaimedByMe = Boolean(record.is_claimed_by_me) || locallyClaimedRequestId === record.sample_request_id;
  const isClaimed = Boolean(record.is_claimed || record.claimed_by || isClaimedByMe);
  const canClaimCosting = !isClosed && mode === "costing" && isCostingWork && !readOnly;
  const canSubmitCosting = !isClosed && mode === "costing" && isCostingWork && !readOnly && (isClaimedByMe || isGlobalAdmin);
  const canReview = !isClosed && (mode === "sampling" || isSamplingReview) && !readOnly;
  const canReleaseToCosting = !isClosed && (mode === "creative" || isCreativeReview) && !readOnly;

  const creativeDeadline = record.creative_due_at ? new Date(record.creative_due_at) : null;
  const creativeDeadlineLabel =
    creativeDeadline && !Number.isNaN(creativeDeadline.getTime())
      ? new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        }).format(creativeDeadline)
      : null;

  // Group specs by class
  const specificationGroups = useMemo(() => {
    const groups = new Map<string, ProductDetailItem[]>();
    productSpecifications.forEach((item) => {
      const current = groups.get(item.className) || [];
      current.push(item);
      groups.set(item.className, current);
    });
    return [...groups.entries()];
  }, [productSpecifications]);

  const costingDocketProduct = useMemo<ProductSearchResult & { brand?: string }>(() => ({
    id: Number(record.sample_request_id),
    sr_number: record.sr_number,
    material_code: record.material_code || "",
    product_description: record.product_description || "",
    customer: record.customer || "",
    target_plant: (requestData.target_plant as string) || (requestData.plant as string) || "",
    source_sample_code: [requestData.barcode, requestData.customer_product_code].filter(Boolean).join(" / "),
    brand: record.brand_name || "",
  } as ProductSearchResult & { brand?: string }), [record, requestData]);

  const configuredCount = useMemo(() => {
    return productSpecifications.filter((item) => !isMissingSpecificationValue(item.value)).length;
  }, [productSpecifications]);

  // Unique classes for filtering (filtered dynamically if in configured mode)
  const availableClasses = useMemo(() => {
    const items =
      specViewMode === "configured"
        ? productSpecifications.filter((item) => !isMissingSpecificationValue(item.value))
        : productSpecifications;
    return [...new Set(items.map((item) => item.className))].sort();
  }, [productSpecifications, specViewMode]);

  useEffect(() => {
    if (selectedClassFilter !== "all" && !availableClasses.includes(selectedClassFilter)) {
      setSelectedClassFilter("all");
    }
  }, [availableClasses, selectedClassFilter]);

  useEffect(() => {
    if (mode === "creative") {
      setActiveTab("specs");
      setSpecViewMode("all");
    }
  }, [mode]);


  const creativeFields = useMemo(
    () =>
      productSpecifications.filter((item) =>
        isMockupCreativeCharacteristic(item.className, item.characteristicName)
      ),
    [productSpecifications]
  );

  const missingCreativeFields = useMemo(
    () => creativeFields.filter((item) => isMissingSpecificationValue(item.value)),
    [creativeFields]
  );

  // Stepper calculations
  const steps = useMemo(() => {
    const creativeRequired = Boolean(record.costing_creative_input_needed);
    return [
      {
        id: "marketing",
        label: "1. Intake",
        status: "done" as const,
        badge: "Submitted",
      },
      ...(creativeRequired
        ? [
            {
              id: "creative",
              label: "2. Creative Review",
              status: isCreativeReview
                ? ("active" as const)
                : ("done" as const),
              badge: isCreativeReview ? "In Review" : "Released",
            },
          ]
        : []),
      {
        id: "costing",
        label: creativeRequired ? "3. Costing Work" : "2. Costing Work",
        status: isCostingWork
          ? ("active" as const)
          : isSamplingReview || isClosed
          ? ("done" as const)
          : ("pending" as const),
        badge: isReturned
          ? "Revision Req"
          : isCostingWork
          ? "In Progress"
          : isSamplingReview || isClosed
          ? "Submitted"
          : "Awaiting",
        isAmber: isReturned,
      },
      {
        id: "sampling_review",
        label: creativeRequired ? "4. Sampling Review" : "3. Sampling Review",
        status: isSamplingReview
          ? ("active" as const)
          : isClosed
          ? ("done" as const)
          : ("pending" as const),
        badge: isClosed
          ? "Approved"
          : isSamplingReview
          ? "Pending Review"
          : "Awaiting",
      },
      {
        id: "done",
        label: creativeRequired ? "5. Closed" : "4. Closed",
        status: isClosed ? ("done" as const) : ("pending" as const),
        badge: isClosed ? "Closed" : undefined,
      },
    ];
  }, [isClosed, isCostingWork, isCreativeReview, isReturned, isSamplingReview, record.costing_creative_input_needed]);

  // Load product specifications on open
  useEffect(() => {
    setOutputPath(record.costing_output_path || "");
    setNotes("");
    setError(null);
    setProductSpecifications([]);
    setScopeReferenceImages({});
    setSpecificationsLoadError(null);
    setIsLoadingSpecifications(true);
    let cancelled = false;

    fetchProductClassSpecificationsApi(record.sample_request_id)
      .then((details) => {
        if (cancelled) return;
        setProductSpecifications(details);
      })
      .catch(() => {
        if (!cancelled) {
          setProductSpecifications([]);
          setSpecificationsLoadError(
            "Product classes and specifications could not be loaded. Close this request and try again."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSpecifications(false);
      });

    fetchSampleRequestByIdApi(record.sample_request_id)
      .then((request) => {
        if (!cancelled) setScopeReferenceImages(request.scopeReferenceImages || {});
      })
      .catch((reason) => console.warn("Could not load Costing reference images:", reason));

    return () => {
      cancelled = true;
    };
  }, [record.sample_request_id, record.costing_output_path]);

  // Lock body scroll
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSaving, onClose]);

  // Copy code handler
  const handleCopyCode = () => {
    const code = record.request_code || record.sr_number || `CR-${record.sample_request_id}`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const claimTask = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setError(null);
    try {
      await claimCostingWorkflowApi(record.sample_request_id);
      setLocallyClaimedRequestId(record.sample_request_id);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not claim this Costing task.");
    } finally {
      setIsClaiming(false);
    }
  };

  // Save / Submit workflow update
  const save = async (decision?: "approve" | "return") => {
    if (decision === "return" && !notes.trim()) {
      setError("Please add a review note explaining what needs to be changed before returning this request.");
      return;
    }
    if (!decision && mode === "costing" && !outputPath.trim()) {
      setError("Please enter the costing sheet link or workbook file path before submitting.");
      return;
    }
    if (!decision && mode === "creative" && missingCreativeFields.length > 0) {
      setError(
        `Complete the ${missingCreativeFields.length} highlighted Creative specification field${
          missingCreativeFields.length === 1 ? "" : "s"
        } before sending to Costing.`
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (mode === "creative") {
        await releaseCostingWorkflowApi(record.sample_request_id, {
          specifications: productSpecifications.map(({ className, characteristicName, value, uom }) => ({
            className,
            characteristicName,
            value,
            uom,
          })),
          note: notes.trim(),
        });
      } else if (decision) {
        await reviewRequestWorkflowApi("costing", record.sample_request_id, {
          decision,
          remark: notes.trim(),
        });
      } else {
        await completeCostingWorkflowApi(record.sample_request_id, {
          outputPath: outputPath.trim(),
          notes: notes.trim(),
        });
      }
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this workflow update.");
    } finally {
      setIsSaving(false);
    }
  };

  const code = record.request_code || record.sr_number || `CR-${record.sample_request_id}`;

  const costingChatterEvents = useMemo<UniversalChatterEvent[]>(() => {
    return (record.logs || []).map((log) => {
      const hasRemark = Boolean(log.details?.remark) || Boolean(log.details?.note);
      const remarkText = String(log.details?.remark || log.details?.note || "").trim();
      const isSystem = !hasRemark;

      return {
        id: log.id,
        kind: isSystem ? "system_announcement" : "bubble",
        actorName: log.actor_name || "Team Member",
        actorDepartment: log.actor_team || "Costing",
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 select-text"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="costing-inspector-title"
        className="relative w-full max-w-[96vw] xl:max-w-7xl h-[92vh] max-h-[92vh] flex flex-col bg-[var(--surface-lowest)] border border-[var(--border-subtle)] rounded-2xl shadow-[0_24px_70px_-12px_rgba(11,28,48,0.25)] overflow-hidden select-text text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {isClosed && <RequestClosedStamp label="REQUEST WAS CLOSED" />}
        {/* ── 1. TOP CONTROL PANEL WITH STEPPER ── */}
        <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Inspector</span>
            </button>

            <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

            <button
              type="button"
              onClick={handleCopyCode}
              className="text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] font-medium px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
              title="Copy request code"
            >
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[var(--on-surface-subtle)]" />
              )}
              <span className="font-mono">{copiedCode ? "Copied" : code}</span>
            </button>
            {mode === "costing" && isCostingWork && (
              <div role="status" aria-live="polite" className="ml-1 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-low)] px-2.5 py-1.5">
                <span className="text-[11px] font-medium text-[var(--on-surface-muted)]">
                  {isClaimedByMe
                    ? "Claimed by you"
                    : record.claimed_by
                      ? `Claimed by ${record.claimed_by}`
                      : isClosed
                        ? "Request Closed"
                        : isClaimed
                          ? "Claimed by another Costing member"
                          : "Available to claim"}
                </span>
                {!isClosed && canClaimCosting && (!isClaimed || isGlobalAdmin) && !isClaimedByMe && (
                  <button
                    type="button"
                    disabled={isClaiming || isSaving}
                    onClick={() => void claimTask()}
                    className="inline-flex min-h-7 items-center rounded-md bg-[var(--accent-primary)] px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isClaiming ? "Claiming..." : isClaimed ? "Reassign to me" : "Claim task"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Modern Workflow Stepper */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-low)] rounded-xl border border-[var(--border-subtle)] overflow-x-auto max-w-full">
            {steps.map((st, i) => {
              const isCurrent =
                (st.id === "marketing" && record.current_stage === "marketing") ||
                (st.id === "creative" && isCreativeReview) ||
                (st.id === "costing" && isCostingWork) ||
                (st.id === "sampling_review" && isSamplingReview) ||
                (st.id === "done" && isClosed);

              return (
                <React.Fragment key={st.id}>
                  {i > 0 && (
                    <ArrowRight className="w-3 h-3 text-[var(--on-surface-subtle)] shrink-0 opacity-40" />
                  )}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition select-none whitespace-nowrap ${
                      isCurrent
                        ? st.isAmber
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold shadow-2xs"
                          : "bg-[var(--surface-lowest)] text-[var(--accent-primary)] font-bold shadow-2xs"
                        : st.status === "done"
                        ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                        : "text-[var(--on-surface-subtle)]"
                    }`}
                  >
                    {st.status === "done" ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[var(--border-strong)] shrink-0" />
                    )}
                    <span>{st.label}</span>
                    {st.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-md ${
                          st.isAmber
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 font-bold"
                            : isCurrent
                            ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                            : "bg-[var(--surface-lowest)] text-[var(--on-surface-subtle)]"
                        }`}
                      >
                        {st.badge}
                      </span>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>



        {/* ── 2. MAIN SPLIT VIEW (LEFT: DOCUMENT SHEET + RIGHT: TIME LOG CHATTER) ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: FORM SHEET (DOCUMENT BODY) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-[var(--bg-app)]">
            <div className={`mx-auto rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(11,28,48,0.04)] overflow-hidden transition-all duration-300 ${
              "max-w-6xl"
            }`}>
              {/* ── Dossier Header ── */}
              <div className="bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
                {/* Reference, Account & Status Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 py-3 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--surface-lowest)] text-[var(--accent-primary)] border border-[var(--border-subtle)] shadow-2xs">
                      {code}
                    </span>
                    <span className="text-[var(--border-strong)]">/</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[var(--surface-lowest)] text-xs font-semibold text-[var(--on-surface)] border border-[var(--border-subtle)]">
                      <Building2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>{record.customer || "Commercial Account"}</span>
                      {record.brand_name && (
                        <span className="text-[var(--on-surface-muted)] font-normal">
                          · {record.brand_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Operational Status Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                      <FileSpreadsheet className="w-3 h-3 text-sky-600" />
                      <span>Costing Run</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-display font-bold border ${
                        isReturned
                          ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
                          : isClosed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : isCostingWork
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300"
                          : "bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] border-[var(--border-subtle)]"
                      }`}
                    >
                      {isClosed ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{record.status}</span>
                    </span>
                  </div>
                </div>

                {/* Document Hero Section: Title & Headline */}
                <div className="px-6 sm:px-8 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                        {mode === "creative" ? "Creative Product Inspection" : "Technical Costing Dossier"}
                      </span>
                      <h1
                        id="costing-inspector-title"
                        className="text-lg sm:text-xl font-display font-bold tracking-tight text-[var(--on-surface)] mt-1"
                      >
                        {record.product_description || "Commercial Product Costing Request"}
                      </h1>
                    </div>
                  </div>

                  {/* ── 4 Top KPI Summary Cards ── */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    {/* 1. Target Volume */}
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                        <Package className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Costing Volume</span>
                      </div>
                      <p className="text-sm font-bold text-[var(--on-surface)]">
                        {display(requestData.quantity)}{" "}
                        <span className="text-xs font-normal text-[var(--on-surface-muted)]">
                          {display(requestData.unit_pc_pack)}
                        </span>
                      </p>
                      <p className="text-[10px] text-[var(--on-surface-subtle)]">
                        {requestData.unit_pc_pack === "Pack" && requestData.qty_per_pack
                          ? `${requestData.qty_per_pack} pcs / pack`
                          : "Individual Units (PC)"}
                      </p>
                    </div>

                    {/* 2. Required Date */}
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Required Target</span>
                      </div>
                      <p className="text-sm font-bold text-[var(--on-surface)]">
                        {formatDate(requestData.required_date)}
                      </p>
                      <p className="text-[10px] text-[var(--on-surface-subtle)]">
                        Customer Quotation Target
                      </p>
                    </div>

                    {/* 3. Material Code */}
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
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

                    {/* 4. SKU & Barcode */}
                    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                        <Barcode className="w-3.5 h-3.5 text-violet-500" />
                        <span>SKU &amp; Barcode</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-[var(--on-surface)] truncate">
                        {display(requestData.customer_product_code || requestData.barcode)}
                      </p>
                      <p className="text-[10px] text-[var(--on-surface-subtle)] truncate">
                        Barcode: {display(requestData.barcode)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tab Navigation Strip ── */}
              <div className="px-6 sm:px-8 pt-2 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
                <div className="flex items-center space-x-6 text-xs font-semibold overflow-x-auto">
                  {/* Tab 1: Costing Output Workspace (Primary Action Tab) */}
                  {mode !== "creative" && <button
                    type="button"
                    onClick={() => setActiveTab("output")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "output"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>1. Costing Sheet &amp; Submission</span>
                    {record.costing_output_path ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200/50">
                        ✓ Attached
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200/50">
                        Pending
                      </span>
                    )}
                  </button>}

                  {/* Tab 2: Specifications & BOM Docket */}
                  <button
                    type="button"
                    onClick={() => setActiveTab("specs")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "specs"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{mode === "creative" ? "Product Classes & Characteristics" : "2. Technical BOM &amp; Classes"}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                      {specViewMode === "configured"
                        ? `${configuredCount} Configured`
                        : `${productSpecifications.length} Specs`}
                    </span>
                  </button>

                  {/* Tab 3: Commercial & Creative Inputs */}
                  {mode !== "creative" && <button
                    type="button"
                    onClick={() => setActiveTab("commercial")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "commercial"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>3. Commercial Terms &amp; Creative</span>
                    {record.costing_creative_input_needed && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold">
                        Creative Spec
                      </span>
                    )}
                  </button>}

                  {/* Tab 4: Sampling Review */}
                  {mode !== "creative" && <button
                    type="button"
                    onClick={() => setActiveTab("review")}
                    className={`pb-3 border-b-2 font-display transition cursor-pointer select-none flex items-center gap-2 whitespace-nowrap ${
                      activeTab === "review"
                        ? "border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold"
                        : "border-transparent text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>4. Sampling Sign-Off</span>
                    {isClosed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                        ✓ Approved
                      </span>
                    ) : isReturned ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                        Returned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface-muted)] font-normal">
                        {isSamplingReview ? "In Review" : "Pending Costing"}
                      </span>
                    )}
                  </button>}
                </div>
              </div>

              {/* ── Document Body Content ── */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Global Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════════════
                     TAB 1: COSTING OUTPUT WORKSPACE (PRIMARY ACTION TAB)
                   ════════════════════════════════════════════════════════════════════ */}
                {activeTab === "output" && (
                  <div className="space-y-6">
                    {/* Prompt banner for Returned Revision */}
                    {isReturned && (
                      <div className="rounded-2xl border border-amber-300 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/30 p-5 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 font-mono">
                            Sampling Team Revision Requested
                          </h3>
                        </div>
                        <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                          Reviewer Remark:{" "}
                          <span className="font-normal italic">
                            "{record.reviewer_notes || "Please revise the calculation sheet."}"
                          </span>
                        </p>
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                          Please update the costing sheet link or adjust handoff assumptions below,
                          then resubmit for Sampling review.
                        </p>
                      </div>
                    )}

                    {/* Costing Output Submission Card */}
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            <FileSpreadsheet className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-sm font-bold text-[var(--on-surface)]">
                              Costing Workbook &amp; Estimation Sheet
                            </h2>
                            <p className="text-xs text-[var(--on-surface-muted)]">
                              {canSubmitCosting
                                ? "Paste the link to the completed costing spreadsheet or server file path."
                                : isCostingWork && isClaimed && !isClaimedByMe && !isGlobalAdmin
                                  ? `This Costing task is claimed by ${record.claimed_by || "another Costing member"}.`
                                  : isCostingWork && !isClaimedByMe && !isGlobalAdmin
                                    ? "Claim this task to edit and submit the Costing sheet."
                                    : "The costing sheet submitted by the Costing team."}
                            </p>
                          </div>
                        </div>

                        {record.costing_output_path && externalUrl(record.costing_output_path) && (
                          <a
                            href={externalUrl(record.costing_output_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-base)] transition shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Costing Sheet</span>
                          </a>
                        )}
                      </div>

                      {/* Sheet Link / URL input */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="costing-output-path"
                          className="flex items-center justify-between text-xs font-semibold text-[var(--on-surface)]"
                        >
                          <span>
                            Costing Workbook Link or File Path{" "}
                            {canSubmitCosting && <span className="text-rose-600">*</span>}
                          </span>
                          {outputPath && externalUrl(outputPath) && (
                            <a
                              href={externalUrl(outputPath)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-normal text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Test Link</span>
                            </a>
                          )}
                        </label>
                        <input
                          id="costing-output-path"
                          type="text"
                          disabled={!canSubmitCosting || isSaving}
                          value={outputPath}
                          onChange={(e) => setOutputPath(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/... or \\fileserver\costing\..."
                          className="w-full h-10 px-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] font-mono disabled:opacity-60"
                        />
                      </div>

                      {/* Handoff Notes & Assumptions */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="costing-handoff-notes"
                          className="block text-xs font-semibold text-[var(--on-surface)]"
                        >
                          Costing Assumptions &amp; Technical Notes{" "}
                          <span className="font-normal text-[var(--on-surface-subtle)]">
                            (substrate GSM, conversion rates, MOQ conditions)
                          </span>
                        </label>
                        <textarea
                          id="costing-handoff-notes"
                          rows={4}
                          disabled={!canSubmitCosting || isSaving}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Detail your costing assumptions, yield calculations, or specific substrate remarks for Sampling..."
                          className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] disabled:opacity-60"
                        />
                      </div>

                      {/* Previously attached notes if viewing */}
                      {!canSubmitCosting && record.costing_notes && (
                        <div className="rounded-xl bg-[var(--surface-low)] p-3.5 border border-[var(--border-subtle)] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                            Submitted Costing Notes
                          </span>
                          <p className="whitespace-pre-wrap text-xs text-[var(--on-surface)] leading-relaxed">
                            {record.costing_notes}
                          </p>
                        </div>
                      )}

                      {/* Action Bar for Costing Specialist */}
                      {canSubmitCosting && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
                          <p className="text-[11px] text-[var(--on-surface-muted)]">
                            Submitting sends this costing dossier to the Sampling team for technical
                            approval.
                          </p>
                          <button
                            type="button"
                            disabled={isSaving || !outputPath.trim()}
                            onClick={() => void save()}
                            className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <span>{isSaving ? "Submitting..." : "Submit to Sampling for Review"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════════════
                     TAB 1: SPECIFICATIONS & SCOPE
                   ════════════════════════════════════════════════════════════════════ */}
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
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Customer Account</span>
                          <p className="text-xs font-semibold text-[var(--on-surface)]">{record.customer || "Commercial Account"}</p>
                          {Boolean(requestData.customer_product_code) && (
                            <p className="text-[11px] text-[var(--on-surface-muted)]">SKU: {String(requestData.customer_product_code)}</p>
                          )}
                        </div>

                        <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Target Quotation Due</span>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--on-surface)]">
                            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{formatDate(String(record.due_date || requestData.due_date || "")) || "Immediate"}</span>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-1">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">Target Substrate / Material</span>
                          <p className="text-xs font-mono font-bold text-[var(--on-surface)]">{String(record.material_code || requestData.material_code || "Custom Substrate")}</p>
                        </div>
                      </div>

                      <ScopeReferenceImagesGallery
                        images={scopeReferenceImages}
                        scopes={["costing"]}
                        onPreview={(url) => window.open(url, "_blank", "noopener,noreferrer")}
                      />
                    </section>

                                        </div>
                  )}

                  {/* ═════════ TAB 2: PRODUCT CLASSES & SPECIFICATIONS ═════════ */}
                  {activeTab === "specs" && (
                    <div className="space-y-4">
                      {/* ── Section 2: Product Classes & Specifications ── */}
                    <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2 pt-2">
                      <Layers className="w-4 h-4 text-teal-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface)] font-mono">
                        2. Product Classes & Specifications
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--surface-low)] text-[var(--on-surface)] font-bold border border-[var(--border-subtle)]">
                        {specViewMode === "configured"
                          ? `${configuredCount} Configured`
                          : `${productSpecifications.length} Specs`}
                      </span>
                    </div>
                    {mode === "creative" && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-xs text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-100">
                        Review each product class and characteristic. You can edit any value here;
                        changes are saved when you send the request to Costing. Purple “Creative input”
                        fields are required for release.
                      </div>
                    )}
                    {/* View Controls & Filter Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface-low)] p-3 rounded-xl border border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={specSearchQuery}
                            onChange={(e) => setSpecSearchQuery(e.target.value)}
                            placeholder="Filter specs (e.g. GSM, binding)..."
                            className="pl-8 pr-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] w-48 sm:w-60"
                          />
                        </div>

                        {/* Class Dropdown Filter */}
                        {availableClasses.length > 1 && (
                          <select
                            value={selectedClassFilter}
                            onChange={(e) => setSelectedClassFilter(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                          >
                            <option value="all">All Classes ({availableClasses.length})</option>
                            {availableClasses.map((cls) => (
                              <option key={cls} value={cls}>
                                {cls}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Creative review stays in the editable product view; docket is for other teams. */}
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
                            {configuredCount}
                          </span>
                        </button>
                        {mode !== "creative" && <button
                          type="button"
                          onClick={() => setSpecViewMode("docket")}
                          className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                            specViewMode === "docket"
                              ? "bg-[var(--surface-low)] text-[var(--on-surface)] font-bold shadow-2xs"
                              : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                          }`}
                        >
                          <span>Official Docket</span>
                        </button>}
                      </div>

                      {specViewMode === "docket" && mode !== "creative" && specificationGroups.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { downloadProductDocketPdf } = await import("@/features/sample-requests/components/staging/productDocketPdf");
                                await downloadProductDocketPdf(costingDocketProduct, specificationGroups);
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
                                await downloadProductDocketCsv(costingDocketProduct, specificationGroups);
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
                                printProductDocketView(costingDocketProduct, `costing-docket-${record.sample_request_id}`);
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

                    {/* Creative Missing Fields Warning if Creative Mode */}
                    {mode === "creative" && missingCreativeFields.length > 0 && (
                      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100 flex items-center justify-between gap-2">
                        <span>
                          {missingCreativeFields.length} Creative specification field(s) require
                          values before this request can be released to Costing.
                        </span>
                      </div>
                    )}

                    {/* Loading & Error States */}
                    {isLoadingSpecifications ? (
                      <div className="p-8 text-center text-xs text-[var(--on-surface-muted)]">
                        Loading product classes and specifications…
                      </div>
                    ) : specificationsLoadError ? (
                      <div className="rounded-xl bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-200">
                        {specificationsLoadError}
                      </div>
                    ) : productSpecifications.length === 0 ? (
                      <div className="rounded-xl bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200">
                        No product class or specification rows are attached yet.
                      </div>
                    ) : specViewMode === "docket" && mode !== "creative" ? (
                      /* Official Docket View */
                      <div className="w-full max-w-full overflow-hidden">
                        <ProductDocketView
                          product={costingDocketProduct}
                          classGroups={specificationGroups}
                          containerId={`costing-docket-${record.sample_request_id}`}
                        />
                      </div>
                    ) : (
                      /* Clean Structured Class Cards & Table View (All Specs or Configured Only) */
                      (() => {
                        const visibleGroups = specificationGroups
                          .filter(([className, details]) => {
                            if (selectedClassFilter !== "all" && className !== selectedClassFilter) {
                              return false;
                            }
                            if (specViewMode === "configured") {
                              return details.some((d) => !isMissingSpecificationValue(d.value));
                            }
                            return true;
                          })
                          .map(([className, details]) => {
                            const matchingDetails = details.filter((item) => {
                              if (
                                specViewMode === "configured" &&
                                isMissingSpecificationValue(item.value)
                              ) {
                                return false;
                              }
                              const q = specSearchQuery.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                item.characteristicName.toLowerCase().includes(q) ||
                                String(item.value || "").toLowerCase().includes(q) ||
                                String(item.uom || "").toLowerCase().includes(q)
                              );
                            });

                            return { className, matchingDetails };
                          })
                          .filter((g) => g.matchingDetails.length > 0);

                        if (visibleGroups.length === 0) {
                          return (
                            <div className="p-8 text-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-2">
                              <p className="text-xs font-semibold text-[var(--on-surface)]">
                                {specViewMode === "configured"
                                  ? "No configured specifications found"
                                  : "No specifications match your search"}
                              </p>
                              <p className="text-[11px] text-[var(--on-surface-muted)]">
                                {specViewMode === "configured"
                                  ? "None of the characteristics in this filter have configured values."
                                  : "Try adjusting your search query or class filter."}
                              </p>
                              {specViewMode === "configured" && (
                                <button
                                  type="button"
                                  onClick={() => setSpecViewMode("all")}
                                  className="mt-2 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                                >
                                  Switch to All Specifications
                                </button>
                              )}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {visibleGroups.map(({ className, matchingDetails }) => (
                              <section
                                key={className}
                                className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)]"
                              >
                                <div className="px-4 py-2.5 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-[var(--on-surface)] flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                                    <span>{className}</span>
                                    {specViewMode === "configured" && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                        Configured
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                                    {matchingDetails.length}{" "}
                                    {specViewMode === "configured" ? "configured" : "items"}
                                  </span>
                                </div>

                                <div className="divide-y divide-[var(--border-subtle)]">
                                  {matchingDetails.map((detail) => {
                                    const isCreativeField = isMockupCreativeCharacteristic(
                                      detail.className,
                                      detail.characteristicName
                                    );
                                    const value = String(detail.value ?? "");

                                    return (
                                      <div
                                        key={`${detail.className}::${detail.characteristicName}`}
                                        className="grid grid-cols-[minmax(0,1.2fr)_minmax(140px,1fr)_auto] items-center gap-3 px-4 py-2.5 bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)]/40 transition"
                                      >
                                        <div className="min-w-0">
                                          <p className="break-words text-xs font-medium text-[var(--on-surface)]">
                                            {detail.characteristicName}
                                          </p>
                                          {isCreativeField && (
                                            <span className="mt-0.5 inline-flex rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">
                                              Creative input
                                            </span>
                                          )}
                                        </div>

                                        {mode === "creative" ? (
                                          <input
                                            aria-label={`${className} ${detail.characteristicName}`}
                                            disabled={!canReleaseToCosting || isSaving}
                                            value={isMissingSpecificationValue(value) ? "" : value}
                                            onChange={(e) =>
                                              setProductSpecifications((current) =>
                                                current.map((item) =>
                                                  item.className === detail.className &&
                                                  item.characteristicName ===
                                                    detail.characteristicName
                                                    ? { ...item, value: e.target.value }
                                                    : item
                                                )
                                              )
                                            }
                                            placeholder="Enter specification..."
                                            className="h-8 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                                          />
                                        ) : (
                                          <span className="min-w-0 break-words text-xs font-semibold text-[var(--on-surface)]">
                                            {display(detail.value)}
                                          </span>
                                        )}

                                        <span className="min-w-8 text-right text-[10px] font-mono text-[var(--on-surface-subtle)]">
                                          {display(detail.uom)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>
                        );
                      })()
                    )}

                    {/* Creative Handoff Button if in Creative Mode */}
                    {canReleaseToCosting && (
                      <div className="pt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={
                            isSaving ||
                            isLoadingSpecifications ||
                            Boolean(specificationsLoadError) ||
                            productSpecifications.length === 0 ||
                            missingCreativeFields.length > 0
                          }
                          onClick={() => void save()}
                          className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          <span>{isSaving ? "Releasing..." : "Send to Costing Desk"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════════════
                     TAB 3: COMMERCIAL TERMS & CREATIVE INPUTS
                   ════════════════════════════════════════════════════════════════════ */}
                {activeTab === "commercial" && (
                  <div className="space-y-5">
                    {/* Creative Studio Handoff Card */}
                    {record.costing_creative_input_needed && (
                      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-bold text-[var(--on-surface)] uppercase font-mono tracking-wider flex items-center gap-2">
                            <Palette className="w-3.5 h-3.5 text-violet-600" />
                            <span>Creative Input Requested by Marketing</span>
                          </h3>
                          {creativeDeadlineLabel && (
                            <span className="text-[11px] font-semibold text-[var(--accent-primary)] bg-[var(--surface-lowest)] px-2.5 py-0.5 rounded-md border border-[var(--border-subtle)]">
                              Creative SLA: {creativeDeadlineLabel} IST
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--on-surface-muted)] bg-[var(--surface-lowest)] p-3 rounded-xl border border-[var(--border-subtle)]">
                          {record.costing_creative_input_remark?.trim() ||
                            "Marketing requested Creative Studio review without additional remarks."}
                        </p>
                      </section>
                    )}

                    {/* Commercial Inputs Specification Grid */}
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] font-mono">
                        Commercial Product Registration Fields
                      </h3>
                      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          ["Customer Account", record.customer],
                          ["Brand Label", record.brand_name],
                          ["Material Code", record.material_code],
                          ["Customer SKU Code", requestData.customer_product_code],
                          ["Barcode / EAN", requestData.barcode],
                          ["Costing Target Quantity", requestData.quantity],
                          ["Target Unit", requestData.unit_pc_pack],
                          [
                            "Packaging Breakdown",
                            requestData.unit_pc_pack === "Pack"
                              ? `${requestData.qty_per_pack} pcs / pack`
                              : "PC (Individual Units)",
                          ],
                          ["Primary Category", requestData.category],
                          ["Sub-Category", requestData.sub_category],
                          ["Third Category", requestData.third_category],
                          ["Target Delivery Date", formatDate(requestData.required_date)],
                        ].map(([lbl, val]) => (
                          <div
                            key={String(lbl)}
                            className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]"
                          >
                            <dt className="text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--on-surface-subtle)]">
                              {String(lbl)}
                            </dt>
                            <dd className="mt-1 text-xs font-semibold text-[var(--on-surface)] break-words">
                              {display(val)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                )}

                {/* ════════════════════════════════════════════════════════════════════
                     TAB 4: SAMPLING REVIEW & SIGN-OFF
                   ════════════════════════════════════════════════════════════════════ */}
                {activeTab === "review" && (
                  <div className="space-y-5">
                    {/* Review Decision Workspace */}
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-5 space-y-4 shadow-sm">
                      <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] pb-3">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-[var(--on-surface)]">
                            Sampling Technical Sign-Off
                          </h2>
                          <p className="text-xs text-[var(--on-surface-muted)]">
                            {canReview
                              ? "Verify the costing sheet outputs against specifications before approving or returning."
                              : "Review status and remarks from the Sampling department."}
                          </p>
                        </div>
                      </div>

                      {/* Attached Costing Sheet Preview if Available */}
                      {record.costing_output_path ? (
                        <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
                              Costing Sheet Output
                            </span>
                            <span className="text-xs font-mono font-semibold text-[var(--on-surface)] break-all">
                              {record.costing_output_path}
                            </span>
                          </div>
                          {externalUrl(record.costing_output_path) && (
                            <a
                              href={externalUrl(record.costing_output_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-base)] shrink-0 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open Sheet</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                          Costing team has not submitted an output sheet yet.
                        </div>
                      )}

                      {/* Approval Seal if Closed */}
                      {isClosed && (
                        <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100 flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-xs font-bold">Costing Dossier Approved &amp; Closed</p>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                              Reviewed by {record.reviewer_name || "Sampling Specialist"} on{" "}
                              {formatDateTime(record.reviewed_at || record.closed_at)}.
                            </p>
                            {record.reviewer_notes && (
                              <p className="text-xs italic mt-1.5 border-t border-emerald-200/50 pt-1">
                                "{record.reviewer_notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Review Action Controls (Sampling Mode) */}
                      {canReview && (
                        <div className="space-y-3 pt-2">
                          <label
                            htmlFor="costing-review-notes"
                            className="block text-xs font-semibold text-[var(--on-surface)]"
                          >
                            Reviewer Remarks{" "}
                            <span className="font-normal text-[var(--on-surface-subtle)]">
                              (mandatory if returning to Costing)
                            </span>
                          </label>
                          <textarea
                            id="costing-review-notes"
                            rows={3}
                            disabled={isSaving}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="State verification notes or describe required adjustments..."
                            className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)]"
                          />
                          <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                            <button
                              type="button"
                              disabled={isSaving || !notes.trim()}
                              onClick={() => void save("return")}
                              className="px-4 py-2 rounded-xl border border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            >
                              {isSaving ? "Saving..." : "Return to Costing Desk"}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void save("approve")}
                              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSaving ? "Saving..." : "Approve & Close Costing"}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: UNIVERSAL ACTIVITY CHATTER FEED ── */}
          <UniversalChatterFeed
            title="Audit & Activity Log"
            events={costingChatterEvents}
            currentUser={user}
            className="w-80 lg:w-96"
          />
        </div>
      </section>
    </div>,
    document.body
  );
};

export default CostingWorkflowInspectorModal;
