import React, { useState } from "react";
import { Copy, Eye, Layers, Trash2 } from "lucide-react";
import { OperationalDatePicker } from "@/components/erp";
import { StagedProductItem, DELIVERABLES } from "../../types/staging";

const cellInputClass = "h-10 w-full min-w-[100px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-sm text-[var(--on-surface)] outline-none transition-shadow focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 disabled:opacity-60";

type RequiredDateField = "mockupRequiredDate" | "sampleRequiredDate" | "costingRequiredDate" | "designRequiredDate";

const getRequiredDateRows = (item: StagedProductItem): Array<{ label: string; field: RequiredDateField; value: string }> => [
  ...(item.scopes.includes("mockup") ? [{ label: "Mockup", field: "mockupRequiredDate" as const, value: item.mockupMetadata?.requiredDate || item.mockupRequiredDate || "" }] : []),
  ...(item.scopes.includes("sample") ? [{ label: "Sampling", field: "sampleRequiredDate" as const, value: item.sampleRequiredDate || "" }] : []),
  ...(item.scopes.includes("costing") ? [{ label: "Costing", field: "costingRequiredDate" as const, value: item.costingRequiredDate || "" }] : []),
  ...(item.scopes.includes("design") ? [{ label: "Design", field: "designRequiredDate" as const, value: item.designMetadata?.designRequiredDate || "" }] : []),
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
      className={`block max-w-full truncate text-left text-sm ${value ? "text-[var(--on-surface-muted)]" : "text-[var(--on-surface-subtle)]"} ${editable ? "cursor-text rounded-md px-2 py-2 hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]" : "cursor-default"}`}
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
  const [draftQty, setDraftQty] = useState(qtyPerPack || "1");
  const [error, setError] = useState("");

  const startEditing = () => {
    if (!editable) return;
    setDraftUnit(unit || "PC");
    setDraftQty(qtyPerPack || "1");
    setError("");
    setIsEditing(true);
  };

  const commit = async () => {
    if (draftUnit === "Pack" && (!Number.isInteger(Number(draftQty)) || Number(draftQty) < 1)) {
      setError("Enter a whole number of at least 1.");
      return;
    }
    const nextQty = draftUnit === "Pack" ? draftQty : "1";
    if (draftUnit === (unit || "PC") && nextQty === (qtyPerPack || "1")) {
      setIsEditing(false);
      return;
    }
    const saved = await onCommit(draftUnit, nextQty);
    if (saved !== false) setIsEditing(false);
    else setError("Could not save. Try again.");
  };

  if (!isEditing) {
    const label = unit === "Pack" ? `${qtyPerPack || "1"}/Pack` : "PC";
    return (
      <button
        type="button"
        onClick={startEditing}
        disabled={!editable}
        aria-label="Edit unit and pieces per pack"
        title={editable ? "Click to edit unit" : undefined}
        className={`rounded-md px-2 py-1.5 text-sm font-semibold ${editable ? "cursor-text hover:bg-[var(--surface-low)]" : "cursor-default"} text-[var(--on-surface-muted)]`}
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
          setDraftQty(qtyPerPack || "1");
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
          onChange={(event) => setDraftUnit(event.target.value)}
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
  onInspectProduct: (item: StagedProductItem) => void;
  onUpdateProduct?: (item: StagedProductItem, updates: Partial<StagedProductItem>) => Promise<boolean | void> | boolean | void;
  onDuplicateProduct: (item: StagedProductItem) => void;
  onRemoveProduct: (id: string) => void;
}

export const StagingProductList: React.FC<StagingProductListProps> = ({
  stagedProducts,
  onInspectProduct,
  onUpdateProduct,
  onDuplicateProduct,
  onRemoveProduct,
}) => {
  const editable = Boolean(onUpdateProduct);
  const updateField = async (item: StagedProductItem, field: keyof StagedProductItem | RequiredDateField, value: string) => {
    if (!onUpdateProduct) return false;
    let updates: Partial<StagedProductItem>;
    switch (field) {
      case "customerProductCode": updates = { customerProductCode: value.trim() }; break;
      case "barcode": updates = { barcode: value.trim() }; break;
      case "brandName": updates = { brandName: value.trim() }; break;
      case "unitPcPack": updates = { unitPcPack: value, qtyPerPack: value === "Pack" ? item.qtyPerPack || "1" : "1" }; break;
      case "qtyPerPack": updates = { qtyPerPack: value.trim() || "1" }; break;
      case "qtyForSampling": updates = { qtyForSampling: value.trim() }; break;
      case "qtyDesignCosting": updates = { qtyDesignCosting: value.trim() }; break;
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
      default: return false;
    }
    return await onUpdateProduct(item, updates);
  };

  if (stagedProducts.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-6 py-14 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
          <Layers className="h-7 w-7 stroke-[2]" />
        </div>
        <h3 className="font-display text-base font-bold tracking-tight text-[var(--on-surface)]">No Products Staged Yet</h3>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--on-surface-muted)]">
          This sample request currently has no staged items. Add product specifications, configure artwork briefs or prototype samples, and assign deliverables.
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="truncate font-display text-xs font-bold uppercase tracking-wider text-[var(--on-surface)]">Staged Products Matrix</h2>
          <span className="shrink-0 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--on-surface-muted)]">
            {stagedProducts.length} line item{stagedProducts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="hidden font-mono text-[10px] text-[var(--on-surface-subtle)] lg:inline">Direct Material &amp; Scope Allocation Queue</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1580px] table-fixed border-collapse text-left text-xs">
          <colgroup>
            <col className="w-[125px]" />
            <col className="w-[225px]" />
            <col className="w-[140px]" />
            <col className="w-[250px]" />
            <col className="w-[120px]" />
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[160px]" />
            <col className="w-[100px]" />
            <col className="w-[100px]" />
            <col className="w-[140px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)]/70 text-[10px] font-bold uppercase tracking-wide text-[var(--on-surface-muted)]">
              <th className="px-3 py-2.5 font-mono">Material Code</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5">Request Type</th>
              <th className="px-3 py-2.5">Required Date</th>
              <th className="px-3 py-2.5">Customer SKU</th>
              <th className="px-3 py-2.5">Barcode</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Unit</th>
              <th className="px-3 py-2.5 text-right">Sampling Qty</th>
              <th className="px-3 py-2.5 text-right">Costing Qty</th>
              <th className="px-3 py-2.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {stagedProducts.map((prod) => {
              const requiredDateRows = getRequiredDateRows(prod);
              return (
              <tr key={prod.id} className="transition-colors hover:bg-[var(--surface-low)]/60">
                <td className="px-3 py-2.5 align-middle">
                  <button
                    type="button"
                    onClick={() => onInspectProduct(prod)}
                    className="block max-w-full truncate font-mono text-[11px] font-bold text-[var(--accent-primary)] hover:underline"
                    title="Inspect staged product"
                  >
                    {prod.materialCode || "—"}
                  </button>
                  {prod.catalogMetadata?.sourceMaterialCode && prod.catalogMetadata.sourceMaterialCode !== prod.materialCode && (
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-[var(--on-surface-subtle)]">Ref {prod.catalogMetadata.sourceMaterialCode}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <button type="button" onClick={() => onInspectProduct(prod)} className="block w-full text-left" title={prod.productDescription}>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--on-surface)]">{prod.productDescription || "—"}</span>
                  </button>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <div className="flex flex-wrap gap-1">
                    {prod.scopes.map((scope) => {
                      const isMockup = scope === "mockup";
                      const isDesign = scope === "design";
                      const isCosting = scope === "costing";
                      const style = isMockup
                        ? "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
                        : isDesign
                        ? "border-violet-300/70 bg-violet-50 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-300"
                        : isCosting
                        ? "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/30 dark:text-sky-300"
                        : "border-[var(--accent-primary)]/25 bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]";
                      return (
                        <span key={scope} className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${style}`}>
                          {DELIVERABLES.find((item) => item.id === scope)?.label || scope}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <div className="space-y-1">
                    {requiredDateRows.map((dateRow) => (
                      <div key={dateRow.field}>
                        <EditableValue value={dateRow.value} placeholder="Add date" label={`${dateRow.label} required date`} type="date" editable={editable} onCommit={(value) => updateField(prod, dateRow.field, value)} />
                      </div>
                    ))}
                    {requiredDateRows.length === 0 && <span className="text-[10px] text-[var(--on-surface-subtle)]">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-middle text-[10px] text-[var(--on-surface-muted)]">
                  <EditableValue value={prod.customerProductCode || ""} placeholder="Add SKU" label="Customer SKU" editable={editable} onCommit={(value) => updateField(prod, "customerProductCode", value)} />
                </td>
                <td className="px-3 py-2.5 align-middle font-mono text-[10px] text-[var(--on-surface-muted)]">
                  <EditableValue value={prod.barcode || ""} placeholder="Add barcode" label="Barcode" editable={editable} onCommit={(value) => updateField(prod, "barcode", value)} />
                </td>
                <td className="px-3 py-2.5 align-middle text-[10px] text-[var(--on-surface-muted)]">
                  <EditableValue value={prod.brandName || ""} placeholder="Add brand" label="Brand" editable={editable} onCommit={(value) => updateField(prod, "brandName", value)} />
                </td>
                <td className="px-3 py-2.5 align-middle text-[10px] text-[var(--on-surface-muted)]">
                  <EditableUnit
                    unit={prod.unitPcPack || "PC"}
                    qtyPerPack={prod.qtyPerPack || "1"}
                    editable={editable}
                    onCommit={async (unit, qtyPerPack) => onUpdateProduct?.(prod, { unitPcPack: unit, qtyPerPack })}
                  />
                </td>
                <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] font-semibold text-[var(--on-surface)]">
                  {prod.scopes.includes("sample") ? <EditableValue value={prod.qtyForSampling || "1"} placeholder="Add qty" label="Sampling quantity" type="number" editable={editable} onCommit={(value) => updateField(prod, "qtyForSampling", value)} /> : "—"}
                </td>
                <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] font-semibold text-[var(--on-surface)]">
                  {prod.scopes.includes("costing") ? <EditableValue value={prod.qtyDesignCosting || ""} placeholder="Add qty" label="Costing quantity" type="number" editable={editable} onCommit={(value) => updateField(prod, "qtyDesignCosting", value)} /> : "—"}
                </td>
                <td className="px-3 py-2.5 text-center align-middle">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onInspectProduct(prod)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                      title="Inspect"
                      aria-label="Inspect staged product"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {!prod.scopes.includes("mockup") && (
                      <button
                        type="button"
                        onClick={() => onDuplicateProduct(prod)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-low)] text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
                        title="Copy"
                        aria-label="Copy staged product"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(prod.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60"
                      title="Delete"
                      aria-label="Delete staged product"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
