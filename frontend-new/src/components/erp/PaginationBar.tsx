import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
  itemLabel = "entries",
}) => {
  if (totalCount === 0) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] select-none text-xs text-[var(--on-surface-muted)] ${className}`}
    >
      {/* Entries Counter & Page Size */}
      <div className="flex items-center gap-3">
        <span>
          Showing <span className="font-semibold text-[var(--on-surface)]">{startIdx}</span> to{" "}
          <span className="font-semibold text-[var(--on-surface)]">{endIdx}</span> of{" "}
          <span className="font-semibold text-[var(--on-surface)]">{totalCount}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--border-subtle)] pl-3">
            <span className="text-[11px] text-[var(--on-surface-subtle)]">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-[var(--surface-low)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5 text-xs text-[var(--on-surface)] cursor-pointer focus:outline-hidden"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-low)] text-[var(--on-surface)] transition cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`dots-${idx}`} className="px-2 text-[var(--on-surface-subtle)]">
                ...
              </span>
            );
          }
          const pageNum = p as number;
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent-primary)] shadow-2xs"
                  : "hover:bg-[var(--surface-low)] text-[var(--on-surface)]"
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--surface-low)] text-[var(--on-surface)] transition cursor-pointer"
          title="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;
