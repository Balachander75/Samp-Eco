import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
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
import { SampleRequestItem } from "../types";
import {
  fetchDraftMarketingRequestsApi,
  updateSampleRequestApi,
  updateDesignRequestApi,
  deleteAnyRequestApi,
  fetchProductDetailsApi,
  saveProductDetailsApi,
  createSampleRequestApi,
  createDesignRequestApi,
  releaseDraftRequestsApi,
  ProductDetailItem,
} from "@/infrastructure/api";
import type { DraftPackageContext } from "./DraftPackagesView";
import { getDraftReleaseStatus, isDesignRequest } from "../utils/trackTypes";

export interface DraftWorkspacePageProps {
  user?: UserProfile | null;
}

const isStandaloneDesignItem = (item: SampleRequestItem) =>
  String(item.id).startsWith("design-") || (item.requestKind === "design" && Boolean(item.designRequestId));

const designRequestId = (item: SampleRequestItem) =>
  item.designRequestId || Number(String(item.id).replace(/^design-/, ""));

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
    materialCode: "",
    productDescription: "",
    customerProductCode: "",
    barcode: "",
    unitPcPack: "1",
    qtyForSampling: "1",
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
    setEditForm({
      materialCode: item.materialCode || "",
      productDescription: item.productDescription || "",
      customerProductCode: item.customerProductCode || "",
      barcode: item.barcode || "",
      unitPcPack: String(item.unitPcPack || "1"),
      qtyForSampling: String(item.qtyForSampling || "1"),
      numberOfDesigns: String(item.numberOfDesigns || 1),
      designRequiredDate: item.designRequiredDate || item.targetArtworkDateCreative || "",
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
      } else if (isDesignRequest(editingItem)) {
        const saved = await updateSampleRequestApi(editingItem.id, {
          productDescription: editForm.productDescription.trim(),
          numberOfDesigns: Number(editForm.numberOfDesigns),
          targetArtworkDateCreative: editForm.designRequiredDate,
          trend: editForm.trend.trim(),
          targetAudience: editForm.targetAudience.trim(),
          designRemarks: editForm.designRemarks.trim(),
          referenceImages: editingItem.referenceImages || [],
          referenceLinks: editingItem.referenceLinks || [],
        });
        if (!saved) throw new Error("Linked design request was not updated.");
      } else {
        const saved = await updateSampleRequestApi(editingItem.id, {
          materialCode: editForm.materialCode.trim(),
          productDescription: editForm.productDescription.trim(),
          customerProductCode: editForm.customerProductCode.trim() || undefined,
          barcode: editForm.barcode.trim() || undefined,
          unitPcPack: editForm.unitPcPack.trim(),
          qtyForSampling: editForm.qtyForSampling.trim(),
        });
        if (!saved) throw new Error("Sample request was not updated.");
      }
      showToast(
        isDesignRequest(editingItem)
          ? "Updated design brief."
          : `Updated product "${editForm.materialCode || editingItem.srNumber}".`,
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
    setIsLoadingSpecs(true);
    try {
      const numericId = Number(String(item.id).replace(/^sample-/, ""));
      if (!Number.isInteger(numericId) || numericId <= 0) throw new Error("Sample request ID is invalid.");
      const details = await fetchProductDetailsApi(numericId, false);
      setSpecDetails(details);
    } catch (err) {
      console.error("Failed to fetch product details:", err);
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

  // Delete item
  const handleDeleteItem = async (item: SampleRequestItem) => {
    const id = item.id;
    if (!window.confirm(`Are you sure you want to delete this draft ${isDesignRequest(item) ? "design request" : "product"}?`)) return;
    try {
      const deleted = await deleteAnyRequestApi(item);
      if (!deleted) throw new Error(`Draft ${item.srNumber || id} could not be deleted.`);
      await loadPackageData();
      showToast(`✓ ${isDesignRequest(item) ? "Design request" : "Product"} removed from draft.`, "success");
    } catch (err) {
      console.error("Failed to delete draft product:", err);
      await loadPackageData();
      showToast("Error deleting draft product.", "error");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected draft item(s)?`)) return;
    try {
      const selectedItems = packageItems.filter((item) => selectedIds.has(item.id));
      const results = await Promise.all(selectedItems.map((item) => deleteAnyRequestApi(item)));
      if (results.some((deleted) => !deleted)) throw new Error("One or more selected drafts could not be deleted.");
      await loadPackageData();
      showToast(`✓ Removed ${selectedIds.size} draft item(s).`, "success");
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete selected products:", err);
      await loadPackageData();
      showToast("Error deleting selected items.", "error");
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

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-6 z-50 text-[12px] font-semibold px-4 py-2.5 rounded-lg shadow-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          toastMessage.type === "error"
            ? "bg-rose-900 text-white border-rose-700"
            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-700/50"
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Workspace Header / Program Banner */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-white/[0.08] px-6 py-4 shrink-0 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={handleReturnToDraftQueue}
              className="mt-0.5 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition cursor-pointer"
              title="Return to Sample Requests"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                  {packageContext.customer}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Draft (Pre-SMT)
                </span>
              </div>
              <h1 className="text-base font-bold text-zinc-950 dark:text-zinc-50 tracking-tight mt-0.5">
                {packageContext.programName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  Season: {packageContext.programYear}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  Plant: {packageContext.targetPlant.replace(/^\d+-\s*/, "")}
                </span>
                <span>•</span>
                <span>{packageItems.length} {isDesignPackage ? "Design Briefs" : "Products"} Staged</span>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            {!isDesignPackage && (
              <button
                type="button"
                onClick={() => navigate("/sample-requests/add-product", { state: packageContext })}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsReleaseModalOpen(true)}
              disabled={packageItems.length === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
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
      <div className="flex-1 p-6 overflow-y-auto space-y-3">
        {/* Bulk Action Ribbon if items selected */}
        {selectedIds.size > 0 && (
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-lg px-4 py-2 flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150">
            <span className="text-purple-700 dark:text-purple-300 font-mono">
              {selectedIds.size} of {packageItems.length} {isDesignPackage ? "brief(s)" : "product(s)"} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-2.5 py-1 text-xs rounded border border-rose-300 text-rose-700 dark:text-rose-400 bg-white dark:bg-zinc-900 hover:bg-rose-50 transition cursor-pointer"
              >
                Delete Selected
              </button>
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(true)}
                className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                Release Selected
              </button>
            </div>
          </div>
        )}

        {/* Products Table Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-white/[0.08] text-[11px] font-mono text-zinc-500 uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-4 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="cursor-pointer text-zinc-400 hover:text-zinc-600"
                  >
                    {selectedIds.size === packageItems.length && packageItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Product / SR Code</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">{isDesignPackage ? "Trend" : "Binding Style"}</th>
                <th className="py-3 px-3">{isDesignPackage ? "Request Type" : "Mode"}</th>
                <th className="py-3 px-3">{isDesignPackage ? "Designs Requested" : "Sampling Qty"}</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    Loading package items...
                  </td>
                </tr>
              ) : packageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400">
                    No draft items in this package.
                  </td>
                </tr>
              ) : (
                packageItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  const isDesign = isDesignRequest(item);
                  const isCustom = item.creationMode === "binding" || String(item.materialCode).startsWith("A1-");

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors ${
                        isChecked ? "bg-purple-50/50 dark:bg-purple-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(item.id)}
                          className="cursor-pointer text-zinc-400 hover:text-zinc-600"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Codes */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                          {item.materialCode || "—"}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {item.srNumber}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-3 font-sans text-zinc-800 dark:text-zinc-200 max-w-xs truncate">
                        {item.productDescription}
                      </td>

                      {/* Binding */}
                      <td className="py-3.5 px-3 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {isDesign ? (
                          item.trend || "—"
                        ) : (item as any).bindingType1 || (item as any).customBinding1 ? (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            {(item as any).bindingType1 || (item as any).customBinding1}
                            {(item as any).bindingType2 || (item as any).customBinding2
                              ? ` / ${(item as any).bindingType2 || (item as any).customBinding2}`
                              : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Mode Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDesign || isCustom
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200"
                        }`}>
                          {isDesign ? "DESIGN BRIEF" : isCustom ? "CUSTOM" : "CATALOG REF"}
                        </span>
                      </td>

                      {/* Sampling Quantity */}
                      <td className="py-3.5 px-3 text-zinc-600 dark:text-zinc-400">
                        {isDesign ? `${item.numberOfDesigns || 1} design(s)` : `${item.qtyForSampling || "1"} pc`}
                      </td>

                      {/* Row Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(!isDesign || (item.requestTypes || []).includes("sample")) && (
                            <button
                              type="button"
                              onClick={() => handleOpenSpecsDrawer(item)}
                              className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                              title="Inspect & Edit Specifications"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditMetadata(item)}
                            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                            title={isDesign ? "Edit Design Brief" : "Edit Product Details"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCloneItem(item)}
                            className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
                            title={isDesign ? "Clone Design Brief" : "Clone Product"}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 transition cursor-pointer"
                            title={isDesign ? "Delete Draft Design Request" : "Delete Draft Product"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Release Confirmation Modal */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Release to {releaseDestinations.join(" and ") || "Workflow"}
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {selectedIds.size > 0 ? "Releasing selected subset" : "Releasing entire package"} to {releaseDestinations.join(" and ") || "the workflow"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-zinc-400">Customer: </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{packageContext.customer}</span>
              </div>
              <div>
                <span className="text-zinc-400">Program: </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{packageContext.programName}</span>
              </div>
              <div>
                <span className="text-zinc-400">Items to Release: </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{itemsToReleaseCount} item(s)</span>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Unchanged Sampling requests go directly to <strong>Plant</strong>; edited or duplicated Sampling variants go to <strong>Creative</strong> first. Design requests go to <strong>Creative</strong>, and Mockup requests follow their saved design decision.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReleaseModalOpen(false)}
                disabled={isReleasing}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelease}
                disabled={isReleasing}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isReleasing ? "Releasing..." : `Confirm Release (${itemsToReleaseCount})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70">
          <form
            onSubmit={handleSaveMetadata}
            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-white/[0.08] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">{isDesignRequest(editingItem) ? "Edit Design Brief" : "Edit Product Metadata"}</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              {!isStandaloneDesignItem(editingItem) && (
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                    Material Code
                  </label>
                  <input
                    type="text"
                    value={editForm.materialCode}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, materialCode: e.target.value }))}
                    className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    placeholder="e.g. 6009214 or A1-1001"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                  {isDesignRequest(editingItem) ? "Design Brief" : "Product Description"}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.productDescription}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, productDescription: e.target.value }))}
                  className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>

              {isDesignRequest(editingItem) ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">Designs Requested</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={editForm.numberOfDesigns}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, numberOfDesigns: e.target.value }))}
                        className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">Artwork Due Date</label>
                      <input
                        type="date"
                        value={editForm.designRequiredDate}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, designRequiredDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">Trend / Theme</label>
                      <input
                        type="text"
                        value={editForm.trend}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, trend: e.target.value }))}
                        className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">Target Audience</label>
                      <input
                        type="text"
                        value={editForm.targetAudience}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, targetAudience: e.target.value }))}
                        className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">Marketing Notes</label>
                    <textarea
                      rows={3}
                      value={editForm.designRemarks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, designRemarks: e.target.value }))}
                      className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 resize-y"
                    />
                  </div>
                </>
              ) : (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                    Customer Product Code
                  </label>
                  <input
                    type="text"
                    value={editForm.customerProductCode}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, customerProductCode: e.target.value }))}
                    className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, barcode: e.target.value }))}
                    className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                    Sampling Quantity
                  </label>
                  <input
                    type="text"
                    value={editForm.qtyForSampling}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, qtyForSampling: e.target.value }))}
                    className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-500 mb-1 uppercase font-semibold">
                    Unit / Pack
                  </label>
                  <input
                    type="text"
                    value={editForm.unitPcPack}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, unitPcPack: e.target.value }))}
                    className="w-full px-3 py-2 border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
              </div>
              </>
              )}
            </div>

            <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingMetadata}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition"
              >
                {isSavingMetadata ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Specifications Drawer */}
      {specItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-smooth-backdrop">
          <div className="w-full max-w-xl bg-[var(--surface-lowest)] h-full shadow-2xl flex flex-col border-l border-[var(--border-subtle)] animate-smooth-drawer">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] text-[var(--on-surface)] flex items-center justify-between shrink-0">
              <div>
                <span className="font-mono text-[10px] bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] px-2 py-0.5 rounded font-bold">
                  {specItem.materialCode || specItem.srNumber}
                </span>
                <h3 className="text-sm font-bold mt-1 text-[var(--on-surface)] font-display">Product Characteristic Specifications</h3>
              </div>
              <button
                type="button"
                onClick={() => setSpecItem(null)}
                className="text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] p-1 rounded-lg hover:bg-[var(--surface-container)] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <p className="text-zinc-500 text-[11px] leading-relaxed">
                Review and update characteristic values for this draft product. Changes are saved directly to the database.
              </p>

              {isLoadingSpecs ? (
                <div className="py-12 text-center text-zinc-400">Loading specifications...</div>
              ) : (
                <div className="space-y-3 font-mono">
                  {specDetails.map((detail, idx) => (
                    <div
                      key={detail.id || `${detail.className}-${detail.characteristicName}`}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">
                          {detail.className} • {detail.characteristicName}
                        </span>
                        {detail.uom && (
                          <span className="text-[10px] text-zinc-400">UOM: {detail.uom}</span>
                        )}
                      </div>

                      {detail.options && detail.options.length > 0 ? (
                        <select
                          value={detail.value || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSpecDetails((prev) =>
                              prev.map((d, i) => (i === idx ? { ...d, value: val } : d))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        >
                          <option value="">(None / NA)</option>
                          {detail.options.map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={detail.value === "NA" ? "" : detail.value || ""}
                          placeholder="Enter value"
                          onChange={(e) => {
                            const val = e.target.value;
                            setSpecDetails((prev) =>
                              prev.map((d, i) => (i === idx ? { ...d, value: val } : d))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSpecItem(null)}
                className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveSpecs}
                disabled={isSavingSpecs}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingSpecs ? "Saving..." : "Save Specifications"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraftWorkspacePage;
