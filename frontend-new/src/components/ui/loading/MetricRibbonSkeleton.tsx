import React from "react";

export interface MetricRibbonSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Editorial, glassmorphic metric card skeletons designed to match
 * executive KPI ribbons with zero Cumulative Layout Shift (CLS).
 */
export const MetricRibbonSkeleton: React.FC<MetricRibbonSkeletonProps> = ({
  count = 6,
  className = "",
}) => {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(count, 6)} gap-3 ${className}`}
      role="status"
      aria-label="Loading metrics"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={`metric-skel-${idx}`}
          className="relative overflow-hidden rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] p-3.5 shadow-xs shimmer-luminous"
        >
          {/* Top row: Label and Icon placeholder */}
          <div className="flex items-center justify-between gap-2">
            <div className="h-3 w-20 rounded-md bg-[var(--surface-low)]" />
            <div className="h-7 w-7 rounded-lg bg-[var(--surface-container)] shrink-0" />
          </div>

          {/* Big metric number placeholder */}
          <div className="mt-3.5 flex items-baseline gap-2">
            <div
              className="h-7 rounded-md bg-[var(--surface-container)] font-mono"
              style={{
                width: `${45 + ((idx * 17) % 35)}%`,
              }}
            />
          </div>

          {/* Bottom helper pill */}
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className="h-2 w-12 rounded bg-[var(--surface-low)]" />
            <div className="h-2 w-8 rounded bg-[var(--surface-low)] opacity-60" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MetricRibbonSkeleton;
