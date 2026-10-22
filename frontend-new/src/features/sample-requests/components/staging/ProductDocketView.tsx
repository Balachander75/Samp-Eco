import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Layers,
  FileText,
  AlignLeft,
  Bookmark,
  Package,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ProductDetailItem } from "@/infrastructure/api/masterApi";
import type { ProductSearchResult } from "../../types";
import {
  buildDocketSections,
  isMissingSpec,
  isClassPresent,
  productDocketSectionTitle,
  type DocketSectionDef,
  type CellDef as DocketCellDef,
} from "./productDocketPdf";

export { isMissingSpec, isClassPresent, productDocketSectionTitle, type DocketCellDef, type DocketSectionDef };

export interface ProductDocketViewProps {
  product: ProductSearchResult;
  classGroups: [string, ProductDetailItem[]][];
  searchQuery?: string;
  containerId?: string;
  creativeFields?: ProductDetailItem[];
  onCreativeFieldChange?: (field: ProductDetailItem, value: string) => void;
}

interface CellProps {
  cell: DocketCellDef;
  searchFilter?: string;
  onCreativeFieldChange?: (field: ProductDetailItem, value: string) => void;
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

// Section Icon Resolver
function getSectionIcon(id: string): React.ReactNode {
  if (id === "product") return <BookOpen className="w-4 h-4" />;
  if (id === "binding") return <Layers className="w-4 h-4" />;
  if (id.startsWith("comp-")) return <FileText className="w-4 h-4" />;
  if (id === "ruling") return <AlignLeft className="w-4 h-4" />;
  if (id === "dividers") return <Bookmark className="w-4 h-4" />;
  if (id === "packaging" || id === "packing") return <Package className="w-4 h-4" />;
  return <SlidersHorizontal className="w-4 h-4" />;
}

function normalizeDocketKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function docketFieldKey(className: string, characteristicName: string): string {
  return `${normalizeDocketKey(className)}::${normalizeDocketKey(characteristicName)}`;
}

function classNamesForDocketSection(sectionId: string): string[] {
  if (sectionId === "binding") return ["NB_BINDING"];
  if (sectionId.startsWith("comp-")) return [`NB_COMPONENT_${sectionId.slice("comp-".length)}`];
  if (sectionId === "ruling") return ["RULLING_DETAILS"];
  if (sectionId === "dividers") return ["NB_DIVIDER_SPECS"];
  if (sectionId === "packaging") return ["PACKAGING_SPECS_1"];
  if (sectionId === "packing") return ["PACKING_DETAILS"];
  if (sectionId.startsWith("custom-")) return [sectionId.slice("custom-".length)];
  if (sectionId.startsWith("creative-")) return [sectionId.slice("creative-".length)];
  return [];
}

// Laser-straight, aligned Docket Cell component mirroring the official PDF format
const DocketCell: React.FC<CellProps> = React.memo(({ cell, searchFilter, onCreativeFieldChange }) => {
  const { label, value, uom, colSpan = 1 } = cell;
  const creativeField = cell.creativeField;
  const rawVal = value ? String(value).trim() : "";
  const hasUnitForMissingValue = isMissingSpec(rawVal) && Boolean(rawVal && uom);
  const isNa = isMissingSpec(rawVal) && !hasUnitForMissingValue;
  const displayVal = hasUnitForMissingValue ? "NA" : isNa ? "—" : rawVal;

  const matchesSearch = useMemo(() => {
    if (!searchFilter || searchFilter.trim() === "") return false;
    const q = searchFilter.trim().toLowerCase();
    return label.toLowerCase().includes(q) || displayVal.toLowerCase().includes(q);
  }, [searchFilter, label, displayVal]);

  const colClass = getColSpanClass(colSpan);

  return (
    <div
      className={`h-full flex flex-col justify-between ${colClass} bg-white dark:bg-zinc-950 border-r border-[#bde0fa] dark:border-sky-900/40 last:border-r-0 min-w-0 overflow-hidden transition-colors ${
        matchesSearch
          ? "ring-2 ring-amber-400 bg-amber-50/90 dark:bg-amber-950/50 z-10"
          : "hover:bg-sky-50/40 dark:hover:bg-zinc-900/40"
      }`}
    >
      {/* Precision Header Bar of Cell (Fixed uniform height across all cells) */}
      <div
        className="px-2.5 py-1.5 bg-[#f0f9ff] dark:bg-sky-950/50 border-b border-[#bde0fa] dark:border-sky-900/40 flex items-center min-h-[34px] h-[34px] select-none overflow-hidden"
        title={label}
      >
        <span className="text-[10px] font-bold text-[#384759] dark:text-sky-200 uppercase tracking-wider break-words line-clamp-2 leading-tight text-left w-full">
          {label}
        </span>
      </div>

      {/* Structured Value Container (Balanced even flex area) */}
      <div
        className="px-2.5 py-2 flex-1 flex items-center text-left min-h-[40px] bg-white dark:bg-zinc-950 overflow-hidden"
        title={!isNa ? displayVal : undefined}
      >
        {creativeField && onCreativeFieldChange ? (
          <div className="w-full min-w-0 space-y-1">
            {label.toLowerCase().includes("printing") && !isNa && (
              <p className="truncate text-[9px] font-mono text-slate-600 dark:text-zinc-300" title={displayVal}>{displayVal}</p>
            )}
            {Array.isArray(creativeField.options) && creativeField.options.length > 0 ? (
              <select
                aria-label={`${creativeField.className} ${creativeField.characteristicName}`}
                value={creativeField.value || ""}
                onChange={(event) => onCreativeFieldChange(creativeField, event.target.value)}
                className="docket-screen-control w-full min-w-0 rounded border border-sky-300 bg-white px-1.5 py-1 text-[10px] font-mono font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-sky-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {!creativeField.value && <option value="">Select an option</option>}
                {creativeField.value && !creativeField.options.includes(creativeField.value) && (
                  <option value={creativeField.value}>{creativeField.value} (current)</option>
                )}
                {creativeField.options.map((option, index) => (
                  <option key={`${creativeField.id}-${index}`} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                aria-label={`${creativeField.className} ${creativeField.characteristicName}`}
                value={creativeField.value || ""}
                onChange={(event) => onCreativeFieldChange(creativeField, event.target.value)}
                placeholder="Enter value"
                className="docket-screen-control w-full min-w-0 rounded border border-sky-300 bg-white px-1.5 py-1 text-[10px] font-mono font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-sky-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            )}
            <span className="docket-print-value hidden text-xs font-mono font-bold text-[#141f2e]">
              {creativeField.value || "—"}
              {uom && <span className="ml-1 font-sans font-medium uppercase">{uom}</span>}
            </span>
          </div>
        ) : isNa ? (
          <span className="text-xs font-mono text-slate-300 dark:text-zinc-600 italic select-none">
            —
          </span>
        ) : (
          <div className="text-xs font-mono font-bold text-[#141f2e] dark:text-zinc-100 break-words leading-tight w-full">
            <span>{displayVal}</span>
            {uom && (
              <span className="ml-1 text-[10px] font-sans font-medium text-slate-500 dark:text-zinc-400 uppercase whitespace-nowrap">
                {uom}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// Subtle placeholder cell with identical header and value height to balance rows
const DocketEmptyCell: React.FC<{ colSpan?: number }> = React.memo(({ colSpan = 1 }) => {
  const colClass = getColSpanClass(colSpan);
  return (
    <div
      className={`h-full flex flex-col justify-between ${colClass} bg-[#f0f9ff]/30 dark:bg-zinc-950/40 border-r border-[#bde0fa] dark:border-sky-900/40 last:border-r-0 select-none overflow-hidden`}
    >
      <div className="px-2.5 py-1.5 bg-[#f0f9ff]/50 dark:bg-sky-950/30 border-b border-[#bde0fa] dark:border-sky-900/40 min-h-[34px] h-[34px]" />
      <div className="flex-1 flex items-center justify-center min-h-[40px]">
        <span className="text-slate-300 dark:text-zinc-700 text-xs font-mono">—</span>
      </div>
    </div>
  );
});

// Strict 6-column container row. All cells evenly aligned with auto-rows-fr.
const DocketRow: React.FC<{
  cells: DocketCellDef[];
  searchFilter?: string;
  onCreativeFieldChange?: (field: ProductDetailItem, value: string) => void;
}> = React.memo(({ cells, searchFilter, onCreativeFieldChange }) => {
  const totalCols = cells.reduce((acc, c) => acc + (c.colSpan || 1), 0);
  const remainingCols = 6 - (totalCols % 6 || 6);

  return (
    <div className="grid grid-cols-6 border-b border-[#bde0fa] dark:border-sky-900/40 last:border-b-0 w-full auto-rows-fr items-stretch">
      {cells.map((cell, idx) => (
        <DocketCell
          key={`${cell.label}-${idx}`}
          cell={cell}
          searchFilter={searchFilter}
          onCreativeFieldChange={onCreativeFieldChange}
        />
      ))}
      {remainingCols > 0 && <DocketEmptyCell colSpan={remainingCols} />}
    </div>
  );
});

// Section Header Banner with Title, Icon, Spec Count Badge, and Cyan Banner (#00a2e8)
const DocketSectionBanner: React.FC<{
  icon?: React.ReactNode;
  sectionNumber: number | string;
  title: string;
  countBadge?: string;
  configuredCount?: number;
  totalCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}> = React.memo(({
  icon,
  sectionNumber,
  title,
  countBadge,
  configuredCount,
  totalCount,
  isCollapsed,
  onToggleCollapse,
}) => (
  <div
    onClick={onToggleCollapse}
    className={`bg-[#00a2e8] text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 flex items-center justify-between select-none shadow-xs border-b border-[#008cd2] ${
      onToggleCollapse ? "cursor-pointer hover:bg-[#0096d6] transition-colors" : ""
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && <span className="text-white shrink-0">{icon}</span>}
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-900/40 border border-white/20 text-white font-bold">
        SEC {sectionNumber}
      </span>
      <span className="text-xs font-bold text-white tracking-wider break-words">
        {title.toUpperCase()}
      </span>
    </div>

    <div className="flex items-center gap-2.5 shrink-0">
      {totalCount !== undefined ? (
        <div className="flex items-center gap-1.5 text-[10px] font-mono bg-sky-900/30 text-white px-2.5 py-0.5 rounded-full border border-white/20">
          <span className="text-white font-bold">{configuredCount ?? 0}</span>
          <span className="text-sky-200">/</span>
          <span>{totalCount} Specs</span>
        </div>
      ) : countBadge ? (
        <span className="text-[10px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded">
          {countBadge}
        </span>
      ) : null}

      {onToggleCollapse && (
        <button
          type="button"
          aria-label={isCollapsed ? "Expand section" : "Collapse section"}
          className="text-white/80 hover:text-white p-0.5 rounded transition cursor-pointer"
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      )}
    </div>
  </div>
));

export const ProductDocketView: React.FC<ProductDocketViewProps> = React.memo(({
  product,
  classGroups,
  searchQuery: externalSearchQuery = "",
  containerId = "product-docket-container",
  creativeFields,
  onCreativeFieldChange,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const effectiveSearch = externalSearchQuery || "";

  // Filter out empty classes and collect all present classes
  const allPresentClasses = useMemo(() => {
    const creativeClassKeys = new Set((creativeFields || []).map((field) => normalizeDocketKey(field.className)));
    return classGroups.filter(([className, specs]) =>
      isClassPresent(specs) || creativeClassKeys.has(normalizeDocketKey(className))
    );
  }, [classGroups, creativeFields]);

  // Keep Creative-owned values inside the matching docket class section.
  const docketSections = useMemo(() => {
    const sections = buildDocketSections(product, allPresentClasses, false);
    if (!creativeFields?.length) return sections;

    for (const field of creativeFields) {
      const classKey = normalizeDocketKey(field.className);
      let section = sections.find((candidate) =>
        classNamesForDocketSection(candidate.id).some((name) => normalizeDocketKey(name) === classKey)
      );

      if (!section) {
        const classSpecs = classGroups.find(([name]) => normalizeDocketKey(name) === classKey)?.[1] || [field];
        section = {
          id: `creative-${field.className}`,
          sectionNumber: sections.length + 1,
          title: productDocketSectionTitle(field.className),
          countBadge: `${classSpecs.length} SPECS`,
          totalSpecs: classSpecs.length,
          configuredSpecs: classSpecs.filter((item) => !isMissingSpec(item.value)).length,
          rows: [],
        };
        sections.push(section);
      }
    }

    return sections.map((section) => {
      const sectionClassKeys = new Set(classNamesForDocketSection(section.id).map(normalizeDocketKey));
      const sectionFields = creativeFields.filter((field) => sectionClassKeys.has(normalizeDocketKey(field.className)));
      if (sectionFields.length === 0) return section;

      const represented = new Set<string>();
      const rows = section.rows.map((row) => row.map((cell) => {
        if (!cell.className || !cell.characteristicName) return cell;
        const match = sectionFields.find((field) =>
          docketFieldKey(field.className, field.characteristicName) === docketFieldKey(cell.className!, cell.characteristicName!)
        );
        if (!match) return cell;
        represented.add(docketFieldKey(match.className, match.characteristicName));
        return { ...cell, creativeField: match };
      }));

      const unplacedFields = sectionFields.filter((field) =>
        !represented.has(docketFieldKey(field.className, field.characteristicName))
      );
      for (let index = 0; index < unplacedFields.length; index += 6) {
        rows.push(unplacedFields.slice(index, index + 6).map((field) => ({
          label: field.characteristicName,
          value: field.value || "NA",
          uom: field.uom || undefined,
          colSpan: 1 as const,
          creativeField: field,
        })));
      }

      if (section.id === "packaging") {
        const visibleFields = rows.flat();
        return {
          ...section,
          rows,
          countBadge: `${visibleFields.length} SPECS`,
          totalSpecs: visibleFields.length,
          configuredSpecs: visibleFields.filter((cell) => !isMissingSpec(cell.value)).length,
        };
      }

      return { ...section, rows };
    });
  }, [product, allPresentClasses, creativeFields, classGroups]);

  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

  const visibleSections = docketSections;

  return (
    <div
      id={containerId}
      className="w-full max-w-full space-y-4 font-sans select-text text-slate-900 dark:text-zinc-100 overflow-hidden"
    >
      

      {/* ─────────────────────────────────────────────────────────────
          OFFICIAL TECHNICAL DOCKET SECTIONS (EXACT PDF MIRROR)
      ───────────────────────────────────────────────────────────── */}
      {visibleSections.map((sec) => (
        <section
          key={sec.id}
          className="overflow-hidden rounded-md border border-[#74befa] dark:border-sky-800 bg-white dark:bg-zinc-950 shadow-xs"
        >
          <DocketSectionBanner
            icon={getSectionIcon(sec.id)}
            sectionNumber={sec.sectionNumber}
            title={sec.title}
            countBadge={sec.countBadge}
            configuredCount={sec.configuredSpecs}
            totalCount={sec.totalSpecs}
            isCollapsed={collapsedSections[sec.id]}
            onToggleCollapse={() => toggleSectionCollapse(sec.id)}
          />

          <div
            data-docket-print-body
            hidden={Boolean(collapsedSections[sec.id])}
            className="divide-y divide-[#bde0fa] dark:divide-sky-900/40"
          >
            {sec.rows.map((rowCells, rIdx) => (
              <DocketRow
                key={`${sec.id}-row-${rIdx}`}
                cells={rowCells}
                searchFilter={effectiveSearch}
                onCreativeFieldChange={onCreativeFieldChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
});

export default ProductDocketView;
