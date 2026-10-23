import type { ColumnDef } from "@/components/erp";
import type { RequestWorkflowRecord } from "@/infrastructure/api";

export type ReviewStep = "creative" | "studio" | "sampling";
type StepStatus = "not_required" | "waiting" | "in_progress" | "complete" | "ready" | "returned" | "released";
export type SamplingWorkflowSortField = "request" | "customer" | "program" | "description" | "stage";

const stageLabels: Record<string, string> = {
  marketing: "Marketing intake",
  design_review: "Design review",
  awaiting_design_acceptance: "Design acceptance",
  creative: "Creative work",
  creative_approval: "Creative review",
  studio: "Studio work",
  costing: "Costing work",
  awaiting_marketing_acceptance: "Marketing acceptance",
  awaiting_marketing_direction: "Marketing direction",
  sampling_review: "Sampling review",
  plant: "Plant execution",
  done: "Completed",
};

const stageTeams: Record<string, string> = {
  marketing: "Marketing",
  design_review: "Creative Studio",
  awaiting_design_acceptance: "Creative Studio",
  creative: "Creative Studio",
  creative_approval: "Creative Studio",
  studio: "Studio",
  costing: "Costing",
  awaiting_marketing_acceptance: "Marketing",
  awaiting_marketing_direction: "Marketing",
  sampling_review: "Sampling Team",
  plant: "Plant",
  done: "Completed",
};

const workflowLabels: Record<RequestWorkflowRecord["workflow_type"], string> = {
  sample: "Sample",
  design: "Design",
  mockup: "Mockup",
  costing: "Costing",
};

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

export function getWorkflowStageLabel(stage: string) {
  return stageLabels[normalize(stage)] || stage || "Unknown stage";
}

function workflowHistoryText(record: RequestWorkflowRecord) {
  const events = Array.isArray(record.workflow_data?.events) ? record.workflow_data.events : [];
  const logText = (record.logs || []).map((log) => [log.action, log.from_stage, log.to_stage].join(" ")).join(" ");
  const eventText = events.map((event: Record<string, unknown>) => [event.action, event.title].join(" ")).join(" ");
  return `${logText} ${eventText}`.toLowerCase();
}

function isStepInvolved(record: RequestWorkflowRecord, step: ReviewStep) {
  const scopes = new Set((record.request_types || []).map(normalize));
  const data = record.workflow_data || {};
  const route = data.samplingRouting || {};
  const stage = normalize(record.current_stage);
  const history = workflowHistoryText(record);

  if (step === "sampling") return true;

  if (step === "creative") {
    return record.workflow_type === "design"
      || record.costing_creative_input_needed === true
      || Boolean(record.costing_creative_input_remark?.trim())
      || ["creative", "creative_approval"].includes(stage)
      || scopes.has("design")
      || Boolean(
        data.creativeChangesRequired
        || data.hasCreativeChanges
        || data.creativeCharacteristicsCleared
        || data.creativePendingCharacteristicKeys?.length
        || data.creativeArtworkDecision
        || data.creativeApprovalDecision
        || data.creativeShutterstockNo
        || data.creativeRemark
        || route.creativeChangesRequired
        || route.hasCreativeChanges
        || route.creativePendingCharacteristicKeys?.length
      )
      || history.includes("creative");
  }

  return record.workflow_type === "mockup"
    || scopes.has("mockup")
    || stage === "studio"
    || Boolean(data.mockupUrl || data.studioSubmittedAt || data.studioCompletedAt || route.studioCompletedAt)
    || history.includes("studio");
}

function getStepStatus(record: RequestWorkflowRecord, step: ReviewStep): StepStatus {
  const stage = normalize(record.current_stage);
  const workflowStatus = normalize(record.reviewer_status);
  const history = workflowHistoryText(record);

  if (step === "sampling") {
    if (workflowStatus === "returned") return "returned";
    if (stage === "sampling_review" && !record.is_closed) return "ready";
    if (workflowStatus === "bypassed") return "released";
    if (["plant", "done"].includes(stage) || workflowStatus === "approved") return "released";
    return "waiting";
  }

  if (!isStepInvolved(record, step)) return "not_required";

  const activeStages = step === "creative"
    ? ["design_review", "awaiting_design_acceptance", "creative", "creative_approval"]
    : ["studio"];
  if (activeStages.includes(stage)) return "in_progress";

  if (step === "studio" && (
    record.workflow_data?.studioCompletedAt
    || record.workflow_data?.studioSubmittedAt
    || record.workflow_data?.samplingRouting?.studioCompletedAt
  )) return "complete";

  if (step === "creative" && record.costing_creative_input_needed && !record.costing_creative_input_remark?.trim()) {
    return "waiting";
  }

  const completedStageRank: Record<string, number> = {
    marketing: 0,
    design_review: 1,
    awaiting_design_acceptance: 1,
    creative: 2,
    creative_approval: 3,
    studio: 4,
    awaiting_marketing_acceptance: 5,
    awaiting_marketing_direction: 5,
    costing: 5,
    sampling_review: 6,
    plant: 7,
    done: 8,
  };
  const completionRank = step === "creative" ? 3 : 5;
  if ((completedStageRank[stage] ?? -1) >= completionRank) return "complete";

  const teamHistory = step === "creative" ? history.includes("creative") : history.includes("studio");
  return teamHistory ? "complete" : "waiting";
}

