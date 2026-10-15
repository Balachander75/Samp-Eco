import React from "react";
import { Package, Factory, AlertTriangle, Plus } from "lucide-react";

export interface DesignNextWorkTabProps {
  refCode: string;
  includedFollowups: string[];
  selectedFollowups: Array<"mockup" | "sample">;
  onToggleFollowup: (value: "mockup" | "sample") => void;
  isAddingFollowups: boolean;
  followupError: string | null;
  onAddFollowups: () => void;
  effectiveDesignId: number | null;
}

export const DesignNextWorkTab: React.FC<DesignNextWorkTabProps> = React.memo(({
  refCode,
  includedFollowups,
  selectedFollowups,
  onToggleFollowup,
  isAddingFollowups,
  followupError,
  onAddFollowups,
  effectiveDesignId,
}) => {
  return (
    <section className="space-y-4" aria-labelledby="design-followup-title">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h3 id="design-followup-title" className="text-sm font-semibold text-[var(--on-surface)]">
            Next Work
          </h3>
          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
            Artwork is accepted. Add Mockup, Sampling, or both to this same request.
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-medium text-[var(--on-surface-muted)] font-mono">
          {refCode}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { value: "mockup" as const, title: "Mockup", detail: "Route the accepted artwork into the Creative mockup workflow.", icon: Package },
          { value: "sample" as const, title: "Sampling", detail: "Add the request to the existing SAMP review workflow.", icon: Factory },
        ]).map((option) => {
          const Icon = option.icon;
          const included = includedFollowups.includes(option.value);
          const selected = selectedFollowups.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-4 transition shadow-2xs ${
                included ? "opacity-75" : "hover:border-[var(--accent-primary)]/50"
              }`}
            >
              <input
                type="checkbox"
                checked={included || selected}
                disabled={included || isAddingFollowups}
                onChange={() => onToggleFollowup(option.value)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)] cursor-pointer"
                aria-label={`Add ${option.title} to this request`}
              />
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-xs font-semibold text-[var(--on-surface)]">
                  {option.title}
                  {included && (
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      Already added
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[11px] leading-4 text-[var(--on-surface-muted)]">
                  {option.detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {followupError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{followupError}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!effectiveDesignId || selectedFollowups.length === 0 || isAddingFollowups}
          onClick={onAddFollowups}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAddingFollowups ? "Adding…" : "Add to this request"}</span>
        </button>
      </div>
    </section>
  );
});

DesignNextWorkTab.displayName = "DesignNextWorkTab";
