import React, { useEffect, useRef, useState } from "react";
import {
  X,
  AlertCircle,
  Check,
  Search,
  Plus,
  ArrowLeft,
  ChevronDown,
  Eye,
} from "lucide-react";
import { ProductSearchResult, BindingHierarchyResponse } from "../../types";
import { ProductCategoryItem } from "@/types/master";
import { OperationalDatePicker } from "@/components/erp";
import { DeliverableScopeId } from "../../types/staging";
import {
  fetchProductCatalogFilterCountsApi,
  MISSING_TAXONOMY_FILTER_VALUE,
} from "@/infrastructure/api/masterApi";
import type { ProductCatalogFilterCounts } from "@/infrastructure/api/masterApi";
import BrandNewProductSpecifications from "./BrandNewProductSpecifications";
import type { StagedProductItem } from "../../types/staging";

type CustomProductDetail = NonNullable<StagedProductItem["customDetails"]>[number];

export interface AddProductSamplingStepProps {
  selectedScopes?: DeliverableScopeId[];
  modalError: string | null;
  sampleType: "full" | "partial";
  partialRequirements: string;
  samplingSearchMode: "new" | "material_code" | "binding";
  designNeeded: boolean | null;
  marketingShutterstockNo: string;
  marketingMockupRemark: string;
  productDescription: string;
  qtyForSampling?: string;
  onSetQtyForSampling?: (val: string) => void;
  qtyForMockup: string;
  mockupRequiredDate: string;
  qtyDesignCosting: string;
  customerProductCode: string;
  barcode: string;
  brandName: string;
  unitPcPack: string;
  qtyPerPack: string;
  costingRequiredDate: string;
  creativeInputNeeded: boolean;
  creativeInputRemark: string;
  materialSearchQuery: string;
  materialSearchResults: ProductSearchResult[];
  isSearchingMaterial: boolean;
  selectedDbSample: ProductSearchResult | null;
  bindingHierarchy: BindingHierarchyResponse;
  isLoadingBindingHierarchy: boolean;
  selectedBinding1: string;
  selectedBinding2: string;
  productCategories: ProductCategoryItem[];
  newProductCustomDetails: CustomProductDetail[];
  selectedCategory: string;
  selectedSubCategory: string;
  selectedThirdCategory: string;
  bindingSearchResults: ProductSearchResult[];
  isSearchingBinding: boolean;
  isSubmittingAll: boolean;
  onSetModalError: (val: string | null) => void;
  onSetSampleType: (val: "full" | "partial") => void;
  onSetPartialRequirements: (val: string) => void;
  onSetSamplingSearchMode: (val: "new" | "material_code" | "binding") => void;
  onSetDesignNeeded: (val: boolean | null) => void;
  onSetMarketingShutterstockNo: (val: string) => void;
  onSetMarketingMockupRemark: (val: string) => void;
  onSetProductDescription: (val: string) => void;
  onSetQtyForMockup: (val: string) => void;
  onSetMockupRequiredDate: (val: string) => void;
  onSetQtyDesignCosting: (val: string) => void;
  onSetCustomerProductCode: (val: string) => void;
  onSetBarcode: (val: string) => void;
  onSetBrandName: (val: string) => void;
  onSetUnitPcPack: (val: string) => void;
  onSetQtyPerPack: (val: string) => void;
  onSetCostingRequiredDate: (val: string) => void;
  onSetCreativeInputNeeded: (val: boolean) => void;
  onSetCreativeInputRemark: (val: string) => void;
  onSetMaterialSearchQuery: (val: string) => void;
  onSelectDbSample: (item: ProductSearchResult) => void;
  onInspectProduct: (item: ProductSearchResult) => void;
  onSelectCategory: (val: string) => void;
  onSelectSubCategory: (val: string) => void;
  onSelectThirdCategory: (val: string) => void;
  onSetNewProductCustomDetails: (details: CustomProductDetail[]) => void;
  onSelectBinding1: (b1: string) => void;
  onSelectBinding2: (b2: string) => void;
  onBackToScopes: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

const BINDING_RESULT_ROW_HEIGHT = 72;
const BINDING_RESULT_VIEWPORT_HEIGHT = 320;

const BindingProductResults: React.FC<{
  items: ProductSearchResult[];
  selectedItem: ProductSearchResult | null;
  onSelect: (item: ProductSearchResult) => void;
  onInspect: (item: ProductSearchResult) => void;
  viewportHeight?: number;
}> = ({ items, selectedItem, onSelect, onInspect, viewportHeight = BINDING_RESULT_VIEWPORT_HEIGHT }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setScrollTop(0);
    setActiveIndex(-1);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [items]);

