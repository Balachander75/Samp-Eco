import React, { useState } from "react";
import { Clock, Calendar, Check, X, ArrowRight, MessageSquare, ShieldCheck } from "lucide-react";

export interface MarketingCounterDateBannerProps {
  originalDate: string;
  proposedDate: string;
  reason?: string | null;
  claimedBy?: string | null;
  requestedAt?: string | null;
  isMarketingMode?: boolean;
  proposerTitle?: string;
  onAccept: () => Promise<void> | void;
  onReject: (rejectionNotes?: string) => Promise<void> | void;
}

export const MarketingCounterDateBanner: React.FC<MarketingCounterDateBannerProps> = ({
  originalDate,
  proposedDate,
  reason,
  claimedBy,
  requestedAt,
  isMarketingMode = false,
  proposerTitle = "Sampling Team",
  onAccept,
  onReject,
}) => {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleConfirmAccept = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onAccept();
    } catch (error: any) {
      setActionError(error?.message || "Could not accept the counter date. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    setIsProcessing(true);
    setActionError(null);
    try {
      await onReject(rejectNotes.trim());
      setShowRejectInput(false);
    } catch (error: any) {
      setActionError(error?.message || "Could not reject the counter date. Please retry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formattedDate = requestedAt
    ? new Date(requestedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <section
      aria-label="Target date adjustment proposal"
      className="rounded-2xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white dark:from-amber-950/25 dark:via-zinc-900/40 dark:to-zinc-900/80 p-4 sm:p-5 shadow-2xs space-y-3.5 transition-all"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left: Icon & Details */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Clock className="w-4 h-4 stroke-[2.4]" />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-sm tracking-tight font-display">
                {proposerTitle} Proposed Revised Target Date
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200 border border-amber-300/70 dark:border-amber-700/80">
                {!isMarketingMode && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                )}
                <span>{isMarketingMode ? "REVIEW REQUIRED" : "WAITING ON MARKETING SIGN-OFF"}</span>
              </span>
            </div>

            {/* Date Comparison Cards */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Original Date:</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    {originalDate || "Flexible"}
                  </span>
                </div>
              </div>

              <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300/70 dark:border-emerald-700/60 text-xs shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex items-center gap-1.5 font-bold text-emerald-950 dark:text-emerald-200">
                  <span className="text-[11px] text-emerald-800/90 dark:text-emerald-400 font-medium">Proposed Date:</span>
                  <span className="font-mono">{proposedDate || "—"}</span>
                </div>
              </div>
            </div>

            {/* Justification Reason Box */}
            {reason && (
              <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-300 font-mono">
                  <MessageSquare className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Technical Justification:</span>
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 italic leading-relaxed pl-4 border-l-2 border-amber-400/60 dark:border-amber-600/60">
                  "{reason}"
                </p>
                <div className="flex items-center justify-between text-[10.5px] text-zinc-500 dark:text-zinc-400 pt-1 font-mono">
                  <span>
                    Proposed by <span className="font-semibold text-zinc-700 dark:text-zinc-300">{claimedBy || `${proposerTitle} Lead`}</span>
                  </span>
                  {formattedDate && <span>Submitted {formattedDate}</span>}
                </div>
              </div>
            )}

            {/* Context Helper */}
            <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-normal">
              {isMarketingMode
                ? "The original required date remains active until you confirm this proposed schedule adjustment."
                : "Work is ongoing against the active deadline. Marketing will confirm or decline this proposed timeline."}
            </p>

            {actionError && (
              <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800">
                {actionError}
              </div>
            )}
          </div>
        </div>

        {/* Marketing Decision Actions */}
        {isMarketingMode && !showRejectInput && (
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => {
                setActionError(null);
                setShowRejectInput(true);
              }}
              className="h-9 px-3.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-2xs active:scale-98"
            >
              <X className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Decline</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmAccept}
              className="h-9 px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-bold cursor-pointer transition shadow-sm flex items-center gap-1.5 active:scale-98"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>{isProcessing ? "Accepting..." : "Accept New Date"}</span>
            </button>
          </div>
        )}

        {/* Sampling Status Notice */}
        {!isMarketingMode && (
          <div className="shrink-0 self-start sm:self-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/70 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800/60 text-xs font-medium font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Sent to Marketing</span>
            </div>
          </div>
        )}
      </div>

      {/* Decline Feedback Input (Marketing Only) */}
      {showRejectInput && (
        <div className="pt-3 border-t border-amber-200/70 dark:border-amber-800/40 space-y-2 animate-smooth-modal">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 font-mono">
            Reason for Declining (Optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Client commercial launch requires delivery on original committed date..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              disabled={isProcessing}
              className="flex-1 h-9 px-3.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmReject}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer transition active:scale-98"
            >
              Confirm Decline
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setShowRejectInput(false)}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold shrink-0 cursor-pointer transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default MarketingCounterDateBanner;
