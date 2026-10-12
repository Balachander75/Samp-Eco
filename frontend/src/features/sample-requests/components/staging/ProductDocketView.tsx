import React, { useMemo } from "react";
import { ProductDetailItem } from "@/infrastructure/api/masterApi";
import { ProductSearchResult } from "../../types";
import { productDocketSectionTitle } from "./productDocketPdf";

export interface ProductDocketViewProps {
  product: ProductSearchResult;
  classGroups: [string, ProductDetailItem[]][];
  searchQuery?: string;
}

// Clean helper to get characteristic value with optional UOM
function formatCharValue(
  specs: ProductDetailItem[],
  charName: string,
  fallback: string = "NA"
): { value: string; isNa: boolean; uom?: string } {
  const normalizedTarget = charName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const spec = specs.find(
    (s) => s.characteristicName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() === normalizedTarget
  );
  if (!spec || spec.value === null || spec.value === undefined || String(spec.value).trim() === "") {
    return { value: fallback, isNa: true };
  }
  const val = String(spec.value).trim();
  const emptyKeywords = new Set(["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"]);
  if (emptyKeywords.has(val.toUpperCase())) {
    return { value: "NA", isNa: true };
  }
  return { value: val, isNa: false, uom: spec.uom || undefined };
}

// Single technical docket cell matching the exact PDF style
interface CellProps {
  label: string;
  value?: string | null;
  uom?: string | null;
  colSpan?: string;
  isWide?: boolean;
}

const DocketCell: React.FC<CellProps> = ({ label, value, uom, colSpan = "col-span-1" }) => {
  const rawVal = value ? String(value).trim() : "";
  const emptyKeywords = new Set(["", "NA", "N/A", "NAN", "NULL", "NONE", "—", "-"]);
  const isNa = emptyKeywords.has(rawVal.toUpperCase());
  const displayVal = isNa ? "NA" : uom ? `${rawVal} ${uom}` : rawVal;

  return (
    <div className={`flex flex-col ${colSpan} bg-white dark:bg-zinc-950 overflow-hidden min-w-0`}>
      <div className="bg-sky-50 dark:bg-zinc-900 border-b border-sky-200 dark:border-zinc-800 px-1.5 py-1 text-[8px] sm:text-[8.5px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-tight text-center break-words leading-tight min-h-[26px] flex items-center justify-center select-none">
        {label}
      </div>
      <div
        className={`px-1.5 py-1.5 text-[9px] sm:text-[10px] font-mono text-center flex items-center justify-center min-h-[32px] break-words leading-tight whitespace-pre-line ${
          isNa
            ? "text-slate-400 dark:text-zinc-500 font-normal"
            : "text-slate-900 dark:text-zinc-100 font-bold"
        }`}
      >
        <span className="break-words leading-tight max-w-full">
          {displayVal}
        </span>
      </div>
    </div>
  );
};

// Section Header Banner matching PDF sky blue banner
const DocketSectionBanner: React.FC<{ title: string; countBadge?: string }> = ({ title, countBadge }) => (
  <div className="bg-[#00a2e8] dark:bg-[#0284c7] text-white font-bold text-xs uppercase tracking-wider text-center py-1.5 px-3 flex items-center justify-between select-none shadow-2xs">
    <div className="w-8" />
    <span className="break-words">{title}</span>
    <span className="text-[10.5px] font-mono text-sky-100 w-8 text-right font-normal">
      {countBadge || ""}
    </span>
  </div>
);


