import React from "react";
import {
  Layers,
  Plus,
  X,
  FolderOpen,
  Send,
  AlertTriangle,
  ShieldCheck,
  Check,
  RotateCcw,
  ExternalLink,
  Copy,
} from "lucide-react";
import { SampleRequestItem } from "../../types";

function formatDate(val?: any): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return val;
  }
}

function isHttpLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface DesignDeliverablesTabProps {
  activeRequest: SampleRequestItem;
  mode: "marketing" | "creative";
  deliveredCount: number;
  requestedCount: number;
  remainingCount: number;
  isAwaitingReview: boolean;
  isRemainingRequested: boolean;
  canSubmitCreativeOutput: boolean;
  showSubmitForm: boolean;
  onToggleSubmitForm: () => void;
  designFileUrl: string;
  onChangeDesignFileUrl: (url: string) => void;
  outputCount: number;
  onChangeOutputCount: (count: number) => void;
  outputRows: Array<{ shutterstockNo: string; remarks: string }>;
  onChangeOutputRows: (rows: Array<{ shutterstockNo: string; remarks: string }>) => void;
  isSubmittingOutput: boolean;
  submitError: string | null;
  onSubmitBatch: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancelSubmit: () => void;
  isDeciding: boolean;
  decisionError: string | null;
  onMarketingDecision: (decision: "accept" | "request_remaining") => void;
  isAcceptedByMarketing: boolean;
  onOpenNextWork: () => void;
  submissions: any[];
  copiedArtworkPath: string;
  onCopyArtworkPath: (path: string) => void;
}

