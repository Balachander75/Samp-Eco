import type { ProductDetailItem } from "@/infrastructure/api/masterApi";
import type { ProductSearchResult } from "../../types";

type DocketClass = [string, ProductDetailItem[]];

const PAGE_WIDTH = 842; // A4 Landscape / Wide Technical Sheet
const LEFT = 24;
const RIGHT = 24;
const USABLE_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const NUM_COLS = 6;
const COL_W = USABLE_WIDTH / NUM_COLS; // ~132.33 pt

export function productDocketSectionTitle(className: string): string {
  if (className === "PRODUCT_CLASS") return "Product Details";
  if (className === "NB_BINDING") return "Binding Details";
  if (className === "NB_COMPONENT_1") return "Cover Details";
  if (className.startsWith("NB_COMPONENT_")) return `Component ${className.substring("NB_COMPONENT_".length)} Details`;
  if (className === "NB_DIVIDER_SPECS") return "Inside Accessories Details";
  if (className === "PACKAGING_SPECS_1") return "Packaging Details";
  if (className === "PACKING_DETAILS") return "Packing Details";
  if (className === "RULLING_DETAILS") return "Inside Details";
  return className.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function isMissingSpec(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const str = String(value).trim().toUpperCase();
  return (
    str === "" ||
    str === "NA" ||
    str === "N/A" ||
    str === "NAN" ||
    str === "NULL" ||
    str === "NONE" ||
    str === "—" ||
    str === "-"
  );
}

export function isClassPresent(specs: ProductDetailItem[] | undefined | null): boolean {
  if (!specs || specs.length === 0) return false;
  return specs.some((s) => !isMissingSpec(s.value));
}

const pdfCharKeyCache = new Map<string, string>();
function getPdfNormalizedCharKey(name: string): string {
  let key = pdfCharKeyCache.get(name);
  if (!key) {
    key = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    pdfCharKeyCache.set(name, key);
  }
  return key;
}

const pdfSpecMapCache = new WeakMap<ProductDetailItem[], Map<string, ProductDetailItem>>();
function getPdfSpecLookupMap(specs: ProductDetailItem[]): Map<string, ProductDetailItem> {
  let map = pdfSpecMapCache.get(specs);
  if (!map) {
    map = new Map<string, ProductDetailItem>();
    for (let i = 0; i < specs.length; i++) {
      const item = specs[i];
      map.set(getPdfNormalizedCharKey(item.characteristicName), item);
    }
    pdfSpecMapCache.set(specs, map);
  }
  return map;
}

function getCharValue(
  specs: ProductDetailItem[],
  charName: string,
  fallback: string = "NA"
): { value: string; isNa: boolean; uom?: string } {
  if (!specs || specs.length === 0) return { value: fallback, isNa: true };
  const map = getPdfSpecLookupMap(specs);
  const spec = map.get(getPdfNormalizedCharKey(charName));
  if (!spec || isMissingSpec(spec.value)) {
    return { value: fallback, isNa: true };
  }
  const val = String(spec.value).trim();
  return { value: val, isNa: false, uom: spec.uom || undefined };
}

export interface CellDef {
  label: string;
  value: string;
  uom?: string;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface DocketSectionDef {
  id: string;
  title: string;
  sectionNumber: number | string;
  countBadge?: string;
  totalSpecs?: number;
  configuredSpecs?: number;
  rows: CellDef[][];
}

export function buildDocketSections(
  product: ProductSearchResult,
  groups: DocketClass[],
  onlyConfigured: boolean = false
): DocketSectionDef[] {
  const groupsMap = new Map<string, ProductDetailItem[]>();
  for (const [name, specs] of groups) {
    groupsMap.set(name.toUpperCase(), specs);
  }

  const d = new Date();
  const formattedToday = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  // Build all sections dynamically
  const sections: DocketSectionDef[] = [];
  let secNum = 1;

  // 1. PRODUCT DETAILS
  const productSpecs = groupsMap.get("PRODUCT_CLASS") || [];
  const lenVal = getCharValue(productSpecs, "PRODUCTCLOSESIZELENGTH");
  const widVal = getCharValue(productSpecs, "PRODUCTCLOSESIZEWIDTH");
  const closeSize = !lenVal.isNa && !widVal.isNa ? `${lenVal.value} X ${widVal.value} CM` : !lenVal.isNa ? `${lenVal.value} CM` : "NA";

  const productRows: CellDef[][] = [
    // Row 1
    [
      { label: "Export ID & Date", value: `${product.sr_number || product.material_code || "SR-26-002824"}  ${formattedToday}`, colSpan: 1 },
      { label: "Customer Name", value: product.customer || "—", colSpan: 1 },
      { label: "Product Code", value: product.material_code || "—", colSpan: 1 },
      { label: "Type of Barcode", value: "EAN-13", colSpan: 1 },
      { label: "Barcode / Customer Product Code / VSN", value: product.source_sample_code || (product as any).barcode || (product as any).vsn || "—", colSpan: 1 },
      { label: "Brand", value: (product as any).brand || (product as any).brandName || "—", colSpan: 1 },
    ],
    // Row 2
    [
      { label: "Product Description", value: product.product_description || "Commercial Product Sample", colSpan: 2 },
      { label: "Product Close size (CM)", value: closeSize, colSpan: 1 },
      { label: "Inside size (CM)", value: closeSize, colSpan: 1 },
      { label: "Size After Perforation", value: getCharValue(productSpecs, "SIZEAFTERPERFORATION", "NA - NA").value, colSpan: 1 },
      { label: "Claim Applicable", value: getCharValue(productSpecs, "CLAIMAPPLICABLETOPRODUCT").value, colSpan: 1 },
    ],
    // Row 3
    [
      { label: "No of Enhance Licence (Shutterstock)", value: "0", colSpan: 1 },
      { label: "Product Artwork Nos", value: getCharValue(productSpecs, "PRODUCTARTWORKNOS", "1").value, colSpan: 1 },
      { label: "Packing Artwork Nos", value: getCharValue(productSpecs, "PACKINGARTWORKNOS", "1").value, colSpan: 1 },
      { label: "Product Artwork Applicable", value: formattedToday, colSpan: 1 },
      { label: "Packaging Artwork Applicable", value: formattedToday, colSpan: 1 },
      { label: "Design From", value: "Customer Design", colSpan: 1 },
    ],
    // Row 4
    [
      { label: "Shutterstock License Nos", value: "0", colSpan: 2 },
      { label: "Master Packing Type", value: "PDQ", colSpan: 1 },
      { label: "PDQ Artwork Applicable", value: formattedToday, colSpan: 1 },
      { label: "Carton Marking Applicable", value: formattedToday, colSpan: 2 },
    ],
  ];

  // Add any extra specs from PRODUCT_CLASS
  const extraProductSpecs = productSpecs.filter((item) => {
    const norm = item.characteristicName.toUpperCase();
    return norm !== "PRODUCTCLOSESIZELENGTH" && norm !== "PRODUCTCLOSESIZEWIDTH" && norm !== "CLAIMAPPLICABLETOPRODUCT";
  });
  const filteredExtraProduct = onlyConfigured
    ? extraProductSpecs.filter((s) => !isMissingSpec(s.value))
    : extraProductSpecs;
  if (filteredExtraProduct.length > 0) {
    for (let i = 0; i < filteredExtraProduct.length; i += NUM_COLS) {
      productRows.push(
        filteredExtraProduct.slice(i, i + NUM_COLS).map((item) => ({
          label: item.characteristicName,
          value: item.value ? (item.uom ? `${item.value} ${item.uom}` : item.value) : "NA",
          uom: item.uom || undefined,
          colSpan: 1,
        }))
      );
    }
  }

  sections.push({
    id: "product",
    sectionNumber: secNum++,
    title: "Product Details",
    countBadge: `${productSpecs.length} SPECS`,
    totalSpecs: productSpecs.length,
    configuredSpecs: productSpecs.filter((s) => !isMissingSpec(s.value)).length,
    rows: productRows,
  });

  // 2. BINDING DETAILS (Only if NB_BINDING is present and has data)
  const bindingSpecs = groupsMap.get("NB_BINDING");
  if (bindingSpecs && isClassPresent(bindingSpecs)) {
    const bSide = getCharValue(bindingSpecs, "BINDINGSIDE").value;
    const bType1 = getCharValue(bindingSpecs, "BINDINGTYPE1").value;
    const bType2 = getCharValue(bindingSpecs, "BINDINGTYPE2").value;
    const bType = bType1 !== "NA" ? bType1 : bType2;
    const bSheets = getCharValue(bindingSpecs, "NOOFSHEETS", "100").value;
    const bDrill = getCharValue(bindingSpecs, "NOOFFILINGHOLESREQUIRE").value;
    const bCorner = getCharValue(bindingSpecs, "CORNERROUNDREQUIREON").value;
    const bEdge = getCharValue(bindingSpecs, "EDGEFINISHIGTYPE").value;

    const bindingRows: CellDef[][] = [
      [
        { label: "Binding Side", value: bSide, colSpan: 1 },
        { label: "Binding Type", value: bType, colSpan: 1 },
        { label: "No of Sheets", value: bSheets, colSpan: 1 },
        { label: "Drill Holes", value: bDrill, colSpan: 1 },
        { label: "Corner Rounding", value: bCorner, colSpan: 1 },
        { label: "Edge Finish", value: bEdge, colSpan: 1 },
      ],
      [
        { label: "Opening of Product", value: getCharValue(bindingSpecs, "OPENINGOFPRODUCT").value, colSpan: 1 },
        { label: "Binding Material", value: getCharValue(bindingSpecs, "BINDINGMATERIAL").value, colSpan: 1 },
        { label: "Binding Color / Style", value: getCharValue(bindingSpecs, "BINDINGCOLOR_STYLE").value, colSpan: 1 },
        { label: "Special Binding", value: getCharValue(bindingSpecs, "SPECIALBINDING").value, colSpan: 1 },
        { label: "Additional Process On Binding", value: getCharValue(bindingSpecs, "ADDITIONALPROCESSONBINDING").value, colSpan: 1 },
        { label: "Spiral / Wiro Hole Punch", value: getCharValue(bindingSpecs, "SPIRAL-WIROBINDINGHOLEPUNCH").value, colSpan: 1 },
      ],
    ];

    // Additional binding specs
    const handledBinding = new Set([
      "BINDINGSIDE", "BINDINGTYPE1", "BINDINGTYPE2", "NOOFSHEETS", "NOOFFILINGHOLESREQUIRE",
      "CORNERROUNDREQUIREON", "EDGEFINISHIGTYPE", "OPENINGOFPRODUCT", "BINDINGMATERIAL",
      "BINDINGCOLOR_STYLE", "SPECIALBINDING", "ADDITIONALPROCESSONBINDING", "SPIRAL-WIROBINDINGHOLEPUNCH"
    ]);
    const extraBinding = bindingSpecs.filter((s) => !handledBinding.has(s.characteristicName.toUpperCase()));
    const filteredExtraBinding = onlyConfigured
      ? extraBinding.filter((s) => !isMissingSpec(s.value))
      : extraBinding;
    for (let i = 0; i < filteredExtraBinding.length; i += NUM_COLS) {
      bindingRows.push(
        filteredExtraBinding.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
          uom: s.uom || undefined,
          colSpan: 1,
        }))
      );
    }

    sections.push({
      id: "binding",
      sectionNumber: secNum++,
      title: "Binding Details",
      countBadge: `${bindingSpecs.length} SPECS`,
      totalSpecs: bindingSpecs.length,
      configuredSpecs: bindingSpecs.filter((s) => !isMissingSpec(s.value)).length,
      rows: bindingRows,
    });
  }

  // 3. COMPONENTS 1 TO 7 (Only if component class is present and has data)
  for (let cIdx = 1; cIdx <= 7; cIdx++) {
    const cKey = `NB_COMPONENT_${cIdx}`;
    const compSpecs = groupsMap.get(cKey);
    if (!compSpecs || !isClassPresent(compSpecs)) continue;

    const cName = getCharValue(compSpecs, `COMPONENT${cIdx}NAME`);
    const compTitle =
      !cName.isNa && cName.value !== "NA"
        ? cName.value.toUpperCase().includes("COVER")
          ? "Cover Details"
          : cName.value
        : cIdx === 1
        ? "Cover Details"
        : `Component ${cIdx} Details`;
    const cLen = getCharValue(compSpecs, `C${cIdx}SIZELENGTH`);
    const cWid = getCharValue(compSpecs, `C${cIdx}SIZEWIDTH`);
    const sizeStr = !cLen.isNa && !cWid.isNa ? `${cLen.value} X ${cWid.value} CM` : !cLen.isNa ? `${cLen.value} CM` : "NA";
    const cMat = getCharValue(compSpecs, `C${cIdx}MATERIALTYPE`);
    const cPrt = getCharValue(compSpecs, `C${cIdx}PRINTINGTYPE1`);
    const cCol = getCharValue(compSpecs, `C${cIdx}NAMEOFCOLORSF_B_1`);
    const cGsm = getCharValue(compSpecs, `C${cIdx}CALIPER_WEIGHT`);
    const cGsmUom = getCharValue(compSpecs, `C${cIdx}MATERIALUNIT`).value;
    const cFin = getCharValue(compSpecs, `C${cIdx}FINISHING`);
    const cFinNote = getCharValue(compSpecs, `C${cIdx}FINISHINGNOTE`);

    const compRows: CellDef[][] = [
      [
        {
          label: `Component ${cIdx} Name & Size in CM`,
          value: `${!cName.isNa ? cName.value : cIdx === 1 ? "COVER (SPREAD)" : "NA"} (${sizeStr})`,
          colSpan: 1,
        },
        { label: "Material", value: cMat.value, colSpan: 1 },
        {
          label: "Printing - No & Name of Colors",
          value: `${!cPrt.isNa ? cPrt.value : "OFFSET COMMON"} ${!cCol.isNa ? cCol.value : "4/1 CMYK"}`,
          colSpan: 1,
        },
        {
          label: "GSM / Caliper",
          value: !cGsm.isNa ? `${cGsm.value} ${cGsmUom !== "NA" ? cGsmUom : "GSM"}` : "515 GSM",
          colSpan: 1,
        },
        { label: "Finish", value: !cFin.isNa ? cFin.value : "AQUA VARNISH", colSpan: 1 },
        { label: "Finish Details", value: cFinNote.value, colSpan: 1 },
      ],
    ];

    // Secondary specs
    const handledComp = new Set([
      `COMPONENT${cIdx}NAME`, `C${cIdx}SIZELENGTH`, `C${cIdx}SIZEWIDTH`, `C${cIdx}MATERIALTYPE`,
      `C${cIdx}PRINTINGTYPE1`, `C${cIdx}NAMEOFCOLORSF_B_1`, `C${cIdx}CALIPER_WEIGHT`,
      `C${cIdx}MATERIALUNIT`, `C${cIdx}FINISHING`, `C${cIdx}FINISHINGNOTE`
    ]);
    const extraComp = compSpecs.filter((s) => !handledComp.has(s.characteristicName.toUpperCase()));
    const filteredExtraComp = onlyConfigured
      ? extraComp.filter((s) => !isMissingSpec(s.value))
      : extraComp;
    for (let i = 0; i < filteredExtraComp.length; i += NUM_COLS) {
      compRows.push(
        filteredExtraComp.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
          uom: s.uom || undefined,
          colSpan: 1,
        }))
      );
    }

    sections.push({
      id: `comp-${cIdx}`,
      sectionNumber: secNum++,
      title: compTitle,
      countBadge: `${compSpecs.length} SPECS`,
      totalSpecs: compSpecs.length,
      configuredSpecs: compSpecs.filter((s) => !isMissingSpec(s.value)).length,
      rows: compRows,
    });
  }

  // 4. INSIDE DETAILS (RULLING_DETAILS, Only if present and has data)
  const rulingSpecs = groupsMap.get("RULLING_DETAILS");
  if (rulingSpecs && isClassPresent(rulingSpecs)) {
    const rulingRows: CellDef[][] = [
      [
        { label: "Inside Paper GSM", value: getCharValue(rulingSpecs, "INSIDE_PAPER_GSM", "52").value, colSpan: 1 },
        { label: "Ruling Type", value: getCharValue(rulingSpecs, "SPECIAL_RULING", "WIDE RULED").value, colSpan: 1 },
        { label: "Ruling Distance (MM)", value: getCharValue(rulingSpecs, "RULLING_DISTANCE", "8.73 MM").value, colSpan: 1 },
        { label: "Ruling Shade", value: getCharValue(rulingSpecs, "RULLING_SHADE", "AMERICAN BLUE&RED").value, colSpan: 1 },
        { label: "Top Margin (MM)", value: getCharValue(rulingSpecs, "TOP_MARGIN", "27").value, colSpan: 1 },
        { label: "Top Margin Color", value: getCharValue(rulingSpecs, "TOP_MARGIN_COLOR", "AMERICAN BLUE").value, colSpan: 1 },
      ],
      [
        { label: "Bottom Margin (MM)", value: getCharValue(rulingSpecs, "BOTTOM_MARGIN", "12").value, colSpan: 1 },
        { label: "Bottom Margin Color", value: getCharValue(rulingSpecs, "BOTTOM_MARGIN_COLOR", "AMERICAN BLUE").value, colSpan: 1 },
        { label: "Left Margin (MM)", value: getCharValue(rulingSpecs, "LEFT_MARGIN", "26").value, colSpan: 1 },
        { label: "Left Margin Color", value: getCharValue(rulingSpecs, "LEFT_MARGIN_COLOR", "RED").value, colSpan: 1 },
        { label: "Right Margin (MM)", value: getCharValue(rulingSpecs, "RIGHT_MARGIN").value, colSpan: 1 },
        { label: "Right Margin Color", value: getCharValue(rulingSpecs, "RIGHT_MARGIN_COLOR").value, colSpan: 1 },
      ],
      [
        {
          label: "Special Instruction Ruling",
          value: getCharValue(rulingSpecs, "SPECIAL_RULING", "WIDE RULED").value,
          colSpan: 3,
        },
        {
          label: "Inside Printing Details",
          value: getCharValue(rulingSpecs, "INSTRUCTION_RULLING", "FLEXO RULING 2/2 AMERICAN BLUE&RED").value,
          colSpan: 3,
        },
      ],
    ];

    sections.push({
      id: "ruling",
      sectionNumber: secNum++,
      title: "Inside Details",
      countBadge: `${rulingSpecs.length} SPECS`,
      totalSpecs: rulingSpecs.length,
      configuredSpecs: rulingSpecs.filter((s) => !isMissingSpec(s.value)).length,
      rows: rulingRows,
    });
  }

  // 5. INSIDE ACCESSORIES DETAILS (NB_DIVIDER_SPECS, Only if present and has data)
  const dividerSpecs = groupsMap.get("NB_DIVIDER_SPECS");
  if (dividerSpecs && isClassPresent(dividerSpecs)) {
    const dividerRows: CellDef[][] = [
      [
        {
          label: "Divider Type 1 & Size",
          value: `${getCharValue(dividerSpecs, "DIVIDERSTYPE1").value} (${getCharValue(dividerSpecs, "DIVIDER1SIZEINCLTABLENGTH").value})`,
          colSpan: 1,
        },
        { label: "Divider Material", value: getCharValue(dividerSpecs, "DIVIDERMATERIALTYPE1").value, colSpan: 1 },
        {
          label: "Divider Printing, No & Name of Colors",
          value: `${getCharValue(dividerSpecs, "D1PRINTINGTYPE").value} ${getCharValue(dividerSpecs, "D1NAMEOFCOLORSF_B").value}`,
          colSpan: 1,
        },
        { label: "Divider GSM", value: getCharValue(dividerSpecs, "D1DIVIDERCALIPER_WEIGHT").value, colSpan: 1 },
        { label: "Divider 1 Tab Style", value: getCharValue(dividerSpecs, "TABSTYLEOF1STDIVIDERS").value, colSpan: 1 },
        { label: "Finish Details", value: getCharValue(dividerSpecs, "D1PRINTFINISHING").value, colSpan: 1 },
      ],
      [
        {
          label: "Divider Type 2 & Size",
          value: `${getCharValue(dividerSpecs, "DIVIDERSTYPE2").value} (${getCharValue(dividerSpecs, "DIVIDERSIZEINCLTABLENGTH").value})`,
          colSpan: 1,
        },
        { label: "Divider Material", value: getCharValue(dividerSpecs, "DIVIDERMATERIALTYPE2").value, colSpan: 1 },
        {
          label: "Divider Printing, No & Name of Colors",
          value: `${getCharValue(dividerSpecs, "D2PRINTINGTYPE").value} ${getCharValue(dividerSpecs, "D2NAMEOFCOLORSF_B").value}`,
          colSpan: 1,
        },
        { label: "Divider GSM", value: getCharValue(dividerSpecs, "D2DIVIDERCALIPER_WEIGHT").value, colSpan: 1 },
        { label: "Divider 2 Tab Style", value: getCharValue(dividerSpecs, "TABSTYLEOF2NDDIVIDERS").value, colSpan: 1 },
        { label: "Finish Details", value: getCharValue(dividerSpecs, "D2PRINTFINISHING").value, colSpan: 1 },
      ],
    ];

    sections.push({
      id: "dividers",
      sectionNumber: secNum++,
      title: "Inside Accessories Details",
      countBadge: `${dividerSpecs.length} SPECS`,
      totalSpecs: dividerSpecs.length,
      configuredSpecs: dividerSpecs.filter((s) => !isMissingSpec(s.value)).length,
      rows: dividerRows,
    });
  }

  // 6. PACKAGING DETAILS (Only if present and has data)
  const pkgSpecs1 = groupsMap.get("PACKAGING_SPECS_1");
  const pkgDetails = groupsMap.get("PACKING_DETAILS");
  if ((pkgSpecs1 && isClassPresent(pkgSpecs1)) || (pkgDetails && isClassPresent(pkgDetails))) {
    const pkgRows: CellDef[][] = [];
    if (pkgSpecs1 && isClassPresent(pkgSpecs1)) {
      pkgRows.push([
        { label: "Packaging 1 Name", value: getCharValue(pkgSpecs1, "PACKAGING1NAME").value, colSpan: 1 },
        { label: "Material", value: getCharValue(pkgSpecs1, "PACKAGING1MATERIAL").value, colSpan: 1 },
        { label: "Printing - No & Name of Colors", value: getCharValue(pkgSpecs1, "PACKAGING1PRINTING").value, colSpan: 1 },
        { label: "GSM", value: getCharValue(pkgSpecs1, "PACKAGING1GSM").value, colSpan: 1 },
        { label: "Size (CM)", value: getCharValue(pkgSpecs1, "PACKAGING1SIZE").value, colSpan: 1 },
        { label: "Finish Details", value: getCharValue(pkgSpecs1, "PACKAGING1FINISH").value, colSpan: 1 },
      ]);
    }
    if (pkgDetails && isClassPresent(pkgDetails)) {
      const filteredPkg = onlyConfigured
        ? pkgDetails.filter((s) => !isMissingSpec(s.value))
        : pkgDetails;
      for (let i = 0; i < filteredPkg.length; i += NUM_COLS) {
        pkgRows.push(
          filteredPkg.slice(i, i + NUM_COLS).map((s) => ({
            label: s.characteristicName,
            value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
            uom: s.uom || undefined,
            colSpan: 1,
          }))
        );
      }
    }
    const totalPkgSpecs = (pkgSpecs1?.length || 0) + (pkgDetails?.length || 0);
    const configuredPkgSpecs =
      (pkgSpecs1 ? pkgSpecs1.filter((s) => !isMissingSpec(s.value)).length : 0) +
      (pkgDetails ? pkgDetails.filter((s) => !isMissingSpec(s.value)).length : 0);

    sections.push({
      id: "packaging",
      sectionNumber: secNum++,
      title: "Packaging Details",
      countBadge: `${totalPkgSpecs} SPECS`,
      totalSpecs: totalPkgSpecs,
      configuredSpecs: configuredPkgSpecs,
      rows: pkgRows,
    });
  }

  // 7. GENERIC / CUSTOM CLASSES (Only if present and has data)
  const handledKeys = new Set([
    "PRODUCT_CLASS", "NB_BINDING", "NB_COMPONENT_1", "NB_COMPONENT_2", "NB_COMPONENT_3",
    "NB_COMPONENT_4", "NB_COMPONENT_5", "NB_COMPONENT_6", "NB_COMPONENT_7",
    "RULLING_DETAILS", "NB_DIVIDER_SPECS", "PACKAGING_SPECS_1", "PACKING_DETAILS",
  ]);
  const otherGroups = groups
    .filter(([name]) => !handledKeys.has(name.toUpperCase()))
    .filter(([, specs]) => isClassPresent(specs));
  for (const [name, specs] of otherGroups) {
    const rows: CellDef[][] = [];
    const filteredSpecs = onlyConfigured
      ? specs.filter((s) => !isMissingSpec(s.value))
      : specs;
    for (let i = 0; i < filteredSpecs.length; i += NUM_COLS) {
      rows.push(
        filteredSpecs.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
          uom: s.uom || undefined,
          colSpan: 1,
        }))
      );
    }
    sections.push({
      id: `custom-${name}`,
      sectionNumber: secNum++,
      title: productDocketSectionTitle(name),
      countBadge: `${specs.length} SPECS`,
      totalSpecs: specs.length,
      configuredSpecs: specs.filter((s) => !isMissingSpec(s.value)).length,
      rows,
    });
  }

  // 8. SPECIAL INSTRUCTION / PRINT NOTE
  sections.push({
    id: "notes",
    sectionNumber: secNum++,
    title: "Special Instruction / Print Note",
    countBadge: "1 SPEC",
    totalSpecs: 1,
    configuredSpecs: 1,
    rows: [
      [
        {
          label: "Manufacturing & Prepress Standards",
          value:
            (product as any).specialInstruction ||
            (product as any).printNote ||
            (product as any).remarks ||
            "Follow standard export manufacturing tolerance and certified prepress color targets.",
          colSpan: 6,
        },
      ],
    ],
  });

  return sections;
}

