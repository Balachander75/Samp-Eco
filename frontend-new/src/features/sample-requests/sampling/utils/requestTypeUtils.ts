import { SampleRequestItem } from "../../types";
import { isDesignRequest } from "../../utils/trackTypes";

export type RequestTypeScope = "design" | "mockup" | "sample" | "costing";
const REQUIRED_DATE_SCOPE_PRIORITY: readonly RequestTypeScope[] = ["mockup", "design", "costing", "sample"];

export function getRequestTypes(row: Partial<SampleRequestItem>): RequestTypeScope[] {
  const result: RequestTypeScope[] = [];

  const audit = (row as any).requestTypeAudit || (row as any).request_type_audit;
  if (audit && typeof audit === "object") {
    const audited = (["design", "mockup", "sample", "costing"] as RequestTypeScope[])
      .filter((scope) => audit[scope] === true);
    if (audited.length > 0) return audited;
  }

  const explicit = Array.isArray(row.requestTypes) ? row.requestTypes : [];
  explicit.forEach((t) => {
    if (["design", "mockup", "sample", "costing"].includes(t as any) && !result.includes(t as any)) {
      result.push(t as any);
    }
  });

  // If explicit scopes are already defined, respect them directly
  if (result.length > 0) {
    return result;
  }

  const requestCodes = row.requestCodes && typeof row.requestCodes === "object" ? row.requestCodes : {};
  const codedScopes = (["design", "mockup", "sample", "costing"] as RequestTypeScope[])
    .filter((scope) => Boolean((requestCodes as any)[scope]));
  if (codedScopes.length > 0) return codedScopes;

  const requestCode = String(row.requestCode || row.materialCode || "").trim().toUpperCase();
  const mockupVal = String(row.mockupRequired || "").trim().toLowerCase();
  const mockupRequested = ["yes", "true", "y"].includes(mockupVal);
  if (requestCode.startsWith("DR-")) return ["design"];
  if (requestCode.startsWith("MR-")) return ["mockup"];
  if (requestCode.startsWith("SR-") && mockupRequested) return ["mockup"];
  if (requestCode.startsWith("CR-")) return ["costing"];

  // Only infer if no explicit scopes are set:
  if (isDesignRequest(row) || row.requestKind === "design") {
    result.push("design");
  }

  if (mockupRequested) {
    result.push("mockup");
  }

  if (row.qtyDesignCosting && Number(row.qtyDesignCosting) > 0) {
    result.push("costing");
  }

  // An old SR value by itself is not enough to make a Mockup request a
  // Sampling request. Sample scope must come from scope metadata or an SR code.
  if (requestCode.startsWith("SR-") && !result.includes("mockup")) result.push("sample");

  // Old commercial rows without any scope metadata remain Sample requests.
  return result.length > 0 ? result : ["sample"];
}

export function getRequestRequiredDate(
  row: Partial<SampleRequestItem>,
  preferredScope?: RequestTypeScope,
): string | undefined {
  const requestTypes = getRequestTypes(row);
  const scope = preferredScope
    ?? REQUIRED_DATE_SCOPE_PRIORITY.find((candidate) => requestTypes.includes(candidate))
    ?? "sample";

  if (scope === "mockup") return row.mockupWorkflowState?.requiredDate || row.sampleRequiredDate || undefined;
  if (scope === "design") return row.designRequiredDate || row.targetArtworkDateCreative || row.sampleRequiredDate || undefined;
  if (scope === "costing") return row.costingRequiredDate || row.sampleRequiredDate || undefined;
  return row.sampleRequiredDate || undefined;
}

export function getPrimaryRequestCode(row: SampleRequestItem, preferredScope?: string): string {
  const requestTypes = getRequestTypes(row);
  if (preferredScope && requestTypes.includes(preferredScope as RequestTypeScope)) {
    if (preferredScope === "sample") return row.srNumber || "";
    const preferredCode = (row.requestCodes as any)?.[preferredScope];
    if (preferredCode) return String(preferredCode);
    const prefixByScope: Record<string, string> = { design: "DR", mockup: "MR", costing: "CR" };
    const prefix = prefixByScope[preferredScope];
    if (prefix && row.requestCode?.toUpperCase().startsWith(`${prefix}-`)) return row.requestCode;
    if (prefix && row.materialCode?.toUpperCase().startsWith(`${prefix}-`)) return row.materialCode;
  }
  if (requestTypes.includes("sample")) return row.srNumber || "";

  const scope = (["design", "mockup", "costing"] as const)
    .find((candidate) => requestTypes.includes(candidate));
  if (!scope) return row.requestCode || row.materialCode || "";

  const prefixByScope: Record<Exclude<RequestTypeScope, "sample">, string> = {
    design: "DR",
    mockup: "MR",
    costing: "CR",
  };
  const prefix = prefixByScope[scope];
  const scopedCode = (row.requestCodes as any)?.[scope];
  if (scopedCode) return String(scopedCode);
  if (row.requestCode?.toUpperCase().startsWith(`${prefix}-`)) return row.requestCode;
  if (row.materialCode?.toUpperCase().startsWith(`${prefix}-`)) return row.materialCode;
  return "";
}

export function getSecondaryRequestCode(row: SampleRequestItem): string | undefined {
  if (!getRequestTypes(row).includes("sample")) return undefined;
  const primary = getPrimaryRequestCode(row);
  if (!primary) return undefined;
  const materialCode = String(row.materialCode || "").trim();
  return materialCode && materialCode !== primary ? materialCode : undefined;
}
