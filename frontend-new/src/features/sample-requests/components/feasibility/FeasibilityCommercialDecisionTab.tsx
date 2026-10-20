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

      {/* Historical Counter-Date Resolution */}
      {activeRequest.sampCounterDate &&
        activeRequest.counterDateDecision &&
        activeRequest.counterDateDecision !== "pending" && (
          <div className="rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] px-4 py-3 text-xs text-[var(--on-surface-muted)]">
            SAMP proposed {activeRequest.sampCounterDate};{" "}
            {activeRequest.counterDateDecision === "auto_accepted"
              ? "the system accepted it automatically after 4 working days"
              : `Marketing ${activeRequest.counterDateDecision} it`}
            . Effective required date: <strong>{activeRequest.sampleRequiredDate}</strong>.
            Marketing took {activeRequest.counterDateWaitWorkdays ?? 0} working days to decide.
          </div>
        )}

      {/* ── Technical Verdict Pre-requisite Warning ── */}
      {!activeRequest.samplingFeasibilityResponse ? (
        <div className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface-subtle)] flex items-center justify-center mx-auto border border-[var(--border-subtle)] shadow-2xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--on-surface)]">
              Technical Review Must Be Completed First
            </h3>
            <p className="text-xs text-[var(--on-surface-muted)] max-w-md mx-auto mt-1 leading-relaxed">
              Commercial sign-off unlocks as soon as the Sampling Team records their technical verdict
              (Feasible / Conditional / Not Feasible).
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Commercial Decision Status & Form */}
          <div className="p-5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <span className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--on-surface-muted)]">
                Commercial Decision Status
              </span>
              {activeRequest.marketingDecision ? (
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-display font-bold border ${
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
                <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200">
                  Decision Needed
                </span>
              )}
            </div>

            {activeRequest.marketingDecision ? (
              <div className="space-y-3 text-xs">
                <div className="text-[var(--on-surface-muted)] font-mono">
                  Decided by:{" "}
                  <span className="font-bold text-[var(--on-surface)]">
                    {activeRequest.marketingDecisionBy || "Marketing Authority"}
                  </span>
                </div>
                {activeRequest.marketingDecisionRemark && (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] text-[var(--on-surface)] leading-relaxed">
                    {activeRequest.marketingDecisionRemark}
                  </div>
                )}
              </div>
            ) : canMakeCommercialDecision ? (
              <div className="space-y-4">
                <div className="text-xs text-[var(--on-surface-muted)] bg-[var(--surface-lowest)] p-3 rounded-xl border border-[var(--border-subtle)]">
                  SAMP Technical Verdict:{" "}
                  <span className="font-bold text-[var(--on-surface)] font-mono">
                    {activeRequest.samplingFeasibilityResponse}
                  </span>
                  {activeRequest.samplingFeasibilityRemark && (
                    <span className="ml-1.5 text-[var(--on-surface-subtle)]">
                      — {activeRequest.samplingFeasibilityRemark}
                    </span>
                  )}
                </div>

                {activeRequest.samplingFeasibilityResponse === "No" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Sampling Team evaluated this request as <strong>Not Feasible</strong>. Marketing may
                    record an exception for audit purposes, but this will not allow a Sample or Mockup
                    request to be created. Add the business justification below if accepting.
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider font-semibold text-[var(--on-surface-muted)] mb-1.5">
                    {activeRequest.samplingFeasibilityResponse === "No"
                      ? "Marketing Exception Justification (Required):"
                      : "Commercial Remarks & Client Context (Optional):"}
                  </label>
                  <input
                    type="text"
                    value={decisionRemark}
                    onChange={(e) => onDecisionRemarkChange(e.target.value)}
                    placeholder={
                      activeRequest.samplingFeasibilityResponse === "No"
                        ? "Explain why Marketing is accepting despite the Not Feasible assessment..."
                        : "e.g. Approved for customer line; sample required for buyer sign-off..."
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                </div>
                {decisionError && (
                  <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {decisionError}
                  </p>
                )}

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(true)}
                    disabled={isSubmittingDecision}
                    className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-2xs cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{activeRequest.samplingFeasibilityResponse === "No" ? "Record Marketing Exception" : "Accept Feasibility"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarketingFinalApprove(false)}
                    disabled={isSubmittingDecision}
                    className="bg-[var(--surface-lowest)] text-rose-600 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject / Drop</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--on-surface-subtle)] py-2">
                Awaiting commercial decision from Marketing authority.
              </div>
            )}
          </div>

          <section
            aria-labelledby="feasibility-next-process-title"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] p-5 space-y-3.5"
          >
            <div className="flex items-center gap-2 text-xs font-display font-bold text-[var(--accent-primary)]">
              <Package className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 id="feasibility-next-process-title">Next Process</h3>
            </div>

            {activeRequest.samplingFeasibilityResponse === "No" ? (
              <div role="alert" className="rounded-xl bg-rose-50 p-4 text-xs leading-relaxed text-rose-900 dark:bg-rose-950/20 dark:text-rose-200">
                <div className="font-display font-bold">Sample and Mockup requests are blocked</div>
                <p className="mt-1">
                  SAMP marked this feasibility check Not Feasible. A Marketing business exception records the decision only; it does not override the technical rejection.
                </p>
                {(activeRequest.convertedRequestCode || activeRequest.convertedSrNumber) && (
                  <p className="mt-2 font-semibold">
                    Existing linked request: {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}
                  </p>
                )}
              </div>
            ) : activeRequest.marketingDecision === "Rejected" ? (
              <p className="text-xs leading-relaxed text-[var(--on-surface-muted)]">
                Marketing rejected this feasibility check. No Sample or Mockup request can be created from it.
              </p>
            ) : (activeRequest.convertedRequestCode || activeRequest.convertedSrNumber) ? (
                <div className="p-4 bg-[var(--surface-lowest)] rounded-xl border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[var(--accent-primary)]">
                        Official Request Code: {activeRequest.convertedRequestCode || activeRequest.convertedSrNumber}
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface-muted)] transition cursor-pointer"
                        title="Copy Request Code"
                      >
                        {copiedSr ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSr ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--on-surface-muted)] mt-0.5">
                      Created for {(activeRequest.convertedRequestTypes || activeRequest.requestTypes || [])
                        .map((type) => type === "sample" ? "Sample" : type === "mockup" ? "Mockup" : "Costing")
                        .join(" and ") || "commercial processing"} by {activeRequest.convertedBy || "Marketing"}.
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--on-surface-subtle)]">
                      Product details were staged before linking. Review the draft and release it from Draft Workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/sample-requests/draft-workspace")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[var(--accent-primary-hover)]"
                  >
                    Open Draft Workspace <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
            ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--on-surface-muted)] max-w-lg">
                    {activeRequest.marketingDecision === "Accepted"
                      ? "Choose the request type (Sample, Mockup, or both together), then complete product details in Product Staging."
                      : "Choose a request type to prepare. Product Staging unlocks after Marketing accepts this feasibility result."}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
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
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                          selectedTypes.includes("sample")
                            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                        }`}
                      >
                        {selectedTypes.includes("sample") && <Check className="w-3 h-3 stroke-[3]" />}
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
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                          selectedTypes.includes("mockup")
                            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                        }`}
                      >
                        {selectedTypes.includes("mockup") && <Check className="w-3 h-3 stroke-[3]" />}
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
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                          selectedTypes.includes("costing")
                            ? "bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white"
                            : "border-[var(--border-subtle)] bg-[var(--surface-base)]"
                        }`}
                      >
                        {selectedTypes.includes("costing") && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>Costing Request</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--on-surface-subtle)]">
                    You can request Sample, Mockup, Costing, or any combination together.
                  </p>
                  {conversionError && (
                    <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {conversionError}
                    </p>
                  )}
                  {activeRequest.marketingDecision !== "Accepted" && (
                    <p className="rounded-xl bg-[var(--surface-lowest)] p-3 text-xs leading-relaxed text-[var(--on-surface-muted)]">
                      Awaiting Marketing acceptance. Sample and Mockup are visible here but cannot be created yet.
                    </p>
                  )}
                  {activeRequest.marketingDecision === "Accepted" && !canMakeCommercialDecision && (
                    <p className="text-xs text-[var(--on-surface-subtle)]">
                      A Marketing authority must create this request.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onConvertToSampling(selectedTypes)}
                    disabled={!canCreateNextRequest || selectedTypes.length === 0}
                    className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-[var(--accent-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Package className={`h-3.5 w-3.5 ${isConverting ? "animate-spin" : ""}`} />
                    <span>
                      {isConverting
                        ? "Opening Product Staging..."
                        : selectedTypes.length === 0
                        ? "Select at least one request type"
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
