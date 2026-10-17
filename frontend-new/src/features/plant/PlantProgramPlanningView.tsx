import React, { useState, useMemo, useRef, useEffect } from "react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import {
  Layers,
  Clock,
  CheckCircle2,
  Factory,
  Search,
  X,
  Pause,
} from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface PlantProgramPlanningViewProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedPlant: string;
  onInspectRequest: (req: SampleRequestItem) => void;
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export type PlantProgramTab =
  | "all"
  | "running"
  | "awaiting_review"
  | "reviewed"
  | "samp_note_added";

const hasSampNote = (request: SampleRequestItem) => Boolean(request.samplingRemark?.trim());
const hasPlantNote = (request: SampleRequestItem) => Boolean(request.plantRemark?.trim());

export const PlantProgramPlanningView: React.FC<PlantProgramPlanningViewProps> = ({
  requests,
  isLoading,
  selectedPlant,
  onInspectRequest,
  onRefresh,
  showToast,
}) => {
  const [filterTab, setFilterTab] = useState<PlantProgramTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
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

  // Filter by selectedPlant if not "ALL"
  const plantScopedRequests = useMemo(() => {
    if (!selectedPlant || selectedPlant === "ALL") return programRequests;
    return programRequests.filter(
      (r) => (r.targetPlant || "").toLowerCase() === selectedPlant.toLowerCase()
    );
  }, [programRequests, selectedPlant]);

  // Unique customer list
  const customerList = useMemo(() => {
    const set = new Set<string>();
    plantScopedRequests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [plantScopedRequests]);

  // Unique plant list
  const plantList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Operational metrics
  const metrics = useMemo(() => {
    const total = plantScopedRequests.length;
    let running = 0;
    let awaitingReview = 0;
    let reviewed = 0;
    let totalSKUs = 0;

    plantScopedRequests.forEach((r) => {
      if (r.isActive !== false) running++;
      if (hasPlantNote(r)) reviewed++;
      else awaitingReview++;
      const count = (r.programMaterials || []).length;
      totalSKUs += count > 0 ? count : 1;
    });

    return { total, running, awaitingReview, reviewed, totalSKUs };
  }, [plantScopedRequests]);

  // Main filtered dataset
  const filteredRequests = useMemo(() => {
    return plantScopedRequests.filter((r) => {
      if (filterTab === "running" && r.isActive === false) return false;
      if (filterTab === "awaiting_review" && hasPlantNote(r)) return false;
      if (filterTab === "reviewed" && !hasPlantNote(r)) return false;
      if (filterTab === "samp_note_added" && !hasSampNote(r)) return false;

      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      if (plantFilter !== "all" && r.targetPlant !== plantFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const code = (r.materialCode || r.srNumber || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const desc = (r.productDescription || "").toLowerCase();
        const prog = (r.programName || "").toLowerCase();
        if (!code.includes(q) && !cust.includes(q) && !desc.includes(q) && !prog.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [plantScopedRequests, filterTab, customerFilter, plantFilter, searchTerm]);

  const clearFilters = () => {
    setFilterTab("all");
    setCustomerFilter("all");
    setPlantFilter("all");
    setSearchTerm("");
  };

  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `Plant_Program_Planning_${selectedPlant || "ALL"}_${dateStr}.csv`,
      columns: [
        { header: "Program ID", accessor: (r) => r.materialCode || r.srNumber || "" },
        { header: "Campaign Title", accessor: (r) => r.programName || r.productDescription || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Plant", accessor: (r) => r.targetPlant || "" },
        { header: "Year", accessor: (r) => r.programYear || "2026" },
        { header: "SKUs", accessor: (r) => (r.programMaterials || []).length || 1 },
        { header: "SAMP Note", accessor: (r) => r.samplingRemark || "Awaiting" },
        { header: "Plant Note", accessor: (r) => r.plantRemark || "Awaiting" },
      ],
      data: filteredRequests,
    });
    showToast(`✓ Exported ${filteredRequests.length} program(s) to CSV`);
  };

  const kpiItems = [
    {
      label: "All Programs",
      value: metrics.total,
      detail: `${metrics.totalSKUs} total SKUs`,
      color: "bg-indigo-500",
      isActive: filterTab === "all" && customerFilter === "all" && plantFilter === "all" && !searchTerm,
      onClick: clearFilters,
    },
    {
      label: "Program Running",
      value: metrics.running,
      detail: "Active programs",
      color: "bg-emerald-600",
      isActive: filterTab === "running",
      onClick: () => setFilterTab("running"),
    },
    {
      label: "Plant Note Needed",
      value: metrics.awaitingReview,
      detail: "Awaiting factory note",
      color: "bg-amber-500",
      isActive: filterTab === "awaiting_review",
      onClick: () => setFilterTab("awaiting_review"),
    },
    {
      label: "Plant Note Added",
      value: metrics.reviewed,
      detail: "Factory review added",
      color: "bg-emerald-500",
      isActive: filterTab === "reviewed",
      onClick: () => setFilterTab("reviewed"),
    },
    {
      label: "SAMP Note Added",
      value: plantScopedRequests.filter(hasSampNote).length,
      detail: "Sampling input ready",
      color: "bg-teal-500",
      isActive: filterTab === "samp_note_added",
      onClick: () => setFilterTab("samp_note_added"),
    },
  ];

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
              className="truncate font-semibold text-xs text-[var(--text-primary)]"
              title={row.programName || row.programCampaignTitle || "Seasonal Program"}
            >
              {row.programName || row.programCampaignTitle || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10.5px] font-mono text-[var(--text-muted)]">
              {row.productDescription || "Multi-SKU scholastic program range"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer & Plant",
        width: "w-[170px]",
        cell: (row) => (
          <div className="flex flex-col gap-0.5 items-start min-w-0">
            <span
              className="font-semibold text-xs text-[var(--text-primary)] truncate max-w-full"
              title={row.customer || "—"}
            >
              {row.customer || "—"}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--text-secondary)]">
              <Factory className="w-2.5 h-2.5 opacity-70 shrink-0" />
              <span>Plant {row.targetPlant || "1505"}</span>
            </span>
          </div>
        ),
      },
      {
        id: "skus",
        header: "Matrix SKUs",
        width: "w-[105px]",
        align: "center",
        cell: (row) => {
          const materials = row.programMaterials || [];
          const skuCount = materials.length > 0 ? materials.length : 1;
          const substrates = Array.from(
            new Set(materials.map((m) => m.materialType?.trim()).filter(Boolean) as string[])
          ).slice(0, 2);
          return (
            <div className="flex flex-col items-center gap-0.5 font-mono">
              <span className="rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--accent-primary)]">
                {skuCount} SKU{skuCount !== 1 ? "s" : ""}
              </span>
              {substrates.length > 0 && (
                <span className="text-[9.5px] text-[var(--text-muted)] truncate max-w-[95px]">
                  {substrates.join(" · ")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "samp_review",
        header: "SAMP Review",
        width: "w-[125px]",
        cell: (row) => {
          const samp = hasSampNote(row);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                samp
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                  : "bg-[var(--surface-low)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
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
        width: "w-[125px]",
        cell: (row) => {
          const plant = hasPlantNote(row);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                plant
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "bg-[var(--surface-low)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
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
        width: "w-[105px]",
        cell: (row) => {
          const isPaused = row.isActive === false;
          return isPaused ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
              <Pause className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Paused</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Active</span>
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <DeskWorkspaceLayout
      title="Program Planning"
      onRefresh={onRefresh}
      isRefreshing={isLoading}
      onExportCSV={handleExportCsv}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-5"
      filterControls={
        <>
          {/* Quick Stage Segmented Tabs */}
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5 shadow-2xs shrink-0">
            {[
              { id: "all", label: "All Plans", icon: Layers, count: metrics.total },
              { id: "running", label: "Running", icon: Layers, count: metrics.running },
              { id: "awaiting_review", label: "Awaiting Review", icon: Clock, count: metrics.awaitingReview },
              { id: "reviewed", label: "Plant Reviewed", icon: CheckCircle2, count: metrics.reviewed },
              { id: "samp_note_added", label: "SAMP Notes", icon: Factory, count: plantScopedRequests.filter(hasSampNote).length },
            ].map((item) => {
              const isSelected = filterTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterTab(item.id as PlantProgramTab)}
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
                ...customerList.map((customer) => ({ value: customer, label: customer })),
              ]}
            />
          )}

          {/* Plant Filter Dropdown */}
          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="min-w-[110px] max-w-[140px]"
              options={[
                { value: "all", label: `Plants (${plantList.length})` },
                ...plantList.map((plant) => ({ value: plant, label: `Plant ${plant}` })),
              ]}
            />
          )}
        </>
      }
      hasActiveFilters={Boolean(
        customerFilter !== "all" || plantFilter !== "all" || filterTab !== "all" || searchTerm
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
          searchTerm || customerFilter !== "all" || filterTab !== "all" || plantFilter !== "all"
            ? "No programs match your search or active filter criteria."
            : `There are currently no seasonal program planning requests assigned to plant ${selectedPlant || "ALL"}.`
        }
        onRowClick={onInspectRequest}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {plantScopedRequests.length}
              </span>{" "}
              programs
            </span>
          </div>
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default PlantProgramPlanningView;
