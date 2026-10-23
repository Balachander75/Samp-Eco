import React, { useState } from "react";
import { Copy, Eye, Layers, X } from "lucide-react";
import { OperationalDatePicker } from "@/components/erp";
import { StagedProductItem, DELIVERABLES } from "../../types/staging";
import { getSampleTrackInfo } from "../../utils/sampleRouting";

const cellInputClass = "h-10 w-full min-w-[100px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition-shadow focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 disabled:opacity-60";

type RequiredDateField = "mockupRequiredDate" | "sampleRequiredDate" | "costingRequiredDate" | "designRequiredDate";
type QuantityField = "qtyForMockup" | "qtyForSampling" | "qtyDesignCosting" | "designCount";
type MockupExtraField = "marketingShutterstockNo" | "marketingRemark";
type EditableField = keyof StagedProductItem | RequiredDateField | QuantityField | MockupExtraField;

const getRequiredDateRows = (item: StagedProductItem): Array<{ label: string; field: RequiredDateField; value: string }> => [
  ...(item.scopes.includes("mockup") ? [{ label: "Mockup", field: "mockupRequiredDate" as const, value: item.mockupMetadata?.requiredDate || item.mockupRequiredDate || "" }] : []),
  ...(item.scopes.includes("sample") ? [{ label: "Sampling", field: "sampleRequiredDate" as const, value: item.sampleRequiredDate || "" }] : []),
  ...(item.scopes.includes("costing") ? [{ label: "Costing", field: "costingRequiredDate" as const, value: item.costingRequiredDate || "" }] : []),
  ...(item.scopes.includes("design") ? [{ label: "Design", field: "designRequiredDate" as const, value: item.designMetadata?.designRequiredDate || "" }] : []),
];

const getQuantityRows = (item: StagedProductItem): Array<{ label: string; field: QuantityField; value: string }> => [
  ...(item.scopes.includes("design") ? [{ label: "Design", field: "designCount" as const, value: String(item.designMetadata?.numberOfDesigns ?? "") }] : []),
  ...(item.scopes.includes("mockup") ? [{ label: "Mockup", field: "qtyForMockup" as const, value: item.qtyForMockup || item.mockupMetadata?.qtyForMockup || "" }] : []),
  ...(item.scopes.includes("sample") ? [{ label: "Sampling", field: "qtyForSampling" as const, value: item.qtyForSampling || "" }] : []),
  ...(item.scopes.includes("costing") ? [{ label: "Costing", field: "qtyDesignCosting" as const, value: item.qtyDesignCosting || "" }] : []),
];

interface EditableValueProps {
  value?: string;
  placeholder: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
  editable: boolean;
  onCommit: (value: string) => Promise<boolean | void> | boolean | void;
}

