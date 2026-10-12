import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getStageIdForRequest } from "../utils/trackTypes";
import { getBusinessYearForDate } from "@/lib/businessYear";
import {
  Search,
  X,
  Plus,
  Download,
  Trash2,
  Send,
  RefreshCw,
  Package,
  Layers,
  Palette,
  Box,
  Calculator,
  ChevronRight,
  Filter,
} from "lucide-react";
import { SamplingRequestsTable } from "./components/SamplingRequestsTable";
import { getRequestTypes } from "./utils/requestTypeUtils";

export interface SamplingRequestsPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  uniquePlants: string[];
  uniqueCustomers: string[];
  user?: UserProfile | null;
  isAdmin: boolean;
  isReadOnly?: boolean;
  onOpenNewModal: () => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onReleaseDraft: (req: SampleRequestItem) => Promise<void>;
  onBatchReleaseDraft: (selectedIds: Set<string | number>) => Promise<void>;
  onDeleteRequest: (req: SampleRequestItem, e?: React.MouseEvent) => Promise<void>;
  onBatchDelete: (selectedIds: Set<string | number>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onExportCSV: () => void;
  onUpdateStatus?: (reqId: string | number, newStatus: string) => Promise<void>;
  onDraftModeChange?: (isDraftMode: boolean) => void;
}

export type SamplingFilterTab =
  | "all"
  | "draft"
  | "creative_group"
  | "production_group"
  | "delivered_group"
  | "creative"
  | "studio"
  | "costing"
  | "marketing"
  | "samp"
  | "plant"
  | "dispatched"
  | "deal";

