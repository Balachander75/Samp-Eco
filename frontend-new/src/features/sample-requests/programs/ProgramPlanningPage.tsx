import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { isMaterialAddedRecently } from "../utils/dateUtils";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";

const NewProgramPlanningModal = React.lazy(() =>
  import("./components/NewProgramPlanningModal").then((m) => ({ default: m.NewProgramPlanningModal }))
);

export interface ProgramPlanningPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  uniquePlants: string[];
  uniqueCustomers?: string[];
  user?: UserProfile | null;
  isAdmin: boolean;
  isReadOnly?: boolean;
  onOpenNewModal: () => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onDeleteRequest: (req: SampleRequestItem, e?: React.MouseEvent) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export type ProgramStageTab = "all" | "awaiting_samp" | "samp_added" | "plant_added";

const hasSampOutput = (request: SampleRequestItem) => Boolean((request.samplingRemark || "").trim());
const hasPlantOutput = (request: SampleRequestItem) => Boolean((request.plantRemark || "").trim());

export const ProgramPlanningPage: React.FC<ProgramPlanningPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  uniqueCustomers,
  isAdmin,
  isReadOnly = false,
  onInspectRequest,
  onDeleteRequest,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<ProgramStageTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Scoped strictly to program planning requests
  const programRequests = useMemo(() => {
    return requests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const sr = String(r.srNumber || "").toLowerCase();
      const mat = String(r.materialCode || "").toLowerCase();
      return (
        kind === "program" ||
        mode === "program_planning" ||
        sr.includes("-pg-") ||
        mat.includes("pg-") ||
        getRequestTrackType(r) === "program_planning"
      );
    });
  }, [requests]);

  // Derived Customers List strictly from programRequests
  const customerList = useMemo(() => {
    if (uniqueCustomers && uniqueCustomers.length > 0) return uniqueCustomers;
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [programRequests, uniqueCustomers]);

  // Derived Plants List strictly from programRequests
  const plantList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.targetPlant && r.targetPlant.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Program Statistics
  const programStats = useMemo(() => {
    let totalSkus = 0;
    let awaitingSamp = 0;
    let sampAdded = 0;
    let plantAdded = 0;

    programRequests.forEach((r) => {
      const matCount = (r.programMaterials || []).length;
      totalSkus += matCount > 0 ? matCount : 1;
      const samp = hasSampOutput(r);
      const plant = hasPlantOutput(r);

      if (!samp) awaitingSamp++;
      else sampAdded++;
      if (plant) plantAdded++;
    });

    return {
      totalPrograms: programRequests.length,
      totalSkus,
      awaitingSamp,
      sampAdded,
      plantAdded,
    };
  }, [programRequests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return programRequests.filter((r) => {
      if (filterTab === "awaiting_samp" && hasSampOutput(r)) return false;
      if (filterTab === "samp_added" && !hasSampOutput(r)) return false;
      if (filterTab === "plant_added" && !hasPlantOutput(r)) return false;

      if (selectedPlantFilter !== "all" && r.targetPlant !== selectedPlantFilter) {
        return false;
      }

      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const code = (r.materialCode || r.srNumber || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const title = (r.programName || r.productDescription || "").toLowerCase();
        const plant = (r.targetPlant || "").toLowerCase();
        if (!code.includes(q) && !cust.includes(q) && !title.includes(q) && !plant.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [programRequests, filterTab, selectedPlantFilter, customerFilter, searchTerm]);

  const clearFilters = () => {
    setFilterTab("all");
    setSearchTerm("");
    setSelectedPlantFilter("all");
    setCustomerFilter("all");
  };

  const handleOpenInspector = (row: SampleRequestItem) => {
    onInspectRequest(row);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `Seasonal_Program_Planning_${dateStr}.csv`,
      columns: [
        { header: "Program Code", accessor: (r) => r.materialCode || "" },
        { header: "SR Number", accessor: (r) => r.srNumber || "" },
        { header: "Campaign Title", accessor: (r) => r.programName || r.productDescription || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Target Plant", accessor: (r) => r.targetPlant || "" },
        { header: "Program Year", accessor: (r) => r.programYear || "2026" },
        { header: "Total SKUs", accessor: (r) => (r.programMaterials || []).length || 1 },
        { header: "SAMP Remark", accessor: (r) => r.samplingRemark || "Awaiting" },
        { header: "Plant Remark", accessor: (r) => r.plantRemark || "Awaiting" },
        { header: "Created By", accessor: (r) => r.createdBy || "Marketing" },
        { header: "Date Created", accessor: (r) => r.dateRequestCreated || "" },
      ],
      data: filteredRequests,
    });
  };

  const kpiItems = [
    {
      label: "All Seasonal Plans",
      value: programStats.totalPrograms,
      detail: `${programStats.totalSkus} total SKUs`,
      color: "bg-indigo-500",
      isActive: filterTab === "all",
      onClick: () => setFilterTab("all"),
    },
    {
      label: "Awaiting SAMP Input",
      value: programStats.awaitingSamp,
      detail: "Action required by SAMP",
      color: "bg-amber-500",
      isActive: filterTab === "awaiting_samp",
      onClick: () => setFilterTab("awaiting_samp"),
    },
    {
      label: "SAMP Notes Given",
      value: programStats.sampAdded,
      detail: "Technical review done",
      color: "bg-emerald-500",
      isActive: filterTab === "samp_added",
      onClick: () => setFilterTab("samp_added"),
    },
    {
      label: "Plant Feasibility Added",
      value: programStats.plantAdded,
      detail: "Factory feedback recorded",
      color: "bg-teal-500",
      isActive: filterTab === "plant_added",
      onClick: () => setFilterTab("plant_added"),
    },
  ];

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "program_id",
        header: "Program ID",
        width: "w-[140px]",
        sortable: true,
        cell: (row) => <CopyBadge text={row.srNumber || row.materialCode || `PG-${row.id}`} />,
      },
      {
        id: "campaign",
        header: "Campaign Title & Product Scope",
        cell: (row) => (
          <div className="max-w-sm">
            <div className="truncate font-semibold text-xs text-[var(--on-surface)]" title={row.programName || row.programCampaignTitle || "Seasonal Program"}>
              {row.programName || row.programCampaignTitle || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
              {row.productDescription || "Multi-SKU scholastic program range"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        width: "w-[160px]",
        cell: (row) => (
          <span className="font-semibold text-xs text-[var(--on-surface)] truncate" title={row.customer || ""}>
            {row.customer || "—"}
          </span>
        ),
      },
      {
        id: "plant",
        header: "Plant",
        width: "w-[100px]",
        cell: (row) => (
          <span className="font-mono text-xs text-[var(--on-surface-muted)]">
            Plant {row.targetPlant || "1505"}
          </span>
        ),
      },
      {
        id: "year",
        header: "Year",
        width: "w-[90px]",
        align: "center",
        cell: (row) => (
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--on-surface-muted)]">
            {row.programYear || "2026"}
          </span>
        ),
      },
      {
        id: "skus",
        header: "Matrix SKUs",
        width: "w-[120px]",
        align: "center",
        cell: (row) => {
          const materials = row.programMaterials || [];
          const skuCount = materials.length > 0 ? materials.length : 1;
          const hasRecent = materials.some((m) => isMaterialAddedRecently(m.createdAt));
          return (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[var(--accent-primary)]">
                {skuCount} SKU{skuCount !== 1 ? "s" : ""}
              </span>
              {hasRecent && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  New
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "notes",
        header: "Team Notes",
        width: "w-[160px]",
        cell: (row) => {
          const samp = hasSampOutput(row);
          const plant = hasPlantOutput(row);
          return (
            <div className="flex flex-col gap-1 items-start">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  samp
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
                }`}
              >
                SAMP: {samp ? "Note added" : "Awaiting"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  plant
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
                }`}
              >
                Plant: {plant ? "Note added" : "Awaiting"}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Commercial Action",
        align: "right",
        width: "w-[130px]",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleOpenInspector(row)}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => onDeleteRequest(row, e)}
                title="Delete program"
                className="inline-flex h-7 w-7 select-none items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [isAdmin, onDeleteRequest]
  );

  return (
    <DeskWorkspaceLayout
      title="Seasonal Program Planning"
      businessYear={selectedYear}
      primaryAction={
        !isReadOnly
          ? {
              label: "New Program Planning",
              icon: Plus,
              onClick: () => setIsNewModalOpen(true),
              title: "Initialize New Seasonal Program with Matrix",
            }
          : undefined
      }
      onRefresh={onRefresh}
      isRefreshing={isLoading}
      onExportCSV={handleExportCSV}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      filterControls={
        <>
          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="min-w-[160px] max-w-[240px]"
              options={[
                { value: "all", label: "All Customers" },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value)}
              className="min-w-[140px]"
              options={[
                { value: "all", label: "All Plants" },
                ...plantList.map((p) => ({ value: p, label: `Plant ${p}` })),
              ]}
            />
          )}
        </>
      }
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Search code, customer, title...",
      }}
      hasActiveFilters={Boolean(
        customerFilter !== "all" || selectedPlantFilter !== "all" || filterTab !== "all" || searchTerm
      )}
      onResetFilters={clearFilters}
      resetFiltersLabel="Clear Filters"
    >
      <DataTable
        data={filteredRequests}
        columns={columns}
        keyExtractor={(req) => req.id}
        isLoading={isLoading}
        emptyMessage={
          searchTerm || customerFilter !== "all" || filterTab !== "all" || selectedPlantFilter !== "all"
            ? "No programs match your search or active filter criteria."
            : "There are currently no seasonal program planning requests submitted."
        }
        onRowClick={handleOpenInspector}
        enableSelection={isAdmin}
        selectedIds={selectedIds}
        onToggleSelectRow={toggleSelectRow}
        onToggleSelectAll={toggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {programRequests.length}
              </span>{" "}
              programs
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-indigo-700 dark:text-indigo-300 font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
        toolbarRight={
          selectedIds.size > 0 && isAdmin ? (
            <button
              type="button"
              onClick={() => {
                const targets = programRequests.filter((r) => selectedIds.has(r.id));
                targets.forEach((t) => onDeleteRequest(t));
                setSelectedIds(new Set());
              }}
              className="inline-flex h-7 select-none items-center gap-1 rounded-md bg-rose-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedIds.size})
            </button>
          ) : undefined
        }
      />

      {/* New Seasonal Program Planning Modal */}
      {isNewModalOpen && (
        <React.Suspense fallback={null}>
          <NewProgramPlanningModal
            isOpen={isNewModalOpen && !isReadOnly}
            onClose={() => setIsNewModalOpen(false)}
            onProceed={(params) => {
              setIsNewModalOpen(false);
              navigate("/sample-requests/program-planning", { state: params });
            }}
          />
        </React.Suspense>
      )}
    </DeskWorkspaceLayout>
  );
};

export default ProgramPlanningPage;
