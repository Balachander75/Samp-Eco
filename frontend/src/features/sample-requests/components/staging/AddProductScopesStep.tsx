import React from "react";
import { X, Check, ChevronRight, Palette, Box, FlaskConical, Calculator } from "lucide-react";
import { DeliverableScopeId, DELIVERABLES } from "../../types/staging";

const SCOPES_METADATA: Record<
  DeliverableScopeId,
  {
    description: string;
    badge: string;
    badgeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
  }
> = {
  design: {
    description: "Artwork concepts, graphic designs & styling",
    badge: "DESIGN",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40",
    icon: Palette,
    iconColor: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  },
  mockup: {
    description: "Die-lines, dummy carton & structural prototype",
    badge: "MOCKUP",
    badgeColor: "bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40",
    icon: Box,
    iconColor: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
  sample: {
    description: "Physical production sample, binding & finishing",
    badge: "SAMPLE",
    badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40",
    icon: FlaskConical,
    iconColor: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  costing: {
    description: "Factory bill of materials & unit costing estimate",
    badge: "COSTING",
    badgeColor: "bg-teal-50 text-teal-800 border-teal-200/80 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40",
    icon: Calculator,
    iconColor: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  },
};

export interface AddProductScopesStepProps {
  selectedScopes: DeliverableScopeId[];
  isScopeDisabled: (scope: DeliverableScopeId) => boolean;
  onToggleScope: (scope: DeliverableScopeId) => void;
  onClose: () => void;
  onProceed: (e: React.FormEvent) => void;
}

export const AddProductScopesStep: React.FC<AddProductScopesStepProps> = ({
  selectedScopes,
  isScopeDisabled,
  onToggleScope,
  onClose,
  onProceed,
}) => {
  return (
    <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl animate-smooth-modal dark:border-white/[0.08] dark:bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-white/[0.06] sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white font-display sm:text-base">
              Add Staged Product Deliverables
            </h3>
            <span className="rounded-full border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/10 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wide text-[var(--accent-primary)] dark:text-emerald-400">
              DELIVERABLES SPEC
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
            Select product deliverables. Design is submitted separately.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scopes Grid */}
      <form onSubmit={onProceed} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-3 overflow-y-auto bg-slate-50/40 p-3.5 dark:bg-zinc-950 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Commercial deliverables
            </div>
            <span className="text-[9px] font-mono text-slate-500 dark:text-zinc-400">
              {selectedScopes.length ? `${selectedScopes.length} selected` : "Choose at least one"}
            </span>
          </div>

          {selectedScopes.includes("design") ? (
            <div className="rounded-md border border-purple-200 bg-purple-50/70 px-2.5 py-1.5 text-[11px] text-purple-900 dark:border-purple-800/60 dark:bg-purple-950/30 dark:text-purple-200">
              Design is a standalone request. Remove it to choose Mockup, Sampling, or Costing.
            </div>
          ) : selectedScopes.includes("mockup") ? (
            <div className="rounded-md border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300">
              For Mockup requests, the Design decision is made after product selection.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DELIVERABLES.map((item) => {
              const isSelected = selectedScopes.includes(item.id);
              const disabled = isScopeDisabled(item.id);
              const designDeferred = selectedScopes.includes("mockup") && item.id === "design";
              const blockedByDesign = selectedScopes.includes("design") && item.id !== "design";
              const blockedByOtherScope = item.id === "design" && selectedScopes.length > 0 && !selectedScopes.includes("design");
              const meta = SCOPES_METADATA[item.id];
              const ScopeIcon = meta.icon;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onToggleScope(item.id)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-[84px] items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ${
                    disabled
                      ? "cursor-not-allowed border-slate-200/70 bg-slate-100/70 opacity-60 dark:border-white/[0.06] dark:bg-white/[0.02]"
                      : isSelected
                      ? "cursor-pointer border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] shadow-sm ring-1 ring-[var(--accent-primary)]/20"
                      : "cursor-pointer border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${meta.iconColor}`}>
                    <ScopeIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{item.label}</span>
                      <span className={`rounded border px-1 py-0.5 text-[8px] font-mono font-bold tracking-wide ${meta.badgeColor}`}>
                        {meta.badge}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-slate-500 dark:text-zinc-400">
                      {designDeferred
                        ? "Decide after product selection"
                        : blockedByDesign
                        ? "Unavailable while Design is selected"
                        : blockedByOtherScope
                        ? "Choose Design by itself"
                        : meta.description}
                    </span>
                  </span>
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                      : "border-slate-300 bg-white text-transparent dark:border-zinc-600 dark:bg-zinc-800"
                  }`}>
                    {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-2.5 dark:border-white/[0.06] dark:bg-zinc-900 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-8 cursor-pointer rounded-md bg-slate-100 px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-200/80 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/[0.1]"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={selectedScopes.length === 0}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-3.5 text-[11px] font-bold text-white shadow-xs transition-all disabled:cursor-not-allowed disabled:opacity-40 active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            <span>
              {selectedScopes.length === 1 && selectedScopes[0] === "design"
                ? "Configure Design Brief"
                : selectedScopes.includes("sample")
                ? "Configure Sampling"
                : selectedScopes.includes("mockup")
                ? "Configure Mockup Brief"
                : selectedScopes.includes("costing")
                ? "Select Catalog Product"
                : "Stage Product"}
            </span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductScopesStep;
