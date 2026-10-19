import React, { useMemo } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
} from "lucide-react";

export interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  accessorKey?: keyof T;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: string;
  sticky?: "left" | "right";
  cell?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (row: T) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selectedRowId?: string | number | null;
  // Multi-selection
  enableSelection?: boolean;
  selectedIds?: Set<string | number>;
  onToggleSelectRow?: (id: string | number) => void;
  onToggleSelectAll?: () => void;
  // Sorting
  sortField?: string | null;
  sortDirection?: "asc" | "desc";
  onSortChange?: (field: string) => void;
  // Legacy API compatibility; use density to control the rendered spacing.
  defaultDensity?: "compact" | "comfortable";
  // Pagination
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  // Table custom styles
  tableClassName?: string;
  containerClassName?: string;
  density?: "compact" | "normal";
  // Toolbar slots
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = "No matching records found",
  onRowClick,
  selectedRowId,
  enableSelection = false,
  selectedIds,
  onToggleSelectRow,
  onToggleSelectAll,
  sortField,
  sortDirection = "asc",
  onSortChange,
  currentPage = 1,
  pageSize = 50,
  totalCount,
  onPageChange,
  tableClassName,
  containerClassName,
  density = "normal",
  toolbarLeft,
  toolbarRight,
}: DataTableProps<T>) {
  const isAllSelected = useMemo(() => {
    if (!enableSelection || !selectedIds || data.length === 0) return false;
    return data.every((item) => selectedIds.has(keyExtractor(item)));
  }, [enableSelection, selectedIds, data, keyExtractor]);

  const isSomeSelected = useMemo(() => {
    if (!enableSelection || !selectedIds || data.length === 0) return false;
    return data.some((item) => selectedIds.has(keyExtractor(item))) && !isAllSelected;
  }, [enableSelection, selectedIds, data, keyExtractor, isAllSelected]);

  const totalPages = Math.ceil((totalCount ?? data.length) / pageSize) || 1;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[var(--surface-lowest)] text-[var(--text-primary)]">
      {/* Table Utility Bar */}
      <div className="h-9 px-5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--surface-low)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {toolbarLeft ?? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-sans">
              <span>
                Showing{" "}
                <span className="font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                  {(totalCount ?? data.length).toLocaleString()}
                </span>{" "}
                records
              </span>
              {selectedIds && selectedIds.size > 0 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="px-1.5 py-0.5 rounded bg-[var(--accent-primary-subtle)] border border-[var(--border-subtle)] text-[var(--accent-primary-strong)] font-bold text-[10px] tabular-nums">
                    {selectedIds.size} selected
                  </span>
                  {onToggleSelectAll && (
                    <button
                      type="button"
                      onClick={() => onToggleSelectAll()}
                      className="text-[10px] text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 font-mono underline cursor-pointer ml-0.5"
                    >
                      Deselect
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {toolbarRight && (
          <div className="flex items-center gap-2 shrink-0">{toolbarRight}</div>
        )}
      </div>

      {/* Main Table Container */}
      <div className={`flex-1 min-h-0 relative ${containerClassName ?? "overflow-auto"}`}>
        <table className={`w-full text-left ${density === "compact" ? "text-[12px]" : "text-[13px]"} border-collapse ${tableClassName ?? "min-w-[1080px]"}`}>
          {/* Sticky Header */}
          <thead className="sticky top-0 z-20 bg-[var(--surface-low)] border-b border-[var(--border-subtle)] shadow-2xs">
            <tr>
              {enableSelection && (
                <th className="w-9 px-2.5 py-2 text-center bg-[var(--surface-low)]">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={() => onToggleSelectAll && onToggleSelectAll()}
                    className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-brand-600 cursor-pointer"
                    aria-label="Select all rows"
                  />
                </th>
              )}

              {columns.map((col) => {
                const isSortActive = sortField === col.id;
                const isStickyLeft = col.sticky === "left";
                const isStickyRight = col.sticky === "right";
                const alignClass =
                  col.align === "right"
                    ? "text-right justify-end"
                    : col.align === "center"
                    ? "text-center justify-center"
                    : "text-left justify-start";

                return (
                  <th
                    key={col.id}
                    onClick={() => col.sortable && onSortChange && onSortChange(col.id)}
                    className={[
                      density === "compact" ? "px-2 py-1.5" : "px-3 py-2",
                      `whitespace-nowrap ${density === "compact" ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-[0.045em] text-[var(--text-muted)]`,
                      col.width ?? "",
                      col.sortable
                        ? "cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 group select-none transition-colors"
                        : "",
                      isStickyLeft
                        ? "sticky left-0 z-25 bg-[var(--surface-low)] border-r border-[var(--border-subtle)]"
                        : isStickyRight
                        ? "sticky right-0 z-25 bg-[var(--surface-low)] border-l border-[var(--border-subtle)]"
                        : "",
                    ].join(" ")}
                  >
                    <div className={`flex items-center gap-1 ${alignClass}`}>
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="shrink-0">
                          {isSortActive ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-[var(--accent-primary-strong)]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[var(--accent-primary-strong)]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              Array.from({ length: 12 }).map((_, rIdx) => (
                <tr key={rIdx} className="animate-pulse">
                  {enableSelection && (
                    <td className="px-4 py-2.5 text-center">
                      <div className="h-3.5 w-3.5 bg-[var(--surface-container)] rounded mx-auto" />
                    </td>
                  )}
                  {columns.map((_col, cIdx) => (
                    <td key={cIdx} className={density === "compact" ? "px-2 py-1.5" : "px-4 py-2.5"}>
                      <div
                        className={`h-3.5 bg-[var(--surface-low)] rounded ${
                          cIdx === 0 ? "w-3/4" : cIdx % 3 === 0 ? "w-2/5" : "w-3/5"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (enableSelection ? 1 : 0)}
                  className="py-24 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-3 max-w-xs mx-auto">
                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-low)] flex items-center justify-center">
                      <PackageOpen className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                        {emptyMessage}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, index) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedRowId === rowKey;
                const isChecked = selectedIds?.has(rowKey) ?? false;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(row)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || !onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      onRowClick(row);
                    }}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-selected={isSelected}
                    className={[
                      "transition-colors duration-100 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--border-focus)]",
                      onRowClick ? "cursor-pointer" : "",
                      isSelected
                        ? "bg-[var(--accent-primary-subtle)] shadow-[inset_2px_0_0_0_var(--accent-primary)]"
                        : isChecked
                        ? "bg-[var(--accent-primary-subtle)]"
                        : "hover:bg-[var(--surface-low)]",
                    ].join(" ")}
                  >
                    {enableSelection && (
                      <td
                        className="px-2.5 py-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => onToggleSelectRow && onToggleSelectRow(rowKey)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-brand-600 cursor-pointer"
                          aria-label={`Select row ${rowKey}`}
                        />
                      </td>
                    )}

                    {columns.map((col) => {
                      const isStickyLeft = col.sticky === "left";
                      const isStickyRight = col.sticky === "right";
                      const content = col.cell
                        ? col.cell(row, index)
                        : col.accessorKey
                        ? (row[col.accessorKey] as React.ReactNode)
                        : null;

                      return (
                        <td
                          key={col.id}
                          className={[
                            density === "compact" ? "px-2 py-1.5" : "px-3 py-2",
                            col.width ?? "",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            isStickyLeft
                              ? `sticky left-0 z-10 border-r border-[var(--border-subtle)] ${
                                  isSelected
                                    ? "bg-[var(--accent-primary-subtle)]"
                                    : "bg-[var(--surface-lowest)] group-hover:bg-[var(--surface-low)]"
                                }`
                              : isStickyRight
                              ? `sticky right-0 z-10 border-l border-[var(--border-subtle)] ${
                                  isSelected
                                    ? "bg-[var(--accent-primary-subtle)]"
                                    : "bg-[var(--surface-lowest)] group-hover:bg-[var(--surface-low)]"
                                }`
                              : "",
                          ].join(" ")}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {onPageChange && (
        <div className="h-10 px-5 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0 select-none">
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-secondary)] tabular-nums">
              {data.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}
            </span>
            {" – "}
            <span className="font-bold text-[var(--text-secondary)] tabular-nums">
              {Math.min(currentPage * pageSize, totalCount ?? data.length)}
            </span>
            {" of "}
            <span className="font-bold text-[var(--text-secondary)] tabular-nums">
              {(totalCount ?? data.length).toLocaleString()}
            </span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[12px] font-mono font-medium text-[var(--text-secondary)] px-2.5 tabular-nums">
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--text-secondary)] hover:bg-[var(--surface-low)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
