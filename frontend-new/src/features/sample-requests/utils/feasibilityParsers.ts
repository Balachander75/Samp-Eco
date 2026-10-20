import { SampleRequestItem } from "../types";

export interface AddProgramMaterialPayload {
  material_type: string;
  supplier_name: string;
  grade: string;
  color_variant: string;
  caliper_wt: string;
  quantity: string;
  unit: string;
  remark: string;
  samp_remark: string;
}

export interface ParsedMatrixRow {
  id?: number | string;
  index: number;
  type: string;
  supplier: string;
  grade: string;
  color: string;
  caliper: string;
  qty: string;
  unit: string;
  remark: string;
  sampRemark?: string;
  createdAt?: string;
}

export interface ParsedImageRef {
  id: string;
  name: string;
  url?: string;
}

export interface ParsedFeasibilityDetails {
  category: string;
  requirements: string;
  marketingRemarks: string | null;
  referenceLinks: string[];
  referenceImages: ParsedImageRef[];
}

export const FEASIBILITY_TYPES = [
  {
    id: "new_category",
    label: "New Category",
    desc: "Introduce new product lines or unlisted classifications",
  },
  {
    id: "new_format",
    label: "New Format",
    desc: "Custom sizes, unique binding structures, or novel layouts",
  },
  {
    id: "new_finish",
    label: "New Finish",
    desc: "Special cover treatments, foil, embossing, or lamination effects",
  },
  {
    id: "new_accessories",
    label: "New Accessories",
    desc: "Custom ribbons, elastic bands, pockets, stickers, or clasps",
  },
  {
    id: "other",
    label: "Other Custom",
    desc: "Specific bespoke requirement or custom manufacturing check",
  },
];

export function getFeasibilityTypeDisplay(request: SampleRequestItem): string {
  if (request.customFeasibilityType && request.customFeasibilityType.trim()) {
    return request.customFeasibilityType.trim();
  }
  const ft = request.feasibilityType;
  const typeMap: Record<string, string> = {
    new_category: "New Category",
    new_format: "New Format",
    new_finish: "New Finish",
    new_accessories: "New Accessories",
    other: "Other Custom",
    bespoke: "Bespoke",
    feasibility_check: "Feasibility Check",
  };
  if (ft && typeMap[ft.toLowerCase()]) return typeMap[ft.toLowerCase()];
  if (ft) return ft.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "";
}

export function getFeasibilityTypeId(request: SampleRequestItem): string {
  const custom = (request.customFeasibilityType || "").toLowerCase().trim();
  const ft = (request.feasibilityType || "").toLowerCase().trim();
  const desc = (request.productDescription || "").toLowerCase();
  const cat = ((request as any).feasibilityCategory || "").toLowerCase();

  const target = `${custom} ${ft} ${desc} ${cat}`;
  if (target.includes("new_category") || target.includes("new category") || target.includes("[new category]")) return "new_category";
  if (target.includes("new_format") || target.includes("new format") || target.includes("[new format]")) return "new_format";
  if (target.includes("new_finish") || target.includes("new finish") || target.includes("[new finish]")) return "new_finish";
  if (target.includes("new_accessories") || target.includes("new accessories") || target.includes("[new accessories]")) return "new_accessories";
  if (target.includes("other") || target.includes("bespoke")) return "other";

  if (ft === "new_category" || ft === "new_format" || ft === "new_finish" || ft === "new_accessories" || ft === "other") return ft;
  return "new_category";
}

