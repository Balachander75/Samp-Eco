import React, { useMemo, useState } from "react";
import {
  Scissors,
  ChevronRight,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Activity,
} from "lucide-react";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
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

  // Main filtered dataset
  const filteredRequests = useMemo(() => {
    return baseRequests.filter((r) => {
      // 1. KPI Filter
      const hasOutput = Boolean(r.mockupWorkflowState?.mockupUrl);
      if (selectedKpiFilter === "pending" && hasOutput) return false;
      if (selectedKpiFilter === "submitted" && !hasOutput) return false;

      // 2. Category
      if (categoryFilter !== "all" && r.productCategory !== categoryFilter) {
        return false;
      }

      // 3. Customer
      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      // 4. Plant
      if (plantFilter !== "all" && r.targetPlant !== plantFilter) {
        return false;
      }

      // 5. Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesSr = (r.srNumber || "").toLowerCase().includes(query);
        const matchesDesc = (r.productDescription || "").toLowerCase().includes(query);
        const matchesCust = (r.customer || "").toLowerCase().includes(query);
        const matchesCode = (r.materialCode || "").toLowerCase().includes(query);
        const matchesUrl = (r.mockupWorkflowState?.mockupUrl || "").toLowerCase().includes(query);
        if (!matchesSr && !matchesDesc && !matchesCust && !matchesCode && !matchesUrl) {
          return false;
        }
      }

      return true;
    });
  }, [
    baseRequests,
    selectedKpiFilter,
    categoryFilter,
    customerFilter,
    plantFilter,
    searchTerm,
  ]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setCustomerFilter("all");
    setPlantFilter("all");
    setSelectedKpiFilter("all");
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
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
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

  const kpiItems = [
    {
      label: "All Deliverables",
      value: totalCount,
      detail: "Technical CAD & prototypes",
      color: "bg-indigo-500",
      isActive: selectedKpiFilter === "all",
      onClick: () => setSelectedKpiFilter("all"),
    },
    {
      label: "Awaiting Link / Path",
      value: pendingCount,
      detail: "Pending deliverable link",
      color: "bg-amber-500",
      isActive: selectedKpiFilter === "pending",
      onClick: () => setSelectedKpiFilter("pending"),
    },
    {
      label: "Output Submitted",
      value: submittedCount,
      detail: "CAD & sampling published",
      color: "bg-emerald-500",
      isActive: selectedKpiFilter === "submitted",
      onClick: () => setSelectedKpiFilter("submitted"),
    },
  ];

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "sr_number",
        header: "SR Code / Date",
        width: "w-[150px]",
        sortable: true,
        cell: (r) => (
          <div>
            <CopyBadge text={r.srNumber || `SR-${r.id}`} />
            <div className="mt-0.5 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
              {r.dateRequestCreated ? formatOdooDate(r.dateRequestCreated) : "—"}
            </div>
          </div>
        ),
      },
      {
        id: "product",
        header: "Product Description & Category",
        cell: (r) => {
          const categoryHierarchy = [
            r.productCategory,
            r.productSubCategory,
            r.productThirdCategory,
          ]
            .filter(Boolean)
            .join(" / ");
          return (
            <div className="max-w-xs">
              <div
                className="font-semibold text-xs text-[var(--on-surface)] truncate"
                title={r.productDescription || (r as any).opportunityName || "Sampling Deliverable"}
              >
                {r.productDescription || (r as any).opportunityName || "Sampling Deliverable"}
              </div>
              <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 truncate">
                {categoryHierarchy || r.materialCode || "Cartonboard Packaging"}
              </div>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: "Customer / Brand",
        width: "w-[160px]",
        cell: (r) => (
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--on-surface)]">
              <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
              <span className="truncate max-w-[140px]" title={r.customer || ""}>
                {r.customer || "—"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
              {r.brandName || "Commercial Account"}
            </div>
          </div>
        ),
      },
      {
        id: "plant",
        header: "Target Plant",
        width: "w-[110px]",
        cell: (r) => (
          <span className="font-mono text-xs text-[var(--on-surface-muted)]">
            {r.targetPlant || "Khaniwade"}
          </span>
        ),
      },
      {
        id: "sla",
        header: "Required SLA Date",
        width: "w-[130px]",
        cell: (r) => (
          <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--on-surface-muted)]">
            <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
            <span>{r.sampleRequiredDate ? formatOdooDate(r.sampleRequiredDate) : "Standard SLA"}</span>
          </div>
        ),
      },
      {
        id: "output",
        header: "Studio Output (Link / File Path)",
        cell: (r) => {
          const outputUrl = r.mockupWorkflowState?.mockupUrl;
          const isWebUrl =
            outputUrl && (outputUrl.startsWith("http://") || outputUrl.startsWith("https://"));
          if (!outputUrl) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                <span>Awaiting Link / Path</span>
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1.5 max-w-xs" onClick={(e) => e.stopPropagation()}>
              <span
                className="font-mono text-xs font-semibold text-[var(--accent-primary)] truncate max-w-[180px]"
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
                  className="p-1 rounded hover:bg-[var(--surface-container)] text-[var(--accent-primary)] transition"
                  title="Open Link"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Workflow Status",
        width: "w-[130px]",
        cell: (r) => {
          const outputUrl = r.mockupWorkflowState?.mockupUrl;
          return outputUrl ? (
            <StatusPill status="Submitted" tone="success" size="xs" />
          ) : (
            <StatusPill status="In Review" tone="warning" size="xs" />
          );
        },
      },
      {
        id: "actions",
        header: "Action",
        align: "right",
        width: "w-[100px]",
        cell: (r) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onInspectRequest?.(r)}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ),
      },
    ],
    [onInspectRequest]
  );

  return (
    <DeskWorkspaceLayout
      title="Studio Sampling & CAD Deliverables"
      businessYear={selectedYear === "ALL" ? "Consolidated" : selectedYear}
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
            onChange={(e) => setSelectedKpiFilter(e.target.value as "all" | "pending" | "submitted")}
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
              onChange={(e) => setCategoryFilter(e.target.value)}
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
              onChange={(e) => setCustomerFilter(e.target.value)}
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
              onChange={(e) => setPlantFilter(e.target.value)}
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
        onChange: setSearchTerm,
        placeholder: "Search SR, product, customer, link/path...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Clear Filters"
    >
      <DataTable
        data={filteredRequests}
        columns={columns}
        keyExtractor={(req) => req.id}
        isLoading={isLoading}
        emptyMessage={
          hasActiveFilters
            ? "No sampling deliverables match your active filter."
            : "There are currently no sampling deliverables assigned to Studio."
        }
        onRowClick={onInspectRequest}
        enableSelection={true}
        selectedIds={selectedIds}
        onToggleSelectRow={toggleSelectRow}
        onToggleSelectAll={toggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {totalCount}
              </span>{" "}
              deliverables
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default StudioArtworkPage;
