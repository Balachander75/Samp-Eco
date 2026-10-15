import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import { ChevronRight } from "lucide-react";
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

export type SampProgramTab = "all" | "pending_note" | "samp_note_added" | "plant_note_added";

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
    let pending = 0;
    let sampNotes = 0;
    let plantNotes = 0;
    let totalMaterials = 0;

    programRequests.forEach((r) => {
      if (hasSampNote(r)) sampNotes++;
      else pending++;
      if (hasPlantNote(r)) plantNotes++;
      totalMaterials += (r.programMaterials || []).length;
    });

    return { total, pending, sampNotes, plantNotes, totalMaterials };
  }, [programRequests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return programRequests.filter((r) => {
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
        { header: "Program Code", accessor: (r) => r.materialCode || "" },
        { header: "SR Number", accessor: (r) => r.srNumber || "" },
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
        width: "w-[140px]",
        sortable: true,
        cell: (r) => <CopyBadge text={r.materialCode || r.srNumber || `PG-${r.id}`} />,
      },
      {
        id: "campaign",
        header: "Campaign Title & Scope",
        cell: (r) => (
          <div className="max-w-xs">
            <div className="truncate font-semibold text-xs text-[var(--on-surface)]" title={r.programName || r.productDescription || "Seasonal Program"}>
              {r.programName || r.productDescription || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
              {r.productDescription || "Multi-SKU range"}
            </div>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
        width: "w-[160px]",
        cell: (r) => (
          <span className="font-semibold text-xs text-[var(--on-surface)] truncate" title={r.customer || ""}>
            {r.customer || "—"}
          </span>
        ),
      },
      {
        id: "plant",
        header: "Plant",
        width: "w-[100px]",
        cell: (r) => (
          <span className="font-mono text-xs text-[var(--on-surface-muted)]">
            Plant {r.targetPlant || "1505"}
          </span>
        ),
      },
      {
        id: "year",
        header: "Year",
        width: "w-[90px]",
        align: "center",
        cell: (r) => (
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--on-surface-muted)]">
            {r.programYear || "2026"}
          </span>
        ),
      },
      {
        id: "skus",
        header: "Matrix SKUs",
        width: "w-[120px]",
        align: "center",
        cell: (r) => {
          const materialCount = (r.programMaterials || []).length;
          const hasRecent = (r.programMaterials || []).some((m) => isMaterialAddedRecently(m.createdAt));
          return (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
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
        id: "notes",
        header: "Team Notes",
        width: "w-[160px]",
        cell: (r) => {
          const sampNoteAdded = hasSampNote(r);
          const plantNoteAdded = hasPlantNote(r);
          return (
            <div className="flex flex-col gap-1 items-start">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  sampNoteAdded
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
                }`}
              >
                SAMP: {sampNoteAdded ? "Note added" : "Awaiting"}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  plantNoteAdded
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
                }`}
              >
                Plant: {plantNoteAdded ? "Note added" : "Awaiting"}
              </span>
            </div>
          );
        },
      },
      {
        id: "submitter",
        header: "Submitter",
        width: "w-[130px]",
        cell: (r) => (
          <div className="font-mono text-xs text-[var(--on-surface-muted)]">
            <div>{r.createdBy || "Marketing"}</div>
            <div className="text-[10px] text-[var(--on-surface-subtle)]">
              {r.dateRequestCreated || "Recent"}
            </div>
          </div>
        ),
      },
      {
        id: "actions",
        header: "Action",
        align: "right",
        width: "w-[100px]",
        cell: (r) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onInspectRequest(r)}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ),
      },
    ],
    [onInspectRequest]
  );

  return (
    <DeskWorkspaceLayout
      title="Program Planning"
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
                ...customerList.map((customer) => ({ value: customer, label: customer })),
              ]}
            />
          )}

          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="min-w-[140px]"
              options={[
                { value: "all", label: "All Plants" },
                ...plantList.map((plant) => ({ value: plant, label: `Plant ${plant}` })),
              ]}
            />
          )}
        </>
      }
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Search code, campaign, customer...",
      }}
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
