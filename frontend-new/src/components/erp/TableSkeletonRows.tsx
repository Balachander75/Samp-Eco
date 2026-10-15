import React from "react";

export interface TableSkeletonRowsProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeletonRows: React.FC<TableSkeletonRowsProps> = ({
  rows = 5,
  columns = 6,
  className = "",
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={`skeleton-row-${rIdx}`}
          className={`animate-pulse border-b border-[var(--border-subtle)] ${className}`}
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={`skeleton-col-${cIdx}`} className="py-3 px-3">
              <div
                className="h-3.5 bg-[var(--surface-container)] rounded"
                style={{
                  width: `${Math.max(45, 90 - (cIdx * 12 + rIdx * 7) % 45)}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeletonRows;
