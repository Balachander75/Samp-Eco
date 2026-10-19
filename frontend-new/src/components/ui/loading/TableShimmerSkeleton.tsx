import React from "react";

export interface TableShimmerSkeletonProps {
  rows?: number;
  columns?: number;
  hasCheckbox?: boolean;
  className?: string;
}

/**
 * High-performance, luminous multi-row table skeleton rows.
 * Features intentional asymmetry and alternating column widths for an
 * authentic content-preview feel with zero layout shifts.
 */
export const TableShimmerSkeleton: React.FC<TableShimmerSkeletonProps> = ({
  rows = 8,
  columns = 6,
  hasCheckbox = false,
  className = "",
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={`shimmer-row-${rIdx}`}
          className={`border-b border-[var(--border-subtle)] transition-colors ${className}`}
        >
          {hasCheckbox && (
            <td className="w-9 px-2.5 py-3 text-center">
              <div className="h-3.5 w-3.5 rounded bg-[var(--surface-container)] mx-auto shimmer-luminous" />
            </td>
          )}
          {Array.from({ length: columns }).map((_, cIdx) => {
            // Intentional subtle asymmetry for high-end preview feel
            const widthPct = Math.max(
              30,
              Math.min(92, 85 - ((cIdx * 23 + rIdx * 13) % 45))
            );
            return (
              <td key={`shimmer-col-${cIdx}`} className="px-3 py-3">
                <div
                  className="h-3.5 rounded bg-[var(--surface-container)] shimmer-luminous"
                  style={{
                    width: `${widthPct}%`,
                    animationDelay: `${(rIdx * 70 + cIdx * 35) % 800}ms`,
                  }}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
};

export default TableShimmerSkeleton;
