import React from "react";
import { useNavigate } from "react-router-dom";
import { SampleRequestItem } from "../../types";
import { Package, Check, X, AlertTriangle, Copy, ArrowRight } from "lucide-react";

export interface FeasibilityCommercialDecisionTabProps {
  activeRequest: SampleRequestItem;
  canMakeCommercialDecision: boolean;
  decisionRemark: string;
  decisionError: string | null;
  isSubmittingDecision: boolean;
  isConverting: boolean;
  conversionError?: string | null;
  onDecisionRemarkChange: (val: string) => void;
  onMarketingFinalApprove: (approved: boolean) => void;
  onCounterDateDecision: (accepted: boolean) => void;
  onConvertToSampling: (requestTypes: Array<"sample" | "mockup" | "costing">) => void;
}

export const FeasibilityCommercialDecisionTab: React.FC<FeasibilityCommercialDecisionTabProps> = ({
  activeRequest,
  canMakeCommercialDecision,
  decisionRemark,
  decisionError,
  isSubmittingDecision,
  isConverting,
  conversionError,
  onDecisionRemarkChange,
  onMarketingFinalApprove,
  onCounterDateDecision,
  onConvertToSampling,
}) => {
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = React.useState<Array<"sample" | "mockup" | "costing">>(["sample"]);
  const [copiedSr, setCopiedSr] = React.useState(false);
  const canCreateNextRequest =
    canMakeCommercialDecision && activeRequest.marketingDecision === "Accepted" && !isConverting;

  const toggleType = (type: "sample" | "mockup" | "costing") => {
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  return (
    <div className="py-4 space-y-5">
      {/* ── Pending Counter-Date Banner ── */}
      {activeRequest.counterDateDecision === "pending" && (
        <section
          role="status"
          className="space-y-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-5"
          aria-labelledby="marketing-counter-date-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                id="marketing-counter-date-title"
                className="text-sm font-display font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Marketing Action Needed: Sampling Team Proposed a Revised Date</span>
              </h3>
              <p className="mt-1 text-xs text-[var(--on-surface-muted)]">
                The technical review is paused while this date proposal is pending. Decide within 4
                working days; otherwise the system accepts it automatically.
              </p>
            </div>
            {activeRequest.counterDateDecisionDueAt && (
              <span className="rounded-full bg-[var(--surface-lowest)] border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-mono text-[var(--on-surface)]">
                Decision due{" "}
                {new Date(activeRequest.counterDateDecisionDueAt).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                })}
              </span>
            )}
          </div>

          <div className="grid gap-3 rounded-xl bg-[var(--surface-lowest)] p-4 text-xs border border-[var(--border-subtle)] sm:grid-cols-2">
            <div>
              <span className="text-[var(--on-surface-subtle)] font-mono text-[10px] uppercase">
                Original Requested Date
              </span>
              <p className="mt-1 font-semibold text-[var(--on-surface)] font-mono">
                {activeRequest.sampleRequiredDate || "—"}
              </p>
            </div>
            <div>
              <span className="text-[var(--on-surface-subtle)] font-mono text-[10px] uppercase">
                SAMP Proposed Date
              </span>
              <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300 font-mono">
                {activeRequest.sampCounterDate} · {activeRequest.sampCounterDateProposedBy || "SAMP"}
              </p>
            </div>
            <p className="leading-relaxed text-[var(--on-surface)] sm:col-span-2">
              <span className="font-semibold">Reason: </span>
              {activeRequest.sampCounterDateReason}
            </p>
          </div>

          {canMakeCommercialDecision && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => onCounterDateDecision(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Accept Proposed Date</span>
              </button>
              <button
                type="button"
                disabled={isSubmittingDecision}
                onClick={() => onCounterDateDecision(false)}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] px-4 py-2 text-xs font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-low)] disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                <X className="h-3.5 w-3.5" />
                <span>Keep Original Date</span>
              </button>
            </div>
          )}
          {decisionError && (
            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {decisionError}
            </p>
          )}
        </section>
      )}

      {/* ── Technical Verdict Pre-requisite Warning ── */}
      {!activeRequest.samplingFeasibilityResponse ? (
        <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-center space-y-2">
          <Package className="w-5 h-5 mx-auto text-[var(--on-surface-subtle)]" />
          <h3 className="font-display font-bold text-xs text-[var(--on-surface)]">
            Technical Review Pending
          </h3>
          <p className="text-xs text-[var(--on-surface-muted)]">
            Sampling Team has not yet recorded their evaluation verdict.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Prominent Sampling Technical Assessment Card */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] space-y-2 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                Sampling Technical Assessment
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-display font-bold border ${
                  activeRequest.samplingFeasibilityResponse === "Yes"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40"
                    : activeRequest.samplingFeasibilityResponse === "No"
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300/40"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300/40"
                }`}
              >
                {activeRequest.samplingFeasibilityResponse === "Yes"
                  ? "✓ FEASIBLE"
                  : activeRequest.samplingFeasibilityResponse === "No"
                  ? "✕ NOT FEASIBLE"
                  : "⚠ CONDITIONAL"}
              </span>
            </div>

            {activeRequest.samplingFeasibilityRemark && (
              <p className="text-xs text-[var(--on-surface)] leading-relaxed bg-[var(--surface-base)] p-3 rounded-lg border border-[var(--border-subtle)]">
                {activeRequest.samplingFeasibilityRemark}
              </p>
            )}

            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] flex items-center justify-between">
              <span>Reviewed by {activeRequest.samplingFeasibilityApprovedBy || activeRequest.takenBySamp || "Sampling Team"}</span>
              {(activeRequest.samplingFeasibilityApprovedAt || activeRequest.feasibilityClosedAt || activeRequest.updatedAt) && (
                <span>{new Date(activeRequest.samplingFeasibilityApprovedAt || activeRequest.feasibilityClosedAt || activeRequest.updatedAt!).toLocaleDateString("en-IN")}</span>
              )}
            </div>
          </div>

          {/* Commercial Decision Status & Action */}
          <div className="p-4 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--on-surface-muted)]">
                Commercial Decision
              </span>
              {activeRequest.marketingDecision ? (
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-display font-bold border ${
                    activeRequest.marketingDecision === "Accepted"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60"
                      : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/60"
                  }`}
                >
                  {activeRequest.marketingDecision === "Accepted"
                    ? "✓ Accepted by Marketing"
                    : "✕ Dropped / Cancelled"}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200">
                  Decision Needed
                </span>
              )}
            </div>

            {activeRequest.marketingDecision ? (
              <div className="space-y-2 text-xs">
                <div className="text-[var(--on-surface-muted)] font-mono text-[11px]">
                  Decided by: <strong className="text-[var(--on-surface)]">{activeRequest.marketingDecisionBy || "Marketing Authority"}</strong>
                </div>
                {activeRequest.marketingDecisionRemark && (
                  <div className="p-2.5 rounded-lg bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-[var(--on-surface)] text-xs">
                    {activeRequest.marketingDecisionRemark}
                  </div>
                )}
              </div>
            ) : canMakeCommercialDecision ? (
              <div className="space-y-3 pt-1">
                <div>
                  <input
                    type="text"
                    value={decisionRemark}
                    onChange={(e) => onDecisionRemarkChange(e.target.value)}
                    placeholder={
                      activeRequest.samplingFeasibilityResponse === "No"
                        ? "Marketing exception justification..."
                        : "Commercial remarks (optional)..."
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                </div>
                {decisionError && (
                  <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {decisionError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(true)}
                    disabled={isSubmittingDecision}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-2xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{activeRequest.samplingFeasibilityResponse === "No" ? "Record Exception" : "Accept Feasibility"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(false)}
                    disabled={isSubmittingDecision}
                    className="bg-[var(--surface-lowest)] text-rose-600 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--on-surface-subtle)] py-1">
                Awaiting commercial decision from Marketing authority.
              </div>
            )}
          </div>

          {/* Next Process Section */}
          <section
            aria-labelledby="feasibility-next-process-title"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-display font-bold text-[var(--accent-primary)]">
              <Package className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 id="feasibility-next-process-title">Next Process</h3>
            </div>

            {activeRequest.samplingFeasibilityResponse === "No" ? (
              <div role="alert" className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2 font-medium">
                <X className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Prototyping blocked — Technical review evaluated Not Feasible.</span>
              </div>
            ) : activeRequest.marketingDecision === "Rejected" ? (
              <p className="text-xs text-[var(--on-surface-muted)]">
                Feasibility was rejected. No sample requests can be created.
              </p>
            ) : (activeRequest.convertedRequestCode || activeRequest.convertedSrNumber) ? (
              <div className="p-3 bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-[var(--accent-primary)]">
                    Linked Request: {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const code = activeRequest.convertedRequestCode || activeRequest.convertedSrNumber;
                      if (code) {
                        navigator.clipboard.writeText(code);
                        setCopiedSr(true);
                        setTimeout(() => setCopiedSr(false), 2000);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface-muted)] transition cursor-pointer"
                    title="Copy Request Code"
                  >
                    {copiedSr ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSr ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/sample-requests/sampling")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                >
                  <span>View Requests</span> <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleType("sample")}
                    disabled={!canCreateNextRequest}
                    className={`inline-flex select-none items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      selectedTypes.includes("sample")
                        ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold shadow-2xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    } ${!canCreateNextRequest ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                        selectedTypes.includes("sample")
                          ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                          : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                      }`}
                    >
                      {selectedTypes.includes("sample") && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>Sample Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleType("mockup")}
                    disabled={!canCreateNextRequest}
                    className={`inline-flex select-none items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      selectedTypes.includes("mockup")
                        ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold shadow-2xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    } ${!canCreateNextRequest ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                        selectedTypes.includes("mockup")
                          ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                          : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                      }`}
                    >
                      {selectedTypes.includes("mockup") && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>Mockup Request</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleType("costing")}
                    disabled={!canCreateNextRequest}
                    className={`inline-flex select-none items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      selectedTypes.includes("costing")
                        ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] text-[var(--accent-primary)] font-bold shadow-2xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
                    } ${!canCreateNextRequest ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                        selectedTypes.includes("costing")
                          ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                          : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                      }`}
                    >
                      {selectedTypes.includes("costing") && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>Costing Request</span>
                  </button>
                </div>

                {conversionError && (
                  <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {conversionError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onConvertToSampling(selectedTypes)}
                  disabled={!canCreateNextRequest || selectedTypes.length === 0}
                  className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Package className={`h-3.5 w-3.5 ${isConverting ? "animate-spin" : ""}`} />
                  <span>
                    {isConverting
                      ? "Opening Product Staging..."
                      : `Continue to ${selectedTypes
                          .map((t) => (t === "sample" ? "Sample" : t === "mockup" ? "Mockup" : "Costing"))
                          .join(" & ")} staging`}
                  </span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default FeasibilityCommercialDecisionTab;
