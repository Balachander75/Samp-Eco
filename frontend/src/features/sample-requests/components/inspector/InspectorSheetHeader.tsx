import React from "react";
import { SampleRequestItem } from "../../types";
import { formatOdooDate } from "../../utils/dateUtils";
import { StatusPill } from "@/components/ui/StatusPill";
import { getRequestTypes } from "../../sampling/utils/requestTypeUtils";
import { ParsedFeasibilityDetails } from "../../utils/feasibilityParsers";

export interface InspectorSheetHeaderProps {
  request: SampleRequestItem;
  activeRequest: SampleRequestItem;
  trackType: string | null;
  displayType: string;
  primaryTitle: string;
  feasibilityDetails: ParsedFeasibilityDetails;
  previewableImagesCount: number;
  isSubmitting: boolean;
  isConverting: boolean;
  onOpenReviewTab: () => void;
  onMarketingFinalApprove: (approved: boolean, remark?: string) => Promise<void>;
  onConvertToSampling: () => Promise<void>;
}

export const InspectorSheetHeader: React.FC<InspectorSheetHeaderProps> = ({
  request,
  activeRequest,
  trackType,
  displayType,
  primaryTitle,
}) => {
  const code = request.srNumber || activeRequest.srNumber || `SR-${request.id}`;
  const requestTypes = getRequestTypes(activeRequest);

  const isDesign = requestTypes.includes("design") || String(activeRequest.materialCode || "").startsWith("DSG-");
  const isMockup = requestTypes.includes("mockup");
  const isCosting = requestTypes.includes("costing");

  let card4Title = "Sample Qty & Packaging";
  let card4Value = activeRequest.qtyForSampling
    ? `${activeRequest.qtyForSampling} ${activeRequest.unitPcPack || "PC"}`
    : "1 PC";
  let card4Detail = activeRequest.unitPcPack === "Pack" && activeRequest.qtyPerPack
    ? `(${activeRequest.qtyPerPack} pcs/pack)`
    : "Finished Physical Unit";

  if (isDesign) {
    const reqDesigns = Number(activeRequest.designsCustomerCreative || activeRequest.productArtworkNos || activeRequest.numberOfDesigns) || 1;
    const recDesigns = (activeRequest.creativeSubmissions || []).length;
    card4Title = "Designs (Req / Received)";
    card4Value = `${reqDesigns} Req · ${recDesigns} Rec`;
    card4Detail = recDesigns >= reqDesigns ? "All Delivered" : `${Math.max(0, reqDesigns - recDesigns)} Pending Delivery`;
  } else if (isMockup) {
    const mockupCount = (activeRequest as any).qtyForMockup || (activeRequest as any).mockupQty || 1;
    card4Title = "Mockup Prototypes";
    card4Value = `${mockupCount} Prototype Dummy`;
    card4Detail = activeRequest.mockupWorkflowState?.stage ? `Stage: ${activeRequest.mockupWorkflowState.stage}` : "Structural CAD Dieline";
  } else if (isCosting) {
    card4Title = "Costing Run Volume";
    card4Value = activeRequest.qtyDesignCosting
      ? `${Number(activeRequest.qtyDesignCosting).toLocaleString()} ${activeRequest.unitPcPack || "PC"}`
      : "Pending Qty";
    card4Detail = activeRequest.unitPcPack === "Pack" && activeRequest.qtyPerPack
      ? `(${activeRequest.qtyPerPack} pcs/pack)`
      : "Factory BOM Run";
  }


  return (
    <div className="bg-[var(--surface-base)] border-b border-[var(--border-subtle)]">
      {/* ── Top Bar: Reference Code & Flow Progression ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-3 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
            {code}
          </span>
          <span className="text-slate-300 dark:text-zinc-700">/</span>
          <span className="text-xs font-display font-semibold text-slate-500 dark:text-zinc-400">
            {trackType === "program_planning"
              ? "Seasonal Program Specification Sheet"
              : trackType === "feasibility_check"
              ? "Feasibility Evaluation Sheet"
              : "Commercial Sample Specification Sheet"}
          </span>
        </div>

        {/* Right Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {requestTypes.map((type) => (
            <span
              key={type}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-display font-semibold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 capitalize"
            >
              {type}
            </span>
          ))}
          <StatusPill status={activeRequest.status || "Draft"} />
        </div>
      </div>

      {/* ── Document Hero Section ── */}
      <div className="px-8 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-[var(--on-surface)]">
              {activeRequest.customer || "General Commercial Account"}
            </h1>
            <p className="text-xs text-[var(--on-surface-subtle)] mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Initiated by</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                {activeRequest.createdBy || "Marketing Desk"}
              </span>
              <span>·</span>
              <span>
                on{" "}
                {formatOdooDate(
                  activeRequest.dateRequestCreated || activeRequest.createdAt
                )}
              </span>
            {activeRequest.brandName && !isMockup && (
                <>
                  <span>·</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    Brand: {activeRequest.brandName}
                  </span>
                </>
              )}
            </p>

            {/* Merchandising Category Breadcrumb Bar (Commercial Taxonomy - Distinct from Technical SAP Specs) */}
            {!isMockup && (activeRequest.productCategory || activeRequest.productSubCategory || activeRequest.productThirdCategory) && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400 dark:text-zinc-500 tracking-wider">
                  Category
                </span>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-50/90 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/70 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 shadow-xs">
                  <span className="font-bold font-display">{activeRequest.productCategory || "Uncategorized"}</span>
                  {activeRequest.productSubCategory && (
                    <>
                      <span className="text-emerald-400/80 dark:text-emerald-600 font-sans">›</span>
                      <span className="font-medium text-emerald-800 dark:text-emerald-200">{activeRequest.productSubCategory}</span>
                    </>
                  )}
                  {activeRequest.productThirdCategory && (
                    <>
                      <span className="text-emerald-400/80 dark:text-emerald-600 font-sans">›</span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-white/10 text-emerald-950 dark:text-emerald-100 font-semibold border border-emerald-200/50 dark:border-emerald-700/30">
                        {activeRequest.productThirdCategory}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 4-Card Executive Metrics Strip (Clean Tonal Depth, Zero Random Icons) ── */}
        <div className={`grid grid-cols-2 ${isMockup ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-3.5 mt-5`}>
          {/* Card 1: Product Title / Description */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-display uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              Product Scope
            </span>
            <div
              className="font-display font-bold text-xs text-[var(--on-surface)] truncate"
              title={primaryTitle}
            >
              {primaryTitle || displayType}
            </div>
          </div>

          {/* Card 2: Required Target SLA */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-display uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              {isMockup ? "Mockup Required Date" : "Target SLA Date"}
            </span>
            <div className="font-display font-bold text-xs text-[var(--on-surface)] font-mono">
              {isMockup
                ? activeRequest.mockupWorkflowState?.requiredDate
                  ? formatOdooDate(activeRequest.mockupWorkflowState.requiredDate)
                  : "Not set"
                : activeRequest.sampleRequiredDate
                  ? formatOdooDate(activeRequest.sampleRequiredDate)
                  : "Flexible Turnaround"}
            </div>
          </div>

          {/* Card 3: Manufacturing Facility */}
          {!isMockup && <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-display uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              Assigned Plant
            </span>
            <div className="font-display font-bold text-xs text-[var(--on-surface)] truncate">
              {activeRequest.targetPlant
                ? `Plant ${activeRequest.targetPlant}`
                : "Plant 1 (Central)"}
            </div>
          </div>}

          {/* Card 4: Sampling or Mockup Quantity */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[10px] font-display uppercase tracking-wider text-[var(--on-surface-subtle)] block font-semibold">
              {isMockup ? "Mockup Quantity" : "Required Units"}
            </span>
            <div className="font-display font-bold text-xs text-[var(--on-surface)] font-mono">
              {isMockup
                ? `${activeRequest.mockupWorkflowState?.qtyForMockup || (activeRequest as any).qtyForMockup || 1} Prototype${Number(activeRequest.mockupWorkflowState?.qtyForMockup || (activeRequest as any).qtyForMockup || 1) === 1 ? "" : "s"}`
                : activeRequest.qtyForSampling
                ? `${activeRequest.qtyForSampling} Finished Pieces`
                : activeRequest.qtyDesignCosting
                ? `${Number(activeRequest.qtyDesignCosting).toLocaleString()} Units`
                : "Prototype Sample"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InspectorSheetHeader;
