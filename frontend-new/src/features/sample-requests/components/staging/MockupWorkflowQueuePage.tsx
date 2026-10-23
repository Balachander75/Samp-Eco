import React, { useMemo, useState } from "react";
import {
  ChevronRight,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { SampleRequestItem } from "../../types";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { Select } from "@/components/ui/Select";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { getRequestRequiredDate } from "@/features/sample-requests/sampling/utils/requestTypeUtils";

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
  isLoading,
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

      // Category filter
      if (categoryFilter !== "all" && r.productCategory !== categoryFilter) {
        return false;
      }

      // Customer filter
      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      // Plant filter
      if (plantFilter !== "all" && r.targetPlant !== plantFilter) {
        return false;
      }

      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesSr = (r.requestCodes?.mockup || r.requestCode || r.srNumber || "").toLowerCase().includes(query);
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
  }, [requests, selectedKpiFilter, categoryFilter, customerFilter, plantFilter, searchTerm]);

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
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `mockup_workflow_queue_${dateStr}.csv`,
      columns: [
        { header: "Mockup Code", accessor: (r) => r.requestCodes?.mockup || r.requestCode || r.srNumber || r.id },
        { header: "Product Description", accessor: (r) => r.productDescription },
        { header: "Customer / Brand", accessor: (r) => r.customer },
        { header: "Material Code", accessor: (r) => r.materialCode },
        { header: "Plant", accessor: (r) => r.targetPlant },
        { header: "Due Date", accessor: (r) => getRequestRequiredDate(r, "mockup") },
        {
          header: "Studio Mockup Output (Link / Path)",
          accessor: (r) => r.mockupWorkflowState?.mockupUrl || "Awaiting Output",
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
      label: "All Mockup Deliverables",
      value: totalCount,
      detail: "Total Studio mockup outputs",
      color: "bg-indigo-500",
      isActive: selectedKpiFilter === "all",
      onClick: () => setSelectedKpiFilter("all"),
    },
    {
      label: "Awaiting Link / Path",
      value: pendingCount,
      detail: "Action required by Studio",
      color: "bg-amber-500",
      isActive: selectedKpiFilter === "pending",
      onClick: () => setSelectedKpiFilter("pending"),
    },
    {
      label: "Output Submitted",
      value: submittedCount,
      detail: "Delivered to Marketing",
      color: "bg-emerald-500",
      isActive: selectedKpiFilter === "submitted",
      onClick: () => setSelectedKpiFilter("submitted"),
    },
  ];

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "sr_number",
        header: "Mockup Code / Date",
        width: "w-[150px]",
        sortable: true,
        cell: (r) => (
          <div>
            <CopyBadge text={r.requestCodes?.mockup || r.requestCode || r.srNumber || `MR-${r.id}`} />
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
                title={r.productDescription || "Studio Mockup"}
              >
                {r.productDescription || "Studio Mockup"}
              </div>
              <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 truncate">
                {categoryHierarchy || r.materialCode || "Packaging"}
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
        cell: (r) => {
          const requiredDate = getRequestRequiredDate(r, "mockup");
          return (
            <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--on-surface-muted)]">
              <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
              <span>{requiredDate ? formatOdooDate(requiredDate) : "Standard SLA"}</span>
            </div>
          );
        },
      },
      {
        id: "output",
        header: "Studio Output (Link / Path)",
        cell: (r) => {
          const outputUrl = r.mockupWorkflowState?.mockupUrl;
          const isWebUrl =
            outputUrl && (outputUrl.startsWith("http://") || outputUrl.startsWith("https://"));
          if (!outputUrl) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-600  font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                <span>Awaiting Output</span>
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
              onClick={() => onInspect(r)}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ),
      },
    ],
    [onInspect]
  );

  return (
    <DeskWorkspaceLayout
      title="Studio Mockup Deliverables"
      businessYear={selectedYear}
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
            ? "No mockup deliverables match your active filter."
            : "There are currently no mockup deliverables assigned."
        }
        onRowClick={onInspect}
        enableSelection={true}
        selectedIds={selectedIds}
        onToggleSelectRow={toggleSelectRow}
        onToggleSelectAll={toggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 ">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 ">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 ">
                {totalCount}
              </span>{" "}
              mockups
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-indigo-300  bg-indigo-50  px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-indigo-700  font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default MockupWorkflowQueuePage;
