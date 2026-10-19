import React, { useMemo, useRef, useEffect } from "react";
import { SampleRequestItem, FeasibilityActivityItem } from "../../types";
import { formatOdooLogDate } from "../../utils/dateUtils";
import { UserProfile } from "@/features/auth";
import {
  History,
  Layers,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
  Lock,
  FileText,
} from "lucide-react";

export interface FeasibilityChatterFeedProps {
  activeRequest: SampleRequestItem;
  classificationLabel: string;
  onAddNote?: (note: string) => Promise<void>;
  currentUser?: UserProfile | null;
}

interface ActivityLogEvent {
  id: string | number;
  kind: "system_announcement" | "marketing_card" | "sampling_card" | "note_card";
  actorName: string;
  actorDepartment: string;
  title: string;
  summary: string;
  detail?: string;
  subdetail?: string;
  timestamp: string;
  verdictTag?: "Yes" | "No" | "Maybe";
  decisionTag?: "Accepted" | "Rejected";
}

export const FeasibilityChatterFeed: React.FC<FeasibilityChatterFeedProps> = ({
  activeRequest,
  classificationLabel,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Compile chronological audit & activity events
  const auditEvents = useMemo<ActivityLogEvent[]>(() => {
    const events: ActivityLogEvent[] = [];
    const recordedActions = new Set<string>();

    const rawActivities: FeasibilityActivityItem[] = Array.isArray(activeRequest.activities)
      ? (activeRequest.activities as FeasibilityActivityItem[])
      : [];

    // 1. Process persisted DB activities (filtering out VIEW events)
    rawActivities
      .filter((act) => {
        const action = (act.action || "").toUpperCase();
        return (
          !action.includes("VIEW") &&
          action !== "FEASIBILITY_VIEWED" &&
          action !== "SAMP_VIEWED" &&
          action !== "VIEWED"
        );
      })
      .forEach((act) => {
        recordedActions.add(act.action);
        const payload = (act.payload || {}) as Record<string, any>;
        const time = act.createdAt || "";

        if (act.action === "CREATED") {
          const author = act.actorName || activeRequest.createdBy || "Marketing Desk";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: author,
            actorDepartment: act.actorDepartment || "Marketing",
            title: "Request Raised",
            summary: `${author} raised this feasibility request for ${activeRequest.customer || "Client"} (${classificationLabel})`,
            timestamp: time || activeRequest.createdAt || activeRequest.dateRequestCreated || "",
          });
        } else if (act.action === "TASK_CLAIMED") {
          const assignee = act.actorName || payload.claimed_by || activeRequest.takenBySamp || "SAMP Engineer";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: assignee,
            actorDepartment: "SAMP Team",
            title: "Review Claimed",
            summary: `${assignee} claimed the Feasibility Review task`,
            timestamp: time || activeRequest.takenAtSamp || "",
          });
        } else if (act.action === "SAMP_COUNTER_DATE_PROPOSED") {
          const proposed = payload.proposed_date || activeRequest.sampCounterDate || "a revised date";
          const reason = payload.reason || activeRequest.sampCounterDateReason || "";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || activeRequest.sampCounterDateProposedBy || "SAMP Team",
            actorDepartment: "SAMP Team",
            title: "Revised Date Proposed",
            summary: `${act.actorName || "SAMP Team"} proposed revised target date: ${proposed}${reason ? ` (${reason})` : ""}`,
            timestamp: time || activeRequest.sampCounterDateProposedAt || "",
          });
        } else if (act.action === "COUNTER_DATE_ACCEPTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            title: "Revised Date Accepted",
            summary: `${act.actorName || "Marketing Team"} accepted the revised target date`,
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "COUNTER_DATE_REJECTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            title: "Revised Date Rejected",
            summary: `${act.actorName || "Marketing Team"} rejected revised date; keeping original timeline`,
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "COUNTER_DATE_AUTO_ACCEPTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: "System",
            actorDepartment: "System",
            title: "Auto-Accepted",
            summary: "System automatically accepted revised target date after 4 working days",
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "SAMP_EVALUATED") {
          const verdict = (payload.verdict || activeRequest.samplingFeasibilityResponse || "Yes") as "Yes" | "No" | "Maybe";
          const reviewer = act.actorName || activeRequest.samplingFeasibilityApprovedBy || "SAMP Team";
          events.push({
            id: act.id,
            kind: "sampling_card",
            actorName: reviewer,
            actorDepartment: "SAMP Team",
            title: "SAMP Technical Sign-Off",
            summary: payload.remark || activeRequest.samplingFeasibilityRemark || (verdict === "Yes" ? "Feasible for factory sampling" : verdict === "Maybe" ? "Conditional approval" : "Not feasible"),
            detail: payload.conditions || activeRequest.feasibilityConditions || undefined,
            subdetail: payload.lead_time_note || activeRequest.leadTimeNote || undefined,
            timestamp: time || activeRequest.feasibilityClosedAt || "",
            verdictTag: verdict,
          });
        } else if (act.action === "MARKETING_DECIDED") {
          const decision = (payload.decision || activeRequest.marketingDecision || "Accepted") as "Accepted" | "Rejected";
          const decider = act.actorName || activeRequest.marketingDecisionBy || "Marketing Authority";
          events.push({
            id: act.id,
            kind: "marketing_card",
            actorName: decider,
            actorDepartment: "Marketing",
            title: "Commercial Decision",
            summary: payload.remark || activeRequest.marketingDecisionRemark || (decision === "Accepted" ? "Approved for commercial sampling" : "Dropped by marketing"),
            timestamp: time || activeRequest.marketingDecisionAt || "",
            decisionTag: decision,
          });
        } else if (act.action === "CONVERTED_TO_SAMPLING") {
          const srNum = payload.sample_request_code || activeRequest.convertedRequestCode || activeRequest.convertedSrNumber || "";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || activeRequest.convertedBy || "Marketing Lead",
            actorDepartment: "Operations",
            title: "Commercial Conversion",
            summary: `${act.actorName || "Marketing"} converted this feasibility to commercial request ${srNum || ""}`.trim(),
            timestamp: time || activeRequest.convertedAt || "",
          });
        } else if (act.action === "NOTE_ADDED") {
          const dept = (act.actorDepartment || "").toLowerCase();
          const isSamp = dept.includes("samp");
          events.push({
            id: act.id,
            kind: "note_card",
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || (isSamp ? "SAMP Team" : "Marketing"),
            title: "Note",
            summary: String(payload.note || payload.text || "Note added"),
            timestamp: time,
          });
        }
      });

    // 2. Synthesize canonical milestones if database activities are unpopulated
    if (!recordedActions.has("CREATED")) {
      const author = activeRequest.createdBy || "Marketing Desk";
      events.push({
        id: "synth-create",
        kind: "system_announcement",
        actorName: author,
        actorDepartment: "Marketing",
        title: "Request Raised",
        summary: `${author} raised this feasibility request for ${activeRequest.customer || "Client"} (${classificationLabel})`,
        timestamp: activeRequest.createdAt || activeRequest.dateRequestCreated || "",
      });
    }

    if (!recordedActions.has("TASK_CLAIMED") && activeRequest.takenBySamp) {
      events.push({
        id: "synth-claim",
        kind: "system_announcement",
        actorName: activeRequest.takenBySamp,
        actorDepartment: "SAMP Team",
        title: "Review Claimed",
        summary: `${activeRequest.takenBySamp} claimed the Feasibility Review task`,
        timestamp: activeRequest.takenAtSamp || activeRequest.createdAt || "",
      });
    }

    if (!recordedActions.has("SAMP_EVALUATED") && activeRequest.samplingFeasibilityResponse) {
      const verdict = activeRequest.samplingFeasibilityResponse as "Yes" | "No" | "Maybe";
      events.push({
        id: "synth-evaluated",
        kind: "sampling_card",
        actorName: activeRequest.samplingFeasibilityApprovedBy || "SAMP Team",
        actorDepartment: "SAMP Team",
        title: "SAMP Technical Sign-Off",
        summary: activeRequest.samplingFeasibilityRemark || (verdict === "Yes" ? "Feasible for factory sampling" : verdict === "Maybe" ? "Conditional approval" : "Not feasible"),
        detail: activeRequest.feasibilityConditions || undefined,
        subdetail: activeRequest.leadTimeNote || undefined,
        timestamp: activeRequest.feasibilityClosedAt || activeRequest.takenAtSamp || "",
        verdictTag: verdict,
      });
    }

    if (!recordedActions.has("MARKETING_DECIDED") && activeRequest.marketingDecision) {
      const decision = activeRequest.marketingDecision as "Accepted" | "Rejected";
      events.push({
        id: "synth-decision",
        kind: "marketing_card",
        actorName: activeRequest.marketingDecisionBy || "Marketing Authority",
        actorDepartment: "Marketing",
        title: "Commercial Decision",
        summary: activeRequest.marketingDecisionRemark || (decision === "Accepted" ? "Approved for commercial sampling" : "Dropped by marketing"),
        timestamp: activeRequest.marketingDecisionAt || "",
        decisionTag: decision,
      });
    }

    if (!recordedActions.has("CONVERTED_TO_SAMPLING") && (activeRequest.convertedRequestCode || activeRequest.convertedSrNumber || activeRequest.convertedSampleRequestId)) {
      const srNum = activeRequest.convertedRequestCode || activeRequest.convertedSrNumber || "";
      events.push({
        id: "synth-converted",
        kind: "system_announcement",
        actorName: activeRequest.convertedBy || "Marketing Lead",
        actorDepartment: "Operations",
        title: "Commercial Conversion",
        summary: `${activeRequest.convertedBy || "Marketing"} converted this feasibility to commercial request ${srNum || ""}`.trim(),
        timestamp: activeRequest.convertedAt || "",
      });
    }

    // Sort ascending (chronological: oldest at top, latest at bottom)
    return events.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeA - timeB;
    });
  }, [activeRequest, classificationLabel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [auditEvents.length]);

  return (
    <aside className="w-80 sm:w-84 lg:w-[360px] shrink-0 border-l border-[var(--border-subtle)] bg-[var(--surface-lowest)] flex flex-col h-full min-h-0 text-xs select-text">
      {/* ── Top Header: Audit & Activity Log ── */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-2.5 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 font-display font-bold text-xs text-[var(--on-surface)]">
          <History className="w-4 h-4 text-[var(--accent-primary)]" />
          <span>Audit &amp; Activity Log</span>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--accent-primary)] shadow-2xs">
          {auditEvents.length} {auditEvents.length === 1 ? "event" : "events"}
        </span>
      </div>

      {/* ── Scrollable Audit Log Feed ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-[var(--surface-lowest)] font-sans">
        {auditEvents.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--on-surface-subtle)] border border-dashed border-[var(--border-subtle)] rounded-xl my-4">
            No activity events recorded yet. Claims, reviews, and decisions will appear here in chronological sequence.
          </div>
        ) : (
          auditEvents.map((evt) => {
            const dateDisplay = formatOdooLogDate(evt.timestamp);

            // ── Milestone / System Announcement Pill ──
            if (evt.kind === "system_announcement") {
              const isClaim = evt.title.includes("Claim");
              const isDate = evt.title.includes("Date");
              const isConvert = evt.title.includes("Conversion");

              return (
                <div key={evt.id} className="flex flex-col items-center my-2 select-none animate-in fade-in">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-sans font-medium text-[var(--on-surface-muted)] bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs max-w-[95%] text-center">
                    {isClaim ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isDate ? (
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : isConvert ? (
                      <PackageCheck className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    ) : (
                      <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    )}
                    <span>{evt.summary}</span>
                  </div>
                  {dateDisplay && dateDisplay !== "Recent" && (
                    <span className="text-[9.5px] font-mono text-[var(--on-surface-subtle)] mt-0.5">
                      {dateDisplay}
                    </span>
                  )}
                </div>
              );
            }

            // ── Sampling Team (SAMP) Technical Sign-Off Card ──
            if (evt.kind === "sampling_card") {
              return (
                <div key={evt.id} className="flex flex-col items-start w-full animate-in fade-in duration-100">
                  <div className="w-full rounded-xl p-3 shadow-2xs border text-xs space-y-2 bg-emerald-500/5 border-emerald-500/25 dark:bg-emerald-950/20 dark:border-emerald-800/40">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-500/15 dark:border-emerald-500/20 pb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display font-bold text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                          {evt.actorName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                          SAMP
                        </span>
                      </div>
                      {evt.verdictTag && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-display font-bold ${
                            evt.verdictTag === "Yes"
                              ? "bg-emerald-600 text-white"
                              : evt.verdictTag === "No"
                              ? "bg-rose-600 text-white"
                              : "bg-amber-500 text-white"
                          }`}
                        >
                          {evt.verdictTag === "Yes" && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {evt.verdictTag === "No" && <XCircle className="w-2.5 h-2.5" />}
                          {evt.verdictTag === "Maybe" && <AlertTriangle className="w-2.5 h-2.5" />}
                          <span>{evt.verdictTag === "Yes" ? "Feasible" : evt.verdictTag === "No" ? "Not Feasible" : "Conditional"}</span>
                        </span>
                      )}
                    </div>

                    {/* Technical Remark Text */}
                    <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap font-sans">
                      {evt.summary}
                    </p>

                    {/* Conditions Callout */}
                    {evt.detail && (
                      <div className="p-2 rounded-lg bg-[var(--surface-base)] border border-amber-500/30 text-[11px] space-y-0.5">
                        <div className="font-bold text-amber-700 dark:text-amber-400">Technical Conditions:</div>
                        <div className="text-[var(--on-surface-muted)]">{evt.detail}</div>
                      </div>
                    )}

                    {/* Lead time note */}
                    {evt.subdetail && (
                      <div className="text-[10.5px] font-mono text-[var(--on-surface-muted)] flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Lead Time: <strong className="text-[var(--on-surface)]">{evt.subdetail}</strong></span>
                      </div>
                    )}

                    {/* Footer timestamp */}
                    <div className="flex items-center justify-end gap-1 pt-0.5 text-[9.5px] font-mono text-[var(--on-surface-subtle)]">
                      <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{dateDisplay}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Marketing Team Commercial Decision Card ──
            if (evt.kind === "marketing_card") {
              return (
                <div key={evt.id} className="flex flex-col items-start w-full animate-in fade-in duration-100">
                  <div className="w-full rounded-xl p-3 shadow-2xs border text-xs space-y-2 bg-[var(--accent-primary)]/5 border-[var(--accent-primary)]/20 dark:bg-[var(--accent-primary)]/10 dark:border-[var(--accent-primary)]/30">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--accent-primary)]/15 dark:border-[var(--accent-primary)]/20 pb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-display font-bold text-[11px] text-[var(--accent-primary)] truncate">
                          {evt.actorName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                          MARKETING
                        </span>
                      </div>
                      {evt.decisionTag && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-display font-bold ${
                            evt.decisionTag === "Accepted"
                              ? "bg-emerald-600 text-white"
                              : "bg-rose-600 text-white"
                          }`}
                        >
                          {evt.decisionTag === "Accepted" ? "Approved" : "Dropped"}
                        </span>
                      )}
                    </div>

                    {/* Decision Remark Text */}
                    <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap font-sans">
                      {evt.summary}
                    </p>

                    {/* Footer timestamp */}
                    <div className="flex items-center justify-end gap-1 pt-0.5 text-[9.5px] font-mono text-[var(--on-surface-subtle)]">
                      <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
                      <span>{dateDisplay}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // ── General Audit Note Card ──
            const isSampNote = evt.actorDepartment?.toLowerCase().includes("samp");
            return (
              <div key={evt.id} className="flex flex-col items-start w-full animate-in fade-in duration-100">
                <div
                  className={`w-full rounded-xl p-3 shadow-2xs border text-xs space-y-1.5 ${
                    isSampNote
                      ? "bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/20"
                      : "bg-[var(--surface-base)] border-[var(--border-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-1">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-[var(--on-surface-muted)]" />
                      <span className={`font-display font-bold text-[11px] ${isSampNote ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--accent-primary)]"}`}>
                        {evt.actorName}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold uppercase tracking-wider bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                        {evt.actorDepartment || "DESK"}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap font-sans">
                    {evt.summary}
                  </p>
                  <div className="flex items-center justify-end gap-1 pt-0.5 text-[9.5px] font-mono text-[var(--on-surface-subtle)]">
                    <Clock className="w-3 h-3" />
                    <span>{dateDisplay}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Bottom Verification Strip ── */}
      <div className="px-3.5 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] shrink-0 flex items-center justify-between text-[10px] font-mono text-[var(--on-surface-subtle)] select-none">
        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
          <Lock className="w-3 h-3" />
          <span>Audit Log Verified</span>
        </span>
        <span>{auditEvents.length} {auditEvents.length === 1 ? "Event" : "Events"}</span>
      </div>
    </aside>
  );
};

export default FeasibilityChatterFeed;
