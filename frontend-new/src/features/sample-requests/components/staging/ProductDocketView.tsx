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
      className={`h-full flex flex-col justify-between ${colClass} bg-[var(--surface-lowest)] border-r border-[var(--border-strong)] last:border-r-0 min-w-0 overflow-hidden transition-colors ${
        matchesSearch
          ? "ring-2 ring-amber-500 bg-amber-50 z-10"
          : "hover:bg-[var(--surface-low)]"
      }`}
    >
      {/* Precision Header Bar of Cell (Fixed uniform height across all cells) */}
      <div
        className="px-2.5 py-1.5 bg-[var(--surface-low)] border-b border-[var(--border-strong)] flex items-center min-h-[38px] h-[38px] select-none overflow-hidden"
        title={label}
      >
        <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase tracking-wide break-words line-clamp-2 leading-tight text-left w-full">
          {label}
        </span>
      </div>

      {/* Structured Value Container (Balanced even flex area) */}
      <div
        className="px-2.5 py-2 flex-1 flex items-center text-left min-h-[44px] bg-[var(--surface-lowest)] overflow-hidden"
        title={!isNa ? displayVal : undefined}
      >
        {creativeField && onCreativeFieldChange ? (
          <div className="w-full min-w-0 space-y-1">
            {label.toLowerCase().includes("printing") && !isNa && (
              <p className="truncate text-[10px] font-mono text-[var(--on-surface-muted)]" title={displayVal}>{displayVal}</p>
            )}
            {Array.isArray(creativeField.options) && creativeField.options.length > 0 ? (
              <select
                aria-label={`${creativeField.className} ${creativeField.characteristicName}`}
                value={creativeField.value || ""}
                onChange={(event) => onCreativeFieldChange(creativeField, event.target.value)}
                className="docket-screen-control w-full min-w-0 rounded border border-[var(--border-strong)] bg-[var(--surface-lowest)] px-1.5 py-1 text-[11px] font-mono font-semibold text-[var(--on-surface)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
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
                className="docket-screen-control w-full min-w-0 rounded border border-[var(--border-strong)] bg-[var(--surface-lowest)] px-1.5 py-1 text-[11px] font-mono font-semibold text-[var(--on-surface)] outline-none focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              />
            )}
            <span className="docket-print-value hidden text-xs font-mono font-bold text-[#141f2e]">
              {creativeField.value || "—"}
              {uom && <span className="ml-1 font-sans font-medium uppercase">{uom}</span>}
            </span>
          </div>
        ) : isNa ? (
          <span className="text-xs font-mono text-[var(--on-surface-subtle)] italic select-none">
            —
          </span>
        ) : (
          <div className="text-[12px] font-mono font-semibold text-[var(--on-surface)] break-words leading-snug w-full">
            <span>{displayVal}</span>
            {uom && (
              <span className="ml-1 text-[10px] font-sans font-medium text-[var(--on-surface-muted)] uppercase whitespace-nowrap">
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
      className={`h-full flex flex-col justify-between ${colClass} bg-[var(--surface-low)] border-r border-[var(--border-strong)] last:border-r-0 select-none overflow-hidden`}
    >
      <div className="px-2.5 py-1.5 bg-[var(--surface-container)] border-b border-[var(--border-strong)] min-h-[38px] h-[38px]" />
      <div className="flex-1 flex items-center justify-center min-h-[40px]">
        <span className="text-[var(--on-surface-subtle)] text-xs font-mono">—</span>
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
    <div className="grid grid-cols-6 border-b border-[var(--border-strong)] last:border-b-0 w-full auto-rows-fr items-stretch">
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

// Theme-aware section banner with a high-contrast title and spec count.
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
    className={`bg-[var(--accent-primary-strong)] text-white font-bold text-xs uppercase tracking-wider py-2.5 px-4 flex items-center justify-between select-none border-b border-[var(--accent-primary-hover)] ${
      onToggleCollapse ? "cursor-pointer hover:bg-[var(--accent-primary-hover)] transition-colors" : ""
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && <span className="text-white shrink-0">{icon}</span>}
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 border border-white/30 text-white font-bold">
        SEC {sectionNumber}
      </span>
      <span className="text-xs font-bold text-white tracking-wider break-words">
        {title.toUpperCase()}
      </span>
    </div>

    <div className="flex items-center gap-2.5 shrink-0">
      {totalCount !== undefined ? (
        <div className="flex items-center gap-1.5 text-[10px] font-mono bg-black/15 text-white px-2.5 py-0.5 rounded-full border border-white/30">
          <span className="text-white font-bold">{configuredCount ?? 0}</span>
          <span className="text-white/80">/</span>
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
          className="text-white hover:text-white p-0.5 rounded transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
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
      className="w-full max-w-full space-y-4 overflow-x-auto font-sans select-text text-[var(--on-surface)]"
    >
      

      {/* ─────────────────────────────────────────────────────────────
          OFFICIAL TECHNICAL DOCKET SECTIONS (EXACT PDF MIRROR)
      ───────────────────────────────────────────────────────────── */}
      {visibleSections.map((sec) => (
        <section
          key={sec.id}
          className="min-w-[900px] overflow-hidden rounded-lg border border-[var(--border-strong)] bg-[var(--surface-lowest)] shadow-sm xl:min-w-0"
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
            className="divide-y divide-[var(--border-strong)]"
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
