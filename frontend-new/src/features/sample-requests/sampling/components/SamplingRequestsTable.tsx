import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { getStageIdForRequest } from "../../utils/trackTypes";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, ColumnDef } from "@/components/erp";
import { getPrimaryRequestCode, getRequestRequiredDate, getRequestTypes, getSecondaryRequestCode } from "../utils/requestTypeUtils";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Building2,
  Package,
  Palette,
  Layers,
  Calculator,
} from "lucide-react";

export interface SamplingRequestsTableProps {
  paginatedRequests: SampleRequestItem[];
  filteredRequestsCount: number;
  isLoading: boolean;
  selectedIds: Set<string | number>;
  copiedId?: string | null;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  isAdmin: boolean;
  isDraftView?: boolean;
  hasActiveFilters?: boolean;
  selectedTypeFilter?: string;
  onToggleSelectAll: () => void;
  onToggleSelectRow: (id: string | number, e?: React.SyntheticEvent) => void;
  onCopyCode?: (code: string, e: React.MouseEvent) => void;
  onOpenDraftInStaging: (row: SampleRequestItem, e?: React.MouseEvent) => void;
  onInspectRequest: (row: SampleRequestItem) => void;
  onReleaseDraft: (row: SampleRequestItem) => Promise<void>;
  onPageChange: (page: number) => void;
  onOpenNewModal?: () => void;
  onResetFilters?: () => void;
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "MK";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getSlaUrgency(dateStr?: string | null): { label?: string; color: string } {
  if (!dateStr) return { color: "text-[var(--on-surface-subtle)]" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { color: "text-[var(--on-surface-subtle)]" };
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { label: "Overdue", color: "text-rose-600 dark:text-rose-400 font-semibold" };
  }
  if (diffDays <= 2) {
    return { label: "Due Soon", color: "text-amber-600 dark:text-amber-400 font-semibold" };
  }
  return { color: "text-[var(--on-surface-muted)]" };
}

function renderRequiredDateCell(dateStr?: string | null): React.ReactNode {
  if (!dateStr) {
    return <span className="font-mono text-xs text-[var(--on-surface-subtle)]">—</span>;
  }
  const { label, color } = getSlaUrgency(dateStr);
  return (
    <div className="flex flex-col whitespace-nowrap">
      <span className={`font-mono text-xs ${color}`}>
        {formatOdooDate(dateStr)}
      </span>
      {label && (
        <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          {label}
        </span>
      )}
    </div>
  );
}

function quantityLabel(value: string | number | undefined): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return String(value).trim();
}

