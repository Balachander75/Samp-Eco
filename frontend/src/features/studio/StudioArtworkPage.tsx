import React, { useMemo, useState } from "react";
import {
  Scissors,
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
  Activity,
  Layers3,
} from "lucide-react";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { DielineItem } from "./types";

export interface StudioArtworkPageProps {
  samplingRequests?: SampleRequestItem[];
  dielines?: DielineItem[];
  selectedYear: string;
  selectedPlant: string;
  mode?: "all" | "mockup" | "sampling";
  isLoading?: boolean;
  readOnly?: boolean;
  onInspectRequest?: (req: SampleRequestItem) => void;
  onInspectDieline?: (dieline: DielineItem) => void;
  onExportCSV?: () => void;
  onRefresh?: () => Promise<void>;
}

export const StudioArtworkPage: React.FC<StudioArtworkPageProps> = ({
  samplingRequests = [],
  selectedYear,
  selectedPlant,
  isLoading = false,
  readOnly = false,
  onInspectRequest,
  onInspectDieline,
  onExportCSV,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<"all" | "pending" | "submitted">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Filter requests based on target plant prop
  const baseRequests = useMemo(() => {
    if (selectedPlant === "ALL" || !selectedPlant) return samplingRequests;
    return samplingRequests.filter((r) =>
      (r.targetPlant || "").toLowerCase().includes(selectedPlant.toLowerCase())
    );
  }, [samplingRequests, selectedPlant]);

  // Telemetry counts
  const totalCount = baseRequests.length;

  const pendingCount = useMemo(() => {
    return baseRequests.filter((r) => !r.mockupWorkflowState?.mockupUrl).length;
  }, [baseRequests]);

  const submittedCount = useMemo(() => {
    return baseRequests.filter((r) => Boolean(r.mockupWorkflowState?.mockupUrl)).length;
  }, [baseRequests]);

  // Unique categories
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    baseRequests.forEach((r) => {
      if (r.productCategory?.trim()) set.add(r.productCategory.trim());
    });
    return Array.from(set).sort();
  }, [baseRequests]);

  // Unique customers
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    baseRequests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [baseRequests]);

  // Unique plants
  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    baseRequests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [baseRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return baseRequests.filter((r) => {
      const hasOutput = Boolean(r.mockupWorkflowState?.mockupUrl);

      // KPI filter
      if (selectedKpiFilter === "pending" && hasOutput) return false;
      if (selectedKpiFilter === "submitted" && !hasOutput) return false;

      // Dropdown filters
      if (categoryFilter !== "all" && (r.productCategory || "").trim() !== categoryFilter) return false;
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) return false;
      if (plantFilter !== "all" && (r.targetPlant || "").trim() !== plantFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const outputVal = (r.mockupWorkflowState?.mockupUrl || "").toLowerCase();
        return (
          (r.srNumber || "").toLowerCase().includes(q) ||
          (r.materialCode || "").toLowerCase().includes(q) ||
          (r.productDescription || "").toLowerCase().includes(q) ||
          (r.customer || "").toLowerCase().includes(q) ||
          (r.targetPlant || "").toLowerCase().includes(q) ||
          (r.productCategory || "").toLowerCase().includes(q) ||
          outputVal.includes(q)
        );
      }

      return true;
    });
  }, [baseRequests, selectedKpiFilter, categoryFilter, customerFilter, plantFilter, searchTerm]);

  // Paginated requests
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setCustomerFilter("all");
    setPlantFilter("all");
    setSelectedKpiFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      categoryFilter !== "all" ||
      customerFilter !== "all" ||
      plantFilter !== "all" ||
      selectedKpiFilter !== "all"
  );

  const handleRefreshClick = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportCSVClick = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `studio_sampling_deliverables_${dateStr}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.id },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        { header: "Material Code", accessor: (r) => r.materialCode },
        { header: "Plant", accessor: (r) => r.targetPlant },
        { header: "Due Date", accessor: (r) => r.sampleRequiredDate },
        {
          header: "Studio CAD Output (Link / Path)",
          accessor: (r) => r.mockupWorkflowState?.mockupUrl || "Awaiting Link/Path",
        },
        { header: "Status", accessor: (r) => r.status },
      ],
      data: filteredRequests,
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowClick = (req: SampleRequestItem) => {
    if (onInspectRequest) {
      onInspectRequest(req);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                <Scissors className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                Studio Sampling &amp; CAD Deliverables
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {totalCount} Deliverables
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  <Activity className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span>{pendingCount} Awaiting Link/Path</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              Inspect technical product dockets and provide CAD dieline or sampling output link or network file path to Marketing.
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
            {onRefresh && (
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
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Strip (3 Cards) ── */}
      <section
        aria-label="Studio sampling KPI summary"
        className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 py-3 sm:px-8 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]/50"
      >
        {/* Card 1: All Deliverables */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedKpiFilter("all");
            setCurrentPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedKpiFilter("all");
              setCurrentPage(1);
            }
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            selectedKpiFilter === "all"
              ? "bg-indigo-500/10 border-indigo-500/40 shadow-xs"
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
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Awaiting Link / Path */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedKpiFilter("pending");
            setCurrentPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedKpiFilter("pending");
              setCurrentPage(1);
            }
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            selectedKpiFilter === "pending"
              ? "bg-amber-500/10 border-amber-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Awaiting Link / Path
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-amber-700 dark:text-amber-400 mt-0.5">
              {pendingCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 dark:text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Output Submitted */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setSelectedKpiFilter("submitted");
            setCurrentPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedKpiFilter("submitted");
              setCurrentPage(1);
            }
          }}
          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
            selectedKpiFilter === "submitted"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs"
              : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          }`}
        >
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Output Submitted
            </span>
            <div className="text-xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-0.5">
              {submittedCount}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* ── 3. Single Row Filter Toolbar (h-8) ── */}
      <section
        aria-label="Deliverable filter toolbar"
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
            placeholder="Search SR, product, customer, link/path..."
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

        {/* Status / KPI Dropdown */}
        <select
          value={selectedKpiFilter}
          aria-label="Filter deliverables by status"
          onChange={(e) => {
            setSelectedKpiFilter(e.target.value as "all" | "pending" | "submitted");
            setCurrentPage(1);
          }}
          className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] hover:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] outline-none cursor-pointer"
        >
          <option value="all">Status: All Deliverables</option>
          <option value="pending">Status: Awaiting Link / Path</option>
          <option value="submitted">Status: Output Submitted</option>
        </select>

        {/* Category Dropdown */}
        {uniqueCategories.length > 0 && (
          <select
            value={categoryFilter}
            aria-label="Filter deliverables by category"
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] hover:bg-[var(--surface-lowest)] focus:border-[var(--accent-primary)] outline-none cursor-pointer max-w-[170px] truncate"
          >
            <option value="all">Category: All</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

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

        {/* Reset Filter Button */}
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
              <th className="py-3 pl-6 pr-3 w-10">
                <input
                  type="checkbox"
                  aria-label="Select all deliverables"
                  checked={
                    paginatedRequests.length > 0 &&
                    selectedIds.size === paginatedRequests.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 font-semibold whitespace-nowrap">SR Code / Date</th>
              <th className="py-3 px-4 font-semibold">Product Description &amp; Category</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer / Brand</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Target Plant</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Required SLA Date</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Studio Output (Link / File Path)</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Workflow Status</th>
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
                    icon={Scissors}
                    title="No Sampling Deliverables Found"
                    description={
                      hasActiveFilters
                        ? "No sampling deliverables match your active filter."
                        : "There are currently no sampling deliverables assigned to Studio."
                    }
                    onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
                    resetLabel="Reset filters"
                  />
                </td>
              </tr>
            ) : (
              paginatedRequests.map((r) => {
                const isSelected = selectedIds.has(r.id);
                const state = r.mockupWorkflowState;
                const outputUrl = state?.mockupUrl;
                const isPending = !outputUrl;
                const isSubmitted = Boolean(outputUrl);

                const categoryHierarchy = [
                  r.productCategory,
                  r.productSubCategory,
                  r.productThirdCategory,
                ]
                  .filter(Boolean)
                  .join(" / ");

                const isWebUrl =
                  outputUrl && (outputUrl.startsWith("http://") || outputUrl.startsWith("https://"));

                return (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r)}
                    className={`hover:bg-[var(--surface-low)] transition-colors cursor-pointer group ${
                      isSelected ? "bg-indigo-500/5 dark:bg-indigo-900/10" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 pl-6 pr-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select deliverable ${r.srNumber || r.id}`}
                        checked={isSelected}
                        onChange={() => toggleSelectRow(r.id)}
                        className="rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
                      />
                    </td>

                    {/* SR Code / Date */}
                    <td className="py-3.5 px-3 font-mono font-bold whitespace-nowrap">
                      <CopyBadge text={r.srNumber || `SR-${r.id}`} />
                      <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                        Intake: {r.dateRequestCreated ? formatOdooDate(r.dateRequestCreated) : "—"}
                      </div>
                    </td>

                    {/* Product Description & Category */}
                    <td className="py-3.5 px-4 max-w-sm">
                      <div
                        className="font-semibold text-xs text-[var(--on-surface)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                        title={r.productDescription || (r as any).opportunityName || "Sampling Deliverable"}
                      >
                        {r.productDescription || (r as any).opportunityName || "Sampling Deliverable"}
                      </div>
                      <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 truncate">
                        {categoryHierarchy || r.materialCode || "Cartonboard Packaging"}
                      </div>
                    </td>

                    {/* Customer / Brand */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
                        <span className="truncate max-w-[160px]" title={r.customer || ""}>
                          {r.customer || "—"}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
                        {r.brandName || "Commercial Account"}
                      </div>
                    </td>

                    {/* Plant */}
                    <td className="py-3.5 px-4 font-mono text-xs text-[var(--on-surface-muted)] whitespace-nowrap">
                      {r.targetPlant || "Khaniwade"}
                    </td>

                    {/* Required SLA Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--on-surface-muted)]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                        <span>
                          {r.sampleRequiredDate
                            ? formatOdooDate(r.sampleRequiredDate)
                            : "Standard SLA"}
                        </span>
                      </div>
                    </td>

                    {/* Studio Output (Link / File Path) */}
                    <td className="py-3.5 px-4 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      {outputUrl ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate max-w-[200px]"
                            title={outputUrl}
                          >
                            {outputUrl}
                          </span>
                          <CopyBadge text={outputUrl} label="" />
                          {isWebUrl && (
                            <a
                              href={outputUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded hover:bg-[var(--surface-container)] text-indigo-600 dark:text-indigo-400 transition"
                              title="Open Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Awaiting Link / Path</span>
                        </span>
                      )}
                    </td>

                    {/* Workflow Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusPill
                        status={
                          isSubmitted
                            ? "Output Submitted"
                            : isPending
                            ? "CAD Action"
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
                      {isPending && !readOnly ? (
                        <button
                          type="button"
                          onClick={() => handleRowClick(r)}
                          className="inline-flex select-none items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold font-mono transition cursor-pointer shadow-2xs active:scale-98"
                          title="Provide Output Link or File Path"
                        >
                          <span>Provide Link / Path</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRowClick(r)}
                          className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                          title="Inspect Docket Details"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3 text-[var(--on-surface-subtle)]" />
                        </button>
                      )}
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
    </div>
  );
};

export default StudioArtworkPage;
