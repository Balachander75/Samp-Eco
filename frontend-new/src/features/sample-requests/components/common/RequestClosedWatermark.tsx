import React from "react";
import { CircleSlash, Lock, ShieldAlert, Clock, User } from "lucide-react";

export interface RequestClosureInfo {
  closed_by?: string | null;
  closed_by_team?: string | null;
  closed_at?: string | null;
  reason?: string | null;
  request_type?: string | null;
  request_code?: string | null;
}

interface RequestClosedWatermarkProps {
  closure?: RequestClosureInfo | null;
  scopeLabel?: string;
  className?: string;
}

function formatClosedDate(value?: string | null): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

/**
 * Visual background watermark stamp that overlays the modal content.
 * Styled like an official red 'CLOSED' document stamp with dashed border.
 */
export const RequestClosedStamp: React.FC<{ label?: string }> = ({ label = "REQUEST WAS CLOSED" }) => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden p-6"
    >
      <div className="flex -rotate-12 transform flex-col items-center justify-center rounded-3xl border-8 border-dashed border-rose-600/25  bg-rose-500/[0.03] px-10 py-6 sm:px-16 sm:py-8 shadow-2xl backdrop-blur-[1px]">
        <div className="flex items-center gap-3">
          <CircleSlash className="h-10 w-10 sm:h-14 sm:w-14 text-rose-600/35  stroke-[2.5]" />
          <span className="font-mono text-3xl sm:text-5xl lg:text-6xl font-black tracking-widest text-rose-600/35  uppercase">
            {label}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t-2 border-rose-600/25 pt-2 text-[11px] sm:text-xs font-mono font-bold tracking-widest text-rose-600/40  uppercase">
          <span>TERMINATED</span>
          <span>&bull;</span>
          <span>READ-ONLY ARCHIVE</span>
          <span>&bull;</span>
          <span>ALL ACTIONS BLOCKED</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Prominent top alert banner showing full closure audit details.
 */
export const RequestClosedBanner: React.FC<RequestClosedWatermarkProps> = ({
  closure,
  scopeLabel,
  className = "",
}) => {
  const closedBy = closure?.closed_by || "Marketing / User";
  const closedTeam = closure?.closed_by_team ? ` (${closure.closed_by_team})` : "";
  const closedAt = formatClosedDate(closure?.closed_at);
  const reason = closure?.reason?.trim();

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className={`relative z-30 overflow-hidden rounded-2xl border-2 border-rose-300  bg-rose-50/95  p-4 sm:p-5 text-rose-950  shadow-md ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-sm">
            <Lock className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                <CircleSlash className="h-3.5 w-3.5 stroke-[3]" />
                REQUEST WAS CLOSED
              </span>
              {scopeLabel && (
                <span className="rounded-md border border-rose-300  bg-white/80  px-2 py-0.5 font-mono text-[11px] font-bold text-rose-800 ">
                  {scopeLabel}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-semibold text-rose-900 ">
              This request was officially closed. All further inputs, task claims, and workflow changes are permanently locked across all teams.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-rose-200/80  text-xs">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-rose-700  shrink-0" />
          <span className="truncate">
            <strong className="text-rose-900 ">Closed By:</strong>{" "}
            {closedBy}{closedTeam}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-rose-700  shrink-0" />
          <span className="truncate">
            <strong className="text-rose-900 ">Closed On:</strong>{" "}
            {closedAt}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:col-span-1">
          <ShieldAlert className="h-4 w-4 text-rose-700  shrink-0" />
          <span className="font-semibold text-rose-700 ">Read-Only Enforced</span>
        </div>
      </div>

      {reason && (
        <div className="mt-2.5 rounded-xl border border-rose-200  bg-white/70  p-3 text-xs">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 ">
            Closure Reason:
          </span>
          <p className="mt-0.5 text-rose-950  whitespace-pre-wrap break-words font-medium">
            "{reason}"
          </p>
        </div>
      )}
    </aside>
  );
};

/**
 * Combined Watermark + Banner component
 */
export const RequestClosedWatermark: React.FC<RequestClosedWatermarkProps> = (props) => {
  return (
    <>
      <RequestClosedBanner {...props} />
      <RequestClosedStamp label="REQUEST WAS CLOSED" />
    </>
  );
};

export default RequestClosedWatermark;
