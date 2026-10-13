import React, { useState, useMemo } from "react";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { PaginationBar, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface PlantProgramPlanningViewProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedPlant: string;
  onInspectRequest: (req: SampleRequestItem) => void;
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export type PlantProgramTab = "all" | "awaiting_review" | "reviewed" | "samp_note_added";

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
  const [plantFilter, setPlantFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

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

  // Scoped plant-specific programs (if selectedPlant is not ALL, scope to active plant)
  const plantScopedRequests = useMemo(() => {
    if (!selectedPlant || selectedPlant === "ALL") {
      return programRequests;
    }
    const plantNorm = selectedPlant.toLowerCase().trim();
    return programRequests.filter((r) => {
      const target = String(r.targetPlant || "").toLowerCase().trim();
      return target.includes(plantNorm) || plantNorm.includes(target);
    });
  }, [programRequests, selectedPlant]);

  // Derived Customers List strictly from plantScopedRequests (isolated so no bleed from other desks)
  const customerList = useMemo(() => {
    const set = new Set<string>();
    plantScopedRequests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [plantScopedRequests]);

  // Derived Plants List strictly from programRequests
  const plantList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Plant users review program feasibility; production operations are deferred.
  const metrics = useMemo(() => {
    const total = plantScopedRequests.length;
    let awaitingReview = 0;
    let reviewed = 0;
    let totalSKUs = 0;

    plantScopedRequests.forEach((r) => {
      const materials = r.programMaterials || [];
      totalSKUs += materials.length > 0 ? materials.length : 1;
      if (hasPlantNote(r)) reviewed++;
      else awaitingReview++;
    });

    return { total, awaitingReview, reviewed, totalSKUs };
  }, [plantScopedRequests]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    return plantScopedRequests.filter((r) => {
      if (filterTab === "awaiting_review" && hasPlantNote(r)) return false;
      if (filterTab === "reviewed" && !hasPlantNote(r)) return false;
      if (filterTab === "samp_note_added" && !hasSampNote(r)) return false;

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
  }, [plantScopedRequests, filterTab, plantFilter, customerFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, currentPage]);

  const clearFilters = () => {
    setFilterTab("all");
    setSearchTerm("");
    setPlantFilter("all");
    setCustomerFilter("all");
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `Plant_Program_Planning_${(selectedPlant || "all").toLowerCase()}_${dateStr}.csv`,
      columns: [
        { header: "Program ID", accessor: (r) => r.srNumber || `PG-${r.id}` },
        { header: "Program Code", accessor: (r) => r.materialCode || "" },
        { header: "Campaign Title", accessor: (r) => r.programName || r.productDescription || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Target Plant", accessor: (r) => r.targetPlant || "" },
        { header: "Program Year", accessor: (r) => r.programYear || "2026" },
        { header: "SAMP Note", accessor: (r) => hasSampNote(r) ? "Added" : "Awaiting" },
        { header: "Plant Note", accessor: (r) => hasPlantNote(r) ? "Added" : "Awaiting" },
        { header: "Total SKUs", accessor: (r) => (r.programMaterials || []).length || 1 },
        { header: "Created By", accessor: (r) => r.createdBy || "Marketing" },
        { header: "Created Date", accessor: (r) => r.dateRequestCreated || r.createdAt || "" },
      ],
      data: filteredRequests,
    });
    showToast(`Exported ${filteredRequests.length} plant program records to CSV`);
  };

  const kpiItems = [
    {
      label: "Programs",
      value: metrics.total,
      detail: "Assigned to this scope",
      color: "bg-[var(--accent-primary)]",
      isActive: filterTab === "all" && customerFilter === "all" && plantFilter === "all" && !searchTerm,
      onClick: clearFilters,
    },
    {
      label: "Plant note needed",
      value: metrics.awaitingReview,
      detail: "Awaiting your input",
      color: "bg-amber-500",
      isActive: filterTab === "awaiting_review",
      onClick: () => {
        setFilterTab("awaiting_review");
        setCurrentPage(1);
      },
    },
    {
      label: "Plant note added",
      value: metrics.reviewed,
      detail: "Your planning input",
      color: "bg-emerald-500",
      isActive: filterTab === "reviewed",
      onClick: () => {
        setFilterTab("reviewed");
        setCurrentPage(1);
      },
    },
    {
      label: "SAMP note added",
      value: plantScopedRequests.filter(hasSampNote).length,
      detail: "Sampling planning input",
      color: "bg-sky-500",
      isActive: filterTab === "samp_note_added",
      onClick: () => {
        setFilterTab("samp_note_added");
        setCurrentPage(1);
      },
    },
  ];

  const hasActiveFilters = Boolean(
    customerFilter !== "all" || plantFilter !== "all" || filterTab !== "all" || searchTerm
  );

  return (
    <DeskWorkspaceLayout
      title="Program Planning"
      subtitle={`Review the annual plan and add Plant remarks · ${selectedPlant || "All plants"}`}
      totalCount={metrics.total}
      totalLabel="Programs"
      extraBadges={
        metrics.totalSKUs > 0 ? (
          <span className="px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold">
            Total SKUs · {metrics.totalSKUs}
          </span>
        ) : null
      }
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
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-w-[160px] max-w-[240px]"
              options={[
                { value: "all", label: "All customers" },
                ...customerList.map((customer) => ({ value: customer, label: customer })),
              ]}
            />
          )}

          {(selectedPlant === "ALL" || !selectedPlant) && plantList.length > 0 && (
            <Select
              aria-label="Filter by plant"
              value={plantFilter}
              onChange={(e) => {
                setPlantFilter(e.target.value);
                setCurrentPage(1);
              }}
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
        onChange: (val) => {
          setSearchTerm(val);
          setCurrentPage(1);
        },
        placeholder: "Search code, campaign, customer...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={clearFilters}
      resetFiltersLabel="Clear filters"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2 text-xs text-[var(--text-secondary)] sm:px-6">
        <span>
          Showing{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {filteredRequests.length}
          </span>{" "}
          of{" "}
          <span className="font-mono font-semibold tabular-nums text-[var(--text-primary)]">
            {plantScopedRequests.length}
          </span>{" "}
          assigned programs
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">Newest plans first</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col">
        <table className="w-full min-w-[1160px] text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] select-none">
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)] select-none">
              <th className="py-3 pl-6 pr-4 font-semibold whitespace-nowrap">Program ID</th>
              <th className="py-3 px-4 font-semibold">Campaign Title &amp; Product Scope</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Assigned Plant</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Year</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Matrix SKUs</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">SAMP Note</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Plant Note</th>
              <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Plant Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <TableSkeletonRows rows={6} columns={9} />
            ) : paginatedRequests.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <EmptyState
                    compact
                    title="No plant plans to review"
                    description={
                      searchTerm || customerFilter !== "all" || filterTab !== "all" || plantFilter !== "all"
                        ? "No programs match your search or active filter criteria."
                        : `There are currently no seasonal program planning requests assigned to plant ${selectedPlant || "ALL"}.`
                    }
                    onResetFilters={
                      searchTerm || customerFilter !== "all" || filterTab !== "all" || plantFilter !== "all"
                        ? clearFilters
                        : undefined
                    }
                    resetLabel="Reset filters"
                  />
                </td>
              </tr>
            ) : (
              paginatedRequests.map((row) => {
                const srCode = row.srNumber || row.materialCode || `PG-${row.id}`;
                const materials = row.programMaterials || [];
                const skuCount = materials.length > 0 ? materials.length : 1;
                const sampNoteAdded = hasSampNote(row);
                const plantNoteAdded = hasPlantNote(row);

                // Unique substrates
                const substrates = Array.from(
                  new Set(
                    materials
                      .map((m) => m.materialType?.trim())
                      .filter(Boolean) as string[]
                  )
                ).slice(0, 2);

                return (
                  <tr
                    key={row.id}
                    onClick={() => onInspectRequest(row)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--surface-low)]"
                  >
                    {/* 1. Program ID */}
                    <td className="py-3 pl-6 pr-4 font-mono font-bold whitespace-nowrap">
                      <CopyBadge text={srCode} />
                    </td>

                    {/* 2. Title & Description */}
                    <td className="py-3 px-4 max-w-sm">
                      <div className="truncate font-semibold text-[var(--text-primary)]">
                        {row.programName || row.programCampaignTitle || "Seasonal Program"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                        {row.productDescription || "Multi-SKU scholastic program range"}
                      </div>
                    </td>

                    {/* 3. Customer */}
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {row.customer || "—"}
                    </td>

                    {/* 4. Plant */}
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        <span>Plant {row.targetPlant || "1505"}</span>
                      </div>
                    </td>

                    {/* 5. Program Year */}
                    <td className="py-3 px-4 text-center font-mono font-bold whitespace-nowrap">
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                        {row.programYear || "2026"}
                      </span>
                    </td>

                    {/* 6. Matrix SKUs */}
                    <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary-strong)]">
                          {skuCount} SKU{skuCount !== 1 ? "s" : ""}
                        </span>
                        {substrates.length > 0 && (
                          <span className="font-mono text-[10px] text-[var(--text-muted)]">
                            {substrates.join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 7. SAMP planning note */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {sampNoteAdded ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            SAMP note added
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--surface-low)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Awaiting SAMP note
                        </span>
                      )}
                    </td>

                    {/* 8. Plant planning note */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {plantNoteAdded ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Plant note added
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-[var(--surface-low)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                          Awaiting your note
                        </span>
                      )}
                    </td>

                    {/* 9. Plant Action */}
                    <td className="py-3 pl-4 pr-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectRequest(row);
                        }}
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white transition theme-primary-gradient cursor-pointer"
                        title="Open the annual program plan and add a Plant note"
                      >
                        <span>Inspect plan</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Table Footer Pager */}
        <div className="mt-auto shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-6 py-2.5">
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={filteredRequests.length}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setCurrentPage(p)}
            itemLabel="programs"
          />
        </div>
      </div>
    </DeskWorkspaceLayout>
  );
};

export default PlantProgramPlanningView;
