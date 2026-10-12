import React, { useState, useMemo } from "react";
import {
  Box,
  Search,
  RefreshCw,
  Download,
  X,
  ChevronRight,
  Sparkles,
  Layers,
  Building2,
  Palette,
  FlaskConical,
  Clock,
  ArrowRight,
  Activity,
  Calendar,
} from "lucide-react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { getBusinessYearForDate } from "@/lib/businessYear";

export interface CreativeSamplingMockupPageProps {
  requests: SampleRequestItem[];
  selectedYear: string;
  selectedPlant: string;
  isLoading?: boolean;
  readOnly?: boolean;
  onInspectRequest: (req: SampleRequestItem) => void;
  onExportCSV?: () => void;
  onRefresh?: () => Promise<void>;
}

export type CreativeSamplingTab =
  | "all"
  | "awaiting_handoff"
  | "mockup_only"
  | "sample_only"
  | "both";

export const CreativeSamplingMockupPage: React.FC<CreativeSamplingMockupPageProps> = ({
  requests,
  selectedYear,
  selectedPlant,
  isLoading = false,
  readOnly = false,
  onInspectRequest,
  onExportCSV,
  onRefresh,
}) => {
  const [selectedStageTab, setSelectedStageTab] = useState<CreativeSamplingTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<"all" | "mockup" | "sample" | "both">("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Filter requests that have sample or mockup scopes (excluding pure programs)
  const samplingMockupItems = useMemo(() => {
    return requests.filter((r) => {
      const srCode = String(r.srNumber || "").toUpperCase();
      const materialCode = String(r.materialCode || "").toUpperCase();
      if (
        r.requestKind === "program" ||
        r.creationMode === "program_planning" ||
        srCode.includes("-PG-") ||
        srCode.startsWith("PG-") ||
        materialCode.startsWith("PG-")
      ) {
        return false;
      }
      const scopes = r.requestTypes || [];
      const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
      const hasSample = scopes.includes("sample");
      return hasMockup || hasSample;
    });
  }, [requests]);

  // Telemetry metrics for KPI Ribbon
  const totalCombined = samplingMockupItems.length;
  const awaitingHandoffCount = useMemo(
    () =>
      samplingMockupItems.filter((r) => {
        const scopes = r.requestTypes || [];
        const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
        return hasMockup && (!r.mockupWorkflowState || r.mockupWorkflowState.stage === "creative");
      }).length,
    [samplingMockupItems]
  );
  const mockupCount = useMemo(
    () =>
      samplingMockupItems.filter(
        (r) => (r.requestTypes || []).includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes"
      ).length,
    [samplingMockupItems]
  );
  const sampleCount = useMemo(
    () => samplingMockupItems.filter((r) => (r.requestTypes || []).includes("sample")).length,
    [samplingMockupItems]
  );
  const bothCount = useMemo(
    () =>
      samplingMockupItems.filter((r) => {
        const scopes = r.requestTypes || [];
        return (
          (scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes") &&
          scopes.includes("sample")
        );
      }).length,
    [samplingMockupItems]
  );

  // Scope counts for Scope filter pills
  const typeCounts = useMemo(() => {
    return {
      all: totalCombined,
      mockup: mockupCount,
      sample: sampleCount,
      both: bothCount,
    };
  }, [totalCombined, mockupCount, sampleCount, bothCount]);

  // Unique dropdown lists
  const customerList = useMemo(() => {
    const set = new Set<string>();
    samplingMockupItems.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [samplingMockupItems]);

  const plantList = useMemo(() => {
    const set = new Set<string>();
    samplingMockupItems.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [samplingMockupItems]);

  const categoryList = useMemo(() => {
    const set = new Set<string>();
    samplingMockupItems.forEach((r) => {
      if (r.productCategory?.trim()) set.add(r.productCategory.trim());
    });
    return Array.from(set).sort();
  }, [samplingMockupItems]);

  // Filtered deliverables
  const filteredItems = useMemo(() => {
    return samplingMockupItems.filter((r) => {
      const scopes = r.requestTypes || [];
      const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
      const hasSample = scopes.includes("sample");
      const isAwaitingHandoff =
        hasMockup && (!r.mockupWorkflowState || r.mockupWorkflowState.stage === "creative");

      // Stage Tab filter
      if (selectedStageTab === "awaiting_handoff" && !isAwaitingHandoff) return false;
      if (selectedStageTab === "mockup_only" && !hasMockup) return false;
      if (selectedStageTab === "sample_only" && !hasSample) return false;
      if (selectedStageTab === "both" && !(hasMockup && hasSample)) return false;

      // Scope Pill filter
      if (selectedScopeFilter === "mockup" && !hasMockup) return false;
      if (selectedScopeFilter === "sample" && !hasSample) return false;
      if (selectedScopeFilter === "both" && !(hasMockup && hasSample)) return false;

      // Year prop filter
      if (selectedYear !== "ALL") {
        const itemYear = r.year || (r.dateRequestCreated ? getBusinessYearForDate(r.dateRequestCreated) : "");
        if (itemYear && itemYear !== selectedYear) return false;
      }

      // Plant prop filter
      if (selectedPlant !== "ALL" && selectedPlant !== "") {
        const p = (r.targetPlant || "").toLowerCase();
        if (!p.includes(selectedPlant.toLowerCase())) return false;
      }

      // Dropdown Plant filter
      if (plantFilter !== "all" && (r.targetPlant || "").trim() !== plantFilter) {
        return false;
      }

      // Dropdown Customer filter
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) {
        return false;
      }

      // Dropdown Category filter
      if (categoryFilter !== "all" && (r.productCategory || "").trim() !== categoryFilter) {
        return false;
      }

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
          (r.productThirdCategory || "").toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    samplingMockupItems,
    selectedStageTab,
    selectedScopeFilter,
    selectedYear,
    selectedPlant,
    plantFilter,
    customerFilter,
    categoryFilter,
    searchTerm,
  ]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));

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
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map((r) => r.id)));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedScopeFilter("all");
    setCustomerFilter("all");
    setPlantFilter("all");
    setCategoryFilter("all");
    setSelectedStageTab("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedScopeFilter !== "all" ||
      customerFilter !== "all" ||
      plantFilter !== "all" ||
      categoryFilter !== "all" ||
      selectedStageTab !== "all"
  );

  const handleExportClick = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `sampling_mockup_queue_${dateStr}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.id },
        { header: "Sample Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        {
          header: "Product Category",
          accessor: (r) =>
            [r.productCategory, r.productSubCategory, r.productThirdCategory]
              .filter(Boolean)
              .join(" / "),
        },
        { header: "Scopes", accessor: (r) => (r.requestTypes || []).join("+") },
        { header: "Mockup Required", accessor: (r) => r.mockupRequired || "No" },
        {
          header: "Quantity",
          accessor: (r) => (r as any).quantity || r.qtyForSampling || 1,
        },
        { header: "Plant", accessor: (r) => r.targetPlant },
        { header: "Due Date", accessor: (r) => r.sampleRequiredDate },
        { header: "Status", accessor: (r) => r.status },
      ],
      data: filteredItems,
    });
  };

  const handleRefreshClick = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header (Maximized Space for Deliverables) ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                Sampling &amp; CAD Mockup Deliverables
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {samplingMockupItems.length} Total
              </span>
              {mockupCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
                  <Activity className="w-3 h-3 text-teal-500 animate-pulse" />
                  <span>{mockupCount} CAD Simulations</span>
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              Physical prototypes, 3D CAD simulations, structural mockups, and plant fabrication handoffs.
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
              onClick={handleExportClick}
              disabled={filteredItems.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Export Filtered CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Workflow Strip (Direct Queue Filters) ── */}
      <section
        aria-label="Sampling & mockup workflow summary"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "All Active",
              value: totalCombined,
              detail: "Active deliverables queue",
              color: "bg-[var(--accent-primary)]",
              filter: "all" as const,
            },
            {
              label: "Needs Studio Brief",
              value: awaitingHandoffCount,
              detail: "Awaiting CAD intake",
              color: "bg-amber-500",
              filter: "awaiting_handoff" as const,
            },
            {
              label: "CAD Mockups",
              value: mockupCount,
              detail: "3D render pipeline",
              color: "bg-teal-500",
              filter: "mockup_only" as const,
            },
            {
              label: "Plant Samples",
              value: sampleCount,
              detail: "Physical fabrication",
              color: "bg-purple-500",
              filter: "sample_only" as const,
            },
            {
              label: "Dual Scope",
              value: bothCount,
              detail: "Sample + CAD packages",
              color: "bg-emerald-500",
              filter: "both" as const,
            },
          ].map((item) => {
            const isSelected = selectedStageTab === item.filter;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setSelectedStageTab(item.filter);
                  setCurrentPage(1);
                }}
                className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
                  isSelected
                    ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20"
                    : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-low)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-display font-bold tabular-nums text-[var(--on-surface)]">
                    {isLoading ? "—" : item.value}
                  </span>
                  <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                    {item.detail}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Compact Filter Controls (Single h-8 Row) ── */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-2 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search and relevant filters */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-52 sm:w-64 group">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-subtle)] group-focus-within:text-[var(--accent-primary)] transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search SR#, product, customer..."
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

            {/* Scope Filter Tabs */}
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5">
              {[
                { id: "all" as const, label: "All Scopes", icon: Layers, count: typeCounts.all },
                { id: "mockup" as const, label: "CAD Mockups", icon: Box, count: typeCounts.mockup },
                { id: "sample" as const, label: "Plant Samples", icon: FlaskConical, count: typeCounts.sample },
                { id: "both" as const, label: "Dual Scope", icon: Sparkles, count: typeCounts.both },
              ].map((item) => {
                const isSelected = selectedScopeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedScopeFilter(item.id);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer select-none ${
                      isSelected
                        ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold"
                        : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                          : "text-[var(--on-surface-subtle)]"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Plant Filter */}
            {plantList.length > 0 && (
              <select
                aria-label="Filter by plant"
                value={plantFilter}
                onChange={(e) => {
                  setPlantFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[160px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Target Manufacturing Plant"
              >
                <option value="all">All Plants ({plantList.length})</option>
                {plantList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            {customerList.length > 0 && (
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
                <option value="all">All Brands ({customerList.length})</option>
                {customerList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Category Filter */}
            {categoryList.length > 0 && (
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
                <option value="all">All Categories ({categoryList.length})</option>
                {categoryList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
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

      {/* ── 4. Main Workspace: Full-Bleed High-Density Table (Exact Marketing Sampling Standard) ── */}
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col text-[var(--on-surface)]">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
              <tr className="text-[var(--on-surface-muted)] font-mono text-[11px] uppercase tracking-wider select-none">
                <th className="py-3 pl-6 pr-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      paginatedItems.length > 0 &&
                      paginatedItems.every((r) => selectedIds.has(r.id))
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded accent-[var(--accent-primary)] cursor-pointer"
                    aria-label="Select all deliverables"
                  />
                </th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">SR Code</th>
                <th className="py-3 px-4 font-semibold">Deliverable &amp; Category</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer / Brand</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Deliverable Scopes</th>
                <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Mockup / Qty</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Plant</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Target SLA Date</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Workflow Status</th>
                <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isLoading || isRefreshing ? (
                <TableSkeletonRows rows={8} columns={10} />
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <EmptyState
                      icon={Box}
                      title="No Sampling Deliverables Found"
                      description={
                        hasActiveFilters
                          ? "No sample or mockup requests match your search criteria or active filter."
                          : "There are currently no sampling or CAD mockup requests in the queue."
                      }
                      onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
                      resetLabel="Reset filters"
                    />
                  </td>
                </tr>
              ) : (
                paginatedItems.map((r) => {
                  const scopes = r.requestTypes || [];
                  const hasMockup =
                    scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
                  const hasSample = scopes.includes("sample");
                  const hasDesign = scopes.includes("design");
                  const qty = (r as any).quantity || r.qtyForSampling || 1;
                  const isSelected = selectedIds.has(r.id);
                  const isCreativeAwaiting =
                    hasMockup && (!r.mockupWorkflowState || r.mockupWorkflowState.stage === "creative");
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
                      onClick={() => onInspectRequest(r)}
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
                          className="font-semibold text-xs text-[var(--on-surface)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors"
                          title={r.productDescription || (r as any).opportunityName || "Commercial Sample Dummy"}
                        >
                          {r.productDescription || (r as any).opportunityName || "Commercial Sample Dummy"}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] flex items-center gap-1.5 mt-1">
                          <span className="truncate" title={categoryHierarchy || r.materialCode || ""}>
                            {categoryHierarchy || r.materialCode || "Cartonboard Packaging"}
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

                      {/* Scopes */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasDesign && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                              <Palette className="w-2.5 h-2.5 text-purple-600" />
                              <span>Design</span>
                            </span>
                          )}
                          {hasMockup && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                              <Box className="w-2.5 h-2.5 text-teal-600" />
                              <span>Mockup</span>
                            </span>
                          )}
                          {hasSample && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <FlaskConical className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Sample</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Mockup / Quantity Specs */}
                      <td className="py-3.5 px-4 text-center font-mono whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[var(--surface-low)] text-[var(--on-surface)] tabular-nums border border-[var(--border-subtle)]">
                          {hasMockup ? "CAD + " : ""}
                          {qty} units
                        </span>
                      </td>

                      {/* Plant */}
                      <td className="py-3.5 px-4 font-mono text-xs text-[var(--on-surface-muted)] whitespace-nowrap">
                        {r.targetPlant || "Khaniwade"}
                      </td>

                      {/* Target SLA Date */}
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

                      {/* Workflow Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusPill status={r.status || "Creative"} size="sm" showDot />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isCreativeAwaiting && !readOnly ? (
                          <button
                            type="button"
                            onClick={() => onInspectRequest(r)}
                            className="inline-flex select-none items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold font-mono transition cursor-pointer shadow-2xs active:scale-98"
                            title="Claim & Submit CAD Mockup"
                          >
                            <span>Claim &amp; Submit</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onInspectRequest(r)}
                            className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                            title="Inspect Deliverable Details"
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
            Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            {filteredItems.length > 0 && (
              <> – {Math.min(filteredItems.length, currentPage * pageSize)}</>
            )}{" "}
            of {filteredItems.length} deliverables
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-[var(--on-surface-subtle)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              Sorted by Latest Intake
            </span>
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredItems.length}
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

export default CreativeSamplingMockupPage;
