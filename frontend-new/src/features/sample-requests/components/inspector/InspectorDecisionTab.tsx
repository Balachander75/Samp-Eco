import React from "react";
import { SampleRequestItem } from "../../types";
import { Clock, CheckCircle2 } from "lucide-react";

export interface InspectorDecisionTabProps {
  activeRequest: SampleRequestItem;
  decisionRemark: string;
  isSubmitting: boolean;
  isConverting: boolean;
  readOnly?: boolean;
  onDecisionRemarkChange: (val: string) => void;
  onMarketingFinalApprove: (approved: boolean, remark?: string) => Promise<void>;
  onConvertToSampling: () => Promise<void>;
}

export const InspectorDecisionTab: React.FC<InspectorDecisionTabProps> = ({
  activeRequest,
  decisionRemark,
  isSubmitting,
  isConverting,
  readOnly = false,
  onDecisionRemarkChange,
  onMarketingFinalApprove,
  onConvertToSampling,
}) => {
  return (
    <div className="py-4 space-y-5">
      {!activeRequest.samplingFeasibilityResponse ? (
        <div className="p-8 rounded-2xl border border-slate-100  bg-[var(--surface-low)] text-center text-slate-500">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="font-bold text-sm text-slate-800  font-display">
            Awaiting Technical Evaluation from Sampling Team
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto font-sans">
            Commercial sign-off unlocks as soon as the technical team records their feasibility verdict.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Commercial Decision Status & Form */}
          <div className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] shadow-[0_4px_20px_rgba(11,28,48,0.02)] space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 ">
              <span className="font-display font-bold text-xs uppercase text-slate-500">
                Commercial Decision Status
              </span>
              {activeRequest.marketingDecision ? (
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-display font-bold ${
                    activeRequest.marketingDecision === "Accepted"
                      ? "bg-emerald-50 text-[var(--accent-primary)]"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {activeRequest.marketingDecision === "Accepted"
                    ? "✓ Accepted by Marketing"
                    : "✕ Rejected / Dropped"}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl text-xs font-display bg-amber-50 text-amber-800 font-bold">
                  Action Required
                </span>
              )}
            </div>

            {activeRequest.marketingDecision ? (
              <div className="space-y-2 text-xs">
                <div className="text-slate-600 ">
                  Decided by:{" "}
                  <span className="font-semibold text-slate-800 ">
                    {activeRequest.marketingDecisionBy || "Marketing Authority"}
                  </span>
                </div>
                {activeRequest.marketingDecisionRemark && (
                  <div className="p-3 rounded-xl bg-slate-50/70  border border-slate-100  text-slate-800  italic font-sans">
                    "{activeRequest.marketingDecisionRemark}"
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-600 ">
                  Technical Verdict:{" "}
                  <span className="font-bold text-slate-900 ">
                    {activeRequest.samplingFeasibilityResponse}
                  </span>
                  {activeRequest.samplingFeasibilityRemark && (
                    <span className="italic ml-1">("{activeRequest.samplingFeasibilityRemark}")</span>
                  )}
                </div>

                {!readOnly && <div>
                  <label className="block text-[11px] font-display text-slate-500 mb-1">
                    Commercial Remarks / Client Justification (Optional):
                  </label>
                  <input
                    type="text"
                    value={decisionRemark}
                    onChange={(e) => onDecisionRemarkChange(e.target.value)}
                    placeholder="e.g. Approved for customer line; prototype required for buyer sign-off..."
                    className="w-full h-9 px-3.5 rounded-xl border border-slate-200/80  bg-slate-50/60 focus:bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                </div>}

                {!readOnly && <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(true)}
                    disabled={isSubmitting}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-display font-semibold px-4 py-2 rounded-xl shadow-[0_4px_14px_rgba(0,109,50,0.25)] cursor-pointer transition disabled:opacity-50"
                  >
                    Accept Feasibility
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(false)}
                    disabled={isSubmitting}
                    className="bg-white  text-rose-600 border border-rose-200 hover:bg-rose-50 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition disabled:opacity-50"
                  >
                    Reject / Drop
                  </button>
                </div>}
              </div>
            )}
          </div>

          {/* Commercial Sampling Request Conversion Card */}
          {activeRequest.marketingDecision === "Accepted" && (
            <div className="p-5 rounded-2xl border border-[var(--accent-primary)]/25 bg-[var(--accent-primary-subtle)]/60  space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-primary)] font-display">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Physical Prototype &amp; Sampling Creation</span>
              </div>

              {activeRequest.convertedSampleRequestId || activeRequest.convertedRequestCode || activeRequest.convertedSrNumber ? (
                <div className="p-3.5 bg-[var(--surface-lowest)] rounded-xl border border-[var(--accent-primary)]/25 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-bold font-mono text-sm text-[var(--accent-primary)]">
                      Request Code: {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber || "Created"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Converted by {activeRequest.convertedBy || "Marketing"} into active physical sampling pipeline.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold rounded-lg">
                    ✓ Active Sample Created
                  </span>
                </div>
              ) : !readOnly ? (
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <p className="text-xs text-slate-600  max-w-lg">
                    Feasibility has been confirmed and accepted. Would you like to spawn a full Commercial Sample Request for this product now?
                  </p>
                  <button
                    type="button"
                    onClick={onConvertToSampling}
                    disabled={isConverting}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-display font-semibold px-4 py-2 rounded-xl shadow-[0_4px_14px_rgba(0,109,50,0.25)] cursor-pointer transition disabled:opacity-50"
                  >
                    <span>{isConverting ? "Creating Sample..." : "Request Sampling (Convert)"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectorDecisionTab;
