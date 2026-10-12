import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileImage, Plus, X } from "lucide-react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { submitCreativeDesignOutputApi } from "@/infrastructure/api/sampleRequestsApi";

interface Props {
  request: SampleRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => Promise<void>;
  showToast: (message: string) => void;
}

export const CreativeDesignOutputModal: React.FC<Props> = ({ request, isOpen, onClose, onSubmitted, showToast }) => {
  const previousRows = useMemo(() => request?.creativeSubmissions?.flatMap((batch) => batch.rows) || [], [request]);
  const requested = Number(request?.numberOfDesigns || request?.productArtworkNos || 1);
  const remaining = Math.max(0, requested - previousRows.length);
  const [count, setCount] = useState(remaining ? 1 : 0);
  const [fileUrl, setFileUrl] = useState("");
  const [rows, setRows] = useState<Array<{ shutterstockNo: string; remarks: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCount(remaining ? 1 : 0);
    setRows(remaining ? [{ shutterstockNo: "", remarks: "" }] : []);
    setFileUrl("");
    setError("");
  }, [request?.designRequestId, remaining, isOpen]);

  if (!isOpen || !request) return null;
  const firstNumber = previousRows.length + 1;

  const changeCount = (next: number) => {
    const safeCount = Math.max(1, Math.min(remaining, next || 1));
    setCount(safeCount);
    setRows((current) => Array.from({ length: safeCount }, (_, index) => current[index] || { shutterstockNo: "", remarks: "" }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request.designRequestId) return;
    const invalidIndex = rows.findIndex((row) => !row.shutterstockNo.trim() && !row.remarks.trim());
    if (invalidIndex >= 0) {
      setError(`D${firstNumber + invalidIndex} needs a Shutterstock No. or remark.`);
      return;
    }
    if (!fileUrl.trim()) {
      setError("Add a link to the design files before submitting.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await submitCreativeDesignOutputApi(request.designRequestId, { designFileUrl: fileUrl.trim(), rows }, request.claimedBy || undefined);
      await onSubmitted();
      showToast("Design output sent to Marketing for review.");
      onClose();
    } catch (e) {
      console.error("Could not submit Creative design output:", e);
      setError("The output could not be submitted. Please check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-smooth-backdrop p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="creative-output-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900 animate-smooth-modal">
        <header className="bg-gradient-to-r from-purple-700 to-indigo-700 flex items-center justify-between px-6 py-4 text-white">
          <div className="flex items-center gap-3"><span className="rounded-lg bg-white/15 p-2"><FileImage className="h-4 w-4" /></span><div><h2 id="creative-output-title" className="text-base font-semibold">Submit design output</h2><p className="mt-0.5 text-xs text-white/80">{request.srNumber} · {request.customer} · {request.productDescription}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/80 hover:bg-white/15 hover:text-white transition"><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-white/[0.03]"><div className="text-xs text-slate-500">Requested</div><div className="mt-1 text-lg font-semibold text-slate-900 dark:text-zinc-100">{requested} designs</div></div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-700 dark:bg-white/[0.03]"><div className="text-xs text-slate-500">Delivered before</div><div className="mt-1 text-lg font-semibold text-slate-900 dark:text-zinc-100">{previousRows.length} designs</div></div>
              <div className="rounded-xl border border-purple-200/80 bg-purple-50/50 px-4 py-3 dark:border-purple-800/40 dark:bg-purple-950/20"><div className="text-xs text-slate-500">Still due</div><div className="mt-1 text-lg font-semibold text-purple-600 dark:text-purple-400">{remaining} designs</div></div>
            </div>
            {request.designRemarks && <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-white/[0.04] dark:text-zinc-300"><span className="font-medium">Marketing brief: </span>{request.designRemarks}</div>}
            {(request.referenceImages?.length || request.referenceLinks?.length) ? <div className="flex flex-wrap gap-2 text-xs">{[...(request.referenceImages || []), ...(request.referenceLinks || [])].map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-purple-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-purple-400"><ExternalLink className="h-3 w-3" />Reference {index + 1}</a>)}</div> : null}
            {previousRows.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">Previously submitted</h3><div className="flex flex-wrap gap-2">{previousRows.map((row) => <span key={row.designNumber} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300">{row.designNumber}</span>)}</div></div>}
            {remaining === 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">All requested designs have been delivered. This request is with Marketing for review.</div> : <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Artwork folder or design file link/path <span className="text-rose-600">*</span><input type="text" maxLength={2048} required value={fileUrl} onChange={(event) => setFileUrl(event.target.value)} placeholder="Paste a share link or file/folder path" className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 dark:border-slate-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" /></label>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">Designs completed<input type="number" min={1} max={remaining} value={count} onChange={(event) => changeCount(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" /></label>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700">
                <div className="hidden grid-cols-[56px_minmax(180px,1.5fr)_minmax(150px,1fr)] gap-3 bg-slate-50 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/[0.04] md:grid"><span>Design</span><span>Shutterstock No. (optional)</span><span>Creative Remark (optional)</span></div>
                {rows.map((row, index) => <div key={index} className="grid grid-cols-1 gap-3 border-t border-slate-200 p-3 dark:border-zinc-700 sm:grid-cols-2 md:grid-cols-[56px_minmax(180px,1.5fr)_minmax(150px,1fr)]"><span className="text-sm font-semibold text-purple-600 dark:text-purple-400 md:pt-2">D{firstNumber + index}</span><input maxLength={100} aria-label={`D${firstNumber + index} Shutterstock number (optional)`} value={row.shutterstockNo} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, shutterstockNo: event.target.value } : item))} placeholder="Shutterstock No. (optional)" className="h-9 min-w-0 rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" /><input maxLength={1000} aria-label={`D${firstNumber + index} remarks (optional)`} value={row.remarks} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, remarks: event.target.value } : item))} placeholder="Optional remark" className="h-9 min-w-0 rounded-lg border border-slate-300 px-2.5 text-xs outline-none focus:border-purple-500 dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100" /></div>)}
              </div>
              <p className="text-xs text-slate-500">Paste any reference text that helps the team locate the artwork files. Marketing’s description is saved with each design code; each design needs a Shutterstock No. or remark.</p>
            </>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 dark:border-zinc-700 dark:bg-white/[0.02]"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300">Close</button>{remaining > 0 && <button type="submit" disabled={saving} className="bg-purple-600 hover:bg-purple-700 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-95 disabled:cursor-wait disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? "Submitting…" : "Submit to Marketing"}</button>}</footer>
        </form>
      </section>
    </div>
  );
};
