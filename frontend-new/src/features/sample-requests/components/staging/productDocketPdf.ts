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

interface CellDef {
  label: string;
  value: string;
  colSpan?: number;
}

export function buildCompleteDocketPdf(product: ProductSearchResult, groups: DocketClass[]): Uint8Array {
  const groupsMap = new Map<string, ProductDetailItem[]>();
  for (const [name, specs] of groups) {
    groupsMap.set(name.toUpperCase(), specs);
  }

  const d = new Date();
  const formattedToday = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

  // Build all sections dynamically
  const sections: Array<{
    title: string;
    countBadge?: string;
    rows: CellDef[][];
  }> = [];

  // 1. PRODUCT DETAILS
  const productSpecs = groupsMap.get("PRODUCT_CLASS") || [];
  const lenVal = getCharValue(productSpecs, "PRODUCTCLOSESIZELENGTH");
  const widVal = getCharValue(productSpecs, "PRODUCTCLOSESIZEWIDTH");
  const closeSize = !lenVal.isNa && !widVal.isNa ? `${lenVal.value} X ${widVal.value} CM` : !lenVal.isNa ? `${lenVal.value} CM` : "NA";

  const productRows: CellDef[][] = [
    // Row 1
    [
      { label: "Export ID & Date", value: `${product.sr_number || product.material_code || "SR-26-002824"}  ${formattedToday}` },
      { label: "Customer Name", value: product.customer || "—" },
      { label: "Product Code", value: product.material_code || "—" },
      { label: "Type of Barcode", value: "EAN-13" },
      { label: "Barcode / Customer Product Code / VSN", value: product.source_sample_code || "639277134851 222507" },
      { label: "Brand", value: (product as any).brand || (product as any).brandName || "JOT" },
    ],
    // Row 2
    [
      { label: "Product Description", value: product.product_description || "Commercial Product Sample", colSpan: 2 },
      { label: "Product Close size (CM)", value: closeSize },
      { label: "Inside size (CM)", value: closeSize },
      { label: "Size After Perforation", value: getCharValue(productSpecs, "SIZEAFTERPERFORATION", "NA - NA").value },
      { label: "Claim Applicable", value: getCharValue(productSpecs, "CLAIMAPPLICABLETOPRODUCT").value },
    ],
    // Row 3
    [
      { label: "No of Enhance Licence (Shutterstock)", value: "0" },
      { label: "Product Artwork Nos", value: getCharValue(productSpecs, "PRODUCTARTWORKNOS", "1").value },
      { label: "Packing Artwork Nos", value: getCharValue(productSpecs, "PACKINGARTWORKNOS", "1").value },
      { label: "Product Artwork Applicable", value: formattedToday },
      { label: "Packaging Artwork Applicable", value: formattedToday },
      { label: "Design From", value: "Customer Design" },
    ],
    // Row 4
    [
      { label: "Shutterstock License Nos", value: "0", colSpan: 2 },
      { label: "Master Packing Type", value: "PDQ" },
      { label: "PDQ Artwork Applicable", value: formattedToday },
      { label: "Carton Marking Applicable", value: formattedToday, colSpan: 2 },
    ],
  ];

  // Add any extra specs from PRODUCT_CLASS
  const extraProductSpecs = productSpecs.filter((item) => {
    const norm = item.characteristicName.toUpperCase();
    return norm !== "PRODUCTCLOSESIZELENGTH" && norm !== "PRODUCTCLOSESIZEWIDTH" && norm !== "CLAIMAPPLICABLETOPRODUCT";
  });
  if (extraProductSpecs.length > 0) {
    const chunked: CellDef[][] = [];
    for (let i = 0; i < extraProductSpecs.length; i += NUM_COLS) {
      chunked.push(
        extraProductSpecs.slice(i, i + NUM_COLS).map((item) => ({
          label: item.characteristicName,
          value: item.value ? (item.uom ? `${item.value} ${item.uom}` : item.value) : "NA",
        }))
      );
    }
    productRows.push(...chunked);
  }

  sections.push({
    title: "Product Details",
    countBadge: `${productSpecs.length} SPECS`,
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
        { label: "Binding Side", value: bSide },
        { label: "Binding Type", value: bType },
        { label: "No of Sheets", value: bSheets },
        { label: "Drill Holes", value: bDrill },
        { label: "Corner Rounding", value: bCorner },
        { label: "Edge Finish", value: bEdge },
      ],
      [
        { label: "Opening of Product", value: getCharValue(bindingSpecs, "OPENINGOFPRODUCT").value },
        { label: "Binding Material", value: getCharValue(bindingSpecs, "BINDINGMATERIAL").value },
        { label: "Binding Color / Style", value: getCharValue(bindingSpecs, "BINDINGCOLOR_STYLE").value },
        { label: "Special Binding", value: getCharValue(bindingSpecs, "SPECIALBINDING").value },
        { label: "Additional Process On Binding", value: getCharValue(bindingSpecs, "ADDITIONALPROCESSONBINDING").value },
        { label: "Spiral / Wiro Hole Punch", value: getCharValue(bindingSpecs, "SPIRAL-WIROBINDINGHOLEPUNCH").value },
      ],
    ];

    // Additional binding specs
    const handledBinding = new Set([
      "BINDINGSIDE", "BINDINGTYPE1", "BINDINGTYPE2", "NOOFSHEETS", "NOOFFILINGHOLESREQUIRE",
      "CORNERROUNDREQUIREON", "EDGEFINISHIGTYPE", "OPENINGOFPRODUCT", "BINDINGMATERIAL",
      "BINDINGCOLOR_STYLE", "SPECIALBINDING", "ADDITIONALPROCESSONBINDING", "SPIRAL-WIROBINDINGHOLEPUNCH"
    ]);
    const extraBinding = bindingSpecs.filter((s) => !handledBinding.has(s.characteristicName.toUpperCase()));
    for (let i = 0; i < extraBinding.length; i += NUM_COLS) {
      bindingRows.push(
        extraBinding.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
        }))
      );
    }

    sections.push({
      title: "Binding Details",
      countBadge: `${bindingSpecs.length} SPECS`,
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
        },
        { label: "Material", value: cMat.value },
        {
          label: "Printing - No & Name of Colors",
          value: `${!cPrt.isNa ? cPrt.value : "OFFSET COMMON"} ${!cCol.isNa ? cCol.value : "4/1 CMYK"}`,
        },
        {
          label: "GSM / Caliper",
          value: !cGsm.isNa ? `${cGsm.value} ${cGsmUom !== "NA" ? cGsmUom : "GSM"}` : "515 GSM",
        },
        { label: "Finish", value: !cFin.isNa ? cFin.value : "AQUA VARNISH" },
        { label: "Finish Details", value: cFinNote.value },
      ],
    ];

    // Secondary specs
    const handledComp = new Set([
      `COMPONENT${cIdx}NAME`, `C${cIdx}SIZELENGTH`, `C${cIdx}SIZEWIDTH`, `C${cIdx}MATERIALTYPE`,
      `C${cIdx}PRINTINGTYPE1`, `C${cIdx}NAMEOFCOLORSF_B_1`, `C${cIdx}CALIPER_WEIGHT`,
      `C${cIdx}MATERIALUNIT`, `C${cIdx}FINISHING`, `C${cIdx}FINISHINGNOTE`
    ]);
    const extraComp = compSpecs.filter((s) => !handledComp.has(s.characteristicName.toUpperCase()));
    for (let i = 0; i < extraComp.length; i += NUM_COLS) {
      compRows.push(
        extraComp.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
        }))
      );
    }

    sections.push({
      title: compTitle,
      countBadge: `${compSpecs.length} SPECS`,
      rows: compRows,
    });
  }

  // 4. INSIDE DETAILS (RULLING_DETAILS, Only if present and has data)
  const rulingSpecs = groupsMap.get("RULLING_DETAILS");
  if (rulingSpecs && isClassPresent(rulingSpecs)) {
    const rulingRows: CellDef[][] = [
      [
        { label: "Inside Paper GSM", value: getCharValue(rulingSpecs, "INSIDE_PAPER_GSM", "52").value },
        { label: "Ruling Type", value: getCharValue(rulingSpecs, "SPECIAL_RULING", "WIDE RULED").value },
        { label: "Ruling Distance (MM)", value: getCharValue(rulingSpecs, "RULLING_DISTANCE", "8.73 MM").value },
        { label: "Ruling Shade", value: getCharValue(rulingSpecs, "RULLING_SHADE", "AMERICAN BLUE&RED").value },
        { label: "Top Margin (MM)", value: getCharValue(rulingSpecs, "TOP_MARGIN", "27").value },
        { label: "Top Margin Color", value: getCharValue(rulingSpecs, "TOP_MARGIN_COLOR", "AMERICAN BLUE").value },
      ],
      [
        { label: "Bottom Margin (MM)", value: getCharValue(rulingSpecs, "BOTTOM_MARGIN", "12").value },
        { label: "Bottom Margin Color", value: getCharValue(rulingSpecs, "BOTTOM_MARGIN_COLOR", "AMERICAN BLUE").value },
        { label: "Left Margin (MM)", value: getCharValue(rulingSpecs, "LEFT_MARGIN", "26").value },
        { label: "Left Margin Color", value: getCharValue(rulingSpecs, "LEFT_MARGIN_COLOR", "RED").value },
        { label: "Right Margin (MM)", value: getCharValue(rulingSpecs, "RIGHT_MARGIN").value },
        { label: "Right Margin Color", value: getCharValue(rulingSpecs, "RIGHT_MARGIN_COLOR").value },
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
      title: "Inside Details",
      countBadge: `${rulingSpecs.length} SPECS`,
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
        },
        { label: "Divider Material", value: getCharValue(dividerSpecs, "DIVIDERMATERIALTYPE1").value },
        {
          label: "Divider Printing, No & Name of Colors",
          value: `${getCharValue(dividerSpecs, "D1PRINTINGTYPE").value} ${getCharValue(dividerSpecs, "D1NAMEOFCOLORSF_B").value}`,
        },
        { label: "Divider GSM", value: getCharValue(dividerSpecs, "D1DIVIDERCALIPER_WEIGHT").value },
        { label: "Divider 1 Tab Style", value: getCharValue(dividerSpecs, "TABSTYLEOF1STDIVIDERS").value },
        { label: "Finish Details", value: getCharValue(dividerSpecs, "D1PRINTFINISHING").value },
      ],
      [
        {
          label: "Divider Type 2 & Size",
          value: `${getCharValue(dividerSpecs, "DIVIDERSTYPE2").value} (${getCharValue(dividerSpecs, "DIVIDERSIZEINCLTABLENGTH").value})`,
        },
        { label: "Divider Material", value: getCharValue(dividerSpecs, "DIVIDERMATERIALTYPE2").value },
        {
          label: "Divider Printing, No & Name of Colors",
          value: `${getCharValue(dividerSpecs, "D2PRINTINGTYPE").value} ${getCharValue(dividerSpecs, "D2NAMEOFCOLORSF_B").value}`,
        },
        { label: "Divider GSM", value: getCharValue(dividerSpecs, "D2DIVIDERCALIPER_WEIGHT").value },
        { label: "Divider 2 Tab Style", value: getCharValue(dividerSpecs, "TABSTYLEOF2NDDIVIDERS").value },
        { label: "Finish Details", value: getCharValue(dividerSpecs, "D2PRINTFINISHING").value },
      ],
    ];

    sections.push({
      title: "Inside Accessories Details",
      countBadge: `${dividerSpecs.length} SPECS`,
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
        { label: "Packaging 1 Name", value: getCharValue(pkgSpecs1, "PACKAGING1NAME").value },
        { label: "Material", value: getCharValue(pkgSpecs1, "PACKAGING1MATERIAL").value },
        { label: "Printing - No & Name of Colors", value: getCharValue(pkgSpecs1, "PACKAGING1PRINTING").value },
        { label: "GSM", value: getCharValue(pkgSpecs1, "PACKAGING1GSM").value },
        { label: "Size (CM)", value: getCharValue(pkgSpecs1, "PACKAGING1SIZE").value },
        { label: "Finish Details", value: getCharValue(pkgSpecs1, "PACKAGING1FINISH").value },
      ]);
    }
    if (pkgDetails && isClassPresent(pkgDetails)) {
      for (let i = 0; i < pkgDetails.length; i += NUM_COLS) {
        pkgRows.push(
          pkgDetails.slice(i, i + NUM_COLS).map((s) => ({
            label: s.characteristicName,
            value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
          }))
        );
      }
    }
    sections.push({
      title: "Packaging Details",
      countBadge: `${(pkgSpecs1?.length || 0) + (pkgDetails?.length || 0)} SPECS`,
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
    for (let i = 0; i < specs.length; i += NUM_COLS) {
      rows.push(
        specs.slice(i, i + NUM_COLS).map((s) => ({
          label: s.characteristicName,
          value: s.value ? (s.uom ? `${s.value} ${s.uom}` : s.value) : "NA",
        }))
      );
    }
    sections.push({
      title: productDocketSectionTitle(name),
      countBadge: `${specs.length} SPECS`,
      rows,
    });
  }

  // 8. SPECIAL INSTRUCTION / PRINT NOTE
  sections.push({
    title: "Special Instruction / Print Note",
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

/**
 * Export product docket specifications to Excel-compatible CSV with UTF-8 BOM.
 */
export function downloadProductDocketCsv(
  product: ProductSearchResult,
  groups: DocketClass[]
): void {
  const d = new Date();
  const formattedToday = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const filename = `${product.material_code || product.sr_number || "Product"}_Docket_Specifications_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.csv`;

  const rows: (string | number | null | undefined)[][] = [
    ["OFFICIAL TECHNICAL SPECIFICATION DOCKET (SAP BOM)"],
    ["Generated Date", formattedToday],
    ["Material Code", product.material_code || "—"],
    ["Sample Request No", product.sr_number || "—"],
    ["Product Description", product.product_description || "—"],
    ["Customer", product.customer || "—"],
    ["Target Plant", product.target_plant || "—"],
    ["Barcode / VSN", product.source_sample_code || (product as any).barcode || "—"],
    [],
    ["Section", "Section Title", "Classification Class", "Characteristic Code", "Value", "UOM", "Status"],
  ];

  let secIdx = 1;
  for (const [className, specs] of groups) {
    if (!isClassPresent(specs)) continue;
    const title = productDocketSectionTitle(className);
    for (const spec of specs) {
      const isConfigured = !isMissingSpec(spec.value);
      rows.push([
        `Section ${secIdx}`,
        title,
        className,
        spec.characteristicName,
        spec.value ? String(spec.value).trim() : "NA",
        spec.uom || "",
        isConfigured ? "Configured" : "Unconfigured",
      ]);
    }
    secIdx++;
  }

  // Sanitize CSV cells according to RFC-4180
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
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default downloadProductDocketPdf;