export function buildCompleteDocketPdf(product: ProductSearchResult, groups: DocketClass[]): Uint8Array {
  const sections = buildDocketSections(product, groups, false);

  // Calculate dynamic page height so 100% of the docket fits without any clipping
  const BANNER_H = 15;
  const ROW_H = 24;
  const GAP_S = 6;
  let totalContentHeight = 24; // Top margin
  for (const sec of sections) {
    totalContentHeight += BANNER_H + sec.rows.length * ROW_H + GAP_S;
  }
  const pageHeight = Math.max(1190, Math.ceil(totalContentHeight + 40));

  // Render vector PDF commands
  const commands: string[] = [];
  const drawText = (
    text: string,
    x: number,
    y: number,
    size: number,
    font = "F1",
    color = "0.15 0.19 0.24"
  ) => {
    commands.push(
      `BT /${font} ${size.toFixed(1)} Tf ${color} rg 1 0 0 1 ${x.toFixed(1)} ${(pageHeight - y).toFixed(1)} Tm (${pdfText(text)}) Tj ET`
    );
  };

  let curY = 24;

  for (const sec of sections) {
    // 1. Draw Sky-Blue Banner (#00a2e8)
    const bannerPdfY = pageHeight - curY - BANNER_H;
    commands.push(`0 0.635 0.91 rg ${LEFT.toFixed(1)} ${bannerPdfY.toFixed(1)} ${USABLE_WIDTH.toFixed(1)} ${BANNER_H.toFixed(1)} re f`);
    commands.push(`0 0.55 0.82 RG 0.5 w ${LEFT.toFixed(1)} ${bannerPdfY.toFixed(1)} ${USABLE_WIDTH.toFixed(1)} ${BANNER_H.toFixed(1)} re S`);

    // Banner Text
    const titleText = sec.title.toUpperCase();
    const titleX = LEFT + USABLE_WIDTH / 2 - (titleText.length * 2.2);
    drawText(titleText, Math.max(LEFT + 6, titleX), curY + 10.5, 7.2, "F2", "1 1 1");
    if (sec.countBadge) {
      drawText(sec.countBadge, LEFT + USABLE_WIDTH - 55, curY + 10, 5.5, "F1", "0.85 0.95 1.0");
    }

    curY += BANNER_H;

    // 2. Draw Rows
    for (const row of sec.rows) {
      let curX = LEFT;
      for (const cell of row) {
        const span = cell.colSpan || 1;
        const cellW = COL_W * span;
        const labelH = 10.5;
        const valH = 13.5;
        const cellH = labelH + valH;

        const labelPdfY = pageHeight - curY - labelH;
        const valPdfY = pageHeight - curY - cellH;

        // Label background (light sky #f0f9ff)
        commands.push(`0.92 0.96 0.99 rg ${curX.toFixed(1)} ${labelPdfY.toFixed(1)} ${cellW.toFixed(1)} ${labelH.toFixed(1)} re f`);
        // Value background (white)
        commands.push(`1 1 1 rg ${curX.toFixed(1)} ${valPdfY.toFixed(1)} ${cellW.toFixed(1)} ${valH.toFixed(1)} re f`);

        // Cell borders
        commands.push(`0.74 0.88 0.98 RG 0.4 w ${curX.toFixed(1)} ${valPdfY.toFixed(1)} ${cellW.toFixed(1)} ${cellH.toFixed(1)} re S`);
        commands.push(`0.74 0.88 0.98 RG 0.4 w ${curX.toFixed(1)} ${labelPdfY.toFixed(1)} ${cellW.toFixed(1)} 0 re S`);

        // Draw Label (Compact 5.2 pt)
        const lblClean = cell.label.toUpperCase();
        drawText(lblClean.length > 32 && span === 1 ? lblClean.slice(0, 31) : lblClean, curX + 3.5, curY + 7.5, 5.2, "F2", "0.22 0.28 0.35");

        // Draw Value (Compact 6.0 pt)
        const isNa = cell.value === "NA" || cell.value === "—";
        const valColor = isNa ? "0.55 0.60 0.68" : "0.08 0.12 0.18";
        const valFont = isNa ? "F1" : "F2";
        const valClean = cell.value.length > 40 && span === 1 ? cell.value.slice(0, 39) : cell.value;
        drawText(valClean, curX + 3.5, curY + labelH + 9.5, 6.0, valFont, valColor);

        curX += cellW;
      }
      curY += ROW_H;
    }

    curY += GAP_S;
  }

  // Construct PDF binary object stream
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

/** Directly downloads the 100% complete technical docket PDF generated for this product */
export async function downloadProductDocketPdf(product: ProductSearchResult, groups: DocketClass[]): Promise<void> {
  const bytes = buildCompleteDocketPdf(product, groups);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(product.material_code || product.sr_number || "product-docket").replace(/[^a-z0-9_-]/gi, "-")}-docket.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Opens high-fidelity print / Save-as-PDF dialog for the entire docket */
export function printProductDocketView(product: ProductSearchResult, elementId: string = "product-docket-container"): void {
  const element = document.getElementById(elementId);
  const title = `${product.material_code || product.sr_number || "Product"}_Docket_Technical_Sheet`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const contentHtml = element ? element.outerHTML : "<div>No docket content available</div>";

  const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("\n");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          @page {
            size: A4 landscape;
            margin: 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 4mm;
            background: #ffffff;
            color: #0f172a;
          }
          .docket-print-root {
            width: 100%;
          }
          header input, header button, .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div class="docket-print-root">
          ${contentHtml}
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

function escapeHtml(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Export product docket specifications to Excel-ready spreadsheet (.xls / .csv)
 * mirroring the exact UI Docket structure (Cyan banners, sky-blue cell labels, white values, 6-col grid).
 */
export function downloadProductDocketCsv(
  product: ProductSearchResult,
  groups: DocketClass[],
  format: "excel" | "csv" = "excel"
): void {
  const d = new Date();
  const formattedToday = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const dateSuffix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const baseFilename = `${product.material_code || product.sr_number || "Product"}_Docket_Specifications_${dateSuffix}`;

  const sections = buildDocketSections(product, groups, false);

  if (format === "csv") {
    // Pure CSV format structured according to Docket UI sections
    const rows: (string | number | null | undefined)[][] = [
      ["OFFICIAL TECHNICAL SPECIFICATION DOCKET (SAP BOM)"],
      ["Material Code", product.material_code || "—", "SR Number", product.sr_number || "—", "Generated Date", formattedToday],
      ["Product Description", product.product_description || "—", "Customer", product.customer || "—", "Target Plant", product.target_plant || "—"],
      [],
    ];

    for (const sec of sections) {
      rows.push([`SEC ${sec.sectionNumber}: ${sec.title.toUpperCase()}`]);
      for (const row of sec.rows) {
        const labelRow: string[] = [];
        const valueRow: string[] = [];
        for (const cell of row) {
          const span = cell.colSpan || 1;
          labelRow.push(cell.label);
          for (let s = 1; s < span; s++) labelRow.push("");
          const isNa = isMissingSpec(cell.value) || cell.value === "NA" || cell.value === "—" || !cell.value;
          const valStr = isNa ? "—" : cell.uom ? `${cell.value} ${cell.uom}` : String(cell.value);
          valueRow.push(valStr);
          for (let s = 1; s < span; s++) valueRow.push("");
        }
        rows.push(labelRow);
        rows.push(valueRow);
      }
      rows.push([]);
    }

    const csvContent = rows
      .map((row) =>
        row
          .map((val) => {
            if (val === null || val === undefined) return '""';
            const str = String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${baseFilename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Primary: Excel-ready HTML spreadsheet (.xls) with exact UI styling matching PDF / UI
  let tableHtml = `
    <!-- Top Docket Header -->
    <tr>
      <th colspan="6" class="header-banner">
        OFFICIAL TECHNICAL SPECIFICATION DOCKET
      </th>
    </tr>
    <tr>
      <td class="meta-label">Material Code:</td>
      <td class="meta-val">${escapeHtml(product.material_code || "—")}</td>
      <td class="meta-label">Sample Request No:</td>
      <td class="meta-val">${escapeHtml(product.sr_number || "—")}</td>
      <td class="meta-label">Generated Date:</td>
      <td class="meta-val">${formattedToday}</td>
    </tr>
    <tr>
      <td class="meta-label">Product Description:</td>
      <td colspan="2" class="meta-val">${escapeHtml(product.product_description || "—")}</td>
      <td class="meta-label">Customer / Plant:</td>
      <td colspan="2" class="meta-val">${escapeHtml(product.customer || "—")} &nbsp;|&nbsp; Plant ${escapeHtml(product.target_plant || "—")}</td>
    </tr>
    <tr class="spacer-row"><td colspan="6"></td></tr>
  `;

  for (const sec of sections) {
    tableHtml += `
      <tr>
        <th colspan="6" class="sec-banner">
          SEC ${sec.sectionNumber}: ${escapeHtml(sec.title.toUpperCase())}
          ${sec.countBadge ? ` &nbsp; <span class="sec-badge">(${escapeHtml(sec.countBadge)})</span>` : ""}
        </th>
      </tr>
    `;

    for (const row of sec.rows) {
      const totalCols = row.reduce((acc, c) => acc + (c.colSpan || 1), 0);
      const remCols = 6 - (totalCols % 6 || 6);

      // Label row
      tableHtml += `<tr style="height: 28px;">`;
      for (const cell of row) {
        const span = cell.colSpan || 1;
        tableHtml += `<td colspan="${span}" class="docket-label">${escapeHtml(cell.label)}</td>`;
      }
      if (remCols > 0) {
        tableHtml += `<td colspan="${remCols}" class="docket-empty"></td>`;
      }
      tableHtml += `</tr>`;

      // Value row
      tableHtml += `<tr style="height: 32px;">`;
      for (const cell of row) {
        const span = cell.colSpan || 1;
        const isNa = isMissingSpec(cell.value) || cell.value === "NA" || cell.value === "—" || !cell.value;
        if (isNa) {
          tableHtml += `<td colspan="${span}" class="docket-value"><span class="docket-na">—</span></td>`;
        } else {
          const uomHtml = cell.uom ? ` <span class="docket-uom">${escapeHtml(cell.uom)}</span>` : "";
          tableHtml += `<td colspan="${span}" class="docket-value"><span>${escapeHtml(cell.value)}</span>${uomHtml}</td>`;
        }
      }
      if (remCols > 0) {
        tableHtml += `<td colspan="${remCols}" class="docket-empty"><span class="docket-na">—</span></td>`;
      }
      tableHtml += `</tr>`;
    }

    // Spacer row between sections
    tableHtml += `<tr class="spacer-row"><td colspan="6"></td></tr>`;
  }

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Docket Specifications</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
                <x:Print>
                  <x:ValidPrinterInfo/>
                  <x:Orientation>Landscape</x:Orientation>
                </x:Print>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorksheet>
      </xml>
      <![endif]-->
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <style>
        body, table {
          font-family: 'Segoe UI', Calibri, Arial, sans-serif;
          font-size: 10pt;
        }
        table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
        }
        .header-banner {
          background-color: #0f172a;
          color: #ffffff;
          font-size: 12pt;
          font-weight: bold;
          text-align: center;
          padding: 8px 12px;
          border: 1pt solid #0f172a;
        }
        .meta-label {
          background-color: #f1f5f9;
          color: #475569;
          font-size: 9pt;
          font-weight: bold;
          padding: 5px 8px;
          border: 1pt solid #cbd5e1;
        }
        .meta-val {
          background-color: #ffffff;
          color: #0f172a;
          font-size: 10pt;
          font-weight: bold;
          padding: 5px 8px;
          border: 1pt solid #cbd5e1;
        }
        .sec-banner {
          background-color: #00a2e8;
          color: #ffffff;
          font-size: 11pt;
          font-weight: bold;
          text-align: left;
          padding: 7px 10px;
          border: 1pt solid #0087c2;
          text-transform: uppercase;
        }
        .sec-badge {
          font-size: 8.5pt;
          font-weight: normal;
          color: #e0f2fe;
        }
        .docket-label {
          background-color: #f0f9ff;
          color: #384759;
          font-size: 8.5pt;
          font-weight: bold;
          text-transform: uppercase;
          padding: 5px 8px;
          border: 1pt solid #bde0fa;
          vertical-align: middle;
          word-break: break-word;
        }
        .docket-value {
          background-color: #ffffff;
          color: #141f2e;
          font-family: 'Consolas', 'Segoe UI', monospace;
          font-size: 9.5pt;
          font-weight: bold;
          padding: 6px 8px;
          border: 1pt solid #bde0fa;
          vertical-align: middle;
          word-break: break-word;
        }
        .docket-empty {
          background-color: #f8fafc;
          border: 1pt solid #bde0fa;
          text-align: center;
          color: #cbd5e1;
        }
        .docket-na {
          color: #94a3b8;
          font-style: italic;
          font-weight: normal;
        }
        .docket-uom {
          font-size: 8pt;
          color: #64748b;
          font-weight: normal;
          font-family: 'Segoe UI', Arial, sans-serif;
          margin-left: 3px;
        }
        .spacer-row td {
          border: none !important;
          background-color: #ffffff !important;
          height: 10px;
        }
      </style>
    </head>
    <body>
      <table>
        <colgroup>
          <col style="width: 16.666%;">
          <col style="width: 16.666%;">
          <col style="width: 16.666%;">
          <col style="width: 16.666%;">
          <col style="width: 16.666%;">
          <col style="width: 16.666%;">
        </colgroup>
        <tbody>
          ${tableHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(["\uFEFF" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${baseFilename}.xls`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default downloadProductDocketPdf;
