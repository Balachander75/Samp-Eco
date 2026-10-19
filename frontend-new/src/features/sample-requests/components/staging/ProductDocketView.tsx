import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Layers,
  FileText,
  AlignLeft,
  Bookmark,
  Package,
  Info,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers3,
  Calendar,
  Building2,
  Hash,
  Factory,
  Download,
  Printer,
} from "lucide-react";
import { ProductDetailItem } from "@/infrastructure/api/masterApi";
import { ProductSearchResult } from "../../types";
import {
  productDocketSectionTitle,
  downloadProductDocketPdf,
  downloadProductDocketCsv,
  printProductDocketView,
} from "./productDocketPdf";

export interface ProductDocketViewProps {
  product: ProductSearchResult;
  classGroups: [string, ProductDetailItem[]][];
  searchQuery?: string;
  containerId?: string;
}

// Clean helper to check if a specification value is empty / unconfigured
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
  if (!spec || isMissingSpec(spec.value)) {
    return { value: fallback, isNa: true };
  }
  const val = String(spec.value).trim();
  return { value: val, isNa: false, uom: spec.uom || undefined };
}

// Single technical docket cell definition
export interface DocketCellDef {
  label: string;
  value?: string | null;
  uom?: string | null;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6;
}

interface CellProps {
  cell: DocketCellDef;
  searchFilter?: string;
}

// Helper to map colSpan (1..6) to Tailwind column classes in a strict 6-column grid
function getColSpanClass(colSpan: number = 1): string {
  switch (colSpan) {
    case 6:
      return "col-span-6";
    case 5:
      return "col-span-5";
    case 4:
      return "col-span-4";
    case 3:
      return "col-span-3";
    case 2:
      return "col-span-2";
    case 1:
    default:
      return "col-span-1";
  }
}

