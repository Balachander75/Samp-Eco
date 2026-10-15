import React, { useState, useMemo, useEffect } from "react";
import {
  Palette,
  Plus,
  ChevronRight,
  Package,
  Layers,
  Building2,
  Trash2,
} from "lucide-react";
import { CreativeBriefItem, SampleRequestItem } from "@/features/sample-requests/types";
import { UserProfile } from "@/features/auth";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { Select } from "@/components/ui/Select";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { mergeWithWorkflowState } from "@/features/sample-requests/utils/designWorkflowStorage";

export interface CreativeDesignPageProps {
  briefs: CreativeBriefItem[];
  designRequests: SampleRequestItem[];
  selectedYear: string;
  selectedPlant?: string;
  user?: UserProfile | null;
  isAdmin?: boolean;
  onOpenNewBriefModal?: () => void;
  onInspectBrief: (brief: CreativeBriefItem) => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onUpdateStatus?: (
    id: string,
    newStatus: CreativeBriefItem["proofStatus"],
    notes?: string
  ) => Promise<void>;
  onRefresh?: () => Promise<void>;
  onExportCSV?: () => void;
}

export type CreativeDesignTab =
  | "all"
  | "intake"
  | "concept"
  | "review"
  | "revisions"
  | "approved";

export const CreativeDesignPage: React.FC<CreativeDesignPageProps> = ({
  briefs,
  designRequests,
  selectedYear,
  isAdmin = false,
  onOpenNewBriefModal,
  onInspectBrief,
  onInspectRequest,
  onRefresh,
  onExportCSV,
}) => {
  const [selectedStageTab, setSelectedStageTab] = useState<CreativeDesignTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<"all" | "brief" | "request">("all");
  const [trendFilter, setTrendFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [designerFilter, setDesignerFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workflowVersion, setWorkflowVersion] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  useEffect(() => {
    const handleStorageUpdate = () => {
      setWorkflowVersion((v) => v + 1);
    };
    window.addEventListener("samp:design-workflow-updated", handleStorageUpdate);
    return () => {
      window.removeEventListener("samp:design-workflow-updated", handleStorageUpdate);
    };
  }, []);

  // Merge & normalize unified designs
  const unifiedDesigns = useMemo(() => {
    const list: Array<{
      id: string;
      refCode: string;
      title: string;
      customer: string;
      trend: string;
      targetAudience: string;
      variantsCount: number;
      designer: string;
      dueDate: string;
      createdDate: string;
      proofStatus: CreativeBriefItem["proofStatus"];
      isBrief: boolean;
      rawBrief?: CreativeBriefItem;
      rawReq?: SampleRequestItem;
    }> = [];

    // 1. Briefs
    briefs.forEach((b) => {
      list.push({
        id: b.id,
        refCode: b.artCode,
        title: b.title,
        customer: b.brand,
        trend: (b as any).trend || "General Commercial",
        targetAudience: (b as any).targetAudience || "General Commercial",
        variantsCount: b.variantsCount || 1,
        designer: b.designer || (b as any).assignedTo || (b as any).createdBy || "Unassigned",
        dueDate: b.dueDate || "",
        createdDate: (b as any).createdAt || (b as any).dateRequestCreated || "",
        proofStatus: b.proofStatus,
        isBrief: true,
        rawBrief: b,
      });
    });

    // 2. Design Requests
    designRequests.forEach((d) => {
      const merged = mergeWithWorkflowState(d);
      let status: CreativeBriefItem["proofStatus"] = "Brief Intake";
      const s = String(merged.status || "").toLowerCase();
      const workflowStatus = String(merged.designRequestStatus || merged.status || "").toLowerCase();

      if (s.includes("approved") || s.includes("released") || merged.marketingDesignDecision === "accepted") {
        status = "Prepress Approved";
      } else if (workflowStatus.includes("revisions") || merged.marketingDesignDecision === "remaining_requested") {
        status = "Revisions Requested";
      } else if (s.includes("review") || merged.marketingDesignDecision === "awaiting_marketing_review") {
        status = "Client Review";
      } else if (
        s.includes("creative") ||
        s.includes("counter proposed") ||
        s.includes("target date") ||
        Boolean(merged.isCounterDateActive)
      ) {
        status = "In Concept";
      }

      list.push({
        id: String(merged.id),
        refCode: merged.srNumber || merged.requestCode || `DSG-${merged.id}`,
        title: merged.productDescription || (merged as any).opportunityName || "Packaging Artwork Brief",
        customer: merged.customer || "General Account",
        trend: merged.trend || "Corporate Core",
        targetAudience: merged.targetAudience || "General Commercial",
        variantsCount: Number(merged.designsCustomerCreative || merged.productArtworkNos) || merged.numberOfDesigns || 1,
        designer: merged.claimedBy || merged.createdBy || "Unassigned",
        dueDate:
          merged.isCounterDateActive && merged.proposedTargetDate
            ? merged.proposedTargetDate
            : merged.targetArtworkDateCreative || merged.sampleRequiredDate || merged.designRequiredDate || "",
        createdDate: merged.dateRequestCreated || merged.createdAt || "",
        proofStatus: status,
        isBrief: false,
        rawReq: merged,
      });
    });

    return list;
  }, [briefs, designRequests, workflowVersion]);

  // Telemetry metrics
  const metrics = useMemo(() => {
    const total = unifiedDesigns.length;
    const intake = unifiedDesigns.filter((d) => d.proofStatus === "Brief Intake").length;
    const concept = unifiedDesigns.filter((d) => d.proofStatus === "In Concept").length;
    const review = unifiedDesigns.filter((d) => d.proofStatus === "Client Review").length;
    const revisions = unifiedDesigns.filter((d) => d.proofStatus === "Revisions Requested").length;
    const approved = unifiedDesigns.filter((d) => d.proofStatus === "Prepress Approved").length;

    return { total, intake, concept, review, revisions, approved };
  }, [unifiedDesigns]);

  // Scope counts
  const typeCounts = useMemo(() => {
    return {
      all: unifiedDesigns.length,
      brief: unifiedDesigns.filter((d) => d.isBrief).length,
      request: unifiedDesigns.filter((d) => !d.isBrief).length,
    };
  }, [unifiedDesigns]);

  // Unique dropdown items
  const customerList = useMemo(() => {
    const set = new Set<string>();
    unifiedDesigns.forEach((d) => {
      if (d.customer?.trim()) set.add(d.customer.trim());
    });
    return Array.from(set).sort();
  }, [unifiedDesigns]);

  const trendList = useMemo(() => {
    const set = new Set<string>();
    unifiedDesigns.forEach((d) => {
      if (d.trend?.trim()) set.add(d.trend.trim());
    });
    return Array.from(set).sort();
  }, [unifiedDesigns]);

  const designerList = useMemo(() => {
    const set = new Set<string>();
    unifiedDesigns.forEach((d) => {
      if (d.designer?.trim() && d.designer !== "Unassigned") set.add(d.designer.trim());
    });
    return Array.from(set).sort();
  }, [unifiedDesigns]);

  // Filtered designs
  const filteredDesigns = useMemo(() => {
    return unifiedDesigns.filter((d) => {
      if (selectedStageTab === "intake" && d.proofStatus !== "Brief Intake") return false;
      if (selectedStageTab === "concept" && d.proofStatus !== "In Concept") return false;
      if (selectedStageTab === "review" && d.proofStatus !== "Client Review") return false;
      if (selectedStageTab === "revisions" && d.proofStatus !== "Revisions Requested") return false;
      if (selectedStageTab === "approved" && d.proofStatus !== "Prepress Approved") return false;

      if (selectedScopeFilter === "brief" && !d.isBrief) return false;
      if (selectedScopeFilter === "request" && d.isBrief) return false;

      if (customerFilter !== "all" && d.customer !== customerFilter) return false;
      if (trendFilter !== "all" && d.trend !== trendFilter) return false;
      if (designerFilter !== "all" && d.designer !== designerFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          d.refCode.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.customer.toLowerCase().includes(q) ||
          d.trend.toLowerCase().includes(q) ||
          d.designer.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [
    unifiedDesigns,
    selectedStageTab,
    selectedScopeFilter,
    customerFilter,
    trendFilter,
    designerFilter,
    searchTerm,
  ]);

  // Paginated Slice
  const paginatedDesigns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDesigns.slice(start, start + pageSize);
  }, [filteredDesigns, currentPage, pageSize]);


  // Selection handlers

  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedDesigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedDesigns.map((d) => d.id)));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedScopeFilter("all");
    setCustomerFilter("all");
    setTrendFilter("all");
    setDesignerFilter("all");
    setSelectedStageTab("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedScopeFilter !== "all" ||
      customerFilter !== "all" ||
      trendFilter !== "all" ||
      designerFilter !== "all" ||
      selectedStageTab !== "all"
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

  const handleExportClick = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    exportRecordsToCsv({
      filename: `creative_design_briefs_${new Date().toISOString().split("T")[0]}.csv`,
      columns: [
        { header: "Artwork / Ref Code", accessor: (d) => d.refCode },
        { header: "Design Title", accessor: (d) => d.title },
        { header: "Customer / Brand", accessor: (d) => d.customer },
        { header: "Trend Style", accessor: (d) => d.trend },
        { header: "Variants", accessor: (d) => d.variantsCount },
        { header: "Designer", accessor: (d) => d.designer },
        { header: "Target Date", accessor: (d) => d.dueDate },
        { header: "Proof Status", accessor: (d) => d.proofStatus },
      ],
      data: filteredDesigns,
    });
  };

  const kpiItems = [
    {
      label: "All Active",
      value: metrics.total,
      detail: "Active artwork queue",
      color: "bg-[var(--accent-primary)]",
      isActive: selectedStageTab === "all",
      onClick: () => {
        setSelectedStageTab("all");
        setCurrentPage(1);
      },
    },
    {
      label: "Brief Intake",
      value: metrics.intake,
      detail: "Needs concept start",
      color: "bg-teal-500",
      isActive: selectedStageTab === "intake",
      onClick: () => {
        setSelectedStageTab("intake");
        setCurrentPage(1);
      },
    },
    {
      label: "In Concept",
      value: metrics.concept,
      detail: "Under artwork design",
      color: "bg-purple-500",
      isActive: selectedStageTab === "concept",
      onClick: () => {
        setSelectedStageTab("concept");
        setCurrentPage(1);
      },
    },
    {
      label: "Client Review",
      value: metrics.review,
      detail: "Proof sent for approval",
      color: "bg-sky-500",
      isActive: selectedStageTab === "review",
      onClick: () => {
        setSelectedStageTab("review");
        setCurrentPage(1);
      },
    },
    {
      label: "Revisions",
      value: metrics.revisions,
      detail: "Changes requested",
      color: "bg-rose-500",
      isActive: selectedStageTab === "revisions",
      onClick: () => {
        setSelectedStageTab("revisions");
        setCurrentPage(1);
      },
    },
    {
      label: "Prepress Approved",
      value: metrics.approved,
      detail: "Press-ready certified",
      color: "bg-emerald-500",
      isActive: selectedStageTab === "approved",
      onClick: () => {
        setSelectedStageTab("approved");
        setCurrentPage(1);
      },
    },
  ];

  const columns = useMemo<ColumnDef<typeof filteredDesigns[0]>[]>(
    () => [
      {
        id: "ref_code",
        header: "Artwork / Ref Code",
        width: "w-[150px]",
        sortable: true,
        cell: (row) => (
          <div>
            <CopyBadge text={row.refCode} />
            <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
              Raised {row.createdDate ? formatOdooDate(row.createdDate) : "—"}
            </div>
          </div>
        ),
      },
      {
        id: "title",
        header: "Design Title & Hierarchy",
        cell: (row) => (
          <div className="max-w-xs">
            <div
              className="font-semibold text-xs text-[var(--on-surface)] truncate"
              title={row.title}
            >
              {row.title}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                {row.trend}
              </span>
              <span className="text-[10px] text-[var(--on-surface-subtle)] font-sans truncate">
                · {row.targetAudience}
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer / Brand",
        width: "w-[160px]",
        cell: (row) => (
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--on-surface)]">
              <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
              <span className="truncate max-w-[140px]" title={row.customer || ""}>
                {row.customer || "—"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
              Commercial Account
            </div>
          </div>
        ),
      },
      {
        id: "source",
        header: "Brief Source & Scope",
        width: "w-[140px]",
        cell: (row) =>
          row.isBrief ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              <Palette className="w-3 h-3 text-purple-600" />
              <span>Studio Brief</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Package className="w-3 h-3 text-emerald-600" />
              <span>Commercial SR</span>
            </span>
          ),
      },
      {
        id: "variants",
        header: "Variants",
        width: "w-[90px]",
        align: "center",
        cell: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[var(--surface-low)] text-[var(--on-surface)] tabular-nums border border-[var(--border-subtle)]">
            {row.variantsCount} nos
          </span>
        ),
      },
      {
        id: "designer",
        header: "Designer Ownership",
        width: "w-[150px]",
        cell: (row) => (
          <div>
            <div className="font-mono text-xs font-semibold text-[var(--on-surface)]">
              {row.designer}
            </div>
            <span
              className={`mt-0.5 inline-flex rounded-md px-1.5 py-0.2 text-[10px] font-mono ${
                row.designer === "Unassigned"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold"
                  : "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold"
              }`}
            >
              {row.designer === "Unassigned" ? "Needs Claim" : "Assigned"}
            </span>
          </div>
        ),
      },
      {
        id: "sla",
        header: "Target SLA Date",
        width: "w-[120px]",
        cell: (row) => (
          <span className="font-mono text-xs text-[var(--on-surface-muted)]">
            {row.dueDate ? formatOdooDate(row.dueDate) : "Standard SLA"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Proof Review Status",
        width: "w-[140px]",
        cell: (row) => <StatusPill status={row.proofStatus} size="sm" showDot />,
      },
      {
        id: "actions",
        header: "Action",
        align: "right",
        width: "w-[100px]",
        cell: (row) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                if (row.rawBrief) onInspectBrief(row.rawBrief);
                else if (row.rawReq) onInspectRequest(row.rawReq);
              }}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ),
      },
    ],
    [onInspectBrief, onInspectRequest]
  );

  return (
    <DeskWorkspaceLayout
      title="Packaging Artwork & Design Briefs"
      businessYear={selectedYear}
      totalCount={unifiedDesigns.length}
      primaryAction={
        onOpenNewBriefModal
          ? {
              label: "New Design Brief",
              icon: Plus,
              onClick: onOpenNewBriefModal,
              title: "Create New Artwork Brief",
            }
          : undefined
      }
      onRefresh={handleRefreshClick}
      isRefreshing={isRefreshing}
      onExportCSV={handleExportClick}
      exportDisabled={filteredDesigns.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
      extraFilterControls={
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5">
          {[
            { id: "all" as const, label: "All Scopes", icon: Layers, count: typeCounts.all },
            { id: "brief" as const, label: "Studio Briefs", icon: Palette, count: typeCounts.brief },
            { id: "request" as const, label: "Commercial SR", icon: Package, count: typeCounts.request },
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
          {trendList.length > 0 && (
            <Select
              aria-label="Filter by theme / trend"
              value={trendFilter}
              onChange={(e) => {
                setTrendFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[140px] max-w-[180px]"
              options={[
                { value: "all", label: `All Themes (${trendList.length})` },
                ...trendList.map((t) => ({ value: t, label: t })),
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

          {designerList.length > 0 && (
            <Select
              aria-label="Filter by designer"
              value={designerFilter}
              onChange={(e) => {
                setDesignerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `All Designers (${designerList.length})` },
                ...designerList.map((d) => ({ value: d, label: d })),
              ]}
            />
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-8 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                  title="Clear selected items"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Selected ({selectedIds.size})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] text-[11px] underline px-1 cursor-pointer"
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
        placeholder: "Search ref, title, brand, designer...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Reset Filters"
    >
      <DataTable
        data={filteredDesigns}
        columns={columns}
        keyExtractor={(d) => d.id}
        isLoading={isRefreshing}
        emptyMessage={
          hasActiveFilters
            ? "No design briefs match your active search or filter criteria."
            : "There are currently no artwork briefs registered in this category."
        }
        onRowClick={(row) => {
          if (row.rawBrief) onInspectBrief(row.rawBrief);
          else if (row.rawReq) onInspectRequest(row.rawReq);
        }}
        enableSelection={true}
        selectedIds={selectedIds}
        onToggleSelectRow={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onToggleSelectAll={handleToggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredDesigns.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {unifiedDesigns.length}
              </span>{" "}
              artwork briefs
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-purple-700 dark:text-purple-300 font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default CreativeDesignPage;
