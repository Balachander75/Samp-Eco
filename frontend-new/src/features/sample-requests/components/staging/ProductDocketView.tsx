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

// Section Icon Resolver
function getSectionIcon(id: string): React.ReactNode {
  if (id === "product") return <BookOpen className="w-4 h-4" />;
  if (id === "binding") return <Layers className="w-4 h-4" />;
  if (id.startsWith("comp-")) return <FileText className="w-4 h-4" />;
  if (id === "ruling") return <AlignLeft className="w-4 h-4" />;
  if (id === "dividers") return <Bookmark className="w-4 h-4" />;
  if (id === "packaging") return <Package className="w-4 h-4" />;
  if (id === "notes") return <Info className="w-4 h-4" />;
  return <SlidersHorizontal className="w-4 h-4" />;
}

// Laser-straight, aligned Docket Cell component mirroring the official PDF format
const DocketCell: React.FC<CellProps> = React.memo(({ cell, searchFilter }) => {
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
        {isNa ? (
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
}> = React.memo(({ cells, searchFilter }) => {
  const totalCols = cells.reduce((acc, c) => acc + (c.colSpan || 1), 0);
  const remainingCols = 6 - (totalCols % 6 || 6);

  return (
    <div className="grid grid-cols-6 border-b border-[#bde0fa] dark:border-sky-900/40 last:border-b-0 w-full auto-rows-fr items-stretch">
      {cells.map((cell, idx) => (
        <DocketCell key={`${cell.label}-${idx}`} cell={cell} searchFilter={searchFilter} />
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
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const effectiveSearch = externalSearchQuery || "";

  // Filter out empty classes and collect all present classes
  const allPresentClasses = useMemo(() => {
    return classGroups.filter(([, specs]) => isClassPresent(specs));
  }, [classGroups]);

  // Construct official technical docket sections identical to PDF output
  const docketSections = useMemo(() => {
    return buildDocketSections(product, allPresentClasses, false);
  }, [product, allPresentClasses]);

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

          {!collapsedSections[sec.id] && (
            <div className="divide-y divide-[#bde0fa] dark:divide-sky-900/40">
              {sec.rows.map((rowCells, rIdx) => (
                <DocketRow
                  key={`${sec.id}-row-${rIdx}`}
                  cells={rowCells}
                  searchFilter={effectiveSearch}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
});

export default ProductDocketView;
