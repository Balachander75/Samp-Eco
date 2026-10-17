import { SampleRequestItem } from "../types";

export type RequestTrackType = "marketing_request" | "feasibility_check" | "program_planning";

export function getRequestTrackType(r: Partial<SampleRequestItem>): RequestTrackType {
  const mode = String(r.creationMode || (r as any)?.creation_mode || "").toLowerCase();
  const desc = String(r.productDescription || (r as any)?.product_description || "").toLowerCase();
  const mat = String(r.materialCode || (r as any)?.material_code || "").toLowerCase();
  const sr = String(r.srNumber || (r as any)?.sr_number || "").toLowerCase();
  const requestCode = String(r.requestCode || (r as any)?.request_code || "").toLowerCase();
  const idStr = String(r.id || "");
  const kind = String(r.requestKind || "").toLowerCase();

  // 1. Feasibility Check (Strict separation: NEVER enters Draft)
  if (
    kind === "feasibility" ||
    idStr.startsWith("feasibility-") ||
    mode === "feasibility_check" ||
    mode === "feasibility" ||
    Boolean((r as any)?.feasibilityCategory) ||
    Boolean((r as any)?.feasibility_category) ||
    mat.startsWith("fc-") ||
    mat.startsWith("fc-ck") ||
    mat.startsWith("fs-ck") ||
    sr.startsWith("fc-") ||
    sr.startsWith("fs-") ||
    desc.includes("feasibility check") ||
    desc.startsWith("[new category]") ||
    desc.startsWith("[new format]") ||
    desc.startsWith("[new finish]") ||
    desc.startsWith("[new accessories]") ||
    desc.startsWith("[other custom]") ||
    desc.startsWith("[bespoke")
  ) {
    return "feasibility_check";
  }

  // 2. Program Planning (Strict separation: NEVER enters Draft)
  if (
    kind === "program" ||
    idStr.startsWith("program-") ||
    mode === "program_planning" ||
    requestCode.startsWith("pp-") ||
    mat.startsWith("pg-pl") ||
    sr.startsWith("pg-") ||
    desc.includes("seasonal program:") ||
    desc.includes("material specification matrix:")
  ) {
    return "program_planning";
  }

  // 3. Marketing Request (Only Marketing requests can enter Draft)
  return "marketing_request";
}

export function isDesignRequest(r?: Partial<SampleRequestItem> | null): boolean {
  if (!r) return false;
  if (r.designRequestId && Number(r.designRequestId) > 0) return true;
  if (r.requestKind === "design") return true;
  if (String(r.requestCode || "").toLowerCase().startsWith("dr-")) return true;
  const idStr = String(r.id || "");
  if (idStr.startsWith("design-")) return true;
  const scopes = r.requestTypes || [];
  if (scopes.includes("design") && !scopes.includes("sample")) return true;
  const mat = String(r.materialCode || "").toLowerCase();
  const sr = String(r.srNumber || "").toLowerCase();
  if (mat.startsWith("dsg-") || sr.startsWith("dsg-")) return true;
  return false;
}

/** Choose the first owner for a Marketing draft when it is released. */
export function getDraftReleaseStatus(r: Partial<SampleRequestItem>): string {
  const requestTypes = r.requestTypes || [];
  const state = ((r.mockupWorkflowState || {}) as Record<string, any>);
  const routing = ((state.samplingRouting || {}) as Record<string, any>);
  const isResample = Boolean((r as any)?.isResample || state.isResample || routing.isResample);

  if (requestTypes.length === 1 && requestTypes[0] === "sample") {
    if (isResample) return "Released to Plant";
    if (routing.creativeChangesRequired) return "Creative";
    return "Sampling Review (PMT)";
  }
  if (requestTypes.length === 1 && requestTypes[0] === "costing") {
    return r.costingCreativeInputNeeded ? "Creative" : "Costing";
  }
  return "Creative";
}

export function getRequestTrackBadge(r: Partial<SampleRequestItem>): {
  label: string;
  bg: string;
  text: string;
  border: string;
  className: string;
} {
  if (isDesignRequest(r)) {
    return {
      label: "Design Request",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800/50",
      className:
        "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50",
    };
  }
  const track = getRequestTrackType(r);
  if (track === "feasibility_check") {
    return {
      label: "Feasibility NPD",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800",
      className:
        "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
    };
  }
  if (track === "program_planning") {
    return {
      label: "Program Planning",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      text: "text-indigo-700 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      className:
        "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800",
    };
  }
  return {
    label: "Sample Request",
    bg: "bg-brand-50 dark:bg-brand-950/40",
    text: "text-brand-700 dark:text-brand-300",
    border: "border-brand-200 dark:border-brand-800",
    className:
      "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800",
  };
}

export function getStageIdForRequest(r: SampleRequestItem): string {
  const track = getRequestTrackType(r);
  const s = String(r.status || "").toLowerCase().trim();

  // 1. Feasibility Check
  if (track === "feasibility_check") {
    if (
      s.includes("complete") ||
      s.includes("close") ||
      s.includes("approved") ||
      s.includes("rejected")
    ) {
      return "dispatched";
    }
    return "samp";
  }

  // 2. Program Planning
  if (track === "program_planning") {
    if (s.includes("complete") || s.includes("close") || s.includes("dispatch")) {
      return "dispatched";
    }
    if (s.includes("plant") || s.includes("execution")) {
      return "plant";
    }
    return "samp";
  }

  const mockupStage = r.mockupWorkflowState?.stage;
  const hasSamplingScope = (r.requestTypes || []).includes("sample");
  if (!hasSamplingScope) {
    if (mockupStage === "marketing" && r.mockupWorkflowState?.mockupUrl) return "marketing";
    if (mockupStage === "studio") return "studio";
    if (mockupStage === "creative") return "creative";
    if (
      mockupStage === "marketing" &&
      !s.includes("draft") && !s.includes("smt") && !s.includes("pending allocation") &&
      ((r.requestTypes || []).includes("mockup") || String(r.mockupRequired || "").toLowerCase() === "yes")
    ) {
      return r.mockupWorkflowState?.designNeeded === false ? "studio" : "creative";
    }
  }

  // 3. Marketing Request
  if (s.includes("draft") || s.includes("smt") || s.includes("pending allocation")) {
    return "draft";
  }
  if (s.includes("marketing")) return "marketing";
  if (s.includes("creative")) return "creative";
  if (s.includes("studio")) return "studio";
  if (s.includes("cost") || s.includes("estimation")) return "costing";
  if (s.includes("plant") || s.includes("execution")) return "plant";
  if (s.includes("dispatch") || s.includes("close") || s.includes("complete")) return "dispatched";
  if (s.includes("deal") || s.includes("actual")) return "deal";
  if (s.includes("samp") || s.includes("review") || s.includes("pmt") || s.includes("qc")) return "samp";

  const isDesign =
    (r.requestTypes || []).includes("design") ||
    String(r.materialCode || "").startsWith("DSG-") ||
    String(r.srNumber || "").includes("-DSG-");
  return isDesign ? "creative" : "samp";
}

export function isOpenFeasibilityReview(request: SampleRequestItem): boolean {
  if (getRequestTrackType(request) !== "feasibility_check") return false;
  if (request.samplingFeasibilityResponse) return false;
  const status = String(request.status || "").toLowerCase();
  return !["completed", "closed", "approved", "rejected"].some((term) => status.includes(term));
}