const EditableValue: React.FC<EditableValueProps> = ({ value = "", placeholder, label, type = "text", options = [], editable, onCommit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = () => {
    if (!editable || isSaving) return;
    setDraft(value);
    setError("");
    setIsEditing(true);
  };

  const commit = async () => {
    if (isSaving) return;
    if (type === "number" && (!Number.isInteger(Number(draft)) || Number(draft) < 1)) {
      setError("Enter a whole number of at least 1.");
      return;
    }
    if (draft === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      const saved = await onCommit(draft);
      if (saved !== false) {
        setIsEditing(false);
        setError("");
      } else {
        setError("Could not save. Try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (type === "date") {
    return (
      <OperationalDatePicker
        value={value}
        required
        onChange={(nextDate) => {
          if (nextDate !== value) void onCommit(nextDate);
        }}
        placeholder={placeholder}
        disabled={!editable}
        calendarAlign="left"
        compact
        className="min-w-0"
      />
    );
  }

  if (isEditing) {
    const commonProps = {
      "aria-label": label,
      autoFocus: true,
      disabled: isSaving,
      value: draft,
      onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (type === "number") (event.currentTarget as HTMLInputElement).select();
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft(event.target.value),
      onBlur: () => void commit(),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === "Enter") (event.currentTarget as HTMLInputElement).blur();
        if (event.key === "Escape") {
          setDraft(value);
          setError("");
          setIsEditing(false);
        }
      },
      className: cellInputClass,
    };
    return (
      <span className="block min-w-0">
        {type === "select" ? (
          <select {...commonProps}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
        ) : (
          <input {...commonProps} type={type} min={type === "number" ? 1 : undefined} step={type === "number" ? 1 : undefined} placeholder={placeholder} />
        )}
        {error && <span role="alert" className="mt-1 block max-w-[160px] text-[10px] leading-snug text-rose-600">{error}</span>}
      </span>
    );
  }

    return (
      <button
        type="button"
        onClick={startEditing}
        disabled={!editable}
        aria-label={`Edit ${label}`}
        title={editable ? `Click to edit ${label}` : undefined}
        className={`block max-w-full truncate text-left text-xs ${value ? "font-medium text-[var(--on-surface)]" : "text-[var(--on-surface-subtle)]/70 italic"} ${editable ? "cursor-text rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]" : "cursor-default"}`}
      >
        {value || placeholder}
      </button>
    );
};

interface EditableUnitProps {
  unit: string;
  qtyPerPack?: string;
  editable: boolean;
  onCommit: (unit: string, qtyPerPack: string) => Promise<boolean | void> | boolean | void;
}

const EditableUnit: React.FC<EditableUnitProps> = ({ unit, qtyPerPack, editable, onCommit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftUnit, setDraftUnit] = useState(unit || "PC");
  const [draftQty, setDraftQty] = useState(qtyPerPack || (unit === "Pack" ? "" : "1"));
  const [error, setError] = useState("");

  const startEditing = () => {
    if (!editable) return;
    setDraftUnit(unit || "PC");
    setDraftQty(qtyPerPack || (unit === "Pack" ? "" : "1"));
    setError("");
    setIsEditing(true);
  };

  const commit = async () => {
    if (draftUnit === "Pack" && (!Number.isInteger(Number(draftQty)) || Number(draftQty) < 1)) {
      setError("Enter a whole number of at least 1.");
      return;
    }
    const nextQty = draftUnit === "Pack" ? draftQty : "1";
    if (draftUnit === (unit || "PC") && nextQty === (qtyPerPack || (unit === "Pack" ? "" : "1"))) {
      setIsEditing(false);
      return;
    }
    const saved = await onCommit(draftUnit, nextQty);
    if (saved !== false) setIsEditing(false);
    else setError("Could not save. Try again.");
  };

  if (!isEditing) {
    const label = unit === "Pack" ? (qtyPerPack ? `${qtyPerPack}/Pack` : "Pack size missing") : "PC";
    return (
      <button
        type="button"
        onClick={startEditing}
        disabled={!editable}
        aria-label="Edit unit and pieces per pack"
        title={editable ? "Click to edit unit" : undefined}
        className={`rounded-md px-2 py-1 text-[11px] font-semibold ${editable ? "cursor-text hover:bg-[var(--surface-low)]" : "cursor-default"} text-[var(--on-surface-muted)]`}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className="min-w-0"
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) void commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setDraftUnit(unit || "PC");
          setDraftQty(qtyPerPack || (unit === "Pack" ? "" : "1"));
          setError("");
          setIsEditing(false);
        }
        if (event.key === "Enter") (event.target as HTMLElement).blur();
      }}
    >
      <div className="flex items-center gap-1.5">
        <select
          autoFocus
          aria-label="Unit"
          value={draftUnit}
          onChange={(event) => {
            const nextUnit = event.target.value;
            setDraftUnit(nextUnit);
            setDraftQty(nextUnit === "PC" ? "1" : draftUnit === "Pack" ? qtyPerPack || "" : "");
          }}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2 text-sm text-[var(--on-surface)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/15"
        >
          <option value="PC">PC</option>
          <option value="Pack">Pack</option>
        </select>
        {draftUnit === "Pack" && (
          <input
            aria-label="Pieces per pack"
            autoFocus={draftUnit === "Pack"}
            inputMode="numeric"
            type="number"
            min={1}
            step={1}
            value={draftQty}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraftQty(event.target.value)}
            placeholder="Qty"
            className="h-10 w-[76px] shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2 text-sm text-[var(--on-surface)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/15"
          />
        )}
      </div>
      {error && <span role="alert" className="mt-1 block text-[10px] leading-snug text-rose-600">{error}</span>}
    </div>
  );
};

