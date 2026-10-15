import React from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Package,
  Palette,
  Box,
  Layers,
  Calculator,
  ChevronRight,
  Send,
} from "lucide-react";
import { StagedProductItem } from "../../types/staging";

export interface StagingWorkspaceHeaderProps {
  programContext: {
    customer: string;
    programName: string;
    programYear: string;
    year: string;
    parentRequestId?: string | number;
    parentSrNumber?: string;
    openedFromDraft?: boolean;
  };
  stagedProducts: StagedProductItem[];
  isSubmittingAll: boolean;
  isReleasing?: boolean;
  onNavigateBack: () => void;
  onOpenAddModal: () => void;
  onClearAll: () => void;
  onSaveAsDraft?: () => void;
  onSubmitAll?: () => void;
  onReleaseRequest?: () => void;
}

export const StagingWorkspaceHeader: React.FC<StagingWorkspaceHeaderProps> = ({
  programContext,
  stagedProducts,
  isSubmittingAll,
  isReleasing = false,
  onNavigateBack,
  onOpenAddModal,
  onClearAll,
  onReleaseRequest,
}) => {
  const designCount = stagedProducts.filter((product) => product.scopes.includes("design")).length;
  const mockupCount = stagedProducts.filter((product) => product.scopes.includes("mockup")).length;
  const samplingCount = stagedProducts.filter((product) => product.scopes.includes("sample")).length;
  const costingCount = stagedProducts.filter((product) => product.scopes.includes("costing")).length;

  return (
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12] shadow-2xs overflow-hidden">
      {/* ── 1. Top Bar: Breadcrumb, Document Title & Live Status ── */}
      <div className="px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/70 dark:bg-zinc-900/40">
        {/* Left: Return Arrow + Breadcrumb & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
            title="Return to Requests Desk (Auto-saved)"
            aria-label="Return to Requests Desk"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-sans leading-none">
              <button
                type="button"
                onClick={onNavigateBack}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              >
                Requests Desk
              </button>
              <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
              <span className="text-zinc-500 dark:text-zinc-400">Commercial Sampling</span>
              <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">Product Staging</span>
            </div>

            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <h1 className="truncate text-base font-bold text-zinc-900 dark:text-white tracking-tight font-display">
                {programContext.programName || "Commercial Sample Request"}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                BATCH STAGING
              </span>
              {programContext.parentSrNumber && (
                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  {programContext.parentSrNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Auto-Save Status */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500 font-mono select-none">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          <span className="hidden sm:inline">Auto-saving drafts</span>
        </div>
      </div>

      {/* ── 2. Action Ribbon & Metadata Chips ── */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#0c0d12]">
        {/* Left: Request context and staged counts */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          {programContext.customer && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 dark:text-zinc-500">Account:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">
                {programContext.customer}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-400 dark:text-zinc-500">Season:</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
              {programContext.programYear || "2026"} (BY {programContext.year || "2026-27"})
            </span>
          </div>

          {/* Staged Counters */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-zinc-200 dark:border-zinc-800">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60"
              title="Total Staged Products"
            >
              <Package className="w-3.5 h-3.5 text-zinc-500" />
              {stagedProducts.length} Staged
            </span>
            {designCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50" title="Design Deliverables">
                <Palette className="w-3 h-3" />{designCount} Design
              </span>
            )}
            {mockupCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50" title="Mockup Deliverables">
                <Box className="w-3 h-3" />{mockupCount} Mockup
              </span>
            )}
            {samplingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50" title="Sample Deliverables">
                <Layers className="w-3 h-3" />{samplingCount} Sample
              </span>
            )}
            {costingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50" title="Costing Deliverables">
                <Calculator className="w-3 h-3" />{costingCount} Costing
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {/* Primary CTA: Add Product */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Product</span>
          </button>

          {/* Single Release Button */}
          {onReleaseRequest && (
            <button
              type="button"
              onClick={onReleaseRequest}
              disabled={isReleasing || isSubmittingAll || (stagedProducts.length === 0 && !programContext.parentRequestId)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs active:scale-98"
              title="Release staged products to their workflows"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isReleasing ? "Releasing…" : "Release"}</span>
            </button>
          )}

          {/* Clear Staged Products */}
          {stagedProducts.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={isSubmittingAll}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 px-2.5 text-xs font-semibold transition-colors cursor-pointer ml-1 disabled:opacity-50"
              title="Clear all staged products"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StagingWorkspaceHeader;
