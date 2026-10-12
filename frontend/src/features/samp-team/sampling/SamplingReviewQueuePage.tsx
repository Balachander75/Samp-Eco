import React, { useState, useMemo } from "react";
import {
  PackageCheck,
  Send,
  MessageSquare,
  Search,
  RefreshCw,
  Download,
  X,
  ChevronRight,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  ExternalLink,
  Factory,
  Beaker,
  FileText,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import type { SampleRequestItem, ProductSearchResult } from "@/features/sample-requests/types";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { releaseSampleToPlantApi, submitSamplingFeedbackApi } from "@/infrastructure/api/sampleRequestsApi";
import { CatalogProductInspectModal } from "@/features/sample-requests/components/staging/CatalogProductInspectModal";

export interface SamplingReviewQueuePageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  uniquePlants: string[];
  uniqueCustomers: string[];
  readOnly?: boolean;
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export type SamplingPhaseFilter = "all" | "ready_to_release" | "design_feedback" | "released";

export const SamplingReviewQueuePage: React.FC<SamplingReviewQueuePageProps> = ({
  requests,
  isLoading,
  selectedYear,
  selectedPlant,
  uniquePlants,
  uniqueCustomers,
  readOnly = false,
  onRefresh,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<SamplingPhaseFilter>("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Modals state
  const [releaseModalItem, setReleaseModalItem] = useState<SampleRequestItem | null>(null);
  const [releasePlant, setReleasePlant] = useState("Khaniwade");
  const [releaseRemark, setReleaseRemark] = useState("");
  const [isReleasing, setIsReleasing] = useState(false);

  const [feedbackModalItem, setFeedbackModalItem] = useState<SampleRequestItem | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [inspectModalItem, setInspectModalItem] = useState<SampleRequestItem | null>(null);

  // Filter requests that represent samples or designs reviewed by Sampling Team
  const samplingDeliverables = useMemo(() => {
    return requests.filter((r) => {
      const types = r.requestTypes || [];
      const isSample = types.includes("sample");
      const isMockup = types.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
      const isDesign = types.includes("design");
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();

      // Exclude pure program planning and feasibility records here as they have dedicated views
      if (kind === "program" || mode === "program_planning" || kind === "feasibility" || mode === "feasibility_check") {
        return false;
      }

      return isSample || isMockup || isDesign || true;
    });
  }, [requests]);

  // Base list filtered by selectedPlant prop if set
  const baseRequests = useMemo(() => {
    if (selectedPlant === "ALL" || !selectedPlant) return samplingDeliverables;
    return samplingDeliverables.filter((r) =>
      (r.targetPlant || "").toLowerCase().includes(selectedPlant.toLowerCase())
    );
  }, [samplingDeliverables, selectedPlant]);

  // Status classifier helper
  const getItemPhase = (r: SampleRequestItem): "ready_to_release" | "design_feedback" | "released" | "in_progress" => {
    const status = String(r.status || "").toLowerCase();
    const state = r.mockupWorkflowState;
    const hasStudioOutput = Boolean(state?.mockupUrl);
    const isReleased = status.includes("released to plant") || Boolean(state?.plantReleasedAt);

    if (isReleased) return "released";

    // Creative & Studio done -> Ready for plant release
    const creativeDone = state?.stage === "marketing" || state?.stage === "studio" || !state?.designNeeded;
    if (hasStudioOutput && creativeDone) {
      return "ready_to_release";
    }

    // Design requested by marketing -> Sampling has view rights to give feedback
    const hasDesign = (r.requestTypes || []).includes("design") || state?.designNeeded === true;
    if (hasDesign) {
      return "design_feedback";
    }

    return "in_progress";
  };

  // Telemetry counts
  const totalCount = baseRequests.length;

  const readyToReleaseCount = useMemo(() => {
    return baseRequests.filter((r) => getItemPhase(r) === "ready_to_release").length;
  }, [baseRequests]);

  const designFeedbackCount = useMemo(() => {
    return baseRequests.filter((r) => getItemPhase(r) === "design_feedback").length;
  }, [baseRequests]);

  const releasedCount = useMemo(() => {
    return baseRequests.filter((r) => getItemPhase(r) === "released").length;
  }, [baseRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return baseRequests.filter((r) => {
      const phase = getItemPhase(r);

      // Phase filter
      if (phaseFilter === "ready_to_release" && phase !== "ready_to_release") return false;
      if (phaseFilter === "design_feedback" && phase !== "design_feedback") return false;
      if (phaseFilter === "released" && phase !== "released") return false;

      // Dropdown filters
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) return false;
      if (plantFilter !== "all" && (r.targetPlant || "").trim() !== plantFilter) return false;

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const outputVal = (r.mockupWorkflowState?.mockupUrl || "").toLowerCase();
        const feedbackVal = (r.mockupWorkflowState?.samplingFeedback || r.samplingRemark || "").toLowerCase();
        return (
          (r.srNumber || "").toLowerCase().includes(q) ||
          (r.materialCode || "").toLowerCase().includes(q) ||
          (r.productDescription || "").toLowerCase().includes(q) ||
          (r.customer || "").toLowerCase().includes(q) ||
          (r.targetPlant || "").toLowerCase().includes(q) ||
          (r.productCategory || "").toLowerCase().includes(q) ||
          outputVal.includes(q) ||
          feedbackVal.includes(q)
        );
      }

      return true;
    });
  }, [baseRequests, phaseFilter, customerFilter, plantFilter, searchTerm]);

  // Paginated items
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const handleResetFilters = () => {
    setSearchTerm("");
    setPhaseFilter("all");
    setCustomerFilter("all");
    setPlantFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      phaseFilter !== "all" ||
      customerFilter !== "all" ||
      plantFilter !== "all"
  );

  const handleRefreshClick = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
      showToast("Sampling review queue refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSVClick = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `sampling_review_queue_${dateStr}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.id },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        { header: "Target Plant", accessor: (r) => r.targetPlant },
        { header: "Due Date", accessor: (r) => r.sampleRequiredDate },
        { header: "Studio CAD Link", accessor: (r) => r.mockupWorkflowState?.mockupUrl || "Pending" },
        { header: "Sampling Feedback", accessor: (r) => r.mockupWorkflowState?.samplingFeedback || r.samplingRemark || "—" },
        { header: "Phase", accessor: (r) => getItemPhase(r) },
        { header: "Status", accessor: (r) => r.status },
      ],
      data: filteredRequests,
    });
  };

  // Open release to plant modal
  const handleOpenReleaseModal = (req: SampleRequestItem) => {
    setReleaseModalItem(req);
    setReleasePlant(req.targetPlant || "Khaniwade");
    setReleaseRemark(req.samplingRemark || "");
  };

  // Submit release to plant
  const handleSubmitReleaseToPlant = async () => {
    if (!releaseModalItem) return;
    setIsReleasing(true);
    try {
      await releaseSampleToPlantApi(releaseModalItem.id, {
        targetPlant: releasePlant,
        samplingRemark: releaseRemark,
      });
      showToast(`Sample ${releaseModalItem.srNumber || releaseModalItem.id} released to ${releasePlant}!`);
      setReleaseModalItem(null);
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to release sample to plant");
    } finally {
      setIsReleasing(false);
    }
  };

  // Open feedback modal
  const handleOpenFeedbackModal = (req: SampleRequestItem) => {
    setFeedbackModalItem(req);
    setFeedbackText(req.mockupWorkflowState?.samplingFeedback || req.samplingRemark || "");
  };

  // Submit sampling feedback
  const handleSubmitFeedback = async () => {
    if (!feedbackModalItem || !feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      await submitSamplingFeedbackApi(feedbackModalItem.id, feedbackText.trim());
      showToast("Sampling feedback saved successfully!");
      setFeedbackModalItem(null);
      await onRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to record sampling feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Prepare product for inspector modal
  const inspectProduct = useMemo<ProductSearchResult | null>(() => {
    if (!inspectModalItem) return null;
    const id = Number(inspectModalItem.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return {
      id,
      sr_number: inspectModalItem.srNumber,
      material_code: inspectModalItem.materialCode,
      product_description: inspectModalItem.productDescription,
      customer: inspectModalItem.customer,
      target_plant: inspectModalItem.targetPlant,
      product_category: inspectModalItem.productCategory,
      product_sub_category: inspectModalItem.productSubCategory,
      product_third_category: inspectModalItem.productThirdCategory,
    };
  }, [inspectModalItem]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                <Beaker className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                Sampling Review &amp; Plant Dispatch Queue
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {totalCount} Deliverables
              </span>
              {readyToReleaseCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                  <PackageCheck className="w-3 h-3 text-emerald-500" />
                  <span>{readyToReleaseCount} Ready for Plant Release</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              Inspect marketing designs, review creative artwork &amp; studio CAD links, provide technical remarks, and release approved samples to the manufacturing plant.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCSVClick}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors shadow-2xs cursor-pointer"
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing || isLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Refresh Deliverables"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Strip (4 Cards) ── */}
      <section
        aria-label="Sampling review KPI overview"
        className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 sm:px-8 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]/50"
      >
        {/* Card 1: All Deliverables */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setPhaseFilter("all");
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            phaseFilter === "all"
              ? "bg-teal-500/10 border-teal-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
              All Sampling Deliverables
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-[var(--on-surface)] mt-0.5">
              {totalCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-700 dark:text-teal-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Ready for Plant Release */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setPhaseFilter("ready_to_release");
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            phaseFilter === "ready_to_release"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Ready to Release to Plant
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-0.5">
              {readyToReleaseCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Design Review & Feedback */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setPhaseFilter("design_feedback");
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            phaseFilter === "design_feedback"
              ? "bg-indigo-500/10 border-indigo-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              Design Review &amp; Feedback
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-indigo-700 dark:text-indigo-400 mt-0.5">
              {designFeedbackCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
            <Eye className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Released to Plant */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setPhaseFilter("released");
            setCurrentPage(1);
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            phaseFilter === "released"
              ? "bg-sky-500/10 border-sky-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Released to Plant
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-sky-700 dark:text-sky-400 mt-0.5">
              {releasedCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-700 dark:text-sky-400">
            <Factory className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* ── 3. Single Row Filter Toolbar (h-8) ── */}
      <section
        aria-label="Filter toolbar"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-2 sm:px-8 flex flex-wrap items-center gap-2 text-xs"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-subtle)] pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search SR, product, customer, remark..."
            className="w-full h-8 pl-8 pr-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-lowest)] focus:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] outline-none transition"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Phase Filter Dropdown */}
        <select
          value={phaseFilter}
          aria-label="Filter deliverables by review phase"
          onChange={(e) => {
            setPhaseFilter(e.target.value as SamplingPhaseFilter);
            setCurrentPage(1);
          }}
          className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] hover:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] outline-none cursor-pointer"
        >
          <option value="all">Phase: All Deliverables</option>
          <option value="ready_to_release">Phase: Ready to Release to Plant</option>
          <option value="design_feedback">Phase: Design Review &amp; Feedback</option>
          <option value="released">Phase: Released to Plant</option>
        </select>

        {/* Customer Dropdown */}
        {uniqueCustomers.length > 0 && (
          <select
            value={customerFilter}
            aria-label="Filter deliverables by customer"
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] hover:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] outline-none cursor-pointer max-w-[170px] truncate"
          >
            <option value="all">Customer: All</option>
            {uniqueCustomers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {/* Plant Dropdown */}
        {uniquePlants.length > 1 && (
          <select
            value={plantFilter}
            aria-label="Filter deliverables by plant"
            onChange={(e) => {
              setPlantFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] hover:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] outline-none cursor-pointer"
          >
            <option value="all">Plant: All Plants</option>
            {uniquePlants.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-8 px-2.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            title="Reset All Filters"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </section>

      {/* ── 4. High-Density Full-Bleed Table ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-lowest)]">
        <table className="w-full border-collapse text-left text-xs text-[var(--on-surface)] font-normal">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/90 backdrop-blur-md text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)]">
            <tr>
              <th className="py-3 px-3 font-semibold whitespace-nowrap pl-6">SR Code / Date</th>
              <th className="py-3 px-4 font-semibold">Product Description &amp; Hierarchy</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer / Brand</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Creative Status</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Studio CAD Deliverable</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Target Plant</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Sampling Remarks / Feedback</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Review Stage</th>
              <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <TableSkeletonRows rows={8} columns={9} />
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <EmptyState
                    icon={Beaker}
                    title="No Sampling Deliverables Found"
                    description={
                      hasActiveFilters
                        ? "No deliverables match your active filter."
                        : "There are currently no items waiting in the Sampling Review queue."
                    }
                    onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
                    resetLabel="Reset filters"
                  />
                </td>
              </tr>
            ) : (
              paginatedRequests.map((r) => {
                const phase = getItemPhase(r);
                const state = r.mockupWorkflowState;
                const studioOutput = state?.mockupUrl;
                const isWebUrl = studioOutput && (studioOutput.startsWith("http://") || studioOutput.startsWith("https://"));
                const feedback = state?.samplingFeedback || r.samplingRemark;

                const categoryHierarchy = [
                  r.productCategory,
                  r.productSubCategory,
                  r.productThirdCategory,
                ]
                  .filter(Boolean)
                  .join(" / ");

                return (
                  <tr
                    key={r.id}
                    onClick={() => setInspectModalItem(r)}
                    className="hover:bg-[var(--surface-low)] transition-colors cursor-pointer group"
                  >
                    {/* SR Code / Date */}
                    <td className="py-3.5 pl-6 pr-3 font-mono font-bold whitespace-nowrap">
                      <CopyBadge text={r.srNumber || `SR-${r.id}`} />
                      <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                        Intake: {r.dateRequestCreated ? formatOdooDate(r.dateRequestCreated) : "—"}
                      </div>
                    </td>

                    {/* Product Description */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <div
                        className="font-semibold text-xs text-[var(--on-surface)] truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors"
                        title={r.productDescription || (r as any).opportunityName || "Packaging Deliverable"}
                      >
                        {r.productDescription || (r as any).opportunityName || "Packaging Deliverable"}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 truncate">
                        {categoryHierarchy || r.materialCode || "Cartonboard Packaging"}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
                        <span className="truncate max-w-[150px]" title={r.customer || ""}>
                          {r.customer || "—"}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
                        {r.brandName || "Commercial"}
                      </div>
                    </td>

                    {/* Creative Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                      {state?.designNeeded === false ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                          Direct to Studio
                        </span>
                      ) : state?.stage === "marketing" || state?.stage === "studio" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Creative Done</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                          <Eye className="w-2.5 h-2.5" />
                          <span>Design In Review</span>
                        </span>
                      )}
                    </td>

                    {/* Studio Output */}
                    <td className="py-3.5 px-4 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {studioOutput ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate max-w-[180px]"
                            title={studioOutput}
                          >
                            {studioOutput}
                          </span>
                          <CopyBadge text={studioOutput} label="" />
                          {isWebUrl && (
                            <a
                              href={studioOutput}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-[var(--surface-container)] text-indigo-600 dark:text-indigo-400 transition"
                              title="Open Output"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> Awaiting CAD
                        </span>
                      )}
                    </td>

                    {/* Plant */}
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--on-surface-muted)] whitespace-nowrap">
                      {r.targetPlant || "Khaniwade"}
                    </td>

                    {/* Sampling Remarks / Feedback */}
                    <td className="py-3.5 px-4 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {feedback ? (
                        <div className="truncate text-xs font-medium text-slate-700 dark:text-zinc-300" title={feedback}>
                          {feedback}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* Review Stage */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusPill
                        status={
                          phase === "ready_to_release"
                            ? "Ready for Plant"
                            : phase === "released"
                            ? "Released to Plant"
                            : phase === "design_feedback"
                            ? "Design Review"
                            : r.status || "In Review"
                        }
                        size="sm"
                        showDot
                      />
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {phase === "ready_to_release" && !readOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenReleaseModal(r)}
                            className="inline-flex select-none items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold font-mono transition cursor-pointer shadow-2xs active:scale-98"
                            title="Release sample to manufacturing plant"
                          >
                            <Send className="w-3 h-3" />
                            <span>Release to Plant</span>
                          </button>
                        )}

                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleOpenFeedbackModal(r)}
                            className="inline-flex select-none items-center gap-1 rounded-lg border border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 px-2.5 py-1.5 text-[11px] font-semibold transition cursor-pointer"
                            title="Provide technical feedback"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Feedback</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setInspectModalItem(r)}
                          className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                          title="Inspect Docket Details"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3 text-[var(--on-surface-subtle)]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 5. Enterprise Pagination Footer ── */}
      <PaginationBar
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={filteredRequests.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />

      {/* ── Modal: Release to Plant ── */}
      {releaseModalItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Factory className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Release Sample to Manufacturing Plant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReleaseModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/50 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-500">SR Code:</span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    {releaseModalItem.srNumber || `SR-${releaseModalItem.id}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Product:</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[280px]">
                    {releaseModalItem.productDescription}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200">
                    {releaseModalItem.customer || "—"}
                  </span>
                </div>
                {releaseModalItem.mockupWorkflowState?.mockupUrl && (
                  <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-200/50 dark:border-zinc-700">
                    <span className="text-slate-500">CAD Output:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 truncate max-w-[280px]">
                      {releaseModalItem.mockupWorkflowState.mockupUrl}
                    </span>
                  </div>
                )}
              </div>

              {/* Plant selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Target Manufacturing Plant
                </label>
                <select
                  value={releasePlant}
                  onChange={(e) => setReleasePlant(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200 outline-none focus:border-emerald-500"
                >
                  <option value="Khaniwade">Khaniwade Plant (1505)</option>
                  <option value="Daman">Daman Plant (1501)</option>
                  <option value="Silvassa">Silvassa Plant (1502)</option>
                  <option value="Bhiwandi">Bhiwandi Plant (1503)</option>
                  <option value="Valsad">Valsad Plant (1504)</option>
                </select>
              </div>

              {/* Manufacturing Instructions / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Plant Instructions &amp; Sampling Remarks (Optional)
                </label>
                <textarea
                  value={releaseRemark}
                  onChange={(e) => setReleaseRemark(e.target.value)}
                  rows={3}
                  placeholder="e.g. Ensure 350 GSM CyberX substrate, verify crease score with structural CAD before die punch..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-emerald-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setReleaseModalItem(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReleaseToPlant}
                disabled={isReleasing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-mono transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isReleasing ? "Releasing to Plant…" : "Confirm & Dispatch to Plant"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Sampling Feedback ── */}
      {feedbackModalItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                  <MessageSquare className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Sampling Technical Feedback &amp; Remarks
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/60 dark:border-zinc-700/50 text-xs font-mono space-y-1">
                <div>
                  <span className="text-slate-500">SR Code: </span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100">
                    {feedbackModalItem.srNumber || `SR-${feedbackModalItem.id}`}
                  </span>
                </div>
                <div className="font-sans text-slate-700 dark:text-zinc-300">
                  {feedbackModalItem.productDescription}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Sampling Technical Remarks / Feasibility Notes
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                  placeholder="Enter your technical review feedback regarding fabrication, caliper, spine width, or finishing feasibility..."
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-slate-800 dark:text-zinc-200 outline-none focus:border-teal-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setFeedbackModalItem(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback || !feedbackText.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold font-mono transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmittingFeedback ? "Saving…" : "Save Feedback"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Full Product Docket Inspection ── */}
      {inspectProduct && (
        <CatalogProductInspectModal
          product={inspectProduct}
          onClose={() => setInspectModalItem(null)}
          heading="Product Docket Technical Review"
          intro="Review the complete product category, characteristics, classes and specifications before sampling release."
          footer={
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">
                Target Plant: {inspectModalItem?.targetPlant || "Khaniwade"}
              </span>
              <button
                type="button"
                onClick={() => setInspectModalItem(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 font-semibold"
              >
                Close
              </button>
            </div>
          }
        />
      )}
    </div>
  );
};

export default SamplingReviewQueuePage;
