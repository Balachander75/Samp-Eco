import React, { useMemo, useState } from "react";
import {
  Box,
  Search,
  RefreshCw,
  Download,
  X,
  ChevronRight,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Clock,
  Activity,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { SampleRequestItem } from "../../types";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";

export interface MockupWorkflowQueuePageProps {
  requests: SampleRequestItem[];
  role: "creative" | "studio";
  isLoading: boolean;
  readOnly?: boolean;
  onInspect: (request: SampleRequestItem) => void;
  onRefresh?: () => Promise<void>;
}

export const MockupWorkflowQueuePage: React.FC<MockupWorkflowQueuePageProps> = ({
  requests,
  role,
  isLoading,
  readOnly = false,
  onInspect,
  onRefresh,
}) => {
  const { selectedYear } = useBusinessYear();
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

  // Telemetry counts
  const totalCount = requests.length;

  const pendingCount = useMemo(() => {
    return requests.filter((r) => !r.mockupWorkflowState?.mockupUrl).length;
  }, [requests]);

  const submittedCount = useMemo(() => {
    return requests.filter((r) => Boolean(r.mockupWorkflowState?.mockupUrl)).length;
  }, [requests]);

  // Unique dropdown items
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.productCategory?.trim()) set.add(r.productCategory.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const uniquePlants = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const hasOutput = Boolean(r.mockupWorkflowState?.mockupUrl);

      // KPI filter
      if (selectedKpiFilter === "pending" && hasOutput) return false;
      if (selectedKpiFilter === "submitted" && !hasOutput) return false;

      // Dropdown filters
      if (categoryFilter !== "all" && (r.productCategory || "").trim() !== categoryFilter) return false;
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) return false;
      if (plantFilter !== "all" && (r.targetPlant || "").trim() !== plantFilter) return false;

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          (r.srNumber || "").toLowerCase().includes(q) ||
          (r.materialCode || "").toLowerCase().includes(q) ||
          (r.productDescription || "").toLowerCase().includes(q) ||
          (r.customer || "").toLowerCase().includes(q) ||
          (r.targetPlant || "").toLowerCase().includes(q) ||
          (r.productCategory || "").toLowerCase().includes(q) ||
          (r.productSubCategory || "").toLowerCase().includes(q) ||
          (r.mockupWorkflowState?.mockupUrl || "").toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [requests, selectedKpiFilter, categoryFilter, customerFilter, plantFilter, searchTerm]);

  // Paginated requests
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  // Selection handlers
  const handleToggleSelectRow = (id: string | number, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map((r) => r.id)));
    }
  };

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
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `studio_mockup_queue_${dateStr}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.id },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        {
          header: "Category",
          accessor: (r) =>
            [r.productCategory, r.productSubCategory, r.productThirdCategory]
              .filter(Boolean)
              .join(" / "),
        },
        { header: "Material Code", accessor: (r) => r.materialCode },
        { header: "Plant", accessor: (r) => r.targetPlant },
        {
          header: "Due Date",
          accessor: (r) =>
            role === "creative"
              ? r.targetArtworkDateCreative || r.sampleRequiredDate
              : r.targetArtworkDateStudio || r.sampleRequiredDate,
        },
        {
          header: "Studio Output (Link / File Path)",
          accessor: (r) => r.mockupWorkflowState?.mockupUrl || "Pending Output",
        },
        { header: "Workflow Stage", accessor: (r) => r.mockupWorkflowState?.stage || "Studio" },
      ],
      data: filteredRequests,
    });
  };

  const title = role === "creative" ? "Mockup Requests · Creative Review" : "Studio CAD 3D Mockup Queue";
  const subtitle =
    role === "creative"
      ? "Review the product category and saved specifications, then dispatch the brief to Studio."
      : "Review technical docket specifications, generate 3D CAD renders, and deliver the mockup link or file path to Marketing.";

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                <Box className="w-3.5 h-3.5" />
              </span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                {title}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {totalCount} Total Mockups
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  <Activity className="w-3 h-3 text-amber-500 animate-pulse" />
                  <span>{pendingCount} Awaiting Output Link/Path</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              {subtitle}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isLoading || isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isLoading || isRefreshing
                    ? "animate-spin text-[var(--accent-primary)]"
                    : "text-[var(--on-surface-subtle)]"
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSVClick}
              disabled={filteredRequests.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Export Filtered CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Workflow Strip ── */}
      <section
        aria-label="Mockup queue summary"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {/* Card 1: All Mockups */}
          <button
            type="button"
            onClick={() => {
              setSelectedKpiFilter("all");
              setCurrentPage(1);
            }}
            className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
              selectedKpiFilter === "all"
                ? "border-indigo-500 bg-[var(--surface-lowest)] ring-2 ring-indigo-500/20"
                : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-low)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                <span className="truncate">All Mockup Deliverables</span>
              </div>
              <Box className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-display font-bold tabular-nums text-[var(--on-surface)]">
                {isLoading ? "—" : totalCount}
              </span>
              <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                Total CAD deliverables
              </span>
            </div>
          </button>

          {/* Card 2: Awaiting Output (Need Link / Path) */}
          <button
            type="button"
            onClick={() => {
              setSelectedKpiFilter("pending");
              setCurrentPage(1);
            }}
            className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
              selectedKpiFilter === "pending"
                ? "border-amber-500 bg-[var(--surface-lowest)] ring-2 ring-amber-500/20"
                : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-low)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse" />
                <span className="truncate">Awaiting Link / Path</span>
              </div>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-display font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {isLoading ? "—" : pendingCount}
              </span>
              <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                Action required by Studio
              </span>
            </div>
          </button>

          {/* Card 3: Output Submitted */}
          <button
            type="button"
            onClick={() => {
              setSelectedKpiFilter("submitted");
              setCurrentPage(1);
            }}
            className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
              selectedKpiFilter === "submitted"
                ? "border-emerald-500 bg-[var(--surface-lowest)] ring-2 ring-emerald-500/20"
                : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-low)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate">Output Submitted</span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-lg font-display font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {isLoading ? "—" : submittedCount}
              </span>
              <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                Delivered to Marketing
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* ── 3. Compact Filter Controls (Single h-8 Row) ── */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-2 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-52 sm:w-64 group">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-subtle)] group-focus-within:text-[var(--accent-primary)] transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search SR#, product, customer, link..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 pl-8 pr-7 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] shadow-2xs transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            {uniqueCategories.length > 0 && (
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[160px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Product Category"
              >
                <option value="all">All Categories ({uniqueCategories.length})</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            {uniqueCustomers.length > 0 && (
              <select
                aria-label="Filter by customer"
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[160px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Customer / Brand"
              >
                <option value="all">All Brands ({uniqueCustomers.length})</option>
                {uniqueCustomers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Plant Filter */}
            {uniquePlants.length > 0 && (
              <select
                aria-label="Filter by plant"
                value={plantFilter}
                onChange={(e) => {
                  setPlantFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[150px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Target Manufacturing Plant"
              >
                <option value="all">All Plants ({uniquePlants.length})</option>
                {uniquePlants.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Batch Controls & Reset Button */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 mr-1">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] text-[11px] underline px-1 cursor-pointer font-mono"
                >
                  Clear ({selectedIds.size})
                </button>
              </div>
            )}

            {/* Clear All Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-xs text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Reset all search and dropdown filters"
              >
                <X className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Main Workspace: Full-Bleed High-Density Table ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col text-[var(--on-surface)]">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
              <tr className="text-[var(--on-surface-muted)] font-mono text-[11px] uppercase tracking-wider select-none">
                <th className="py-3 pl-6 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      paginatedRequests.length > 0 &&
                      paginatedRequests.every((r) => selectedIds.has(r.id))
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded accent-[var(--accent-primary)] cursor-pointer"
                    aria-label="Select all mockup requests"
                  />
                </th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">SR Code</th>
                <th className="py-3 px-4 font-semibold">Deliverable &amp; Category</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer / Brand</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Material Code</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Target Plant</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Required SLA Date</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Studio Output (Link / File Path)</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Workflow Status</th>
                <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isLoading || isRefreshing ? (
                <TableSkeletonRows rows={8} columns={10} />
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <EmptyState
                      icon={Box}
                      title="No Mockup Requests Found"
                      description={
                        hasActiveFilters
                          ? "No mockup requests match your search criteria or active filter."
                          : role === "creative"
                          ? "Marketing mockup requests will appear here after release."
                          : "Creative handoffs will appear here once dispatched to Studio."
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

                  const categoryHierarchy = [
                    r.productCategory,
                    r.productSubCategory,
                    r.productThirdCategory,
                  ]
                    .filter(Boolean)
                    .join(" / ");

                  const requiredDate =
                    role === "creative"
                      ? r.targetArtworkDateCreative || r.sampleRequiredDate
                      : r.targetArtworkDateStudio || r.sampleRequiredDate;

                  const isWebUrl = outputUrl && (outputUrl.startsWith("http://") || outputUrl.startsWith("https://"));

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onInspect(r)}
                      className={`hover:bg-[var(--surface-low)] transition-colors cursor-pointer group ${
                        isSelected ? "bg-[var(--accent-primary-subtle)]" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 pl-6 pr-3 w-8"
                        onClick={(e) => handleToggleSelectRow(r.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded accent-[var(--accent-primary)] cursor-pointer"
                          aria-label={`Select request ${r.srNumber || r.id}`}
                        />
                      </td>

                      {/* SR Code */}
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <CopyBadge text={r.srNumber || `SR-${r.id}`} />
                        <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                          Raised {r.dateRequestCreated ? formatOdooDate(r.dateRequestCreated) : "—"}
                        </div>
                      </td>

                      {/* Deliverable Description & Hierarchy */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div
                          className="font-semibold text-xs text-[var(--on-surface)] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                          title={r.productDescription || (r as any).opportunityName || "3D Mockup Simulation"}
                        >
                          {r.productDescription || (r as any).opportunityName || "3D Mockup Simulation"}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] flex items-center gap-1.5 mt-1">
                          <span className="truncate" title={categoryHierarchy || ""}>
                            {categoryHierarchy || "Cartonboard Packaging"}
                          </span>
                        </div>
                      </td>

                      {/* Customer / Brand */}
                      <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
                          <span className="truncate max-w-[180px]" title={r.customer || ""}>
                            {r.customer || "—"}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
                          {r.brandName || "Commercial Account"}
                        </div>
                      </td>

                      {/* Material Code */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--on-surface-muted)] whitespace-nowrap">
                        {r.materialCode ? (
                          <CopyBadge text={r.materialCode} />
                        ) : (
                          <span className="text-[var(--on-surface-subtle)]">—</span>
                        )}
                      </td>

                      {/* Plant */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--on-surface-muted)] whitespace-nowrap">
                        {r.targetPlant || "Khaniwade"}
                      </td>

                      {/* Required SLA Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--on-surface-muted)]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                          <span>{requiredDate ? formatOdooDate(requiredDate) : "Standard SLA"}</span>
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
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Awaiting Link / Path</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">—</span>
                        )}
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusPill
                          status={
                            outputUrl
                              ? "Mockup Submitted"
                              : state?.stage === "studio"
                              ? "Studio CAD"
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
                            onClick={() => onInspect(r)}
                            className="inline-flex select-none items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold font-mono transition cursor-pointer shadow-2xs active:scale-98"
                            title="Provide Output Link or File Path"
                          >
                            <span>Provide Link / Path</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onInspect(r)}
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

        {/* Table Footer with Pagination */}
        <div className="mt-auto px-6 py-2.5 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] text-[var(--on-surface-subtle)] flex items-center justify-between text-xs font-mono shrink-0">
          <span>
            Showing {filteredRequests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            {filteredRequests.length > 0 && (
              <> – {Math.min(filteredRequests.length, currentPage * pageSize)}</>
            )}{" "}
            of {filteredRequests.length} deliverables
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-[var(--on-surface-subtle)]">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Sorted by Latest Intake
            </span>
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredRequests.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              itemLabel="deliverables"
              className="border-t-0 p-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockupWorkflowQueuePage;
