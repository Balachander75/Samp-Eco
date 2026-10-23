import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Box,
  Sparkles,
  Layers,
  Building2,
  FlaskConical,
  Activity,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { Select } from "@/components/ui/Select";
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
  readOnly: _readOnly = false,
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

  const now = useMemo(() => new Date(), []);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter requests that have sample or mockup scopes (excluding pure programs)
  const samplingMockupItems = useMemo(() => {
    return requests.filter((r) => {
      const srCode = String(r.requestCodes?.mockup || r.requestCode || r.srNumber || "").toUpperCase();
      const materialCode = String(r.materialCode || "").toUpperCase();
      if (
        r.requestKind === "program" ||
        r.creationMode === "program_planning" ||
        String(r.requestCode || "").toUpperCase().startsWith("PP-") ||
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
        return hasMockup && (!r.mockupWorkflowState || ["creative", "creative_approval"].includes(r.mockupWorkflowState.stage));
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
        hasMockup && (!r.mockupWorkflowState || ["creative", "creative_approval"].includes(r.mockupWorkflowState.stage));

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
          (r.requestCodes?.mockup || r.requestCode || r.srNumber || "").toLowerCase().includes(q) ||
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
        { header: "Mockup Code", accessor: (r) => r.requestCodes?.mockup || r.requestCode || r.srNumber || r.id },
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

  const kpiItems = [
    {
      label: "All Active",
      value: isLoading ? "—" : totalCombined,
      detail: "Active deliverables queue",
      color: "bg-[#245942]",
      isActive: selectedStageTab === "all",
      onClick: () => {
        setSelectedStageTab("all");
        setCurrentPage(1);
      },
    },
    {
      label: "Needs Studio Brief",
      value: isLoading ? "—" : awaitingHandoffCount,
      detail: "Awaiting CAD intake",
      color: "bg-amber-500",
      isActive: selectedStageTab === "awaiting_handoff",
      onClick: () => {
        setSelectedStageTab("awaiting_handoff");
        setCurrentPage(1);
      },
    },
    {
      label: "CAD Mockups",
      value: isLoading ? "—" : mockupCount,
      detail: "3D render pipeline",
      color: "bg-teal-500",
      isActive: selectedStageTab === "mockup_only",
      onClick: () => {
        setSelectedStageTab("mockup_only");
        setCurrentPage(1);
      },
    },
    {
      label: "Plant Samples",
      value: isLoading ? "—" : sampleCount,
      detail: "Physical fabrication",
      color: "bg-purple-500",
      isActive: selectedStageTab === "sample_only",
      onClick: () => {
        setSelectedStageTab("sample_only");
        setCurrentPage(1);
      },
    },
    {
      label: "Dual Scope",
      value: isLoading ? "—" : bothCount,
      detail: "Sample + CAD packages",
      color: "bg-emerald-500",
      isActive: selectedStageTab === "both",
      onClick: () => {
        setSelectedStageTab("both");
        setCurrentPage(1);
      },
    },
  ];

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "sr_number",
        header: "Mockup Code",
        width: "w-[150px]",
        sortable: true,
        cell: (r) => (
          <div>
            <CopyBadge text={r.requestCodes?.mockup || r.requestCode || r.srNumber || `MR-${r.id}`} />
            <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
              Raised {r.dateRequestCreated ? formatOdooDate(r.dateRequestCreated) : "—"}
            </div>
          </div>
        ),
      },
      {
        id: "product",
        header: "Deliverable & Category",
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
                title={r.productDescription || (r as any).opportunityName || "Deliverable"}
              >
                {r.productDescription || (r as any).opportunityName || "Deliverable"}
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
        width: "w-[130px]",
        cell: (r) => (
          <div className="min-w-0 max-w-[130px]">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)] truncate">
              <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
              <span className="truncate" title={r.customer || ""}>
                {r.customer || "—"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5 truncate">
              {r.brandName || "Commercial Account"}
            </div>
          </div>
        ),
      },
      {
        id: "program",
        header: "Program / Year",
        width: "w-[120px]",
        cell: (r) => {
          const progName = r.programName || r.programCampaignTitle || (r as any).program_name || "—";
          const progYear = r.programYear || (r as any).program_year;
          return (
            <div className="min-w-0 max-w-[120px]">
              <span className="block truncate font-semibold text-xs text-[var(--on-surface)]" title={progName}>
                {progName}
              </span>
              {progYear && (
                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                  BY {progYear}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "scopes",
        header: "Deliverable Scopes",
        width: "w-[120px]",
        cell: (r) => {
          const scopes = r.requestTypes || [];
          const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
          const hasSample = scopes.includes("sample");
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {hasMockup && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/10 text-teal-700 border border-teal-500/20">
                  <Box className="w-2.5 h-2.5" />
                  CAD
                </span>
              )}
              {hasSample && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-700 border border-sky-500/20">
                  <FlaskConical className="w-2.5 h-2.5" />
                  Sample
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "qty",
        header: "Mockup / Qty",
        width: "w-[95px]",
        align: "center",
        cell: (r) => {
          const scopes = r.requestTypes || [];
          const hasMockup = scopes.includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes";
          const qty = Number((r as any).quantity || r.qtyForSampling || 1);
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[var(--surface-low)] text-[var(--on-surface)] tabular-nums border border-[var(--border-subtle)]">
              {hasMockup ? "CAD + " : ""}
              {qty} units
            </span>
          );
        },
      },
      {
        id: "plant",
        header: "Plant",
        width: "w-[90px]",
        cell: (r) => (
          <span className="font-mono text-xs text-[var(--on-surface-muted)] truncate block" title={r.targetPlant || "Khaniwade"}>
            {r.targetPlant || "Khaniwade"}
          </span>
        ),
      },
      {
        id: "sla",
        header: "Target SLA Date",
        width: "w-[115px]",
        cell: (r) => {
          let isOverdue = false;
          if (
            r.sampleRequiredDate &&
            !["approved", "delivered", "completed", "cancelled"].includes(
              String(r.status || "").toLowerCase()
            )
          ) {
            const dt = new Date(r.sampleRequiredDate);
            if (!isNaN(dt.getTime()) && dt < now) {
              isOverdue = true;
            }
          }
          return (
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1 font-mono text-xs text-[var(--on-surface)] truncate">
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isOverdue ? "text-rose-500" : "text-[var(--on-surface-subtle)]"
                  }`}
                />
                <span
                  className={
                    isOverdue
                      ? "font-semibold text-rose-600"
                      : "text-[var(--on-surface-muted)]"
                  }
                >
                  {r.sampleRequiredDate ? formatOdooDate(r.sampleRequiredDate) : "Standard SLA"}
                </span>
              </div>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  <span>Overdue</span>
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Workflow Status",
        width: "w-[110px]",
        cell: (r) => <StatusPill status={r.status || "Creative"} size="sm" showDot />,
      },
    ],
    [now]
  );

  return (
    <DeskWorkspaceLayout
      title="Sampling & CAD Mockup Deliverables"
      businessYear={selectedYear === "ALL" ? "Consolidated" : selectedYear}
      totalCount={samplingMockupItems.length}
      extraBadges={
        mockupCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 shrink-0">
            <Activity className="w-3 h-3 text-teal-500 animate-pulse" />
            <span>{mockupCount} CAD Simulations</span>
          </span>
        ) : null
      }
      onRefresh={handleRefreshClick}
      isRefreshing={isLoading || isRefreshing}
      onExportCSV={handleExportClick}
      exportDisabled={filteredItems.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
      extraFilterControls={
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
      }
      filterControls={
        <>
          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[140px] max-w-[170px]"
              options={[
                { value: "all", label: `All Plants (${plantList.length})` },
                ...plantList.map((p) => ({ value: p, label: p })),
              ]}
            />
          )}

          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `All Brands (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {categoryList.length > 0 && (
            <Select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `All Categories (${categoryList.length})` },
                ...categoryList.map((cat) => ({ value: cat, label: cat })),
              ]}
            />
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] text-[11px] underline px-1 cursor-pointer font-mono"
              >
                Clear ({selectedIds.size})
              </button>
            </div>
          )}
        </>
      }
      search={{
        value: searchTerm,
        onChange: (val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        },
        placeholder: "Search SR#, product, customer...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Reset Filters"
    >

      <DataTable
        data={filteredItems}
        columns={columns}
        tableClassName="w-full table-fixed min-w-0"
        containerClassName="overflow-y-auto overflow-x-hidden"
        keyExtractor={(req) => req.id}
        isLoading={isLoading || isRefreshing}
        emptyMessage={
          hasActiveFilters
            ? "No sample or mockup requests match your search criteria or active filter."
            : "There are currently no sampling or CAD mockup requests in the queue."
        }
        onRowClick={onInspectRequest}
        enableSelection={true}
        selectedIds={selectedIds}
        onToggleSelectRow={(id) => handleToggleSelectRow(id)}
        onToggleSelectAll={handleToggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredItems.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {samplingMockupItems.length}
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

export default CreativeSamplingMockupPage;
