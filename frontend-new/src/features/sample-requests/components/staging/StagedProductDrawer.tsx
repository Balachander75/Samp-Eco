import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Copy,
  ExternalLink,
  Pencil,
  Check,
  LoaderCircle,
  RotateCcw,
  ImageIcon,
  Lock,
  Calendar,
} from "lucide-react";
import { StagedProductItem, DELIVERABLES } from "../../types/staging";
import { fetchProductDetailsApi, ProductDetailItem } from "@/infrastructure/api/masterApi";
import { isMockupCreativeCharacteristic } from "./mockupCreativeFields";
import { ScopeReferenceImagesGallery } from "./ScopeReferenceImagesGallery";

const editableCharacteristicValue = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return ["NA", "N/A", "NONE", "NULL", "NAN", "—", "-"].includes(normalized.toUpperCase()) ? "" : normalized;
};

export interface StagedProductDrawerProps {
  inspectingProduct: StagedProductItem | null;
  isFeasibilityHandoff?: boolean;
  programYear: string;
  programContext?: {
    customer?: string;
    programName?: string;
    programYear?: string;
  };
  onClose: () => void;
  onRemoveProduct: (id: string) => void;
  onDuplicateProduct: (item: StagedProductItem) => void;
  onEditProduct?: (item: StagedProductItem) => void;
  onSaveCustomDetails?: (
    item: StagedProductItem,
    details: NonNullable<StagedProductItem["customDetails"]>,
    productDescription: string,
    hasCreativeChanges?: boolean,
    creativePendingCharacteristicKeys?: Array<{ className: string; characteristicName: string }>
  ) => Promise<void>;
}