export interface StagingProductListProps {
  stagedProducts: StagedProductItem[];
  isFeasibilityHandoff?: boolean;
  onOpenAddModal?: () => void;
  onInspectProduct: (item: StagedProductItem) => void;
  onUpdateProduct?: (item: StagedProductItem, updates: Partial<StagedProductItem>) => Promise<boolean | void> | boolean | void;
  onDuplicateProduct: (item: StagedProductItem) => void;
  onRemoveProduct: (id: string) => void;
}

export const StagingProductList: React.FC<StagingProductListProps> = ({
  stagedProducts,
  isFeasibilityHandoff = false,
  onInspectProduct,
  onUpdateProduct,
  onDuplicateProduct,
  onRemoveProduct,
}) => {
  const editable = Boolean(onUpdateProduct);
  const updateField = async (item: StagedProductItem, field: EditableField, value: string) => {
    if (!onUpdateProduct) return false;
    if (
      ["costingRequiredDate", "mockupRequiredDate", "sampleRequiredDate", "designRequiredDate"].includes(field)
      && !value.trim()
    ) return false;
    if (
      ["qtyForMockup", "qtyForSampling", "qtyDesignCosting", "designCount"].includes(field)
      && (!Number.isInteger(Number(value)) || Number(value) < 1)
    ) return false;
    let updates: Partial<StagedProductItem>;
    switch (field) {
      case "customerProductCode": updates = { customerProductCode: value.trim() }; break;
      case "barcode": updates = { barcode: value.trim() }; break;
      case "brandName": updates = { brandName: value.trim() }; break;
      case "unitPcPack": updates = { unitPcPack: value, qtyPerPack: value === "Pack" ? item.qtyPerPack || "" : "1" }; break;
      case "qtyPerPack": updates = { qtyPerPack: value.trim() }; break;
      case "qtyForSampling": updates = { qtyForSampling: value.trim() }; break;
      case "qtyDesignCosting": updates = { qtyDesignCosting: value.trim() }; break;
      case "designCount": updates = {
        designMetadata: {
          numberOfDesigns: Number(value) || 1,
          designRequiredDate: item.designMetadata?.designRequiredDate || "",
          trend: item.designMetadata?.trend || "",
          targetAudience: item.designMetadata?.targetAudience || "",
          remarks: item.designMetadata?.remarks,
          images: item.designMetadata?.images || [],
          webLinks: item.designMetadata?.webLinks || [],
          referenceImage: item.designMetadata?.referenceImage || "",
        },
      }; break;
      case "sampleRequiredDate": updates = { sampleRequiredDate: value || undefined }; break;
      case "costingRequiredDate": updates = { costingRequiredDate: value || undefined }; break;
      case "designRequiredDate": updates = {
        designMetadata: {
          numberOfDesigns: item.designMetadata?.numberOfDesigns || 1,
          designRequiredDate: value,
          trend: item.designMetadata?.trend || "",
          targetAudience: item.designMetadata?.targetAudience || "",
          remarks: item.designMetadata?.remarks,
          images: item.designMetadata?.images || [],
          webLinks: item.designMetadata?.webLinks || [],
          referenceImage: item.designMetadata?.referenceImage || "",
        },
      }; break;
      case "qtyForMockup": updates = {
        qtyForMockup: value.trim(),
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: item.mockupMetadata?.designNeeded ?? false,
          qtyForMockup: value.trim(),
        },
      }; break;
      case "mockupRequiredDate": updates = {
        mockupRequiredDate: value || undefined,
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: item.mockupMetadata?.designNeeded ?? false,
          requiredDate: value || undefined,
        },
      }; break;
      case "marketingShutterstockNo": updates = {
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: item.mockupMetadata?.designNeeded ?? false,
          marketingShutterstockNo: value.trim() || undefined,
        },
      }; break;
      case "marketingRemark": updates = {
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: item.mockupMetadata?.designNeeded ?? false,
          marketingRemark: value.trim() || undefined,
        },
      }; break;
      default: return false;
    }
    return await onUpdateProduct(item, updates);
  };

  if (stagedProducts.length === 0) {
    return (
      <div className="flex flex-1 min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-6 py-16 text-center shadow-2xs">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[var(--accent-primary)] shadow-2xs">
          <Layers className="h-7 w-7 stroke-[1.8]" />
        </div>
        <h3 className="font-display text-base font-bold tracking-tight text-[var(--on-surface)]">
          No Products Staged Yet
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--on-surface-muted)]">
          {isFeasibilityHandoff
            ? "Add the product covered by this feasibility request using the + Add Product button above."
            : "Use the + Add Product button above to add product specifications, artwork briefs, and deliverables."}
        </p>
        <span className="mt-4 text-[11px] font-mono text-[var(--on-surface-subtle)]">
          {isFeasibilityHandoff
            ? "One product per feasibility request · release selected workflows here"
            : "Specs are automatically preserved in Drafts"}
        </span>
      </div>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-sm">
      {/* Table Header Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50 px-5 py-3.5 backdrop-blur-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[var(--accent-primary)] ring-4 ring-[var(--accent-primary)]/20" />
            <h2 className="truncate font-display text-xs font-bold uppercase tracking-wider text-[var(--on-surface)]">
              Staged Products Queue
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--on-surface-muted)] shadow-2xs">
            {stagedProducts.length} line item{stagedProducts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[10px] text-[var(--on-surface-subtle)] sm:inline">
            {isFeasibilityHandoff
              ? "Release starts the selected workflows for this feasibility"
              : "Direct Material & Scope Allocation · Auto-Persisted"}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[125px]" /> {/* Request Code */}
            <col className="w-[205px]" /> {/* Description */}
            <col className="w-[100px]" /> {/* Request Type */}
            <col className="w-[160px]" /> {/* Required Date */}
            <col className="w-[70px]" />  {/* Qty */}
            <col className="w-[70px]" />  {/* Unit */}
            <col className="w-[110px]" /> {/* Brand */}
            <col className="w-[125px]" /> {/* Customer SKU */}
            <col className="w-[145px]" /> {/* Barcode */}
            <col className="w-[85px]" />  {/* Actions */}
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
              <th className="px-2.5 py-2.5 font-mono">Request Code</th>
              <th className="px-2.5 py-2.5">Description</th>
              <th className="px-2.5 py-2.5">Scope</th>
              <th className="px-2.5 py-2.5">Required Date <span className="text-rose-600">*</span></th>
              <th className="px-2.5 py-2.5 text-center">Qty <span className="text-rose-600">*</span></th>
              <th className="px-2.5 py-2.5 text-center">Unit</th>
              <th className="px-2.5 py-2.5">Brand</th>
              <th className="px-2.5 py-2.5">Customer SKU</th>
              <th className="px-2.5 py-2.5">Barcode</th>
              <th className="px-2.5 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/60">
            {stagedProducts.map((prod) => {
              const requiredDateRows = getRequiredDateRows(prod);
              const quantityRows = getQuantityRows(prod);
              const isMockup = prod.scopes.includes("mockup");
              const isDesignOnly = prod.scopes.length === 1 && prod.scopes.includes("design");
              const canDuplicate = !isFeasibilityHandoff && prod.scopes.length === 1 && prod.scopes[0] === "sample";
              const mockupMeta = prod.mockupMetadata;
              const sampleTrackInfo = prod.scopes.includes("sample") ? getSampleTrackInfo(prod) : null;
              const requestCode =
                prod.savedSrNumber?.trim() ||
                prod.savedRequestCode?.trim() ||
                prod.sourceRequestCode?.trim() ||
                (/^(SR|MR|DR|CR|FC|PP)-/i.test(prod.materialCode || "") ? prod.materialCode.trim() : null) ||
                (prod.isDraftSaved ? "Draft Assigned" : "Generating...");
              return (
              <tr key={prod.id} className="group transition-colors duration-150 hover:bg-[var(--surface-low)]/40">
                {/* 1. Request Code */}
                <td className="px-2.5 py-2.5 align-middle">
                  <button
                    type="button"
                    onClick={() => onInspectProduct(prod)}
                    className="block max-w-full truncate font-mono text-[11px] font-bold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] hover:underline cursor-pointer"
                    title={`Inspect staged product (${requestCode})`}
                  >
                    {requestCode}
                  </button>
                  {prod.catalogMetadata?.sourceMaterialCode && prod.catalogMetadata.sourceMaterialCode !== prod.materialCode && (
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-[var(--on-surface-subtle)]">
                      Ref {prod.catalogMetadata.sourceMaterialCode}
                    </span>
                  )}
                </td>

                {/* 2. Description */}
                <td className="px-2.5 py-2.5 align-middle">
                  <button type="button" onClick={() => onInspectProduct(prod)} className="block w-full text-left" title={prod.productDescription}>
                    <span className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--on-surface)] transition-colors group-hover:text-[var(--accent-primary)]">
                      {prod.productDescription || "—"}
                    </span>
                  </button>
                  {isMockup && mockupMeta && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {mockupMeta.designNeeded ? (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-violet-50 text-violet-700   border border-violet-200/80  shadow-2xs">
                          ✨ New Design
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700   border border-emerald-200/80  shadow-2xs">
                          ⚡ Direct Studio{mockupMeta.marketingShutterstockNo ? ` · SS# ${mockupMeta.marketingShutterstockNo}` : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {sampleTrackInfo && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border shadow-2xs ${sampleTrackInfo.badgeClass}`}
                        title={sampleTrackInfo.description}
                      >
                        {sampleTrackInfo.badgeLabel}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold border shadow-2xs ${sampleTrackInfo.sampleTypeBadge.badgeClass}`}
                        title={sampleTrackInfo.isFullSample ? "Finished Unit / Full Sample" : "Component / Dummy Partial Sample"}
                      >
                        {sampleTrackInfo.sampleTypeBadge.label}
                      </span>
                    </div>
                  )}
                </td>

                {/* 3. Request Type */}
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="flex flex-wrap items-center gap-1">
                    {prod.scopes.map((scope) => {
                      const isScopeMockup = scope === "mockup";
                      const isDesign = scope === "design";
                      const isCosting = scope === "costing";
                      const style = isScopeMockup
                        ? "border-amber-300/80 bg-amber-50 text-amber-900   "
                        : isDesign
                        ? "border-violet-300/80 bg-violet-50 text-violet-900   "
                        : isCosting
                        ? "border-sky-300/80 bg-sky-50 text-sky-900   "
                        : "border-[var(--accent-primary)]/30 bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]";
                      return (
                        <span key={scope} className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide leading-none shadow-2xs ${style}`}>
                          {DELIVERABLES.find((item) => item.id === scope)?.label || scope}
                        </span>
                      );
                    })}
                  </div>
                </td>

                {/* 4. Required Date */}
                <td className="px-2.5 py-2.5 align-middle">
                  <div className="space-y-1">
                    {requiredDateRows.map((dateRow) => (
                      <div key={dateRow.field} className="flex flex-col gap-0.5">
                        {requiredDateRows.length > 1 && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                            {dateRow.label}
                          </span>
                        )}
                        <EditableValue
                          value={dateRow.value}
                          placeholder="Select date"
                          label={`${dateRow.label} required date`}
                          type="date"
                          editable={editable}
                          onCommit={(value) => updateField(prod, dateRow.field, value)}
                        />
                      </div>
                    ))}
                    {requiredDateRows.length === 0 && <span className="text-[10px] text-[var(--on-surface-subtle)]">—</span>}
                  </div>
                </td>

                {/* 5. Quantity */}
                <td className="px-2.5 py-2.5 text-center align-middle font-mono text-xs font-semibold text-[var(--on-surface)]">
                  <div className="space-y-1">
                    {quantityRows.map((qtyRow) => (
                      <div key={qtyRow.field} className="flex flex-col items-center gap-0.5">
                        {quantityRows.length > 1 && (
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                            {qtyRow.label}
                          </span>
                        )}
                        <EditableValue
                          value={qtyRow.value}
                          placeholder="Qty"
                          label={`${qtyRow.label} quantity`}
                          type="number"
                          editable={editable}
                          onCommit={(value) => updateField(prod, qtyRow.field, value)}
                        />
                      </div>
                    ))}
                    {quantityRows.length === 0 && <span className="font-mono text-xs text-[var(--on-surface-subtle)]">—</span>}
                  </div>
                </td>

                {/* 6. Unit (Blank for Mockup requests) */}
                <td className="px-2.5 py-2.5 text-center align-middle text-[11px] text-[var(--on-surface-muted)]">
                  {isMockup || isDesignOnly ? (
                    <span className="text-[11px] text-[var(--on-surface-subtle)]/50">—</span>
                  ) : (
                    <div className="flex justify-center">
                      <EditableUnit
                        unit={prod.unitPcPack || "PC"}
                        qtyPerPack={prod.qtyPerPack || (prod.unitPcPack === "Pack" ? "" : "1")}
                        editable={editable}
                        onCommit={async (unit, qtyPerPack) => onUpdateProduct?.(prod, { unitPcPack: unit, qtyPerPack })}
                      />
                    </div>
                  )}
                </td>

                {/* 7. Brand */}
                <td className="px-2.5 py-2.5 align-middle text-[11px] text-[var(--on-surface-muted)]">
                  <EditableValue
                    value={prod.brandName || ""}
                    placeholder="Add brand"
                    label="Brand"
                    editable={editable}
                    onCommit={(value) => updateField(prod, "brandName", value)}
                  />
                </td>

                {/* 8. Customer SKU */}
                <td className="px-2.5 py-2.5 align-middle text-[11px] text-[var(--on-surface-muted)]">
                  <EditableValue
                    value={prod.customerProductCode || ""}
                    placeholder="Add SKU"
                    label="Customer SKU"
                    editable={editable}
                    onCommit={(value) => updateField(prod, "customerProductCode", value)}
                  />
                </td>

                {/* 9. Barcode */}
                <td className="px-2.5 py-2.5 align-middle font-mono text-[11px] text-[var(--on-surface-muted)]">
                  <EditableValue
                    value={prod.barcode || ""}
                    placeholder="Add barcode"
                    label="Barcode"
                    editable={editable}
                    onCommit={(value) => updateField(prod, "barcode", value)}
                  />
                </td>

                {/* 10. Actions */}
                <td className="px-2.5 py-2.5 text-center align-middle">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onInspectProduct(prod)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] shadow-2xs transition-all hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] hover:border-[var(--border-strong)] active:scale-95 cursor-pointer"
                      title="Inspect specification"
                      aria-label="Inspect staged product"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {canDuplicate && (
                      <button
                        type="button"
                        onClick={() => onDuplicateProduct(prod)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] shadow-2xs transition-all hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] hover:border-[var(--border-strong)] active:scale-95 cursor-pointer"
                        title={prod.scopes.includes("sample") ? "Create a design variant for Creative" : "Duplicate item"}
                        aria-label={prod.scopes.includes("sample") ? "Create design variant" : "Copy staged product"}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(prod.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] shadow-2xs transition-all hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] active:scale-95 cursor-pointer"
                      title="Remove from staging"
                      aria-label="Remove from staging"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default StagingProductList;
