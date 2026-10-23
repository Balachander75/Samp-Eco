import React from "react";
import { SampleRequestItem } from "../../types";
import { Clock } from "lucide-react";

export interface InspectorReviewTabProps {
  trackType: string | null;
  activeRequest: SampleRequestItem;
}

export const InspectorReviewTab: React.FC<InspectorReviewTabProps> = ({
  trackType,
  activeRequest,
}) => {
  return (
    <div className="py-4 space-y-5">
      {trackType === "program_planning" ? (
        /* Plant Planning SCU Effort */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="bg-[var(--accent-primary-subtle)]/60  border border-slate-100/80  p-4 rounded-2xl">
            <div className="font-display text-[10px] uppercase text-slate-400 font-bold">
              Base Notebook Effort
            </div>
            <div className="text-lg font-bold text-slate-900  font-display mt-1">
              1.00 SCU
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Standard scholastic binding baseline.
            </div>
          </div>
          <div className="bg-[var(--accent-primary-subtle)]/60  border border-slate-100/80  p-4 rounded-2xl">
            <div className="font-display text-[10px] uppercase text-slate-400 font-bold">
              Wiro + Tab Modifier
            </div>
            <div className="text-lg font-bold text-[var(--accent-primary)]  font-display mt-1">
              +0.50 SCU
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Twin loop wire insertion &amp; tabs.
            </div>
          </div>
          <div className="bg-[var(--accent-primary-subtle)]/60  border border-slate-100/80  p-4 rounded-2xl">
            <div className="font-display text-[10px] uppercase text-slate-400 font-bold">
              Total Capacity Required
            </div>
            <div className="text-lg font-bold text-slate-900  font-display mt-1">
              1.90 SCU
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Plant 01 Workcentre WC-30 (Finishing).
            </div>
          </div>
        </div>
      ) : trackType === "feasibility_check" ? (
        /* Feasibility Review: Dedicated SAMP Technical Evaluation */
        <div className="space-y-4">
          {activeRequest.samplingFeasibilityResponse ? (
            /* Evaluated View */
            <div className="p-5 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 ">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600  font-display">
                    Technical Verdict:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold font-display ${
                      activeRequest.samplingFeasibilityResponse === "Yes"
                        ? "bg-emerald-50 text-[var(--accent-primary)]  "
                        : activeRequest.samplingFeasibilityResponse === "No"
                        ? "bg-rose-50 text-rose-700  "
                        : "bg-amber-50 text-amber-700  "
                    }`}
                  >
                    {activeRequest.samplingFeasibilityResponse === "Yes" && "✓ Feasible (Approved)"}
                    {activeRequest.samplingFeasibilityResponse === "No" && "✕ Not Feasible (Rejected)"}
                    {activeRequest.samplingFeasibilityResponse === "Maybe" && "⚠ Conditional Feasibility"}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-500">
                  Evaluated by:{" "}
                  <span className="font-semibold text-slate-800 ">
                    {activeRequest.samplingFeasibilityApprovedBy || "SAMP Team"}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-display uppercase tracking-wider text-slate-400 block mb-1">
                  Technical Explanation &amp; Assessment:
                </span>
                <div className="p-3.5 rounded-xl bg-slate-50/70  text-xs text-slate-800  leading-relaxed font-sans whitespace-pre-wrap">
                  {activeRequest.samplingFeasibilityRemark || "Technical specifications verified feasible."}
                </div>
              </div>
            </div>
          ) : (
            /* Awaiting SAMP Team Evaluation */
            <div className="p-5 rounded-2xl bg-amber-50/50  border border-amber-200/60  space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-xs text-amber-900  font-display">
                  Awaiting Technical Review by Sampling Team
                </span>
              </div>
              <p className="text-xs text-amber-800/90  leading-relaxed font-sans">
                This feasibility check is pending laboratory evaluation. The SAMP team will determine
                manufacturing viability before commercial production release.
              </p>
              <div className="text-[11px] font-mono text-slate-500 pt-1">
                Status:{" "}
                {activeRequest.takenBySamp
                  ? `Claimed by ${activeRequest.takenBySamp} (In Review)`
                  : "Unclaimed in SAMP Queue"}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Commercial Sample Request: Cross-Departmental Execution Review */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Department 1: Creative Studio */}
            <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display text-slate-800 ">
                  Creative &amp; Artwork Brief
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                  {activeRequest.targetArtworkDateCreative ? "Scheduled" : "In Progress"}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeRequest.designsCustomerCreative || activeRequest.productArtworkNos
                  ? `${activeRequest.designsCustomerCreative || activeRequest.productArtworkNos} Artwork themes assigned to creative designers.`
                  : "Standard brand artwork specifications applied."}
              </p>
            </div>

            {/* Department 2: Structural CAD */}
            <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display text-slate-800 ">
                  CAD Dielines &amp; Structural Specs
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700">
                  {activeRequest.mockupRequired ? "Mockup Requested" : "Standard"}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {activeRequest.mockupRequired
                  ? `Mockup requirement: ${activeRequest.mockupRequired}.`
                  : "Standard packaging construction geometry verified."}
              </p>
            </div>

            {/* Department 3: Costing & BOM */}
            <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display text-slate-800 ">
                  Costing Estimations &amp; Margins
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                  Run: {Number(activeRequest.qtyDesignCosting || 10000).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                BOM costing matrix calculated based on required quantity volume.
              </p>
            </div>

            {/* Department 4: Plant Execution */}
            <div className="p-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-subtle)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-display text-slate-800 ">
                  Plant Fulfillment Facility
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                  Plant {activeRequest.targetPlant || "1"}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Targeted for production schedule and physical prototype dispatch.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectorReviewTab;
