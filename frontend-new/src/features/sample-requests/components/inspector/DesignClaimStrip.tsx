import React, { useState } from "react";
import { UserCheck, ShieldAlert, CheckCircle2, Clock, ArrowRight } from "lucide-react";

export interface DesignClaimStripProps {
  claimedBy?: string | null;
  isClaimedByCurrentUser?: boolean;
  claimedAt?: string | null;
  isCreativeMode?: boolean;
  canReleaseClaim?: boolean;
  canRefreshLegacyClaim?: boolean;
  isReleasingClaim?: boolean;
  onReleaseClaim?: () => void;
  canClaim?: boolean;
  isClaiming?: boolean;
  claimDisabledReason?: string;
  slaLabel?: string;
  onClaim: () => void;
}

export const DesignClaimStrip: React.FC<DesignClaimStripProps> = ({
  claimedBy,
  isClaimedByCurrentUser = false,
  claimedAt,
  isCreativeMode = false,
  canReleaseClaim = false,
  canRefreshLegacyClaim = false,
  isReleasingClaim = false,
  onReleaseClaim,
  canClaim = true,
  isClaiming = false,
  claimDisabledReason,
  slaLabel,
  onClaim,
}) => {
  const [confirmRelease, setConfirmRelease] = useState(false);
  const isClaimed = Boolean(claimedBy);
  const formattedClaimedTime = claimedAt
    ? new Date(claimedAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  if (isClaimed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/40 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-950 dark:text-emerald-200 tracking-tight">
                Assigned to {claimedBy}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                CLAIMED
              </span>
            </div>
            {formattedClaimedTime && (
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                <span>Claimed on {formattedClaimedTime}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCreativeMode && canRefreshLegacyClaim && (
            <button
              type="button"
              onClick={onClaim}
              disabled={isClaiming}
              className="rounded-md border border-emerald-300 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:border-emerald-800 dark:bg-black/20 dark:text-emerald-200 dark:hover:bg-emerald-900/30 disabled:opacity-60"
            >
              {isClaiming ? "Confirming..." : "Confirm ownership"}
            </button>
          )}
          {isCreativeMode && slaLabel && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-300">
              <Clock className="h-3 w-3" /> {slaLabel}
            </span>
          )}
          {canReleaseClaim && (
            confirmRelease ? (
              <div className="flex items-center gap-1.5" role="group" aria-label="Confirm release of Creative claim">
                <span className="text-[11px] text-slate-600 dark:text-zinc-300">Make this task available?</span>
                <button
                  type="button"
                  disabled={isReleasingClaim}
                  onClick={onReleaseClaim}
                  className="rounded-md bg-amber-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  {isReleasingClaim ? "Releasing…" : "Confirm"}
                </button>
                <button
                  type="button"
                  disabled={isReleasingClaim}
                  onClick={() => setConfirmRelease(false)}
                  className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] dark:text-zinc-300 dark:hover:bg-white/10 disabled:opacity-60"
                >
                  Keep claim
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRelease(true)}
                disabled={isReleasingClaim}
                className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 dark:text-amber-200 dark:hover:bg-amber-900/30 disabled:opacity-60"
              >
                Release claim
              </button>
            )
          )}
        </div>
        {isCreativeMode && !isClaimedByCurrentUser && (
          <p role="alert" className="basis-full rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Someone is already working on this request. It is reserved for {claimedBy}; only the assigned designer can submit artwork or propose a date.
          </p>
        )}
        {isCreativeMode && isClaimedByCurrentUser && (
          <p role="status" className="basis-full text-[11px] text-emerald-800 dark:text-emerald-300">
            {canRefreshLegacyClaim
              ? "This legacy assignment matches your profile. Confirm ownership to continue working."
              : "You own this claim. You can submit artwork or release the task if you cannot continue."}
          </p>
        )}
      </div>
    );
  }

  // Unclaimed Banner
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400">
          <ShieldAlert className="w-4 h-4 stroke-[2.2]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Unclaimed Design Task
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              PENDING CLAIM
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
            {isCreativeMode
              ? canClaim
              ? "Claim this task to start work. The 48-hour claim and counter-date window starts when Marketing releases it."
                : claimDisabledReason || "The 48-hour claim and counter-date window has expired."
              : "Creative team has not claimed this design assignment yet."}
          </p>
        </div>
      </div>

      {isCreativeMode && (
        <div className="flex flex-wrap items-center gap-2">
          {slaLabel && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Clock className="h-3 w-3" /> {slaLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onClaim}
            disabled={!canClaim || isClaiming}
            title={!canClaim ? claimDisabledReason : "Claim this design request"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 focus-visible:ring-offset-2 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{isClaiming ? "Claiming…" : canClaim ? "Claim Task" : "Claim Window Closed"}</span>
            {canClaim && !isClaiming && <ArrowRight className="w-3 h-3 stroke-[2.5]" />}
          </button>
        </div>
      )}
    </div>
  );
};
