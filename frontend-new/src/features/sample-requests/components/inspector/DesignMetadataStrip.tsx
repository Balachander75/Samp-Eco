import React from "react";
import { Calendar, Clock, Palette, Sparkles, Users } from "lucide-react";
import { SampleRequestItem } from "../../types";

function formatDate(val?: string | null): string {
  if (!val) return "Not specified";
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
  canProposeCounterDate: boolean;
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
  canProposeCounterDate,
  onOpenCounterDateModal,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-[var(--border-subtle)] text-xs">
      {/* Box 1: Current Artwork Deadline */}
      <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold block">
            Artwork Target
          </span>
          <div className="flex items-center gap-1.5 mt-1 font-bold text-[var(--on-surface)]">
            <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="font-mono text-xs">
              {formatDate(activeRequest.targetArtworkDateCreative || activeRequest.sampleRequiredDate)}
            </span>
          </div>
        </div>

        {/* Counter-Date Proposal Trigger for Creative */}
        {mode === "creative" && (
          <div className="mt-2 pt-1.5 border-t border-[var(--border-subtle)] flex items-center gap-1.5 flex-wrap">
            {isCounterDatePending ? (
              <span
                role="status"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
              >
                <Clock className="h-3 w-3" /> Awaiting Marketing
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!canProposeCounterDate}
                  onClick={onOpenCounterDateModal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] hover:underline disabled:opacity-40 disabled:no-underline cursor-pointer"
                  title={
                    !activeRequest.claimedBy
                      ? slaStatus.isEligible
                        ? "Claim task first to propose a counter date"
                        : "The 48-hour claim and counter-date window has expired"
                      : !canProposeCounterDate && slaStatus.isEligible
                      ? activeRequest.claimedByUserId == null
                        ? "Confirm ownership before proposing a counter date"
                        : "Only the assigned designer can propose a counter date"
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
                  className={`text-[9.5px] font-mono ${
                    slaStatus.isEligible
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "text-[var(--on-surface-subtle)]"
                  }`}
                >
                  {slaStatus.isEligible ? (activeRequest.claimedBy ? slaStatus.label : "Claim to propose") : slaStatus.label}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Box 2: Artworks Required */}
      <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold block">
          Requested Variants
        </span>
        <div className="flex items-center gap-1.5 mt-1 font-bold text-[var(--accent-primary)]">
          <Palette className="w-3.5 h-3.5" />
          <span className="tabular-nums font-mono text-xs">{requestedCount} Artworks</span>
        </div>
        <span className="text-[10px] text-[var(--on-surface-muted)] mt-1 font-mono">
          Batch output allowed
        </span>
      </div>

      {/* Box 3: Theme / Trend */}
      <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold block">
          Theme / Trend
        </span>
        <div className="flex items-center gap-1.5 mt-1 text-[var(--on-surface)] font-semibold truncate">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
          <span className="truncate text-xs">{activeRequest.trend || "General Commercial"}</span>
        </div>
        <span className="text-[10px] text-[var(--on-surface-muted)] mt-1 truncate">
          {activeRequest.programName || "Commercial Brief"}
        </span>
      </div>

      {/* Box 4: Target Audience */}
      <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-subtle)] font-semibold block">
          Target Audience
        </span>
        <div className="flex items-center gap-1.5 mt-1 text-[var(--on-surface)] font-semibold truncate">
          <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="truncate text-xs">{activeRequest.targetAudience || "All Demographics"}</span>
        </div>
        <span className="text-[10px] text-[var(--on-surface-muted)] mt-1 truncate">
          {activeRequest.customer || "Commercial Account"}
        </span>
      </div>
    </div>
  );
});

DesignMetadataStrip.displayName = "DesignMetadataStrip";
