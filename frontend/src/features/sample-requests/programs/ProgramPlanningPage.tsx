import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  Search,
  X,
  Trash2,
  Download,
} from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { PaginationBar } from "@/components/erp/PaginationBar";
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
  selectedPlant,
  uniqueCustomers,
  user,
  isAdmin,
  isReadOnly = false,
  onOpenNewModal,
  onInspectRequest,
  onDeleteRequest,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<ProgramStageTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Local Modal States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Only consider program planning requests
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

  // Derived Customers List strictly from program planning requests
  const customerList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Derived Plants List strictly from program planning requests
  const plantList = useMemo(() => {
    const set = new Set<string>();
    programRequests.forEach((r) => {
      if (r.targetPlant && r.targetPlant.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [programRequests]);

  // Operational metrics
  const programStats = useMemo(() => {
    const totalPrograms = programRequests.length;
    let awaitingSampCount = 0;
    let sampOutputCount = 0;
    let plantOutputCount = 0;
    let totalSkus = 0;

    programRequests.forEach((r) => {
      const matCount = r.programMaterials?.length || 1;
      totalSkus += matCount;

      if (hasSampOutput(r)) sampOutputCount++;
      else awaitingSampCount++;
      if (hasPlantOutput(r)) plantOutputCount++;
    });

    return {
      totalPrograms,
      awaitingSampCount,
      sampOutputCount,
      plantOutputCount,
      totalSkus,
    };
  }, [programRequests]);

  // Stage tab counts
  const stageCounts = useMemo(() => {
    return {
      all: programStats.totalPrograms,
      awaiting_samp: programStats.awaitingSampCount,
      samp_added: programStats.sampOutputCount,
      plant_added: programStats.plantOutputCount,
    };
  }, [programStats]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return programRequests.filter((r) => {
      // Tab filter
      if (filterTab === "awaiting_samp" && hasSampOutput(r)) return false;
      if (filterTab === "samp_added" && !hasSampOutput(r)) return false;
      if (filterTab === "plant_added" && !hasPlantOutput(r)) return false;

      // Customer filter
      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      // Plant filter
      if (selectedPlant !== "ALL") {
        const p = (r.targetPlant || "").toLowerCase();
        if (!p.includes(selectedPlant.toLowerCase())) return false;
      }
      if (selectedPlantFilter !== "all") {
        const p = (r.targetPlant || "").toLowerCase();
        if (!p.includes(selectedPlantFilter.toLowerCase())) return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const sr = (r.srNumber || "").toLowerCase();
        const prog = (r.programName || "").toLowerCase();
        const desc = (r.productDescription || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const yr = (r.programYear || "").toLowerCase();
        return sr.includes(q) || prog.includes(q) || desc.includes(q) || cust.includes(q) || yr.includes(q);
      }

      return true;
    });
  }, [programRequests, filterTab, customerFilter, selectedPlant, selectedPlantFilter, searchTerm]);

  // Paginated Slice
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));

  const clearFilters = () => {
    setSearchTerm("");
    setCustomerFilter("all");
    setSelectedPlantFilter("all");
    setFilterTab("all");
    setCurrentPage(1);
  };

  // Selection
  const handleToggleSelectRow = (id: string | number, e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === paginatedRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRequests.map((r) => r.id)));
    }
  };

  const handleOpenInspector = (req: SampleRequestItem) => {
    onInspectRequest(req);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredRequests.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportRecordsToCsv({
      filename: `program_planning_${dateStr}.csv`,
      columns: [
        { header: "Program ID", accessor: (r) => r.srNumber || `PG-${r.id}` },
        { header: "Customer", accessor: (r) => r.customer },
        { header: "Program Title", accessor: (r) => r.programName || r.productDescription },
        { header: "Year", accessor: (r) => r.programYear || "2026" },
        { header: "Plant", accessor: (r) => r.targetPlant },
        { header: "SAMP Note", accessor: (r) => hasSampOutput(r) ? "Added" : "Awaiting" },
        { header: "Plant Note", accessor: (r) => hasPlantOutput(r) ? "Added" : "Awaiting" },
        { header: "Total SKUs", accessor: (r) => r.programMaterials?.length || 1 },
      ],
      data: filteredRequests,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-base)] text-[var(--on-surface)] select-text">
      {/* ── 1. Compact Editorial Header (Maximized Space for Requests) ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[var(--on-surface)] sm:text-lg">
              Seasonal Program Planning
            </h1>
            <p className="mt-0.5 text-[11px] text-[var(--on-surface-subtle)]">Seasonal campaign plans with SAMP and Plant team notes</p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* New Program Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] cursor-pointer"
                title="Initialize New Seasonal Program with Matrix"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Program Planning</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] cursor-pointer disabled:opacity-50"
              title="Refresh Program Records"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredRequests.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] cursor-pointer disabled:opacity-50"
              title="Export To CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Program planning summary" className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-2.5 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Programs", value: stageCounts.all, detail: "All seasonal plans", color: "bg-[var(--accent-primary)]", filter: "all" as const },
            { label: "Awaiting SAMP", value: stageCounts.awaiting_samp, detail: "SAMP note needed", color: "bg-amber-500", filter: "awaiting_samp" as const },
            { label: "SAMP note added", value: stageCounts.samp_added, detail: "Sampling input received", color: "bg-sky-500", filter: "samp_added" as const },
            { label: "Plant note added", value: stageCounts.plant_added, detail: "Plant input received", color: "bg-emerald-500", filter: "plant_added" as const },
            { label: "Total SKUs", value: programStats.totalSkus, detail: "Across program plans", color: "bg-violet-500" },
          ].map((item) => {
            const active = "filter" in item && item.filter
              ? item.filter === "all"
                ? filterTab === "all" && customerFilter === "all" && selectedPlantFilter === "all" && !searchTerm
                : filterTab === item.filter
              : false;
            const content = (
              <>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold leading-none tabular-nums text-[var(--on-surface)]">{item.value}</span>
                  <span className="truncate text-[10px] text-[var(--on-surface-subtle)]">{item.detail}</span>
                </span>
              </>
            );
            return "filter" in item && item.filter ? (
              <button key={item.label} type="button" onClick={() => { if (item.filter === "all") clearFilters(); else { setFilterTab(item.filter); setCurrentPage(1); } }} aria-pressed={active} className={`min-w-0 rounded-lg border px-3 py-2 text-left shadow-2xs transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--surface-low)] ${active ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20" : "border-[var(--border-subtle)] bg-[var(--surface-lowest)]"}`}>
                {content}
              </button>
            ) : (
              <div key={item.label} className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 py-2 shadow-2xs">
                {content}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 2. Floating Filter & Search Strip ── */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5 sm:px-6">
        {/* Right Search, Customer, Plant Select */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && isAdmin && (
            <button
              type="button"
              onClick={() => {
                const target = programRequests.find((r) => selectedIds.has(r.id));
                if (target) onDeleteRequest(target);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}

          {customerList.length > 0 && (
            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 min-w-[160px] max-w-[240px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--border-focus)] cursor-pointer"
            >
              <option value="all">All Customers</option>
              {customerList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          {plantList.length > 0 && (
            <select
              value={selectedPlantFilter}
              onChange={(e) => {
                setSelectedPlantFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 min-w-[140px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--border-focus)] cursor-pointer font-mono"
            >
              <option value="all">All Plants</option>
              {plantList.map((p) => (
                <option key={p} value={p}>
                  Plant {p}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-60 sm:w-72 group">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              type="text"
              placeholder="Search code, customer, title..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] pl-[34px] pr-8 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/15"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-low)] cursor-pointer"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {(customerFilter !== "all" || selectedPlantFilter !== "all" || filterTab !== "all" || searchTerm) && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 rounded-lg px-2.5 text-xs font-medium text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Full-Bleed Table Workspace (Seamlessly Blended into Full UI) ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2 text-xs text-[var(--on-surface-muted)] sm:px-6">
        <span>Showing <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{filteredRequests.length}</span> of <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{programRequests.length}</span> programs</span>
        <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">Newest plans first</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-[var(--surface-base)] flex flex-col">
        <table className="w-full min-w-[1180px] text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]">
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
              <th className="py-3 pl-6 pr-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    paginatedRequests.length > 0 &&
                    paginatedRequests.every((r) => selectedIds.has(r.id))
                  }
                  onChange={handleToggleSelectAll}
                  className="cursor-pointer rounded accent-[var(--accent-primary)]"
                />
              </th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Program ID</th>
              <th className="py-3 px-4 font-semibold">Campaign Title & Product Scope</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Plant</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Year</th>
              <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Matrix SKUs</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Team Notes</th>
              <th className="py-3 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Commercial Action</th>
            </tr>
          </thead>

              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center font-mono text-[var(--on-surface-subtle)]">
                      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-[var(--accent-primary)]" />
                      <span>Loading seasonal program planning matrix...</span>
                    </td>
                  </tr>
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                        <div className="max-w-sm mx-auto flex flex-col items-center">
                        <h3 className="text-sm font-semibold text-[var(--on-surface)]">No seasonal programs</h3>
                        <p className="mt-1 text-xs text-[var(--on-surface-subtle)]">
                          {searchTerm || customerFilter !== "all" || filterTab !== "all" || selectedPlantFilter !== "all"
                            ? "No programs match your search or active filter criteria."
                            : "There are currently no seasonal program planning requests submitted."}
                        </p>
                        {(searchTerm || customerFilter !== "all" || filterTab !== "all" || selectedPlantFilter !== "all") && (
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
                  paginatedRequests.map((row) => {
                    const srCode = row.srNumber || `PG-${row.id}`;
                    const materials = row.programMaterials || [];
                    const skuCount = materials.length > 0 ? materials.length : 1;
                    const hasSampNote = hasSampOutput(row);
                    const hasPlantNote = hasPlantOutput(row);
                    const isSelected = selectedIds.has(row.id);

                    return (
                      <tr
                        key={row.id}
                        onClick={() => handleOpenInspector(row)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected ? "bg-[var(--accent-primary-subtle)]" : "hover:bg-[var(--surface-low)]"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 pl-6 pr-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelectRow(row.id, e)}
                            className="cursor-pointer rounded accent-[var(--accent-primary)]"
                          />
                        </td>

                        {/* Program ID */}
                        <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                          <CopyBadge text={srCode} />
                        </td>

                        {/* Title & Description */}
                        <td className="py-3 px-4 max-w-sm">
                          <div className="truncate font-semibold text-[var(--on-surface)]">
                            {row.programName || row.programCampaignTitle || "Seasonal Program"}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-[var(--on-surface-subtle)]">
                            {row.productDescription || "Multi-SKU scholastic program range"}
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--on-surface)]">
                          {row.customer || "—"}
                        </td>

                        {/* Plant */}
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[var(--on-surface-muted)]">
                          Plant {row.targetPlant || "1505"}
                        </td>

                        {/* Program Year */}
                        <td className="py-3 px-4 text-center font-mono font-bold whitespace-nowrap">
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 text-[11px] text-[var(--on-surface-muted)]">
                            {row.programYear || "2026"}
                          </span>
                        </td>

                        {/* Matrix SKUs */}
                        <td className="py-3 px-4 text-center font-mono whitespace-nowrap">
                          <span className="rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
                            {skuCount} SKU{skuCount !== 1 ? "s" : ""}
                          </span>
                        </td>

                        {/* Team planning notes */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasSampNote ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"}`}>SAMP: {hasSampNote ? "Note added" : "Awaiting"}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hasPlantNote ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"}`}>Plant: {hasPlantNote ? "Note added" : "Awaiting"}</span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 pl-4 pr-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenInspector(row)}
                              className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)] cursor-pointer"
                              title="Open the program plan and team notes"
                            >
                              Inspect plan
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => onDeleteRequest(row, e)}
                                className="rounded-lg p-1.5 text-[var(--on-surface-subtle)] transition hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 cursor-pointer"
                                title="Delete record"
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

            {/* Table Footer Pager */}
            <div className="mt-auto shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-6 py-2.5">
              <PaginationBar
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={filteredRequests.length}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
                itemLabel="campaigns"
              />
            </div>
          </div>

      {/* ── 4. Modals & Dialogs (Lazy-loaded) ── */}
      <React.Suspense fallback={null}>
        <NewProgramPlanningModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onProceed={(params) => {
            setIsNewModalOpen(false);
            navigate("/sample-requests/program-planning", { state: params });
          }}
        />

      </React.Suspense>
    </div>
  );
};

export default ProgramPlanningPage;
