import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calendar,
  Package,
  Palette,
  Box,
  Calculator,
} from "lucide-react";
import { DataTable } from "@/components/erp";
import type { ColumnDef } from "@/components/erp";
import type { SampleRequestItem } from "../types";
import { getRequestTrackType, getStageIdForRequest } from "../utils/trackTypes";
import { formatOdooDate } from "../utils/dateUtils";
import { getPrimaryRequestCode, getRequestTypes } from "../sampling/utils/requestTypeUtils";
import type { StagedProductItem, DeliverableScopeId } from "../types/staging";

export interface DraftPackageContext {
  id: string;
  customer: string;
  programName: string;
  programYear: string;
  year: string;
  targetPlant: string;
  createdBy: string;
  dateRequestCreated: string;
  requestKind: string;
}

export interface DraftPackageGroup extends DraftPackageContext {
  items: SampleRequestItem[];
}

export interface DraftPackagesViewProps {
  requests: SampleRequestItem[];
  matchingRequestIds: ReadonlySet<string>;
  isLoading: boolean;
  selectedYear: string;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const packageKeyPart = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

function mapDraftItemToStagedProduct(item: SampleRequestItem): StagedProductItem {
  const scopes: DeliverableScopeId[] = (
    item.requestTypes && item.requestTypes.length > 0
      ? (item.requestTypes.filter((s): s is DeliverableScopeId => ["design", "mockup", "sample", "costing"].includes(s)))
      : item.requestKind === "design" ? ["design"] : ["sample"]
  );

  return {
    id: `draft-staged-${item.id}`,
    materialCode: item.materialCode || "",
    productDescription: item.productDescription || "",
    scopes,
    timestamp: item.createdAt || new Date().toISOString(),
    stagedDate: item.createdAt || new Date().toISOString(),
    creationMode: (item.creationMode as any) || "material_code",
    savedRequestId: item.id,
    savedSrNumber: getPrimaryRequestCode(item),
    isDraftSaved: true,
    sourceSampleRequestId: item.sourceSampleRequestId,
    sourceSampleCode: item.sourceSampleCode,
    sourceRequestCode: (item as any).sourceRequestCode || (item.sourceRequestId ? String(item.sourceRequestId) : undefined),
    customBinding1: (item as any).customBinding1 || (item as any).bindingType1,
    customBinding2: (item as any).customBinding2 || (item as any).bindingType2,
    customDetails: item.customDetails,
    plant: item.targetPlant,
    unitPcPack: item.unitPcPack != null ? String(item.unitPcPack) : undefined,
    qtyForSampling: item.qtyForSampling != null ? String(item.qtyForSampling) : undefined,
    qtyDesignCosting: item.qtyDesignCosting != null ? String(item.qtyDesignCosting) : undefined,
    qtyPerPack: item.qtyPerPack != null ? String(item.qtyPerPack) : undefined,
    brandName: item.brandName,
    productType: item.productType,
    productCategory: item.productCategory,
    productSubCategory: item.productSubCategory,
    productThirdCategory: item.productThirdCategory,
    customerProductCode: item.customerProductCode,
    barcode: item.barcode,
    sampleRequiredDate: item.sampleRequiredDate || undefined,
    costingRequiredDate: item.costingRequiredDate || undefined,
  };
}


function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "MK";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const DraftPackagesView: React.FC<DraftPackagesViewProps> = ({
  requests,
  matchingRequestIds,
  isLoading,
  selectedYear,
  currentPage,
  pageSize,
  onPageChange,
}) => {
  const navigate = useNavigate();

  const packageGroups = useMemo(() => {
    const groups = new Map<string, DraftPackageGroup>();

    for (const item of requests) {
      if (getRequestTrackType(item) !== "marketing_request" || getStageIdForRequest(item) !== "draft") {
        continue;
      }
      if (!item.productDescription?.trim() && !item.materialCode?.trim()) {
        continue;
      }

      const customer = item.customer?.trim() || "Unassigned Customer";
      const programName = item.programName?.trim() || item.programCampaignTitle?.trim() || "Standard Program";
      const rawYear = item.programYear || item.year || "2026";
      const programYear = String(rawYear).replace(/BTS/gi, "").trim();
      const requestKind = item.requestKind === "design" || String(item.id).startsWith("design-")
        ? "design"
        : "sample";
      const key = JSON.stringify([customer, programName, programYear].map(packageKeyPart));

      const existing = groups.get(key);
      if (existing) {
        if (existing.requestKind !== requestKind) existing.requestKind = "mixed";
        existing.items.push(item);
        continue;
      }

      groups.set(key, {
        id: key,
        customer,
        programName,
        programYear,
        year: selectedYear,
        targetPlant: item.targetPlant || "1505- Khaniwade",
        createdBy: item.createdBy || "Marketing",
        dateRequestCreated: item.dateRequestCreated || item.createdAt || "",
        requestKind,
        items: [item],
      });
    }

    return Array.from(groups.values())
      .filter((group) => group.items.some((item) => matchingRequestIds.has(String(item.id))))
      .sort((a, b) => b.items.length - a.items.length || a.programName.localeCompare(b.programName));
  }, [matchingRequestIds, requests, selectedYear]);

  const totalStagedItems = useMemo(() => {
    return packageGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [packageGroups]);

  const handleOpenStaging = useCallback((group: DraftPackageGroup, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const first = group.items[0];
    const stagedList: StagedProductItem[] = group.items.map(mapDraftItemToStagedProduct);
    const stagingContext = {
      customer: group.customer || "",
      programName: group.programName || "",
      programYear: group.programYear || "2026",
      year: group.year || "2026-27",
      targetPlant: group.targetPlant || "",
      parentRequestId: first?.id,
      parentSrNumber: first ? getPrimaryRequestCode(first) : "",
      parentRequestTypes: first?.requestTypes || [],
      parentMockupWorkflowState: first?.mockupWorkflowState,
      parentCreationMode: first?.creationMode,
      openedFromDraft: true,
    };
    try {
      sessionStorage.setItem("samp_active_staged_products", JSON.stringify(stagedList));
      sessionStorage.setItem("samp_active_program_form", JSON.stringify(stagingContext));
    } catch {
      // ignore
    }
    navigate("/sample-requests/product-staging", { state: stagingContext });
  }, [navigate]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return packageGroups.slice(start, start + pageSize);
  }, [currentPage, pageSize, packageGroups]);

  const columns = useMemo<ColumnDef<DraftPackageGroup>[]>(() => [
    {
      id: "customer",
      header: "Customer & Target Plant",
      width: "22%",
      cell: (group) => (
        <div className="whitespace-nowrap">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)]">
            <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate max-w-[180px]" title={group.customer}>
              {group.customer}
            </span>
          </div>
          {group.targetPlant && (
            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
              Plant {group.targetPlant}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "programName",
      header: "Program / Campaign",
      width: "24%",
      cell: (group) => (
        <div className="max-w-xs">
          <div className="font-semibold text-xs text-[var(--on-surface)] truncate" title={group.programName}>
            {group.programName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
              <Calendar className="w-2.5 h-2.5 opacity-60" />
              <span>BY {group.programYear}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "stagedProducts",
      header: "Staged Products Preview",
      width: "26%",
      cell: (group) => {
        const firstItem = group.items[0];
        const remainingCount = group.items.length - 1;
        return (
          <div className="max-w-xs">
            <div className="font-medium text-xs text-[var(--on-surface)] truncate" title={firstItem?.productDescription || firstItem?.materialCode || "Product"}>
              {firstItem?.productDescription || firstItem?.materialCode || "Commercial Product"}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {firstItem?.materialCode && (
                <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">
                  {firstItem.materialCode}
                </span>
              )}
              {remainingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  +{remainingCount} more
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "scopesAndItems",
      header: "Scopes & Deliverables",
      width: "16%",
      cell: (group) => {
        const allTypes = new Set<string>();
        group.items.forEach((item) => {
          getRequestTypes(item).forEach((t) => allTypes.add(t));
        });

        return (
          <div className="flex flex-col gap-1 whitespace-nowrap">
            <div className="font-mono text-xs font-bold text-[var(--on-surface)]">
              {group.items.length} {group.items.length === 1 ? "Product" : "Products"}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {allTypes.has("sample") && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" title="Contains Sampling">
                  <Package className="w-2.5 h-2.5" />
                  <span>SMP</span>
                </span>
              )}
              {allTypes.has("design") && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20" title="Contains Design">
                  <Palette className="w-2.5 h-2.5" />
                  <span>DSG</span>
                </span>
              )}
              {allTypes.has("mockup") && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20" title="Contains Mockup">
                  <Box className="w-2.5 h-2.5" />
                  <span>MUP</span>
                </span>
              )}
              {allTypes.has("costing") && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20" title="Contains Costing">
                  <Calculator className="w-2.5 h-2.5" />
                  <span>CST</span>
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "coordinator",
      header: "Coordinator / Staged",
      width: "18%",
      cell: (group) => {
        const creator = group.createdBy || "Marketing";
        const initials = getInitials(creator);
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
              {group.dateRequestCreated && (
                <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                  {formatOdooDate(group.dateRequestCreated)}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: <span className="block text-right">Actions</span>,
      align: "right",
      width: "120px",
      cell: (group) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => handleOpenStaging(group, e)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-all cursor-pointer shadow-2xs hover:border-[var(--accent-primary)]/40 active:scale-95"
            title="Open in Product Staging Form"
          >
            <Package className="w-3 h-3 text-[var(--on-surface-subtle)]" />
            <span>Open Staging</span>
          </button>
        </div>
      ),
    },
  ], [handleOpenStaging]);

  const hasDrafts = requests.some((item) => getStageIdForRequest(item) === "draft");
  const emptyMessage = hasDrafts
    ? "No draft packages match the active filter criteria. Clear filters or adjust your search."
    : "No drafts currently staged. Products saved in intake will appear here grouped by program.";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[var(--surface-lowest)]">
      <DataTable
        data={paginatedGroups}
        columns={columns}
        keyExtractor={(group) => group.id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        onRowClick={handleOpenStaging}
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={packageGroups.length}
        onPageChange={onPageChange}
        toolbarLeft={(
          <div className="flex items-center gap-2 text-xs text-[var(--on-surface-muted)]">
            <span>
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                {packageGroups.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                {packageGroups.length > 0 && <> – {Math.min(currentPage * pageSize, packageGroups.length)}</>}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                {packageGroups.length}
              </span>{" "}
              program packages
            </span>
            <span className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] tabular-nums text-amber-700 dark:text-amber-300 font-bold">
              {totalStagedItems} draft items staged
            </span>
          </div>
        )}
      />
    </div>
  );
};

export default DraftPackagesView;
