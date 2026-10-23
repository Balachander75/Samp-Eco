import React from "react";
import { AlertTriangle, Factory, Package, Plus } from "lucide-react";
import type { DesignFollowupArtwork, DesignFollowupScope } from "../../types";

export interface DesignNextWorkTabProps {
  refCode: string;
  includedFollowups: string[];
  selectedFollowups: DesignFollowupScope[];
  selectedDesigns: Record<DesignFollowupScope, string[]>;
  availableDesigns: DesignFollowupArtwork[];
  onToggleFollowup: (value: DesignFollowupScope) => void;
  onToggleDesign: (scope: DesignFollowupScope, designNumber: string) => void;
  onSetDesigns: (scope: DesignFollowupScope, designNumbers: string[]) => void;
  isAddingFollowups: boolean;
  followupError: string | null;
  onAddFollowups: () => void;
  effectiveDesignId: number | null;
}

export const DesignNextWorkTab: React.FC<DesignNextWorkTabProps> = React.memo(({
  refCode,
  includedFollowups,
  selectedFollowups,
  selectedDesigns,
  availableDesigns,
  onToggleFollowup,
  onToggleDesign,
  onSetDesigns,
  isAddingFollowups,
  followupError,
  onAddFollowups,
  effectiveDesignId,
}) => {
  const hasDesignSelectionForEveryScope = selectedFollowups.every(
    (scope) => selectedDesigns[scope].length > 0,
  );

  return (
    <section className="space-y-4" aria-labelledby="design-followup-title">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <h3 id="design-followup-title" className="text-sm font-semibold text-[var(--on-surface)]">
            Next Work
          </h3>
          <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
            Artwork is accepted. Choose Mockup or Sampling, then select which designs each one uses.
          </p>
          <p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">
            Each selected Mockup design creates its own request. Creative Shutterstock numbers are carried forward automatically.
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-medium text-[var(--on-surface-muted)] font-mono">
          {refCode}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { value: "mockup" as const, title: "Mockup", detail: "Choose the accepted artwork that Mockup should use.", icon: Package },
          { value: "sample" as const, title: "Sampling", detail: "Choose the accepted artwork that Sampling should use.", icon: Factory },
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
                    <span className="text-[10px] font-medium text-emerald-700 ">
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

      {selectedFollowups.map((scope) => {
        const title = scope === "mockup" ? "Mockup" : "Sampling";
        const chosen = selectedDesigns[scope];
        const allSelected = availableDesigns.length > 0 && chosen.length === availableDesigns.length;

        return (
          <fieldset key={scope} aria-label={`Select designs for ${title}`} className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[var(--on-surface)]">
                  Which designs need {title}?
                </p>
                <p className="mt-1 text-[11px] text-[var(--on-surface-muted)]">
                  Select one or more accepted designs. {chosen.length} selected.
                </p>
              </div>
              {availableDesigns.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={allSelected || isAddingFollowups}
                    onClick={() => onSetDesigns(scope, availableDesigns.map((design) => design.designNumber))}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={chosen.length === 0 || isAddingFollowups}
                    onClick={() => onSetDesigns(scope, [])}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--on-surface-muted)] hover:bg-[var(--surface-container)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {availableDesigns.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center text-xs text-[var(--on-surface-muted)]">
                No submitted designs are available to select.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableDesigns.map((design) => {
                  const checked = chosen.includes(design.designNumber);
                  return (
                    <label
                      key={design.designNumber}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                        checked
                          ? "border-[var(--accent-primary)]/50 bg-[var(--accent-primary-subtle)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--accent-primary)]/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isAddingFollowups}
                        onChange={() => onToggleDesign(scope, design.designNumber)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)] cursor-pointer"
                        aria-label={`${title} uses ${design.designNumber}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-[var(--on-surface)]">
                          {design.designNumber}
                          {design.description ? ` · ${design.description}` : ""}
                        </span>
                        {(design.shutterstockNo || design.remarks) && (
                          <span className="mt-1 block text-[10px] leading-4 text-[var(--on-surface-muted)]">
                            {[design.shutterstockNo && `Shutterstock ${design.shutterstockNo}`, design.remarks]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}

      {followupError && (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800  ">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{followupError}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!effectiveDesignId || selectedFollowups.length === 0 || !hasDesignSelectionForEveryScope || isAddingFollowups}
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
