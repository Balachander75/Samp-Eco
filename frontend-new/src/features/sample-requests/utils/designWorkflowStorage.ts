import { SampleRequestItem } from "../types";

/** The backend response is canonical for all design workflow state. */
export function mergeWithWorkflowState(request: SampleRequestItem): SampleRequestItem {
  return request;
}

/** Check the 48-hour claim and counter-date window from Marketing's release timestamp. */
export function checkCounterDateSla(
  request: SampleRequestItem,
  now = Date.now()
): {
  isEligible: boolean;
  hoursRemaining: number;
  label: string;
  deadlineIso: string;
} {
  const baseTimeStr = request.releasedAt || request.designRequestCreatedAt || request.createdAt;
  if (!baseTimeStr) {
    return { isEligible: false, hoursRemaining: 0, label: "Request time unavailable", deadlineIso: "" };
  }
  const baseTime = new Date(baseTimeStr).getTime();
  if (isNaN(baseTime)) {
    return { isEligible: false, hoursRemaining: 0, label: "Request time unavailable", deadlineIso: "" };
  }

  const deadline = baseTime + 48 * 60 * 60 * 1000;
  const diffMs = deadline - now;
  const deadlineIso = new Date(deadline).toISOString();
  if (diffMs <= 0) {
    return { isEligible: false, hoursRemaining: 0, label: "48h Claim & Counter Window Expired", deadlineIso };
  }

  const totalMinutes = Math.max(0, Math.ceil(diffMs / (60 * 1000)));
  const hoursRemaining = Math.ceil(totalMinutes / 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const remHours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const label = days > 0
    ? `${days}d ${remHours}h ${minutes}m left`
    : `${remHours}h ${minutes}m left`;
  return { isEligible: true, hoursRemaining, label: `Claim / Counter Window: ${label}`, deadlineIso };
}
