import React from "react";
import { Calendar, Clock, Palette, Sparkles, Users } from "lucide-react";
import { SampleRequestItem } from "../../types";

function formatDate(val?: string | null): string {
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

export interface DesignMetadataStripProps {
  activeRequest: SampleRequestItem;
  mode: "marketing" | "creative" | "sampling";
  requestedCount: number;
  isCounterDatePending: boolean;
  slaStatus: {
    isEligible: boolean;
    hoursRemaining: number;
    label: string;
    deadlineIso: string;
  };
  onOpenCounterDateModal: () => void;
}

export const DesignMetadataStrip: React.FC<DesignMetadataStripProps> = React.memo(({
  activeRequest,
  mode,
  requestedCount,
  isCounterDatePending,
  slaStatus,
  onOpenCounterDateModal,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-3.5 border-t border-slate-100 dark:border-white/5 text-xs">
      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-2xs">
        <span className="text-[11px] text-slate-500 font-medium block">
          Current Deadline
        </span>
        <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-900 dark:text-zinc-100">
          <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span className="font-mono">
            {formatDate(activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)}
          </span>
        </div>
        {mode === "creative" && isCounterDatePending && (
          <p className="mt-1 text-[10px] leading-relaxed text-amber-800 dark:text-amber-300">
            Marketing's date remains the active deadline until the counter is accepted.
          </p>
        )}

        {/* Counter-Date Proposal Trigger for Creative */}
        {mode === "creative" && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {isCounterDatePending ? (
              <span
                role="status"
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
              >
                <Clock className="h-3 w-3" /> Awaiting Marketing
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!activeRequest.claimedBy || !slaStatus.isEligible}
                  onClick={onOpenCounterDateModal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] dark:text-emerald-300 hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                  title={
                    !activeRequest.claimedBy
                      ? slaStatus.isEligible
                        ? "Claim task first to propose a counter date"
                        : "The 48-hour claim and counter-date window has expired"
                      : !slaStatus.isEligible
                      ? slaStatus.label === "Counter proposal already used"
                        ? "Only one counter-date proposal is allowed for this request"
                        : "The 48-hour counter-date window from Marketing's release has expired"
                      : "Propose a revised completion date within 48 hours of Marketing's release"
                  }
                >
                  <Clock className="w-3 h-3" />
                  <span>Propose Date</span>
                </button>
                <span
                  className={`text-[10px] font-mono ${
                    slaStatus.isEligible
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                  title={slaStatus.isEligible ? "Counter-date proposal window" : "Counter-date proposal window closed"}
                >
                  {slaStatus.isEligible
                    ? activeRequest.claimedBy ? slaStatus.label : "Claim task to propose"
                    : slaStatus.label}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-2xs">
        <span className="text-[11px] text-slate-500 font-medium block">
          Artworks Required
        </span>
        <div className="flex items-center gap-1.5 mt-1 font-bold text-[var(--accent-primary)] dark:text-emerald-300">
          <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="tabular-nums font-mono">{requestedCount} Artworks</span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-2xs">
        <span className="text-[11px] text-slate-500 font-medium block">
          Theme / Trend
        </span>
        <div className="flex items-center gap-1.5 mt-1 text-slate-800 dark:text-zinc-200 font-semibold truncate">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{activeRequest.trend || ""}</span>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 shadow-2xs">
        <span className="text-[11px] text-slate-500 font-medium block">
          Target Audience
        </span>
        <div className="flex items-center gap-1.5 mt-1 text-slate-800 dark:text-zinc-200 font-semibold truncate">
          <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{activeRequest.targetAudience || ""}</span>
        </div>
      </div>
    </div>
  );
});

DesignMetadataStrip.displayName = "DesignMetadataStrip";
