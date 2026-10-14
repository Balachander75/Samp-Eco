import React, { useState, useMemo } from "react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import { ChevronRight } from "lucide-react";
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
    let awaitingReview = 0;
    let reviewed = 0;
    let totalSKUs = 0;

    plantScopedRequests.forEach((r) => {
      if (hasPlantNote(r)) reviewed++;
      else awaitingReview++;
      const count = (r.programMaterials || []).length;
      totalSKUs += count > 0 ? count : 1;
    });

    return { total, awaitingReview, reviewed, totalSKUs };
  }, [plantScopedRequests]);

  // Main filtered dataset
  const filteredRequests = useMemo(() => {
    return plantScopedRequests.filter((r) => {
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
        width: "w-[140px]",
        sortable: true,
        cell: (row) => <CopyBadge text={row.srNumber || row.materialCode || `PG-${row.id}`} />,
      },
      {
        id: "campaign",
        header: "Campaign Title & Product Scope",
        cell: (row) => (
          <div className="max-w-sm">
            <div className="truncate font-semibold text-xs text-[var(--text-primary)]" title={row.programName || row.programCampaignTitle || "Seasonal Program"}>
              {row.programName || row.programCampaignTitle || "Seasonal Program"}
            </div>
            <div className="mt-0.5 truncate text-[10px] font-mono text-[var(--text-muted)]">
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
          <span className="font-semibold text-xs text-[var(--text-primary)] truncate" title={row.customer || ""}>
            {row.customer || "—"}
          </span>
        ),
      },
      {
        id: "plant",
        header: "Assigned Plant",
        width: "w-[120px]",
        cell: (row) => (
          <span className="font-mono text-xs text-[var(--text-secondary)]">
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
          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 text-[11px] font-mono font-bold text-[var(--text-secondary)]">
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
          const substrates = Array.from(
            new Set(materials.map((m) => m.materialType?.trim()).filter(Boolean) as string[])
          ).slice(0, 2);
          return (
            <div className="flex flex-col items-center gap-0.5 font-mono">
              <span className="rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
                {skuCount} SKU{skuCount !== 1 ? "s" : ""}
              </span>
              {substrates.length > 0 && (
                <span className="text-[10px] text-[var(--text-muted)]">
                  {substrates.join(" · ")}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "samp_note",
        header: "SAMP Note",
        width: "w-[140px]",
        cell: (row) =>
          hasSampNote(row) ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              SAMP note added
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-[var(--surface-low)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
              Awaiting SAMP note
            </span>
          ),
      },
      {
        id: "plant_note",
        header: "Plant Note",
        width: "w-[140px]",
        cell: (row) =>
          hasPlantNote(row) ? (
            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              Plant note added
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-[var(--surface-low)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
              Awaiting your note
            </span>
          ),
      },
      {
        id: "actions",
        header: "Plant Action",
        align: "right",
        width: "w-[120px]",
        cell: (row) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onInspectRequest(row)}
              className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
            >
              <span>Inspect plan</span>
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
      onExportCSV={handleExportCsv}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-4"
      filterControls={
        <>
          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="min-w-[160px] max-w-[240px]"
              options={[
                { value: "all", label: "All customers" },
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
                { value: "all", label: "All plants" },
                ...plantList.map((plant) => ({ value: plant, label: `Plant ${plant}` })),
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