  const moveActiveIndex = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
    setActiveIndex(boundedIndex);
    if (containerRef.current) {
      containerRef.current.scrollTop = boundedIndex * BINDING_RESULT_ROW_HEIGHT;
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveIndex(activeIndex < 0 ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveIndex(activeIndex < 0 ? items.length - 1 : activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveActiveIndex(items.length - 1);
    } else if ((event.key === "Enter" || event.key === " ") && activeIndex >= 0) {
      event.preventDefault();
      onSelect(items[activeIndex]);
    }
  };

  const firstVisible = Math.max(0, Math.floor(scrollTop / BINDING_RESULT_ROW_HEIGHT) - 3);
  const lastVisible = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / BINDING_RESULT_ROW_HEIGHT) + 3
  );
  const visibleItems = items.slice(firstVisible, lastVisible);

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      aria-label="Products matching criteria"
      aria-activedescendant={activeIndex >= 0 ? `binding-product-${activeIndex}` : undefined}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onKeyDown={handleKeyDown}
      style={{ height: viewportHeight }}
      className="overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80 bg-white/60 dark:bg-zinc-900/60"
    >
      <div role="presentation" aria-hidden="true" style={{ height: firstVisible * BINDING_RESULT_ROW_HEIGHT }} />
      {visibleItems.map((item, offset) => {
        const index = firstVisible + offset;
        const isSelected = selectedItem?.id === item.id;
        return (
          <div
            key={item.id}
            id={`binding-product-${index}`}
            role="option"
            aria-selected={isSelected}
            title={item.product_description}
            onClick={() => {
              setActiveIndex(index);
              onSelect(item);
            }}
            className={`h-[72px] px-3.5 text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
              isSelected
                ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-l-3 border-[var(--accent-primary)] text-zinc-900 dark:text-zinc-100"
                : "hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100"
            } ${activeIndex === index ? "ring-1 ring-inset ring-[var(--accent-primary)]/40" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.material_code && (
                  <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[var(--accent-primary)] dark:text-emerald-300 border border-[var(--accent-primary)]/25 shrink-0">
                    {item.material_code}
                  </span>
                )}
                <span className="text-xs font-bold truncate text-slate-900 dark:text-zinc-100">
                  {item.product_description}
                </span>
              </div>
              {(item.customer || item.sr_number || item.product_category) && (
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {item.customer && <span className="truncate font-medium">{item.customer}</span>}
                  {item.sr_number && <span className="shrink-0 font-mono">Ref: {item.sr_number}</span>}
                  {item.product_category && (
                    <span className="shrink-0 text-emerald-700 dark:text-emerald-400 font-medium">
                      {item.product_category}{item.product_sub_category && ` › ${item.product_sub_category}`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onInspect(item);
                }}
                aria-label={`Inspect ${item.material_code || item.product_description}`}
                title="Inspect product specifications"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-indigo-300"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect</span>
              </button>
              <span
              aria-hidden="true"
              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                isSelected
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white shadow-2xs"
                  : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400"
              }`}
            >
              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </span>
            </div>
          </div>
        );
      })}
      <div
        role="presentation"
        aria-hidden="true"
        style={{ height: Math.max(0, (items.length - lastVisible) * BINDING_RESULT_ROW_HEIGHT) }}
      />
    </div>
  );
};

