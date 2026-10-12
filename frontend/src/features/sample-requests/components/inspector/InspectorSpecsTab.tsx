import React from "react";
import { SampleRequestItem, AddProgramMaterialPayload } from "../../types";
import { ParsedFeasibilityDetails, ParsedImageRef, ParsedMatrixRow } from "../../utils/feasibilityParsers";
import { InspectorMaterialsTable } from "./InspectorMaterialsTable";
import { ExternalLink, Eye } from "lucide-react";
import { getRequestTypes } from "../../sampling/utils/requestTypeUtils";
import { CatalogProductInspectModal } from "../staging/CatalogProductInspectModal";

export interface InspectorSpecsTabProps {
  trackType: string | null;
  request: SampleRequestItem;
  activeRequest: SampleRequestItem;
  feasibilityDetails: ParsedFeasibilityDetails;
  displayDescription: string;
  displayRemark: string;
  previewableImages: ParsedImageRef[];
  imageSourceFor: (url?: string) => string | undefined;
  onSelectPreviewImage: (url: string) => void;
  // Materials Table props (if trackType === "program_planning")
  unifiedMatrixRows: ParsedMatrixRow[];
  matrixRemarks: Record<string | number, string>;
  savingRemarkId: string | number | null;
  savedRemarkId: string | number | null;
  isAddingRow: boolean;
  isSavingNewRow: boolean;
  newRowData: AddProgramMaterialPayload;
  addRowFeedback: string | null;
  onRemarkChange: (rowId: string | number, value: string) => void;
  onSaveRemark: (rowId: string | number, index: number) => void;
  onStartAddRow: () => void;
  onCancelAddRow: () => void;
  readOnly?: boolean;
  onNewRowDataChange: (field: keyof AddProgramMaterialPayload, value: string) => void;
  onSaveNewRow: () => void;
}

