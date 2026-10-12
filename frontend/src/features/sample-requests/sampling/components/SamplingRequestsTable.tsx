import React from "react";
import { SampleRequestItem } from "../../types";
import { getStageIdForRequest } from "../../utils/trackTypes";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { EmptyState } from "@/components/ui/EmptyState";
import { PaginationBar } from "@/components/erp/PaginationBar";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
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
  RefreshCw,
  Clock,
  CheckCircle2,
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
  totalPages,
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
  onOpenNewModal,
  onResetFilters,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col text-[var(--on-surface)]">
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--surface-low)] border-b border-[var(--border-subtle)]">
            <tr className="text-[var(--on-surface-muted)] font-mono text-[11px] uppercase tracking-wider select-none">
              <th className="py-3 pl-6 pr-3 w-8">
                <input
                  type="checkbox"
                  checked={
                    paginatedRequests.length > 0 &&
                    paginatedRequests.every((r) => selectedIds.has(r.id))
                  }
                  onChange={onToggleSelectAll}
                  className="rounded accent-[var(--accent-primary)] cursor-pointer"
                />
              </th>
              {isDraftView ? (
                <>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer Name</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Program Name</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Program Year</th>
                  <th className="py-3 px-4 font-semibold">Products Staged in This Program</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">SR / Code</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Material Code</th>
                  <th className="py-3 px-4 font-semibold">Classification & Scope</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Request Scope</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">{getDeliverableColumnHeader(selectedTypeFilter)}</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer & Plant</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Target SLA Date</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Workflow Stage</th>
                </>
              )}
              <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <TableSkeletonRows rows={8} columns={isDraftView ? 6 : 10} />
            ) : paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={isDraftView ? 6 : 10} className="py-16 text-center">
                  <EmptyState
                    icon={Package}
                    title={isDraftView ? "No Draft Products Found" : "No Sample Requests Found"}
                    description={
                      hasActiveFilters
                        ? "No sample requests match your active search or filter criteria."
                        : isDraftView
                          ? "Saved draft products will appear here with their customer and program details."
                          : "There are currently no commercial sample requests registered in this category."
                    }
                    onResetFilters={hasActiveFilters ? onResetFilters : undefined}
                    resetLabel="Reset filters"
                    action={
                      !hasActiveFilters && onOpenNewModal ? (
                        <button
                          type="button"
                          onClick={onOpenNewModal}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white shadow-xs transition active:scale-98 cursor-pointer bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                        >
                          Create New Request
                        </button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              paginatedRequests.map((row) => {
                const isDraft = getStageIdForRequest(row) === "draft";
                const srCode = row.srNumber || `SR-${row.id}`;
                const requestTypes = getRequestTypes(row);
                const isSelected = selectedIds.has(row.id);

                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (isDraft) {
                        onOpenDraftInStaging(row);
                      } else {
                        onInspectRequest(row);
                      }
                    }}
                    className={`hover:bg-[var(--surface-low)] transition-colors cursor-pointer group ${
                      isSelected ? "bg-[var(--accent-primary-subtle)]" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="py-3.5 pl-6 pr-3 w-8"
                      onClick={(e) => onToggleSelectRow(row.id, e)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded accent-[var(--accent-primary)] cursor-pointer"
                      />
                    </td>

                    {isDraftView ? (
                      <>
                        <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                          <span className="truncate" title={row.customer || ""}>{row.customer || "—"}</span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="block truncate font-medium text-[var(--on-surface)]" title={row.programName || row.programCampaignTitle || ""}>
                            {row.programName || row.programCampaignTitle || "—"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--on-surface-muted)]">
                          {row.programYear || "—"}
                        </td>
                        <td className="py-3.5 px-4 min-w-[260px]">
                          <div className="font-semibold text-[var(--on-surface)]">
                            {row.productDescription || row.materialCode || row.srNumber || "Product"}
                          </div>
                          {row.materialCode && (
                            <div className="mt-0.5 font-mono text-[10px] text-[var(--on-surface-subtle)]">{row.materialCode}</div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                    {/* SR / Code */}
                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                      <CopyBadge text={srCode} />
                    </td>

                    {/* Material Code */}
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                      {row.materialCode ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[var(--on-surface)]">
                          {row.materialCode}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">—</span>
                      )}
                    </td>

                    {/* Classification & Scope */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-xs text-[var(--on-surface)] truncate">
                        {row.productDescription || row.programName || "Commercial Product Sample"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {row.productCategory && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-[var(--accent-primary)] border border-emerald-200/60"
                            title={`Category: ${row.productCategory}${row.productSubCategory ? ' › ' + row.productSubCategory : ''}${row.productThirdCategory ? ' › ' + row.productThirdCategory : ''}`}
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
                    </td>

                    {/* Request Scope */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {requestTypes.map((type) => {
                          if (type === "design") {
                            return (
                              <span
                                key="design"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                title="Design Request"
                              >
                                <Palette className="w-3 h-3 text-purple-600" />
                                <span>Design</span>
                              </span>
                            );
                          }
                          if (type === "mockup") {
                            return (
                              <span
                                key="mockup"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                title="Mockup Sample"
                              >
                                <Layers className="w-3 h-3 text-amber-600" />
                                <span>Mockup</span>
                              </span>
                            );
                          }
                          if (type === "costing") {
                            return (
                              <span
                                key="costing"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                                title="Costing Estimation"
                              >
                                <Calculator className="w-3 h-3 text-sky-600" />
                                <span>Costing</span>
                              </span>
                            );
                          }
                          return (
                            <span
                              key="sample"
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30"
                              title="Sampling Production"
                            >
                              <Package className="w-3 h-3 text-emerald-600" />
                              <span>Sampling</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Dynamic Deliverables & Quantity Cell */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderDeliverableCell(row, selectedTypeFilter)}
                    </td>

                    {/* Customer & Plant */}
                    <td className="py-3.5 px-4 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
                        <span className="truncate max-w-[180px]" title={row.customer || ""}>
                          {row.customer || "—"}
                        </span>
                      </div>
                      {row.targetPlant && (
                        <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
                          Plant {row.targetPlant}
                        </div>
                      )}
                    </td>

                    {/* Target SLA Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[var(--on-surface-muted)]">
                      {row.sampleRequiredDate ? (
                        formatOdooDate(row.sampleRequiredDate)
                      ) : (
                        <span className="text-[var(--on-surface-subtle)]">Flexible</span>
                      )}
                    </td>

                    {/* Stage Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusPill status={row.status || "Draft"} />
                    </td>
                      </>
                    )}

                    {/* Actions */}
                    <td
                      className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {isDraft ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => onOpenDraftInStaging(row, e)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] text-xs font-medium font-mono transition cursor-pointer flex items-center gap-1"
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
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onInspectRequest(row)}
                            className="px-3 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] text-xs font-medium font-mono transition cursor-pointer"
                            title="Inspect Sample Request Details"
                          >
                            Inspect
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => onDeleteRequest(row, e)}
                            className="p-1.5 text-[var(--on-surface-subtle)] hover:text-rose-600 transition cursor-pointer rounded-lg hover:bg-rose-500/10"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Pagination */}
      <div className="mt-auto px-6 py-2.5 bg-[var(--surface-lowest)] border-t border-[var(--border-subtle)] text-[var(--on-surface-subtle)] flex items-center justify-between text-xs text-[var(--on-surface-subtle)] font-mono shrink-0">
        <span>
          Showing {filteredRequestsCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          {filteredRequestsCount > 0 && <> – {Math.min(filteredRequestsCount, currentPage * pageSize)}</>} of {filteredRequestsCount} sample requests
        </span>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-[var(--on-surface-subtle)]">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]"></span>
            Sorted by Latest Raised Intake
          </span>
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filteredRequestsCount}
            pageSize={pageSize}
            onPageChange={onPageChange}
            itemLabel={isDraftView ? "products" : "requests"}
            className="border-t-0 p-0"
          />
        </div>
      </div>
    </div>
  );
};
