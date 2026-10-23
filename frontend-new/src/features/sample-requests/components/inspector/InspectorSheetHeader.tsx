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
  const requestTypes = getRequestTypes(activeRequest);
  const isDesign = requestTypes.includes("design");
  const isDesignOnly = isDesign && !requestTypes.includes("sample");
  const code = isDesignOnly
    ? request.requestCode || activeRequest.requestCode || request.materialCode || activeRequest.materialCode || `DR-${request.id}`
    : request.srNumber || activeRequest.srNumber || `SR-${request.id}`;
  const isMockup = requestTypes.includes("mockup");
  const isCosting = requestTypes.includes("costing");


  if (isDesign) {
  } else if (isMockup) {
  } else if (isCosting) {
  }


  return (
    <div className="bg-[var(--surface-base)] border-b border-[var(--border-subtle)]">
      {/* ── Top Bar: Reference Code & Flow Progression ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-3 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
            {code}
          </span>
          <span className="text-slate-300 ">/</span>
          <span className="text-xs font-display font-semibold text-slate-500 ">
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
              <span className="font-semibold text-slate-800 ">
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
                  <span className="font-mono text-slate-600 ">
                    Brand: {activeRequest.brandName}
                  </span>
                </>
              )}
            </p>

            {/* Seasonal Program Reference Badge */}
            {(activeRequest.programName || activeRequest.creationMode === "program_planning") && (
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-indigo-50/90  border border-indigo-200/70  text-indigo-950  shadow-2xs text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-indigo-600  tracking-wider">
                  Seasonal Reference
                </span>
                <span className="font-bold font-display">{activeRequest.programName || "Seasonal Program"}</span>
                {activeRequest.programYear && (
                  <span className="font-mono text-[11px] opacity-75">({activeRequest.programYear})</span>
                )}
                {activeRequest.sourceSampleCode && (
                  <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-indigo-100  text-indigo-800  font-bold">
                    Ref: {activeRequest.sourceSampleCode}
                  </span>
                )}
              </div>
            )}

            {/* Merchandising Category Breadcrumb Bar (Commercial Taxonomy - Distinct from Technical SAP Specs) */}
            {!isMockup && (activeRequest.productCategory || activeRequest.productSubCategory || activeRequest.productThirdCategory) && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-400  tracking-wider">
                  Category
                </span>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-50/90 to-teal-50/80   border border-emerald-200/70  text-emerald-900  shadow-xs">
                  <span className="font-bold font-display">{activeRequest.productCategory || "Uncategorized"}</span>
                  {activeRequest.productSubCategory && (
                    <>
                      <span className="text-emerald-400/80  font-sans">›</span>
                      <span className="font-medium text-emerald-800 ">{activeRequest.productSubCategory}</span>
                    </>
                  )}
                  {activeRequest.productThirdCategory && (
                    <>
                      <span className="text-emerald-400/80  font-sans">›</span>
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-white/70  text-emerald-950  font-semibold border border-emerald-200/50 ">
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