function renderQuantityCell(row: SampleRequestItem, typeFilter: string = "all"): React.ReactNode {
  const types = getRequestTypes(row);
  const sampleQty = quantityLabel(row.qtyForSampling) || "1";
  const sampleUnit = row.unitPcPack || "PC";
  const samplePackInfo = sampleUnit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack}/pk)` : "";

  const reqDesigns = Number(row.designsCustomerCreative || row.productArtworkNos || row.numberOfDesigns) || 1;
  const recDesigns = (row.creativeSubmissions || []).reduce(
    (total, batch) => total + (Array.isArray(batch?.rows) ? batch.rows.length : 0),
    0
  );

  const mockupQty = quantityLabel((row as any).qtyForMockup || (row as any).mockupQty || (row.mockupWorkflowState as any)?.qtyForMockup) || "1";

  const costingQty = quantityLabel(row.qtyDesignCosting) || "1";
  const costingUnit = row.unitPcPack || "PC";
  const costingPackInfo = costingUnit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack}/pk)` : "";

  if (typeFilter === "sample") {
    if (!types.includes("sample")) return <span className="text-[var(--on-surface-subtle)] font-mono text-xs">—</span>;
    return (
      <div className="flex flex-col whitespace-nowrap">
        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <span>{sampleQty}</span>
          <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase">{sampleUnit}</span>
        </div>
        {samplePackInfo && (
          <span className="text-[9.5px] text-[var(--on-surface-subtle)] font-mono">{samplePackInfo}</span>
        )}
      </div>
    );
  }

  if (typeFilter === "design") {
    if (!types.includes("design")) return <span className="text-[var(--on-surface-subtle)] font-mono text-xs">—</span>;
    return (
      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap">
        <span>{reqDesigns}</span>
        <span className="text-[10px] font-normal text-[var(--on-surface-subtle)]">Req</span>
        {recDesigns > 0 && (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">({recDesigns} Deliv)</span>
        )}
      </div>
    );
  }

  if (typeFilter === "mockup") {
    if (!types.includes("mockup")) return <span className="text-[var(--on-surface-subtle)] font-mono text-xs">—</span>;
    return (
      <div className="flex items-center gap-1 font-mono text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <span>{mockupQty}</span>
        <span className="text-[10px] font-medium text-[var(--on-surface-subtle)]">Mockup{mockupQty !== "1" ? "s" : ""}</span>
      </div>
    );
  }

  if (typeFilter === "costing") {
    if (!types.includes("costing")) return <span className="text-[var(--on-surface-subtle)] font-mono text-xs">—</span>;
    return (
      <div className="flex flex-col whitespace-nowrap">
        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-sky-700 dark:text-sky-300">
          <span>{costingQty}</span>
          <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase">{costingUnit}</span>
        </div>
        {costingPackInfo && (
          <span className="text-[9.5px] text-[var(--on-surface-subtle)] font-mono">{costingPackInfo}</span>
        )}
      </div>
    );
  }

  // "all" view
  const items: React.ReactNode[] = [];

  if (types.includes("sample") || (!types.includes("design") && !types.includes("mockup") && !types.includes("costing"))) {
    items.push(
      <span key="sample" className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        {sampleQty} <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase">{sampleUnit}</span>
        {samplePackInfo && <span className="text-[9.5px] text-[var(--on-surface-subtle)] font-normal">{samplePackInfo}</span>}
      </span>
    );
  }

  if (types.includes("design")) {
    items.push(
      <span key="design" className="font-mono text-xs font-semibold text-purple-700 dark:text-purple-300">
        {reqDesigns} <span className="text-[10px] font-normal text-[var(--on-surface-subtle)]">DSG</span>
      </span>
    );
  }

  if (types.includes("mockup")) {
    items.push(
      <span key="mockup" className="font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
        {mockupQty} <span className="text-[10px] font-normal text-[var(--on-surface-subtle)]">MUP</span>
      </span>
    );
  }

  if (types.includes("costing")) {
    items.push(
      <span key="costing" className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-300">
        {costingQty} <span className="text-[10px] font-normal text-[var(--on-surface-subtle)]">CST</span>
      </span>
    );
  }

  if (items.length === 0) {
    return <span className="text-[var(--on-surface-subtle)] font-mono text-xs">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      {items}
    </div>
  );
}

