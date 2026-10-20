import React, { useMemo } from "react";
import { SampleRequestItem, FeasibilityActivityItem } from "../../types";
import { UserProfile } from "@/features/auth";
import { UniversalChatterFeed, UniversalChatterEvent } from "../common/UniversalChatterFeed";

export interface FeasibilityChatterFeedProps {
  activeRequest: SampleRequestItem;
  classificationLabel: string;
  onAddNote?: (note: string) => Promise<void>;
  currentUser?: UserProfile | null;
}

export const FeasibilityChatterFeed: React.FC<FeasibilityChatterFeedProps> = ({
  activeRequest,
  classificationLabel,
  currentUser,
}) => {
  // Compile chronological audit & activity events into normalized UniversalChatterEvents
  const auditEvents = useMemo<UniversalChatterEvent[]>(() => {
    const events: UniversalChatterEvent[] = [];
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
            actorId: act.actorId || undefined,
            summary: `${author} raised feasibility request for ${activeRequest.customer || "Client"} (${classificationLabel})`,
            timestamp: time || activeRequest.createdAt || activeRequest.dateRequestCreated || "",
          });
        } else if (act.action === "TASK_CLAIMED" || act.action.includes("CLAIM")) {
          const assignee = act.actorName || payload.claimed_by || activeRequest.takenBySamp || "Sampling Team Engineer";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: assignee,
            actorDepartment: "Sampling Team",
            actorId: act.actorId || undefined,
            summary: `${assignee} claimed the Feasibility Review task`,
            timestamp: time || activeRequest.takenAtSamp || "",
          });
        } else if (act.action === "SAMP_COUNTER_DATE_PROPOSED") {
          const proposed = payload.proposed_date || activeRequest.sampCounterDate || "a revised date";
          const reason = payload.reason || activeRequest.sampCounterDateReason || "";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || activeRequest.sampCounterDateProposedBy || "Sampling Team",
            actorDepartment: "Sampling Team",
            actorId: act.actorId || undefined,
            summary: `${act.actorName || "Sampling Team"} proposed revised target date: ${proposed}${reason ? ` (${reason})` : ""}`,
            timestamp: time || activeRequest.sampCounterDateProposedAt || "",
          });
        } else if (act.action === "COUNTER_DATE_ACCEPTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            actorId: act.actorId || undefined,
            summary: `${act.actorName || "Marketing Team"} accepted the revised target date`,
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "COUNTER_DATE_REJECTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            actorId: act.actorId || undefined,
            summary: `${act.actorName || "Marketing Team"} rejected revised date; keeping original timeline`,
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "COUNTER_DATE_AUTO_ACCEPTED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: "System",
            actorDepartment: "System",
            summary: "System automatically accepted revised target date after 4 working days",
            timestamp: time || activeRequest.counterDateDecisionAt || "",
          });
        } else if (act.action === "SAMP_EVALUATED") {
          const verdict = (payload.verdict || activeRequest.samplingFeasibilityResponse || "Yes") as "Yes" | "No" | "Maybe";
          const reviewer = act.actorName || activeRequest.samplingFeasibilityApprovedBy || "Sampling Team";
          const remark = (payload.remark || activeRequest.samplingFeasibilityRemark || "").trim();
          events.push({
            id: act.id,
            kind: "bubble",
            actorName: reviewer,
            actorDepartment: "Sampling Team",
            actorId: act.actorId || undefined,
            summary: remark,
            detail: payload.conditions || activeRequest.feasibilityConditions || undefined,
            subdetail: payload.lead_time_note || activeRequest.leadTimeNote || undefined,
            timestamp: time || activeRequest.feasibilityClosedAt || "",
            verdictTag: verdict,
          });
        } else if (act.action === "MARKETING_DECIDED") {
          const decision = (payload.decision || activeRequest.marketingDecision || "Accepted") as "Accepted" | "Rejected";
          const decider = act.actorName || activeRequest.marketingDecisionBy || "Marketing Authority";
          const remark = (payload.remark || activeRequest.marketingDecisionRemark || "").trim();
          events.push({
            id: act.id,
            kind: "bubble",
            actorName: decider,
            actorDepartment: "Marketing",
            actorId: act.actorId || undefined,
            summary: remark,
            timestamp: time || activeRequest.marketingDecisionAt || "",
            decisionTag: decision,
          });
        } else if (act.action === "CONVERTED_TO_SAMPLING") {
          const srNum = payload.sample_request_code || activeRequest.convertedRequestCode || activeRequest.convertedSrNumber || "";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || activeRequest.convertedBy || "Marketing Lead",
            actorDepartment: "Marketing",
            actorId: act.actorId || undefined,
            summary: `${act.actorName || "Marketing"} converted feasibility to commercial request ${srNum || ""}`.trim(),
            timestamp: time || activeRequest.convertedAt || "",
          });
        } else if (act.action === "NOTE_ADDED") {
          const dept = (act.actorDepartment || "").toLowerCase();
          const isSamp = dept.includes("samp");
          events.push({
            id: act.id,
            kind: "bubble",
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || (isSamp ? "Sampling Team" : "Marketing"),
            actorId: act.actorId || undefined,
            summary: String(payload.note || payload.text || "").trim(),
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
        actorId: activeRequest.createdByUserId || undefined,
        summary: `${author} raised feasibility request for ${activeRequest.customer || "Client"} (${classificationLabel})`,
        timestamp: activeRequest.createdAt || activeRequest.dateRequestCreated || "",
      });
    }

    if (!recordedActions.has("TASK_CLAIMED") && activeRequest.takenBySamp) {
      events.push({
        id: "synth-claim",
        kind: "system_announcement",
        actorName: activeRequest.takenBySamp,
        actorDepartment: "Sampling Team",
        actorId: activeRequest.takenBySampUserId || undefined,
        summary: `${activeRequest.takenBySamp} claimed the Feasibility Review task`,
        timestamp: activeRequest.takenAtSamp || activeRequest.createdAt || "",
      });
    }

    if (!recordedActions.has("SAMP_EVALUATED") && activeRequest.samplingFeasibilityResponse) {
      const verdict = activeRequest.samplingFeasibilityResponse as "Yes" | "No" | "Maybe";
      const remark = (activeRequest.samplingFeasibilityRemark || "").trim();
      events.push({
        id: "synth-evaluated",
        kind: "bubble",
        actorName: activeRequest.samplingFeasibilityApprovedBy || "Sampling Team",
        actorDepartment: "Sampling Team",
        summary: remark,
        detail: activeRequest.feasibilityConditions || undefined,
        subdetail: activeRequest.leadTimeNote || undefined,
        timestamp: activeRequest.feasibilityClosedAt || activeRequest.takenAtSamp || "",
        verdictTag: verdict,
      });
    }

    if (!recordedActions.has("MARKETING_DECIDED") && activeRequest.marketingDecision) {
      const decision = activeRequest.marketingDecision as "Accepted" | "Rejected";
      const remark = (activeRequest.marketingDecisionRemark || "").trim();
      events.push({
        id: "synth-decision",
        kind: "bubble",
        actorName: activeRequest.marketingDecisionBy || "Marketing Authority",
        actorDepartment: "Marketing",
        summary: remark,
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
        actorDepartment: "Marketing",
        summary: `${activeRequest.convertedBy || "Marketing"} converted feasibility to commercial request ${srNum || ""}`.trim(),
        timestamp: activeRequest.convertedAt || "",
      });
    }

    return events;
  }, [activeRequest, classificationLabel]);

  return (
    <UniversalChatterFeed
      title="Audit & Activity Log"
      events={auditEvents}
      currentUser={currentUser}
    />
  );
};

export default FeasibilityChatterFeed;
