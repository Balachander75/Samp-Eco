import React from "react";
import { CheckCircle2, Clock3, MessageSquare } from "lucide-react";

export interface SamplingResponsePanelProps {
  response?: string | null;
  decision?: string | null;
  reviewer?: string | null;
  respondedAt?: string | null;
  className?: string;
}

function responseStatus(decision: string, hasResponse: boolean) {
  const normalized = decision.trim().toLowerCase();
  if (normalized === "approve" || normalized === "approved" || normalized === "accepted") return "Approved";
  if (normalized === "return" || normalized === "returned") return "Returned for revision";
  if (normalized === "bypassed") return "Direct to Plant · review bypassed";
  if (normalized === "in_progress") return "Review in progress";
  return hasResponse ? "Response recorded" : "Awaiting response";
}

function formatResponseDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const SamplingResponsePanel: React.FC<SamplingResponsePanelProps> = ({
  response,
  decision,
  reviewer,
  respondedAt,
  className = "",
}) => {
  const cleanResponse = response?.trim() || "";
  const normalizedDecision = (decision || "").trim().toLowerCase();
  const hasDecision = ["approve", "approved", "accepted", "return", "returned", "bypassed"].includes(normalizedDecision);
  const status = responseStatus(decision || "", Boolean(cleanResponse));
  const hasResponse = Boolean(cleanResponse || reviewer || respondedAt || hasDecision);

  return (
    <section aria-label="Sampling response" className={`rounded-xl border border-sky-200 bg-sky-50/70 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
            {hasResponse ? <CheckCircle2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-sky-950">Sampling Response</h3>
            <p className="mt-1 text-[11px] font-semibold text-sky-800">{status}</p>
          </div>
        </div>
        {reviewer && <span className="text-[10px] font-medium text-sky-800">By {reviewer}</span>}
      </div>
      <p className={`mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed ${cleanResponse ? "text-sky-950" : "text-sky-700"}`}>
        {cleanResponse || (normalizedDecision === "bypassed"
          ? "This resample was routed directly to Plant."
          : hasDecision
            ? "Sampling recorded a decision without an additional remark."
            : "No Sampling response has been recorded yet.")}
      </p>
      {respondedAt && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-sky-700">
          <Clock3 className="h-3 w-3" />{formatResponseDate(respondedAt)}
        </p>
      )}
    </section>
  );
};

export default SamplingResponsePanel;
