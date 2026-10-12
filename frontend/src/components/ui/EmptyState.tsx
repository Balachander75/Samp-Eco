import React from "react";
import { LucideIcon, Package, RotateCcw } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  onResetFilters?: () => void;
  resetLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Package,
  title,
  description,
  onResetFilters,
  resetLabel = "Reset All Filters",
  actionLabel,
  onAction,
  action,
  children,
  className = "",
  compact = false,
}) => {
  const handleReset = onResetFilters || onAction;
  const label = actionLabel || resetLabel;
  return (
    <div
      className={`flex flex-col items-center justify-center text-center max-w-xl mx-auto ${
        compact ? "py-8 px-4" : "py-14 px-4"
      } ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-low)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-primary)] mb-3.5 shadow-2xs">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-sm font-semibold text-[var(--on-surface)] mb-1 font-display">
        {title}
      </h3>

      {description && (
        <p className="text-xs text-[var(--on-surface-muted)] max-w-md mb-5 leading-relaxed">
          {description}
        </p>
      )}

      {(handleReset || action) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
          {handleReset && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition shadow-2xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[var(--on-surface-muted)]" />
              <span>{label}</span>
            </button>
          )}
          {action}
        </div>
      )}

      {children}
    </div>
  );
};

export default EmptyState;
