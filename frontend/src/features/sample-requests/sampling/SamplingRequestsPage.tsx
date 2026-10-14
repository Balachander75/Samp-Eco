import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getStageIdForRequest } from "../utils/trackTypes";
import { getBusinessYearForDate } from "@/lib/businessYear";
import {
  Plus,
  Trash2,
  Send,
  Package,
  Layers,
  Palette,
  Box,
  Calculator,
} from "lucide-react";
import { Select } from "@/components/ui/Select";
import { DeskWorkspaceLayout } from "@/components/erp";
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

  const kpiItems = [
    {
      label: "All Active",
      value: stageCounts.all,
      detail: "Active workflow",
      color: "bg-[var(--accent-primary)]",
      isActive: selectedStageTab === "all" && !hasActiveFilters,
      onClick: () => {
        setSelectedStageTab("all");
        setCurrentPage(1);
      },
    },
    {
      label: "Drafts to Release",
      value: stageCounts.draft,
      detail: "Pre-PMT staging",
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
      label: "SAMP Lab & Plant",
      value: stageCounts.samp + stageCounts.plant + stageCounts.costing,
      detail: "Sampling, BOM & floor",
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
      title="Commercial Sample Requests"
      businessYear={selectedYear}
      totalCount={samplingRequests.length}
      totalLabel="Total"
      primaryAction={
        !isReadOnly
          ? {
              label: "New Sample Request",
              icon: Plus,
              onClick: onOpenNewModal,
              title: "Create New Commercial Sample Request",
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
            <Select
              aria-label="Filter by product category"
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[150px] max-w-[200px]"
              options={[
                { value: "all", label: `All Categories (${categoryList.length})` },
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
              className="min-w-[150px] max-w-[200px]"
              options={[
                { value: "all", label: `All Customers (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {/* Batch Controls */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
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
        </>
      }
      search={{
        value: searchTerm,
        onChange: (val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        },
        placeholder: "Search SR#, material, desc...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Reset"
    >
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
    </DeskWorkspaceLayout>
  );
};

export default SamplingRequestsPage;
