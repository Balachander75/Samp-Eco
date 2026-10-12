import React, { useState, useMemo, useEffect } from "react";
import {
  Palette,
  Search,
  Plus,
  Download,
  RefreshCw,
  X,
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
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
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
  selectedPlant = "ALL",
  user,
  isAdmin = false,
  onOpenNewBriefModal,
  onInspectBrief,
  onInspectRequest,
  onUpdateStatus,
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

  const totalPages = Math.max(1, Math.ceil(filteredDesigns.length / pageSize));

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header (Maximized Space for Briefs) ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                Packaging Artwork &amp; Design Briefs
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {unifiedDesigns.length} Total
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              Graphic packaging concepts, brand typography, and prepress proof reviews.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Create New Brief Button */}
            {onOpenNewBriefModal && (
              <button
                type="button"
                onClick={onOpenNewBriefModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs cursor-pointer active:scale-98"
                title="Create New Artwork Brief"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Design Brief</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? "animate-spin text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportClick}
              disabled={filteredDesigns.length === 0}
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
        aria-label="Creative design workflow summary"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: "All Active",
              value: metrics.total,
              detail: "Active artwork queue",
              color: "bg-[var(--accent-primary)]",
              filter: "all" as const,
            },
            {
              label: "Brief Intake",
              value: metrics.intake,
              detail: "Needs concept start",
              color: "bg-teal-500",
              filter: "intake" as const,
            },
            {
              label: "In Concept",
              value: metrics.concept,
              detail: "Under artwork design",
              color: "bg-purple-500",
              filter: "concept" as const,
            },
            {
              label: "Client Review",
              value: metrics.review,
              detail: "Proof sent for approval",
              color: "bg-sky-500",
              filter: "review" as const,
            },
            {
              label: "Revisions",
              value: metrics.revisions,
              detail: "Changes requested",
              color: "bg-rose-500",
              filter: "revisions" as const,
            },
            {
              label: "Prepress Approved",
              value: metrics.approved,
              detail: "Press-ready certified",
              color: "bg-emerald-500",
              filter: "approved" as const,
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
                    {item.value}
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
                placeholder="Search ref, title, brand, designer..."
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

            {/* Theme / Trend Filter */}
            {trendList.length > 0 && (
              <select
                aria-label="Filter by theme / trend"
                value={trendFilter}
                onChange={(e) => {
                  setTrendFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[170px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Design Theme or Trend"
              >
                <option value="all">All Themes ({trendList.length})</option>
                {trendList.map((t) => (
                  <option key={t} value={t}>
                    {t}
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

            {/* Designer Filter */}
            {designerList.length > 0 && (
              <select
                aria-label="Filter by designer"
                value={designerFilter}
                onChange={(e) => {
                  setDesignerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[160px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Assigned Designer"
              >
                <option value="all">All Designers ({designerList.length})</option>
                {designerList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Batch Controls & Reset Button */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 mr-1">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIds(new Set());
                    }}
                    className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
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
                      paginatedDesigns.length > 0 &&
                      paginatedDesigns.every((d) => selectedIds.has(d.id))
                    }
                    onChange={handleToggleSelectAll}
                    className="rounded accent-[var(--accent-primary)] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Artwork / Ref Code</th>
                <th className="py-3 px-4 font-semibold">Design Title &amp; Hierarchy</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer / Brand</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Brief Source &amp; Scope</th>
                <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Variants</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Designer Ownership</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Target SLA Date</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Proof Review Status</th>
                <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-subtle)]">
              {isRefreshing ? (
                <TableSkeletonRows rows={8} columns={10} />
              ) : paginatedDesigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <EmptyState
                      icon={Palette}
                      title="No Artwork Design Briefs Found"
                      description={
                        hasActiveFilters
                          ? "No design briefs match your active search or filter criteria."
                          : "There are currently no artwork briefs registered in this category."
                      }
                      onResetFilters={hasActiveFilters ? handleResetFilters : undefined}
                      resetLabel="Reset filters"
                      action={
                        !hasActiveFilters && onOpenNewBriefModal ? (
                          <button
                            type="button"
                            onClick={onOpenNewBriefModal}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition active:scale-98 cursor-pointer bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                          >
                            Create New Brief
                          </button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedDesigns.map((row) => {
                  const isSelected = selectedIds.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        if (row.rawBrief) onInspectBrief(row.rawBrief);
                        else if (row.rawReq) onInspectRequest(row.rawReq);
                      }}
                      className={`hover:bg-[var(--surface-low)] transition-colors cursor-pointer group ${
                        isSelected ? "bg-[var(--accent-primary-subtle)]" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 pl-6 pr-3 w-8"
                        onClick={(e) => handleToggleSelectRow(row.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded accent-[var(--accent-primary)] cursor-pointer"
                        />
                      </td>

                      {/* Artwork / Ref Code */}
                      <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                        <CopyBadge text={row.refCode} />
                        <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                          Raised {row.createdDate ? formatOdooDate(row.createdDate) : "—"}
                        </div>
                      </td>

                      {/* Design Title & Hierarchy */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div
                          className="font-semibold text-xs text-[var(--on-surface)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors"
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
                      </td>

                      {/* Customer / Brand */}
                      <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
                          <span className="truncate max-w-[180px]" title={row.customer || ""}>
                            {row.customer || "—"}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
                          Commercial Account
                        </div>
                      </td>

                      {/* Brief Source & Scope */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {row.isBrief ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                            <Palette className="w-3 h-3 text-purple-600" />
                            <span>Studio Brief</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <Package className="w-3 h-3 text-emerald-600" />
                            <span>Commercial SR</span>
                          </span>
                        )}
                      </td>

                      {/* Variants */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[var(--surface-low)] text-[var(--on-surface)] tabular-nums border border-[var(--border-subtle)]">
                          {row.variantsCount} nos
                        </span>
                      </td>

                      {/* Designer Ownership */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                      </td>

                      {/* Target SLA Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--on-surface-muted)]">
                        {row.dueDate ? (
                          formatOdooDate(row.dueDate)
                        ) : (
                          <span className="text-[var(--on-surface-subtle)]">Standard SLA</span>
                        )}
                      </td>

                      {/* Proof Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusPill status={row.proofStatus} size="sm" showDot />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (row.rawBrief) onInspectBrief(row.rawBrief);
                            else if (row.rawReq) onInspectRequest(row.rawReq);
                          }}
                          className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                          title="Inspect Brief Details"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3 text-[var(--on-surface-subtle)]" />
                        </button>
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
            Showing {filteredDesigns.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
            {filteredDesigns.length > 0 && <> – {Math.min(filteredDesigns.length, currentPage * pageSize)}</>} of{" "}
            {filteredDesigns.length} artwork briefs
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-[var(--on-surface-subtle)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></span>
              Sorted by Latest Raised Intake
            </span>
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={filteredDesigns.length}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              itemLabel="briefs"
              className="border-t-0 p-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreativeDesignPage;
