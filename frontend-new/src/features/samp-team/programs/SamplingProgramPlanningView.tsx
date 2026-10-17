import React, { useState, useMemo, useRef, useEffect } from "react";
import { UserProfile } from "@/features/auth";
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
import { isMaterialAddedRecently } from "@/features/sample-requests/utils/dateUtils";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface SamplingProgramPlanningViewProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedPlant: string;
  uniquePlants: string[];
  user?: UserProfile | null;
  isAdmin: boolean;
  onInspectRequest: (req: SampleRequestItem) => void;
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export type SampProgramTab = "all" | "running" | "pending_note" | "samp_note_added" | "plant_note_added";

const hasSampNote = (request: SampleRequestItem) => Boolean(request.samplingRemark?.trim());
const hasPlantNote = (request: SampleRequestItem) => Boolean(request.plantRemark?.trim());

export const SamplingProgramPlanningView: React.FC<SamplingProgramPlanningViewProps> = ({
  requests,
  isLoading,
  onInspectRequest,
  onRefresh,
  showToast,
}) => {
  const [filterTab, setFilterTab] = useState<SampProgramTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [plantFilter, setPlantFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
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

  // Derived Customers List strictly from programRequests
  const customerList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Derived Plants List strictly from programRequests
  const plantList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Operational metrics
  const metrics = useMemo(() => {
    const total = programRequests.length;
    let running = 0;
    let pending = 0;
    let sampNotes = 0;
    let plantNotes = 0;
    let totalMaterials = 0;

    programRequests.forEach((r) => {
      if (r.isActive !== false) running++;
      if (hasSampNote(r)) sampNotes++;
      else pending++;
      if (hasPlantNote(r)) plantNotes++;
      totalMaterials += (r.programMaterials || []).length;
    });

    return { total, running, pending, sampNotes, plantNotes, totalMaterials };
  }, [programRequests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return programRequests.filter((r) => {
      if (filterTab === "running" && r.isActive === false) return false;
      if (filterTab === "pending_note" && hasSampNote(r)) return false;
      if (filterTab === "samp_note_added" && !hasSampNote(r)) return false;
      if (filterTab === "plant_note_added" && !hasPlantNote(r)) return false;

      if (plantFilter !== "all" && r.targetPlant !== plantFilter) {
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
  }, [programRequests, filterTab, plantFilter, customerFilter, searchTerm]);

  const clearFilters = () => {
    setFilterTab("all");
    setSearchTerm("");
    setPlantFilter("all");
    setCustomerFilter("all");
  };

  // Export CSV
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `SAMP_Program_Planning_Review_${dateStr}.csv`,
      columns: [
        { header: "Program Code", accessor: (r) => r.requestCode || r.materialCode || "" },
        { header: "Campaign Title", accessor: (r) => r.programName || r.productDescription || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Target Plant", accessor: (r) => r.targetPlant || "" },
        { header: "Program Year", accessor: (r) => r.programYear || "2026" },
        { header: "SAMP Note", accessor: (r) => (hasSampNote(r) ? "Added" : "Awaiting") },
        { header: "Plant Note", accessor: (r) => (hasPlantNote(r) ? "Added" : "Awaiting") },
        { header: "Materials Count", accessor: (r) => (r.programMaterials || []).length },
        { header: "Created By", accessor: (r) => r.createdBy || "Marketing" },
        { header: "Date Created", accessor: (r) => r.dateRequestCreated || "" },
      ],
      data: filteredRequests,
    });
    showToast(`✓ Exported ${filteredRequests.length} program plan(s) to CSV`);
  };

  const kpiItems = [
    {
      label: "All Programs",
      value: metrics.total,
      detail: `${metrics.totalMaterials} SKUs tracked`,
      color: "bg-indigo-500",
      isActive: filterTab === "all",
      onClick: () => setFilterTab("all"),
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
      label: "Awaiting SAMP Note",
      value: metrics.pending,
      detail: "Action required by SAMP",
      color: "bg-amber-500",
      isActive: filterTab === "pending_note",
      onClick: () => setFilterTab("pending_note"),
    },
    {
      label: "SAMP Note Added",
      value: metrics.sampNotes,
      detail: "Technical feedback given",
      color: "bg-emerald-500",
      isActive: filterTab === "samp_note_added",
      onClick: () => setFilterTab("samp_note_added"),
    },
    {
      label: "Plant Note Added",
      value: metrics.plantNotes,
      detail: "Plant feedback verified",
      color: "bg-teal-500",
      isActive: filterTab === "plant_note_added",
      onClick: () => setFilterTab("plant_note_added"),
    },
  ];

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "program_id",
        header: "Program ID",
        width: "w-[135px]",
        sortable: true,
        cell: (r) => (
          <div className="flex flex-col gap-0.5 items-start">
            <CopyBadge text={r.requestCode || r.materialCode || `PP-${r.id}`} />
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] font-medium">
              BY {r.programYear || "2026"}
            </span>
          </div>
        ),
      },
      {
        id: "campaign",
        header: "Campaign Title & Scope",
        cell: (r) => (
          <div className="max-w-md">
            <div
              className="truncate font-semibold text-xs text-[var(--on-surface)]"
              title={r.programName || r.productDescription || "Seasonal Program"}
            >
              {r.programName || r.productDescription || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10.5px] font-mono text-[var(--on-surface-subtle)]">
              {r.productDescription || "Multi-SKU scholastic program range"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer & Plant",
        width: "w-[170px]",
        cell: (r) => (
          <div className="flex flex-col gap-0.5 items-start min-w-0">
            <span
              className="font-semibold text-xs text-[var(--on-surface)] truncate max-w-full"
              title={r.customer || "—"}
            >
              {r.customer || "—"}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--on-surface-muted)]">
              <Factory className="w-2.5 h-2.5 opacity-70 shrink-0" />
              <span>Plant {r.targetPlant || "1505"}</span>
            </span>
          </div>
        ),
      },
      {
        id: "skus",
        header: "Matrix SKUs",
        width: "w-[105px]",
        align: "center",
        cell: (r) => {
          const materialCount = (r.programMaterials || []).length;
          const hasRecent = (r.programMaterials || []).some((m) => isMaterialAddedRecently(m.createdAt));
          return (
            <div className="flex items-center justify-center gap-1">
              <span className="inline-flex items-center rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[var(--accent-primary)]">
                {materialCount} SKU{materialCount !== 1 ? "s" : ""}
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
        width: "w-[125px]",
        cell: (r) => {
          const sampNoteAdded = hasSampNote(r);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                sampNoteAdded
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] border border-[var(--border-subtle)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sampNoteAdded ? "bg-emerald-500" : "bg-neutral-400"}`} />
              <span>{sampNoteAdded ? "Note Added" : "Awaiting"}</span>
            </span>
          );
        },
      },
      {
        id: "plant_review",
        header: "Plant Review",
        width: "w-[125px]",
        cell: (r) => {
          const plantNoteAdded = hasPlantNote(r);
          return (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                plantNoteAdded
                  ? "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)] border border-[var(--border-subtle)]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${plantNoteAdded ? "bg-teal-500" : "bg-neutral-400"}`} />
              <span>{plantNoteAdded ? "Note Added" : "Awaiting"}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        width: "w-[105px]",
        cell: (r) => {
          const isPaused = r.isActive === false;
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
      {
        id: "submitter",
        header: "Raised By",
        width: "w-[120px]",
        cell: (r) => (
          <div className="font-mono text-xs text-[var(--on-surface-muted)]">
            <div className="truncate font-medium">{r.createdBy || "Marketing"}</div>
            <div className="text-[10px] text-[var(--on-surface-subtle)]">
              {r.dateRequestCreated || "Recent"}
            </div>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <DeskWorkspaceLayout
      title="Program Planning"
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
              { id: "all", label: "All Plans", icon: Layers, count: metrics.total },
              { id: "running", label: "Running", icon: Layers, count: metrics.running },
              { id: "pending_note", label: "Awaiting Review", icon: Clock, count: metrics.pending },
              { id: "samp_note_added", label: "SAMP Notes", icon: CheckCircle2, count: metrics.sampNotes },
              { id: "plant_note_added", label: "Plant Notes", icon: Factory, count: metrics.plantNotes },
            ].map((item) => {
              const isSelected = filterTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilterTab(item.id as SampProgramTab)}
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
              placeholder="Search code, campaign, customer... ('/')"
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
            : "There are currently no seasonal program planning requests submitted."
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
                {programRequests.length}
              </span>{" "}
              programs
            </span>
          </div>
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default SamplingProgramPlanningView;
