import React, { useMemo, useRef, useEffect } from "react";
import { SampleRequestItem, FeasibilityActivityItem } from "../../types";
import { formatOdooLogDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";

export interface FeasibilityChatterFeedProps {
  activeRequest: SampleRequestItem;
  classificationLabel: string;
  onAddNote?: (note: string) => Promise<void>;
  currentUser?: UserProfile | null;
}

interface ChatLogEvent {
  id: string | number;
  kind: "system_event" | "marketing_message" | "sampling_message";
  actorName: string;
  actorDepartment: string;
  title: string;
  summary: string;
  timestamp: string;
  badge?: {
    text: string;
    variant: "emerald" | "sky" | "rose" | "indigo" | "neutral";
  };
}

function getInitials(name?: any): string {
  if (!name) return "US";
  const clean = String(name).trim();
  if (!clean) return "US";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0][0] || "") + (parts[1][0] || "")).toUpperCase() || "US";
  }
  return clean.slice(0, 2).toUpperCase() || "US";
}

function formatTimeOnly(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

export const FeasibilityChatterFeed: React.FC<FeasibilityChatterFeedProps> = ({
  activeRequest,
  classificationLabel,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Compile chronological timeline events
  const chatEvents = useMemo<ChatLogEvent[]>(() => {
    const events: ChatLogEvent[] = [];
    const recordedActions = new Set<string>();

    const rawActivities: FeasibilityActivityItem[] = Array.isArray(activeRequest.activities)
      ? activeRequest.activities
      : [];

    // 1. Process persisted DB activities (excluding VIEWED)
    rawActivities
      .filter((act) => act.action !== "VIEWED")
      .forEach((act) => {
        recordedActions.add(act.action);
        const payload = act.payload || {};

        if (act.action === "CREATED") {
          const author = act.actorName || activeRequest.createdBy || "Marketing Desk";
          events.push({
            id: act.id,
            kind: "marketing_message",
            actorName: author,
            actorDepartment: act.actorDepartment || "Marketing",
            title: "Request raised",
            summary: `Raised · ${activeRequest.customer || "General Client"} · ${classificationLabel}`,
            timestamp: act.createdAt || activeRequest.createdAt || activeRequest.dateRequestCreated || "",
            badge: { text: "Intake", variant: "indigo" },
          });
        } else if (act.action === "TASK_CLAIMED") {
          const assignee = act.actorName || payload.claimed_by || activeRequest.takenBySamp || "SAMP Engineer";
          events.push({
            id: act.id,
            kind: "system_event",
            actorName: assignee,
            actorDepartment: "SAMP",
            title: "Claimed",
            summary: `Claimed by ${assignee}`,
            timestamp: act.createdAt || activeRequest.takenAtSamp || "",
            badge: { text: "Assigned", variant: "sky" },
          });
        } else if (act.action === "SAMP_EVALUATED") {
          const verdict = payload.verdict || activeRequest.samplingFeasibilityResponse || "Yes";
          const reviewer = act.actorName || activeRequest.samplingFeasibilityApprovedBy || "SAMP Team";
          events.push({
            id: act.id,
            kind: "sampling_message",
            actorName: reviewer,
            actorDepartment: "SAMP Team",
            title: "SAMP review",
            summary: verdict === "Maybe" ? "Conditional" : verdict === "Yes" ? "Feasible" : "Not feasible",
            timestamp: act.createdAt || activeRequest.feasibilityClosedAt || "",
            badge: {
              text: verdict === "Yes" ? "Feasible" : verdict === "No" ? "Not Feasible" : "Maybe",
              variant: verdict === "Yes" ? "emerald" : verdict === "No" ? "rose" : "sky",
            },
          });
        } else if (act.action === "SAMP_COUNTER_DATE_PROPOSED") {
          events.push({
            id: act.id,
            kind: "sampling_message",
            actorName: act.actorName || activeRequest.sampCounterDateProposedBy || "SAMP Team",
            actorDepartment: "SAMP Team",
            title: "Date proposed",
            summary: `Proposed ${payload.proposed_date || activeRequest.sampCounterDate || "a revised date"}${payload.reason ? ` · ${payload.reason}` : ""}`,
            timestamp: act.createdAt || activeRequest.sampCounterDateProposedAt || "",
            badge: { text: "Date proposed", variant: "sky" },
          });
        } else if (act.action === "COUNTER_DATE_ACCEPTED" || act.action === "COUNTER_DATE_REJECTED" || act.action === "COUNTER_DATE_AUTO_ACCEPTED") {
          const autoAccepted = act.action === "COUNTER_DATE_AUTO_ACCEPTED";
          const accepted = act.action !== "COUNTER_DATE_REJECTED";
          events.push({
            id: act.id,
            kind: autoAccepted ? "system_event" : "marketing_message",
            actorName: act.actorName || "Marketing",
            actorDepartment: autoAccepted ? "System" : "Marketing",
            title: autoAccepted ? "Date auto-accepted" : "Date decision",
            summary: `${autoAccepted ? "System auto-accepted" : accepted ? "Marketing accepted" : "Marketing kept original date"} · ${payload.effective_date || payload.proposed_date || activeRequest.sampleRequiredDate || ""}`,
            timestamp: act.createdAt || activeRequest.counterDateDecisionAt || "",
            badge: { text: autoAccepted ? "Auto-accepted" : accepted ? "Accepted" : "Rejected", variant: accepted ? "emerald" : "rose" },
          });
        } else if (act.action === "MARKETING_DECIDED") {
          const decision = payload.decision || activeRequest.marketingDecision || "Accepted";
          const decider = act.actorName || activeRequest.marketingDecisionBy || "Marketing Authority";
          events.push({
            id: act.id,
            kind: "marketing_message",
            actorName: decider,
            actorDepartment: "Marketing",
            title: "Marketing decision",
            summary: decision === "Accepted" ? "Request accepted" : "Request rejected",
            timestamp: act.createdAt || activeRequest.marketingDecisionAt || "",
            badge: {
              text: decision === "Accepted" ? "Approved" : "Dropped",
              variant: decision === "Accepted" ? "emerald" : "rose",
            },
          });
        } else if (act.action === "CONVERTED_TO_SAMPLING") {
          const srNum = payload.sample_sr_number || activeRequest.convertedSrNumber || "";
          const scopes = (Array.isArray(payload.request_types) ? payload.request_types : activeRequest.convertedRequestTypes || [])
            .map((scope: string) => scope === "costing" ? "Costing" : "Sampling");
          events.push({
            id: act.id,
            kind: "system_event",
            actorName: act.actorName || activeRequest.convertedBy || "Marketing Lead",
            actorDepartment: "Operations",
            title: "Commercial request created",
            summary: [srNum, scopes.join(" + ")].filter(Boolean).join(" · ") || "Converted from feasibility",
            timestamp: act.createdAt || activeRequest.convertedAt || "",
            badge: { text: srNum ? `SR: ${srNum}` : "Converted", variant: "emerald" },
          });
        } else if (act.action === "NOTE_ADDED") {
          const dept = (act.actorDepartment || "").toLowerCase();
          const isSamp = dept.includes("samp");
          events.push({
            id: act.id,
            kind: isSamp ? "sampling_message" : "marketing_message",
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || (isSamp ? "SAMP Team" : "Marketing"),
            title: "Note",
            summary: payload.note ? `Note · ${payload.note}` : "Note added",
            timestamp: act.createdAt || "",
            badge: { text: "Note", variant: "neutral" },
          });
        }
      });

    // 2. Synthesize canonical timeline events if not present in DB activities
    if (!recordedActions.has("CREATED")) {
      const author = activeRequest.createdBy || "Marketing Desk";
      events.push({
        id: "synth-create",
        kind: "marketing_message",
        actorName: author,
        actorDepartment: "Marketing",
        title: "Request raised",
        summary: `Raised · ${activeRequest.customer || "General Client"} · ${classificationLabel}`,
        timestamp: activeRequest.createdAt || activeRequest.dateRequestCreated || "",
        badge: { text: "Intake", variant: "indigo" },
      });
    }

    if (!recordedActions.has("TASK_CLAIMED") && activeRequest.takenBySamp) {
      events.push({
        id: "synth-claim",
        kind: "system_event",
        actorName: activeRequest.takenBySamp,
        actorDepartment: "SAMP Team",
        title: "Claimed",
        summary: `Claimed by ${activeRequest.takenBySamp}`,
        timestamp: activeRequest.takenAtSamp || activeRequest.createdAt || "",
        badge: { text: "Under Review", variant: "sky" },
      });
    }

    if (!recordedActions.has("SAMP_EVALUATED") && activeRequest.samplingFeasibilityResponse) {
      const verdict = activeRequest.samplingFeasibilityResponse;
      events.push({
        id: "synth-evaluated",
        kind: "sampling_message",
        actorName: activeRequest.samplingFeasibilityApprovedBy || "SAMP Team",
        actorDepartment: "SAMP Team",
        title: "SAMP review",
        summary: verdict === "Maybe" ? "Conditional" : verdict === "Yes" ? "Feasible" : "Not feasible",
        timestamp: activeRequest.feasibilityClosedAt || activeRequest.takenAtSamp || "",
        badge: {
          text: verdict === "Yes" ? "Feasible" : verdict === "No" ? "Not Feasible" : "Maybe",
          variant: verdict === "Yes" ? "emerald" : verdict === "No" ? "rose" : "sky",
        },
      });
    }

    if (!recordedActions.has("MARKETING_DECIDED") && activeRequest.marketingDecision) {
      const decision = activeRequest.marketingDecision;
      events.push({
        id: "synth-decision",
        kind: "marketing_message",
        actorName: activeRequest.marketingDecisionBy || "Marketing Authority",
        actorDepartment: "Marketing",
        title: "Marketing decision",
        summary: decision === "Accepted" ? "Request accepted" : "Request rejected",
        timestamp: activeRequest.marketingDecisionAt || "",
        badge: {
          text: decision === "Accepted" ? "Approved" : "Dropped",
          variant: decision === "Accepted" ? "emerald" : "rose",
        },
      });
    }

    if (!recordedActions.has("CONVERTED_TO_SAMPLING") && activeRequest.convertedSrNumber) {
      events.push({
        id: "synth-converted",
        kind: "system_event",
        actorName: activeRequest.convertedBy || "Marketing Lead",
        actorDepartment: "Operations",
        title: "Commercial request created",
        summary: [
          activeRequest.convertedSrNumber,
          (activeRequest.convertedRequestTypes || []).map((scope) => scope === "costing" ? "Costing" : "Sampling").join(" + "),
        ].filter(Boolean).join(" · "),
        timestamp: activeRequest.convertedAt || "",
        badge: { text: `SR: ${activeRequest.convertedSrNumber}`, variant: "emerald" },
      });
    }

    // Sort ascending (chronological: oldest at top, newest at bottom)
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeA - timeB;
    });
  }, [activeRequest, classificationLabel]);

  // Scroll to bottom on load or new events
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatEvents.length]);

  return (
    <div
      className="w-80 lg:w-[390px] flex flex-col h-full overflow-hidden select-text border-l shadow-[-12px_0_36px_rgba(11,28,48,0.03)] z-10 relative"
      style={{
        backgroundColor: "var(--surface-lowest)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* ── 1. Top Header ── */}
      <div
        className="px-4 py-3 flex items-center justify-between sticky top-0 z-20 border-b shadow-2xs"
        style={{
          backgroundColor: "var(--surface-base)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div>
          <h2
            className="font-display font-bold text-xs tracking-tight leading-none"
            style={{ color: "var(--on-surface)" }}
          >
            Activity &amp; Chatter
          </h2>
        </div>

        <span
          className="text-[10.5px] font-mono px-2.5 py-0.5 rounded-full font-bold border"
          style={{
            backgroundColor: "var(--accent-primary-subtle)",
            color: "var(--accent-primary)",
            borderColor: "color-mix(in srgb, var(--accent-primary) 30%, transparent)",
          }}
        >
          {chatEvents.length}
        </span>
      </div>

      {/* ── 2. Chronological Stream ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans">
        {chatEvents.length === 0 ? (
          <div
            className="py-12 text-center font-display text-xs"
            style={{ color: "var(--on-surface-subtle)" }}
          >
            No updates yet.
          </div>
        ) : (
          chatEvents.map((evt) => {
            // Case A: System Event Pill (Task Claimed, Converted to Sampling)
            if (evt.kind === "system_event") {
              const isClaim = evt.title.includes("Claim");
              return (
                <div key={evt.id} className="flex justify-center my-2.5 select-none">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shadow-2xs border ${isClaim
                        ? "bg-sky-50 text-sky-900 border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-800/40"
                        : "bg-emerald-50 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/40"
                      }`}
                  >
                    <span>{evt.summary}</span>
                    <span className="text-[9.5px] opacity-75 font-mono ml-0.5">
                      · {formatTimeOnly(evt.timestamp)}
                    </span>
                  </div>
                </div>
              );
            }

            // Case B: Marketing Desk Message Bubble
            if (evt.kind === "marketing_message") {
              return (
                <div key={evt.id} className="flex flex-col items-start select-text max-w-[94%]">
                  <div
                    className="w-full rounded-2xl rounded-tl-xs p-3.5 border shadow-2xs"
                    style={{
                      backgroundColor: "var(--surface-base)",
                      borderColor: "color-mix(in srgb, var(--accent-primary) 25%, var(--border-subtle))",
                    }}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between gap-2 pb-1.5 border-b"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs"
                          style={{ backgroundColor: "var(--accent-primary)" }}
                        >
                          {getInitials(evt.actorName)}
                        </div>
                        <div className="min-w-0 truncate">
                          <span
                            className="font-display font-bold text-xs truncate block"
                            style={{ color: "var(--on-surface)" }}
                          >
                            {evt.actorName}
                          </span>
                        </div>
                        <span
                          className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono border shrink-0"
                          style={{
                            backgroundColor: "var(--accent-primary-subtle)",
                            color: "var(--accent-primary)",
                            borderColor: "color-mix(in srgb, var(--accent-primary) 30%, transparent)",
                          }}
                        >
                          Marketing
                        </span>
                      </div>
                      <span
                        className="text-[9.5px] font-mono whitespace-nowrap"
                        style={{ color: "var(--on-surface-subtle)" }}
                      >
                        {formatOdooLogDate(evt.timestamp)}
                      </span>
                    </div>

                    {/* Status / Content */}
                    <p
                      className="mt-2 line-clamp-2 text-xs leading-relaxed font-sans"
                      style={{ color: "var(--on-surface)" }}
                    >
                      {evt.summary}
                    </p>
                  </div>
                </div>
              );
            }

            // Case C: Sampling Team (SAMP Team) Message Bubble
            return (
              <div key={evt.id} className="flex flex-col items-end select-text ml-auto max-w-[94%]">
                <div
                  className="w-full rounded-2xl rounded-tr-xs p-3.5 border shadow-2xs"
                  style={{
                    backgroundColor: "var(--surface-low)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {/* Header */}
                  <div
                    className="flex items-center justify-between gap-2 pb-1.5 border-b"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-full text-white font-bold text-[10px] font-mono flex items-center justify-center shrink-0 shadow-2xs"
                        style={{ backgroundColor: "var(--accent-primary)" }}
                      >
                        {getInitials(evt.actorName)}
                      </div>
                      <div className="min-w-0 truncate">
                        <span
                          className="font-display font-bold text-xs truncate block"
                          style={{ color: "var(--on-surface)" }}
                        >
                          {evt.actorName}
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800/40 shrink-0">
                        SAMP Team
                      </span>
                    </div>
                    <span
                      className="text-[9.5px] font-mono whitespace-nowrap"
                      style={{ color: "var(--on-surface-subtle)" }}
                    >
                      {formatOdooLogDate(evt.timestamp)}
                    </span>
                  </div>

                  {/* Verdict Line */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${evt.badge?.variant === "emerald"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          : evt.badge?.variant === "rose"
                            ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            : "bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800"
                        }`}
                    >
                      {evt.badge?.text || "Evaluated"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default FeasibilityChatterFeed;