export const AddProductSamplingStep: React.FC<AddProductSamplingStepProps> = ({
  selectedScopes = ["sample"],
  modalError,
  sampleType,
  partialRequirements,
  samplingSearchMode,
  designNeeded,
  marketingShutterstockNo,
  marketingMockupRemark,
  productDescription,
  qtyForSampling = "1",
  onSetQtyForSampling,
  qtyForMockup,
  mockupRequiredDate,
  qtyDesignCosting,
  customerProductCode,
  barcode,
  brandName,
  unitPcPack,
  qtyPerPack,
  costingRequiredDate,
  creativeInputNeeded,
  creativeInputRemark,
  materialSearchQuery,
  materialSearchResults,
  isSearchingMaterial,
  selectedDbSample,
  bindingHierarchy,
  isLoadingBindingHierarchy,
  selectedBinding1,
  selectedBinding2,
  productCategories,
  newProductCustomDetails,
  selectedCategory,
  selectedSubCategory,
  selectedThirdCategory,
  bindingSearchResults,
  isSearchingBinding,
  isSubmittingAll,
  onSetModalError,
  onSetSampleType,
  onSetPartialRequirements,
  onSetSamplingSearchMode,
  onSetDesignNeeded,
  onSetMarketingShutterstockNo,
  onSetMarketingMockupRemark,
  onSetProductDescription,
  onSetQtyForMockup,
  onSetMockupRequiredDate,
  onSetQtyDesignCosting,
  onSetCustomerProductCode,
  onSetBarcode,
  onSetBrandName,
  onSetUnitPcPack,
  onSetQtyPerPack,
  onSetCostingRequiredDate,
  onSetCreativeInputNeeded,
  onSetCreativeInputRemark,
  onSetMaterialSearchQuery,
  onSelectDbSample,
  onInspectProduct,
  onSelectCategory,
  onSelectSubCategory,
  onSelectThirdCategory,
  onSetNewProductCustomDetails,
  onSelectBinding1,
  onSelectBinding2,
  onBackToScopes,
  onClose,
  onSubmit,
}) => {
  const [showMockupDetailsDialog, setShowMockupDetailsDialog] = useState(false);
  const [mockupDetailsError, setMockupDetailsError] = useState("");
  const [showCostingDetailsDialog, setShowCostingDetailsDialog] = useState(false);
  const [costingDialogError, setCostingDialogError] = useState("");
  const [isBindingFiltersOpen, setIsBindingFiltersOpen] = useState(true);
  const brandNewSpecificationsRef = useRef<HTMLDivElement>(null);
  const [catalogFilterCounts, setCatalogFilterCounts] = useState<ProductCatalogFilterCounts | null>(null);
  const [isLoadingCatalogFilterCounts, setIsLoadingCatalogFilterCounts] = useState(false);
  const includesSample = selectedScopes.includes("sample");
  const includesMockup = selectedScopes.includes("mockup");
  const includesCosting = selectedScopes.includes("costing");
  const includesDesign = selectedScopes.includes("design");
  useEffect(() => {
    if (samplingSearchMode === "binding") setIsBindingFiltersOpen(true);
  }, [samplingSearchMode]);

  // Derive cascading taxonomy options based on current selections
  const currentCategoryItem = productCategories.find((c) => c.name === selectedCategory);
  const subCategoryOptions = currentCategoryItem?.subcategories || [];
  const currentSubCategoryItem = subCategoryOptions.find((s) => s.name === selectedSubCategory);
  const thirdCategoryOptions = currentSubCategoryItem?.third_categories || [];
  const getMissingTaxonomyCount = (
    facet: "sub_categories_missing" | "third_categories_missing"
  ): string | number => {
    if (!catalogFilterCounts || isLoadingCatalogFilterCounts) return "…";
    return catalogFilterCounts[facet] ?? 0;
  };
  const missingSubCategoryCount = getMissingTaxonomyCount("sub_categories_missing");
  const missingThirdCategoryCount = getMissingTaxonomyCount("third_categories_missing");
  const hasSubCategoryOptions = subCategoryOptions.length > 0 || Number(missingSubCategoryCount) > 0;
  const hasThirdCategoryOptions = thirdCategoryOptions.length > 0 || Number(missingThirdCategoryCount) > 0;
  const formatTaxonomyFilter = (value: string) =>
    value === MISSING_TAXONOMY_FILTER_VALUE ? "None" : value;

  // Derive cascading binding 2 options
  const binding2Options = selectedBinding1
    ? bindingHierarchy.hierarchy[selectedBinding1] ?? []
    : [];
  const activeBindingFilters = [
    [selectedCategory, selectedSubCategory, selectedThirdCategory]
      .filter(Boolean)
      .map(formatTaxonomyFilter)
      .join(" › "),
    [selectedBinding1, selectedBinding2].filter(Boolean).join(" / "),
  ].filter(Boolean);
  const activeBindingFilterCount = [
    selectedCategory,
    selectedSubCategory,
    selectedThirdCategory,
    selectedBinding1,
    selectedBinding2,
  ].filter(Boolean).length;
  const activeBindingFilterSummary = activeBindingFilters.join(" · ");
  const getCatalogOptionCount = (
    facet: "categories" | "sub_categories" | "third_categories" | "binding1" | "binding2",
    value: string
  ): string | number => {
    if (!catalogFilterCounts || isLoadingCatalogFilterCounts) return "…";
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    return catalogFilterCounts[facet][key] ?? 0;
  };

  const isBrandNewSpecificationReady =
    samplingSearchMode === "new" && Boolean(productDescription.trim()) && Boolean(selectedCategory.trim());

  useEffect(() => {
    if (!isBrandNewSpecificationReady) return;
    requestAnimationFrame(() => {
      brandNewSpecificationsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [isBrandNewSpecificationReady]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (samplingSearchMode === "new" && !productDescription.trim()) {
      onSetModalError("Enter a product description before continuing.");
      return;
    }
    if (samplingSearchMode === "new" && !selectedCategory.trim()) {
      onSetModalError("Choose a product category before continuing.");
      return;
    }
    if (samplingSearchMode !== "new" && !selectedDbSample) {
      onSetModalError("Select a catalog product before continuing.");
      return;
    }
    if (includesMockup) {
      onSetModalError(null);
      setMockupDetailsError("");
      setShowMockupDetailsDialog(true);
      return;
    }
    if (includesCosting) {
      onSetModalError(null);
      setCostingDialogError("");
      setShowCostingDetailsDialog(true);
      return;
    }
    onSubmit();
  };

  const handleConfirmMockupDetails = () => {
    if (!mockupRequiredDate.trim()) {
      setMockupDetailsError("Choose a required date for the Mockup request.");
      return;
    }
    if (!Number.isInteger(Number(qtyForMockup)) || Number(qtyForMockup) < 1) {
      setMockupDetailsError("Enter a whole-number Mockup quantity (minimum 1).");
      return;
    }
    if (designNeeded === null) {
      setMockupDetailsError("Choose whether a new design is needed.");
      return;
    }
    if (designNeeded === false && !marketingShutterstockNo.trim() && !marketingMockupRemark.trim()) {
      setMockupDetailsError("Enter a Shutterstock number or a remark when no new design is needed.");
      return;
    }
    setMockupDetailsError("");
    setShowMockupDetailsDialog(false);
    if (includesCosting) {
      setCostingDialogError("");
      setShowCostingDetailsDialog(true);
      return;
    }
    onSubmit();
  };

  const handleConfirmCostingDetails = () => {
    if (!Number.isInteger(Number(qtyDesignCosting)) || Number(qtyDesignCosting) < 1) {
      setCostingDialogError("Enter a whole-number costing quantity (minimum 1).");
      return;
    }
    if (unitPcPack !== "PC" && unitPcPack !== "Pack") {
      setCostingDialogError("Choose PC or Pack as the unit.");
      return;
    }
    if (unitPcPack === "Pack" && (!Number.isInteger(Number(qtyPerPack)) || Number(qtyPerPack) < 1)) {
      setCostingDialogError("Enter how many pieces are in one pack.");
      return;
    }
    if (!costingRequiredDate.trim()) {
      setCostingDialogError("Choose a required date for Costing.");
      return;
    }
    setCostingDialogError("");
    setShowCostingDetailsDialog(false);
    onSubmit();
  };

  useEffect(() => {
    if (!showMockupDetailsDialog) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMockupDetailsDialog(false);
        setMockupDetailsError("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showMockupDetailsDialog]);

  useEffect(() => {
    if (!showCostingDetailsDialog) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowCostingDetailsDialog(false);
        setCostingDialogError("");
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showCostingDetailsDialog]);

  useEffect(() => {
    if (samplingSearchMode !== "binding") {
      setCatalogFilterCounts(null);
      setIsLoadingCatalogFilterCounts(false);
      return;
    }

    let isCurrent = true;
    setCatalogFilterCounts(null);
    setIsLoadingCatalogFilterCounts(true);
    fetchProductCatalogFilterCountsApi(
      selectedCategory || undefined,
      selectedSubCategory || undefined,
      selectedThirdCategory || undefined,
      selectedBinding1 || undefined
    )
      .then((counts: any) => {
        if (isCurrent) setCatalogFilterCounts(counts);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingCatalogFilterCounts(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [samplingSearchMode, selectedCategory, selectedSubCategory, selectedThirdCategory, selectedBinding1]);

  const modalTitle = includesSample
    ? "Configure Sampling Prototype"
    : includesMockup
      ? "Configure Mockup Request"
      : includesCosting
        ? "Configure Costing Specification"
        : "Configure Product Specification";

  return (
    <div className="relative flex h-[min(88vh,760px)] max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-smooth-modal dark:border-white/[0.08] dark:bg-zinc-900">
      {/* Modal Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              {modalTitle}
            </h3>
            <div className="flex items-center gap-1">
              {includesSample && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/25 tracking-wider uppercase">
                  SAMPLE
                </span>
              )}
              {includesMockup && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 tracking-wider uppercase">
                  MOCKUP
                </span>
              )}

          {includesCosting && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 tracking-wider uppercase">
                  COSTING
                </span>
              )}
              {includesDesign && (
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 tracking-wider uppercase">
                  DESIGN
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            {includesMockup
              ? "Choose an existing product by material code or binding, or add a brand-new product."
              : "Choose an existing product reference or describe a new prototype specification."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Error Message */}
      {modalError && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="font-medium">{modalError}</span>
          </div>
          <button
            type="button"
            onClick={() => onSetModalError(null)}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Form Body */}
      <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-7 sm:py-6 space-y-4 text-xs">
          {/* Scope Selection: Full Sample vs Partial Sample */}
          {includesSample && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
                Sample Scope <span className="text-rose-500">*</span>
              </label>

              <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Full Sample */}
                <div
                  onClick={() => onSetSampleType("full")}
                  className={`min-h-[3.5rem] p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    sampleType === "full"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 ring-1 ring-[var(--accent-primary)]/30 text-zinc-900 dark:text-zinc-100"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:border-[var(--accent-primary)]/40"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">
                      Full Sample
                    </span>
                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400">Complete finished prototype</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      sampleType === "full"
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {sampleType === "full" && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>

                {/* Partial Sample */}
                <div
                  onClick={() => onSetSampleType("partial")}
                  className={`min-h-[3.5rem] p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    sampleType === "partial"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 ring-1 ring-[var(--accent-primary)]/30 text-zinc-900 dark:text-zinc-100"
                      : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60 hover:border-[var(--accent-primary)]/40"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 block">
                      Partial Sample
                    </span>
                    <span className="text-[10.5px] text-slate-500 dark:text-zinc-400">Cover / binding only</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      sampleType === "partial"
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                  >
                    {sampleType === "partial" && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Partial Sample Details */}
              {sampleType === "partial" && (
                <div className="space-y-1 pt-1 animate-smooth-toast">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
                    Partial Sample Requirements <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={partialRequirements}
                    onChange={(e) => onSetPartialRequirements(e.target.value)}
                    placeholder="e.g. Spiral binding mockup without inner pages, only 4-color printed cover..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                  />
                </div>
              )}
            </div>
          )}


              {/* Sampling-only quantity and packaging */}
              {includesSample && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans mb-1">
                      Sample Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={qtyForSampling}
                      onChange={(e) => onSetQtyForSampling?.(e.target.value)}
                      placeholder="e.g. 1"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans mb-1">
                      Unit (PC / Pack) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={unitPcPack || "PC"}
                      onChange={(e) => onSetUnitPcPack(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 cursor-pointer"
                    >
                      <option value="PC">PC (Pieces)</option>
                      <option value="Pack">Pack</option>
                    </select>
                  </div>

                  {unitPcPack === "Pack" && (
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans mb-1">
                        Pieces Per Pack <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={qtyPerPack}
                        onChange={(e) => onSetQtyPerPack(e.target.value)}
                        placeholder="e.g. 10 pieces"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  )}
                </div>
              )}

          {/* Product source tabs: New | Material Code | Binding */}
          <div className="space-y-2.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 font-sans">
              Product Source
            </label>

            <div className="grid w-full max-w-3xl grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-white/[0.06]">
              <button
                type="button"
                aria-pressed={samplingSearchMode === "new"}
                onClick={() => onSetSamplingSearchMode("new")}
                className={`min-h-9 px-1.5 py-2 rounded-lg text-center text-[10px] leading-tight font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:px-3 sm:text-xs ${
                  samplingSearchMode === "new"
                    ? "bg-[var(--accent-primary)] text-white shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Brand New
              </button>

              <button
                type="button"
                aria-pressed={samplingSearchMode === "material_code"}
                onClick={() => onSetSamplingSearchMode("material_code")}
                className={`min-h-9 px-1.5 py-2 rounded-lg text-center text-[10px] leading-tight font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:px-3 sm:text-xs ${
                  samplingSearchMode === "material_code"
                    ? "bg-[var(--accent-primary)] text-white shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Material Code
              </button>

              <button
                type="button"
                aria-pressed={samplingSearchMode === "binding"}
                onClick={() => onSetSamplingSearchMode("binding")}
                className={`min-h-9 px-1.5 py-2 rounded-lg text-center text-[10px] leading-tight font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] sm:px-3 sm:text-xs ${
                  samplingSearchMode === "binding"
                    ? "bg-[var(--accent-primary)] text-white shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Category / Binding
              </button>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                1. NEW PRODUCT SECTION
               ══════════════════════════════════════════════════════════════ */}
            {samplingSearchMode === "new" && (
              <div className="space-y-3 pt-0.5">
                {/* Product Description */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    Product Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={productDescription}
                    onChange={(e) => onSetProductDescription(e.target.value)}
                    placeholder="Enter product title or prototype description (e.g. A5 Spiral Notebook, 160 pages)..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                  />
                </div>

                {/* Category Hierarchy */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Category Hierarchy
                    </label>
                    {(selectedCategory || selectedSubCategory || selectedThirdCategory) && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCategory("");
                          onSelectSubCategory("");
                          onSelectThirdCategory("");
                        }}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Category */}
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 mb-0.5">
                        Category
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCategory}
                          onChange={(e) => {
                            onSelectCategory(e.target.value);
                            onSelectSubCategory("");
                            onSelectThirdCategory("");
                          }}
                          className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer appearance-none"
                        >
                          <option value="">Select Category...</option>
                          {productCategories.map((c) => (
                            <option key={c.name} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Sub Category */}
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 mb-0.5">
                        Sub Category
                      </label>
                      <div className="relative">
                        <select
                          disabled={!selectedCategory || subCategoryOptions.length === 0}
                          value={selectedSubCategory}
                          onChange={(e) => {
                            onSelectSubCategory(e.target.value);
                            onSelectThirdCategory("");
                          }}
                          className={`w-full h-9 pl-3 pr-8 rounded-xl border text-xs font-medium outline-none appearance-none ${
                            !selectedCategory || subCategoryOptions.length === 0
                              ? "border-slate-200/60 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                              : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer"
                          }`}
                        >
                          <option value="">
                            {!selectedCategory
                              ? "Select Category first"
                              : subCategoryOptions.length === 0
                                ? "No sub-categories"
                                : "Select Sub Category..."}
                          </option>
                          {subCategoryOptions.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Third Category */}
                    <div>
                      <label className="block text-[10.5px] font-medium text-slate-500 dark:text-zinc-400 mb-0.5">
                        Third Category
                      </label>
                      <div className="relative">
                        <select
                          disabled={!selectedSubCategory || thirdCategoryOptions.length === 0}
                          value={selectedThirdCategory}
                          onChange={(e) => onSelectThirdCategory(e.target.value)}
                          className={`w-full h-9 pl-3 pr-8 rounded-xl border text-xs font-medium outline-none appearance-none ${
                            !selectedSubCategory || thirdCategoryOptions.length === 0
                              ? "border-slate-200/60 dark:border-zinc-800 bg-slate-100/70 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-500 cursor-not-allowed"
                              : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] cursor-pointer"
                          }`}
                        >
                          <option value="">
                            {!selectedSubCategory
                              ? "Select Sub Category first"
                              : thirdCategoryOptions.length === 0
                                ? "None"
                                : "Select Third Category..."}
                          </option>
                          {thirdCategoryOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>
                </div>
                {!isBrandNewSpecificationReady && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Enter a product description and choose Category 1 to open product specifications.
                  </p>
                )}
                {isBrandNewSpecificationReady && (
                  <div ref={brandNewSpecificationsRef}>
                    <BrandNewProductSpecifications
                      details={newProductCustomDetails}
                      onChange={onSetNewProductCustomDetails}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                2. MATERIAL CODE SECTION
               ══════════════════════════════════════════════════════════════ */}
            {samplingSearchMode === "material_code" && (
              <div className="space-y-2 pt-0.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={materialSearchQuery}
                    onChange={(e) => onSetMaterialSearchQuery(e.target.value)}
                    placeholder="Search material code or product description..."
                    className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  {materialSearchQuery && (
                    <button
                      type="button"
                      onClick={() => onSetMaterialSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>


                <div className="h-80 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 divide-y divide-slate-100 dark:border-zinc-700 dark:bg-zinc-900/40 dark:divide-zinc-800">
                  {isSearchingMaterial ? (
                    <div className="flex h-full min-h-36 items-center justify-center px-3 text-center text-xs text-zinc-400 font-mono">
                      Searching product catalog...
                    </div>
                  ) : materialSearchResults.length === 0 ? (
                    <div className="flex h-full min-h-36 items-center justify-center px-3 text-center text-xs text-slate-400 dark:text-zinc-500">
                      {materialSearchQuery.trim()
                        ? "No matching products found."
                        : "Enter a material code or description to search."}
                    </div>
                  ) : (
                    materialSearchResults.map((item) => {
                      const isSelected = selectedDbSample?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 transition-colors flex items-center justify-between gap-3 text-left ${
                            isSelected
                              ? "bg-emerald-500/10 dark:bg-emerald-950/40 border-l-3 border-[var(--accent-primary)]"
                              : "hover:bg-white dark:hover:bg-zinc-800"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectDbSample(item)}
                            aria-pressed={isSelected}
                            className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-primary)]"
                          >
                            <div className="flex items-center gap-2">
                              {item.material_code && (
                                <span className="font-mono text-[10.5px] font-bold px-1.5 py-0.2 rounded bg-white dark:bg-zinc-800 text-[var(--accent-primary)] dark:text-emerald-300 border border-[var(--accent-primary)]/20">
                                  {item.material_code}
                                </span>
                              )}
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {item.product_description}
                              </span>
                            </div>
                            {(item.customer || item.sr_number || item.product_category) && (
                              <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 dark:text-zinc-400">
                                {item.customer && <span>{item.customer}</span>}
                                {item.sr_number && <span>• Ref: {item.sr_number}</span>}
                                {item.product_category && (
                                  <span className="shrink-0 text-emerald-700 dark:text-emerald-400 font-medium">
                                    • {item.product_category}{item.product_sub_category && ` › ${item.product_sub_category}`}
                                  </span>
                                )}
                              </div>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onInspectProduct(item)}
                            aria-label={`Inspect ${item.material_code || item.product_description}`}
                            title="Inspect product specifications"
                            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-indigo-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>

                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                                : "border-zinc-300 dark:border-zinc-600"
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                3. CATEGORY & BINDING SECTION
               ══════════════════════════════════════════════════════════════ */}
            {samplingSearchMode === "binding" && (
              <div className="space-y-3 pt-0.5">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      aria-expanded={isBindingFiltersOpen}
                      aria-controls="binding-catalog-filters"
                      onClick={() => setIsBindingFiltersOpen((open) => !open)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer select-none"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-zinc-800 dark:text-zinc-100">Filter catalog</span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-zinc-500 dark:text-zinc-400">
                          {activeBindingFilterSummary || "Choose categories and binding to find matching products"}
                        </span>
                      </span>
                      {activeBindingFilterCount > 0 && (
                        <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {activeBindingFilterCount} active
                        </span>
                      )}
                      <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${isBindingFiltersOpen ? "rotate-180" : ""}`} />
                    </button>
                    {activeBindingFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCategory("");
                          onSelectSubCategory("");
                          onSelectThirdCategory("");
                          onSelectBinding1("");
                          onSelectBinding2("");
                        }}
                        className="shrink-0 rounded-md px-2 py-1 text-[10.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 cursor-pointer select-none dark:text-rose-300 dark:hover:bg-rose-950/40"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {isBindingFiltersOpen && (
                    <div id="binding-catalog-filters" className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Product category</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <label className="block text-[10.5px] font-medium text-slate-600 dark:text-zinc-400">
                            Category 1
                            <select
                              value={selectedCategory}
                              onChange={(event) => onSelectCategory(event.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              <option value="">Any category</option>
                              {productCategories.map((category) => (
                                <option key={category.name} value={category.name}>
                                  {category.name} ({getCatalogOptionCount("categories", category.name)})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[10.5px] font-medium text-slate-600 dark:text-zinc-400">
                            Category 2
                            <select
                              disabled={!selectedCategory || !hasSubCategoryOptions}
                              value={selectedSubCategory}
                              onChange={(event) => onSelectSubCategory(event.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800/60 dark:disabled:text-zinc-500"
                            >
                              <option value="">
                                {!selectedCategory
                                  ? "Choose Category 1 first"
                                  : !hasSubCategoryOptions
                                    ? "No category 2 options"
                                    : "Any category 2"}
                              </option>
                              {subCategoryOptions.map((category) => (
                                <option key={category.name} value={category.name}>
                                  {category.name} ({getCatalogOptionCount("sub_categories", category.name)})
                                </option>
                              ))}
                              {Number(missingSubCategoryCount) > 0 && (
                                <option value={MISSING_TAXONOMY_FILTER_VALUE}>
                                  None ({missingSubCategoryCount})
                                </option>
                              )}
                            </select>
                          </label>
                          <label className="block text-[10.5px] font-medium text-slate-600 dark:text-zinc-400">
                            Category 3
                            <select
                              disabled={!selectedSubCategory || !hasThirdCategoryOptions}
                              value={selectedThirdCategory}
                              onChange={(event) => onSelectThirdCategory(event.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800/60 dark:disabled:text-zinc-500"
                            >
                              <option value="">
                                {!selectedSubCategory
                                  ? "Choose Category 2 first"
                                  : !hasThirdCategoryOptions
                                    ? "No category 3 options"
                                    : "Any category 3"}
                              </option>
                              {thirdCategoryOptions.map((category) => (
                                <option key={category} value={category}>
                                  {category} ({getCatalogOptionCount("third_categories", category)})
                                </option>
                              ))}
                              {Number(missingThirdCategoryCount) > 0 && (
                                <option value={MISSING_TAXONOMY_FILTER_VALUE}>
                                  None ({missingThirdCategoryCount})
                                </option>
                              )}
                            </select>
                          </label>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 dark:border-zinc-800">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Binding</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Binding 2 depends on Binding 1</p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <label className="block text-[10.5px] font-medium text-slate-600 dark:text-zinc-400">
                            Binding 1
                            <select
                              value={selectedBinding1}
                              disabled={isLoadingBindingHierarchy}
                              onChange={(event) => onSelectBinding1(event.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:cursor-wait disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800/60 dark:disabled:text-zinc-500"
                            >
                              <option value="">{isLoadingBindingHierarchy ? "Loading binding options..." : "Any binding 1"}</option>
                              {bindingHierarchy.binding1_options.map((binding) => (
                                <option key={binding} value={binding}>
                                  {binding} ({getCatalogOptionCount("binding1", binding)})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[10.5px] font-medium text-slate-600 dark:text-zinc-400">
                            Binding 2
                            <select
                              value={selectedBinding2}
                              disabled={isLoadingBindingHierarchy || !selectedBinding1 || binding2Options.length === 0}
                              onChange={(event) => onSelectBinding2(event.target.value)}
                              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-zinc-900 outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-800/60 dark:disabled:text-zinc-500"
                            >
                              <option value="">
                                {isLoadingBindingHierarchy
                                  ? "Loading binding options..."
                                  : !selectedBinding1
                                    ? "Choose Binding 1 first"
                                    : binding2Options.length === 0
                                      ? "No linked Binding 2 values"
                                      : "Any linked Binding 2"}
                              </option>
                              {binding2Options.map((binding) => (
                                <option key={binding} value={binding}>
                                  {binding} ({getCatalogOptionCount("binding2", binding)})
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Matching Products (Unlimited) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        Matching Products
                      </span>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[10.5px] font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400">
                        {isSearchingBinding ? "..." : bindingSearchResults.length}
                      </span>
                    </div>

                    {activeBindingFilters.length > 0 && (
                      <span
                        title={activeBindingFilters.join(" · ")}
                        className="text-[10.5px] text-slate-500 dark:text-zinc-400 truncate max-w-[45%] text-right"
                      >
                        {activeBindingFilters.join(" · ")}
                      </span>
                    )}
                  </div>

                  <div className="h-80 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/40 dark:border-zinc-700 dark:bg-zinc-900/40">
                    {activeBindingFilters.length === 0 ? (
                      <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-xs text-slate-400 dark:text-zinc-500">
                        Choose a category or Binding 1 to search the catalog
                      </div>
                    ) : isSearchingBinding ? (
                      <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-xs text-slate-400 dark:text-zinc-500 font-mono">
                        Searching products...
                      </div>
                    ) : bindingSearchResults.length === 0 ? (
                      <div className="flex h-full min-h-32 items-center justify-center px-3 text-center text-xs text-slate-400 dark:text-zinc-500">
                        No saved products match these filters.
                      </div>
                    ) : (
                      <BindingProductResults
                        items={bindingSearchResults}
                        selectedItem={selectedDbSample}
                        onSelect={onSelectDbSample}
                        onInspect={onInspectProduct}
                        viewportHeight={BINDING_RESULT_VIEWPORT_HEIGHT}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Product Summary Card */}
          {selectedDbSample && samplingSearchMode !== "new" && (
            <div className="rounded-xl border border-[var(--accent-primary)]/25 bg-emerald-50/60 p-2.5 dark:border-emerald-500/20 dark:bg-emerald-950/25 flex items-center justify-between gap-2 animate-smooth-toast">
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className="font-bold text-xs text-[var(--accent-primary)] dark:text-emerald-400 shrink-0">
                  Selected:
                </span>
                {(selectedDbSample.material_code || selectedDbSample.sr_number) && (
                  <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 shrink-0">
                    {selectedDbSample.material_code || selectedDbSample.sr_number}
                  </span>
                )}
                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">
                  {selectedDbSample.product_description}
                </span>
              </div>
              {selectedDbSample.product_category && (
                <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-100/70 text-[var(--accent-primary)] dark:bg-emerald-900/60 dark:text-emerald-300">
                  {selectedDbSample.product_category}
                </span>
              )}
            </div>
          )}

        </div>

        {/* Actions Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-white/[0.06] dark:bg-zinc-900">
          <button
            type="button"
            onClick={onBackToScopes}
            className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-200/80 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 hover:bg-slate-200/80 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmittingAll}
              className="h-9 px-3.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,109,50,0.25)] hover:shadow-[0_4px_14px_rgba(0,109,50,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 disabled:opacity-50 active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                {includesMockup ? "Continue to Mockup Details" : includesCosting ? "Continue to Costing Details" : "Stage Product"}
              </span>
            </button>
          </div>
        </div>
      </form>
      {showMockupDetailsDialog && includesMockup && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-3" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="mockup-details-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
              <h3 id="mockup-details-title" className="text-sm font-bold text-slate-900 dark:text-zinc-100">Mockup details</h3>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-zinc-400">{selectedDbSample?.material_code ? `${selectedDbSample.material_code} · ` : ""}{productDescription || selectedDbSample?.product_description}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Mockup quantity, required date, and design choice are needed to continue.</p>
            </header>
            <div className="space-y-4 px-5 py-4 sm:px-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                  <span>Mockup quantity <span className="text-rose-500">*</span></span>
                  <input autoFocus required min="1" step="1" type="number" inputMode="numeric" value={qtyForMockup} onChange={(event) => { onSetQtyForMockup(event.target.value); setMockupDetailsError(""); }} placeholder="e.g. 1" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                </label>
                <OperationalDatePicker
                  label="Mockup required date"
                  required
                  value={mockupRequiredDate}
                  onChange={(value) => { onSetMockupRequiredDate(value); setMockupDetailsError(""); }}
                  placeholder="Select required date..."
                  calendarAlign="right"
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Is a new design needed? <span className="text-rose-500">*</span></legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[true, false].map((needed) => (
                    <label key={String(needed)} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${designNeeded === needed ? "border-[var(--accent-primary)] bg-emerald-50 text-[var(--accent-primary)] dark:bg-emerald-950/30" : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
                      <input type="radio" name="mockup-design-needed" checked={designNeeded === needed} onChange={() => { if (designNeeded !== needed) onSetDesignNeeded(needed); setMockupDetailsError(""); }} className="accent-[var(--accent-primary)]" />
                      {needed ? "Yes, design is needed" : "No, use existing artwork"}
                    </label>
                  ))}
                </div>
                {designNeeded === false && (
                  <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800 sm:grid-cols-2">
                    <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      <span>Shutterstock / stock number <span className="font-normal text-slate-500">(enter this or a remark)</span></span>
                      <input maxLength={100} value={marketingShutterstockNo} onChange={(event) => { onSetMarketingShutterstockNo(event.target.value); setMockupDetailsError(""); }} placeholder="Enter stock number" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    </label>
                    <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      <span>Marketing remark <span className="font-normal text-slate-500">(enter this or a stock number)</span></span>
                      <input maxLength={1000} value={marketingMockupRemark} onChange={(event) => { onSetMarketingMockupRemark(event.target.value); setMockupDetailsError(""); }} placeholder="Add reference notes for Studio" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    </label>
                    <p className="sm:col-span-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Creative will be bypassed. Studio CAD will build the mockup directly using this reference.</p>
                  </div>
                )}
                {designNeeded === true && (
                  <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-zinc-800">
                    <label className="block space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                      <span>Creative design brief / remarks <span className="font-normal text-slate-500">(optional)</span></span>
                      <input maxLength={1000} value={marketingMockupRemark} onChange={(event) => { onSetMarketingMockupRemark(event.target.value); setMockupDetailsError(""); }} placeholder="Add design requirements for Creative Studio..." className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
                    </label>
                    <p className="text-[10px] text-[var(--accent-primary)] font-medium">This request will route to Creative Studio. Creative will specify the artwork reference before releasing to Studio CAD.</p>
                  </div>
                )}
              </fieldset>
            </div>
            {mockupDetailsError && <p role="alert" className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 sm:mx-6">{mockupDetailsError}</p>}
            <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800 sm:px-6">
              <button type="button" onClick={() => { setShowMockupDetailsDialog(false); setMockupDetailsError(""); }} className="h-9 rounded-xl bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Back</button>
              <button type="button" disabled={isSubmittingAll} onClick={handleConfirmMockupDetails} className="h-9 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-bold text-white transition-colors hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">{includesCosting ? "Continue to Costing" : "Add Product to Staging"}</button>
            </footer>
          </section>
        </div>
      )}
      {showCostingDetailsDialog && includesCosting && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-3" role="presentation">
          <form role="dialog" aria-modal="true" aria-labelledby="costing-details-title" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); handleConfirmCostingDetails(); }} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-zinc-800 sm:px-6">
              <h3 id="costing-details-title" className="text-sm font-bold text-slate-900 dark:text-zinc-100">Costing details</h3>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-zinc-400">
                {selectedDbSample?.material_code ? `${selectedDbSample.material_code} · ` : ""}{productDescription || selectedDbSample?.product_description}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">Unit, quantity, and required date are mandatory. Add pieces per pack when you choose Pack.</p>
            </header>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2 sm:px-6">
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Customer SKU <span className="font-normal text-slate-500">(optional)</span></span>
                <input value={customerProductCode} onChange={(event) => onSetCustomerProductCode(event.target.value)} placeholder="Customer product code" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Brand <span className="font-normal text-slate-500">(optional)</span></span>
                <input value={brandName} onChange={(event) => onSetBrandName(event.target.value)} placeholder="Brand name" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Barcode <span className="font-normal text-slate-500">(optional)</span></span>
                <input value={barcode} onChange={(event) => onSetBarcode(event.target.value)} placeholder="Barcode" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Unit <span className="text-rose-500">*</span></span>
                <select required value={unitPcPack} onChange={(event) => onSetUnitPcPack(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                  <option value="PC">PC</option>
                  <option value="Pack">Pack</option>
                </select>
              </label>
              {unitPcPack === "Pack" && <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300"><span>Pieces per pack <span className="text-rose-500">*</span></span><input required min="1" step="1" type="number" inputMode="numeric" value={qtyPerPack} onChange={(event) => onSetQtyPerPack(event.target.value)} placeholder="e.g. 10" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" /></label>}
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Quantity for costing <span className="text-rose-500">*</span></span>
                <input autoFocus required min="1" step="1" type="number" inputMode="numeric" value={qtyDesignCosting} onChange={(event) => { onSetQtyDesignCosting(event.target.value); setCostingDialogError(""); }} placeholder="e.g. 10000" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
              </label>
              <OperationalDatePicker
                label="Costing required date"
                required
                value={costingRequiredDate}
                onChange={(value) => { onSetCostingRequiredDate(value); setCostingDialogError(""); }}
                placeholder="Select required date..."
                calendarAlign="right"
              />
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="costing-creative-input-needed" className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Creative input needed?</label>
                <select
                  id="costing-creative-input-needed"
                  value={creativeInputNeeded ? "yes" : "no"}
                  onChange={(event) => onSetCreativeInputNeeded(event.target.value === "yes")}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="no">No — send directly to Costing</option>
                  <option value="yes">Yes — send to Creative first</option>
                </select>
              </div>
              {creativeInputNeeded && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="costing-creative-input-remark" className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Remark for Creative <span className="font-normal text-slate-500">(optional)</span></label>
                  <textarea
                    id="costing-creative-input-remark"
                    rows={3}
                    maxLength={2000}
                    value={creativeInputRemark}
                    onChange={(event) => onSetCreativeInputRemark(event.target.value)}
                    placeholder="Describe what Creative should review or complete"
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">Creative has 2 working days after submission. Costing required date remains the Costing team’s deadline.</p>
                </div>
              )}
            </div>
            {costingDialogError && <p role="alert" className="mx-5 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 sm:mx-6">{costingDialogError}</p>}
            <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800 sm:px-6">
              <button type="button" onClick={() => { setShowCostingDetailsDialog(false); setCostingDialogError(""); if (includesMockup) setShowMockupDetailsDialog(true); }} className="h-9 rounded-xl bg-slate-100 px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">Back</button>
              <button type="submit" className="h-9 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-bold text-white transition-colors hover:bg-[var(--accent-primary-hover)]">Add Product to Staging</button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
};

export default AddProductSamplingStep;
