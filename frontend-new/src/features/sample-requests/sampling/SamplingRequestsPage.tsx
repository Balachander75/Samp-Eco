import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getStageIdForRequest } from "../utils/trackTypes";
import { getBusinessYearForDate, normalizeToBusinessYear } from "@/lib/businessYear";
import {
  Plus,
  Send,
  Package,
  Layers,
  Palette,
  Box,
  Boxes,
  Calculator,
  Search,
  X,
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DeskWorkspaceLayout } from "@/components/erp";
import { SamplingRequestsTable } from "./components/SamplingRequestsTable";
import { DraftPackagesView } from "../components/DraftPackagesView";
import { getPrimaryRequestCode, getRequestTypes } from "./utils/requestTypeUtils";
import { mapDraftItemToStagedProduct } from "../utils/draftStaging";

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
  user,
  isAdmin,
  isReadOnly = false,
  onOpenNewModal,
  onInspectRequest,
  onReleaseDraft,
  onBatchReleaseDraft,
  onRefresh,
  onExportCSV,
  onDraftModeChange,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isHeadRole = isAdmin || Boolean(user?.is_team_head);

  const [selectedStageTab, setSelectedStageTab] = useState<SamplingFilterTab>(
    () => ((location.state as { stage?: string } | null)?.stage === "draft" ? "draft" : "all")
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [userScopeMode, setUserScopeMode] = useState<"my_requests" | "all_marketing">(
    isHeadRole ? "all_marketing" : "my_requests"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [draftViewMode, setDraftViewMode] = useState<"grouped" | "items">("grouped");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // Keyboard shortcut '/' to instantly focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    onDraftModeChange?.(selectedStageTab === "draft");
  }, [selectedStageTab, onDraftModeChange]);

  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [selectedStageTab, userScopeMode]);

  const handleOpenDraftInStaging = (row: SampleRequestItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const stagingContext = {
      customer: row.customer || "",
      programName: row.programName || row.productDescription || "",
      programYear: row.programYear || "2026",
      year: row.year || "2026-27",
      targetPlant: row.targetPlant || "",
      parentRequestId: row.id,
      parentSrNumber: getPrimaryRequestCode(row),
      parentRequestTypes: getRequestTypes(row),
      parentMockupWorkflowState: row.mockupWorkflowState,
      parentCreationMode: row.creationMode,
    };
    sessionStorage.setItem("samp_active_program_form", JSON.stringify(stagingContext));
    // Opening a specific draft must never inherit a different request's global staging cache.
    sessionStorage.setItem("samp_active_staged_products", JSON.stringify([mapDraftItemToStagedProduct(row)]));

    navigate("/sample-requests/product-staging", { state: stagingContext });
  };

  // Only commercial sampling requests scoped to selected business year and plant
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

      // Business Year Filter
      if (selectedYear !== "ALL") {
        const itemYear = normalizeToBusinessYear(r.year) || (r.dateRequestCreated ? getBusinessYearForDate(r.dateRequestCreated) : "");
        if (itemYear && itemYear !== selectedYear) return false;
      }

      // Plant Filter
      if (selectedPlant !== "ALL") {
        const p = (r.targetPlant || "").toLowerCase();
        if (!p.includes(selectedPlant.toLowerCase())) return false;
      }

      return true;
    });
  }, [requests, selectedYear, selectedPlant]);

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


  // Derived unique draft program package groups count
  const draftPackagesCount = useMemo(() => {
    const set = new Set<string>();
    samplingRequests.forEach((r) => {
      if (getStageIdForRequest(r) === "draft") {
        const cust = (r.customer || "Unassigned").trim().toLowerCase();
        const prog = (r.programName || r.programCampaignTitle || "Standard").trim().toLowerCase();
        const yr = (r.programYear || r.year || "2026").trim().toLowerCase();
        set.add(`${cust}_${prog}_${yr}`);
      }
    });
    return set.size;
  }, [samplingRequests]);

  // Personal request count for standard user
  const myRequestsCount = useMemo(() => {
    const uname = (user?.name || "").toLowerCase().trim();
    const uid = (user?.userid || "").toLowerCase().trim();
    if (!uname && !uid) return 0;
    return samplingRequests.filter((r) => {
      const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
      return (
        (Boolean(uname) && (creator === uname || creator.includes(uname) || uname.includes(creator))) ||
        (Boolean(uid) && (creator === uid || creator.includes(uid)))
      );
    }).length;
  }, [samplingRequests, user?.name, user?.userid]);

  // Filtered requests according to role perspective and criteria
  const filteredRequests = useMemo(() => {
    return samplingRequests.filter((r) => {
      // 1. Role Perspective Filtering
      if (!isHeadRole && userScopeMode === "my_requests") {
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
        const uname = (user?.name || "").toLowerCase().trim();
        const uid = (user?.userid || "").toLowerCase().trim();
        const matchesUser =
          (Boolean(uname) && (creator === uname || creator.includes(uname) || uname.includes(creator))) ||
          (Boolean(uid) && (creator === uid || creator.includes(uid)));
        if (!matchesUser) return false;
      }

      // 2. Stage Tab Filtering
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

      // 3. Customer Filter
      if (selectedCustomerFilter !== "all" && r.customer !== selectedCustomerFilter) {
        return false;
      }

      // 4. Category Filter
      if (selectedCategoryFilter !== "all" && r.productCategory !== selectedCategoryFilter) {
        return false;
      }

      // 5. Request Scope Type Filter
      if (selectedTypeFilter !== "all") {
        const types = getRequestTypes(r);
        if (!types.includes(selectedTypeFilter as any)) return false;
      }

      // 6. Search Term Filter
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
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase();

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
          thirdCat.includes(q) ||
          creator.includes(q)
        );
      }

      return true;
    });
  }, [
    samplingRequests,
    isHeadRole,
    userScopeMode,
    user?.name,
    user?.userid,
    selectedStageTab,
    selectedCustomerFilter,
    selectedCategoryFilter,
    selectedTypeFilter,
    searchTerm,
  ]);

  // Stage counts (based on current scope: personal vs all)
  const scopedForCounts = useMemo(() => {
    if (!isHeadRole && userScopeMode === "my_requests") {
      const uname = (user?.name || "").toLowerCase().trim();
      const uid = (user?.userid || "").toLowerCase().trim();
      return samplingRequests.filter((r) => {
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
        return (
          (Boolean(uname) && (creator === uname || creator.includes(uname) || uname.includes(creator))) ||
          (Boolean(uid) && (creator === uid || creator.includes(uid)))
        );
      });
    }
    return samplingRequests;
  }, [samplingRequests, isHeadRole, userScopeMode, user?.name, user?.userid]);

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

    scopedForCounts.forEach((r) => {
      const stage = getStageIdForRequest(r) as keyof typeof counts;
      if (counts[stage] !== undefined) {
        counts[stage]++;
      }
      if (stage !== "draft") {
        counts.all++;
      }
    });

    return counts;
  }, [scopedForCounts]);

  // Request Type counts (accurately scoped to active stage or drafts)
  const typeCounts = useMemo(() => {
    const counts = {
      all: 0,
      sample: 0,
      design: 0,
      mockup: 0,
      costing: 0,
    };
    const targetSet = selectedStageTab === "draft"
      ? scopedForCounts.filter((r) => getStageIdForRequest(r) === "draft")
      : scopedForCounts;

    counts.all = targetSet.length;
    targetSet.forEach((r) => {
      const types = getRequestTypes(r);
      if (types.includes("sample")) counts.sample++;
      if (types.includes("design")) counts.design++;
      if (types.includes("mockup")) counts.mockup++;
      if (types.includes("costing")) counts.costing++;
    });
    return counts;
  }, [scopedForCounts, selectedStageTab]);

  // Paginated Slice
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const matchingDraftRequestIds = useMemo(
    () => new Set(filteredRequests.map((request) => String(request.id))),
    [filteredRequests]
  );

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

  // Milestone Workflow KPI Cards
  const kpiItems = [
    {
      label: "All Active",
      value: stageCounts.all,
      detail: "Active in-flight",
      color: "bg-[#245942]",
      isActive: selectedStageTab === "all" && !hasActiveFilters,
      onClick: () => {
        setSelectedStageTab("all");
        setCurrentPage(1);
      },
    },
    {
      label: "Draft Packages",
      value: stageCounts.draft,
      detail: "Staging queue",
      color: "bg-amber-500",
      isActive: selectedStageTab === "draft",
      onClick: () => {
        setSelectedStageTab("draft");
        setCurrentPage(1);
      },
    },
    {
      label: "Creative & Design",
      value: stageCounts.creative + stageCounts.studio,
      detail: "Artworks & 3D mockups",
      color: "bg-purple-500",
      isActive: selectedStageTab === "creative_group",
      onClick: () => {
        setSelectedStageTab("creative_group");
        setCurrentPage(1);
      },
    },
    {
      label: "Sampling Team & Plant",
      value: stageCounts.samp + stageCounts.plant + stageCounts.costing,
      detail: "Floor, BOM & costing",
      color: "bg-teal-500",
      isActive: selectedStageTab === "production_group",
      onClick: () => {
        setSelectedStageTab("production_group");
        setCurrentPage(1);
      },
    },
    {
      label: "Dispatched / Deals",
      value: stageCounts.dispatched + stageCounts.deal,
      detail: "Shipped & won deals",
      color: "bg-emerald-500",
      isActive: selectedStageTab === "delivered_group",
      onClick: () => {
        setSelectedStageTab("delivered_group");
        setCurrentPage(1);
      },
    },
  ];

  return (
    <DeskWorkspaceLayout
      title={
        <div className="flex items-center gap-3">
          <span>Sample Requests</span>
          {!isHeadRole && (
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setUserScopeMode("my_requests");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                  userScopeMode === "my_requests"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold"
                    : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                }`}
              >
                My Portfolio ({myRequestsCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setUserScopeMode("all_marketing");
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                  userScopeMode === "all_marketing"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold"
                    : "text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)]"
                }`}
              >
                Team Queue ({samplingRequests.length})
              </button>
            </div>
          )}
        </div>
      }
      businessYear={selectedYear}
      totalCount={selectedStageTab === "draft" && draftViewMode === "grouped" ? draftPackagesCount : filteredRequests.length}
      totalLabel={selectedStageTab === "draft" && draftViewMode === "grouped" ? "Packages" : "Filtered"}
      primaryAction={
        !isReadOnly
          ? {
              label: "New Sample Request",
              icon: Plus,
              onClick: onOpenNewModal,
              title: "Create New Sample Request",
            }
          : undefined
      }
      onRefresh={onRefresh}
      isRefreshing={isLoading}
      onExportCSV={onExportCSV}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      filterControls={
        <>
          {/* Quick Request Type Segmented Filter (Compact) */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5 shadow-2xs shrink-0">
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
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold border border-[var(--border-subtle)]"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-lowest)]/50"
                  }`}
                >
                  <item.icon className={`w-3 h-3 ${isSelected ? "text-[var(--accent-primary)]" : "opacity-70"}`} />
                  <span>{item.label}</span>
                  <span
                    className={`text-[9.5px] font-mono px-1 py-0.2 rounded-full tabular-nums ${
                      isSelected
                        ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                        : "text-[var(--on-surface-subtle)] bg-[var(--surface-lowest)]/60"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Integrated Search Input right next to Scope Tabs on Top Row */}
          <div className="group relative min-w-[200px] flex-1 max-w-[300px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search SR#, material, desc, customer... ('/')"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] pl-8 pr-7 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Product Category Filter */}
          {categoryList.length > 0 && (
            <Select
              aria-label="Filter by product category"
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[130px] max-w-[170px]"
              options={[
                { value: "all", label: `Categories (${categoryList.length})` },
                ...categoryList.map((cat) => ({ value: cat, label: cat })),
              ]}
            />
          )}

          {/* Customer Filter */}
          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={selectedCustomerFilter}
              onChange={(e) => {
                setSelectedCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[130px] max-w-[170px]"
              options={[
                { value: "all", label: `Customers (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {/* Draft Sub-View Toggle (when in Draft stage) */}
          {selectedStageTab === "draft" && (
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDraftViewMode("grouped");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                  draftViewMode === "grouped"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold border border-[var(--border-subtle)]"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-lowest)]/50"
                }`}
                title="View drafts grouped by Program Packages"
              >
                <Boxes className={`w-3 h-3 ${draftViewMode === "grouped" ? "text-amber-600 " : "opacity-70"}`} />
                <span>Packages</span>
                <span className="text-[9.5px] font-mono px-1 py-0.2 rounded-full tabular-nums bg-amber-500/15 text-amber-700  font-bold">
                  {draftPackagesCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftViewMode("items");
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                  draftViewMode === "items"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold border border-[var(--border-subtle)]"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-lowest)]/50"
                }`}
                title="View all individual staged draft products"
              >
                <Layers className={`w-3 h-3 ${draftViewMode === "items" ? "text-[var(--accent-primary)]" : "opacity-70"}`} />
                <span>All Drafts</span>
                <span className="text-[9.5px] font-mono px-1 py-0.2 rounded-full tabular-nums bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold">
                  {filteredRequests.length}
                </span>
              </button>
            </div>
          )}
        </>
      }
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Clear Filters"
    >
      {selectedStageTab === "draft" && draftViewMode === "grouped" ? (
        <DraftPackagesView
          requests={samplingRequests}
          matchingRequestIds={matchingDraftRequestIds}
          isLoading={isLoading}
          selectedYear={selectedYear}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      ) : (
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
          onPageChange={(p) => setCurrentPage(p)}
          onOpenNewModal={onOpenNewModal}
          onResetFilters={handleResetFilters}
        />
      )}

      {/* ── Floating Executive Batch Action Dock ── */}
      {selectedIds.size > 0 && (selectedStageTab !== "draft" || draftViewMode === "items") && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-900/92  text-white backdrop-blur-md shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-white/15">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs font-bold tabular-nums text-emerald-300">
              {selectedIds.size}
            </span>
            <span className="text-xs text-zinc-300 font-medium">selected</span>
          </div>

          {selectedDraftsCount > 0 && (
            <button
              type="button"
              onClick={() => onBatchReleaseDraft(selectedIds)}
              className="h-8 px-3.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-[#245942] to-[#1b4332] hover:from-[#1b4332] hover:to-[#143728] active:scale-[0.98] transition-all cursor-pointer"
              title="Release selected drafts to their workflow"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Release Drafts ({selectedDraftsCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 px-2.5 rounded-xl hover:bg-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            title="Deselect all rows"
          >
            <X className="w-3.5 h-3.5" />
            <span>Deselect</span>
          </button>
        </div>
      )}
    </DeskWorkspaceLayout>
  );
};

export default SamplingRequestsPage;
