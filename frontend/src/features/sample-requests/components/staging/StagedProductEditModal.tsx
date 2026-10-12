import React, { useState } from "react";
import { Calculator, Layers, Package, X } from "lucide-react";
import { OperationalDatePicker } from "@/components/erp";
import { Button } from "@/components/ui/Button";
import { StagedProductItem } from "../../types/staging";

interface StagedProductEditModalProps {
  item: StagedProductItem;
  mockupOnly?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (updates: Partial<StagedProductItem>) => Promise<void> | void;
}

const fieldClass = "h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-subtle)] transition focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "space-y-1.5 text-[11px] font-semibold text-[var(--on-surface-muted)]";
const sectionClass = "space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-4 sm:p-5";

export const StagedProductEditModal: React.FC<StagedProductEditModalProps> = ({ item, mockupOnly = false, isSaving = false, onClose, onSave }) => {
  const hasMockup = item.scopes.includes("mockup");
  const hasSample = item.scopes.includes("sample");
  const hasCosting = item.scopes.includes("costing");
  const [designNeeded, setDesignNeeded] = useState<boolean | null>(
    item.mockupMetadata?.designNeeded ?? (item.creationMode === "new" || item.scopes.includes("design"))
  );
  const [stockNumber, setStockNumber] = useState(item.mockupMetadata?.marketingShutterstockNo || "");
  const [mockupRemark, setMockupRemark] = useState(item.mockupMetadata?.marketingRemark || "");
  const [mockupQty, setMockupQty] = useState(String(item.qtyForMockup || item.mockupMetadata?.qtyForMockup || "1"));
  const [mockupDate, setMockupDate] = useState(item.mockupMetadata?.requiredDate || item.mockupRequiredDate || "");
  const [brand, setBrand] = useState(item.brandName || "");
  const [sku, setSku] = useState(item.customerProductCode || "");
  const [sampleQty, setSampleQty] = useState(String(item.qtyForSampling || "1"));
  const [unitPcPack, setUnitPcPack] = useState(item.unitPcPack || "PC");
  const [qtyPerPack, setQtyPerPack] = useState(String(item.qtyPerPack || "1"));
  const [sampleType, setSampleType] = useState(item.samplingMetadata?.sampleType || "full");
  const [partialRequirements, setPartialRequirements] = useState(item.samplingMetadata?.partialRequirements || "");
  const [costingQty, setCostingQty] = useState(String(item.qtyDesignCosting || "1"));
  const [barcode, setBarcode] = useState(item.barcode || "");
  const [costingDate, setCostingDate] = useState(item.costingRequiredDate || "");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mockupOnly) {
      if (!Number.isInteger(Number(mockupQty)) || Number(mockupQty) < 1) {
        setError("Enter a whole-number Mockup quantity (minimum 1).");
        return;
      }
      if (unitPcPack === "Pack" && (!Number.isInteger(Number(qtyPerPack)) || Number(qtyPerPack) < 1)) {
        setError("Enter a whole-number quantity per pack (minimum 1).");
        return;
      }
      if (hasSample && (!Number.isInteger(Number(sampleQty)) || Number(sampleQty) < 1)) {
        setError("Enter a whole-number sample quantity (minimum 1).");
        return;
      }
      if (hasCosting && (!Number.isInteger(Number(costingQty)) || Number(costingQty) < 1)) {
        setError("Enter a whole-number costing quantity (minimum 1).");
        return;
      }
      await onSave({
        qtyForMockup: mockupQty.trim(),
        mockupRequiredDate: mockupDate || undefined,
        brandName: brand.trim(),
        customerProductCode: sku.trim(),
        barcode: barcode.trim(),
        unitPcPack,
        qtyPerPack: unitPcPack === "Pack" ? qtyPerPack.trim() : "1",
        ...(hasSample && { qtyForSampling: sampleQty.trim() }),
        ...(hasCosting && { qtyDesignCosting: costingQty.trim() }),
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: item.mockupMetadata?.designNeeded ?? false,
          qtyForMockup: mockupQty.trim(),
          requiredDate: mockupDate || undefined,
        },
      });
      return;
    }
    if (hasMockup && designNeeded === null) {
      setError("Choose whether this Mockup request needs a design.");
      return;
    }
    if (hasMockup && designNeeded === false && !stockNumber.trim() && !mockupRemark.trim()) {
      setError("Add a Shutterstock No. or remark when design is not needed.");
      return;
    }
    if (hasMockup && (!Number.isInteger(Number(mockupQty)) || Number(mockupQty) < 1)) {
      setError("Enter a whole-number Mockup quantity (minimum 1).");
      return;
    }
    if (hasSample && (!Number.isInteger(Number(sampleQty)) || Number(sampleQty) < 1)) {
      setError("Enter a whole-number sample quantity (minimum 1).");
      return;
    }
    if (hasSample && sampleType === "partial" && !partialRequirements.trim()) {
      setError("Add the required details for a partial sample.");
      return;
    }
    if (hasCosting && (!Number.isInteger(Number(costingQty)) || Number(costingQty) < 1 || !sku.trim() || !barcode.trim() || !brand.trim() || !costingDate)) {
      setError("Costing needs a valid quantity, Customer SKU, barcode, brand, and required date.");
      return;
    }
    if (unitPcPack === "Pack" && (!Number.isInteger(Number(qtyPerPack)) || Number(qtyPerPack) < 1)) {
      setError("Enter a whole-number quantity per pack (minimum 1).");
      return;
    }

    const updates: Partial<StagedProductItem> = {
      ...(hasMockup && {
        qtyForMockup: mockupQty.trim(),
        mockupRequiredDate: mockupDate || undefined,
        mockupMetadata: {
          ...item.mockupMetadata,
          designNeeded: designNeeded === true,
          marketingShutterstockNo: stockNumber.trim() || undefined,
          marketingRemark: mockupRemark.trim() || undefined,
          qtyForMockup: mockupQty.trim(),
          requiredDate: mockupDate || undefined,
        },
      }),
      brandName: brand.trim(),
      customerProductCode: sku.trim(),
      barcode: barcode.trim(),
      unitPcPack,
      qtyPerPack: unitPcPack === "Pack" ? qtyPerPack.trim() : "1",
      ...(hasSample && {
        qtyForSampling: sampleQty.trim(),
        samplingMetadata: {
          ...item.samplingMetadata,
          searchMode: item.samplingMetadata?.searchMode || (item.creationMode === "binding" || item.creationMode === "material_code" ? item.creationMode : "new"),
          sampleType,
          partialRequirements: partialRequirements.trim() || undefined,
        },
      }),
      ...(hasCosting && {
        qtyDesignCosting: costingQty.trim(),
        barcode: barcode.trim(),
        costingRequiredDate: costingDate,
      }),
    };
    await onSave(updates);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="staged-product-edit-title" onMouseDown={(event) => { if (!isSaving && event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="staged-product-edit-title" className="font-display text-sm font-bold tracking-tight text-[var(--on-surface)] sm:text-base">{mockupOnly ? "Edit mockup details" : "Edit staged request"}</h2>
            <p className="mt-1 truncate text-xs text-[var(--on-surface-muted)]">{item.materialCode} · {item.productDescription}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close" className="rounded-lg p-1.5 text-[var(--on-surface-subtle)] transition hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:opacity-50"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[var(--surface-base)]/35 p-4 sm:p-6">
          {mockupOnly ? (
            <>
              <section className={`${sectionClass} border-l-2 border-l-[var(--accent-primary)]`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Mockup quantity<input type="number" min="1" step="1" value={mockupQty} onChange={(event) => setMockupQty(event.target.value)} className={fieldClass} autoFocus /></label>
                  <OperationalDatePicker
                    label="Required date"
                    value={mockupDate}
                    onChange={setMockupDate}
                    placeholder="Select required date..."
                    calendarAlign="left"
                  />
                </div>
              </section>
              <section className={sectionClass}>
                <h3 className="text-xs font-bold text-[var(--on-surface)]">Product details</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className={labelClass}>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Brand name" className={fieldClass} /></label>
                  <label className={labelClass}>Customer SKU<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Customer product code" className={fieldClass} /></label>
                  <label className={labelClass}>Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Barcode" className={fieldClass} /></label>
                  <label className={labelClass}>Unit<select value={unitPcPack} onChange={(event) => setUnitPcPack(event.target.value)} className={fieldClass}><option value="PC">PC</option><option value="Pack">Pack</option></select></label>
                  {unitPcPack === "Pack" && <label className={labelClass}>Pieces per pack<input type="number" min="1" step="1" value={qtyPerPack} onChange={(event) => setQtyPerPack(event.target.value)} className={fieldClass} /></label>}
                  {hasSample && <label className={labelClass}>Sampling quantity<input type="number" min="1" step="1" value={sampleQty} onChange={(event) => setSampleQty(event.target.value)} className={fieldClass} /></label>}
                  {hasCosting && <label className={labelClass}>Costing quantity<input type="number" min="1" step="1" value={costingQty} onChange={(event) => setCostingQty(event.target.value)} className={fieldClass} /></label>}
                </div>
              </section>
            </>
          ) : (
            <>
          <section className={sectionClass}>
            <h3 className="text-xs font-bold text-[var(--on-surface)]">Product details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>Customer SKU<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Customer product code" className={fieldClass} /></label>
              <label className={labelClass}>Barcode<input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Barcode" className={fieldClass} /></label>
              <label className={labelClass}>Brand<input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="Brand name" className={fieldClass} /></label>
              <label className={labelClass}>Unit<select value={unitPcPack} onChange={(event) => setUnitPcPack(event.target.value)} className={fieldClass}><option value="PC">PC</option><option value="Pack">Pack</option></select></label>
              {unitPcPack === "Pack" && <label className={labelClass}>Pieces per pack<input type="number" min="1" step="1" value={qtyPerPack} onChange={(event) => setQtyPerPack(event.target.value)} className={fieldClass} /></label>}
            </div>
          </section>
          {hasMockup && (
            <section className={`${sectionClass} border-l-2 border-l-[var(--accent-primary)]`}>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"><Layers className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-xs font-bold text-[var(--on-surface)]">Mockup request</h3>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--on-surface-muted)]">Update the handoff details for this staged Mockup.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>Mockup quantity<input type="number" min="1" step="1" value={mockupQty} onChange={(event) => setMockupQty(event.target.value)} className={fieldClass} /></label>
                <OperationalDatePicker
                  label="Mockup required date"
                  value={mockupDate}
                  onChange={setMockupDate}
                  placeholder="Select required date..."
                  calendarAlign="left"
                />
              </div>
              <div className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
                <p className="text-[11px] font-semibold text-[var(--on-surface-muted)]">Design needed?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((needed) => (
                    <button key={String(needed)} type="button" aria-pressed={designNeeded === needed} onClick={() => { setDesignNeeded(needed); setError(""); }} className={`min-h-10 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${designNeeded === needed ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]" : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"}`}>
                      {needed ? "Yes, design is needed" : "No, use existing artwork"}
                    </button>
                  ))}
                </div>
                {designNeeded === false && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className={labelClass}>Shutterstock No. (optional)<input value={stockNumber} onChange={(event) => setStockNumber(event.target.value)} placeholder="Enter Shutterstock No." className={fieldClass} /></label>
                    <label className={labelClass}>Marketing remark (optional)<input value={mockupRemark} onChange={(event) => setMockupRemark(event.target.value)} placeholder="Add a short remark" className={fieldClass} /></label>
                    <p className="sm:col-span-2 text-[10px] text-[var(--on-surface-subtle)]">Enter at least one of the two reference fields.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {hasSample && (
            <section className={sectionClass}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-[var(--accent-primary)]"><Package className="h-4 w-4" /></span>
                <h3 className="text-xs font-bold text-[var(--on-surface)]">Sampling request</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>Sample quantity<input type="number" min="1" step="1" value={sampleQty} onChange={(event) => setSampleQty(event.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>Sample type<select value={sampleType} onChange={(event) => setSampleType(event.target.value as "full" | "partial")} className={fieldClass}><option value="full">Full sample</option><option value="partial">Partial sample</option></select></label>
                {sampleType === "partial" && <label className={`${labelClass} sm:col-span-2`}>Partial sample requirements<textarea value={partialRequirements} onChange={(event) => setPartialRequirements(event.target.value)} rows={2} className="w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 py-2 text-xs text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/15" /></label>}
              </div>
            </section>
          )}

          {hasCosting && (
            <section className={sectionClass}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-[var(--accent-primary)]"><Calculator className="h-4 w-4" /></span>
                <h3 className="text-xs font-bold text-[var(--on-surface)]">Costing request</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelClass}>Costing quantity<input type="number" min="1" step="1" value={costingQty} onChange={(event) => setCostingQty(event.target.value)} className={fieldClass} /></label>
                <label className={labelClass}>Required date<input type="date" value={costingDate} onChange={(event) => setCostingDate(event.target.value)} className={fieldClass} /></label>
              </div>
            </section>
          )}
            </>
          )}

          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-6">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" variant="primary" size="md" className="min-w-32" isLoading={isSaving}>{isSaving ? "Saving…" : "Save changes"}</Button>
        </footer>
      </form>
    </div>
  );
};
