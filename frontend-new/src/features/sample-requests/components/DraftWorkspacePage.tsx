import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Plus,
  Copy,
  Edit3,
  Sliders,
  X,
  Building2,
  Calendar,
  Save,
  CheckSquare,
  Square,
} from "lucide-react";
import { UserProfile } from "@/features/auth";
import { RequestType, SampleRequestItem } from "../types";
import {
  fetchDraftMarketingRequestsApi,
  updateSampleRequestApi,
  updateDesignRequestApi,
  fetchProductDetailsApi,
  saveProductDetailsApi,
  createSampleRequestApi,
  createDesignRequestApi,
  releaseDraftRequestsApi,
  ProductDetailItem,
} from "@/infrastructure/api";
import type { UpdateSampleRequestPayload } from "@/infrastructure/api";
import type { DraftPackageContext } from "./DraftPackagesView";
import { getDraftReleaseStatus, isDesignRequest } from "../utils/trackTypes";

export interface DraftWorkspacePageProps {
  user?: UserProfile | null;
}

const isStandaloneDesignItem = (item: SampleRequestItem) =>
  String(item.id).startsWith("design-");

const designRequestId = (item: SampleRequestItem) =>
  item.designRequestId || Number(String(item.id).replace(/^design-/, ""));

const requestTypeLabels: Record<RequestType, string> = {
  sample: "Sample",
  mockup: "Mockup",
  design: "Design",
  costing: "Costing",
};

const requestTypeStyles: Record<RequestType, string> = {
  sample: "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]",
  mockup: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  design: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
  costing: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
};

const getRequestTypes = (item: SampleRequestItem): RequestType[] => {
  const types = (item.requestTypes || []).filter((type): type is RequestType =>
    ["sample", "mockup", "design", "costing"].includes(type),
  );
  if (types.length) return types;
  return isDesignRequest(item) ? ["design"] : ["sample"];
};

const formatDraftQuantity = (item: SampleRequestItem, type: RequestType) => {
  if (type === "design") return `${item.numberOfDesigns || 1} design${item.numberOfDesigns === 1 ? "" : "s"}`;
  if (type === "sample") {
    const quantity = item.qtyForSampling;
    if (!quantity) return "Not set";
    const unit = String(item.unitPcPack || "PC").toLowerCase() === "pack" ? "pack" : "pc";
    return `${quantity} ${unit}`;
  }
  if (type === "mockup") {
    const quantity = item.qtyForMockup || item.mockupWorkflowState?.qtyForMockup;
    return quantity ? `${quantity} mockup` : "Not set";
  }
  return item.qtyDesignCosting ? `${item.qtyDesignCosting} costing` : "Not set";
};

const inputClassName = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-2 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:bg-[var(--surface-lowest)]";
const labelClassName = "mb-1.5 block text-[11px] font-semibold text-[var(--on-surface-muted)]";