export const DesignDeliverablesTab: React.FC<DesignDeliverablesTabProps> = React.memo(({
  activeRequest,
  mode,
  deliveredCount,
  requestedCount,
  remainingCount,
  isAwaitingReview,
  isRemainingRequested,
  canSubmitCreativeOutput,
  showSubmitForm,
  onToggleSubmitForm,
  designFileUrl,
  onChangeDesignFileUrl,
  outputCount,
  onChangeOutputCount,
  outputRows,
  onChangeOutputRows,
  isSubmittingOutput,
  submitError,
  onSubmitBatch,
  onCancelSubmit,
  isDeciding,
  decisionError,
  onMarketingDecision,
  isAcceptedByMarketing,
  onOpenNextWork,
  submissions,
  copiedArtworkPath,
  onCopyArtworkPath,
}) => {
  return (
    <div className="space-y-6">
      {/* Deliverable Progress Card */}
      <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-mono font-bold uppercase text-zinc-500">
              Deliverable Fulfillment
            </div>
            <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
              {deliveredCount} of {requestedCount} Artworks Completed
            </div>
          </div>

          {canSubmitCreativeOutput && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleSubmitForm}
                disabled={!activeRequest.claimedBy || isSubmittingOutput}
                aria-expanded={showSubmitForm}
                aria-controls="creative-output-matrix"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                title={!activeRequest.claimedBy ? "Claim the task before submitting artwork" : "Open the artwork submission matrix"}
              >
                {showSubmitForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{showSubmitForm ? "Close Matrix" : "Submit Artwork Matrix"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          role="progressbar"
          aria-label="Artwork deliverables completed"
          aria-valuemin={0}
          aria-valuemax={requestedCount}
          aria-valuenow={deliveredCount}
        >
          <div
            className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.round((deliveredCount / Math.max(1, requestedCount)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Inline creative submission matrix */}
      {canSubmitCreativeOutput && showSubmitForm && (
        <form
          id="creative-output-matrix"
          aria-labelledby="creative-output-matrix-title"
          aria-busy={isSubmittingOutput}
          onSubmit={onSubmitBatch}
          className="space-y-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80 dark:bg-zinc-900/40 dark:ring-zinc-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-zinc-100">
                <FolderOpen className="h-4 w-4 text-[var(--accent-primary)] dark:text-emerald-300" />
                <h3 id="creative-output-matrix-title">Artwork submission matrix</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)] dark:bg-emerald-950/50 dark:text-emerald-300 font-mono">
                  Batch #{submissions.length + 1}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">
                Shutterstock No. and remark are optional individually; enter at least one for each artwork.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-white/5 dark:text-zinc-300 font-mono">
              {remainingCount} remaining
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div>
              <label htmlFor="creative-output-file-link" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Artwork folder or design file link/path <span className="text-rose-500">*</span>
              </label>
              <input
                id="creative-output-file-link"
                type="text"
                required
                disabled={isSubmittingOutput}
                maxLength={2048}
                value={designFileUrl}
                onChange={(e) => onChangeDesignFileUrl(e.target.value)}
                placeholder="Paste a share link or file/folder path"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Paste any reference text that helps the team locate the artwork files. URLs and paths also work.</p>
            </div>
            <div>
              <label htmlFor="creative-output-count" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Artworks in this batch
              </label>
              <input
                id="creative-output-count"
                type="number"
                min={1}
                max={remainingCount}
                disabled={isSubmittingOutput}
                value={outputCount}
                onChange={(e) => onChangeOutputCount(Number(e.target.value))}
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-mono text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 tabular-nums"
              />
            </div>
          </div>

          {/* Dynamic Rows */}
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-zinc-800">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[52px_minmax(180px,1.2fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                <span>Code</span>
                <span>Marketing Description</span>
                <span>Shutterstock No. (optional)</span>
                <span>Creative Remark (optional)</span>
              </div>
              {outputRows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[52px_minmax(180px,1.2fr)_minmax(170px,0.9fr)_minmax(150px,0.8fr)] items-center gap-2 border-t border-slate-100 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <span className="font-mono text-xs font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                    D{deliveredCount + index + 1}
                  </span>
                  <span className="min-w-0 text-xs font-medium text-slate-700 dark:text-zinc-200 truncate">
                    {(activeRequest.productDescription || "").trim()} - D{deliveredCount + index + 1}
                  </span>
                  <input
                    type="text"
                    disabled={isSubmittingOutput}
                    maxLength={100}
                    aria-label={`Artwork D${deliveredCount + index + 1} Shutterstock number`}
                    placeholder="Enter Shutterstock No."
                    value={row.shutterstockNo}
                    onChange={(e) =>
                      onChangeOutputRows(
                        outputRows.map((r, i) => (i === index ? { ...r, shutterstockNo: e.target.value } : r))
                      )
                    }
                    className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    type="text"
                    disabled={isSubmittingOutput}
                    maxLength={1000}
                    aria-label={`Artwork D${deliveredCount + index + 1} creative remark`}
                    placeholder="Optional remark"
                    value={row.remarks}
                    onChange={(e) =>
                      onChangeOutputRows(
                        outputRows.map((r, i) => (i === index ? { ...r, remarks: e.target.value } : r))
                      )
                    }
                    className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmittingOutput}
              onClick={onCancelSubmit}
              className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingOutput || !designFileUrl.trim() || outputRows.some((row) => !row.shutterstockNo.trim() && !row.remarks.trim())}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingOutput ? "Submitting…" : "Submit batch to Marketing"}</span>
            </button>
          </div>
        </form>
      )}

      {mode === "creative" && (isAwaitingReview || isRemainingRequested) && (
        <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/25 dark:text-amber-200 dark:ring-amber-900/50">
          {isRemainingRequested ? (
            <>
              <strong className="font-semibold">Marketing requested the remaining artwork.</strong>{" "}
              Submit the next batch whenever it is ready; this request stays with Creative until Marketing accepts it. {remainingCount} remaining.
            </>
          ) : (
            <>
              <strong className="font-semibold">Waiting for Marketing review.</strong>{" "}
              The submitted batch is saved in this request. Marketing can accept it or request the remaining artwork.
            </>
          )}
        </div>
      )}

      {/* Marketing Review Verdict Spotlight */}
      {mode === "marketing" && (isAwaitingReview || isRemainingRequested) && (
        <div className="p-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/[0.03] dark:border-[var(--accent-primary)]/40 dark:bg-[var(--accent-primary)]/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4" />
            <span>Marketing Review &amp; Commercial Sign-Off</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Creative Studio has submitted <strong className="tabular-nums">{deliveredCount} of {requestedCount}</strong> requested artworks.
            {isRemainingRequested && remainingCount > 0
              ? <> Creative is continuing the remaining work ({remainingCount} left); you can accept the delivered set whenever it is ready.</>
              : " Review the deliverables and select your verdict."}
          </p>

          {decisionError && (
            <div className="flex items-center gap-2 rounded bg-rose-50 p-2 text-xs font-semibold text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{decisionError}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isDeciding}
              onClick={() => onMarketingDecision("accept")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isDeciding ? "Processing..." : isRemainingRequested ? "Accept Delivered Designs & Close" : "Accept & Continue"}</span>
            </button>

            {!isRemainingRequested && remainingCount > 0 && (
              <button
                type="button"
                disabled={isDeciding}
                onClick={() => onMarketingDecision("request_remaining")}
                className="inline-flex items-center gap-1.5 rounded border border-[var(--accent-primary)]/40 bg-white px-3 py-1.5 text-xs font-bold text-[var(--accent-primary)] transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Request Remaining Artworks ({remainingCount})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {mode === "marketing" && isAcceptedByMarketing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-3">
          <p className="text-xs text-[var(--on-surface-muted)]">Artwork accepted. Mockup or Sampling can be added from the Next Work stage.</p>
          <button type="button" onClick={onOpenNextWork} className="rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] cursor-pointer">
            Open Next Work
          </button>
        </div>
      )}

      {/* Submissions History List */}
      {submissions.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
          <Layers className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            No artwork outputs submitted yet.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((batch, bIdx) => (
            <div
              key={bIdx}
              className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40 overflow-hidden shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    Batch #{bIdx + 1}
                  </span>
                  <span className="text-zinc-400">•</span>
                  <span className="text-zinc-500 font-mono">
                    {formatDate(batch.submittedAt)}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 font-mono tabular-nums">
                    {batch.rows?.length || 0} Artworks
                  </span>
                </div>

                {batch.designFileUrl && (isHttpLink(batch.designFileUrl) ? (
                  <a
                    href={batch.designFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-semibold transition"
                  >
                    <span>Open Artwork Files</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCopyArtworkPath(batch.designFileUrl)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-semibold transition cursor-pointer"
                    title={batch.designFileUrl}
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedArtworkPath === batch.designFileUrl ? "Path Copied" : "Copy Artwork Path"}</span>
                  </button>
                ))}
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-[10.5px] uppercase font-mono text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
                  <tr>
                    <th className="px-3.5 py-2 w-16">Code</th>
                    <th className="px-3.5 py-2">Marketing Description</th>
                    <th className="px-3.5 py-2">Shutterstock No.</th>
                    <th className="px-3.5 py-2">Creative Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(batch.rows || []).map((row: any) => (
                    <tr key={row.designNumber}>
                      <td className="px-3.5 py-2.5 font-mono font-bold text-[var(--accent-primary)] dark:text-emerald-300">
                        {row.designNumber}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {row.description}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-medium text-zinc-800 dark:text-zinc-200">
                        {row.shutterstockNo || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-600 dark:text-zinc-400">
                        {row.remarks || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

DesignDeliverablesTab.displayName = "DesignDeliverablesTab";
