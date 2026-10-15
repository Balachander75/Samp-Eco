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
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border-t border-neutral-200/90 dark:border-white/[0.08] select-none text-xs text-neutral-600 dark:text-zinc-400 ${className}`}
    >
      {/* Entries Counter & Page Size */}
      <div className="flex items-center gap-3">
        <span>
          Showing <span className="font-semibold text-neutral-900 dark:text-zinc-100">{startIdx}</span> to{" "}
          <span className="font-semibold text-neutral-900 dark:text-zinc-100">{endIdx}</span> of{" "}
          <span className="font-semibold text-neutral-900 dark:text-zinc-100">{totalCount}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-neutral-200 dark:border-zinc-800 pl-3">
            <span className="text-[11px] text-neutral-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 rounded px-1.5 py-0.5 text-xs text-neutral-800 dark:text-zinc-200 cursor-pointer focus:outline-hidden"
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
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          title="Previous Page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return (
              <span key={`dots-${idx}`} className="px-2 text-neutral-400">
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
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-700 dark:text-zinc-300"
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
          className="p-1.5 rounded-lg border border-neutral-200 dark:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          title="Next Page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;
