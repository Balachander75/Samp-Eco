import React from "react";
import { Search, X, Plus, RefreshCw, Download, type LucideIcon } from "lucide-react";

export interface DeskKpiItem {
  label: string;
  value: number | string;
  detail?: string;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export interface DeskPrimaryAction {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export interface DeskSearchConfig {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export interface DeskWorkspaceLayoutProps {
  // 1. Header Props
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  businessYear?: string;
  totalCount?: number;
  totalLabel?: string;
  showStatusDot?: boolean;
  extraBadges?: React.ReactNode;

  // Header Actions
  primaryAction?: DeskPrimaryAction;
  onRefresh?: () => void | Promise<void>;
  isRefreshing?: boolean;
  onExportCSV?: () => void;
  exportDisabled?: boolean;
  extraHeaderActions?: React.ReactNode;

  // 2. KPI / Workflow Strip (Optional)
  kpiItems?: DeskKpiItem[];
  kpiGridCols?: string;
  customRibbon?: React.ReactNode;

  // 3. Filter Toolbar
  search?: DeskSearchConfig;
  filterControls?: React.ReactNode;
  extraFilterControls?: React.ReactNode;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  resetFiltersLabel?: string;

  // 4. Main Content Area
  children: React.ReactNode;
  className?: string;
}

export const DeskWorkspaceLayout: React.FC<DeskWorkspaceLayoutProps> = ({
  title,
  subtitle,
  businessYear,
  totalCount,
  totalLabel = "Total",
  showStatusDot = true,
  extraBadges,
  primaryAction,
  onRefresh,
  isRefreshing = false,
  onExportCSV,
  exportDisabled = false,
  extraHeaderActions,
  kpiItems,
  kpiGridCols = "grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5",
  customRibbon,
  search,
  filterControls,
  extraFilterControls,
  hasActiveFilters = false,
  onResetFilters,
  resetFiltersLabel = "Clear Filters",
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-base)] text-[var(--on-surface)] select-text font-sans ${className}`}
    >
      {/* ── 1. Compact Enterprise Header ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Status Dot, Title, Fiscal Year & Badges */}
          <div>
            <div className="flex items-center gap-2.5">
              {showStatusDot && (
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
              )}
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                  {title}
                </h1>
                {businessYear && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold">
                    BY {businessYear}
                  </span>
                )}
                {typeof totalCount === "number" && (
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                    {totalCount} {totalLabel}
                  </span>
                )}
                {extraBadges}
              </div>
            </div>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--on-surface-muted)] pl-5 sm:pl-5">
                {subtitle}
              </p>
            )}
          </div>

          {/* Right: Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs cursor-pointer active:scale-98 disabled:opacity-50"
                title={primaryAction.title || primaryAction.label}
              >
                {primaryAction.icon ? (
                  <primaryAction.icon className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{primaryAction.label}</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
                title="Refresh Queue"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRefreshing ? "animate-spin text-[var(--accent-primary)]" : ""
                  }`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            )}

            {onExportCSV && (
              <button
                type="button"
                onClick={onExportCSV}
                disabled={exportDisabled}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}

            {extraHeaderActions}
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Workflow Strip (Direct Queue Filters) ── */}
      {customRibbon ? (
        customRibbon
      ) : kpiItems && kpiItems.length > 0 ? (
        <section
          aria-label="Workflow summary"
          className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
        >
          <div className={`grid ${kpiGridCols}`}>
            {kpiItems.map((item) => {
              const isSelected = item.isActive;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20 shadow-xs"
                      : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-focus)] hover:bg-[var(--surface-low)]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          item.color || "bg-[var(--accent-primary)]"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-display font-bold tabular-nums text-[var(--on-surface)]">
                      {item.value}
                    </span>
                    {item.detail && (
                      <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                        {item.detail}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── 3. Compact Filter Controls ── */}
      {(filterControls || search || hasActiveFilters || extraFilterControls) && (
        <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-2 sm:px-8">
          <div className="flex flex-wrap items-center gap-2.5">
            {extraFilterControls}
            {filterControls}

            {/* Standard Search Input */}
            {search && (
              <div className="group relative min-w-[200px] flex-1 sm:max-w-[340px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
                <input
                  type="text"
                  placeholder={search.placeholder || "Search..."}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] pl-8 pr-7 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
                {search.value && (
                  <button
                    type="button"
                    onClick={() => search.onChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Clear Filters Button */}
            {hasActiveFilters && onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="h-8 select-none rounded-lg px-2 text-xs font-semibold text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
              >
                {resetFiltersLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 4. Main Workspace Content (DataTable / Full-bleed View) ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </div>
    </div>
  );
};
export default DeskWorkspaceLayout;
