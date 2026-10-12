import React, { useState } from "react";
import { Clock, Calendar, Check, X, AlertTriangle, ArrowRight, MessageSquare } from "lucide-react";

export interface MarketingCounterDateBannerProps {
  originalDate: string;
  proposedDate: string;
  reason?: string | null;
  claimedBy?: string | null;
  requestedAt?: string | null;
  isMarketingMode?: boolean;
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

  return (
    <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-700/70 bg-gradient-to-r from-amber-50/95 via-amber-50/60 to-orange-50/50 dark:from-amber-950/40 dark:via-zinc-900/60 dark:to-orange-950/30 p-4.5 shadow-sm space-y-3 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Clock className="w-4 h-4 stroke-[2.5] " />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-sm tracking-tight font-display">
                Creative Studio Proposed Target Date Adjustment
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                {isMarketingMode ? "REVIEW REQUIRED" : "WAITING ON MARKETING"}
              </span>
            </div>

            {/* Date Comparison Row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                <span>Current deadline:</span>
                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  {originalDate || "—"}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 bg-white/80 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-mono">Proposed: {proposedDate || "—"}</span>
              </div>
            </div>

            {/* Justification Reason */}
            {reason && (
              <div className="pt-1">
                <p className="text-xs text-amber-900/90 dark:text-amber-300/90 bg-white/70 dark:bg-black/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 italic">
                  "{reason}"
                </p>
              </div>
            )}

            <p className="text-[11px] font-medium text-amber-950 dark:text-amber-200">
              {isMarketingMode
                ? "The current deadline stays in effect unless you accept this change."
                : "Keep working to the current deadline shown above until Marketing accepts this proposal."}
            </p>

            <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400">
              Proposed by <span className="font-semibold text-zinc-700 dark:text-zinc-200">{claimedBy || "Creative Lead"}</span>
              {requestedAt && ` · ${new Date(requestedAt).toLocaleDateString("en-IN")}`}
            </p>
            {actionError && (
              <p role="alert" className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {actionError}
              </p>
            )}
          </div>
        </div>

        {/* Marketing Action Decision Buttons */}
        {isMarketingMode && !showRejectInput && (
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => { setActionError(null); setShowRejectInput(true); }}
              className="h-8.5 px-3.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-2xs"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Reject</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmAccept}
              className="h-8.5 px-4 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-white text-xs font-bold cursor-pointer transition shadow-sm flex items-center gap-1.5 active:scale-98"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isProcessing ? "Accepting..." : "Accept New Date"}</span>
            </button>
          </div>
        )}

        {!isMarketingMode && (
          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 self-center bg-white/70 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
            Awaiting Marketing Decision
          </div>
        )}
      </div>

      {/* Reject Confirmation / Feedback Input */}
      {showRejectInput && (
        <div className="pt-2 border-t border-amber-200/80 dark:border-amber-800/40 space-y-2 animate-in fade-in duration-150">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
            Reason for Rejecting Date Adjustment (Optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Client commercial launch deadline cannot be shifted..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              disabled={isProcessing}
              className="flex-1 h-9 px-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmReject}
              className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer transition"
            >
              Confirm Rejection
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setShowRejectInput(false)}
              className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-semibold shrink-0 cursor-pointer transition"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