export function parseFeasibilityDetails(
  description?: string,
  existingImages?: string[],
  existingLinks?: string[],
  productImagePath?: string | null,
  existingImageNames?: string[]
): ParsedFeasibilityDetails {
  let category = "";
  let text = (description || "").trim();
  let marketingRemarks: string | null = null;
  const links: string[] = existingLinks ? [...existingLinks.filter(Boolean)] : [];
  const parsedImageNames: string[] = existingImageNames ? [...existingImageNames.filter(Boolean)] : [];

  const categoryMatch = text.match(/^\[(.*?)\]/);
  if (categoryMatch) {
    category = categoryMatch[1].trim();
    text = text.slice(categoryMatch[0].length).trim();
  }

  const catMatch = text.match(/Feasibility Category:\s*([^\n]+)/i);
  if (catMatch) {
    category = catMatch[1].trim();
    text = text.replace(catMatch[0], "").trim();
  }

  const imagesMatch = text.match(
    /Attached Images(?:\s*\(\d+\))?:\s*([\s\S]*?)(?=(?:Marketing Remarks:|Reference Web Links:|Reference Link:|Release \/ Dispatch Remarks:|$))/i
  );
  if (imagesMatch) {
    const rawImageLines = imagesMatch[1].trim().split("\n");
    rawImageLines.forEach((l) => {
      const cleanName = l.replace(/^\d+[\.\)]\s*/, "").trim();
      if (cleanName && !parsedImageNames.includes(cleanName)) {
        parsedImageNames.push(cleanName);
      }
    });
    text = text.replace(imagesMatch[0], "").trim();
  }

  const linksMatch = text.match(
    /(?:Reference Web Links|Reference Link:?)(?:\s*\(\d+\))?:\s*([\s\S]*?)(?=(?:Marketing Remarks:|Attached Images:|Release \/ Dispatch Remarks:|$))/i
  );
  if (linksMatch) {
    const rawLinkLines = linksMatch[1].trim().split("\n");
    rawLinkLines.forEach((l) => {
      const cleanUrl = l.replace(/^\d+[\.\)]\s*/, "").trim();
      if (cleanUrl && !links.includes(cleanUrl)) {
        links.push(cleanUrl);
      }
    });
    text = text.replace(linksMatch[0], "").trim();
  }

  // Fallback: extract any raw URLs directly from text if not caught by block matcher
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const foundUrl = match[1].trim();
    if (foundUrl && !links.includes(foundUrl)) {
      links.push(foundUrl);
    }
  }

  // Also check if productImagePath itself is a web link rather than an image asset
  if (productImagePath && /^https?:\/\//i.test(productImagePath)) {
    if (!/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(productImagePath)) {
      if (!links.includes(productImagePath)) {
        links.push(productImagePath);
      }
    }
  }

  const remarksMatch = text.match(
    /(?:Marketing Remarks|Release \/ Dispatch Remarks):\s*([\s\S]*?)(?=(?:Attached Images:|Reference Web Links:|Reference Link:|$))/i
  );
  if (remarksMatch) {
    marketingRemarks = remarksMatch[1].trim();
    text = text.replace(remarksMatch[0], "").trim();
  }

  const combinedImages: ParsedImageRef[] = [];
  const rawImageUrls: string[] = existingImages ? [...existingImages.filter(Boolean)] : [];
  if (productImagePath && (productImagePath.startsWith("data:image") || /\.(png|jpe?g|webp|gif|svg)$/i.test(productImagePath))) {
    if (!rawImageUrls.includes(productImagePath)) {
      rawImageUrls.unshift(productImagePath);
    }
  }

  const maxLen = Math.max(parsedImageNames.length, rawImageUrls.length);
  for (let i = 0; i < maxLen; i++) {
    const url = rawImageUrls[i];
    const name = parsedImageNames[i] || (url ? (url.startsWith("data:") ? `Photo #${i + 1}` : url.split("/").pop() || `Photo #${i + 1}`) : `Photo #${i + 1}`);
    combinedImages.push({
      id: `img-${i}`,
      name,
      url,
    });
  }

  return {
    category: category || "Custom Specification",
    requirements: text || "Custom feasibility evaluation requested by client.",
    marketingRemarks,
    referenceLinks: Array.from(new Set(links.filter(Boolean))),
    referenceImages: combinedImages,
  };
}

export const emptyNewRow: AddProgramMaterialPayload = {
  material_type: "",
  supplier_name: "",
  grade: "",
  color_variant: "",
  caliper_wt: "",
  quantity: "",
  unit: "sheets",
  remark: "",
  samp_remark: "",
};

export function formatAddedDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr.split("T")[0] || dateStr;
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateStr.split("T")[0] || dateStr;
  }
}

export function parseProgramMatrix(description?: string): ParsedMatrixRow[] {
  if (!description || !description.includes("Material Specification Matrix:")) return [];
  const matrixText = description.slice(
    description.indexOf("Material Specification Matrix:") + "Material Specification Matrix:".length
  );
  const lines = matrixText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("#"));

  return lines.map((line, idx) => {
    const parts = line.split("|").map((p) => p.trim());
    const getVal = (prefix: string) => {
      const match = parts.find((p) => p.toLowerCase().startsWith(prefix.toLowerCase()));
      if (!match) return "—";
      const colonIdx = match.indexOf(":");
      return colonIdx !== -1 ? match.slice(colonIdx + 1).trim() || "—" : match.trim();
    };

    return {
      index: idx + 1,
      type: getVal("Type"),
      supplier: getVal("Supplier"),
      grade: getVal("Grade"),
      color: getVal("Color"),
      caliper: getVal("Caliper"),
      qty: getVal("Qty"),
      unit: getVal("Unit"),
      remark: getVal("Remark"),
    };
  });
}
