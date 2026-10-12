import React, { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, ExternalLink, FileOutput, X } from "lucide-react";
import { SampleRequestItem } from "@/features/sample-requests/types";

interface CostingRequestInspectorModalProps {
  request: SampleRequestItem | null;
  isSubmitting: boolean;
  isOfferingCounterDate: boolean;
  onClose: () => void;
  onSubmit: (counterDate: string, outputPath: string) => Promise<void>;
  onOfferCounterDate: (counterDate: string) => Promise<void>;
}

const Detail: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="min-w-0 rounded-xl bg-slate-50/80 p-3 dark:bg-white/[0.035]">
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</span>
    <span className="mt-1 block break-words text-sm font-semibold text-slate-900 dark:text-zinc-100">{value || "—"}</span>
  </div>
);

export const CostingRequestInspectorModal: React.FC<CostingRequestInspectorModalProps> = ({
  request,
  isSubmitting,
  isOfferingCounterDate,
  onClose,
  onSubmit,
  onOfferCounterDate,
}) => {
  const [counterDate, setCounterDate] = useState("");
  const [outputPath, setOutputPath] = useState("");

  useEffect(() => {
    setCounterDate(request?.costingCounterDate || "");
    setOutputPath(request?.costingOutputPath || "");
  }, [request?.id, request?.costingCounterDate, request?.costingOutputPath]);

  if (!request) return null;

  const pack = request.unitPcPack === "Pack" || request.unitPcPack === "PACK";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-xs animate-smooth-backdrop sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="costing-inspector-title" className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900 animate-smooth-modal">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-white/[0.07]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800 dark:text-teal-300"><CalculatorIcon /></div>
            <div className="min-w-0">
              <h2 id="costing-inspector-title" className="truncate text-lg font-bold tracking-tight text-slate-950 dark:text-white">Costing Request Review</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-zinc-400">{request.srNumber} · {request.customer} · {request.targetPlant || "Plant not assigned"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close costing inspection" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.07] dark:hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
          <section className="space-y-3">
            <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-teal-700 dark:text-teal-300" /><h3 className="text-sm font-bold text-slate-900 dark:text-white">Request & product details</h3></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <Detail label="Product" value={request.productDescription} />
              <Detail label="Material code" value={request.materialCode} />
              <Detail label="Customer SKU" value={request.customerProductCode} />
              <Detail label="Barcode" value={request.barcode} />
              <Detail label="Brand" value={request.brandName} />
              <Detail label="Quantity for costing" value={request.qtyDesignCosting} />
              <Detail label="Unit" value={request.unitPcPack} />
              {pack && <Detail label="Pieces per pack" value={request.qtyPerPack} />}
              <Detail label="Costing required date" value={request.costingRequiredDate} />
              <Detail label="Product category" value={request.productCategory} />
              <Detail label="Subcategory" value={request.productSubCategory} />
              <Detail label="Third category" value={request.productThirdCategory} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-teal-700 dark:text-teal-300" /><h3 className="text-sm font-bold text-slate-900 dark:text-white">Product class characteristics</h3></div>
            {request.customDetails?.length ? (
              <div className="overflow-hidden rounded-xl bg-slate-50 dark:bg-white/[0.025]">
                <div className="grid grid-cols-[1fr_1.5fr_1.5fr_auto] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400"><span>Class</span><span>Characteristic</span><span>Value</span><span>Unit</span></div>
                {request.customDetails.map((detail, index) => (
                  <div key={detail.id ?? `${detail.className}-${detail.characteristicName}-${index}`} className="grid grid-cols-[1fr_1.5fr_1.5fr_auto] gap-3 border-t border-slate-200/70 px-4 py-2.5 text-xs dark:border-white/[0.06]">
                    <span className="break-words font-semibold text-slate-700 dark:text-zinc-300">{detail.className || "—"}</span>
                    <span className="break-words text-slate-700 dark:text-zinc-300">{detail.characteristicName || "—"}</span>
                    <span className="break-words font-medium text-slate-950 dark:text-white">{detail.value || "—"}</span>
                    <span className="text-slate-500 dark:text-zinc-400">{detail.uom || "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-zinc-400">No class characteristics are attached to this product.</p>
            )}
          </section>

          <form className="space-y-4 rounded-2xl bg-teal-50/50 p-4 dark:bg-teal-950/15 sm:p-5" onSubmit={(event) => { event.preventDefault(); void onSubmit(counterDate, outputPath); }}>
            <div>
              <div className="flex items-center gap-2"><FileOutput className="h-4 w-4 text-teal-800 dark:text-teal-300" /><h3 className="text-sm font-bold text-slate-900 dark:text-white">Costing output & handoff</h3></div>
              <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Offer a revised date if needed. Add the completed costing output path to send this request to Marketing.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Counter date offered <span className="font-normal text-slate-500">(optional)</span></span>
                <span className="relative block"><CalendarClock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="date" value={counterDate} onChange={(event) => setCounterDate(event.target.value)} className="h-10 w-full rounded-xl bg-white pl-9 pr-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-700 dark:bg-zinc-900 dark:text-white dark:ring-white/10" /></span>
              </label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-700 dark:text-zinc-300">
                <span>Completed costing output path <span className="text-rose-500">*</span></span>
                <span className="relative block"><ExternalLink className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input required value={outputPath} onChange={(event) => setOutputPath(event.target.value)} placeholder="Shared path or output URL" className="h-10 w-full rounded-xl bg-white pl-9 pr-3 text-xs text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-700 dark:bg-zinc-900 dark:text-white dark:ring-white/10" /></span>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-900/10 pt-3 dark:border-white/[0.08]">
              <span className="text-[11px] text-slate-600 dark:text-zinc-400">Submitting completes Costing and moves the request to Marketing.</span>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={isOfferingCounterDate || isSubmitting || !counterDate} onClick={() => void onOfferCounterDate(counterDate)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.07] dark:text-teal-200 dark:hover:bg-white/10">
                  <CalendarClock className="h-4 w-4" />{isOfferingCounterDate ? "Offering…" : "Offer counter date"}
                </button>
                <button type="submit" disabled={isSubmitting || isOfferingCounterDate || !outputPath.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-800 px-5 text-xs font-bold text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500">
                  <CheckCircle2 className="h-4 w-4" />{isSubmitting ? "Submitting…" : "Submit costing to Marketing"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

const CalculatorIcon = () => <ClipboardList className="h-5 w-5" />;

export default CostingRequestInspectorModal;
