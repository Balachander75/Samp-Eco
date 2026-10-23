import React from "react";
import {
  ArrowLeft,
  Plus,
  X,
  Building2,
  Calendar,
  Package,
  Palette,
  Box,
  Layers,
  Calculator,
  ChevronRight,
  Send,
  Loader2,
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
    feasibilityRequestId?: string | number;
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
  const isFeasibilityHandoff = Boolean(programContext.feasibilityRequestId);
  const hasFeasibilityProduct = isFeasibilityHandoff && stagedProducts.length > 0;
  const hasSavedFeasibilityProduct = isFeasibilityHandoff && stagedProducts.some((item) => item.savedRequestId);
  const isBusy = isSubmittingAll || isReleasing;
  const designCount = stagedProducts.filter((product) => product.scopes.includes("design")).length;
  const mockupCount = stagedProducts.filter((product) => product.scopes.includes("mockup")).length;
  const samplingCount = stagedProducts.filter((product) => product.scopes.includes("sample")).length;
  const costingCount = stagedProducts.filter((product) => product.scopes.includes("costing")).length;

  return (
    <div className="border-b border-border-subtle bg-surface-lowest shadow-2xs shrink-0">
      {/* ── 1. Top Bar: Breadcrumb, Document Title & Live Status ── */}
      <div className="px-5 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-low/70">
        {/* Left: Return Arrow + Breadcrumb & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateBack}
            disabled={isSubmittingAll || isReleasing}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-lowest text-onSurface-muted hover:bg-surface-low hover:text-onSurface transition-colors cursor-pointer shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            title={isFeasibilityHandoff
              ? "Return to Requests Desk; staged feasibility details stay in this session"
              : "Return to Requests Desk (Auto-saved)"}
            aria-label="Return to Requests Desk"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-onSurface-muted font-sans leading-none">
              <button
                type="button"
                onClick={onNavigateBack}
                disabled={isSubmittingAll || isReleasing}
                className="hover:text-onSurface transition-colors cursor-pointer"
              >
                Requests Desk
              </button>
              <ChevronRight className="w-3 h-3 text-onSurface-subtle shrink-0" />
              <span className="text-onSurface-muted">Commercial Sampling</span>
              <ChevronRight className="w-3 h-3 text-onSurface-subtle shrink-0" />
              <span className="font-semibold text-onSurface">Product Staging</span>
            </div>

            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <h1 className="truncate text-base font-bold text-onSurface tracking-tight font-display">
                {programContext.programName || "Commercial Sample Request"}
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-surface-container text-onSurface border border-border-subtle">
                {isFeasibilityHandoff ? "FEASIBILITY HANDOFF" : "BATCH STAGING"}
              </span>
              {programContext.parentSrNumber && (
                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                  {programContext.parentSrNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Workflow Guidance */}
        <div className="flex items-center gap-2 text-xs text-onSurface-subtle font-mono select-none">
          <span className={`w-2 h-2 rounded-full ${isFeasibilityHandoff ? "bg-amber-500" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"}`} />
          <span className="hidden sm:inline">
            {isFeasibilityHandoff ? "Release here to start selected workflows" : "Auto-saving drafts"}
          </span>
        </div>
      </div>

      {/* ── 2. Action Ribbon & Metadata Chips ── */}
      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bg-surface-lowest">
        {/* Left: Request context and staged counts */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          {programContext.customer && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-low border border-border-subtle text-xs">
              <Building2 className="w-3.5 h-3.5 text-onSurface-subtle shrink-0" />
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-onSurface-subtle">Account:</span>
              <span className="font-semibold text-onSurface truncate max-w-[200px]">
                {programContext.customer}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-low border border-border-subtle text-xs">
            <Calendar className="w-3.5 h-3.5 text-onSurface-subtle shrink-0" />
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-onSurface-subtle">Season:</span>
            <span className="font-mono font-bold text-onSurface">
              {programContext.programYear || "2026"} (BY {programContext.year || "2026-27"})
            </span>
          </div>

          {/* Staged Counters */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-border-subtle">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-surface-container text-onSurface border border-border-subtle"
              title="Total Staged Products"
            >
              <Package className="w-3.5 h-3.5 text-onSurface-muted" />
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
            disabled={isBusy || hasFeasibilityProduct}
            title={hasFeasibilityProduct
              ? "This feasibility request has one product; select its required processes as scopes on that product."
              : "Add a product to staging"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs transition-colors cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Product</span>
          </button>

          {/* Single Release Button */}
          {onReleaseRequest && (
            <button
              type="button"
              onClick={onReleaseRequest}
              disabled={isBusy || stagedProducts.length === 0}
              data-action="release"
              data-keep-color="true"
              className="release-cta-button inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold text-white transition-all cursor-pointer shadow-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title={isFeasibilityHandoff
                ? "Save and release this feasibility product to its selected workflows"
                : stagedProducts.length === 0
                ? "Add at least 1 product to release"
                : `Release ${stagedProducts.length} staged product(s) to operations`}
            >
              {isReleasing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5 stroke-[2.5]" />
              )}
              <span>
                {isReleasing
                  ? "Releasing…"
                  : isFeasibilityHandoff
                  ? "Release to Teams"
                  : stagedProducts.length > 0
                  ? `Release (${stagedProducts.length})`
                  : "Release (0 items)"}
              </span>
            </button>
          )}

          {/* Clear Staged Products */}
          {stagedProducts.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              disabled={isBusy || hasSavedFeasibilityProduct}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] text-[var(--on-surface-muted)] px-2.5 text-xs font-semibold transition-colors cursor-pointer ml-1 disabled:opacity-50"
              title={isFeasibilityHandoff
                ? hasSavedFeasibilityProduct
                  ? "This product is already prepared for release; update it and retry instead of clearing"
                  : "Remove the staged feasibility product"
                : "Clear staging; saved request drafts remain available in Drafts"}
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StagingWorkspaceHeader;