export const SamplingRequestsPage: React.FC<SamplingRequestsPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  selectedPlant,
  isAdmin,
  isReadOnly = false,
  onOpenNewModal,
  onInspectRequest,
  onReleaseDraft,
  onBatchReleaseDraft,
  onDeleteRequest,
  onBatchDelete,
  onRefresh,
  onExportCSV,
  onDraftModeChange,
}) => {
  const [selectedStageTab, setSelectedStageTab] = useState<SamplingFilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  const navigate = useNavigate();

  useEffect(() => {
    onDraftModeChange?.(selectedStageTab === "draft");
  }, [selectedStageTab, onDraftModeChange]);

  const handleOpenDraftInStaging = (row: SampleRequestItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const stagingContext = {
      customer: row.customer || "",
      programName: row.programName || row.productDescription || "",
      programYear: row.programYear || "2026",
      year: row.year || "2026-27",
      targetPlant: row.targetPlant || "",
      parentRequestId: row.id,
      parentSrNumber: row.srNumber || `SR-${row.id}`,
      parentRequestTypes: row.requestTypes || [],
      parentMockupWorkflowState: row.mockupWorkflowState,
      parentCreationMode: row.creationMode,
    };
    sessionStorage.setItem("samp_active_program_form", JSON.stringify(stagingContext));

    const cached = sessionStorage.getItem("samp_active_staged_products");
    let stagedList: any[] = [];
    try {
      if (cached) stagedList = JSON.parse(cached);
    } catch {}

    if (!Array.isArray(stagedList) || stagedList.length === 0) {
      const isDesign = (row.requestTypes || []).includes("design") || Boolean(row.designsCustomerCreative);
      const initialItem = {
        id: String(row.id),
        productDescription: row.productDescription || "Commercial Product Sample",
        materialCode: row.materialCode || row.srNumber || "NEW-SPEC",
        scopes: row.requestTypes && row.requestTypes.length > 0 ? (row.requestTypes as any) : ["sample"],
        stagedDate: row.dateRequestCreated || new Date().toISOString().split("T")[0],
        timestamp: "Draft Intake",
        designMetadata: isDesign
          ? {
              numberOfDesigns: Number(row.designsCustomerCreative || row.productArtworkNos) || 1,
              designRequiredDate: row.sampleRequiredDate || row.targetArtworkDateCreative || "",
              trend: row.trend || "",
              targetAudience: row.targetAudience || "",
              referenceImage: row.productImagePath || "",
              remarks: row.designRemarks || (row as any).remarks || row.marketingRemarks || row.descriptionNotes || "",
              images: (row.referenceImages || []).map((url, i) => ({ id: String(i), url, name: `Attachment ${i + 1}` })),
              webLinks: row.referenceLinks || [],
            }
          : undefined,
        samplingMetadata: {
          sampleType: row.productType === "Partial Sample" ? "partial" : "full",
          partialRequirements: (row as any).remarks || row.marketingRemarks || row.descriptionNotes || "",
          sourceSrNumber: row.sourceSampleCode || "",
          bindingType1: (row as any).customBinding1 || "",
          bindingType2: (row as any).customBinding2 || "",
        },
      };
      sessionStorage.setItem("samp_active_staged_products", JSON.stringify([initialItem]));
    }

    navigate("/sample-requests/product-staging", { state: stagingContext });
  };

  // Only commercial sampling requests
  const samplingRequests = useMemo(() => {
    return requests.filter((r) => {
      const mat = String(r.materialCode || "").toLowerCase();
      const sr = String(r.srNumber || "").toLowerCase();
      const desc = String(r.productDescription || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const mode = String(r.creationMode || "").toLowerCase();

      // Exclude Feasibility checks
      if (
        kind === "feasibility" ||
        mode === "feasibility_check" ||
        mat.startsWith("fc-") ||
        mat.startsWith("fc-ck") ||
        sr.startsWith("fc-") ||
        sr.startsWith("fs-") ||
        desc.includes("feasibility check")
      ) {
        return false;
      }

      // Exclude Seasonal Program plannings
      if (
        kind === "program" ||
        mode === "program_planning" ||
        mat.startsWith("pg-") ||
        sr.startsWith("pg-") ||
        desc.includes("seasonal program:")
      ) {
        return false;
      }

      return true;
    });
  }, [requests]);

  // Derived Customers List
  const customerList = useMemo(() => {
    const set = new Set<string>();
    samplingRequests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [samplingRequests]);

  // Derived Merchandising Product Categories List
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    samplingRequests.forEach((r) => {
      if (r.productCategory && r.productCategory.trim()) set.add(r.productCategory.trim());
    });
    return Array.from(set).sort();
  }, [samplingRequests]);

  // Stage counts
  const stageCounts = useMemo(() => {
    const counts = {
      all: 0,
      draft: 0,
      creative: 0,
      studio: 0,
      costing: 0,
      marketing: 0,
      samp: 0,
      plant: 0,
      dispatched: 0,
      deal: 0,
    };

    samplingRequests.forEach((r) => {
      const stage = getStageIdForRequest(r) as keyof typeof counts;
      if (counts[stage] !== undefined) {
        counts[stage]++;
      }
      if (stage !== "draft") {
        counts.all++;
      }
    });

    return counts;
  }, [samplingRequests]);


  // Request Type counts
  const typeCounts = useMemo(() => {
    const counts = {
      all: samplingRequests.length,
      sample: 0,
      design: 0,
      mockup: 0,
      costing: 0,
    };
    samplingRequests.forEach((r) => {
      const types = getRequestTypes(r);
      if (types.includes("sample")) counts.sample++;
      if (types.includes("design")) counts.design++;
      if (types.includes("mockup")) counts.mockup++;
      if (types.includes("costing")) counts.costing++;
    });
    return counts;
  }, [samplingRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return samplingRequests.filter((r) => {
      const itemStage = getStageIdForRequest(r);

      if (selectedStageTab === "all") {
        if (itemStage === "draft") return false;
      } else if (selectedStageTab === "draft") {
        if (itemStage !== "draft") return false;
      } else if (selectedStageTab === "creative_group") {
        if (itemStage !== "creative" && itemStage !== "studio") return false;
      } else if (selectedStageTab === "production_group") {
        if (itemStage !== "samp" && itemStage !== "plant" && itemStage !== "costing") return false;
      } else if (selectedStageTab === "delivered_group") {
        if (itemStage !== "dispatched" && itemStage !== "deal") return false;
      } else {
        if (itemStage !== selectedStageTab) return false;
      }

      if (selectedYear !== "ALL") {
        const itemYear = r.year || (r.dateRequestCreated ? getBusinessYearForDate(r.dateRequestCreated) : "");
        if (itemYear && itemYear !== selectedYear) return false;
      }

      if (selectedPlant !== "ALL") {
        const p = (r.targetPlant || "").toLowerCase();
        if (!p.includes(selectedPlant.toLowerCase())) return false;
      }

      if (selectedCustomerFilter !== "all" && r.customer !== selectedCustomerFilter) {
        return false;
      }

      if (selectedCategoryFilter !== "all" && r.productCategory !== selectedCategoryFilter) {
        return false;
      }

      if (selectedTypeFilter !== "all") {
        const types = getRequestTypes(r);
        if (!types.includes(selectedTypeFilter as any)) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const sr = (r.srNumber || "").toLowerCase();
        const mat = (r.materialCode || "").toLowerCase();
        const desc = (r.productDescription || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const program = (r.programName || r.programCampaignTitle || "").toLowerCase();
        const programYear = (r.programYear || "").toLowerCase();
        const plant = (r.targetPlant || "").toLowerCase();
        const brand = (r.brandName || "").toLowerCase();
        const cat = (r.productCategory || "").toLowerCase();
        const subCat = (r.productSubCategory || "").toLowerCase();
        const thirdCat = (r.productThirdCategory || "").toLowerCase();

        return (
          sr.includes(q) ||
          mat.includes(q) ||
          desc.includes(q) ||
          cust.includes(q) ||
          program.includes(q) ||
          programYear.includes(q) ||
          plant.includes(q) ||
          brand.includes(q) ||
          cat.includes(q) ||
          subCat.includes(q) ||
          thirdCat.includes(q)
        );
      }

      return true;
    });
  }, [
    samplingRequests,
    selectedStageTab,
    selectedYear,
    selectedPlant,
    selectedCustomerFilter,
    selectedCategoryFilter,
    selectedTypeFilter,
    searchTerm,
  ]);

  // Paginated Slice
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  // Selection
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

  const selectedDraftsCount = useMemo(() => {
    return requests.filter(
      (r) => selectedIds.has(r.id) && getStageIdForRequest(r) === "draft"
    ).length;
  }, [requests, selectedIds]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCustomerFilter("all");
    setSelectedCategoryFilter("all");
    setSelectedTypeFilter("all");
    setSelectedStageTab("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      selectedCustomerFilter !== "all" ||
      selectedCategoryFilter !== "all" ||
      selectedTypeFilter !== "all" ||
      selectedStageTab !== "all"
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans overflow-hidden">
      {/* ── 1. Compact Editorial Header (Maximized Space for Requests) ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                Commercial Sample Requests
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                BY {selectedYear}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                {samplingRequests.length} Total
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
              Commercial production intake, PMT sampling pipelines, and dispatch tracking.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Create New Request Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={onOpenNewModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs cursor-pointer active:scale-98"
                title="Create New Commercial Sample Request"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Sample Request</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={onExportCSV}
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

      {/* ── 2. Interactive KPI Workflow Strip (Direct Queue Filters) ── */}
      <section
        aria-label="Sampling workflow summary"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "All Active",
              value: stageCounts.all,
              detail: "Active workflow",
              color: "bg-[var(--accent-primary)]",
              filter: "all" as const,
            },
            {
              label: "Drafts to Release",
              value: stageCounts.draft,
              detail: "Pre-PMT staging",
              color: "bg-amber-500",
              filter: "draft" as const,
            },
            {
              label: "Creative & Design",
              value: stageCounts.creative + stageCounts.studio,
              detail: "Artworks & 3D mockups",
              color: "bg-purple-500",
              filter: "creative_group" as const,
            },
            {
              label: "SAMP Lab & Plant",
              value: stageCounts.samp + stageCounts.plant + stageCounts.costing,
              detail: "Sampling, BOM & floor",
              color: "bg-teal-500",
              filter: "production_group" as const,
            },
            {
              label: "Dispatched / Deals",
              value: stageCounts.dispatched + stageCounts.deal,
              detail: "Shipped & won deals",
              color: "bg-emerald-500",
              filter: "delivered_group" as const,
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
          {/* Search and relevant request filters */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative w-52 sm:w-64 group">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-subtle)] group-focus-within:text-[var(--accent-primary)] transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="Search SR#, material, desc..."
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

            {/* Quick Request Type Filter Tabs */}
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5">
              {[
                { id: "all", label: "All Scopes", icon: Layers, count: typeCounts.all },
                { id: "sample", label: "Sampling", icon: Package, count: typeCounts.sample },
                { id: "design", label: "Design", icon: Palette, count: typeCounts.design },
                { id: "mockup", label: "Mockup", icon: Box, count: typeCounts.mockup },
                { id: "costing", label: "Costing", icon: Calculator, count: typeCounts.costing },
              ].map((item) => {
                const isSelected = selectedTypeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedTypeFilter(item.id);
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

            {/* Product Category Filter */}
            {categoryList.length > 0 && (
              <select
                aria-label="Filter by product category"
                value={selectedCategoryFilter}
                onChange={(e) => {
                  setSelectedCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[170px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
                title="Filter by Merchandising Product Category"
              >
                <option value="all">All Categories ({categoryList.length})</option>
                {categoryList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            {customerList.length > 0 && (
              <select
                aria-label="Filter by customer"
                value={selectedCustomerFilter}
                onChange={(e) => {
                  setSelectedCustomerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 max-w-[160px] truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--accent-primary)] cursor-pointer"
              >
                <option value="all">All Customers ({customerList.length})</option>
                {customerList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}


          </div>

          {/* Batch Controls */}
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 mr-1">
                {selectedDraftsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onBatchReleaseDraft(selectedIds)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow-2xs transition cursor-pointer bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                    title="Release selected drafts to their assigned workflow"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Release ({selectedDraftsCount})</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onBatchDelete(selectedIds)}
                    className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer transition"
                    title="Delete selected requests"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete ({selectedIds.size})</span>
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

      {/* Main request table; draft rows use the compact program summary columns. */}
      <SamplingRequestsTable
          paginatedRequests={paginatedRequests}
          filteredRequestsCount={filteredRequests.length}
          isLoading={isLoading}
          selectedIds={selectedIds}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          isAdmin={isAdmin}
          isDraftView={selectedStageTab === "draft"}
          hasActiveFilters={hasActiveFilters}
          selectedTypeFilter={selectedTypeFilter}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleSelectRow={handleToggleSelectRow}
          onOpenDraftInStaging={handleOpenDraftInStaging}
          onInspectRequest={onInspectRequest}
          onReleaseDraft={onReleaseDraft}
          onDeleteRequest={onDeleteRequest}
          onPageChange={(p) => setCurrentPage(p)}
          onOpenNewModal={onOpenNewModal}
          onResetFilters={handleResetFilters}
        />
    </div>
  );
};

export default SamplingRequestsPage;