export const SamplingRequestsTable: React.FC<SamplingRequestsTableProps> = ({
  paginatedRequests,
  filteredRequestsCount,
  isLoading,
  selectedIds,
  currentPage,
  pageSize,
  isAdmin,
  isDraftView = false,
  hasActiveFilters,
  selectedTypeFilter = "all",
  onToggleSelectAll,
  onToggleSelectRow,
  onOpenDraftInStaging,
  onInspectRequest,
  onReleaseDraft: _onReleaseDraft,
  onPageChange,
}) => {
  const draftColumns: ColumnDef<SampleRequestItem>[] = useMemo(
    () => [
      {
        id: "srAndMaterial",
        header: "Draft / Material Code",
        cell: (row) => (
          <div className="flex flex-col gap-1 whitespace-nowrap font-mono">
            <div className="font-bold">
              {getPrimaryRequestCode(row, selectedTypeFilter) ? (
                <CopyBadge text={getPrimaryRequestCode(row, selectedTypeFilter)} />
              ) : (
                <span className="pl-1 text-xs text-[var(--on-surface-subtle)]">—</span>
              )}
            </div>
            {getSecondaryRequestCode(row) ? (
              <span className="self-start px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[var(--on-surface-muted)]">
                {getSecondaryRequestCode(row)}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--on-surface-subtle)] pl-1">—</span>
            )}
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        cell: (row) => (
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)] whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate max-w-[160px]" title={row.customer || ""}>
              {row.customer || "—"}
            </span>
          </div>
        ),
      },
      {
        id: "stagedProducts",
        header: "Classification & Staged Product",
        cell: (row) => (
          <div className="max-w-xs">
            <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || "Product"}>
              {row.productDescription || row.materialCode || row.srNumber || "Commercial Product"}
            </div>
            {row.productCategory && (
              <div className="mt-0.5">
                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {row.productCategory}
                </span>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "programName",
        header: "Program & Year",
        cell: (row) => (
          <div className="max-w-xs">
            <span className="block truncate font-medium text-xs text-[var(--on-surface)]" title={row.programName || row.programCampaignTitle || ""}>
              {row.programName || row.programCampaignTitle || "—"}
            </span>
            {row.programYear && (
              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                BY {row.programYear}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "quantity",
        header: "Quantity",
        cell: (row) => renderQuantityCell(row, "all"),
      },
      ...(isAdmin
        ? [
            {
              id: "coordinator",
              header: "Raised By",
              cell: (row: SampleRequestItem) => {
                const creator = row.createdBy || row.requestCreatedBy || "Marketing Team";
                const initials = getInitials(creator);
                const dateCreated = row.dateRequestCreated || row.createdAt;
                return (
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0"
                      title={creator}
                    >
                      {initials}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs text-[var(--on-surface)] truncate max-w-[120px]" title={creator}>
                        {creator}
                      </span>
                      {dateCreated && (
                        <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                          {formatOdooDate(dateCreated)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              },
            },
          ]
        : []),
    ],
    [isAdmin, selectedTypeFilter]
  );

  const standardColumns: ColumnDef<SampleRequestItem>[] = useMemo(() => {
    // 1. Base Column: SR & Material Code (clubbed)
    const srAndMaterialCol: ColumnDef<SampleRequestItem> = {
      id: "srAndMaterial",
      header: "SR / Material Code",
      cell: (row) => (
        <div className="flex flex-col gap-0.5 whitespace-nowrap font-mono">
          <div className="font-bold">
            {getPrimaryRequestCode(row, selectedTypeFilter) ? (
              <CopyBadge text={getPrimaryRequestCode(row, selectedTypeFilter)} />
            ) : (
              <span className="pl-1 text-xs text-[var(--on-surface-subtle)]">—</span>
            )}
          </div>
          {getSecondaryRequestCode(row) ? (
            <span className="self-start px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[var(--on-surface-muted)]">
              {getSecondaryRequestCode(row)}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--on-surface-subtle)] pl-1">—</span>
          )}
        </div>
      ),
    };

    // 2. Base Column: Customer (No plant)
    const customerCol: ColumnDef<SampleRequestItem> = {
      id: "customer",
      header: "Customer",
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)] whitespace-nowrap">
          <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate max-w-[125px]" title={row.customer || ""}>
            {row.customer || "—"}
          </span>
        </div>
      ),
    };

    // Stage Column
    const stageCol: ColumnDef<SampleRequestItem> = {
      id: "status",
      header: "Stage",
      cell: (row) => (
        <StatusPill status={row.status || "Draft"} size="sm" showDot />
      ),
    };

    // Coordinator Column (Admin only)
    const coordinatorCol: ColumnDef<SampleRequestItem> = {
      id: "coordinator",
      header: "Raised By",
      cell: (row: SampleRequestItem) => {
        const creator = row.createdBy || row.requestCreatedBy || "Marketing Team";
        const initials = getInitials(creator);
        const dateCreated = row.dateRequestCreated || row.createdAt;
        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold bg-[#1b4332]/10 dark:bg-emerald-500/20 text-[#1b4332] dark:text-emerald-300 border border-[#1b4332]/20 dark:border-emerald-500/30 shrink-0"
              title={creator}
            >
              {initials}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs text-[var(--on-surface)] truncate max-w-[95px]" title={creator}>
                {creator}
              </span>
              {dateCreated && (
                <span className="text-[9.5px] font-mono text-[var(--on-surface-subtle)]">
                  {formatOdooDate(dateCreated)}
                </span>
              )}
            </div>
          </div>
        );
      },
    };

    // ── SCOPE: SAMPLING ──
    if (selectedTypeFilter === "sample") {
      const cols: ColumnDef<SampleRequestItem>[] = [
        srAndMaterialCol,
        customerCol,
        {
          id: "classification",
          header: "Classification",
          cell: (row) => (
            <div className="min-w-0 max-w-[130px]">
              <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || "Commercial Product"}>
                {row.productDescription || "Commercial Product"}
              </div>
              {row.productCategory && (
                <span className="inline-flex items-center mt-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[110px]" title={row.productCategory}>
                  {row.productCategory}
                </span>
              )}
            </div>
          ),
        },
        {
          id: "brandAndSku",
          header: "Brand / SKU",
          cell: (row) => (
            <div className="flex flex-col whitespace-nowrap min-w-0 max-w-[100px]">
              <span className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.brandName || "—"}>
                {row.brandName || "—"}
              </span>
              {row.customerProductCode ? (
                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] truncate" title={row.customerProductCode}>
                  {row.customerProductCode}
                </span>
              ) : row.barcode ? (
                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] truncate" title={row.barcode}>
                  {row.barcode}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">—</span>
              )}
            </div>
          ),
        },
        {
          id: "sampleQuantity",
          header: "Qty",
          cell: (row) => {
            const qty = quantityLabel(row.qtyForSampling) || "1";
            const unit = row.unitPcPack || "PC";
            const packInfo = unit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack}/pk)` : "";
            return (
              <div className="flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                <span>{qty}</span>
                <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase">{unit}</span>
                {packInfo && (
                  <span className="text-[9px] text-[var(--on-surface-subtle)] font-normal">{packInfo}</span>
                )}
              </div>
            );
          },
        },
        {
          id: "targetSla",
          header: "Req Date",
          cell: (row) => renderRequiredDateCell(row.sampleRequiredDate),
        },
        stageCol,
      ];
      if (isAdmin) cols.push(coordinatorCol);
      return cols;
    }

    // ── SCOPE: DESIGN ──
    if (selectedTypeFilter === "design") {
      const cols: ColumnDef<SampleRequestItem>[] = [
        srAndMaterialCol,
        customerCol,
        {
          id: "classification",
          header: "Classification",
          cell: (row) => (
            <div className="min-w-0 max-w-[160px]">
              <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || "Design Item"}>
                {row.productDescription || "Commercial Product"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {row.productCategory && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 truncate max-w-[120px]" title={row.productCategory}>
                    {row.productCategory}
                  </span>
                )}
                {row.brandName && (
                  <span className="text-[10px] text-[var(--on-surface-subtle)] truncate max-w-[70px]">
                    {row.brandName}
                  </span>
                )}
              </div>
            </div>
          ),
        },
        {
          id: "designCount",
          header: "Designs (Req / Deliv)",
          cell: (row) => {
            const reqDesigns = Number(row.designsCustomerCreative || row.productArtworkNos || row.numberOfDesigns) || 1;
            const recDesigns = (row.creativeSubmissions || []).reduce(
              (total, batch) => total + (Array.isArray(batch?.rows) ? batch.rows.length : 0),
              0
            );
            return (
              <div className="flex items-center gap-1.5 font-mono text-xs whitespace-nowrap">
                <span className="font-bold text-purple-700 dark:text-purple-300">
                  {reqDesigns} Req
                </span>
                <span className="text-[var(--on-surface-subtle)] font-normal">/</span>
                <span className={`font-bold ${recDesigns >= reqDesigns ? "text-emerald-600 dark:text-emerald-400" : recDesigns > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--on-surface-subtle)]"}`}>
                  {recDesigns} Deliv
                </span>
              </div>
            );
          },
        },
        {
          id: "theme",
          header: "Theme / Trend",
          cell: (row) => (
            <div className="whitespace-nowrap max-w-[110px] truncate" title={row.trend || "Standard"}>
              <span className="text-xs font-medium text-[var(--on-surface)]">
                {row.trend || "—"}
              </span>
            </div>
          ),
        },
        {
          id: "targetAudience",
          header: "Target Audience",
          cell: (row) => (
            <div className="whitespace-nowrap max-w-[110px] truncate" title={row.targetAudience || "All Ages"}>
              <span className="text-xs text-[var(--on-surface-muted)]">
                {row.targetAudience || "—"}
              </span>
            </div>
          ),
        },
        {
          id: "targetSla",
          header: "Required Date",
          cell: (row) => renderRequiredDateCell(row.designRequiredDate || row.targetArtworkDateCreative || row.sampleRequiredDate),
        },
        stageCol,
      ];
      if (isAdmin) cols.push(coordinatorCol);
      return cols;
    }

    // ── SCOPE: MOCKUP ──
    if (selectedTypeFilter === "mockup") {
      const cols: ColumnDef<SampleRequestItem>[] = [
        srAndMaterialCol,
        customerCol,
        {
          id: "classification",
          header: "Classification",
          cell: (row) => (
            <div className="min-w-0 max-w-[180px]">
              <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || "Mockup Item"}>
                {row.productDescription || "Commercial Product"}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {row.productCategory && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 truncate max-w-[120px]" title={row.productCategory}>
                    {row.productCategory}
                  </span>
                )}
                {row.brandName && (
                  <span className="text-[10px] text-[var(--on-surface-subtle)] truncate max-w-[80px]">
                    {row.brandName}
                  </span>
                )}
              </div>
            </div>
          ),
        },
        {
          id: "mockupQty",
          header: "Mockup Qty",
          cell: (row) => {
            const mockupQty = quantityLabel((row as any).qtyForMockup || (row as any).mockupQty || (row.mockupWorkflowState as any)?.qtyForMockup) || "1";
            const mockupStage = row.mockupWorkflowState?.stage
              ? row.mockupWorkflowState.stage.replace(/_/g, " ")
              : undefined;
            return (
              <div className="flex flex-col whitespace-nowrap font-mono">
                <div className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <span>{mockupQty}</span>
                  <span className="text-[10px] font-medium text-[var(--on-surface-subtle)] font-sans">
                    Mockup{mockupQty !== "1" ? "s" : ""}
                  </span>
                </div>
                {mockupStage && (
                  <span className="text-[9.5px] text-[var(--on-surface-subtle)] font-sans capitalize">
                    {mockupStage}
                  </span>
                )}
              </div>
            );
          },
        },
        {
          id: "targetSla",
          header: "Required Date",
          cell: (row) => renderRequiredDateCell(row.mockupWorkflowState?.requiredDate || row.sampleRequiredDate),
        },
        stageCol,
      ];
      if (isAdmin) cols.push(coordinatorCol);
      return cols;
    }

    // ── SCOPE: COSTING ──
    if (selectedTypeFilter === "costing") {
      const cols: ColumnDef<SampleRequestItem>[] = [
        srAndMaterialCol,
        customerCol,
        {
          id: "classification",
          header: "Classification",
          cell: (row) => (
            <div className="min-w-0 max-w-[160px]">
              <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || "Costing Item"}>
                {row.productDescription || "Commercial Product"}
              </div>
              {row.productCategory && (
                <span className="inline-flex items-center mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 truncate max-w-[130px]" title={row.productCategory}>
                  {row.productCategory}
                </span>
              )}
            </div>
          ),
        },
        {
          id: "brandAndSku",
          header: "Brand & SKU / Barcode",
          cell: (row) => (
            <div className="flex flex-col whitespace-nowrap min-w-0 max-w-[140px]">
              <span className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.brandName || "—"}>
                {row.brandName || "—"}
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--on-surface-subtle)] truncate">
                {row.customerProductCode && (
                  <span title={`SKU: ${row.customerProductCode}`}>SKU: {row.customerProductCode}</span>
                )}
                {row.customerProductCode && row.barcode && <span>·</span>}
                {row.barcode && (
                  <span title={`BAR: ${row.barcode}`}>BAR: {row.barcode}</span>
                )}
                {!row.customerProductCode && !row.barcode && <span>—</span>}
              </div>
            </div>
          ),
        },
        {
          id: "costingQuantity",
          header: "Costing Quantity",
          cell: (row) => {
            const costingQty = quantityLabel(row.qtyDesignCosting) || "1";
            const costingUnit = row.unitPcPack || "PC";
            const packInfo = costingUnit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack}/pk)` : "";
            return (
              <div className="flex items-center gap-1 font-mono text-xs font-semibold text-sky-700 dark:text-sky-300 whitespace-nowrap">
                <span>{costingQty}</span>
                <span className="text-[10px] font-bold text-[var(--on-surface-muted)] uppercase">{costingUnit}</span>
                {packInfo && (
                  <span className="text-[9.5px] text-[var(--on-surface-subtle)] font-normal">{packInfo}</span>
                )}
              </div>
            );
          },
        },
        {
          id: "costingRequirement",
          header: "Requirement & Route",
          cell: (row) => {
            const hasCreativeInput = row.costingCreativeInputNeeded === true;
            const remark = row.costingCreativeInputRemark || row.marketingRemarks || row.descriptionNotes;
            return (
              <div className="flex flex-col min-w-0 max-w-[150px]">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  {hasCreativeInput ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      Creative First
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                      Direct Costing
                    </span>
                  )}
                </div>
                {remark && (
                  <span className="text-[10px] text-[var(--on-surface-subtle)] truncate mt-0.5" title={remark}>
                    {remark}
                  </span>
                )}
              </div>
            );
          },
        },
        {
          id: "targetSla",
          header: "Required Date",
          cell: (row) => renderRequiredDateCell(row.costingRequiredDate || row.sampleRequiredDate),
        },
        stageCol,
      ];
      if (isAdmin) cols.push(coordinatorCol);
      return cols;
    }

    // ── SCOPE: ALL SCOPES (Default) ──
    const cols: ColumnDef<SampleRequestItem>[] = [
      srAndMaterialCol,
      customerCol,
      {
        id: "classification",
        header: "Classification & Scope",
        cell: (row) => (
          <div className="max-w-xs min-w-0">
            <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.productDescription || row.programName || ""}>
              {row.productDescription || row.programName || "Commercial Product Sample"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {row.productCategory && (
                <span
                  className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 truncate max-w-[130px]"
                  title={`Category: ${row.productCategory}${row.productSubCategory ? " › " + row.productSubCategory : ""}`}
                >
                  {row.productCategory}
                  {row.productSubCategory && (
                    <span className="opacity-75 font-normal ml-0.5">
                      › {row.productSubCategory}
                    </span>
                  )}
                </span>
              )}
              {row.brandName && (
                <span className="text-[10px] text-[var(--on-surface-subtle)] font-sans truncate max-w-[80px]">
                  Brand: {row.brandName}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "requestScope",
        header: "Type of Request",
        cell: (row) => {
          const requestTypes = getRequestTypes(row);
          return (
            <div className="flex items-center gap-1 flex-wrap whitespace-nowrap">
              {requestTypes.map((type) => {
                if (type === "design") {
                  return (
                    <span
                      key="design"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20"
                      title="Design Request"
                    >
                      <Palette className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                      <span>Design</span>
                    </span>
                  );
                }
                if (type === "mockup") {
                  return (
                    <span
                      key="mockup"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      title="Mockup Sample"
                    >
                      <Layers className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                      <span>Mockup</span>
                    </span>
                  );
                }
                if (type === "costing") {
                  return (
                    <span
                      key="costing"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20"
                      title="Costing Estimation"
                    >
                      <Calculator className="w-2.5 h-2.5 text-sky-600 dark:text-sky-400" />
                      <span>Costing</span>
                    </span>
                  );
                }
                return (
                  <span
                    key="sample"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    title="Sampling Production"
                  >
                    <Package className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Sampling</span>
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "quantity",
        header: "Quantity",
        cell: (row) => renderQuantityCell(row, "all"),
      },
      {
        id: "targetSla",
        header: "Required Date",
        cell: (row) => renderRequiredDateCell(getRequestRequiredDate(row)),
      },
      stageCol,
    ];

    if (isAdmin) {
      cols.push(coordinatorCol);
    }

    return cols;
  }, [selectedTypeFilter, isAdmin]);

  return (
    <DataTable
      data={paginatedRequests}
      columns={isDraftView ? draftColumns : standardColumns}
      tableClassName="w-full min-w-0"
      keyExtractor={(row) => row.id}
      isLoading={isLoading}
      emptyMessage={
        hasActiveFilters
          ? "No sample requests match your active search or filter criteria."
          : isDraftView
          ? "Saved draft products will appear here with their customer and program details."
          : "There are currently no commercial sample requests registered in this category."
      }
      onRowClick={(row) => {
        const isDraft = getStageIdForRequest(row) === "draft";
        if (isDraft) {
          onOpenDraftInStaging(row);
        } else {
          onInspectRequest(row);
        }
      }}
      enableSelection={true}
      selectedIds={selectedIds}
      onToggleSelectRow={(id) => onToggleSelectRow(id)}
      onToggleSelectAll={onToggleSelectAll}
      currentPage={currentPage}
      pageSize={pageSize}
      totalCount={filteredRequestsCount}
      onPageChange={onPageChange}
      toolbarLeft={
        <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--on-surface-muted)]">
          <span className="truncate">
            Showing{" "}
            <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
              {filteredRequestsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              {filteredRequestsCount > 0 && (
                <> – {Math.min(filteredRequestsCount, currentPage * pageSize)}</>
              )}
            </span>{" "}
            of{" "}
            <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
              {filteredRequestsCount}
            </span>{" "}
            {isDraftView ? "products" : "requests"}
          </span>
          {selectedIds.size > 0 && (
            <span className="shrink-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-emerald-700 dark:text-emerald-300 font-bold">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      }
    />
  );
};

export default SamplingRequestsTable;
