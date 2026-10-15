import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Factory, PackageCheck, RefreshCw, Search, Truck } from "lucide-react";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { DeskWorkspaceLayout, DataTable, type ColumnDef } from "@/components/erp";
import { SampleRequestInspector } from "@/features/sample-requests/components/SampleRequestInspector";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import type { UserProfile } from "@/features/auth";
import { isAdmin as isAdminUser } from "@/features/auth/permissions";
import { fetchPlantSamplingQueueApi } from "@/infrastructure/api/sampleRequestsApi";
import { formatOdooLogDate } from "@/features/sample-requests/utils/dateUtils";

interface PlantSamplingQueueProps {
  user?: UserProfile | null;
}

function stageSource(request: SampleRequestItem) {
  return request.mockupWorkflowState?.samplingRouting?.creativeChangesRequired
    ? "Creative-approved variant"
    : "Direct resample";
}

export const PlantSamplingQueue: React.FC<PlantSamplingQueueProps> = ({ user }) => {
  const { selectedYear } = useBusinessYear();
  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [selected, setSelected] = useState<SampleRequestItem | null>(null);
  const [search, setSearch] = useState("");
  const [showMine, setShowMine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id == null ? null : String(user.id);
  const readOnly = Boolean(user?.is_team_head) && !isAdminUser(user);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchPlantSamplingQueueApi(selectedYear);
      setRequests(next);
      setSelected((current) => current ? next.find((item) => String(item.id) === String(current.id)) || null : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Plant sampling requests could not be loaded. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return requests.filter((request) => {
      if (showMine && String(request.mockupWorkflowState?.claimedByUserId ?? "") !== (userId || "")) return false;
      if (!query) return true;
      return [request.srNumber, request.customer, request.brandName, request.materialCode, request.productDescription, request.targetPlant, stageSource(request)]
        .some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
  }, [requests, search, showMine, userId]);

  const claimedByMe = requests.filter((request) => userId && String(request.mockupWorkflowState?.claimedByUserId ?? "") === userId).length;
  const directResamples = requests.filter((request) => !request.mockupWorkflowState?.samplingRouting?.creativeChangesRequired).length;
  const variantWork = requests.length - directResamples;

  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(() => [
    {
      id: "request",
      header: "Request",
      width: "w-[150px]",
      cell: (request) => <div><div className="font-semibold text-[var(--on-surface)]">{request.srNumber || `SR-${request.id}`}</div><span className="text-[10px] text-[var(--on-surface-subtle)]">{stageSource(request)}</span></div>,
    },
    {
      id: "product",
      header: "Product & customer",
      cell: (request) => <div className="min-w-0"><div className="truncate font-semibold text-[var(--on-surface)]">{request.productDescription || "Commercial sample"}</div><div className="truncate text-[11px] text-[var(--on-surface-muted)]">{request.customer || "—"}{request.brandName ? ` · ${request.brandName}` : ""}</div></div>,
    },
    { id: "material", header: "Material", width: "w-[140px]", cell: (request) => <span className="font-mono text-xs">{request.materialCode || "—"}</span> },
    { id: "plant", header: "Destination", width: "w-[140px]", cell: (request) => <span className="text-xs font-medium">{request.targetPlant || "Plant not specified"}</span> },
    {
      id: "received",
      header: "Plant received",
      width: "w-[150px]",
      cell: (request) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatOdooLogDate(request.mockupWorkflowState?.plantReleasedAt || request.updatedAt || request.dateRequestCreated)}</span>,
    },
    {
      id: "claim",
      header: "Task owner",
      width: "w-[160px]",
      cell: (request) => request.mockupWorkflowState?.claimedBy
        ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{request.mockupWorkflowState.claimedBy}</span>
        : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Unclaimed</span>,
    },
    {
      id: "open",
      header: "Brief",
      width: "w-[100px]",
      align: "right",
      cell: (request) => <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(request); }} className="min-h-8 rounded-lg bg-[var(--surface-low)] px-3 text-[11px] font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">Open brief</button>,
    },
  ], []);

  const kpis = [
    { label: "Plant intake", value: requests.length, detail: "Released samples ready for Plant", color: "bg-emerald-600" },
    { label: "Direct resamples", value: directResamples, detail: "No Creative or Studio handoff", color: "bg-blue-600" },
    { label: "Artwork variants", value: variantWork, detail: "Creative-approved sample designs", color: "bg-blue-600" },
    { label: "Claimed by me", value: claimedByMe, detail: "Your active Plant handoffs", color: "bg-amber-600", isActive: showMine, onClick: () => setShowMine((value) => !value) },
  ];

  return (
    <DeskWorkspaceLayout
      title="Plant Sampling Intake"
      subtitle="Samples released by Marketing or Sampling arrive here with their product specifications and artwork handoff. Claim a request, then open its production brief."
      businessYear={selectedYear}
      totalCount={requests.length}
      totalLabel="samples received"
      onRefresh={load}
      isRefreshing={loading}
      kpiItems={kpis}
      kpiGridCols="grid-cols-2 xl:grid-cols-4"
      search={{ value: search, onChange: setSearch, placeholder: "Search SR, customer, material, plant…" }}
      filterControls={<button type="button" onClick={() => setShowMine((value) => !value)} aria-pressed={showMine} className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold ${showMine ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-container)]"}`}><PackageCheck className="h-3.5 w-3.5" />My claims</button>}
      hasActiveFilters={Boolean(search) || showMine}
      onResetFilters={() => { setSearch(""); setShowMine(false); }}
    >
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-5">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-low)] px-4 py-3">
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-lowest)] text-[var(--accent-primary)]"><Factory className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--on-surface)]">Incoming sample handoffs</h2><p className="text-[11px] text-[var(--on-surface-muted)]">Plant receives only after Marketing’s direct resample release or Sampling’s artwork approval.</p></div></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--on-surface-muted)] hover:bg-[var(--surface-lowest)] disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button>
        </section>
        {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
        {!error && (loading || visible.length > 0) && <section className="min-h-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-lowest)]"><DataTable data={visible} columns={columns} keyExtractor={(request) => String(request.id)} isLoading={loading} onRowClick={setSelected} emptyMessage="No sample handoffs match this search." pageSize={30} /></section>}
        {!loading && !error && visible.length === 0 && <section className="flex min-h-56 flex-1 flex-col items-center justify-center rounded-xl bg-[var(--surface-lowest)] px-6 py-10 text-center" role="status"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--accent-primary)]">{search || showMine ? <Search className="h-5 w-5" /> : <Truck className="h-5 w-5" />}</span><h2 className="mt-3 text-sm font-semibold text-[var(--on-surface)]">{search || showMine ? "No handoffs match these filters" : "Plant intake is clear"}</h2><p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--on-surface-muted)]">{search || showMine ? "Clear the search or My claims filter to see the full Plant intake." : "When a sample is released to Plant, it will appear here with its destination, specifications, and artwork link."}</p>{(search || showMine) && <button type="button" onClick={() => { setSearch(""); setShowMine(false); }} className="mt-3 min-h-9 rounded-lg px-3 text-xs font-semibold text-[var(--accent-primary-strong)] hover:bg-[var(--surface-low)]">Clear filters</button>}</section>}
      </main>
      <SampleRequestInspector request={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} role="plant" readOnly={readOnly} isAdmin={isAdminUser(user)} actorName={user?.name || user?.userid} actorUserId={user?.id} onRefresh={load} />
    </DeskWorkspaceLayout>
  );
};

export default PlantSamplingQueue;