export const InspectorSpecsTab: React.FC<InspectorSpecsTabProps> = ({
  trackType,
  request,
  activeRequest,
  feasibilityDetails,
  displayDescription,
  displayRemark,
  previewableImages,
  imageSourceFor,
  onSelectPreviewImage,
  unifiedMatrixRows,
  matrixRemarks,
  savingRemarkId,
  savedRemarkId,
  isAddingRow,
  isSavingNewRow,
  newRowData,
  addRowFeedback,
  onRemarkChange,
  onSaveRemark,
  onStartAddRow,
  onCancelAddRow,
  onNewRowDataChange,
  onSaveNewRow,
}) => {
  const requestTypes = getRequestTypes(activeRequest);
  const savedProductId = Number(String(activeRequest.id).replace(/^sample-/, ""));

  if (trackType !== "program_planning" && requestTypes.includes("mockup")) {
    const mockup = activeRequest.mockupWorkflowState;
    const designNeeded = mockup?.designNeeded ?? requestTypes.includes("design");
    const mockupFields = [
      ["Design needed", designNeeded ? "Yes" : "No · Existing artwork"],
      ["Mockup quantity", mockup?.qtyForMockup || activeRequest.qtyForMockup || "—"],
      ["Mockup required date", mockup?.requiredDate || "—"],
      ["Brand", activeRequest.brandName || "—"],
      ["Customer SKU", activeRequest.customerProductCode || "—"],
      ...(!designNeeded ? [
        ["Shutterstock No.", mockup?.marketingShutterstockNo || "—"],
        ["Marketing remark", mockup?.marketingRemark || "—"],
      ] : []),
    ];

    return (
      <div className="space-y-4 py-4">
        {Number.isInteger(savedProductId) && savedProductId > 0 && (
          <CatalogProductInspectModal
            embedded
            product={{
              id: savedProductId,
              sr_number: activeRequest.srNumber,
              material_code: activeRequest.materialCode,
              product_description: activeRequest.productDescription,
              customer: activeRequest.customer,
              product_category: activeRequest.productCategory,
              product_sub_category: activeRequest.productSubCategory,
              product_third_category: activeRequest.productThirdCategory,
            }}
            onClose={() => undefined}
            heading="Product specifications"
            intro="Red-bordered characteristics belong to Creative. Expand a class to see all saved and blank values."
            highlightCreativeFields
            creativeCharacteristicKeys={activeRequest.mockupWorkflowState?.creativeCharacteristicKeys}
          />
        )}
        <section className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3">
            <h3 className="text-xs font-bold text-[var(--on-surface)]">Mockup request details</h3>
          </div>
          <dl className="grid grid-cols-1 gap-px bg-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3">
            {mockupFields.map(([label, value]) => (
              <div key={label} className="min-w-0 bg-[var(--surface-base)] px-4 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--on-surface-subtle)]">{label}</dt>
                <dd className="mt-1 break-words text-xs font-semibold text-[var(--on-surface)]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-6">
      {trackType === "program_planning" ? (
        <InspectorMaterialsTable
          unifiedMatrixRows={unifiedMatrixRows}
          matrixRemarks={matrixRemarks}
          savingRemarkId={savingRemarkId}
          savedRemarkId={savedRemarkId}
          isAddingRow={isAddingRow}
          isSavingNewRow={isSavingNewRow}
          newRowData={newRowData}
          addRowFeedback={addRowFeedback}
          onRemarkChange={onRemarkChange}
          onSaveRemark={onSaveRemark}
          onStartAddRow={onStartAddRow}
          onCancelAddRow={onCancelAddRow}
          onNewRowDataChange={onNewRowDataChange}
          onSaveNewRow={onSaveNewRow}
        />
      ) : (
        <div className="space-y-6">
          {/* ── 1. Requested Deliverable Scopes Matrix ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)]">
              <span className="font-display text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-400 block mb-1">
                Creative Design
              </span>
              <div className="font-display font-bold text-xs text-[var(--on-surface)]">
                {requestTypes.includes("design") ? "Required" : "Not Required"}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {activeRequest.numberOfDesigns || activeRequest.designsCustomerCreative || 1} Req · {(activeRequest.creativeSubmissions || []).length} Rec
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)]">
              <span className="font-display text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-400 block mb-1">
                Studio CAD / Dieline
              </span>
              <div className="font-display font-bold text-xs text-[var(--on-surface)]">
                {requestTypes.includes("mockup") ? "Required" : "Standard"}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {(activeRequest as any).qtyForMockup || 1} Prototype Dummy
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)]">
              <span className="font-display text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-400 block mb-1">
                Physical Sampling
              </span>
              <div className="font-display font-bold text-xs text-[var(--on-surface)]">
                {requestTypes.includes("sample") ? "Required" : "Optional"}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {activeRequest.qtyForSampling || 1} {activeRequest.unitPcPack || "PC"}{activeRequest.unitPcPack === "Pack" && activeRequest.qtyPerPack ? ` (${activeRequest.qtyPerPack} pcs/pk)` : ""}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)]">
              <span className="font-display text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-400 block mb-1">
                Commercial Costing
              </span>
              <div className="font-display font-bold text-xs text-[var(--on-surface)]">
                {requestTypes.includes("costing") ? "BOM Required" : "Standard"}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {activeRequest.qtyDesignCosting ? Number(activeRequest.qtyDesignCosting).toLocaleString() : "10,000"} {activeRequest.unitPcPack || "PC"}
              </div>
            </div>
          </div>

          {/* ── 2. Technical Scope & Specifications Card ── */}
          <div className="p-5 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2 font-display">
                Technical Specification &amp; Product Description
              </div>
              <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap">
                {displayDescription || "No detailed technical description recorded for this item."}
              </div>
            </div>

            {/* Marketing Remarks / Directives */}
            {displayRemark && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1.5 font-display">
                  Marketing Directives &amp; Commercial Notes
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 text-xs text-amber-900 dark:text-amber-200 font-sans leading-relaxed italic">
                  "{displayRemark}"
                </div>
              </div>
            )}

            {/* Key-Value Specifications Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
              {activeRequest.materialCode && (
                <div className="flex items-baseline py-1">
                  <span className="w-36 text-slate-400 font-medium shrink-0">Material Code</span>
                  <span className="flex-1 font-mono font-bold text-slate-800 dark:text-zinc-200">
                    {activeRequest.materialCode}
                  </span>
                </div>
              )}
              {activeRequest.brandName && (
                <div className="flex items-baseline py-1">
                  <span className="w-36 text-slate-400 font-medium shrink-0">Brand Name</span>
                  <span className="flex-1 font-semibold text-slate-800 dark:text-zinc-200">
                    {activeRequest.brandName}
                  </span>
                </div>
              )}
              {activeRequest.targetPlant && (
                <div className="flex items-baseline py-1">
                  <span className="w-36 text-slate-400 font-medium shrink-0">Target Facility</span>
                  <span className="flex-1 text-slate-800 dark:text-zinc-200">
                    Plant {activeRequest.targetPlant}
                  </span>
                </div>
              )}
              {activeRequest.sampleRequiredDate && (
                <div className="flex items-baseline py-1">
                  <span className="w-36 text-slate-400 font-medium shrink-0">Customer Due Date</span>
                  <span className="flex-1 font-mono font-bold text-[var(--accent-primary)]">
                    {activeRequest.sampleRequiredDate}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── 3. Reference URLs & Links ── */}
          {requestTypes.includes("costing") && (
            <section className="space-y-4 rounded-2xl bg-teal-50/45 p-5 dark:bg-teal-950/15">
              <div>
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">Costing handoff details</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Costing schedule, customer identifiers, and submitted output for Marketing review.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Required date", activeRequest.costingRequiredDate],
                  ["Counter date offered", activeRequest.costingCounterDate],
                  ["Quantity for costing", activeRequest.qtyDesignCosting],
                  ["Unit", activeRequest.unitPcPack],
                  ["Pieces per pack", activeRequest.unitPcPack === "Pack" ? activeRequest.qtyPerPack : "1"],
                  ["Customer SKU", activeRequest.customerProductCode],
                  ["Barcode", activeRequest.barcode],
                  ["Brand", activeRequest.brandName],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/80 p-3 dark:bg-white/[0.04]">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-teal-800/75 dark:text-teal-300/75">{label}</span>
                    <span className="mt-1 block break-words text-xs font-semibold text-[var(--on-surface)]">{value || "—"}</span>
                  </div>
                ))}
              </div>
              {activeRequest.costingOutputPath && (
                <div className="rounded-xl bg-white/80 p-3 dark:bg-white/[0.04]">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-teal-800/75 dark:text-teal-300/75">Completed costing output</span>
                  {/^https?:\/\//i.test(activeRequest.costingOutputPath) ? (
                    <a href={activeRequest.costingOutputPath} target="_blank" rel="noreferrer" className="break-all text-xs font-semibold text-teal-800 underline underline-offset-2 dark:text-teal-300">{activeRequest.costingOutputPath}</a>
                  ) : (
                    <code className="break-all text-xs text-slate-800 dark:text-zinc-200">{activeRequest.costingOutputPath}</code>
                  )}
                </div>
              )}
              {activeRequest.customDetails?.length ? (
                <div className="overflow-hidden rounded-xl bg-white/80 dark:bg-white/[0.025]">
                  <div className="grid grid-cols-[1fr_1.5fr_1.5fr_auto] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400"><span>Class</span><span>Characteristic</span><span>Value</span><span>Unit</span></div>
                  {activeRequest.customDetails.map((detail, index) => (
                    <div key={detail.id ?? `${detail.className}-${detail.characteristicName}-${index}`} className="grid grid-cols-[1fr_1.5fr_1.5fr_auto] gap-3 border-t border-slate-200/70 px-4 py-2.5 text-xs dark:border-white/[0.06]">
                      <span className="break-words font-semibold">{detail.className || "—"}</span>
                      <span className="break-words">{detail.characteristicName || "—"}</span>
                      <span className="break-words font-medium">{detail.value || "—"}</span>
                      <span>{detail.uom || "—"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {feasibilityDetails.referenceLinks.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-display">
                Client Reference URLs &amp; Benchmark Links ({feasibilityDetails.referenceLinks.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {feasibilityDetails.referenceLinks.map((url, i) => (
                  <a
                    key={i}
                    href={url.startsWith("http") ? url : `https://${url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/70 hover:bg-slate-200/70 dark:bg-zinc-800/60 dark:hover:bg-zinc-700/60 text-xs font-mono text-slate-700 dark:text-zinc-300 transition group"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--accent-primary)]" />
                    <span className="truncate max-w-xs">{url.replace(/^https?:\/\//, "")}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Attached Photos & Mockup Gallery ── */}
          {previewableImages.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-display">
                Attached Reference Images &amp; Mockups ({previewableImages.length})
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previewableImages.map((img, idx) => (
                  <div
                    key={img.id}
                    onClick={() => img.url && onSelectPreviewImage(img.url)}
                    className="group relative rounded-2xl bg-slate-100/60 dark:bg-zinc-900 border border-slate-200/60 dark:border-white/5 overflow-hidden cursor-pointer transition hover:shadow-md"
                  >
                    <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden relative">
                      <img
                        src={imageSourceFor(img.url)}
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[11px] font-semibold text-white bg-black/75 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-2 flex items-center justify-between text-[11px] text-slate-600 dark:text-zinc-400">
                      <span className="truncate font-medium">{img.name}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectorSpecsTab;
