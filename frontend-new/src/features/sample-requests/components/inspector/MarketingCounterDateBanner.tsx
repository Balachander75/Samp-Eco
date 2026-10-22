import React, { useState } from "react";
import { ArrowRight, Check, Clock, MessageSquare, X } from "lucide-react";

type CounterDateDecision = "pending" | "accepted" | "rejected" | "auto_accepted" | null;

export interface MarketingCounterDateBannerProps {
  originalDate: string;
  proposedDate: string;
  reason?: string | null;
  claimedBy?: string | null;
  requestedAt?: string | null;
  isMarketingMode?: boolean;
  proposerTitle?: string;
  decision?: CounterDateDecision;
  decisionNotes?: string | null;
  decisionAt?: string | null;
  extensionDays?: number | null;
  onAccept: () => Promise<void> | void;
  onReject: (rejectionNotes?: string) => Promise<void> | void;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const MarketingCounterDateBanner: React.FC<MarketingCounterDateBannerProps> = ({
  originalDate,
  proposedDate,
  reason,
  claimedBy,
  requestedAt,
  isMarketingMode = false,
  proposerTitle = "Sampling Team",
  decision = "pending",
  decisionNotes,
  decisionAt,
  extensionDays,
  onAccept,
  onReject,
}) => {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAccepted = decision === "accepted" || decision === "auto_accepted";
  const isRejected = decision === "rejected";
  const isPending = !isAccepted && !isRejected;
  const StatusIcon = isAccepted ? Check : isRejected ? X : Clock;
  const tone = isAccepted
    ? {
        border: "border-emerald-200 dark:border-emerald-900/50",
        surface: "bg-emerald-50/70 dark:bg-emerald-950/20",
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
        title: "text-emerald-950 dark:text-emerald-200",
        muted: "text-emerald-800 dark:text-emerald-300",
        pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
      }
    : isRejected
    ? {
        border: "border-rose-200 dark:border-rose-900/50",
        surface: "bg-rose-50/60 dark:bg-rose-950/20",
        icon: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
        title: "text-rose-950 dark:text-rose-200",
        muted: "text-rose-800 dark:text-rose-300",
        pill: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
      }
    : {
        border: "border-amber-200 dark:border-amber-900/50",
        surface: "bg-amber-50/60 dark:bg-amber-950/20",
        icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
        title: "text-amber-950 dark:text-amber-200",
        muted: "text-amber-800 dark:text-amber-300",
        pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
      };

  const statusTitle = isAccepted
    ? "Marketing accepted the revised date"
    : isRejected
    ? "Marketing declined the revised date"
    : `${proposerTitle} proposed a revised target date`;
  const statusLabel = isAccepted
    ? "ACCEPTED"
    : isRejected
    ? "DECLINED"
    : isMarketingMode
    ? "REVIEW REQUIRED"
    : "WAITING ON MARKETING";
  const statusDescription = isAccepted
    ? "The proposed deadline is now active."
    : isRejected
    ? "The original deadline remains active."
    : isMarketingMode
    ? "Review the requested change. The current deadline stays active until you decide."
    : "The current deadline stays active until Marketing responds.";

  const handleDecision = async (action: "accept" | "reject") => {
    setIsProcessing(true);
    setActionError(null);
    try {
      if (action === "accept") await onAccept();
      else await onReject(rejectNotes.trim());
      setShowRejectInput(false);
    } catch (error: any) {
      setActionError(
        error?.message ||
          (action === "accept" ? "Could not accept the revised date." : "Could not decline the revised date.")
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section
      aria-label="Target date proposal status"
      className={`rounded-lg border ${tone.border} ${tone.surface} px-3 py-2.5 space-y-2.5`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
            <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className={`text-xs font-bold tracking-tight ${tone.title}`}>{statusTitle}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${tone.pill}`}>
                {statusLabel}
              </span>
            </div>
            <p className={`mt-0.5 text-[11px] leading-4 ${tone.muted}`}>{statusDescription}</p>
          </div>
        </div>

        {isMarketingMode && isPending && !showRejectInput && (
          <div className="ml-9 flex shrink-0 items-center gap-1.5 sm:ml-0">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setShowRejectInput(true)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-rose-300 px-2.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/30 disabled:cursor-wait disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              <X className="h-3 w-3" />
              Decline
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleDecision("accept")}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--accent-primary)] px-2.5 text-[11px] font-bold text-white transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 disabled:cursor-wait disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {isProcessing ? "Saving…" : "Accept date"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-[var(--surface-lowest)]/70 px-2.5 py-1.5 text-xs">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">Current</span>
        <span className="font-semibold tabular-nums text-[var(--on-surface)]">{originalDate || "Original date unavailable"}</span>
        <ArrowRight className={`h-3.5 w-3.5 ${tone.muted}`} aria-hidden="true" />
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${tone.muted}`}>
          {isAccepted ? "Accepted" : isRejected ? "Declined" : "Proposed"}
        </span>
        <span className={`font-bold tabular-nums ${tone.title}`}>{proposedDate || "Not specified"}</span>
      </div>

      {(reason || (isRejected && decisionNotes) || claimedBy || requestedAt || decisionAt || extensionDays) && (
        <div className="grid gap-x-4 gap-y-2 border-t border-[var(--border-subtle)]/70 pt-2 sm:grid-cols-2">
          {reason && (
            <div className="min-w-0 text-[11px] leading-4">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--on-surface-muted)]">
                <MessageSquare className="h-3 w-3" />
                Reason
              </div>
              <p className="mt-0.5 break-words whitespace-pre-wrap text-[var(--on-surface)]">{reason}</p>
            </div>
          )}
          {isRejected && decisionNotes && (
            <div className="min-w-0 text-[11px] leading-4">
              <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-800 dark:text-rose-300">
                <MessageSquare className="h-3 w-3" />
                Marketing note
              </div>
              <p className="mt-0.5 break-words whitespace-pre-wrap text-[var(--on-surface)]">{decisionNotes}</p>
            </div>
          )}
          {(claimedBy || requestedAt || decisionAt || (extensionDays && extensionDays > 0)) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--on-surface-muted)] sm:col-span-2">
              {claimedBy && <span>Proposed by <strong className="font-semibold text-[var(--on-surface)]">{claimedBy}</strong></span>}
              {requestedAt && <span>Submitted {formatDateTime(requestedAt)}</span>}
              {decisionAt && !isPending && <span>Decision {formatDateTime(decisionAt)}</span>}
              {Boolean(extensionDays && extensionDays > 0) && <span>+{extensionDays} workdays requested</span>}
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {actionError}
        </div>
      )}

      {showRejectInput && isMarketingMode && isPending && (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-[var(--border-subtle)]/70 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleDecision("reject");
          }}
        >
          <div className="min-w-[220px] flex-1">
            <label htmlFor="counter-date-rejection-note" className="block text-[10px] font-semibold text-[var(--on-surface)]">
              Reason for declining <span className="font-normal text-[var(--on-surface-muted)]">(optional)</span>
            </label>
            <input
              id="counter-date-rejection-note"
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              disabled={isProcessing}
              maxLength={1000}
              placeholder="Explain why the original date must remain"
              className="mt-1 h-8 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-2.5 text-[11px] text-[var(--on-surface)] outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={isProcessing}
            className="h-8 rounded-md bg-rose-600 px-3 text-[11px] font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-50"
          >
            {isProcessing ? "Saving…" : "Confirm decline"}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              setShowRejectInput(false);
              setActionError(null);
            }}
            className="h-8 rounded-md px-2.5 text-[11px] font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-lowest)] disabled:opacity-50"
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
};

export default MarketingCounterDateBanner;