// Laser-straight, aligned Docket Cell component
const DocketCell: React.FC<CellProps> = ({ cell, searchFilter }) => {
  const { label, value, uom, colSpan = 1 } = cell;
  const rawVal = value ? String(value).trim() : "";
  const isNa = isMissingSpec(rawVal);
  const displayVal = isNa ? "—" : rawVal;

  const matchesSearch = useMemo(() => {
    if (!searchFilter || searchFilter.trim() === "") return false;
    const q = searchFilter.trim().toLowerCase();
    return label.toLowerCase().includes(q) || displayVal.toLowerCase().includes(q);
  }, [searchFilter, label, displayVal]);

  const colClass = getColSpanClass(colSpan);

  return (
    <div
      className={`flex flex-col ${colClass} bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 last:border-r-0 min-w-0 transition-colors ${
        matchesSearch
          ? "ring-2 ring-amber-400 bg-amber-50/90 dark:bg-amber-950/50 z-10"
          : "hover:bg-sky-50/30 dark:hover:bg-zinc-900/40"
      }`}
    >
      {/* Precision Header Bar of Cell */}
      <div
        className="px-2.5 py-1.5 bg-slate-50/90 dark:bg-zinc-900/90 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between min-h-[30px] select-none"
        title={label}
      >
        <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider truncate text-left w-full">
          {label}
        </span>
      </div>

      {/* Structured Value Container */}
      <div className="px-2.5 py-2 flex-1 flex flex-col justify-center text-left min-h-[42px]">
        {isNa ? (
          <span className="text-xs font-mono text-slate-300 dark:text-zinc-600 italic select-none">
            —
          </span>
        ) : (
          <div className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 break-words leading-snug">
            <span>{displayVal}</span>
            {uom && (
              <span className="ml-1 text-[10px] font-sans font-medium text-slate-500 dark:text-zinc-400 uppercase">
                {uom}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Subtle placeholder cell to balance rows that have fewer than 6 columns
const DocketEmptyCell: React.FC<{ colSpan?: number }> = ({ colSpan = 1 }) => {
  const colClass = getColSpanClass(colSpan);
  return (
    <div
      className={`${colClass} bg-slate-50/30 dark:bg-zinc-950/40 border-r border-slate-200 dark:border-zinc-800 last:border-r-0 flex flex-col justify-center items-center select-none min-h-[72px]`}
    >
      <span className="text-slate-200 dark:text-zinc-800 text-xs font-mono">—</span>
    </div>
  );
};

// Strict 6-column container row. All rows sum up to exactly 6 columns.
const DocketRow: React.FC<{
  cells: DocketCellDef[];
  searchFilter?: string;
}> = ({ cells, searchFilter }) => {
  const totalCols = cells.reduce((acc, c) => acc + (c.colSpan || 1), 0);
  const remainingCols = 6 - (totalCols % 6 || 6);

  return (
    <div className="grid grid-cols-6 border-b border-slate-200 dark:border-zinc-800 last:border-b-0 w-full">
      {cells.map((cell, idx) => (
        <DocketCell key={`${cell.label}-${idx}`} cell={cell} searchFilter={searchFilter} />
      ))}
      {remainingCols > 0 && <DocketEmptyCell colSpan={remainingCols} />}
    </div>
  );
};

// Section Header Banner with title, icon, spec count badge, and clean styling
const DocketSectionBanner: React.FC<{
  icon: React.ReactNode;
  sectionNumber: number | string;
  title: string;
  configuredCount?: number;
  totalCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}> = ({
  icon,
  sectionNumber,
  title,
  configuredCount,
  totalCount,
  isCollapsed,
  onToggleCollapse,
}) => (
  <div
    onClick={onToggleCollapse}
    className={`bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 dark:from-zinc-900 dark:via-zinc-850 dark:to-zinc-900 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 flex items-center justify-between select-none shadow-xs border-l-4 border-sky-400 ${
      onToggleCollapse ? "cursor-pointer hover:brightness-110 transition-all" : ""
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="text-sky-300 shrink-0">{icon}</span>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-900/60 border border-sky-400/40 text-sky-200">
        SEC {sectionNumber}
      </span>
      <span className="truncate text-xs font-bold text-slate-100">{title}</span>
    </div>

    <div className="flex items-center gap-2.5 shrink-0">
      {totalCount !== undefined && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono bg-slate-800/80 text-slate-200 px-2.5 py-0.5 rounded-full border border-slate-700">
          <span className="text-emerald-400 font-bold">{configuredCount ?? 0}</span>
          <span className="text-slate-500">/</span>
          <span>{totalCount} Specs</span>
        </div>
      )}
      {onToggleCollapse && (
        <button
          type="button"
          aria-label={isCollapsed ? "Expand section" : "Collapse section"}
          className="text-slate-400 hover:text-white p-0.5 rounded transition"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
);

// Helper to chunk remaining characteristics into strictly aligned rows of 6
function chunkIntoStrict6Cols(
  specs: ProductDetailItem[],
  onlyConfigured: boolean
): DocketCellDef[][] {
  const visible = onlyConfigured
    ? specs.filter((s) => !isMissingSpec(s.value))
    : specs;

  if (visible.length === 0) return [];

  const rows: DocketCellDef[][] = [];
  const chunkSize = 6;

  for (let i = 0; i < visible.length; i += chunkSize) {
    const chunk = visible.slice(i, i + chunkSize);
    rows.push(
      chunk.map((item) => ({
        label: item.characteristicName,
        value: item.value,
        uom: item.uom,
        colSpan: 1,
      }))
    );
  }

  return rows;
}

export const ProductDocketView: React.FC<ProductDocketViewProps> = ({
  product,
  classGroups,
  searchQuery: externalSearchQuery = "",
  containerId = "product-docket-container",
}) => {
  const [internalSearch, setInternalSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "configured">("all");
  const [activeSection, setActiveSection] = useState<string>("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const effectiveSearch = externalSearchQuery || internalSearch;

  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

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

  // 1. PRODUCT_CLASS specs
  const productSpecs = presentClassesMap.get("PRODUCT_CLASS") || [];
  const hasProductClass = Boolean(presentClassesMap.has("PRODUCT_CLASS") || product);

  const lengthVal = formatCharValue(productSpecs, "PRODUCTCLOSESIZELENGTH");
  const widthVal = formatCharValue(productSpecs, "PRODUCTCLOSESIZEWIDTH");
  const closeSizeDisplay =
    !lengthVal.isNa && !widthVal.isNa
      ? `${lengthVal.value} X ${widthVal.value} CM`
      : !lengthVal.isNa
      ? `${lengthVal.value} CM`
      : "NA";

  const handledProductSpecs = new Set([
    "PRODUCTCLOSESIZELENGTH",
    "PRODUCTCLOSESIZEWIDTH",
    "CLAIMAPPLICABLETOPRODUCT",
    "FSCEUTR_REQUIREMENT",
    "PERCENTAGE_TYPE",
    "SIZEAFTERPERFORATION",
    "PRODUCTARTWORKNOS",
    "PACKINGARTWORKNOS",
    "OVERALLPRODUCTNOTE",
    "PRODUCTDESCRIPTION",
    "CUSTOMERNAME",
    "PRODUCTCODE",
    "BRAND",
  ]);

  const remainingProductSpecs = useMemo(() => {
    return productSpecs.filter(
      (item) => !handledProductSpecs.has(item.characteristicName.toUpperCase())
    );
  }, [productSpecs, handledProductSpecs]);

  // 2. NB_BINDING specs (Only present if at least one characteristic has data)
  const bindingSpecs = presentClassesMap.get("NB_BINDING") || [];
  const hasBinding = isClassPresent(bindingSpecs);

  const handledBindingSpecs = new Set([
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
    "SHEETGATHERINGSTYLE",
  ]);

  const remainingBindingSpecs = useMemo(() => {
    return bindingSpecs.filter(
      (item) => !handledBindingSpecs.has(item.characteristicName.toUpperCase())
    );
  }, [bindingSpecs, handledBindingSpecs]);

  // 3. Components 1 to 7 (Only present if at least one characteristic in that component has data)
  const componentGroups = useMemo(() => {
    const comps: { classKey: string; index: number; title: string; specs: ProductDetailItem[] }[] = [];
    for (let i = 1; i <= 7; i++) {
      const key = `NB_COMPONENT_${i}`;
      const specs = presentClassesMap.get(key);
      if (specs && isClassPresent(specs)) {
        const nameVal = formatCharValue(specs, `COMPONENT${i}NAME`);
        const title =
          !nameVal.isNa && nameVal.value !== "NA"
            ? nameVal.value
            : i === 1
            ? "Cover Details (Spread)"
            : `Component ${i}: Inner Text Block`;
        comps.push({
          classKey: key,
          index: i,
          title,
          specs,
        });
      }
    }
    return comps;
  }, [presentClassesMap]);

  // 4. RULLING_DETAILS specs (Only present if at least one characteristic has data)
  const rulingSpecs = presentClassesMap.get("RULLING_DETAILS") || [];
  const hasRuling = isClassPresent(rulingSpecs);

  const handledRulingSpecs = new Set([
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

  const remainingRulingSpecs = useMemo(() => {
    return rulingSpecs.filter(
      (item) => !handledRulingSpecs.has(item.characteristicName.toUpperCase())
    );
  }, [rulingSpecs, handledRulingSpecs]);

  // 5. NB_DIVIDER_SPECS specs (Only present if at least one characteristic has data)
  const dividerSpecs = presentClassesMap.get("NB_DIVIDER_SPECS") || [];
  const hasDividers = isClassPresent(dividerSpecs);

  const handledDividerSpecs = new Set([
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

  const remainingDividerSpecs = useMemo(() => {
    return dividerSpecs.filter(
      (item) => !handledDividerSpecs.has(item.characteristicName.toUpperCase())
    );
  }, [dividerSpecs, handledDividerSpecs]);

  // 6. PACKAGING_SPECS_1 and PACKING_DETAILS (Only present if at least one characteristic has data)
  const packagingSpecs1 = presentClassesMap.get("PACKAGING_SPECS_1") || [];
  const packingDetailsSpecs = presentClassesMap.get("PACKING_DETAILS") || [];
  const hasPackaging = isClassPresent(packagingSpecs1) || isClassPresent(packingDetailsSpecs);

  const handledPackagingKeys = new Set([
    "PACKAGING1NAME",
    "PACKAGING1MATERIAL",
    "PACKAGING1PRINTING",
    "PACKAGING1GSM",
    "PACKAGING1SIZE",
    "PACKAGING1FINISH",
    "PACKAGING2NAME",
    "PACKAGING2MATERIAL",
    "PACKAGING2PRINTING",
    "PACKAGING2GSM",
    "PACKAGING2SIZE",
    "PACKAGING2FINISH",
  ]);

  const remainingPackagingSpecs = useMemo(() => {
    return packagingSpecs1.filter(
      (item) => !handledPackagingKeys.has(item.characteristicName.toUpperCase())
    );
  }, [packagingSpecs1, handledPackagingKeys]);

  // 7. Generic / Custom classes (Only present if at least one characteristic has data)
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
    return classGroups
      .filter(([name]) => !handledClassKeys.has(name.toUpperCase()))
      .filter(([, specs]) => isClassPresent(specs));
  }, [classGroups, handledClassKeys]);

  // Collect all specifications belonging ONLY to classes present in this product
  const allPresentClasses = useMemo(() => {
    const list: [string, ProductDetailItem[]][] = [];
    if (hasProductClass && productSpecs.length > 0) {
      list.push(["PRODUCT_CLASS", productSpecs]);
    }
    if (hasBinding) list.push(["NB_BINDING", bindingSpecs]);
    for (const comp of componentGroups) {
      list.push([comp.classKey, comp.specs]);
    }
    if (hasRuling) list.push(["RULLING_DETAILS", rulingSpecs]);
    if (hasDividers) list.push(["NB_DIVIDER_SPECS", dividerSpecs]);
    if (isClassPresent(packagingSpecs1)) list.push(["PACKAGING_SPECS_1", packagingSpecs1]);
    if (isClassPresent(packingDetailsSpecs)) list.push(["PACKING_DETAILS", packingDetailsSpecs]);
    for (const g of genericClassGroups) {
      list.push(g);
    }
    return list;
  }, [
    hasProductClass,
    productSpecs,
    hasBinding,
    bindingSpecs,
    componentGroups,
    hasRuling,
    rulingSpecs,
    hasDividers,
    dividerSpecs,
    packagingSpecs1,
    packingDetailsSpecs,
    genericClassGroups,
  ]);

  // Overall statistics based STRICTLY on classes present in this product
  const totalSpecsCount = useMemo(() => {
    return allPresentClasses.reduce((acc, [, specs]) => acc + specs.length, 0);
  }, [allPresentClasses]);

  const configuredSpecsCount = useMemo(() => {
    return allPresentClasses.reduce((acc, [, specs]) => {
      return acc + specs.filter((s) => !isMissingSpec(s.value)).length;
    }, 0);
  }, [allPresentClasses]);

  const completionPercentage = useMemo(() => {
    if (totalSpecsCount === 0) return 0;
    return Math.round((configuredSpecsCount / totalSpecsCount) * 100);
  }, [configuredSpecsCount, totalSpecsCount]);

  // Search matches count (searches across present classes)
  const searchMatchCount = useMemo(() => {
    if (!effectiveSearch || effectiveSearch.trim() === "") return 0;
    const q = effectiveSearch.trim().toLowerCase();
    let count = 0;
    for (const [, specs] of allPresentClasses) {
      for (const s of specs) {
        if (
          s.characteristicName.toLowerCase().includes(q) ||
          String(s.value ?? "").toLowerCase().includes(q)
        ) {
          count++;
        }
      }
    }
    return count;
  }, [allPresentClasses, effectiveSearch]);

  // Quick section jump tags (lists ONLY sections for classes present in this product)
  const sectionsList = useMemo(() => {
    const list: { id: string; label: string; count: number }[] = [
      { id: "all", label: "All Sections", count: totalSpecsCount },
    ];
    if (hasProductClass || product) {
      list.push({ id: "product", label: "Product Identity", count: productSpecs.length });
    }
    if (hasBinding) {
      list.push({ id: "binding", label: "Binding & Finish", count: bindingSpecs.length });
    }
    if (componentGroups.length > 0) {
      list.push({
        id: "components",
        label: "Cover & Components",
        count: componentGroups.reduce((acc, c) => acc + c.specs.length, 0),
      });
    }
    if (hasRuling) {
      list.push({ id: "ruling", label: "Paper & Ruling", count: rulingSpecs.length });
    }
    if (hasDividers) {
      list.push({ id: "dividers", label: "Accessories", count: dividerSpecs.length });
    }
    if (hasPackaging) {
      const pkgCount =
        (isClassPresent(packagingSpecs1) ? packagingSpecs1.length : 0) +
        (isClassPresent(packingDetailsSpecs) ? packingDetailsSpecs.length : 0);
      list.push({
        id: "packaging",
        label: "Packaging",
        count: pkgCount,
      });
    }
    if (genericClassGroups.length > 0) {
      list.push({
        id: "custom",
        label: "Other Classes",
        count: genericClassGroups.reduce((acc, [, s]) => acc + s.length, 0),
      });
    }
    return list;
  }, [
    totalSpecsCount,
    hasProductClass,
    product,
    productSpecs.length,
    hasBinding,
    bindingSpecs.length,
    componentGroups,
    hasRuling,
    rulingSpecs.length,
    hasDividers,
    dividerSpecs.length,
    hasPackaging,
    packagingSpecs1,
    packingDetailsSpecs,
    genericClassGroups,
  ]);

  const onlyConfigured = viewFilter === "configured";

  return (
    <div
      id={containerId}
      className="w-full space-y-5 font-sans select-text text-slate-900 dark:text-zinc-100"
    >
      {/* ─────────────────────────────────────────────────────────────
          TOP EXECUTIVE DOSSIER CARD & TECHNICAL CONTROLS
      ───────────────────────────────────────────────────────────── */}
      <header className="rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs space-y-4">
        {/* Row 1: Document Meta Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shadow-2xs">
                <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                OFFICIAL TECHNICAL DOCKET (SAP BOM)
              </span>

              {product.material_code && (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900 px-2.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
                  <Hash className="w-3 h-3 text-slate-400" />
                  {product.material_code}
                </span>
              )}

              {product.sr_number && (
                <span className="font-mono text-xs font-medium text-slate-600 dark:text-zinc-400">
                  ({product.sr_number})
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {product.product_description || "Commercial Product Specification"}
            </h1>

            {/* Quick Metadata Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-zinc-400">
              {product.customer && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Customer:{" "}
                  <strong className="text-slate-900 dark:text-zinc-200">{product.customer}</strong>
                </span>
              )}
              {product.target_plant && (
                <span className="inline-flex items-center gap-1">
                  <Factory className="w-3.5 h-3.5 text-slate-400" />
                  Plant:{" "}
                  <strong className="text-slate-900 dark:text-zinc-200">{product.target_plant}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date: <strong className="text-slate-900 dark:text-zinc-200">{formattedToday}</strong>
              </span>
            </div>
          </div>

          {/* Quick Metrics & View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-start lg:self-center shrink-0">
            {/* Completion Meter */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 dark:text-zinc-400">Specification Health</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {completionPercentage}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-[10px] font-mono shadow-2xs">
              <button
                type="button"
                onClick={() => setViewFilter("all")}
                className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  viewFilter === "all"
                    ? "bg-white text-slate-900 font-bold dark:bg-zinc-800 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                }`}
              >
                <Layers3 className="w-3 h-3 text-slate-400" />
                <span>All Specs</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-semibold">
                  {totalSpecsCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewFilter("configured")}
                className={`px-3 py-1.5 rounded transition cursor-pointer flex items-center gap-1.5 ${
                  viewFilter === "configured"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Configured</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold">
                  {configuredSpecsCount}
                </span>
              </button>
            </div>

            {/* Export Actions Toolbar (PDF, CSV, Print) */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => downloadProductDocketPdf(product, allPresentClasses)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-rose-50 text-slate-800 hover:text-rose-700 dark:bg-zinc-800 dark:hover:bg-rose-950/40 dark:text-zinc-200 dark:hover:text-rose-300 font-semibold shadow-2xs transition cursor-pointer text-[11px] border border-slate-200 dark:border-zinc-700"
                title="Download Official Docket as High-Fidelity PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadProductDocketCsv(product, allPresentClasses)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-700 dark:bg-zinc-800 dark:hover:bg-emerald-950/40 dark:text-zinc-200 dark:hover:text-emerald-300 font-semibold shadow-2xs transition cursor-pointer text-[11px] border border-slate-200 dark:border-zinc-700"
                title="Export Structured Technical Specifications as CSV (Excel Compatible)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => printProductDocketView(product, containerId)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-sky-50 text-slate-800 hover:text-sky-700 dark:bg-zinc-800 dark:hover:bg-sky-950/40 dark:text-zinc-200 dark:hover:text-sky-300 font-semibold shadow-2xs transition cursor-pointer text-[11px] border border-slate-200 dark:border-zinc-700"
                title="Print or Save as PDF via Browser Print Dialog"
              >
                <Printer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Search & Section Jump Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Section jump buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium no-scrollbar">
            {sectionsList.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`px-2.5 py-1 rounded-md transition whitespace-nowrap cursor-pointer shrink-0 text-xs ${
                  activeSection === sec.id
                    ? "bg-sky-600 text-white font-bold shadow-2xs"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
                }`}
              >
                <span>{sec.label}</span>
                <span className="ml-1 opacity-70 font-mono text-[10px]">({sec.count})</span>
              </button>
            ))}
          </div>

          {/* Quick Filter Search */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Filter docket specs..."
              className="w-full pl-8 pr-12 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs font-mono"
            />
            {effectiveSearch && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                {searchMatchCount} match{searchMatchCount === 1 ? "" : "es"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: PRODUCT IDENTITY & SIZING SPECIFICATIONS
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "product") && (hasProductClass || product) && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<BookOpen className="w-4 h-4" />}
            sectionNumber={1}
            title="Product Identity & Core Specifications"
            configuredCount={productSpecs.filter((s) => !isMissingSpec(s.value)).length}
            totalCount={productSpecs.length}
            isCollapsed={collapsedSections["sec1"]}
            onToggleCollapse={() => toggleSectionCollapse("sec1")}
          />

          {!collapsedSections["sec1"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {/* Row 1: Core Master Identifiers (2 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Customer Name",
                    value: product.customer || "—",
                    colSpan: 2,
                  },
                  {
                    label: "Material Code (SAP)",
                    value: product.material_code || "—",
                    colSpan: 1,
                  },
                  {
                    label: "Sample Request No",
                    value: product.sr_number || "—",
                    colSpan: 1,
                  },
                  {
                    label: "Product Close Size (CM)",
                    value: closeSizeDisplay,
                    colSpan: 1,
                  },
                  {
                    label: "Inside Size (CM)",
                    value: closeSizeDisplay,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Row 2: Description & Environmental Standards (3 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Product Description",
                    value: product.product_description || "—",
                    colSpan: 3,
                  },
                  {
                    label: "Claim Applicable",
                    value: formatCharValue(productSpecs, "CLAIMAPPLICABLETOPRODUCT").value,
                    colSpan: 1,
                  },
                  {
                    label: "FSC / EUTR Requirement",
                    value: formatCharValue(productSpecs, "FSCEUTR_REQUIREMENT").value,
                    colSpan: 1,
                  },
                  {
                    label: "Target Plant",
                    value: product.target_plant || "—",
                    colSpan: 1,
                  },
                ]}
              />

              {/* Row 3: Product Attributes & Artwork (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Brand Name",
                    value: (product as any).brand || (product as any).brandName || "—",
                    colSpan: 1,
                  },
                  {
                    label: "Barcode / VSN Code",
                    value: product.source_sample_code || (product as any).barcode || "—",
                    colSpan: 1,
                  },
                  {
                    label: "Size After Perforation",
                    value: formatCharValue(productSpecs, "SIZEAFTERPERFORATION").value,
                    colSpan: 1,
                  },
                  {
                    label: "Product Artwork Nos",
                    value: formatCharValue(productSpecs, "PRODUCTARTWORKNOS").value,
                    colSpan: 1,
                  },
                  {
                    label: "Packing Artwork Nos",
                    value: formatCharValue(productSpecs, "PACKINGARTWORKNOS").value,
                    colSpan: 1,
                  },
                  {
                    label: "Percentage Type",
                    value: formatCharValue(productSpecs, "PERCENTAGE_TYPE").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Remaining Characteristics of PRODUCT_CLASS chunked into 6 columns */}
              {chunkIntoStrict6Cols(remainingProductSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`rem-prod-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: BINDING & STRUCTURAL FINISHING DETAILS
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "binding") && hasBinding && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<Layers className="w-4 h-4" />}
            sectionNumber={2}
            title="Binding & Structural Finishing Details"
            configuredCount={bindingSpecs.filter((s) => !isMissingSpec(s.value)).length}
            totalCount={bindingSpecs.length}
            isCollapsed={collapsedSections["sec2"]}
            onToggleCollapse={() => toggleSectionCollapse("sec2")}
          />

          {!collapsedSections["sec2"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {/* Row 1: Primary Binding Mechanics (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Binding Side",
                    value: formatCharValue(bindingSpecs, "BINDINGSIDE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Binding Type",
                    value:
                      formatCharValue(bindingSpecs, "BINDINGTYPE1").value !== "NA"
                        ? formatCharValue(bindingSpecs, "BINDINGTYPE1").value
                        : formatCharValue(bindingSpecs, "BINDINGTYPE2").value,
                    colSpan: 1,
                  },
                  {
                    label: "No of Sheets",
                    value: formatCharValue(bindingSpecs, "NOOFSHEETS").value,
                    colSpan: 1,
                  },
                  {
                    label: "Filing / Drill Holes",
                    value: formatCharValue(bindingSpecs, "NOOFFILINGHOLESREQUIRE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Corner Rounding",
                    value: formatCharValue(bindingSpecs, "CORNERROUNDREQUIREON").value,
                    colSpan: 1,
                  },
                  {
                    label: "Edge Finish",
                    value: formatCharValue(bindingSpecs, "EDGEFINISHIGTYPE").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Row 2: Secondary Binding Specifications (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Opening of Product",
                    value: formatCharValue(bindingSpecs, "OPENINGOFPRODUCT").value,
                    colSpan: 1,
                  },
                  {
                    label: "Binding Material",
                    value: formatCharValue(bindingSpecs, "BINDINGMATERIAL").value,
                    colSpan: 1,
                  },
                  {
                    label: "Binding Color / Style",
                    value: formatCharValue(bindingSpecs, "BINDINGCOLOR_STYLE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Special Binding",
                    value: formatCharValue(bindingSpecs, "SPECIALBINDING").value,
                    colSpan: 1,
                  },
                  {
                    label: "Hole Punch Pattern",
                    value: formatCharValue(bindingSpecs, "SPIRAL-WIROBINDINGHOLEPUNCH").value,
                    colSpan: 1,
                  },
                  {
                    label: "Sheet Gathering",
                    value: formatCharValue(bindingSpecs, "SHEETGATHERINGSTYLE").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Remaining Characteristics of NB_BINDING */}
              {chunkIntoStrict6Cols(remainingBindingSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`rem-bind-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: COVER & COMPONENTS SPECIFICATION BREAKDOWN
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "components") && componentGroups.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<FileText className="w-4 h-4" />}
            sectionNumber={3}
            title="Cover & Sub-Component Specifications"
            configuredCount={componentGroups.reduce(
              (acc, c) => acc + c.specs.filter((s) => !isMissingSpec(s.value)).length,
              0
            )}
            totalCount={componentGroups.reduce((acc, c) => acc + c.specs.length, 0)}
            isCollapsed={collapsedSections["sec3"]}
            onToggleCollapse={() => toggleSectionCollapse("sec3")}
          />

          {!collapsedSections["sec3"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
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
                const perfLenVal = formatCharValue(comp.specs, "LENGTHAFTERPERFORATION");
                const perfWidthVal = formatCharValue(comp.specs, "WIDTHAFTERPERFORATION");
                const perfSizeDisplay =
                  !perfLenVal.isNa && !perfWidthVal.isNa
                    ? `${perfLenVal.value} X ${perfWidthVal.value} CM`
                    : !perfLenVal.isNa
                    ? `${perfLenVal.value} CM`
                    : "NA";
                const millVal = formatCharValue(comp.specs, `C${comp.index}MILL_SUPPLIERNAME`);
                const sheetsVal = formatCharValue(comp.specs, `C${comp.index}NOOFSHEETS`);

                const handledCompKeys = new Set([
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
                  "LENGTHAFTERPERFORATION",
                  "WIDTHAFTERPERFORATION",
                  `C${comp.index}MILL_SUPPLIERNAME`,
                  `C${comp.index}NOOFSHEETS`,
                ]);

                const remainingCompSpecs = comp.specs.filter(
                  (item) => !handledCompKeys.has(item.characteristicName.toUpperCase())
                );

                return (
                  <div key={comp.classKey} className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {/* Component Sub-Banner */}
                    <div className="bg-slate-100/90 dark:bg-zinc-900 px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-zinc-200 border-l-2 border-sky-500">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>{comp.title}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                        {comp.specs.filter((s) => !isMissingSpec(s.value)).length}/{comp.specs.length}{" "}
                        Configured
                      </span>
                    </div>

                    {/* Component Row 1: Primary Attributes (2 + 1 + 1 + 1 + 1 = 6 cols) */}
                    <DocketRow
                      searchFilter={effectiveSearch}
                      cells={[
                        {
                          label: `${comp.index === 1 ? "Cover" : `Comp ${comp.index}`} Name & Size`,
                          value: `${
                            !nameVal.isNa
                              ? nameVal.value
                              : comp.index === 1
                              ? "COVER (SPREAD)"
                              : "NA"
                          } (${sizeSpread})`,
                          colSpan: 2,
                        },
                        {
                          label: "Material Type",
                          value: materialVal.value,
                          colSpan: 1,
                        },
                        {
                          label: "GSM / Caliper",
                          value: !gsmVal.isNa
                            ? `${gsmVal.value} ${gsmUnit !== "NA" ? gsmUnit : "GSM"}`
                            : "NA",
                          colSpan: 1,
                        },
                        {
                          label: "Printing & Colors",
                          value: `${!printTypeVal.isNa ? printTypeVal.value : "NA"}${
                            !colorsVal.isNa ? ` - ${colorsVal.value}` : ""
                          }`,
                          colSpan: 1,
                        },
                        {
                          label: "Finishing Type",
                          value: finishVal.value,
                          colSpan: 1,
                        },
                      ]}
                    />

                    {/* Component Row 2: Secondary Attributes (2 + 1 + 1 + 1 + 1 = 6 cols) */}
                    <DocketRow
                      searchFilter={effectiveSearch}
                      cells={[
                        {
                          label: "Finish Details / Notes",
                          value: finishNoteVal.value,
                          colSpan: 2,
                        },
                        {
                          label: "Perforation Size",
                          value: perfSizeDisplay,
                          colSpan: 1,
                        },
                        {
                          label: "Mill / Supplier",
                          value: millVal.value,
                          colSpan: 1,
                        },
                        {
                          label: "Material Variance",
                          value: formatCharValue(
                            comp.specs,
                            `C${comp.index}MATERIALCOLOR_VARIANCE`
                          ).value,
                          colSpan: 1,
                        },
                        {
                          label: "No of Sheets / Units",
                          value: sheetsVal.value,
                          colSpan: 1,
                        },
                      ]}
                    />

                    {/* Remaining Characteristics for this component */}
                    {chunkIntoStrict6Cols(remainingCompSpecs, onlyConfigured).map(
                      (rowCells, rIdx) => (
                        <DocketRow
                          key={`comp-${comp.index}-rem-${rIdx}`}
                          cells={rowCells}
                          searchFilter={effectiveSearch}
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: INSIDE DETAILS & RULING SPECIFICATIONS
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "ruling") && hasRuling && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<AlignLeft className="w-4 h-4" />}
            sectionNumber={4}
            title="Inside Paper & Ruling Specifications"
            configuredCount={rulingSpecs.filter((s) => !isMissingSpec(s.value)).length}
            totalCount={rulingSpecs.length}
            isCollapsed={collapsedSections["sec4"]}
            onToggleCollapse={() => toggleSectionCollapse("sec4")}
          />

          {!collapsedSections["sec4"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {/* Row 1: GSM, Ruling Type, Distance, Shade, Margins (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Inside Paper GSM",
                    value: formatCharValue(rulingSpecs, "INSIDE_PAPER_GSM").value,
                    colSpan: 1,
                  },
                  {
                    label: "Ruling Type",
                    value: formatCharValue(rulingSpecs, "SPECIAL_RULING").value,
                    colSpan: 1,
                  },
                  {
                    label: "Ruling Distance (MM)",
                    value: formatCharValue(rulingSpecs, "RULLING_DISTANCE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Ruling Shade",
                    value: formatCharValue(rulingSpecs, "RULLING_SHADE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Top Margin (MM)",
                    value: formatCharValue(rulingSpecs, "TOP_MARGIN").value,
                    colSpan: 1,
                  },
                  {
                    label: "Bottom Margin (MM)",
                    value: formatCharValue(rulingSpecs, "BOTTOM_MARGIN").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Row 2: Left, Right Margins & Ruling Instructions (1 + 1 + 2 + 2 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Left Margin (MM)",
                    value: formatCharValue(rulingSpecs, "LEFT_MARGIN").value,
                    colSpan: 1,
                  },
                  {
                    label: "Right Margin (MM)",
                    value: formatCharValue(rulingSpecs, "RIGHT_MARGIN").value,
                    colSpan: 1,
                  },
                  {
                    label: "Special Instruction Ruling",
                    value: formatCharValue(rulingSpecs, "SPECIAL_RULING").value,
                    colSpan: 2,
                  },
                  {
                    label: "Inside Printing Details",
                    value: formatCharValue(rulingSpecs, "INSTRUCTION_RULLING").value,
                    colSpan: 2,
                  },
                ]}
              />

              {/* Remaining characteristics of RULLING_DETAILS */}
              {chunkIntoStrict6Cols(remainingRulingSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`rem-rule-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: INSIDE ACCESSORIES & DIVIDERS
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "dividers") && hasDividers && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<Bookmark className="w-4 h-4" />}
            sectionNumber={5}
            title="Inside Accessories & Dividers Details"
            configuredCount={dividerSpecs.filter((s) => !isMissingSpec(s.value)).length}
            totalCount={dividerSpecs.length}
            isCollapsed={collapsedSections["sec5"]}
            onToggleCollapse={() => toggleSectionCollapse("sec5")}
          />

          {!collapsedSections["sec5"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {/* Divider 1 Row (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Divider 1 Type & Size",
                    value: `${formatCharValue(dividerSpecs, "DIVIDERSTYPE1").value} (${
                      formatCharValue(dividerSpecs, "DIVIDER1SIZEINCLTABLENGTH").value
                    })`,
                    colSpan: 1,
                  },
                  {
                    label: "Divider Material",
                    value: formatCharValue(dividerSpecs, "DIVIDERMATERIALTYPE1").value,
                    colSpan: 1,
                  },
                  {
                    label: "Printing & Colors",
                    value: `${formatCharValue(dividerSpecs, "D1PRINTINGTYPE").value} - ${
                      formatCharValue(dividerSpecs, "D1NAMEOFCOLORSF_B").value
                    }`,
                    colSpan: 1,
                  },
                  {
                    label: "Divider GSM",
                    value: formatCharValue(dividerSpecs, "D1DIVIDERCALIPER_WEIGHT").value,
                    colSpan: 1,
                  },
                  {
                    label: "Tab Style",
                    value: formatCharValue(dividerSpecs, "TABSTYLEOF1STDIVIDERS").value,
                    colSpan: 1,
                  },
                  {
                    label: "Finish Details",
                    value: formatCharValue(dividerSpecs, "D1PRINTFINISHING").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Divider 2 Row (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Divider 2 Type & Size",
                    value: `${formatCharValue(dividerSpecs, "DIVIDERSTYPE2").value} (${
                      formatCharValue(dividerSpecs, "DIVIDERSIZEINCLTABLENGTH").value
                    })`,
                    colSpan: 1,
                  },
                  {
                    label: "Divider Material",
                    value: formatCharValue(dividerSpecs, "DIVIDERMATERIALTYPE2").value,
                    colSpan: 1,
                  },
                  {
                    label: "Printing & Colors",
                    value: `${formatCharValue(dividerSpecs, "D2PRINTINGTYPE").value} - ${
                      formatCharValue(dividerSpecs, "D2NAMEOFCOLORSF_B").value
                    }`,
                    colSpan: 1,
                  },
                  {
                    label: "Divider GSM",
                    value: formatCharValue(dividerSpecs, "D2DIVIDERCALIPER_WEIGHT").value,
                    colSpan: 1,
                  },
                  {
                    label: "Tab Style",
                    value: formatCharValue(dividerSpecs, "TABSTYLEOF2NDDIVIDERS").value,
                    colSpan: 1,
                  },
                  {
                    label: "Finish Details",
                    value: formatCharValue(dividerSpecs, "D2PRINTFINISHING").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Remaining characteristics of NB_DIVIDER_SPECS */}
              {chunkIntoStrict6Cols(remainingDividerSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`rem-div-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: PACKAGING & PACKING DETAILS
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "packaging") && hasPackaging && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<Package className="w-4 h-4" />}
            sectionNumber={6}
            title="Secondary & Master Packaging Details"
            configuredCount={
              packagingSpecs1.filter((s) => !isMissingSpec(s.value)).length +
              packingDetailsSpecs.filter((s) => !isMissingSpec(s.value)).length
            }
            totalCount={packagingSpecs1.length + packingDetailsSpecs.length}
            isCollapsed={collapsedSections["sec6"]}
            onToggleCollapse={() => toggleSectionCollapse("sec6")}
          />

          {!collapsedSections["sec6"] && (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {/* Packaging 1 (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Packaging 1 Name",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1NAME").value,
                    colSpan: 1,
                  },
                  {
                    label: "Material",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1MATERIAL").value,
                    colSpan: 1,
                  },
                  {
                    label: "Printing - Colors",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1PRINTING").value,
                    colSpan: 1,
                  },
                  {
                    label: "GSM",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1GSM").value,
                    colSpan: 1,
                  },
                  {
                    label: "Size (CM)",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1SIZE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Finish Details",
                    value: formatCharValue(packagingSpecs1, "PACKAGING1FINISH").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Packaging 2 (1 + 1 + 1 + 1 + 1 + 1 = 6 cols) */}
              <DocketRow
                searchFilter={effectiveSearch}
                cells={[
                  {
                    label: "Packaging 2 Name",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2NAME").value,
                    colSpan: 1,
                  },
                  {
                    label: "Material",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2MATERIAL").value,
                    colSpan: 1,
                  },
                  {
                    label: "Printing - Colors",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2PRINTING").value,
                    colSpan: 1,
                  },
                  {
                    label: "GSM",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2GSM").value,
                    colSpan: 1,
                  },
                  {
                    label: "Size (CM)",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2SIZE").value,
                    colSpan: 1,
                  },
                  {
                    label: "Finish Details",
                    value: formatCharValue(packagingSpecs1, "PACKAGING2FINISH").value,
                    colSpan: 1,
                  },
                ]}
              />

              {/* Remaining Packaging 1 Specs */}
              {chunkIntoStrict6Cols(remainingPackagingSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`rem-pack1-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}

              {/* Master Packing Details */}
              {chunkIntoStrict6Cols(packingDetailsSpecs, onlyConfigured).map((rowCells, rIdx) => (
                <DocketRow
                  key={`pack-det-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: CUSTOM / DYNAMIC CLASSIFICATION CLASSES
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "custom") &&
        genericClassGroups.map(([className, specs], gIdx) => (
          <section
            key={className}
            className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs"
          >
            <DocketSectionBanner
              icon={<SlidersHorizontal className="w-4 h-4" />}
              sectionNumber={7 + gIdx}
              title={productDocketSectionTitle(className)}
              configuredCount={specs.filter((s) => !isMissingSpec(s.value)).length}
              totalCount={specs.length}
              isCollapsed={collapsedSections[`custom-${className}`]}
              onToggleCollapse={() => toggleSectionCollapse(`custom-${className}`)}
            />

            {!collapsedSections[`custom-${className}`] && (
              <div className="divide-y divide-slate-200 dark:divide-zinc-800">
                {chunkIntoStrict6Cols(specs, onlyConfigured).map((rowCells, rIdx) => (
                  <DocketRow
                    key={`${className}-${rIdx}`}
                    cells={rowCells}
                    searchFilter={effectiveSearch}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

      {/* ─────────────────────────────────────────────────────────────
          SECTION 8: SPECIAL INSTRUCTION / MANUFACTURING PRINT NOTE
      ───────────────────────────────────────────────────────────── */}
      {(activeSection === "all" || activeSection === "product") && (
        <section className="overflow-hidden rounded-xl border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
          <DocketSectionBanner
            icon={<Info className="w-4 h-4" />}
            sectionNumber={genericClassGroups.length > 0 ? 8 + genericClassGroups.length : 7}
            title="Certified Manufacturing Notes & Prepress Target Guidelines"
          />
          <div className="p-4 bg-slate-50/70 dark:bg-zinc-900/50 text-xs font-mono text-slate-800 dark:text-zinc-200 min-h-[56px] flex items-center leading-relaxed">
            {(product as any).specialInstruction ||
            (product as any).printNote ||
            (product as any).remarks ||
            formatCharValue(productSpecs, "OVERALLPRODUCTNOTE").value !== "NA"
              ? (product as any).specialInstruction ||
                (product as any).printNote ||
                (product as any).remarks ||
                formatCharValue(productSpecs, "OVERALLPRODUCTNOTE").value
              : "Follow standard export manufacturing tolerances, certified prepress color targets, and approved ISO printing curves. All materials must comply with customer-specific QA parameters."}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDocketView;
