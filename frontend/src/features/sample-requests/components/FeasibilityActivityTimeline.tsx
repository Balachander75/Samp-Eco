import React from "react";
import { FeasibilityActivityItem, SampleRequestItem } from "../types";
import { Package, Check, AlertTriangle, XCircle, Clock, User, ClipboardCheck } from "lucide-react";

export interface FeasibilityActivityTimelineProps {
  request: SampleRequestItem;
  activities?: FeasibilityActivityItem[];
}

export const FeasibilityActivityTimeline: React.FC<FeasibilityActivityTimelineProps> = ({
  request,
}) => {
  const formatTime = (ts?: string | null) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return ts;
    }
  };

  const isClaimed = Boolean(request.takenBySamp);
  const isEvaluated = Boolean(request.samplingFeasibilityResponse);
  const isDecided = Boolean(request.marketingDecision);
  const isConverted = Boolean(request.convertedSampleRequestId || request.convertedSrNumber);

  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-between pb-2.5 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
          <h4
            className="text-xs font-bold uppercase tracking-wider font-mono"
            style={{ color: "var(--on-surface)" }}
          >
            Feasibility Workflow Audit Trail
          </h4>
        </div>
        <span
          className="text-[10px] font-mono font-semibold"
          style={{ color: "var(--on-surface-subtle)" }}
        >
          {request.materialCode || request.srNumber}
        </span>
      </div>

      <div className="relative pl-7 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-[var(--border-subtle)]">
        
        {/* STEP 1: REQUEST RAISED BY MARKETING */}
        <div className="relative">
          <div
            className="absolute -left-7 top-0.5 w-6 h-6 rounded-full text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
            style={{ backgroundColor: "var(--accent-primary)" }}
          >
            01
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs font-bold font-mono"
                style={{ color: "var(--on-surface)" }}
              >
                1. Feasibility Request Raised (Marketing)
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                {formatTime(request.createdAt || request.dateRequestCreated)}
              </span>
            </div>

            <p
              className="text-[11px] mt-0.5 leading-relaxed"
              style={{ color: "var(--on-surface-muted)" }}
            >
              Initiated by <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{request.createdBy || "Marketing Specialist"}</span> for customer <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{request.customer || "General"}</span>.
            </p>
          </div>
        </div>

        {/* STEP 2: SAMP TEAM TASK CLAIM */}
        <div className="relative">
          <div
            className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs ${
              isClaimed || isEvaluated
                ? "text-white"
                : "border"
            }`}
            style={{
              backgroundColor: isClaimed || isEvaluated ? "var(--accent-primary)" : "var(--surface-container)",
              borderColor: isClaimed || isEvaluated ? "transparent" : "var(--border-subtle)",
              color: isClaimed || isEvaluated ? "white" : "var(--on-surface-subtle)",
            }}
          >
            02
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: "var(--on-surface)" }}
                >
                  2. Task Claim & Review (SAMP Team)
                </span>
                {isClaimed || isEvaluated ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300/80">
                    Taken
                  </span>
                ) : (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface-subtle)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Queued
                  </span>
                )}
              </div>

              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                {request.takenAtSamp ? formatTime(request.takenAtSamp) : isEvaluated ? formatTime(request.feasibilityClosedAt) : "Pending"}
              </span>
            </div>

            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--on-surface-muted)" }}
            >
              {request.takenBySamp ? (
                <>Assigned to <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{request.takenBySamp}</span> (SAMP Technical Team).</>
              ) : isEvaluated ? (
                <>Evaluated by <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{request.samplingFeasibilityApprovedBy || "SAMP Team"}</span>.</>
              ) : (
                "Awaiting SAMP team specialist to take and review this request."
              )}
            </p>
          </div>
        </div>

        {/* STEP 3: SAMP TECHNICAL VERDICT */}
        <div className="relative">
          <div
            className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs ${
              isEvaluated
                ? request.samplingFeasibilityResponse === "Yes"
                  ? "bg-emerald-600 text-white"
                  : request.samplingFeasibilityResponse === "No"
                  ? "bg-rose-600 text-white"
                  : "bg-amber-600 text-white"
                : "border"
            }`}
            style={{
              backgroundColor: isEvaluated
                ? undefined
                : "var(--surface-container)",
              borderColor: isEvaluated ? "transparent" : "var(--border-subtle)",
              color: isEvaluated ? "white" : "var(--on-surface-subtle)",
            }}
          >
            03
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: "var(--on-surface)" }}
                >
                  3. SAMP Technical Feasibility Verdict
                </span>
                {isEvaluated ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      request.samplingFeasibilityResponse === "Yes"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/80"
                        : request.samplingFeasibilityResponse === "No"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300/80"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80"
                    }`}
                  >
                    {request.samplingFeasibilityResponse === "Yes" && "✓ Feasible (Yes)"}
                    {request.samplingFeasibilityResponse === "No" && "✕ Not Feasible (No)"}
                    {request.samplingFeasibilityResponse === "Maybe" && "⚠ Conditional (Maybe)"}
                  </span>
                ) : (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface-subtle)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Awaiting Verdict
                  </span>
                )}
              </div>

              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                {request.feasibilityClosedAt ? formatTime(request.feasibilityClosedAt) : "Pending"}
              </span>
            </div>

            {isEvaluated ? (
              <div className="mt-2 space-y-1.5">
                <div
                  className="p-2.5 rounded border text-xs leading-relaxed font-sans"
                  style={{
                    backgroundColor: "var(--surface-lowest)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--on-surface)",
                  }}
                >
                  <div
                    className="flex items-center justify-between text-[10px] font-mono mb-1"
                    style={{ color: "var(--on-surface-subtle)" }}
                  >
                    <span>Evaluator: {request.samplingFeasibilityApprovedBy || "SAMP Technical Team"}</span>
                    {request.isRespondedOnTime !== null && (
                      <span className={request.isRespondedOnTime ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400"}>
                        {request.isRespondedOnTime ? "✓ Responded On-Time" : "Delayed Response"}
                      </span>
                    )}
                  </div>
                  <div className="font-medium">
                    {request.samplingFeasibilityRemark || (
                      request.samplingFeasibilityResponse === "Yes"
                        ? "Technical specifications verified feasible."
                        : "Technical explanation provided by SAMP."
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p
                className="text-[11px] mt-1"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                Awaiting technical verdict from SAMP Team. Target date:{" "}
                <span
                  className="font-mono font-semibold"
                  style={{ color: "var(--on-surface)" }}
                >
                  {request.sampleRequiredDate || "Pending"}
                </span>.
              </p>
            )}
          </div>
        </div>

        {/* STEP 4: MARKETING COMMERCIAL DECISION */}
        <div className="relative">
          <div
            className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs ${
              isDecided
                ? request.marketingDecision === "Accepted"
                  ? "bg-emerald-600 text-white"
                  : "bg-rose-600 text-white"
                : "border"
            }`}
            style={{
              backgroundColor: isDecided
                ? undefined
                : "var(--surface-container)",
              borderColor: isDecided ? "transparent" : "var(--border-subtle)",
              color: isDecided ? "white" : "var(--on-surface-subtle)",
            }}
          >
            04
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: "var(--on-surface)" }}
                >
                  4. Commercial Sign-Off (Marketing)
                </span>
                {isDecided ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      request.marketingDecision === "Accepted"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                    }`}
                  >
                    {request.marketingDecision === "Accepted" ? "✓ Accepted by Marketing" : "✕ Rejected / Dropped"}
                  </span>
                ) : (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface-subtle)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Pending Decision
                  </span>
                )}
              </div>

              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                {request.marketingDecisionAt ? formatTime(request.marketingDecisionAt) : "Pending"}
              </span>
            </div>

            {isDecided ? (
              <div
                className="mt-2 p-2.5 rounded border text-xs"
                style={{
                  backgroundColor: "var(--surface-lowest)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--on-surface)",
                }}
              >
                <p
                  className="text-[10px] font-mono mb-0.5"
                  style={{ color: "var(--on-surface-subtle)" }}
                >
                  Decided by: <span className="font-semibold" style={{ color: "var(--on-surface)" }}>{request.marketingDecisionBy || "Marketing Authority"}</span>
                </p>
                {request.marketingDecisionRemark ? (
                  <p className="whitespace-pre-wrap">{request.marketingDecisionRemark}</p>
                ) : (
                  <p className="italic text-[11px]" style={{ color: "var(--on-surface-subtle)" }}>No commercial remarks entered.</p>
                )}
              </div>
            ) : isEvaluated ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold">
                SAMP evaluation completed. Marketing commercial sign-off is required to accept or drop.
              </p>
            ) : (
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                Unlocks once SAMP Team submits their technical verdict.
              </p>
            )}
          </div>
        </div>

        {/* STEP 5: CONVERTED TO SAMPLING REQUEST */}
        <div className="relative">
          <div
            className={`absolute -left-7 top-0.5 w-6 h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs ${
              isConverted
                ? "text-white"
                : "border"
            }`}
            style={{
              backgroundColor: isConverted
                ? "var(--accent-primary)"
                : "var(--surface-container)",
              borderColor: isConverted ? "transparent" : "var(--border-subtle)",
              color: isConverted ? "white" : "var(--on-surface-subtle)",
            }}
          >
            05
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: "var(--on-surface)" }}
                >
                  5. Commercial Sample Request
                </span>
                {isConverted ? (
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border"
                    style={{
                      backgroundColor: "var(--accent-primary-subtle)",
                      color: "var(--accent-primary)",
                      borderColor: "color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                    }}
                  >
                    ✓ Converted ({request.convertedSrNumber})
                  </span>
                ) : (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                    style={{
                      backgroundColor: "var(--surface-container)",
                      color: "var(--on-surface-subtle)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    Not Converted
                  </span>
                )}
              </div>

              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                {request.convertedAt ? formatTime(request.convertedAt) : "—"}
              </span>
            </div>

            {isConverted ? (
              <div
                className="mt-2 p-2.5 rounded border text-xs"
                style={{
                  backgroundColor: "var(--surface-lowest)",
                  borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-subtle))",
                  color: "var(--on-surface)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 shrink-0" style={{ color: "var(--accent-primary)" }} />
                  <div>
                    <span
                      className="font-bold font-mono"
                      style={{ color: "var(--accent-primary)" }}
                    >
                      {request.convertedSrNumber}
                    </span>
                    <span
                      className="text-[11px] ml-1.5"
                      style={{ color: "var(--on-surface-muted)" }}
                    >
                      created by {request.convertedBy || "Marketing"} for active physical sampling workflow.
                    </span>
                  </div>
                </div>
              </div>
            ) : request.marketingDecision === "Accepted" ? (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-medium">
                Feasibility is approved! Marketing can click "Request Sampling" to generate the prototype sampling request.
              </p>
            ) : (
              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--on-surface-subtle)" }}
              >
                Available once Marketing accepts the feasibility check.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default FeasibilityActivityTimeline;
