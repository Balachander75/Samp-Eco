import React, { useMemo } from "react";
import { SampleRequestItem, ProgramActivityItem } from "../../types";
import { UserProfile } from "@/features/auth";
import { UniversalChatterFeed, UniversalChatterEvent } from "../../components/common/UniversalChatterFeed";

export interface ProgramPlanningChatterFeedProps {
  activeRequest: SampleRequestItem;
  onNoteAdded?: () => Promise<void> | void;
  currentUser?: UserProfile | null;
}

export const ProgramPlanningChatterFeed: React.FC<ProgramPlanningChatterFeedProps> = ({
  activeRequest,
  currentUser,
}) => {
  // Compile clear, human-readable chronological audit events into UniversalChatterEvent[]
  const auditEvents = useMemo<UniversalChatterEvent[]>(() => {
    const events: UniversalChatterEvent[] = [];
    const recordedActions = new Set<string>();

    const rawActivities: ProgramActivityItem[] = Array.isArray(activeRequest.activities)
      ? (activeRequest.activities as unknown as ProgramActivityItem[])
      : [];

    // Filter out passive view/seen events
    rawActivities
      .filter((act) => {
        const action = (act.action || "").toUpperCase();
        return (
          !action.includes("VIEW") &&
          action !== "SAMP_VIEWED" &&
          action !== "PLANT_VIEWED" &&
          action !== "VIEWED" &&
          action !== "SAMP_SEEN" &&
          action !== "PLANT_SEEN"
        );
      })
      .forEach((act) => {
        recordedActions.add(act.action);
        const payload = (act.payload || {}) as Record<string, any>;
        const time = act.createdAt || "";
        const action = (act.action || "").toUpperCase();

        if (action === "CREATED" || action === "PROGRAM_CREATED") {
          const author = act.actorName || activeRequest.createdBy || "Marketing Team";
          const progName = activeRequest.programName || activeRequest.programCampaignTitle || "Seasonal Program";
          const year = activeRequest.programYear || "FY";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: author,
            actorDepartment: act.actorDepartment || "Marketing",
            summary: `${author} created seasonal program plan "${progName}" (${year})`,
            timestamp: time || activeRequest.createdAt || "",
          });
        } else if (action === "SAMP_TASK_CLAIMED") {
          const assignee = act.actorName || activeRequest.samplingClaimedBy || "Sampling Team Engineer";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: assignee,
            actorDepartment: "Sampling Team",
            summary: `${assignee} claimed sampling feasibility review`,
            timestamp: time || activeRequest.samplingSignedAt || "",
          });
        } else if (action === "PLANT_TASK_CLAIMED") {
          const assignee = act.actorName || activeRequest.plantClaimedBy || "Plant Engineer";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: assignee,
            actorDepartment: `Plant (${activeRequest.targetPlant || "Production"})`,
            summary: `${assignee} claimed plant review check`,
            timestamp: time || activeRequest.plantSignedAt || "",
          });
        } else if (action === "SKU_PROMOTED_TO_SAMPLE_REQUEST") {
          const matType = payload.material_type || "SKU";
          const srNum = payload.sr_number || "SR";
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing",
            actorDepartment: "Marketing",
            summary: `${act.actorName || "Marketing"} promoted SKU "${matType}" to Sample Request: ${srNum}`,
            timestamp: time,
          });
        } else if (action === "SAMP_OUTPUT") {
          const rawVerdict = payload.verdict || activeRequest.samplingVerdict || "Feasible";
          const reviewer = act.actorName || activeRequest.samplingSignedBy || "Sampling Team";
          const remark = (payload.remark || activeRequest.samplingRemark || "").trim();

          events.push({
            id: act.id,
            kind: "bubble",
            actorName: reviewer,
            actorDepartment: "Sampling Team",
            summary: remark,
            timestamp: time || activeRequest.samplingSignedAt || "",
            verdictTag: rawVerdict,
          });
        } else if (action === "PLANT_OUTPUT") {
          const rawVerdict = payload.verdict || activeRequest.plantVerdict || "Capacity Confirmed";
          const reviewer = act.actorName || activeRequest.plantSignedBy || "Plant Authority";
          const plantName = activeRequest.targetPlant || "Plant";
          const remark = (payload.remark || activeRequest.plantRemark || "").trim();

          events.push({
            id: act.id,
            kind: "bubble",
            actorName: reviewer,
            actorDepartment: `Plant (${plantName})`,
            summary: remark,
            timestamp: time || activeRequest.plantSignedAt || "",
            verdictTag: rawVerdict,
          });
        } else if (action === "MATERIAL_ADDED") {
          const matType = payload.material_type || "Material Line";
          const qty = payload.quantity ? `${Number(payload.quantity).toLocaleString()} ${payload.unit || "pcs"}` : null;
          const caliper = payload.caliper_wt ? `Caliper: ${payload.caliper_wt}` : null;
          const mill = payload.supplier_name ? `Mill: ${payload.supplier_name}` : null;
          const specDetails = [qty, caliper, mill].filter(Boolean).join(" · ");

          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Desk",
            actorDepartment: "Marketing",
            summary: `Added "${matType}"${specDetails ? ` (${specDetails})` : ""}`,
            timestamp: time,
          });
        } else if (action === "MATERIAL_DELETED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Desk",
            actorDepartment: "Marketing",
            summary: `Removed specification line "${payload.material_type || "Material"}"`,
            timestamp: time,
          });
        } else if (action.includes("SAMP_REMARK")) {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Sampling Team",
            actorDepartment: "Sampling Team",
            summary: payload.new_remark ? `Updated remark for ${payload.material_type || "SKU"}: "${payload.new_remark}"` : "Updated line-by-line technical remarks",
            timestamp: time,
          });
        } else if (action.includes("PLANT_REMARK")) {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Plant Desk",
            actorDepartment: "Plant",
            summary: payload.new_remark ? `Updated remark for ${payload.material_type || "SKU"}: "${payload.new_remark}"` : "Updated line-by-line plant capacity remarks",
            timestamp: time,
          });
        } else if (action === "PROGRAM_PAUSED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            summary: "Program planning workflow temporarily paused for review",
            timestamp: time,
          });
        } else if (action === "PROGRAM_DISMANTLED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            summary: payload.reason ? `Program permanently dismantled: "${payload.reason}"` : "Program permanently dismantled and terminated",
            timestamp: time,
          });
        } else if (action === "PROGRAM_RESUMED") {
          events.push({
            id: act.id,
            kind: "system_announcement",
            actorName: act.actorName || "Marketing Team",
            actorDepartment: "Marketing",
            summary: "Program planning workflow resumed active",
            timestamp: time,
          });
        } else if (action === "NOTE_ADDED" || action === "NOTE_POSTED") {
          events.push({
            id: act.id,
            kind: "bubble",
            actorName: act.actorName || "Team Member",
            actorDepartment: act.actorDepartment || "Desk",
            summary: String(payload.note || payload.text || "").trim(),
            timestamp: time,
          });
        }
      });

    // Synthesize milestones if activities table had missing initial records
    if (!recordedActions.has("CREATED") && !recordedActions.has("PROGRAM_CREATED")) {
      const author = activeRequest.createdBy || "Marketing Team";
      const progName = activeRequest.programName || activeRequest.programCampaignTitle || "Seasonal Program";
      const year = activeRequest.programYear || "FY";
      events.push({
        id: "synth-create",
        kind: "system_announcement",
        actorName: author,
        actorDepartment: "Marketing",
        summary: `${author} created seasonal program plan "${progName}" (${year})`,
        timestamp: activeRequest.createdAt || "",
      });
    }

    if (!recordedActions.has("SAMP_TASK_CLAIMED") && activeRequest.samplingClaimedBy) {
      events.push({
        id: "synth-samp-claim",
        kind: "system_announcement",
        actorName: activeRequest.samplingClaimedBy,
        actorDepartment: "Sampling Team",
        summary: `${activeRequest.samplingClaimedBy} claimed sampling feasibility review`,
        timestamp: activeRequest.samplingSignedAt || activeRequest.createdAt || "",
      });
    }

    if (!recordedActions.has("PLANT_TASK_CLAIMED") && activeRequest.plantClaimedBy) {
      events.push({
        id: "synth-plant-claim",
        kind: "system_announcement",
        actorName: activeRequest.plantClaimedBy,
        actorDepartment: "Plant",
        summary: `${activeRequest.plantClaimedBy} claimed plant review check`,
        timestamp: activeRequest.plantSignedAt || activeRequest.createdAt || "",
      });
    }

    if (!recordedActions.has("SAMP_OUTPUT") && activeRequest.samplingVerdict) {
      events.push({
        id: "synth-samp-output",
        kind: "bubble",
        actorName: activeRequest.samplingSignedBy || "Sampling Team",
        actorDepartment: "Sampling Team",
        summary: (activeRequest.samplingRemark || "").trim(),
        timestamp: activeRequest.samplingSignedAt || activeRequest.createdAt || "",
        verdictTag: activeRequest.samplingVerdict,
      });
    }

    if (!recordedActions.has("PLANT_OUTPUT") && activeRequest.plantVerdict) {
      events.push({
        id: "synth-plant-output",
        kind: "bubble",
        actorName: activeRequest.plantSignedBy || "Plant Authority",
        actorDepartment: `Plant (${activeRequest.targetPlant || "Production"})`,
        summary: (activeRequest.plantRemark || "").trim(),
        timestamp: activeRequest.plantSignedAt || activeRequest.createdAt || "",
        verdictTag: activeRequest.plantVerdict,
      });
    }

    return events;
  }, [activeRequest]);

  return (
    <UniversalChatterFeed
      title="Audit & Activity Log"
      events={auditEvents}
      currentUser={currentUser}
    />
  );
};

export default ProgramPlanningChatterFeed;