export const StagedProductDrawer: React.FC<StagedProductDrawerProps> = ({
  inspectingProduct,
  isFeasibilityHandoff = false,
  programYear,
  programContext,
  onClose,
  onRemoveProduct,
  onDuplicateProduct,
  onEditProduct,
  onSaveCustomDetails,
}) => {
  const [sourceDetails, setSourceDetails] = useState<ProductDetailItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [productDescription, setProductDescription] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [specView, setSpecView] = useState<"configured" | "all">("configured");
  const sourceProductId = inspectingProduct?.sourceSampleRequestId
    || inspectingProduct?.catalogMetadata?.sourceProductId
    || inspectingProduct?.samplingMetadata?.sourceSampleId;
  const detailsRequestId = sourceProductId || inspectingProduct?.savedRequestId;

  const isDesignBrief = Boolean(
    inspectingProduct &&
    inspectingProduct.scopes.includes("design") &&
    (inspectingProduct.scopes.length === 1 || !inspectingProduct.catalogMetadata || Boolean(inspectingProduct.designMetadata))
  );
  const canDuplicate = Boolean(
    !isFeasibilityHandoff && inspectingProduct?.scopes.length === 1 && inspectingProduct.scopes[0] === "sample"
  );

  const designDesc = inspectingProduct?.productDescription || "";
  const designCount = inspectingProduct?.designMetadata?.numberOfDesigns || 1;
  const designDueDate = inspectingProduct?.designMetadata?.designRequiredDate || inspectingProduct?.sampleRequiredDate || "";
  const designTrend =
    inspectingProduct?.designMetadata?.trend ||
    inspectingProduct?.customDetails?.find(
      (d) => (d.characteristicName || d.characteristic_name)?.toUpperCase() === "TREND"
    )?.value ||
    "";
  const designAudience =
    inspectingProduct?.designMetadata?.targetAudience ||
    inspectingProduct?.customDetails?.find(
      (d) => (d.characteristicName || d.characteristic_name)?.toUpperCase() === "TARGET AUDIENCE"
    )?.value ||
    "";
  const designRemarks = inspectingProduct?.designMetadata?.remarks || inspectingProduct?.mockupMetadata?.marketingRemark || "";
  const uploadedImages = inspectingProduct?.designMetadata?.images || [];
  const webLinks = inspectingProduct?.designMetadata?.webLinks || [];
  const totalAttachments = uploadedImages.length + webLinks.length;

  useEffect(() => {
    setProductDescription(inspectingProduct?.productDescription || "");
    setEditedDescription(inspectingProduct?.productDescription || "");
    setSpecView("configured");
  }, [inspectingProduct?.id, inspectingProduct?.productDescription]);

  useEffect(() => {
    let cancelled = false;
    setSourceDetails([]);
    setIsEditingDetails(false);
    setDetailsError("");
    if (!detailsRequestId || isDesignBrief) return;

    setIsLoadingDetails(true);
    // Load the full catalog so the All view can include blank characteristics.
    // Scope it back to classes represented by saved detail rows on this product.
    // A staged item can point to any Marketing user's catalog product. This
    // is a read-only source lookup; saving still targets the current draft.
    fetchProductDetailsApi(detailsRequestId, false, false, true)
      .then((details: any) => {
        if (!cancelled) setSourceDetails(details);
      })
      .catch(() => {
        if (!cancelled) setDetailsError("Product characteristics could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDetails(false);
      });
    return () => { cancelled = true; };
  }, [inspectingProduct?.id, detailsRequestId]);

  const characteristics = useMemo(() => {
    const usedClasses = new Set(
      sourceDetails
        .filter((detail) => detail.id >= 0)
        .map((detail) => detail.className.toLowerCase())
    );
    const overrides = inspectingProduct?.customDetails || [];
    overrides.forEach((detail) => {
      const className = detail.className || detail.class_name;
      if (className) usedClasses.add(className.toLowerCase());
    });
    const source = sourceDetails.filter((detail) => usedClasses.has(detail.className.toLowerCase())).map((detail) => ({
      id: detail.id,
      sampleRequestId: detail.sampleRequestId,
      className: detail.className,
      characteristicName: detail.characteristicName,
      value: detail.value,
      uom: detail.uom,
      options: detail.options || [],
    }));
    const merged = source.map((detail) => {
      const override = overrides.find((candidate) =>
        (candidate.className || candidate.class_name || "").toLowerCase() === detail.className.toLowerCase() &&
        (candidate.characteristicName || candidate.characteristic_name || "").toLowerCase() === detail.characteristicName.toLowerCase()
      );
      return override ? { ...detail, value: override.value } : detail;
    });
    for (const override of overrides) {
      const className = override.className || override.class_name || "Product";
      const characteristicName = override.characteristicName || override.characteristic_name || "";
      if (characteristicName && !merged.some((detail) =>
        detail.className.toLowerCase() === className.toLowerCase() &&
        detail.characteristicName.toLowerCase() === characteristicName.toLowerCase()
      )) {
        merged.push({
          id: -1,
          sampleRequestId: Number(detailsRequestId) || 0,
          className,
          characteristicName,
          value: override.value,
          uom: override.uom || null,
          options: [],
        });
      }
    }
    return merged;
  }, [detailsRequestId, sourceDetails, inspectingProduct?.customDetails]);

  const characteristicGroups = useMemo(() => {
    const groups = new Map<string, typeof characteristics>();
    const visibleCharacteristics = specView === "configured"
      ? characteristics.filter((detail) => {
          const value = String(detail.value ?? "").trim().toUpperCase();
          return value && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(value);
        })
      : characteristics;
    visibleCharacteristics.forEach((detail) => {
      const current = groups.get(detail.className) || [];
      current.push(detail);
      groups.set(detail.className, current);
    });
    return [...groups.entries()];
  }, [characteristics, specView]);

  const configuredCharacteristicCount = useMemo(() => characteristics.filter((detail) => {
    const value = String(detail.value ?? "").trim().toUpperCase();
    return value && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(value);
  }).length, [characteristics]);

  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    characteristics.forEach((detail) => {
      const value = editableCharacteristicValue(detail.value);
      values[`${detail.className}::${detail.characteristicName}`] = value;
    });
    return values;
  }, [characteristics]);

  const sourceValues = useMemo(() => {
    const values: Record<string, string> = {};
    sourceDetails.forEach((detail) => {
      values[`${detail.className}::${detail.characteristicName}`] = editableCharacteristicValue(detail.value);
    });
    return values;
  }, [sourceDetails]);

  useEffect(() => setEditedValues(initialValues), [initialValues]);

  const handleSaveDetails = async () => {
    if (!inspectingProduct || !onSaveCustomDetails) return;
    setIsSavingDetails(true);
    setDetailsError("");
    try {
      const isSampleRequest = inspectingProduct.scopes.includes("sample");
      const isExplicitlyNew = inspectingProduct.creationMode === "new" || inspectingProduct.samplingMetadata?.searchMode === "new";
      const matCode = String(inspectingProduct.materialCode || "").trim().toUpperCase();
      const hasExistingSampleSource = !isExplicitlyNew && Boolean(
        sourceProductId ||
        inspectingProduct.sourceSampleCode ||
        inspectingProduct.catalogMetadata?.sourceMaterialCode ||
        inspectingProduct.samplingMetadata?.selectedMaterialCode ||
        (inspectingProduct.creationMode && inspectingProduct.creationMode !== "new") ||
        (inspectingProduct.samplingMetadata?.searchMode && inspectingProduct.samplingMetadata?.searchMode !== "new") ||
        (matCode && !matCode.startsWith("TMP-") && !matCode.startsWith("NEW-"))
      );
      const anyChangedFromCurrent = characteristics.some((detail) => {
        const key = `${detail.className}::${detail.characteristicName}`;
        const original = (initialValues[key] || "").trim();
        const current = (editedValues[key] || "").trim();
        return original !== current;
      });
      const anyChangedFromSource = characteristics.some((detail) => {
        const key = `${detail.className}::${detail.characteristicName}`;
        const sourceValue = sourceValues[key] ?? initialValues[key] ?? "";
        const current = (editedValues[key] || "").trim();
        return sourceValue.trim() !== current;
      });
      const anyChanged = isSampleRequest
        ? (hasExistingSampleSource ? anyChangedFromSource : anyChangedFromCurrent)
        : anyChangedFromCurrent;

      const creativePendingCharacteristicKeys = (hasExistingSampleSource && anyChangedFromSource)
        ? characteristics
            .filter((detail) =>
              isMockupCreativeCharacteristic(detail.className, detail.characteristicName) &&
              (inspectingProduct.scopes.includes("sample") ||
                Boolean((initialValues[`${detail.className}::${detail.characteristicName}`] || "").trim()))
            )
            .map((detail) => ({ className: detail.className, characteristicName: detail.characteristicName }))
        : isSampleRequest ? [] : inspectingProduct.creativePendingCharacteristicKeys || [];

      // If user changed specifications of an existing product, blank the creative highlighted fields for Creative to fill
      const shouldBlankCreative = hasExistingSampleSource && anyChangedFromSource;
      const details = characteristics.map((detail) => {
        const isCreative = isMockupCreativeCharacteristic(detail.className, detail.characteristicName);
        if (shouldBlankCreative && isCreative) {
          return {
            className: detail.className,
            characteristicName: detail.characteristicName,
            value: "", // blanked for Creative
            uom: detail.uom || null,
          };
        }
        return {
          className: detail.className,
          characteristicName: detail.characteristicName,
          value: editedValues[`${detail.className}::${detail.characteristicName}`]?.trim() || null,
          uom: detail.uom || null,
        };
      });

      const description = editedDescription.trim();
      if (!description) throw new Error("Product description is required.");
      await onSaveCustomDetails(inspectingProduct, details, description, anyChanged, creativePendingCharacteristicKeys);
      setProductDescription(description);
      setSpecView("configured");
      setIsEditingDetails(false);
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : "Specifications could not be saved. Please retry.");
    } finally {
      setIsSavingDetails(false);
    }
  };

  if (!inspectingProduct) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-950/70 transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        <div className={`relative w-full ${isDesignBrief ? "max-w-5xl max-h-[92vh]" : "max-w-3xl max-h-[90vh]"} bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-smooth-modal flex flex-col`}>
          {/* Header */}
          {isDesignBrief ? (
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-display">
                      Creative Design Brief
                    </h3>
                    <span className="font-mono font-bold text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-[var(--accent-primary)]/20">
                      {inspectingProduct.materialCode}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/20 tracking-wider uppercase">
                      DESIGN SPEC
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Review product specifications, creative direction, target due date, and reference artwork
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {onEditProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      const toEdit = inspectingProduct;
                      onClose();
                      onEditProduct(toEdit);
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit Brief</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="font-mono font-bold text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-[var(--accent-primary)]/20">
                  {inspectingProduct.materialCode}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight font-display">
                  Staged Product Specification
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {isEditingDetails ? (
                  <>
                    <button type="button" onClick={() => { setIsEditingDetails(false); setEditedValues(initialValues); setEditedDescription(productDescription); setSpecView("configured"); setDetailsError(""); }} disabled={isSavingDetails} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5">
                      <RotateCcw className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button type="button" onClick={handleSaveDetails} disabled={isSavingDetails || isLoadingDetails} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50">
                      {isSavingDetails ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save specs
                    </button>
                  </>
                ) : onSaveCustomDetails ? (
                  <button type="button" onClick={() => { setIsEditingDetails(true); setSpecView("all"); setEditedDescription(productDescription); }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40">
                    <Pencil className="h-3.5 w-3.5" /> Edit specs
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          {isDesignBrief ? (
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 text-xs">
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
                {/* LEFT COLUMN: Customer Account, Product Description, Trend & Audience, Remarks */}
                <div className="space-y-4 lg:col-span-7">
                  {/* 1. Customer Account & Program */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Customer Account &amp; Program
                    </label>
                    <div className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-[var(--surface-low)]/70 px-3.5 py-2 text-[13px] font-medium text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate font-semibold text-slate-900 dark:text-zinc-100">
                          {programContext?.customer || inspectingProduct.samplingMetadata?.customerReference || "—"}
                        </span>
                        <span className="truncate text-xs text-slate-500 dark:text-zinc-400">
                          {[programContext?.programName, programContext?.programYear || programYear].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-400">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    </div>
                  </div>

                  {/* 2. Product Description */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Product Description
                    </label>
                    <div className="min-h-[88px] w-full rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs leading-relaxed text-slate-900 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words font-medium">
                      {designDesc || "No description provided."}
                    </div>
                  </div>

                  {/* 3. Trend / Theme & Target Demographic / Audience */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 truncate">
                        Trend / Theme
                      </label>
                      <div className="flex min-h-10 w-full items-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-100 break-words">
                        {designTrend || <span className="font-normal text-slate-400">Not specified</span>}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 truncate">
                        Target Audience
                      </label>
                      <div className="flex min-h-10 w-full items-center rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-100 break-words">
                        {designAudience || <span className="font-normal text-slate-400">Not specified</span>}
                      </div>
                    </div>
                  </div>

                  {/* 4. Remarks / Special Notes */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                      Remarks / Special Notes
                    </label>
                    <div className="min-h-[64px] w-full rounded-xl border border-slate-200/80 bg-white p-3 text-xs leading-relaxed text-slate-900 dark:border-white/[0.08] dark:bg-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words">
                      {designRemarks || <span className="font-normal text-slate-400">No special instructions provided.</span>}
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Number of Designs, Design Required Date, Reference Attachments */}
                <div className="space-y-4 rounded-xl border border-zinc-200/80 bg-slate-50/70 dark:bg-zinc-900/60 p-4 dark:border-white/[0.08] lg:col-span-5">
                  {/* Number of Designs */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Number of Designs
                    </label>
                    <div className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3.5 dark:border-zinc-700 dark:bg-zinc-950">
                      <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {designCount}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        variant{Number(designCount) > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Design Required Date */}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Design Required Date
                    </label>
                    <div className="flex h-10 w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
                      <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>{designDueDate || <span className="font-normal text-zinc-400">Not set</span>}</span>
                    </div>
                  </div>

                  {/* Reference Images */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        Reference Images
                      </label>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono transition-colors ${
                          totalAttachments > 0
                            ? "border border-[var(--accent-primary)]/20 bg-emerald-50 text-[var(--accent-primary)] dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {uploadedImages.length}/2 images · {webLinks.length}/1 link
                      </span>
                    </div>

                    {totalAttachments > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                        {uploadedImages.map((img) => (
                          <div
                            key={img.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 text-[11px] shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-8 h-8 rounded object-cover border border-zinc-200 dark:border-zinc-800 shrink-0 cursor-pointer hover:opacity-85"
                                onClick={() => window.open(img.url, "_blank")}
                              />
                              <span className="shrink-0 rounded border border-[var(--accent-primary)]/20 bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-[var(--accent-primary)] dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                                IMG
                              </span>
                              <span className="truncate font-medium text-zinc-800 dark:text-zinc-200" title={img.name}>
                                {img.name}
                              </span>
                              {img.size && (
                                <span className="text-[9.5px] text-zinc-400 font-mono shrink-0">
                                  ({img.size})
                                </span>
                              )}
                            </div>
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-zinc-400 hover:text-[var(--accent-primary)] dark:hover:text-emerald-400"
                              title="Open full image"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}

                        {webLinks.map((url, idx) => (
                          <div
                            key={`link-${idx}`}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 text-[11px] shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="shrink-0 rounded border border-teal-500/20 bg-teal-50 dark:bg-teal-950/40 px-1 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-400 dark:border-teal-300/15 dark:bg-teal-950/40 dark:text-teal-200">
                                URL
                              </span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 items-center gap-1 truncate font-mono text-[11px] text-[var(--accent-primary)] hover:underline dark:text-emerald-400"
                                title={url}
                              >
                                <span className="truncate">{url}</span>
                                <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center bg-white/50 dark:bg-zinc-900/40">
                        <ImageIcon className="w-7 h-7 text-zinc-300 dark:text-zinc-600 mb-1.5" />
                        <span className="text-xs text-zinc-400">No reference images or links attached</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Product Title & Metadata Subtitle */}
            <div>
              {isEditingDetails ? (
                <label className="block space-y-1">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">Product description</span>
                  <input value={editedDescription} onChange={(event) => setEditedDescription(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-zinc-950 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50" maxLength={500} />
                </label>
              ) : (
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50 tracking-tight leading-snug">{productDescription}</h3>
              )}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-zinc-400 font-mono">
                <span>
                  Staged: {inspectingProduct.stagedDate || "2026-10-01"} {inspectingProduct.timestamp}
                </span>
                <span>•</span>
                <span>Season: {programYear}</span>
              </div>
            </div>

            {/* Assigned Deliverables */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {inspectingProduct.scopes.map((scope) => {
                const def = DELIVERABLES.find((d) => d.id === scope);
                const isDesign = scope === "design";
                const isMockup = scope === "mockup";
                const isSample = scope === "sample";
                const isCosting = scope === "costing";

                const badgeStyle = isDesign
                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/40"
                  : isMockup
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
                  : isSample
                  ? "bg-emerald-50 text-[var(--accent-primary)] dark:bg-emerald-950/40 dark:text-emerald-300 border-[var(--accent-primary)]/25"
                  : isCosting
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800/40"
                  : "bg-slate-100 text-slate-800 border-slate-200";

                return (
                  <span
                    key={scope}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${badgeStyle}`}
                  >
                    {def?.label.toUpperCase() || scope.toUpperCase()}
                  </span>
                );
              })}
            </div>

            <ScopeReferenceImagesGallery
              images={inspectingProduct.scopeReferenceImages as any}
              scopes={inspectingProduct.scopes.filter((scope): scope is "sample" | "mockup" | "costing" => scope !== "design")}
              onPreview={(url) => window.open(url, "_blank", "noopener,noreferrer")}
            />

            {/* Commercial Merchandising Taxonomy (Strictly outside technical SAP classes) */}
            {(inspectingProduct.productCategory || inspectingProduct.productSubCategory || inspectingProduct.productThirdCategory) && (
              <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Merchandising Taxonomy
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/80">
                    Commercial Category
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/5 border border-emerald-100/80 dark:border-emerald-900/30">
                    <span className="text-[9.5px] font-mono uppercase text-slate-400 dark:text-zinc-400 block font-medium">Category</span>
                    <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 mt-0.5 block truncate" title={inspectingProduct.productCategory}>
                      {inspectingProduct.productCategory || "—"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/5 border border-emerald-100/80 dark:border-emerald-900/30">
                    <span className="text-[9.5px] font-mono uppercase text-slate-400 dark:text-zinc-400 block font-medium">Sub Category</span>
                    <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 mt-0.5 block truncate" title={inspectingProduct.productSubCategory}>
                      {inspectingProduct.productSubCategory || "—"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/5 border border-emerald-100/80 dark:border-emerald-900/30">
                    <span className="text-[9.5px] font-mono uppercase text-slate-400 dark:text-zinc-400 block font-medium">Third Category</span>
                    <span className="font-bold text-xs text-slate-900 dark:text-zinc-100 mt-0.5 block truncate" title={inspectingProduct.productThirdCategory}>
                      {inspectingProduct.productThirdCategory || "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <section className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-300">Product classes & characteristics</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">View saved values or all characteristics in this product’s classes.</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {characteristicGroups.length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-mono font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300">{characteristicGroups.length} classes</span>}
                  <div role="group" aria-label="Product specifications view" className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
                    <button type="button" aria-pressed={specView === "configured"} onClick={() => setSpecView("configured")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${specView === "configured" ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 dark:text-zinc-400"}`}>Configured <span className="ml-1 font-mono">{configuredCharacteristicCount}</span></button>
                    <button type="button" aria-pressed={specView === "all"} onClick={() => setSpecView("all")} className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${specView === "all" ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white" : "text-slate-500 dark:text-zinc-400"}`}>All</button>
                  </div>
                </div>
              </div>
              {inspectingProduct.scopes.includes("mockup") && inspectingProduct.mockupMetadata?.designNeeded === true && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/25 dark:text-amber-200">
                  Highlighted characteristic values will be cleared from this request on release and completed by Creative. The source catalog product stays unchanged.
                </div>
              )}
              {isLoadingDetails ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading product specifications…</div>
              ) : characteristicGroups.length ? (
                <div className="space-y-2">
                  {characteristicGroups.map(([className, details]) => (
                    <details key={className} open className="overflow-hidden rounded-lg border border-slate-200 dark:border-white/10">
                      <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 px-3 py-2 dark:bg-white/[0.035]">
                        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{className.replace(/_/g, " ")}</span>
                        <span className="text-[10px] font-mono text-slate-400">{details.length} characteristics</span>
                      </summary>
                      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                        {details.map((detail) => {
                          const key = `${detail.className}::${detail.characteristicName}`;
                          const currentValue = String(detail.value ?? "").trim().toUpperCase();
                          const creativeOwned = inspectingProduct.scopes.some((scope) => scope !== "design") &&
                            isMockupCreativeCharacteristic(detail.className, detail.characteristicName);
                          const creativeInput = inspectingProduct.scopes.includes("mockup") &&
                            inspectingProduct.mockupMetadata?.designNeeded === true &&
                            isMockupCreativeCharacteristic(detail.className, detail.characteristicName) &&
                            currentValue !== "" && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(currentValue);
                          return (
                            <div key={key} className={`grid grid-cols-[minmax(0,1fr)_minmax(180px,1.1fr)_48px] items-center gap-3 px-3 py-2 ${creativeOwned ? "border-l-2 border-rose-500 bg-rose-50/80 dark:border-rose-400 dark:bg-rose-950/25" : ""}`}>
                              <span className="min-w-0 break-words text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                                {detail.characteristicName.replace(/_/g, " ")}
                                {creativeOwned && <span className="ml-2 inline-flex rounded-full bg-rose-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">Creative</span>}
                              </span>
                              {isEditingDetails ? detail.options.length ? (
                                <select disabled={creativeInput} value={editedValues[key] || ""} onChange={(event) => setEditedValues((current) => ({ ...current, [key]: event.target.value }))} className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100">
                                  <option value="">— Select —</option>
                                  {detail.options.map((option: any) => <option key={option} value={option}>{option}</option>)}
                                  {!!editedValues[key] && !detail.options.includes(editedValues[key]) && <option value={editedValues[key]}>{editedValues[key]}</option>}
                                </select>
                              ) : (
                                <input disabled={creativeInput} value={editedValues[key] || ""} onChange={(event) => setEditedValues((current) => ({ ...current, [key]: event.target.value }))} className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100" placeholder="Enter value" />
                              ) : (
                                <span className="min-w-0 break-words text-xs font-semibold text-slate-800 dark:text-zinc-100">{editedValues[key] || <span className="font-normal text-slate-400">Not set</span>}</span>
                              )}
                              <span className="text-right text-[10px] text-slate-400">{detail.uom || ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-zinc-400">{specView === "configured" && characteristics.length ? "No characteristics have saved values. Choose All to view and edit this product’s class characteristics." : "No technical class data is linked to this staged product yet."}</div>
              )}
              {detailsError && <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{detailsError}</p>}
            </section>

            {/* Design Specifications (Clean Key-Value 2x2 Grid) */}
            {inspectingProduct.designMetadata && (
              <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Artwork Variants
                    </span>
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {inspectingProduct.designMetadata.numberOfDesigns} Design(s)
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Target Due Date
                    </span>
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {inspectingProduct.designMetadata.designRequiredDate || ""}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Trend / Theme
                    </span>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 mt-0.5 block break-words">
                      {inspectingProduct.designMetadata.trend || ""}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Target Demographic
                    </span>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 mt-0.5 block break-words">
                      {inspectingProduct.designMetadata.targetAudience || ""}
                    </span>
                  </div>
                </div>

                {/* Remarks / Special Instructions */}
                {inspectingProduct.designMetadata.remarks && (
                  <div className="p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
                    <span className="text-[10px] font-mono uppercase font-semibold text-amber-700 dark:text-amber-400 block mb-1">
                      Special Instructions / Remarks
                    </span>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                      {inspectingProduct.designMetadata.remarks}
                    </p>
                  </div>
                )}

                {/* Reference Attachments Preview */}
                {(inspectingProduct.designMetadata.images.length > 0 ||
                  inspectingProduct.designMetadata.webLinks.length > 0) && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1.5 font-medium">
                      Reference Attachments ({inspectingProduct.designMetadata.images.length} image(s),{" "}
                      {inspectingProduct.designMetadata.webLinks.length} link(s))
                    </span>
                    <div className="space-y-2">
                      {inspectingProduct.designMetadata.images.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {inspectingProduct.designMetadata.images.map((img) => (
                            <div
                              key={img.id}
                              className="p-2 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-2.5 bg-zinc-50/50 dark:bg-zinc-900/50"
                            >
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-10 h-10 rounded object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate text-zinc-800 dark:text-zinc-200" title={img.name}>
                                  {img.name}
                                </p>
                                <span className="text-[10px] text-zinc-400 font-mono">{img.size}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {inspectingProduct.designMetadata.webLinks.length > 0 && (
                        <div className="space-y-1">
                          {inspectingProduct.designMetadata.webLinks.map((url, idx) => (
                            <a
                              key={"inspect-link-" + idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-brand-600 dark:text-brand-400 hover:underline font-mono text-[11px] bg-zinc-50/50 dark:bg-zinc-900/50"
                            >
                              <span className="truncate">{url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 ml-1.5 opacity-60" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {inspectingProduct.catalogMetadata && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Catalog reference
                </span>
                <p className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {inspectingProduct.catalogMetadata.sourceMaterialCode}
                  {inspectingProduct.catalogMetadata.sourceRequestNumber &&
                    " / " + inspectingProduct.catalogMetadata.sourceRequestNumber}
                </p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  {inspectingProduct.catalogMetadata.sourceDescription}
                </p>
                {(inspectingProduct.catalogMetadata.bindingType1 ||
                  inspectingProduct.catalogMetadata.bindingType2) && (
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Binding: {[
                      inspectingProduct.catalogMetadata.bindingType1,
                      inspectingProduct.catalogMetadata.bindingType2,
                    ].filter(Boolean).join(" / ")}
                  </p>
                )}
              </div>
            )}
            {inspectingProduct.scopes.includes("costing") && (
              <section className="space-y-3 rounded-xl border border-teal-200/80 bg-teal-50/40 p-3.5 dark:border-teal-800/50 dark:bg-teal-950/15">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">Costing Details</h4>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ["Quantity for costing", inspectingProduct.qtyDesignCosting || "—"],
                    ["Customer SKU", inspectingProduct.customerProductCode || "—"],
                    ["Barcode", inspectingProduct.barcode || "—"],
                    ["Brand", inspectingProduct.brandName || "—"],
                    ["Costing required date", inspectingProduct.costingRequiredDate || "—"],
                    ["Creative input needed", inspectingProduct.costingCreativeInputNeeded ? "Yes — Creative first" : "No — direct to Costing"],
                    ["Unit", inspectingProduct.unitPcPack || "—"],
                    ...(inspectingProduct.unitPcPack === "Pack" ? [["Pieces per pack", inspectingProduct.qtyPerPack || "—"]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-white/75 p-2.5 dark:bg-white/[0.04]">
                      <span className="block text-[9px] uppercase text-teal-700/75 dark:text-teal-300/75">{label}</span>
                      <span className="mt-0.5 block break-words text-xs font-semibold text-slate-900 dark:text-zinc-100">{value}</span>
                    </div>
                  ))}
                </div>
                {inspectingProduct.costingCreativeInputNeeded && inspectingProduct.costingCreativeInputRemark && <p className="rounded-lg bg-white/75 p-2.5 text-xs leading-relaxed text-slate-700 dark:bg-white/[0.04] dark:text-zinc-300"><span className="mb-1 block text-[9px] font-semibold uppercase text-teal-700/75 dark:text-teal-300/75">Remark for Creative</span>{inspectingProduct.costingCreativeInputRemark}</p>}
              </section>
            )}
            {/* Sampling Specifications */}
            {(inspectingProduct.scopes.includes("sample") || inspectingProduct.samplingMetadata) && (
              <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg border border-blue-200/80 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30">
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block uppercase font-medium">
                      Sample Scope Type
                    </span>
                    <span className="font-mono font-bold text-sm text-blue-950 dark:text-blue-100 mt-0.5 block">
                      {inspectingProduct.samplingMetadata?.sampleType === "partial"
                        ? "Partial Sample (Component / Dummy)"
                        : "Full Sample (Finished Unit)"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-emerald-200/80 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30">
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block uppercase font-medium">
                      Sample Quantity & Unit
                    </span>
                    <span className="font-mono font-bold text-sm text-emerald-950 dark:text-emerald-100 mt-0.5 block">
                      {inspectingProduct.qtyForSampling || "1"} {inspectingProduct.unitPcPack || "PC"}
                      {inspectingProduct.unitPcPack === "Pack" && inspectingProduct.qtyPerPack ? ` (${inspectingProduct.qtyPerPack} pcs/pack)` : ""}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Selection Source
                    </span>
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {inspectingProduct.samplingMetadata?.searchMode === "binding"
                        ? "Binding Structure"
                        : inspectingProduct.samplingMetadata?.searchMode === "new"
                          ? "New Item Formulation"
                          : "Material Code Search"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Binding 1 (Primary)
                    </span>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {inspectingProduct.samplingMetadata?.bindingType1 || inspectingProduct.customBinding1 || "Standard / As Per Sample"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                    <span className="text-[10px] font-mono text-zinc-400 block uppercase font-medium">
                      Binding 2 (Spine)
                    </span>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {inspectingProduct.samplingMetadata?.bindingType2 || inspectingProduct.customBinding2 || "Standard / None"}
                    </span>
                  </div>
                </div>

                {inspectingProduct.samplingMetadata?.partialRequirements && (
                  <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-sans">
                    <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 block uppercase font-medium mb-1">
                      Partial Sample Details:
                    </span>
                    <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                      {inspectingProduct.samplingMetadata.partialRequirements}
                    </p>
                  </div>
                )}

                {inspectingProduct.samplingMetadata?.sourceSrNumber && (
                  <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                    <span>Database Source Sample Ref:</span>
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {inspectingProduct.samplingMetadata.sourceSrNumber}
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-white/[0.06] bg-[var(--surface-low)] dark:bg-white/[0.02] flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => {
                const toRemove = inspectingProduct.id;
                onClose();
                onRemoveProduct(toRemove);
              }}
              className="h-8 px-3 rounded-xl text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              title="Remove from staging"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove from Staging</span>
            </button>

            <div className="flex items-center gap-2">
              {onEditProduct && (
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = inspectingProduct;
                    onClose();
                    onEditProduct(toEdit);
                  }}
                  className="h-8 px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border border-blue-200/80 dark:border-blue-800/40"
                  title={isDesignBrief ? "Edit creative design brief" : "Edit this staged specification"}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isDesignBrief ? "Edit Brief" : "Edit setup"}</span>
                </button>
              )}

              {canDuplicate && (
                <button
                  type="button"
                  onClick={() => {
                    const toDuplicate = inspectingProduct;
                    onClose();
                    onDuplicateProduct(toDuplicate);
                  }}
                  className="h-8 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="h-8 px-4 rounded-xl text-white text-xs font-bold cursor-pointer transition-all shadow-[0_2px_10px_rgba(0,109,50,0.25)] hover:shadow-[0_4px_14px_rgba(0,109,50,0.35)] bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