const stepText: Record<StepStatus, string> = {
  not_required: "Not in route",
  waiting: "Waiting",
  in_progress: "In progress",
  complete: "Complete",
  ready: "Ready for review",
  returned: "Returned",
  released: "Approved / released",
};

const stepTone: Record<StepStatus, string> = {
  not_required: "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]",
  waiting: "bg-amber-50 text-amber-800",
  in_progress: "bg-blue-50 text-blue-800",
  complete: "bg-emerald-50 text-emerald-800",
  ready: "bg-teal-50 text-teal-800",
  returned: "bg-rose-50 text-rose-800",
  released: "bg-emerald-50 text-emerald-800",
};

export function WorkflowReviewBadge({ record, step }: { record: RequestWorkflowRecord; step: ReviewStep }) {
  const status = getStepStatus(record, step);
  return (
    <span className={`inline-flex max-w-full rounded-full px-2 py-1 text-[10px] font-semibold leading-tight ${stepTone[status]}`}>
      {stepText[status]}
    </span>
  );
}

export function sortSamplingWorkflowRecords(
  records: RequestWorkflowRecord[],
  sortField: SamplingWorkflowSortField | null,
  direction: "asc" | "desc"
) {
  if (!sortField) return records;
  const valueFor: Record<SamplingWorkflowSortField, (record: RequestWorkflowRecord) => string> = {
    request: (record) => record.request_code || record.sr_number || "",
    customer: (record) => record.customer || "",
    program: (record) => record.program_name || "",
    description: (record) => record.product_description || "",
    stage: (record) => stageLabels[normalize(record.current_stage)] || record.current_stage || "",
  };
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) =>
    valueFor[sortField](a).localeCompare(valueFor[sortField](b), undefined, { numeric: true, sensitivity: "base" }) * multiplier
  );
}

export function createSamplingWorkflowColumns(
  onOpen: (record: RequestWorkflowRecord) => void
): ColumnDef<RequestWorkflowRecord>[] {
  return [
    {
      id: "request",
      header: "Request",
      width: "w-[155px]",
      sticky: "left",
      sortable: true,
      cell: (record) => (
        <div className="min-w-0">
          <span className="block truncate font-bold text-[var(--on-surface)]" title={record.request_code || record.sr_number || "Request"}>
            {record.request_code || record.sr_number || "Request"}
          </span>
          <span className="mt-0.5 inline-flex rounded bg-[var(--surface-low)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--on-surface-muted)]">
            {workflowLabels[record.workflow_type]}
          </span>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      width: "w-[150px]",
      sortable: true,
      cell: (record) => <span className="block truncate text-xs" title={record.customer || "Customer not set"}>{record.customer || "Customer not set"}</span>,
    },
    {
      id: "program",
      header: "Program",
      width: "w-[160px]",
      sortable: true,
      cell: (record) => (
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium" title={record.program_name || "No program linked"}>{record.program_name || "No program linked"}</span>
          {record.program_year && <span className="mt-0.5 block text-[10px] text-[var(--on-surface-subtle)]">BY {record.program_year}</span>}
        </div>
      ),
    },
    {
      id: "description",
      header: "Description",
      width: "w-[240px]",
      sortable: true,
      cell: (record) => <span className="block truncate text-xs text-[var(--on-surface-muted)]" title={record.product_description || "No description"}>{record.product_description || "No description"}</span>,
    },
    {
      id: "stage",
      header: "Stage",
      width: "w-[165px]",
      sortable: true,
      cell: (record) => {
        const stage = normalize(record.current_stage);
        return (
          <div className="min-w-0">
            <span className="block truncate text-xs font-semibold text-[var(--on-surface)]">{stageLabels[stage] || record.current_stage}</span>
            <span className="mt-0.5 block truncate text-[10px] text-[var(--on-surface-subtle)]">{stageTeams[stage] || "Workflow team"}</span>
          </div>
        );
      },
    },
    { id: "creative_review", header: "Creative Review", width: "w-[140px]", cell: (record) => <WorkflowReviewBadge record={record} step="creative" /> },
    { id: "studio_review", header: "Studio Review", width: "w-[140px]", cell: (record) => <WorkflowReviewBadge record={record} step="studio" /> },
    { id: "sampling_review", header: "Sampling Review", width: "w-[150px]", cell: (record) => <WorkflowReviewBadge record={record} step="sampling" /> },
    {
      id: "action",
      header: "Action",
      width: "w-[105px]",
      align: "right",
      sticky: "right",
      cell: (record) => {
        const label = record.current_stage === "sampling_review" && !record.is_closed ? "Review" : "Inspect";
        return (
          <button
            type="button"
            aria-label={`${label} ${record.request_code || record.sr_number || "request"}`}
            onClick={(event) => { event.stopPropagation(); onOpen(record); }}
            className="rounded-lg bg-[var(--accent-primary)] px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            {label}
          </button>
        );
      },
    },
  ];
}
