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
import { PaginationBar, DeskWorkspaceLayout } from "@/components/erp";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { Select } from "@/components/ui/Select";
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

  const kpiItems = [
    {
      label: "All Sampling Deliverables",
      value: totalCount,
      detail: "Technical CAD & prototypes",
      color: "bg-indigo-500",
      isActive: selectedKpiFilter === "all",
      onClick: () => {
        setSelectedKpiFilter("all");
        setCurrentPage(1);
      },
    },
    {
      label: "Awaiting Link / Path",
      value: pendingCount,
      detail: "Pending deliverable link",
      color: "bg-amber-500",
      isActive: selectedKpiFilter === "pending",
      onClick: () => {
        setSelectedKpiFilter("pending");
        setCurrentPage(1);
      },
    },
    {
      label: "Output Submitted",
      value: submittedCount,
      detail: "CAD & sampling published",
      color: "bg-emerald-500",
      isActive: selectedKpiFilter === "submitted",
      onClick: () => {
        setSelectedKpiFilter("submitted");
        setCurrentPage(1);
      },
    },
  ];

  return (
    <DeskWorkspaceLayout
      title="Studio Sampling & CAD Deliverables"
      subtitle="Inspect technical product dockets and provide CAD dieline or sampling output link or network file path to Marketing."
      businessYear={selectedYear === "ALL" ? "Consolidated" : selectedYear}
      totalCount={totalCount}
      totalLabel="Deliverables"
      extraBadges={
        pendingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
            <Activity className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>{pendingCount} Awaiting Link/Path</span>
          </span>
        ) : null
      }
      onRefresh={handleRefreshClick}
      isRefreshing={isRefreshing || isLoading}
      onExportCSV={handleExportCSVClick}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-1 sm:grid-cols-3"
      filterControls={
        <>
          <Select
            aria-label="Filter deliverables by status"
            value={selectedKpiFilter}
            onChange={(e) => {
              setSelectedKpiFilter(e.target.value as "all" | "pending" | "submitted");
              setCurrentPage(1);
            }}
            className="min-w-[150px] max-w-[190px]"
            options={[
              { value: "all", label: "Status: All Deliverables" },
              { value: "pending", label: "Status: Awaiting Link / Path" },
              { value: "submitted", label: "Status: Output Submitted" },
            ]}
          />

          {uniqueCategories.length > 0 && (
            <Select
              aria-label="Filter deliverables by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `Category: All (${uniqueCategories.length})` },
                ...uniqueCategories.map((cat) => ({ value: cat, label: cat })),
              ]}
            />
          )}

          {uniqueCustomers.length > 0 && (
            <Select
              aria-label="Filter deliverables by customer"
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `Customer: All (${uniqueCustomers.length})` },
                ...uniqueCustomers.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {uniquePlants.length > 1 && (
            <Select
              aria-label="Filter deliverables by plant"
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[130px] max-w-[160px]"
              options={[
                { value: "all", label: "Plant: All Plants" },
                ...uniquePlants.map((p) => ({ value: p, label: `Plant ${p}` })),
              ]}
            />
          )}
        </>
      }
      search={{
        value: searchTerm,
        onChange: (val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        },
        placeholder: "Search SR, product, customer, link/path...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Reset"
    >

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
    </DeskWorkspaceLayout>
  );
};

export default StudioArtworkPage;