export const DraftWorkspacePage: React.FC<DraftWorkspacePageProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Load package group from router state or session storage
  const [packageContext] = useState<DraftPackageContext | null>(() => {
    const state = location.state as { package?: DraftPackageContext } | null;
    if (state?.package) return state.package;
    try {
      const cached = sessionStorage.getItem("samp_active_draft_group");
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    return null;
  });

  // Requests in active package
  const [packageItems, setPackageItems] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Modals state
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Edit metadata modal
  const [editingItem, setEditingItem] = useState<SampleRequestItem | null>(null);
  const [editForm, setEditForm] = useState({
    productDescription: "",
    customerProductCode: "",
    barcode: "",
    brandName: "",
    unitPcPack: "PC",
    qtyPerPack: "1",
    qtyForSampling: "",
    sampleRequiredDate: "",
    qtyForMockup: "",
    mockupRequiredDate: "",
    mockupDesignNeeded: false,
    mockupShutterstockNo: "",
    mockupRemark: "",
    qtyDesignCosting: "",
    costingRequiredDate: "",
    costingCreativeInputNeeded: false,
    costingCreativeInputRemark: "",
    numberOfDesigns: "1",
    designRequiredDate: "",
    trend: "",
    targetAudience: "",
    designRemarks: "",
  });
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Specs drawer state
  const [specItem, setSpecItem] = useState<SampleRequestItem | null>(null);
  const [specDetails, setSpecDetails] = useState<ProductDetailItem[]>([]);
  const [isLoadingSpecs, setIsLoadingSpecs] = useState(false);
  const [isSavingSpecs, setIsSavingSpecs] = useState(false);
  const [specLoadError, setSpecLoadError] = useState<string | null>(null);

  // Fetch package items from API
  const loadPackageData = useCallback(async () => {
    if (!packageContext) return;
    setIsLoading(true);
    try {
      const allRequests = await fetchDraftMarketingRequestsApi(packageContext.year || undefined);
      const normalizePackageValue = (value: string) => value.replace(/\s+/g, " ").toLowerCase().trim();
      const targetCustomer = normalizePackageValue(packageContext.customer);
      const targetProgram = normalizePackageValue(packageContext.programName);
      const targetYear = String(packageContext.programYear).replace(/BTS/gi, "").trim();

      const matched = allRequests.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        const isDraft = s.includes("draft") || s.includes("smt");
        if (!isDraft) return false;
        const c = normalizePackageValue(String(r.customer || ""));
        const p = normalizePackageValue(String(r.programName || r.programCampaignTitle || ""));
        const y = String(r.programYear || r.year || "").replace(/BTS/gi, "").trim();

        return c === targetCustomer && p === targetProgram && (y === targetYear || !targetYear);
      });

      setPackageItems(matched);
      // Clean selectedIds that are no longer present
      setSelectedIds((prev) => {
        const next = new Set<string | number>();
        for (const id of prev) {
          if (matched.some((m) => String(m.id) === String(id))) next.add(id);
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load draft package items:", err);
      showToast("Error loading draft items.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [packageContext, showToast]);

  useEffect(() => {
    loadPackageData();
  }, [loadPackageData]);

  const handleReturnToDraftQueue = () => {
    try {
      sessionStorage.removeItem("samp_active_draft_group");
    } catch {
      // Navigation can continue if storage is unavailable.
    }
    navigate("/sample-requests/sampling", {
      state: { refresh: Date.now(), stage: "draft" },
    });
  };

  // Handle multi-select toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.size === packageItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(packageItems.map((item) => item.id)));
    }
  };

  const handleToggleSelectItem = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Edit item metadata
  const handleOpenEditMetadata = (item: SampleRequestItem) => {
    setEditingItem(item);
    const mockupState = (item.mockupWorkflowState as Record<string, any>) || {};
    setEditForm({
      productDescription: item.productDescription || "",
      customerProductCode: item.customerProductCode || "",
      barcode: item.barcode || "",
      brandName: item.brandName || "",
      unitPcPack: String(item.unitPcPack || "").toLowerCase() === "pack" ? "Pack" : "PC",
      qtyPerPack: String(item.qtyPerPack || "1"),
      qtyForSampling: String(item.qtyForSampling || ""),
      sampleRequiredDate: String(item.sampleRequiredDate || "").split("T")[0],
      qtyForMockup: String(item.qtyForMockup || mockupState.qtyForMockup || ""),
      mockupRequiredDate: String(mockupState.requiredDate || "").split("T")[0],
      mockupDesignNeeded: Boolean(mockupState.designNeeded),
      mockupShutterstockNo: mockupState.marketingShutterstockNo || "",
      mockupRemark: mockupState.marketingRemark || "",
      qtyDesignCosting: String(item.qtyDesignCosting || ""),
      costingRequiredDate: String(item.costingRequiredDate || "").split("T")[0],
      costingCreativeInputNeeded: item.costingCreativeInputNeeded === true,
      costingCreativeInputRemark: item.costingCreativeInputRemark || "",
      numberOfDesigns: String(item.numberOfDesigns || 1),
      designRequiredDate: String(item.designRequiredDate || item.targetArtworkDateCreative || "").split("T")[0],
      trend: item.trend || "",
      targetAudience: item.targetAudience || "",
      designRemarks: item.designRemarks || "",
    });
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSavingMetadata(true);
    try {
      if (isStandaloneDesignItem(editingItem)) {
        const saved = await updateDesignRequestApi(designRequestId(editingItem), {
          productDescription: editForm.productDescription.trim(),
          numberOfDesigns: editForm.numberOfDesigns.trim(),
          designRequiredDate: editForm.designRequiredDate,
          trend: editForm.trend.trim(),
          targetAudience: editForm.targetAudience.trim(),
          designRemarks: editForm.designRemarks.trim(),
        });
        if (!saved) throw new Error("Design request was not updated.");
      } else {
        const requestTypes = getRequestTypes(editingItem);
        const hasSample = requestTypes.includes("sample");
        const hasMockup = requestTypes.includes("mockup");
        const hasCosting = requestTypes.includes("costing");
        const hasDesign = requestTypes.includes("design") || isDesignRequest(editingItem);
        const updatePayload: UpdateSampleRequestPayload = {
          productDescription: editForm.productDescription.trim(),
        };

        if (hasSample || hasMockup || hasCosting) {
          updatePayload.customerProductCode = editForm.customerProductCode.trim();
          updatePayload.barcode = editForm.barcode.trim();
          updatePayload.brandName = editForm.brandName.trim();
        }
        if (hasSample) {
          updatePayload.sampleRequiredDate = editForm.sampleRequiredDate || undefined;
          updatePayload.qtyForSampling = editForm.qtyForSampling.trim();
          updatePayload.unitPcPack = editForm.unitPcPack.trim();
          updatePayload.qtyPerPack = editForm.unitPcPack.trim().toLowerCase() === "pack"
            ? editForm.qtyPerPack.trim() || "1"
            : "1";
        }
        if (hasMockup) {
          updatePayload.mockupRequired = "Yes";
          updatePayload.mockupWorkflowState = {
            ...(editingItem.mockupWorkflowState || { stage: "marketing" }),
            designNeeded: editForm.mockupDesignNeeded,
            qtyForMockup: editForm.qtyForMockup.trim(),
            requiredDate: editForm.mockupRequiredDate,
            marketingShutterstockNo: editForm.mockupShutterstockNo.trim(),
            marketingRemark: editForm.mockupRemark.trim(),
          };
        }
        if (hasCosting) {
          updatePayload.qtyDesignCosting = editForm.qtyDesignCosting.trim();
          updatePayload.costingRequiredDate = editForm.costingRequiredDate || undefined;
          updatePayload.costingCreativeInputNeeded = editForm.costingCreativeInputNeeded;
          updatePayload.costingCreativeInputRemark = editForm.costingCreativeInputNeeded
            ? editForm.costingCreativeInputRemark.trim()
            : "";
        }
        if (hasDesign) {
          updatePayload.numberOfDesigns = Number(editForm.numberOfDesigns) || 1;
          updatePayload.targetArtworkDateCreative = editForm.designRequiredDate || undefined;
          updatePayload.trend = editForm.trend.trim();
          updatePayload.targetAudience = editForm.targetAudience.trim();
          updatePayload.designRemarks = editForm.designRemarks.trim();
          updatePayload.referenceImages = editingItem.referenceImages || [];
          updatePayload.referenceLinks = editingItem.referenceLinks || [];
        }

        const saved = await updateSampleRequestApi(editingItem.id, updatePayload);
        if (!saved) throw new Error("Product details were not updated.");
      }
      showToast(
        isStandaloneDesignItem(editingItem) || isDesignRequest(editingItem)
          ? "Updated request details."
          : "Updated product details.",
        "success"
      );
      setEditingItem(null);
      loadPackageData();
    } catch (err) {
      console.error("Failed to save product metadata:", err);
      await loadPackageData();
      showToast("Error saving product changes.", "error");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Open Specs Drawer
  const handleOpenSpecsDrawer = async (item: SampleRequestItem) => {
    if (isStandaloneDesignItem(item)) return;
    setSpecItem(item);
    setSpecLoadError(null);
    setSpecDetails([]);
    setIsLoadingSpecs(true);
    try {
      const numericId = Number(String(item.id).replace(/^sample-/, ""));
      if (!Number.isInteger(numericId) || numericId <= 0) throw new Error("Sample request ID is invalid.");
      const details = await fetchProductDetailsApi(numericId, false);
      setSpecDetails(details);
    } catch (err) {
      console.error("Failed to fetch product details:", err);
      setSpecLoadError("Could not load specifications. Try again.");
      showToast("Error loading characteristic specifications.", "error");
    } finally {
      setIsLoadingSpecs(false);
    }
  };

  // Save specs from drawer
  const handleSaveSpecs = async () => {
    if (!specItem) return;
    setIsSavingSpecs(true);
    try {
      const numericId = Number(String(specItem.id).replace(/^sample-/, ""));
      if (!Number.isInteger(numericId) || numericId <= 0) throw new Error("Sample request ID is invalid.");
      const payload = specDetails.map((d) => ({
        className: d.className,
        characteristicName: d.characteristicName,
        value: d.value,
        uom: d.uom,
      }));
      await saveProductDetailsApi(numericId, payload);
      showToast("✓ Specifications updated successfully.", "success");
      setSpecItem(null);
    } catch (err) {
      console.error("Failed to save specs:", err);
      showToast("Error saving characteristic specifications.", "error");
    } finally {
      setIsSavingSpecs(false);
    }
  };

  // Clone item
  const handleCloneItem = async (item: SampleRequestItem) => {
    try {
      if (isStandaloneDesignItem(item)) {
        const cloned = await createDesignRequestApi({
          customerName: item.customer || "",
          programName: item.programName || "",
          programYear: item.programYear || "",
          numberOfDesigns: String(item.numberOfDesigns || 1),
          trend: item.trend || "",
          targetAudience: item.targetAudience || "",
          referenceImage: item.referenceImage || "",
          referenceImages: item.referenceImages || [],
          referenceLinks: item.referenceLinks || [],
          productDescription: `${item.productDescription} (Copy)`,
          designRequiredDate: item.designRequiredDate || "",
          designRemarks: item.designRemarks || "",
        });
        if (!cloned) throw new Error("Design request could not be cloned.");
      } else {
        const numericId = Number(String(item.id).replace(/^sample-/, ""));
        const cloned = await createSampleRequestApi({
          customer: item.customer || "",
          programName: item.programName,
          programYear: item.programYear,
          year: item.year,
          targetPlant: item.targetPlant || "",
          productDescription: `${item.productDescription} (Copy)`,
          materialCode: "",
          creationMode: item.creationMode || "binding",
          requestTypes: item.requestTypes || [],
          mockupWorkflowState: (item.requestTypes || []).includes("mockup") || item.mockupRequired === "Yes"
            ? {
                stage: "marketing",
                designNeeded: item.mockupWorkflowState?.designNeeded ?? (item.creationMode === "new" || (item.requestTypes || []).includes("design")),
                marketingShutterstockNo: item.mockupWorkflowState?.marketingShutterstockNo || "",
                marketingRemark: item.mockupWorkflowState?.marketingRemark || "",
                events: [],
              }
            : undefined,
          numberOfDesigns: item.numberOfDesigns,
          trend: item.trend || undefined,
          targetAudience: item.targetAudience || undefined,
          designRemarks: item.designRemarks || undefined,
          referenceImages: item.referenceImages || [],
          referenceLinks: item.referenceLinks || [],
          targetArtworkDateCreative: item.targetArtworkDateCreative || item.designRequiredDate || undefined,
          sourceSampleRequestId: Number.isInteger(numericId) && numericId > 0 ? numericId : undefined,
          sourceSampleCode: item.materialCode || item.srNumber,
          status: "Draft (Pre-SMT)",
        });
        if (!cloned) throw new Error("Sample request could not be cloned.");
      }
      showToast(`✓ ${isDesignRequest(item) ? "Design request" : "Product"} cloned into Draft Package.`, "success");
      loadPackageData();
    } catch (err) {
      console.error("Failed to clone item:", err);
      await loadPackageData();
      showToast("Error cloning product.", "error");
    }
  };

  // Release Action (Workspace Release)
  const handleConfirmRelease = async () => {
    setIsReleasing(true);
    try {
      // If subset selected, release subset. Otherwise release all items in package.
      const targetItems = selectedIds.size > 0 ? packageItems.filter((i) => selectedIds.has(i.id)) : packageItems;

      if (targetItems.length === 0) throw new Error("There are no draft requests to release.");
      const itemsByStatus = new Map<string, SampleRequestItem[]>();
      for (const item of targetItems) {
        const status = getDraftReleaseStatus(item);
        itemsByStatus.set(status, [...(itemsByStatus.get(status) || []), item]);
      }
      for (const [status, items] of itemsByStatus) {
        await releaseDraftRequestsApi(items, status);
      }

      const destinations = Array.from(new Set(targetItems.map(getDraftReleaseStatus)));
      showToast(`✓ Released ${targetItems.length} item(s) to ${destinations.join(" and ")}.`, "success");
      setIsReleaseModalOpen(false);

      // If all items were released, return to sample requests desk
      if (selectedIds.size === 0 || selectedIds.size === packageItems.length) {
        try {
          sessionStorage.removeItem("samp_active_draft_group");
        } catch {
          // The released drafts are already persisted; continue to the queue.
        }
        setTimeout(() => {
          navigate("/sample-requests/sampling", {
            state: { refresh: Date.now(), stage: "draft" },
          });
        }, 800);
      } else {
        loadPackageData();
      }
    } catch (err) {
      console.error("Failed to release items:", err);
      await loadPackageData();
      showToast("Error releasing products to Creative.", "error");
    } finally {
      setIsReleasing(false);
    }
  };

  if (!packageContext) {
    return (
      <div className="p-12 text-center">
        <p className="text-zinc-500 text-sm">No active draft package selected.</p>
        <button
          onClick={handleReturnToDraftQueue}
          className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg"
        >
          Return to Sample Requests Desk
        </button>
      </div>
    );
  }

  const itemsToRelease = selectedIds.size > 0 ? packageItems.filter((item) => selectedIds.has(item.id)) : packageItems;
  const itemsToReleaseCount = itemsToRelease.length;
  const releaseDestinations = Array.from(new Set(itemsToRelease.map(getDraftReleaseStatus)));
  const isDesignPackage = packageContext.requestKind === "design";
  const editingRequestTypes = editingItem ? getRequestTypes(editingItem) : [];
  const editingHasSample = editingRequestTypes.includes("sample");
  const editingHasMockup = editingRequestTypes.includes("mockup");
  const editingHasCosting = editingRequestTypes.includes("costing");
  const editingHasDesign = Boolean(editingItem && (editingRequestTypes.includes("design") || isDesignRequest(editingItem)));
  const specificationGroups = specDetails.reduce<Record<string, Array<{ detail: ProductDetailItem; index: number }>>>(
    (groups, detail, index) => {
      const groupName = detail.className?.trim() || "Product details";
      (groups[groupName] ||= []).push({ detail, index });
      return groups;
    },
    {},
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--surface-base)] text-[var(--on-surface)]">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-xl animate-in fade-in slide-in-from-top-2 ${
          toastMessage.type === "error"
            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
            : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface)]"
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Workspace Header / Program Banner */}
      <div className="shrink-0 bg-[var(--surface-lowest)] px-4 py-4 shadow-2xs sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleReturnToDraftQueue}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-low)] text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              aria-label="Return to Sample Requests"
              title="Return to Sample Requests"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="max-w-[min(60vw,26rem)] truncate rounded-md bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-muted)]">
                  {packageContext.customer}
                </span>
                <span className="rounded-md bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Draft (Pre-SMT)
                </span>
              </div>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                {packageContext.programName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--on-surface-muted)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Season: {packageContext.programYear}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  Plant: {packageContext.targetPlant.replace(/^\d+-\s*/, "")}
                </span>
                <span>•</span>
                <span className="tabular-nums">{packageItems.length} {isDesignPackage ? "design briefs" : "products"} staged</span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex w-full items-center gap-2 md:w-auto">
            {!isDesignPackage && (
              <button
                type="button"
                onClick={() => navigate("/sample-requests/add-product", { state: packageContext })}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--surface-low)] px-3.5 text-sm font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] md:flex-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsReleaseModalOpen(true)}
              disabled={packageItems.length === 0}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent-primary)] shadow-xs transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-lowest)] disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {selectedIds.size > 0
                  ? `Release Selected (${selectedIds.size})`
                  : `Release All (${packageItems.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--accent-primary-subtle)] px-4 py-2.5 text-xs font-semibold animate-in fade-in duration-150">
            <span className="text-[var(--accent-primary-strong)]">
              {selectedIds.size} of {packageItems.length} {isDesignPackage ? "brief(s)" : "product(s)"} selected
            </span>
            <button
              type="button"
              onClick={() => setIsReleaseModalOpen(true)}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--on-accent-primary)] transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              <Send className="h-3.5 w-3.5" />
              Release Selected
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-[var(--surface-lowest)] shadow-xs ring-1 ring-[var(--border-subtle)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left text-xs">
              <colgroup>
                <col className="w-12" />
                <col className="w-[190px]" />
                <col />
                <col className="w-[160px]" />
                <col className="w-[190px]" />
                <col className="w-[130px]" />
                <col className="w-[150px]" />
                <col className="w-[132px]" />
              </colgroup>
              <thead className="bg-[var(--surface-low)] text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--on-surface-muted)] select-none">
                <tr>
                  <th className="px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="inline-flex rounded p-1 text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                      aria-label={selectedIds.size === packageItems.length && packageItems.length > 0 ? "Deselect all products" : "Select all products"}
                    >
                      {selectedIds.size === packageItems.length && packageItems.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-[var(--accent-primary)]" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">Product / Request Code</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">{isDesignPackage ? "Trend" : "Binding Style"}</th>
                  <th className="px-3 py-3">Request</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Scope Qty</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-[var(--on-surface-muted)]">
                      Loading package items...
                    </td>
                  </tr>
                ) : packageItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <p className="text-sm font-semibold text-[var(--on-surface)]">{isDesignPackage ? "No design requests staged yet" : "No products staged yet"}</p>
                      <p className="mt-1 text-xs text-[var(--on-surface-muted)]">{isDesignPackage ? "This package currently has no design briefs." : "Add a product to this program to prepare its request."}</p>
                    </td>
                  </tr>
                ) : (
                  packageItems.map((item) => {
                    const isChecked = selectedIds.has(item.id);
                    const isDesign = isDesignRequest(item);
                    const isCustom = item.creationMode === "binding" || String(item.materialCode).startsWith("A1-");
                    const requestTypes = getRequestTypes(item);
                    const requestCode = item.requestCode || item.materialCode || item.srNumber || "N/A";
                    const sourceProductCode = item.sourceSampleCode;
                    const bindingStyle = [
                      (item as any).bindingType1 || (item as any).customBinding1,
                      (item as any).bindingType2 || (item as any).customBinding2,
                    ].filter(Boolean).join(" / ");
                    const canInspectSpecifications = !isStandaloneDesignItem(item) && (!isDesign || requestTypes.includes("sample"));

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-[var(--surface-low)]/55 ${isChecked ? "bg-[var(--accent-primary-subtle)]/60" : ""}`}
                      >
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="inline-flex rounded p-1 text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                            aria-label={`${isChecked ? "Deselect" : "Select"} ${requestCode}`}
                          >
                            {isChecked ? (
                              <CheckSquare className="h-4 w-4 text-[var(--accent-primary)]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <div className="truncate font-mono text-xs font-bold text-[var(--on-surface)]" title={requestCode}>{requestCode}</div>
                          <div className="mt-1 truncate text-[10px] text-[var(--on-surface-subtle)]" title={sourceProductCode || item.srNumber}>
                            {sourceProductCode ? `Product: ${sourceProductCode}` : item.srNumber && item.srNumber !== requestCode ? `SR ${item.srNumber}` : item.creationMode === "binding" ? "Binding product" : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-sans">
                          <div className="line-clamp-2 text-sm font-medium leading-snug text-[var(--on-surface)]" title={item.productDescription}>
                            {item.productDescription || "Untitled product"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-[var(--on-surface-muted)]">
                          {isDesignPackage
                            ? item.trend || <span className="text-[var(--on-surface-subtle)]">-</span>
                            : bindingStyle || item.trend || <span className="text-[var(--on-surface-subtle)]">-</span>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {requestTypes.map((type) => (
                              <span key={type} className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${requestTypeStyles[type]}`}>
                                {requestTypeLabels[type]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                            isStandaloneDesignItem(item) || isCustom
                              ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
                              : "bg-[var(--surface-low)] text-[var(--on-surface-muted)]"
                          }`}>
                            {isStandaloneDesignItem(item) ? "Design brief" : isCustom ? "Binding" : "Catalog ref"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-medium text-[var(--on-surface-muted)]">
                          <div className="space-y-1">
                            {requestTypes.map((type) => (
                              <div key={type} className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[var(--on-surface-subtle)]">{requestTypeLabels[type]}</span>
                                <span className="tabular-nums">{formatDraftQuantity(item, type)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canInspectSpecifications && (
                              <button
                                type="button"
                                onClick={() => handleOpenSpecsDrawer(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                                title="Inspect and edit specifications"
                                aria-label={`Inspect specifications for ${requestCode}`}
                              >
                                <Sliders className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditMetadata(item)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                              title={isStandaloneDesignItem(item) ? "Edit design request" : "Edit product details"}
                              aria-label={`Edit details for ${requestCode}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCloneItem(item)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                              title={isStandaloneDesignItem(item) ? "Copy design brief" : "Copy product"}
                              aria-label={isStandaloneDesignItem(item) ? "Copy design brief" : "Copy product"}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Release Confirmation Modal */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="draft-release-title" className="w-full max-w-lg space-y-5 rounded-2xl bg-[var(--surface-lowest)] p-5 text-[var(--on-surface)] shadow-2xl ring-1 ring-[var(--border-subtle)] sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="draft-release-title" className="text-base font-bold font-display">
                    Release to {releaseDestinations.join(" and ") || "Workflow"}
                  </h3>
                  <span className="text-xs text-[var(--on-surface-muted)]">
                    {selectedIds.size > 0 ? "Releasing selected subset" : "Releasing entire package"} to {releaseDestinations.join(" and ") || "the workflow"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                aria-label="Close release confirmation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-[var(--surface-low)] p-4 text-xs">
              <div>
                <span className="text-[var(--on-surface-muted)]">Customer: </span>
                <span className="font-semibold">{packageContext.customer}</span>
              </div>
              <div>
                <span className="text-[var(--on-surface-muted)]">Program: </span>
                <span className="font-semibold">{packageContext.programName}</span>
              </div>
              <div>
                <span className="text-[var(--on-surface-muted)]">Items to release: </span>
                <span className="font-semibold text-[var(--accent-primary-strong)]">{itemsToReleaseCount} item(s)</span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-[var(--on-surface-muted)]">
              Unchanged Sampling requests go directly to <strong>Plant</strong>; edited or duplicated Sampling variants go to <strong>Creative</strong> first. Design requests go to <strong>Creative</strong>, and Mockup requests follow their saved design decision.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                disabled={isReleasing}
                className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelease}
                disabled={isReleasing}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent-primary)] shadow-xs transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReleasing ? "Releasing..." : `Confirm Release (${itemsToReleaseCount})`}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-5" role="presentation">
          <form
            onSubmit={handleSaveMetadata}
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-edit-title"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xl ring-1 ring-[var(--border-subtle)]"
          >
            <div className="flex items-start justify-between gap-4 bg-[var(--surface-low)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h3 id="draft-edit-title" className="text-base font-bold font-display">
                  {isStandaloneDesignItem(editingItem) ? "Edit Design Request" : "Edit Product Details"}
                </h3>
                <p className="mt-1 truncate text-sm text-[var(--on-surface-muted)]" title={editingItem.productDescription}>
                  {editingItem.productDescription || editingItem.requestCode || editingItem.srNumber || "Draft product"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {getRequestTypes(editingItem).map((type) => (
                    <span key={type} className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${requestTypeStyles[type]}`}>
                      {requestTypeLabels[type]}
                    </span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                aria-label="Close edit form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div>
                <label htmlFor="draft-edit-description" className={labelClassName}>{editingHasDesign && !editingHasSample && !editingHasMockup && !editingHasCosting ? "Brief description" : "Product description"}</label>
                <input
                  id="draft-edit-description"
                  type="text"
                  required
                  value={editForm.productDescription}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, productDescription: e.target.value }))}
                  className={inputClassName}
                  placeholder="Describe this product"
                />
              </div>

              {(editingHasSample || editingHasMockup || editingHasCosting) && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--on-surface)]">Product identifiers</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="draft-edit-customer-code" className={labelClassName}>Customer product code</label>
                      <input id="draft-edit-customer-code" type="text" value={editForm.customerProductCode} onChange={(e) => setEditForm((prev) => ({ ...prev, customerProductCode: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-brand" className={labelClassName}>Brand</label>
                      <input id="draft-edit-brand" type="text" value={editForm.brandName} onChange={(e) => setEditForm((prev) => ({ ...prev, brandName: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-barcode" className={labelClassName}>Barcode</label>
                      <input id="draft-edit-barcode" type="text" value={editForm.barcode} onChange={(e) => setEditForm((prev) => ({ ...prev, barcode: e.target.value }))} className={inputClassName} />
                    </div>
                  </div>
                </section>
              )}

              {editingHasSample && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--on-surface)]">Sampling details</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-edit-sample-qty" className={labelClassName}>Sampling quantity</label>
                      <input id="draft-edit-sample-qty" type="number" min="1" step="any" value={editForm.qtyForSampling} onChange={(e) => setEditForm((prev) => ({ ...prev, qtyForSampling: e.target.value }))} className={inputClassName} placeholder="Quantity" />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-sample-unit" className={labelClassName}>Unit</label>
                      <select id="draft-edit-sample-unit" value={editForm.unitPcPack} onChange={(e) => setEditForm((prev) => ({ ...prev, unitPcPack: e.target.value }))} className={inputClassName}>
                        <option value="PC">Piece</option>
                        <option value="Pack">Pack</option>
                      </select>
                    </div>
                    {editForm.unitPcPack.toLowerCase() === "pack" && (
                      <div>
                        <label htmlFor="draft-edit-pack-qty" className={labelClassName}>Pieces per pack</label>
                        <input id="draft-edit-pack-qty" type="number" min="1" step="1" value={editForm.qtyPerPack} onChange={(e) => setEditForm((prev) => ({ ...prev, qtyPerPack: e.target.value }))} className={inputClassName} />
                      </div>
                    )}
                    <div>
                      <label htmlFor="draft-edit-sample-date" className={labelClassName}>Sample required date</label>
                      <input id="draft-edit-sample-date" type="date" value={editForm.sampleRequiredDate} onChange={(e) => setEditForm((prev) => ({ ...prev, sampleRequiredDate: e.target.value }))} className={inputClassName} />
                    </div>
                  </div>
                </section>
              )}

              {editingHasMockup && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--on-surface)]">Mockup details</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-edit-mockup-qty" className={labelClassName}>Mockup quantity</label>
                      <input id="draft-edit-mockup-qty" type="number" min="1" step="any" value={editForm.qtyForMockup} onChange={(e) => setEditForm((prev) => ({ ...prev, qtyForMockup: e.target.value }))} className={inputClassName} placeholder="Quantity" />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-mockup-date" className={labelClassName}>Mockup required date</label>
                      <input id="draft-edit-mockup-date" type="date" value={editForm.mockupRequiredDate} onChange={(e) => setEditForm((prev) => ({ ...prev, mockupRequiredDate: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-mockup-shutterstock" className={labelClassName}>Shutterstock number</label>
                      <input id="draft-edit-mockup-shutterstock" type="text" value={editForm.mockupShutterstockNo} onChange={(e) => setEditForm((prev) => ({ ...prev, mockupShutterstockNo: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-mockup-notes" className={labelClassName}>Mockup notes</label>
                      <input id="draft-edit-mockup-notes" type="text" value={editForm.mockupRemark} onChange={(e) => setEditForm((prev) => ({ ...prev, mockupRemark: e.target.value }))} className={inputClassName} />
                    </div>
                  </div>
                  <label className="flex items-start gap-2.5 rounded-lg bg-[var(--surface-low)] px-3 py-2.5 text-xs text-[var(--on-surface)]">
                    <input type="checkbox" checked={editForm.mockupDesignNeeded} onChange={(e) => setEditForm((prev) => ({ ...prev, mockupDesignNeeded: e.target.checked }))} className="mt-0.5 accent-[var(--accent-primary)]" />
                    <span><span className="block font-semibold">Creative design is needed</span><span className="mt-0.5 block text-[11px] text-[var(--on-surface-muted)]">Clear this for a direct-to-Studio mockup.</span></span>
                  </label>
                </section>
              )}

              {editingHasCosting && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--on-surface)]">Costing details</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-edit-costing-qty" className={labelClassName}>Costing quantity</label>
                      <input id="draft-edit-costing-qty" type="number" min="1" step="any" value={editForm.qtyDesignCosting} onChange={(e) => setEditForm((prev) => ({ ...prev, qtyDesignCosting: e.target.value }))} className={inputClassName} placeholder="Quantity" />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-costing-date" className={labelClassName}>Costing required date</label>
                      <input id="draft-edit-costing-date" type="date" value={editForm.costingRequiredDate} onChange={(e) => setEditForm((prev) => ({ ...prev, costingRequiredDate: e.target.value }))} className={inputClassName} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2.5 text-xs text-[var(--on-surface)]">
                    <input type="checkbox" checked={editForm.costingCreativeInputNeeded} onChange={(e) => setEditForm((prev) => ({ ...prev, costingCreativeInputNeeded: e.target.checked }))} className="accent-[var(--accent-primary)]" />
                    Creative input is needed for costing
                  </label>
                  {editForm.costingCreativeInputNeeded && (
                    <div>
                    <label htmlFor="draft-edit-costing-notes" className={labelClassName}>Creative input notes</label>
                      <textarea id="draft-edit-costing-notes" rows={2} value={editForm.costingCreativeInputRemark} onChange={(e) => setEditForm((prev) => ({ ...prev, costingCreativeInputRemark: e.target.value }))} className={inputClassName + " resize-y"} />
                    </div>
                  )}
                </section>
              )}

              {editingHasDesign && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold text-[var(--on-surface)]">Design brief</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="draft-edit-design-count" className={labelClassName}>Designs requested</label>
                      <input id="draft-edit-design-count" type="number" min="1" max="100" required value={editForm.numberOfDesigns} onChange={(e) => setEditForm((prev) => ({ ...prev, numberOfDesigns: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-design-date" className={labelClassName}>Artwork required date</label>
                      <input id="draft-edit-design-date" type="date" value={editForm.designRequiredDate} onChange={(e) => setEditForm((prev) => ({ ...prev, designRequiredDate: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-trend" className={labelClassName}>Trend / theme</label>
                      <input id="draft-edit-trend" type="text" value={editForm.trend} onChange={(e) => setEditForm((prev) => ({ ...prev, trend: e.target.value }))} className={inputClassName} />
                    </div>
                    <div>
                      <label htmlFor="draft-edit-audience" className={labelClassName}>Target audience</label>
                      <input id="draft-edit-audience" type="text" value={editForm.targetAudience} onChange={(e) => setEditForm((prev) => ({ ...prev, targetAudience: e.target.value }))} className={inputClassName} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="draft-edit-design-notes" className={labelClassName}>Design notes</label>
                    <textarea id="draft-edit-design-notes" rows={3} value={editForm.designRemarks} onChange={(e) => setEditForm((prev) => ({ ...prev, designRemarks: e.target.value }))} className={inputClassName + " resize-y"} />
                  </div>
                </section>
              )}
            </div>

            <div className="flex justify-end gap-2 bg-[var(--surface-low)] px-5 py-3.5 sm:px-6">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingMetadata}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent-primary)] transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingMetadata ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Specifications Drawer */}
      {specItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45 animate-smooth-backdrop" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="draft-spec-title" className="flex h-full w-full max-w-2xl flex-col bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xl ring-1 ring-[var(--border-subtle)] animate-smooth-drawer">
            {/* Drawer Header */}
            <div className="flex shrink-0 items-start justify-between gap-4 bg-[var(--surface-low)] px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--surface-container)] px-2 py-1 font-mono text-[10px] font-bold text-[var(--on-surface)]">
                    {specItem.requestCode || specItem.materialCode || specItem.srNumber || "Draft"}
                  </span>
                  {getRequestTypes(specItem).map((type) => (
                    <span key={type} className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${requestTypeStyles[type]}`}>
                      {requestTypeLabels[type]}
                    </span>
                  ))}
                </div>
                <h3 id="draft-spec-title" className="mt-2 text-base font-bold font-display">Product specifications</h3>
                <p className="mt-1 truncate text-sm text-[var(--on-surface-muted)]" title={specItem.productDescription}>
                  {specItem.productDescription || "Draft product"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSpecItem(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                aria-label="Close specifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <p className="text-xs leading-relaxed text-[var(--on-surface-muted)]">
                Review the saved product characteristics and update the values needed for its request.
              </p>

              {isLoadingSpecs ? (
                <div className="py-12 text-center text-sm text-[var(--on-surface-muted)]" role="status">Loading product specifications</div>
              ) : specLoadError ? (
                <div className="rounded-xl bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
                  <p className="font-semibold">{specLoadError}</p>
                  <button type="button" onClick={() => handleOpenSpecsDrawer(specItem)} className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                    Retry loading
                  </button>
                </div>
              ) : specDetails.length === 0 ? (
                <div className="rounded-xl bg-[var(--surface-low)] px-5 py-8 text-center">
                  <p className="text-sm font-semibold text-[var(--on-surface)]">No specifications found</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--on-surface-muted)]">This product does not have any saved characteristic values to edit.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(specificationGroups).map(([groupName, rows]) => (
                    <section key={groupName}>
                      <h4 className="mb-1 text-xs font-bold text-[var(--on-surface)]">{groupName}</h4>
                      <div className="divide-y divide-[var(--border-subtle)]/70">
                        {rows.map(({ detail, index }) => (
                          <div key={detail.id || `${groupName}-${detail.characteristicName}`} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:items-center sm:gap-5">
                            <div className="min-w-0">
                              <label htmlFor={`draft-spec-${detail.id || index}`} className="block text-xs font-semibold text-[var(--on-surface)]">
                                {detail.characteristicName || "Unnamed characteristic"}
                              </label>
                              {detail.uom && <span className="mt-0.5 block text-[10px] text-[var(--on-surface-muted)]">Unit: {detail.uom}</span>}
                            </div>
                            {detail.options && detail.options.length > 0 ? (
                              <select
                                id={`draft-spec-${detail.id || index}`}
                                value={detail.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSpecDetails((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, value } : row));
                                }}
                                className={inputClassName}
                              >
                                <option value="">Not specified</option>
                                {detail.options.map((option: string) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            ) : (
                              <input
                                id={`draft-spec-${detail.id || index}`}
                                type="text"
                                value={detail.value === "NA" ? "" : detail.value || ""}
                                placeholder="Enter value"
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setSpecDetails((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, value } : row));
                                }}
                                className={inputClassName}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="flex shrink-0 justify-end gap-2 bg-[var(--surface-low)] px-5 py-3.5 sm:px-6">
              <button
                type="button"
                onClick={() => setSpecItem(null)}
                className="min-h-10 rounded-lg px-4 text-sm font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSpecs}
                disabled={isSavingSpecs || isLoadingSpecs || Boolean(specLoadError) || specDetails.length === 0}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent-primary)] transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{isSavingSpecs ? "Saving..." : "Save changes"}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default DraftWorkspacePage;