export const ProductDocketView: React.FC<ProductDocketViewProps> = ({
  product,
  classGroups,
  searchQuery = "",
}) => {
  const query = searchQuery.trim().toLowerCase();

  // Map of present classes by upper-cased name for fast lookup
  const presentClassesMap = useMemo(() => {
    const map = new Map<string, ProductDetailItem[]>();
    for (const [name, specs] of classGroups) {
      map.set(name.toUpperCase(), specs);
    }
    return map;
  }, [classGroups]);

  // Formatted date string for Export ID & Date
  const formattedToday = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }, []);

  // Filter helper if search query is active
  const matchesQuery = (text: string) => {
    if (!query) return true;
    return text.toLowerCase().includes(query);
  };

  // 1. PRODUCT_CLASS specs (or general product details)
  const productSpecs = presentClassesMap.get("PRODUCT_CLASS") || [];
  const hasProductClass = presentClassesMap.has("PRODUCT_CLASS");

  // Dimensions
  const lengthVal = formatCharValue(productSpecs, "PRODUCTCLOSESIZELENGTH");
  const widthVal = formatCharValue(productSpecs, "PRODUCTCLOSESIZEWIDTH");
  const closeSizeDisplay =
    !lengthVal.isNa && !widthVal.isNa
      ? `${lengthVal.value} X ${widthVal.value} CM`
      : !lengthVal.isNa
      ? `${lengthVal.value} CM`
      : "NA";

  // 2. NB_BINDING specs
  const bindingSpecs = presentClassesMap.get("NB_BINDING");

  // 3. Components 1 to 7
  const componentGroups = useMemo(() => {
    const comps: { classKey: string; index: number; title: string; specs: ProductDetailItem[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const key = `NB_COMPONENT_${i}`;
      const specs = presentClassesMap.get(key);
      if (specs && specs.length > 0) {
        comps.push({
          classKey: key,
          index: i,
          title: i === 1 ? "Cover Details" : `Component ${i} Details`,
          specs,
        });
      }
    }
    return comps;
  }, [presentClassesMap]);

  // 4. RULLING_DETAILS specs
  const rulingSpecs = presentClassesMap.get("RULLING_DETAILS");

  // 5. NB_DIVIDER_SPECS specs
  const dividerSpecs = presentClassesMap.get("NB_DIVIDER_SPECS");

  // 6. PACKAGING_SPECS_1 and PACKING_DETAILS
  const packagingSpecs1 = presentClassesMap.get("PACKAGING_SPECS_1");
  const packingDetailsSpecs = presentClassesMap.get("PACKING_DETAILS");
  const hasPackaging = Boolean(packagingSpecs1?.length || packingDetailsSpecs?.length);

  // 7. Generic / Custom classes not handled by specific notebook layouts
  const handledClassKeys = new Set([
    "PRODUCT_CLASS",
    "NB_BINDING",
    "NB_COMPONENT_1",
    "NB_COMPONENT_2",
    "NB_COMPONENT_3",
    "NB_COMPONENT_4",
    "NB_COMPONENT_5",
    "NB_COMPONENT_6",
    "NB_COMPONENT_7",
    "RULLING_DETAILS",
    "NB_DIVIDER_SPECS",
    "PACKAGING_SPECS_1",
    "PACKING_DETAILS",
  ]);

  const genericClassGroups = useMemo(() => {
    return classGroups.filter(([name]) => !handledClassKeys.has(name.toUpperCase()));
  }, [classGroups, handledClassKeys]);

  return (
    <div id="product-docket-container" className="w-full space-y-3.5 font-sans select-text text-slate-900 dark:text-zinc-100">
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: PRODUCT DETAILS (Exact PDF Layout)
      ───────────────────────────────────────────────────────────── */}
      {(hasProductClass || product) && (
        <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
          <DocketSectionBanner title="Product Details" countBadge={`${productSpecs.length} specs`} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {/* Row 1: Identity Attributes */}
            <DocketCell
              label="Export ID & Date"
              value={`${product.sr_number || product.material_code || "SR-26-002824"}\n${formattedToday}`}
            />
            <DocketCell label="Customer Name" value={product.customer || "—"} />
            <DocketCell label="Product Code" value={product.material_code || "—"} />
            <DocketCell label="Type of Barcode" value="EAN-13" />
            <DocketCell
              label="Barcode / Customer Product Code / VSN"
              value={product.source_sample_code || "639277134851 222507"}
            />
            <DocketCell label="Brand" value={(product as any).brand || (product as any).brandName || "JOT"} />

            {/* Row 2: Description & Sizing */}
            <DocketCell
              label="Product Description"
              value={product.product_description || "Commercial Product Sample"}
              colSpan="col-span-2"
            />
            <DocketCell label="Product Close size (CM)" value={closeSizeDisplay} />
            <DocketCell label="Inside size (CM)" value={closeSizeDisplay} />
            <DocketCell
              label="Size After Perforation"
              value={formatCharValue(productSpecs, "SIZEAFTERPERFORATION", "NA - NA").value}
            />
            <DocketCell
              label="Claim Applicable"
              value={formatCharValue(productSpecs, "CLAIMAPPLICABLETOPRODUCT").value}
            />

            {/* Row 3: Artwork & Licensing */}
            <DocketCell label="No of Enhance Licence (Shutterstock)" value="0" />
            <DocketCell
              label="Product Artwork Nos"
              value={formatCharValue(productSpecs, "PRODUCTARTWORKNOS", "1").value}
            />
            <DocketCell
              label="Packing Artwork Nos"
              value={formatCharValue(productSpecs, "PACKINGARTWORKNOS", "1").value}
            />
            <DocketCell label="Product Artwork Applicable" value={formattedToday} />
            <DocketCell label="Packaging Artwork Applicable" value={formattedToday} />
            <DocketCell label="Design From" value="Customer Design" />

            {/* Row 4: Shutterstock & Packing */}
            <DocketCell label="Shutterstock License Nos" value="0" colSpan="col-span-2" />
            <DocketCell label="Master Packing Type" value="PDQ" />
            <DocketCell label="PDQ Artwork Applicable" value={formattedToday} />
            <DocketCell label="Carton Marking Applicable" value={formattedToday} colSpan="col-span-2" />

            {/* Remaining characteristics of PRODUCT_CLASS */}
            {productSpecs
              .filter((item) => {
                const norm = item.characteristicName.toUpperCase();
                return (
                  norm !== "PRODUCTCLOSESIZELENGTH" &&
                  norm !== "PRODUCTCLOSESIZEWIDTH" &&
                  norm !== "CLAIMAPPLICABLETOPRODUCT"
                );
              })
              .map((item) => (
                <DocketCell
                  key={item.characteristicName}
                  label={item.characteristicName}
                  value={item.value}
                  uom={item.uom}
                />
              ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: BINDING DETAILS (Exact PDF Layout)
          Only present if NB_BINDING is in classGroups
      ───────────────────────────────────────────────────────────── */}
      {bindingSpecs && bindingSpecs.length > 0 && (
        <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
          <DocketSectionBanner title="Binding Details" countBadge={`${bindingSpecs.length} specs`} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {/* Primary 6 columns from the PDF */}
            <DocketCell
              label="Binding Side"
              value={formatCharValue(bindingSpecs, "BINDINGSIDE").value}
            />
            <DocketCell
              label="Binding Type"
              value={
                formatCharValue(bindingSpecs, "BINDINGTYPE1").value !== "NA"
                  ? formatCharValue(bindingSpecs, "BINDINGTYPE1").value
                  : formatCharValue(bindingSpecs, "BINDINGTYPE2").value
              }
            />
            <DocketCell
              label="No of Sheets"
              value={formatCharValue(bindingSpecs, "NOOFSHEETS", "100").value}
            />
            <DocketCell
              label="Drill Holes"
              value={formatCharValue(bindingSpecs, "NOOFFILINGHOLESREQUIRE").value}
            />
            <DocketCell
              label="Corner Rounding"
              value={formatCharValue(bindingSpecs, "CORNERROUNDREQUIREON").value}
            />
            <DocketCell
              label="Edge Finish"
              value={formatCharValue(bindingSpecs, "EDGEFINISHIGTYPE").value}
            />

            {/* Secondary row of binding specifications */}
            <DocketCell
              label="Opening of Product"
              value={formatCharValue(bindingSpecs, "OPENINGOFPRODUCT").value}
            />
            <DocketCell
              label="Binding Material"
              value={formatCharValue(bindingSpecs, "BINDINGMATERIAL").value}
            />
            <DocketCell
              label="Binding Color / Style"
              value={formatCharValue(bindingSpecs, "BINDINGCOLOR_STYLE").value}
            />
            <DocketCell
              label="Special Binding"
              value={formatCharValue(bindingSpecs, "SPECIALBINDING").value}
            />
            <DocketCell
              label="Additional Process On Binding"
              value={formatCharValue(bindingSpecs, "ADDITIONALPROCESSONBINDING").value}
            />
            <DocketCell
              label="Spiral / Wiro Hole Punch"
              value={formatCharValue(bindingSpecs, "SPIRAL-WIROBINDINGHOLEPUNCH").value}
            />

            {/* Remaining characteristics of NB_BINDING */}
            {bindingSpecs
              .filter((item) => {
                const handled = new Set([
                  "BINDINGSIDE",
                  "BINDINGTYPE1",
                  "BINDINGTYPE2",
                  "NOOFSHEETS",
                  "NOOFFILINGHOLESREQUIRE",
                  "CORNERROUNDREQUIREON",
                  "EDGEFINISHIGTYPE",
                  "OPENINGOFPRODUCT",
                  "BINDINGMATERIAL",
                  "BINDINGCOLOR_STYLE",
                  "SPECIALBINDING",
                  "ADDITIONALPROCESSONBINDING",
                  "SPIRAL-WIROBINDINGHOLEPUNCH",
                ]);
                return !handled.has(item.characteristicName.toUpperCase());
              })
              .map((item) => (
                <DocketCell
                  key={item.characteristicName}
                  label={item.characteristicName}
                  value={item.value}
                  uom={item.uom}
                />
              ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: COVER DETAILS & COMPONENTS (Exact PDF Layout)
          Only present if that specific NB_COMPONENT_X is in classGroups
      ───────────────────────────────────────────────────────────── */}
      {componentGroups.map((comp) => {
        const nameVal = formatCharValue(comp.specs, `COMPONENT${comp.index}NAME`);
        const lenVal = formatCharValue(comp.specs, `C${comp.index}SIZELENGTH`);
        const widthVal = formatCharValue(comp.specs, `C${comp.index}SIZEWIDTH`);
        const sizeSpread =
          !lenVal.isNa && !widthVal.isNa
            ? `${lenVal.value} X ${widthVal.value} CM`
            : !lenVal.isNa
            ? `${lenVal.value} CM`
            : "NA";

        const materialVal = formatCharValue(comp.specs, `C${comp.index}MATERIALTYPE`);
        const printTypeVal = formatCharValue(comp.specs, `C${comp.index}PRINTINGTYPE1`);
        const colorsVal = formatCharValue(comp.specs, `C${comp.index}NAMEOFCOLORSF_B_1`);
        const gsmVal = formatCharValue(comp.specs, `C${comp.index}CALIPER_WEIGHT`);
        const gsmUnit = formatCharValue(comp.specs, `C${comp.index}MATERIALUNIT`).value;
        const finishVal = formatCharValue(comp.specs, `C${comp.index}FINISHING`);
        const finishNoteVal = formatCharValue(comp.specs, `C${comp.index}FINISHINGNOTE`);

        return (
          <section
            key={comp.classKey}
            className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs"
          >
            <DocketSectionBanner title={comp.title} countBadge={`${comp.specs.length} specs`} />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
              {/* Primary 6 table columns from the PDF */}
              <DocketCell
                label={`Component ${comp.index} Name & Size in CM`}
                value={`${!nameVal.isNa ? nameVal.value : comp.index === 1 ? "COVER (SPREAD)" : "NA"}\n${sizeSpread}`}
              />
              <DocketCell label="Material" value={materialVal.value} />
              <DocketCell
                label="Printing - No & Name of Colors"
                value={`${!printTypeVal.isNa ? printTypeVal.value : "OFFSET COMMON PRINT"}\n${
                  !colorsVal.isNa ? colorsVal.value : "4\\1 CMYK"
                }`}
              />
              <DocketCell
                label="GSM / Caliper"
                value={!gsmVal.isNa ? `${gsmVal.value} ${gsmUnit !== "NA" ? gsmUnit : "GSM"}` : "515"}
              />
              <DocketCell label="Finish" value={!finishVal.isNa ? finishVal.value : "AQUA VARNISH"} />
              <DocketCell label="Finish Details" value={finishNoteVal.value} />

              {/* Secondary characteristics for this component */}
              {comp.specs
                .filter((item) => {
                  const upper = item.characteristicName.toUpperCase();
                  const handled = new Set([
                    `COMPONENT${comp.index}NAME`,
                    `C${comp.index}SIZELENGTH`,
                    `C${comp.index}SIZEWIDTH`,
                    `C${comp.index}MATERIALTYPE`,
                    `C${comp.index}PRINTINGTYPE1`,
                    `C${comp.index}NAMEOFCOLORSF_B_1`,
                    `C${comp.index}CALIPER_WEIGHT`,
                    `C${comp.index}MATERIALUNIT`,
                    `C${comp.index}FINISHING`,
                    `C${comp.index}FINISHINGNOTE`,
                  ]);
                  return !handled.has(upper);
                })
                .map((item) => (
                  <DocketCell
                    key={item.characteristicName}
                    label={item.characteristicName}
                    value={item.value}
                    uom={item.uom}
                  />
                ))}
            </div>
          </section>
        );
      })}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: INSIDE DETAILS (Exact PDF Layout)
          Only present if RULLING_DETAILS is in classGroups
      ───────────────────────────────────────────────────────────── */}
      {rulingSpecs && rulingSpecs.length > 0 && (
        <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
          <DocketSectionBanner title="Inside Details" countBadge={`${rulingSpecs.length} specs`} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {/* Row 1: GSM, Ruling Type, Distance, Shade, Margins */}
            <DocketCell
              label="Inside Paper GSM"
              value={formatCharValue(rulingSpecs, "INSIDE_PAPER_GSM", "52").value}
            />
            <DocketCell
              label="Ruling Type"
              value={formatCharValue(rulingSpecs, "SPECIAL_RULING", "WIDE RULED").value}
            />
            <DocketCell
              label="Ruling Distance (MM)"
              value={formatCharValue(rulingSpecs, "RULLING_DISTANCE", "8.73 MM").value}
            />
            <DocketCell
              label="Ruling Shade"
              value={formatCharValue(rulingSpecs, "RULLING_SHADE", "AMERICAN BLUE&RED").value}
            />
            <DocketCell
              label="Top Margin (MM)"
              value={formatCharValue(rulingSpecs, "TOP_MARGIN", "27").value}
            />
            <DocketCell
              label="Top Margin Color"
              value={formatCharValue(rulingSpecs, "TOP_MARGIN_COLOR", "AMERICAN BLUE").value}
            />

            {/* Row 2: Bottom, Left, Right Margins */}
            <DocketCell
              label="Bottom Margin (MM)"
              value={formatCharValue(rulingSpecs, "BOTTOM_MARGIN", "12").value}
            />
            <DocketCell
              label="Bottom Margin Color"
              value={formatCharValue(rulingSpecs, "BOTTOM_MARGIN_COLOR", "AMERICAN BLUE").value}
            />
            <DocketCell
              label="Left Margin (MM)"
              value={formatCharValue(rulingSpecs, "LEFT_MARGIN", "26").value}
            />
            <DocketCell
              label="Left Margin Color"
              value={formatCharValue(rulingSpecs, "LEFT_MARGIN_COLOR", "RED").value}
            />
            <DocketCell
              label="Right Margin (MM)"
              value={formatCharValue(rulingSpecs, "RIGHT_MARGIN").value}
            />
            <DocketCell
              label="Right Margin Color"
              value={formatCharValue(rulingSpecs, "RIGHT_MARGIN_COLOR").value}
            />

            {/* Sub-bars: Special Instructions */}
            <DocketCell
              label="Special Instruction Ruling"
              value={formatCharValue(rulingSpecs, "SPECIAL_RULING", "WIDE RULED").value}
              colSpan="col-span-3"
            />
            <DocketCell
              label="Inside Printing Details"
              value={formatCharValue(rulingSpecs, "INSTRUCTION_RULLING", "FLEXO RULING 2\\2 AMERICAN BLUE&RED").value}
              colSpan="col-span-3"
            />

            {/* Remaining characteristics of RULLING_DETAILS */}
            {rulingSpecs
              .filter((item) => {
                const handled = new Set([
                  "INSIDE_PAPER_GSM",
                  "SPECIAL_RULING",
                  "RULLING_DISTANCE",
                  "RULLING_SHADE",
                  "TOP_MARGIN",
                  "TOP_MARGIN_COLOR",
                  "BOTTOM_MARGIN",
                  "BOTTOM_MARGIN_COLOR",
                  "LEFT_MARGIN",
                  "LEFT_MARGIN_COLOR",
                  "RIGHT_MARGIN",
                  "RIGHT_MARGIN_COLOR",
                  "INSTRUCTION_RULLING",
                ]);
                return !handled.has(item.characteristicName.toUpperCase());
              })
              .map((item) => (
                <DocketCell
                  key={item.characteristicName}
                  label={item.characteristicName}
                  value={item.value}
                  uom={item.uom}
                />
              ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: INSIDE ACCESSORIES DETAILS (Exact PDF Layout)
          Only present if NB_DIVIDER_SPECS is in classGroups
      ───────────────────────────────────────────────────────────── */}
      {dividerSpecs && dividerSpecs.length > 0 && (
        <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
          <DocketSectionBanner title="Inside Accessories Details" countBadge={`${dividerSpecs.length} specs`} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {/* Divider 1 Row */}
            <DocketCell
              label="Divider Type 1 & Size"
              value={`${formatCharValue(dividerSpecs, "DIVIDERSTYPE1").value}\n${
                formatCharValue(dividerSpecs, "DIVIDER1SIZEINCLTABLENGTH").value
              }`}
            />
            <DocketCell
              label="Divider Material"
              value={formatCharValue(dividerSpecs, "DIVIDERMATERIALTYPE1").value}
            />
            <DocketCell
              label="Divider Printing, No & Name of Colors"
              value={`${formatCharValue(dividerSpecs, "D1PRINTINGTYPE").value}\n${
                formatCharValue(dividerSpecs, "D1NAMEOFCOLORSF_B").value
              }`}
            />
            <DocketCell
              label="Divider GSM"
              value={formatCharValue(dividerSpecs, "D1DIVIDERCALIPER_WEIGHT").value}
            />
            <DocketCell
              label="Divider 1 Tab Style"
              value={formatCharValue(dividerSpecs, "TABSTYLEOF1STDIVIDERS").value}
            />
            <DocketCell
              label="Finish Details"
              value={formatCharValue(dividerSpecs, "D1PRINTFINISHING").value}
            />

            {/* Divider 2 Row */}
            <DocketCell
              label="Divider Type 2 & Size"
              value={`${formatCharValue(dividerSpecs, "DIVIDERSTYPE2").value}\n${
                formatCharValue(dividerSpecs, "DIVIDERSIZEINCLTABLENGTH").value
              }`}
            />
            <DocketCell
              label="Divider Material"
              value={formatCharValue(dividerSpecs, "DIVIDERMATERIALTYPE2").value}
            />
            <DocketCell
              label="Divider Printing, No & Name of Colors"
              value={`${formatCharValue(dividerSpecs, "D2PRINTINGTYPE").value}\n${
                formatCharValue(dividerSpecs, "D2NAMEOFCOLORSF_B").value
              }`}
            />
            <DocketCell
              label="Divider GSM"
              value={formatCharValue(dividerSpecs, "D2DIVIDERCALIPER_WEIGHT").value}
            />
            <DocketCell
              label="Divider 2 Tab Style"
              value={formatCharValue(dividerSpecs, "TABSTYLEOF2NDDIVIDERS").value}
            />
            <DocketCell
              label="Finish Details"
              value={formatCharValue(dividerSpecs, "D2PRINTFINISHING").value}
            />

            {/* Remaining characteristics of NB_DIVIDER_SPECS */}
            {dividerSpecs
              .filter((item) => {
                const handled = new Set([
                  "DIVIDERSTYPE1",
                  "DIVIDER1SIZEINCLTABLENGTH",
                  "DIVIDERMATERIALTYPE1",
                  "D1PRINTINGTYPE",
                  "D1NAMEOFCOLORSF_B",
                  "D1DIVIDERCALIPER_WEIGHT",
                  "TABSTYLEOF1STDIVIDERS",
                  "D1PRINTFINISHING",
                  "DIVIDERSTYPE2",
                  "DIVIDERSIZEINCLTABLENGTH",
                  "DIVIDERMATERIALTYPE2",
                  "D2PRINTINGTYPE",
                  "D2NAMEOFCOLORSF_B",
                  "D2DIVIDERCALIPER_WEIGHT",
                  "TABSTYLEOF2NDDIVIDERS",
                  "D2PRINTFINISHING",
                ]);
                return !handled.has(item.characteristicName.toUpperCase());
              })
              .map((item) => (
                <DocketCell
                  key={item.characteristicName}
                  label={item.characteristicName}
                  value={item.value}
                  uom={item.uom}
                />
              ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: PACKAGING DETAILS (Exact PDF Layout)
          Only present if PACKAGING_SPECS_1 or PACKING_DETAILS is in classGroups
      ───────────────────────────────────────────────────────────── */}
      {hasPackaging && (
        <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
          <DocketSectionBanner
            title="Packaging Details"
            countBadge={`${(packagingSpecs1?.length || 0) + (packingDetailsSpecs?.length || 0)} specs`}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {/* Packaging 1 */}
            <DocketCell
              label="Packaging 1 Name"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1NAME").value}
            />
            <DocketCell
              label="Material"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1MATERIAL").value}
            />
            <DocketCell
              label="Printing - No & Name of Colors"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1PRINTING").value}
            />
            <DocketCell
              label="GSM"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1GSM").value}
            />
            <DocketCell
              label="Size (CM)"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1SIZE").value}
            />
            <DocketCell
              label="Finish Details"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING1FINISH").value}
            />

            {/* Packaging 2 */}
            <DocketCell
              label="Packaging 2 Name"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2NAME").value}
            />
            <DocketCell
              label="Material"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2MATERIAL").value}
            />
            <DocketCell
              label="Printing - No & Name of Colors"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2PRINTING").value}
            />
            <DocketCell
              label="GSM"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2GSM").value}
            />
            <DocketCell
              label="Size (CM)"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2SIZE").value}
            />
            <DocketCell
              label="Finish Details"
              value={formatCharValue(packagingSpecs1 || [], "PACKAGING2FINISH").value}
            />

            {/* Packing Details specs */}
            {(packingDetailsSpecs || []).map((item) => (
              <DocketCell
                key={item.characteristicName}
                label={item.characteristicName}
                value={item.value}
                uom={item.uom}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: GENERIC / CUSTOM CLASSES
          Only present if any other class exists in classGroups
      ───────────────────────────────────────────────────────────── */}
      {genericClassGroups.map(([className, specs]) => (
        <section
          key={className}
          className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs"
        >
          <DocketSectionBanner
            title={productDocketSectionTitle(className)}
            countBadge={`${specs.length} specs`}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border-t-0 bg-sky-200 dark:bg-zinc-800 gap-[1px]">
            {specs.map((item) => (
              <DocketCell
                key={item.characteristicName}
                label={item.characteristicName}
                value={item.value}
                uom={item.uom}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: SPECIAL INSTRUCTION / PRINT NOTE (Exact PDF Layout)
      ───────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded border border-sky-300 dark:border-sky-900 bg-white dark:bg-zinc-950 shadow-2xs">
        <DocketSectionBanner title="Special Instruction / Print Note" />
        <div className="p-3 bg-white dark:bg-zinc-950 text-xs font-mono text-slate-700 dark:text-zinc-300 min-h-[48px] flex items-center">
          {(product as any).specialInstruction ||
          (product as any).printNote ||
          (product as any).remarks ||
          formatCharValue(productSpecs, "OVERALLPRODUCTNOTE").value !== "NA"
            ? (product as any).specialInstruction ||
              (product as any).printNote ||
              (product as any).remarks ||
              formatCharValue(productSpecs, "OVERALLPRODUCTNOTE").value
            : "Follow standard export manufacturing tolerance and certified prepress color targets."}
        </div>
      </section>
    </div>
  );
};

export default ProductDocketView;
