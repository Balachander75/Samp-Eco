import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
import {
  Plus,
  Trash2,
  Layers,
  Clock,
  CheckCircle2,
  Factory,
  Search,
  X,
  Pause,
  Play,
} from "lucide-react";
import { isMaterialAddedRecently } from "../utils/dateUtils";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { pauseProgramRequestApi } from "@/infrastructure/api/programsApi";

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

export type ProgramStageTab = "all" | "running" | "awaiting_samp" | "samp_added" | "plant_added";

const hasSampOutput = (request: SampleRequestItem) => Boolean((request.samplingRemark || "").trim());
const hasPlantOutput = (request: SampleRequestItem) => Boolean((request.plantRemark || "").trim());

export const ProgramPlanningPage: React.FC<ProgramPlanningPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  uniqueCustomers,
  user,
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Scoped strictly to program planning requests
  const programRequests = useMemo(() => {
    return requests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const code = String(r.requestCode || "").toLowerCase();
      const sr = String(r.srNumber || "").toLowerCase();
      const mat = String(r.materialCode || "").toLowerCase();
      return (
        kind === "program" ||
        mode === "program_planning" ||
        code.startsWith("pp-") ||
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
    let running = 0;
    let awaitingSamp = 0;
    let sampAdded = 0;
    let plantAdded = 0;

    programRequests.forEach((r) => {
      if (r.isActive !== false) running++;
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
      running,
      awaitingSamp,
      sampAdded,
      plantAdded,
    };
  }, [programRequests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return programRequests.filter((r) => {
      if (filterTab === "running" && r.isActive === false) return false;
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
        const code = (r.requestCode || r.materialCode || r.srNumber || "").toLowerCase();
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
        { header: "Program Code", accessor: (r) => r.requestCode || r.materialCode || "" },
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
      label: "Program Running",
      value: programStats.running,
      detail: "Active in development",
      color: "bg-emerald-600",
      isActive: filterTab === "running",
      onClick: () => setFilterTab("running"),
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

  const [togglingId, setTogglingId] = useState<string | number | null>(null);

  const handleTogglePause = async (req: SampleRequestItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const willPause = req.isActive !== false;
    setTogglingId(req.id);
    try {
      await pauseProgramRequestApi(req.id, willPause);
      await onRefresh();
    } catch (err) {
      console.error("Could not toggle program pause status:", err);
      alert(err instanceof Error ? err.message : "Failed to update program status");
    } finally {
      setTogglingId(null);
    }
  };

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "program_id",
        header: "Program ID",
        width: "w-[135px]",
        sortable: true,
        cell: (row) => (
          <div className="flex flex-col gap-0.5 items-start">
            <CopyBadge text={row.requestCode || row.materialCode || `PP-${row.id}`} />
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] font-medium">
              BY {row.programYear || "2026"}
            </span>
          </div>
        ),
      },
      {
        id: "campaign",
        header: "Campaign Title & Product Scope",
        cell: (row) => (
          <div className="max-w-md">
            <div
              className="truncate font-semibold text-xs text-[var(--on-surface)]"
              title={row.programName || row.programCampaignTitle || "Seasonal Program"}
            >
              {row.programName || row.programCampaignTitle || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
              {row.productDescription || "Multi-SKU scholastic program range"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer & Plant",
        width: "w-[160px]",
        cell: (row) => (
          <div className="flex flex-col gap-0.5 items-start min-w-0">
            <span
              className="font-semibold text-xs text-[var(--on-surface)] truncate max-w-full"
              title={row.customer || "—"}
            >
              {row.customer || "—"}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--on-surface-muted)]">
              <Factory className="w-2.5 h-2.5 opacity-70 shrink-0" />
              <span>Plant {row.targetPlant || "1505"}</span>
            </span>
          </div>
        ),
      },
      {
        id: "skus",
        header: "Matrix SKUs",
        width: "w-[95px]",
        align: "center",
        cell: (row) => {
          const materials = row.programMaterials || [];
          const skuCount = materials.length > 0 ? materials.length : 1;
          const hasRecent = materials.some((m) => isMaterialAddedRecently(m.createdAt));
          return (
            <div className="flex items-center justify-center gap-1">
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
        id: "samp_review",
        header: "SAMP Review",
        width: "w-[130px]",
        cell: (row) => {
          const samp = hasSampOutput(row);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                samp
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] border border-[var(--border-subtle)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${samp ? "bg-emerald-500" : "bg-neutral-400"}`} />
              <span>{samp ? "Note Added" : "Awaiting"}</span>
            </span>
          );
        },
      },
      {
        id: "plant_review",
        header: "Plant Review",
        width: "w-[130px]",
        cell: (row) => {
          const plant = hasPlantOutput(row);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                plant
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] border border-[var(--border-subtle)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${plant ? "bg-teal-500" : "bg-neutral-400"}`} />
              <span>{plant ? "Note Added" : "Awaiting"}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        width: "w-[145px]",
        cell: (row) => {
          const isPaused = row.isActive === false;
          const canPause = !isReadOnly && user?.team === "marketing";
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isPaused ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  <Pause className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Paused</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Active</span>
                </span>
              )}
              {canPause && (
                <button
                  type="button"
                  onClick={(e) => handleTogglePause(row, e)}
                  disabled={togglingId === row.id}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer select-none active:scale-95 ${
                    isPaused
                      ? "text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                      : "text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60"
                  }`}
                  title={isPaused ? "Resume this program" : "Pause this program"}
                >
                  {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [isAdmin, isReadOnly, user, togglingId]
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
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-5"
      filterControls={
        <>
          {/* Quick Stage Segmented Tabs */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5 shadow-2xs shrink-0">
            {[
              { id: "all", label: "All Plans", icon: Layers, count: programStats.totalPrograms },
              { id: "running", label: "Running", icon: Play, count: programStats.running },
              { id: "awaiting_samp", label: "Awaiting SAMP", icon: Clock, count: programStats.awaitingSamp },
              { id: "samp_added", label: "SAMP Notes", icon: CheckCircle2, count: programStats.sampAdded },
              { id: "plant_added", label: "Plant Notes", icon: Factory, count: programStats.plantAdded },
            ].map((item) => {
              const isSelected = filterTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterTab(item.id as ProgramStageTab)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                    isSelected
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold border border-[var(--border-subtle)]"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-lowest)]/50"
                  }`}
                >
                  <item.icon className={`w-3 h-3 ${isSelected ? "text-[var(--accent-primary)]" : "opacity-70"}`} />
                  <span>{item.label}</span>
                  <span
                    className={`text-[9.5px] font-mono px-1 py-0.2 rounded-full tabular-nums ${
                      isSelected
                        ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                        : "text-[var(--on-surface-subtle)] bg-[var(--surface-lowest)]/60"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Integrated Search Input right next to Stage Tabs */}
          <div className="group relative min-w-[180px] flex-1 max-w-[280px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search code, customer, title... ('/')"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] pl-8 pr-7 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Customer Filter Dropdown */}
          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="min-w-[130px] max-w-[170px]"
              options={[
                { value: "all", label: `Customers (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          {/* Plant Filter Dropdown */}
          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={selectedPlantFilter}
              onChange={(e) => setSelectedPlantFilter(e.target.value)}
              className="min-w-[110px] max-w-[140px]"
              options={[
                { value: "all", label: `Plants (${plantList.length})` },
                ...plantList.map((p) => ({ value: p, label: `Plant ${p}` })),
              ]}
            />
          )}
        </>
      }
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
