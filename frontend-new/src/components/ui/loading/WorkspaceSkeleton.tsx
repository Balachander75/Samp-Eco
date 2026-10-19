import React from "react";
import { MetricRibbonSkeleton } from "./MetricRibbonSkeleton";
import { TableShimmerSkeleton } from "./TableShimmerSkeleton";

export interface WorkspaceSkeletonProps {
  title?: string;
  hasMetrics?: boolean;
}

/**
 * Full-page editorial workspace skeleton matching the Navneet SAMP ERP layout.
 * Eliminates blank white/grey screens and jarring flashes on navigation.
 */
export const WorkspaceSkeleton: React.FC<WorkspaceSkeletonProps> = ({
  hasMetrics = true,
}) => {
  return (
    <div
      role="status"
      aria-label="Loading workspace"
      className="flex flex-1 flex-col min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[var(--surface-base)]"
    >
      {/* Workspace Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
        <div className="space-y-1.5">
          <div className="h-6 w-52 rounded-md bg-[var(--surface-container)] shimmer-luminous" />
          <div className="h-3 w-72 rounded bg-[var(--surface-low)] shimmer-luminous" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-24 rounded-lg bg-[var(--surface-low)] shimmer-luminous" />
          <div className="h-8 w-32 rounded-lg bg-[var(--accent-primary-subtle)] opacity-70 shimmer-luminous" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      {hasMetrics && <MetricRibbonSkeleton count={6} />}

      {/* Table Card Skeleton */}
      <div className="flex-1 flex flex-col min-h-[380px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="h-11 px-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--surface-low)] shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-60 rounded-md bg-[var(--surface-container)] shimmer-luminous" />
            <div className="h-7 w-28 rounded-md bg-[var(--surface-container)] shimmer-luminous" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded-md bg-[var(--surface-container)] shimmer-luminous" />
            <div className="h-7 w-20 rounded-md bg-[var(--surface-container)] shimmer-luminous" />
          </div>
        </div>

        {/* Table Viewport */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
              <tr>
                <th className="w-9 px-2.5 py-2.5 text-center">
                  <div className="h-3.5 w-3.5 rounded bg-[var(--surface-container)] mx-auto shimmer-luminous" />
                </th>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <th key={`skel-th-${idx}`} className="px-3 py-2.5">
                    <div
                      className="h-3 rounded bg-[var(--surface-container)] shimmer-luminous"
                      style={{ width: `${60 + ((idx * 17) % 30)}%` }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              <TableShimmerSkeleton rows={8} columns={6} hasCheckbox />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSkeleton;
