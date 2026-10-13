import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { getRequestTrackType } from "@/features/sample-requests/utils/trackTypes";
import {
  Search,
  X,
  RefreshCw,
  Download,
} from "lucide-react";
import { isMaterialAddedRecently } from "@/features/sample-requests/utils/dateUtils";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { PaginationBar, DeskWorkspaceLayout } from "@/components/erp";
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
        { header: "SAMP Note", accessor: (r) => hasSampNote(r) ? "Added" : "Awaiting" },
        { header: "Plant Note", accessor: (r) => hasPlantNote(r) ? "Added" : "Awaiting" },
        { header: "Materials Count", accessor: (r) => (r.programMaterials || []).length },
        { header: "Created By", accessor: (r) => r.createdBy || "Marketing" },
        { header: "Created Date", accessor: (r) => r.dateRequestCreated || r.createdAt || "" },
      ],
      data: filteredRequests,
    });
    showToast(`Exported ${filteredRequests.length} program planning records to CSV`);
  };

  const kpiItems = [
    {
      label: "Programs",
      value: metrics.total,
      detail: "All assigned plans",
      color: "bg-[var(--accent-primary)]",
      isActive: filterTab === "all" && customerFilter === "all" && plantFilter === "all" && !searchTerm,
      onClick: clearFilters,
    },
    {
      label: "SAMP note needed",
      value: metrics.pending,
      detail: "Awaiting your input",
      color: "bg-amber-500",
      isActive: filterTab === "pending_note",
      onClick: () => {
        setFilterTab("pending_note");
        setCurrentPage(1);
      },
    },
    {
      label: "SAMP note added",
      value: metrics.sampNotes,
      detail: "Your planning input",
      color: "bg-sky-500",
      isActive: filterTab === "samp_note_added",
      onClick: () => {
        setFilterTab("samp_note_added");
        setCurrentPage(1);
      },
    },
    {
      label: "Plant note added",
      value: metrics.plantNotes,
      detail: "Plant planning input",
      color: "bg-emerald-500",
      isActive: filterTab === "plant_note_added",
      onClick: () => {
        setFilterTab("plant_note_added");
        setCurrentPage(1);
      },
    },
    {
      label: "Material lines",
      value: metrics.totalMaterials,
      detail: "Across all plans",
      color: "bg-sky-500",
    },
  ];

  return (
    <DeskWorkspaceLayout
      title="Program Planning"
      subtitle="Review Marketing plans and add SAMP planning notes"
      totalCount={metrics.total}
      totalLabel="Programs"
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
          {plantList.length > 0 && (
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
      hasActiveFilters={Boolean(
        customerFilter !== "all" || plantFilter !== "all" || filterTab !== "all" || searchTerm
      )}
      onResetFilters={clearFilters}
      resetFiltersLabel="Clear filters"
    >

      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2 text-xs text-[var(--on-surface-muted)] sm:px-6"><span>Showing <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{filteredRequests.length}</span> of <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{programRequests.length}</span> programs</span><span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">Newest plans first</span></div>
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col">
        <table className="w-full min-w-[1120px] text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]">
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
              <th className="py-3 pl-6 pr-3 w-12 text-center">#</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Program ID</th>
              <th className="py-3 px-4 font-semibold">Campaign Title & Scope</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Plant</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Year</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Material lines</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Team Notes</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Submitter</th>
              <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="py-16 text-center font-mono text-[var(--on-surface-subtle)]">
                  <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[var(--accent-primary)]" />
                  Loading program plans...
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <h3 className="text-sm font-semibold text-[var(--on-surface)]">No programs to review</h3>
                    <p className="mt-1 text-xs text-[var(--on-surface-subtle)]">
                      {searchTerm || customerFilter !== "all" || filterTab !== "all" || plantFilter !== "all"
                        ? "No programs match your search or active filter criteria."
                        : "There are currently no seasonal program planning requests submitted."}
                    </p>
                    {(searchTerm || customerFilter !== "all" || filterTab !== "all" || plantFilter !== "all") && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-3 text-xs font-semibold text-[var(--accent-primary)] hover:underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRequests.map((req, idx) => {
                const rowNumber = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const materialCount = (req.programMaterials || []).length;
                const sampNoteAdded = hasSampNote(req);
                const plantNoteAdded = hasPlantNote(req);
                const hasRecent = (req.programMaterials || []).some((m) =>
                  isMaterialAddedRecently(m.createdAt)
                );

                return (
                  <tr
                    key={req.id}
                    onClick={() => onInspectRequest(req)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--surface-low)]"
                  >
                    {/* 1. # */}
                    <td className="py-3.5 pl-6 pr-3 text-center font-mono text-[11px] font-semibold text-[var(--on-surface-subtle)]">
                      {String(rowNumber).padStart(2, "0")}
                    </td>

                    {/* 2. Program ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-xs whitespace-nowrap">
                      <CopyBadge text={req.materialCode || req.srNumber} />
                    </td>

                    {/* 3. Campaign Title & Scope */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="truncate font-semibold text-[var(--on-surface)]">
                        {req.programName || req.programCampaignTitle || "Seasonal Program"}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--on-surface-subtle)]">
                        {req.productDescription || "Multi-SKU range"}
                      </div>
                    </td>

                    {/* 4. Customer */}
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold text-[var(--on-surface)]">
                      <div className="flex items-center gap-1.5">
                        <span>{req.customer || "—"}</span>
                      </div>
                    </td>

                    {/* 5. Plant */}
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[var(--on-surface-muted)]">
                      Plant {req.targetPlant || "1505"}
                    </td>

                    {/* 6. Year */}
                    <td className="py-3.5 px-4 text-center font-mono text-xs whitespace-nowrap">
                      <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 font-bold text-[var(--on-surface-muted)]">
                        {req.programYear || "2026"}
                      </span>
                    </td>

                    {/* 7. Matrix SKUs */}
                    <td className="py-3.5 px-4 text-center">
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
                    </td>

                    {/* 8. Team note status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${sampNoteAdded ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"}`}>
                          SAMP: {sampNoteAdded ? "Note added" : "Awaiting"}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${plantNoteAdded ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"}`}>
                          Plant: {plantNoteAdded ? "Note added" : "Awaiting"}
                        </span>
                      </div>
                    </td>

                    {/* 9. Submitter */}
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-[var(--on-surface-muted)]">
                      <div>{req.createdBy || "Marketing"}</div>
                      <div className="text-[10px] text-[var(--on-surface-subtle)]">{req.dateRequestCreated || "Recent"}</div>
                    </td>

                    {/* 10. Actions */}
                    <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onInspectRequest(req)}
                        className="inline-flex items-center rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] cursor-pointer"
                      >
                        Inspect plan
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
            itemLabel="campaigns"
          />
        </div>
      </div>
    </DeskWorkspaceLayout>
  );
};

export default SamplingProgramPlanningView;
