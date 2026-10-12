import { SampleRequestItem } from "../../types";
import { isDesignRequest } from "../../utils/trackTypes";

export type RequestTypeScope = "design" | "mockup" | "sample" | "costing";

export function getRequestTypes(row: Partial<SampleRequestItem>): RequestTypeScope[] {
  const result: RequestTypeScope[] = [];

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

  // Only infer if no explicit scopes are set:
  if (isDesignRequest(row) || row.requestKind === "design") {
    result.push("design");
  }

  const mockupVal = String(row.mockupRequired || "").trim().toLowerCase();
  if (mockupVal === "yes" || mockupVal === "true" || mockupVal === "y") {
    result.push("mockup");
  }

  if (row.qtyDesignCosting && Number(row.qtyDesignCosting) > 0) {
    result.push("costing");
  }

  // All commercial FY25-26 and standard sample requests are sampling requests by default
  if (!result.includes("sample")) {
    result.push("sample");
  }

  return result;
}
