import React from "react";
import { UserCheck, ShieldAlert, CheckCircle2, Clock, ArrowRight } from "lucide-react";

export interface FeasibilityClaimStripProps {
  claimedBy?: string | null;
  claimedAt?: string | null;
  isSamplingMode?: boolean;
  canClaim?: boolean;
  isClaiming?: boolean;
  claimDisabledReason?: string;
  onClaim: () => void;
}

export const FeasibilityClaimStrip: React.FC<FeasibilityClaimStripProps> = ({
  claimedBy,
  claimedAt,
  isSamplingMode = false,
  canClaim = true,
  isClaiming = false,
  claimDisabledReason,
  onClaim,
}) => {
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
              <span className="font-bold text-emerald-950 dark:text-emerald-200 tracking-tight font-display">
                Assigned to {claimedBy}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/60">
                <CheckCircle2 className="w-2.5 h-2.5 stroke-[2.5]" />
                CLAIMED
              </span>
            </div>
            {formattedClaimedTime && (
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-400/90 flex items-center gap-1 mt-0.5 font-mono">
                <Clock className="w-3 h-3" />
                <span>Claimed on {formattedClaimedTime}</span>
              </p>
            )}
          </div>
        </div>

        <span className="text-[11px] font-mono font-semibold text-emerald-800/80 dark:text-emerald-300/80 bg-emerald-100/60 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg border border-emerald-300/40 dark:border-emerald-700/40">
          Sampling Team Review
        </span>
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
            <span className="font-bold tracking-tight text-slate-900 dark:text-zinc-100 font-display">
              Unclaimed Feasibility Task
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              PENDING CLAIM
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-zinc-400">
            {isSamplingMode
              ? canClaim
                ? "Claim this task to start technical evaluation. Ownership is locked to prevent duplicate review."
                : claimDisabledReason || "This feasibility task is not currently open for claiming."
              : "Sampling team has not claimed this feasibility check yet."}
          </p>
        </div>
      </div>

      {isSamplingMode && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClaim}
            disabled={!canClaim || isClaiming}
            title={!canClaim ? claimDisabledReason : "Claim this feasibility check"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/30 focus-visible:ring-offset-2 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>{isClaiming ? "Claiming…" : "Claim Task"}</span>
            {canClaim && !isClaiming && <ArrowRight className="w-3 h-3 stroke-[2.5]" />}
          </button>
        </div>
      )}
    </div>
  );
};

export default FeasibilityClaimStrip;
