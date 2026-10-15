const workflowActionLabels: Record<string, string> = {
  WORKFLOW_STARTED: "Workflow started",
  MARKETING_SUBMITTED: "Marketing submitted request",
  CREATIVE_RELEASED_TO_COSTING: "Creative sent request to Costing",
  COSTING_SUBMITTED_FOR_REVIEW: "Costing sent work for review",
  SAMPLING_APPROVED_COSTING: "Sampling approved costing",
  SAMPLING_RETURNED_COSTING: "Sampling returned work to Costing",
  SAMPLING_APPROVED_MOCKUP: "Sampling approved the mockup",
  SAMPLING_RETURNED_MOCKUP: "Sampling returned the mockup to Studio",
  MARKETING_ACCEPTED_MOCKUP: "Marketing accepted the mockup",
  MARKETING_REQUESTED_STUDIO_REVISION: "Marketing requested a Studio revision",
};

export function formatWorkflowAction(action: string) {
  return workflowActionLabels[action] || action.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
