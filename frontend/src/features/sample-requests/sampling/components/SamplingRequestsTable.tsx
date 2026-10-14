import React, { useMemo } from "react";
import { SampleRequestItem } from "../../types";
import { getStageIdForRequest } from "../../utils/trackTypes";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, ColumnDef } from "@/components/erp";
import { getRequestTypes } from "../utils/requestTypeUtils";
import { formatOdooDate } from "../../utils/dateUtils";
import {
  Building2,
  Package,
  Palette,
  Layers,
  Calculator,
  Send,
  Trash2,
  ChevronRight,
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
  onDeleteRequest: (row: SampleRequestItem, e?: React.MouseEvent) => Promise<void>;
  onPageChange: (page: number) => void;
  onOpenNewModal?: () => void;
  onResetFilters?: () => void;
}

function getDeliverableColumnHeader(typeFilter: string): string {
  switch (typeFilter) {
    case "sample": return "Sample Qty (PC / Pack)";
    case "design": return "Designs (Req / Delivered)";
    case "mockup": return "Mockup Qty & Specs";
    case "costing": return "Costing Run Volume";
    default: return "Deliverables & Quantities";
  }
}

function quantityLabel(value: string | number | undefined): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return String(value).trim();
}

function renderDeliverableCell(row: SampleRequestItem, typeFilter: string): React.ReactNode {
  const types = getRequestTypes(row);
  const sampleQty = quantityLabel(row.qtyForSampling) || "1";
  const sampleUnit = row.unitPcPack || "PC";
  const samplePackInfo = sampleUnit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack} pcs/pk)` : "";

  const reqDesigns = Number(row.designsCustomerCreative || row.productArtworkNos || row.numberOfDesigns) || 1;
  const recDesigns = (row.creativeSubmissions || []).length;

  const mockupQty = quantityLabel((row as any).qtyForMockup || (row as any).mockupQty || (row.mockupWorkflowState as any)?.qtyForMockup) || "1";
  const mockupStage = row.mockupWorkflowState?.stage
    ? row.mockupWorkflowState.stage.replace(/_/g, " ")
    : "Marketing Prep";

  const costingQty = quantityLabel(row.qtyDesignCosting) || "1";
  const costingUnit = row.unitPcPack || "PC";
  const costingPackInfo = costingUnit === "Pack" && row.qtyPerPack ? ` (${row.qtyPerPack} pcs/pk)` : "";

  if (typeFilter === "sample") {
    if (!types.includes("sample")) return <span className="text-[var(--on-surface-subtle)]">—</span>;
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <span>{sampleQty}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 border border-emerald-500/20 font-bold uppercase">
            {sampleUnit}
          </span>
        </div>
        {samplePackInfo && (
          <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
            {row.qtyPerPack} pcs / pack
          </span>
        )}
      </div>
    );
  }

  if (typeFilter === "design") {
    if (!types.includes("design")) return <span className="text-[var(--on-surface-subtle)]">—</span>;
    const isCompleted = recDesigns >= reqDesigns;
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="font-semibold text-purple-700 dark:text-purple-300">
            {reqDesigns} Req
          </span>
          <span className="text-[var(--on-surface-subtle)]">·</span>
          <span className={`font-semibold ${isCompleted ? "text-emerald-600 dark:text-emerald-400" : recDesigns > 0 ? "text-amber-600 dark:text-amber-400" : "text-[var(--on-surface-subtle)]"}`}>
            {recDesigns} Deliv
          </span>
        </div>
        <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
          {isCompleted ? "All delivered" : `${Math.max(0, reqDesigns - recDesigns)} pending`}
        </span>
      </div>
    );
  }

  if (typeFilter === "mockup") {
    if (!types.includes("mockup")) return <span className="text-[var(--on-surface-subtle)]">—</span>;
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-700 dark:text-amber-400">
          <span>{mockupQty} Mockup{mockupQty !== "1" ? "s" : ""}</span>
        </div>
        <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono capitalize">
          Stage: {mockupStage}
        </span>
      </div>
    );
  }

  if (typeFilter === "costing") {
    if (!types.includes("costing")) return <span className="text-[var(--on-surface-subtle)]">—</span>;
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
          <span>{costingQty}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 border border-teal-500/20 font-bold uppercase">
            {costingUnit}
          </span>
        </div>
        {costingPackInfo && (
          <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
            {row.qtyPerPack} pcs / pack
          </span>
        )}
      </div>
    );
  }

  // "all" view
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {types.includes("sample") && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          SMP: {sampleQty} {sampleUnit}
        </span>
      )}
      {types.includes("design") && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
          DSG: {reqDesigns}R/{recDesigns}D
        </span>
      )}
      {types.includes("mockup") && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          MUP: {mockupQty}
        </span>
      )}
      {types.includes("costing") && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
          CST: {costingQty} {costingUnit}
        </span>
      )}
      {types.length === 0 && <span className="text-[var(--on-surface-subtle)]">—</span>}
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
  onReleaseDraft,
  onDeleteRequest,
  onPageChange,
}) => {
  const draftColumns: ColumnDef<SampleRequestItem>[] = useMemo(
    () => [
      {
        id: "customer",
        header: "Customer Name",
        cell: (row) => (
          <span className="font-semibold text-zinc-900 dark:text-white truncate" title={row.customer || ""}>
            {row.customer || "—"}
          </span>
        ),
      },
      {
        id: "programName",
        header: "Program Name",
        cell: (row) => (
          <span className="block truncate font-medium text-zinc-900 dark:text-white max-w-xs" title={row.programName || row.programCampaignTitle || ""}>
            {row.programName || row.programCampaignTitle || "—"}
          </span>
        ),
      },
      {
        id: "programYear",
        header: "Program Year",
        cell: (row) => (
          <span className="font-mono text-zinc-500 dark:text-zinc-400">
            {row.programYear || "—"}
          </span>
        ),
      },
      {
        id: "stagedProducts",
        header: "Products Staged in This Program",
        cell: (row) => (
          <div className="min-w-[240px]">
            <div className="font-semibold text-zinc-900 dark:text-white">
              {row.productDescription || row.materialCode || row.srNumber || "Product"}
            </div>
            {row.materialCode && (
              <div className="mt-0.5 font-mono text-[10px] text-zinc-400">{row.materialCode}</div>
            )}
          </div>
        ),
      },
      {
        id: "actions",
        header: <span className="block text-right">Actions</span>,
        align: "right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => onOpenDraftInStaging(row, e)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-xs font-semibold font-mono text-[var(--on-surface)] transition cursor-pointer"
              title="Open and edit in Product Staging Workspace"
            >
              <Package className="w-3 h-3 text-[var(--on-surface-subtle)]" />
              <span>Staging</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReleaseDraft(row);
              }}
              className="px-2.5 py-1 rounded-lg text-white text-xs font-bold font-mono transition shadow-xs hover:shadow-sm cursor-pointer flex items-center gap-1 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
              title="Release this request to its assigned workflow"
            >
              <Send className="w-3 h-3" />
              <span>Release</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => onDeleteRequest(row, e)}
                className="p-1.5 text-zinc-400 hover:text-rose-600 transition cursor-pointer rounded-lg hover:bg-rose-500/10"
                title="Delete Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, onOpenDraftInStaging, onReleaseDraft, onDeleteRequest]
  );

  const standardColumns: ColumnDef<SampleRequestItem>[] = useMemo(
    () => [
      {
        id: "srCode",
        header: "SR / Code",
        cell: (row) => (
          <div className="whitespace-nowrap font-mono font-bold">
            <CopyBadge text={row.srNumber || `SR-${row.id}`} />
          </div>
        ),
      },
      {
        id: "materialCode",
        header: "Material Code",
        cell: (row) => (
          <div className="whitespace-nowrap font-mono">
            {row.materialCode ? (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[var(--on-surface)]">
                {row.materialCode}
              </span>
            ) : (
              <span className="text-[var(--on-surface-subtle)]">—</span>
            )}
          </div>
        ),
      },
      {
        id: "classification",
        header: "Classification & Scope",
        cell: (row) => (
          <div className="max-w-xs">
            <div className="font-semibold text-xs text-zinc-900 dark:text-white truncate">
              {row.productDescription || row.programName || "Commercial Product Sample"}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {row.productCategory && (
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-[var(--accent-primary)] border border-emerald-200/60"
                  title={`Category: ${row.productCategory}${row.productSubCategory ? " › " + row.productSubCategory : ""}${row.productThirdCategory ? " › " + row.productThirdCategory : ""}`}
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
                <span className="text-[10px] text-[var(--on-surface-subtle)] font-sans truncate">
                  Brand: {row.brandName}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "requestScope",
        header: "Request Scope",
        cell: (row) => {
          const requestTypes = getRequestTypes(row);
          return (
            <div className="flex items-center gap-1.5 flex-wrap whitespace-nowrap">
              {requestTypes.map((type) => {
                if (type === "design") {
                  return (
                    <span
                      key="design"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                      title="Design Request"
                    >
                      <Palette className="w-2.5 h-2.5 text-purple-600" />
                      <span>Design</span>
                    </span>
                  );
                }
                if (type === "mockup") {
                  return (
                    <span
                      key="mockup"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      title="Mockup Sample"
                    >
                      <Layers className="w-2.5 h-2.5 text-amber-600" />
                      <span>Mockup</span>
                    </span>
                  );
                }
                if (type === "costing") {
                  return (
                    <span
                      key="costing"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                      title="Costing Estimation"
                    >
                      <Calculator className="w-2.5 h-2.5 text-sky-600" />
                      <span>Costing</span>
                    </span>
                  );
                }
                return (
                  <span
                    key="sample"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                    title="Sampling Production"
                  >
                    <Package className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Sampling</span>
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "deliverables",
        header: getDeliverableColumnHeader(selectedTypeFilter),
        cell: (row) => renderDeliverableCell(row, selectedTypeFilter),
      },
      {
        id: "customerPlant",
        header: "Customer & Plant",
        cell: (row) => (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-white">
              <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="truncate max-w-[180px]" title={row.customer || ""}>
                {row.customer || "—"}
              </span>
            </div>
            {row.targetPlant && (
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5 pl-5">
                Plant {row.targetPlant}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "targetSla",
        header: "Target SLA Date",
        cell: (row) => (
          <span className="whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">
            {row.sampleRequiredDate ? formatOdooDate(row.sampleRequiredDate) : "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: "Workflow Stage",
        cell: (row) => (
          <StatusPill status={row.status || "Draft"} size="sm" showDot />
        ),
      },
      {
        id: "actions",
        header: <span className="block text-right">Actions</span>,
        align: "right",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onInspectRequest(row)}
              className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
              title="Inspect Sample Request Details"
            >
              <span>Inspect</span>
              <ChevronRight className="h-3 w-3 text-[var(--on-surface-subtle)]" />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => onDeleteRequest(row, e)}
                className="p-1.5 text-zinc-400 hover:text-rose-600 transition cursor-pointer rounded-lg hover:bg-rose-500/10"
                title="Delete Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [selectedTypeFilter, isAdmin, onInspectRequest, onDeleteRequest]
  );

  return (
    <DataTable
      data={paginatedRequests}
      columns={isDraftView ? draftColumns : standardColumns}
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
        <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="truncate">
            Showing{" "}
            <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
              {filteredRequestsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              {filteredRequestsCount > 0 && (
                <> – {Math.min(filteredRequestsCount, currentPage * pageSize)}</>
              )}
            </span>{" "}
            of{" "}
            <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
              {filteredRequestsCount}
            </span>{" "}
            {isDraftView ? "products" : "requests"}
          </span>
          {selectedIds.size > 0 && (
            <span className="shrink-0 rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      }
    />
  );
};
