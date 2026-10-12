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
  BookmarkCheck,
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
  onSaveAsDraft: () => void;
  onSubmitAll: () => void;
  onReleaseRequest?: () => void;
  onSendCostingRequest?: () => void;
  isSendingCostingRequest?: boolean;
}

export const StagingWorkspaceHeader: React.FC<StagingWorkspaceHeaderProps> = ({
  programContext,
  stagedProducts,
  isSubmittingAll,
  isReleasing = false,
  onNavigateBack,
  onOpenAddModal,
  onClearAll,
  onSaveAsDraft,
  onSubmitAll,
  onReleaseRequest,
  onSendCostingRequest,
  isSendingCostingRequest = false,
}) => {
  const designCount = stagedProducts.filter((product) => product.scopes.includes("design")).length;
  const mockupCount = stagedProducts.filter((product) => product.scopes.includes("mockup")).length;
  const samplingCount = stagedProducts.filter((product) => product.scopes.includes("sample")).length;
  const costingCount = stagedProducts.filter((product) => product.scopes.includes("costing")).length;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-white/[0.06] rounded-2xl shadow-[0_4px_20px_rgba(11,28,48,0.03)] overflow-hidden">
      {/* ── 1. Top Bar: Breadcrumb, Document Title & Pipeline Stepper ── */}
      <div className="px-5 py-3 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-low)] dark:bg-white/[0.02]">
        {/* Left: Return Arrow + Breadcrumb & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer"
            title="Return to Requests Desk"
            aria-label="Return to Requests Desk"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 font-sans leading-none">
              <button
                type="button"
                onClick={onNavigateBack}
                className="hover:text-[var(--accent-primary)] dark:hover:text-emerald-400 hover:underline cursor-pointer transition-colors"
              >
                Requests Desk
              </button>
              <ChevronRight className="w-2.5 h-2.5 text-slate-300 dark:text-zinc-600 shrink-0" />
              <span className="text-slate-500 dark:text-zinc-400">Commercial Sampling</span>
              <ChevronRight className="w-2.5 h-2.5 text-slate-300 dark:text-zinc-600 shrink-0" />
              <span className="font-semibold text-[var(--accent-primary)] dark:text-emerald-400">Product Staging</span>
            </div>

            <div className="flex items-center gap-2 mt-1.5">
              <h1 className="truncate text-base font-bold text-slate-900 dark:text-zinc-50 tracking-tight font-display">
                {programContext.programName || "Commercial Sample Request"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/20 uppercase tracking-wider">
                BATCH STAGING
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 2. Action Ribbon & Metadata Chips ── */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900">
        {/* Left: Request context and staged counts */}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-zinc-300">
          {programContext.customer && (
            <div className="flex items-center gap-1.5 font-medium bg-[var(--accent-primary-subtle)]/80 dark:bg-white/[0.04] px-3 py-1 rounded-xl border border-slate-200/50 dark:border-white/[0.05]">
              <span className="text-slate-400 dark:text-zinc-500 text-[10.5px] uppercase tracking-wider font-semibold">Account:</span>
              <span className="font-bold text-slate-900 dark:text-zinc-100 truncate max-w-[180px]">
                {programContext.customer}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 font-medium bg-[var(--accent-primary-subtle)]/80 dark:bg-white/[0.04] px-3 py-1 rounded-xl border border-slate-200/50 dark:border-white/[0.05]">
            <span className="text-slate-400 dark:text-zinc-500 text-[10.5px] uppercase tracking-wider font-semibold">Season:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
              {programContext.programYear || "2026"} (BY {programContext.year || "2026-27"})
            </span>
          </div>

          {/* Staged Counters */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200/70 dark:border-zinc-800">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] dark:text-emerald-400 border border-[var(--accent-primary)]/20"
              title="Total Staged Products"
            >
              <Package className="w-3 h-3" />
              {stagedProducts.length} Staged
            </span>
            {designCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50" title="Design Deliverables">
                <Palette className="w-3 h-3" />{designCount} Design
              </span>
            )}
            {mockupCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50" title="Mockup Deliverables">
                <Box className="w-3 h-3" />{mockupCount} Mockup
              </span>
            )}
            {samplingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50" title="Sample Deliverables">
                <Layers className="w-3 h-3" />{samplingCount} Sample
              </span>
            )}
            {costingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-mono font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50" title="Costing Deliverables">
                <Calculator className="w-3 h-3" />{costingCount} Costing
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenAddModal}
            disabled={isSendingCostingRequest}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-[0_2px_10px_rgba(0,109,50,0.25)] hover:shadow-[0_4px_14px_rgba(0,109,50,0.35)] transition-all cursor-pointer active:scale-98 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Product</span>
          </button>

          {(stagedProducts.length > 0 || programContext.parentRequestId) && (
            <button
              type="button"
              onClick={onSaveAsDraft}
              disabled={isSubmittingAll || isSendingCostingRequest}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.06] dark:hover:bg-white/10 px-3.5 text-xs font-semibold text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50 border border-slate-200/80 dark:border-white/10"
              title="Save staged products to Draft queue"
            >
              <BookmarkCheck className="h-3.5 w-3.5 text-[var(--accent-primary)] dark:text-emerald-400" />
              <span>{isSubmittingAll ? "Saving…" : "Save Staged Products"}</span>
            </button>
          )}

          {costingCount > 0 && onSendCostingRequest && (
            <button
              type="button"
              onClick={onSendCostingRequest}
              disabled={isSendingCostingRequest || isSubmittingAll || costingCount !== stagedProducts.length}
              title={costingCount !== stagedProducts.length ? "Add Costing to every staged product before sending this batch" : "Send completed costing requests to the Costing queue"}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSendingCostingRequest ? "Sending…" : "Send Costing Request"}</span>
            </button>
          )}

          {stagedProducts.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={isSendingCostingRequest || isSubmittingAll}
              className="inline-flex h-8 items-center gap-1 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 text-xs font-semibold transition-colors cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950/40 ml-1"
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
