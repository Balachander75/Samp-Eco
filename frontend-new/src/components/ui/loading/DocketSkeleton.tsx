import React from "react";

export interface DocketSkeletonProps {
  sections?: number;
  className?: string;
}

/**
 * Architectural skeleton for technical Product Docket views.
 * Preserves the exact 6-column layout of Navneet technical specification sheets.
 */
export const DocketSkeleton: React.FC<DocketSkeletonProps> = ({
  sections = 3,
  className = "",
}) => {
  return (
    <div
      role="status"
      aria-label="Loading product docket"
      className={`space-y-4 p-4 ${className}`}
    >
      {/* Top Banner & Action Controls Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] p-4 shadow-xs shimmer-luminous">
        <div className="space-y-1.5">
          <div className="h-5 w-48 rounded bg-[var(--surface-container)]" />
          <div className="h-3 w-72 rounded bg-[var(--surface-low)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded-lg bg-[var(--surface-low)]" />
          <div className="h-8 w-24 rounded-lg bg-[var(--surface-low)]" />
          <div className="h-8 w-28 rounded-lg bg-[var(--surface-container)]" />
        </div>
      </div>

      {/* Sections */}
      {Array.from({ length: sections }).map((_, sIdx) => (
        <div
          key={`docket-sec-skel-${sIdx}`}
          className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-xs"
        >
          {/* Section Banner Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 shimmer-luminous">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded bg-[var(--surface-container)]" />
              <div className="h-4 w-40 rounded bg-[var(--surface-container)]" />
            </div>
            <div className="h-5 w-16 rounded-full bg-[var(--surface-container)]" />
          </div>

          {/* 6-Column Grid Rows */}
          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 3 }).map((_, rIdx) => (
              <div
                key={`docket-row-skel-${rIdx}`}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-[var(--border-subtle)]"
              >
                {Array.from({ length: 6 }).map((_, cIdx) => (
                  <div
                    key={`docket-cell-skel-${cIdx}`}
                    className="p-3 space-y-1.5 shimmer-luminous"
                  >
                    <div className="h-2.5 w-16 rounded bg-[var(--surface-low)]" />
                    <div
                      className="h-4 rounded bg-[var(--surface-container)] font-mono"
                      style={{
                        width: `${50 + ((sIdx * 19 + rIdx * 13 + cIdx * 7) % 40)}%`,
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocketSkeleton;
