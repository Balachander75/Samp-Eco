import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, FileSpreadsheet, Image, Search } from "lucide-react";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { DataTable, DeskWorkspaceLayout, type ColumnDef } from "@/components/erp";
import type { UserProfile } from "@/features/auth";
import { isAdmin as isAdminUser } from "@/features/auth/permissions";
import {
  fetchCostingWorkflowsApi,
  fetchSamplingWorkflowReviewsApi,
  type RequestWorkflowRecord,
} from "@/infrastructure/api";
import { CostingWorkflowInspectorModal } from "./CostingWorkflowInspectorModal";
import { MockupSamplingInspectorModal } from "./MockupSamplingInspectorModal";
import { SampleRequestInspector } from "./SampleRequestInspector";
import { fetchSampleRequestByIdApi } from "@/infrastructure/api/sampleRequestsApi";
import type { SampleRequestItem } from "../types";

interface WorkflowOperationsDeskProps {
  mode: "costing" | "sampling";
  user?: UserProfile | null;
}

const stageLabels: Record<string, string> = {
  marketing: "Marketing intake",
  creative: "Creative review",
  costing: "Costing work",
  studio: "Studio work",
  creative_approval: "Creative quality review",
  sampling_review: "Sampling review",
  awaiting_marketing_acceptance: "Marketing acceptance",
  done: "Closed",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatRequiredDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function isReadOnlyTeamHead(user?: UserProfile | null) {
  return Boolean(user?.is_team_head) && !["admin", "administrator"].includes(String(user?.role || "").toLowerCase());
}

export const WorkflowOperationsDesk: React.FC<WorkflowOperationsDeskProps> = ({ mode, user }) => {
  const { selectedYear } = useBusinessYear();
  const [records, setRecords] = useState<RequestWorkflowRecord[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sampleDetail, setSampleDetail] = useState<SampleRequestItem | null>(null);
  const [sampleDetailLoading, setSampleDetailLoading] = useState(false);
  const [sampleDetailError, setSampleDetailError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = mode === "costing"
        ? await fetchCostingWorkflowsApi(selectedYear)
        : await fetchSamplingWorkflowReviewsApi(selectedYear);
      setRecords(next);
      setSelectedKey((current) => current && next.some((item) => `${item.workflow_type}:${item.sample_request_id}` === current) ? current : null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workflow records.");
    } finally {
      setIsLoading(false);
    }
  }, [mode, selectedYear]);

  useEffect(() => { void load(); }, [load]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const matchesStage = stageFilter === "all"
        || (stageFilter === "returned" ? record.reviewer_status === "returned" : record.current_stage === stageFilter);
      if (!matchesStage) return false;
      if (!query) return true;
      return [
        record.sr_number,
        record.customer,
        record.brand_name,
        record.material_code,
        record.product_description,
        record.status,
        record.reviewer_status,
        stageLabels[record.current_stage] || record.current_stage,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
  }, [records, search, stageFilter]);

  const selected = visibleRecords.find((record) => `${record.workflow_type}:${record.sample_request_id}` === selectedKey) || null;
  const selectedIsSampleVariant = Boolean(
    mode === "sampling"
    && selected?.workflow_type === "mockup"
    && selected.request_types.includes("sample")
    && (selected.workflow_data?.samplingRouting as Record<string, unknown> | undefined)?.creativeChangesRequired === true,
  );

  useEffect(() => {
    if (!selected || !selectedIsSampleVariant) {
      setSampleDetail(null);
      setSampleDetailError(null);
      setSampleDetailLoading(false);
      return;
    }
    let active = true;
    setSampleDetail(null);
    setSampleDetailError(null);
    setSampleDetailLoading(true);
    fetchSampleRequestByIdApi(selected.sample_request_id)
      .then((request) => { if (active) setSampleDetail(request); })
      .catch((reason) => { if (active) setSampleDetailError(reason instanceof Error ? reason.message : "Could not open the sample handoff."); })
      .finally(() => { if (active) setSampleDetailLoading(false); });
    return () => { active = false; };
  }, [selected?.sample_request_id, selectedIsSampleVariant]);
  const returnedCount = useMemo(() => records.filter((record) => record.reviewer_status === "returned").length, [records]);
  const costingCount = useMemo(() => records.filter((record) => record.current_stage === "costing").length, [records]);
  const filterOptions = useMemo(() => {
    const stageOrder = ["marketing", "creative", "costing", "studio", "creative_approval", "sampling_review", "awaiting_marketing_acceptance", "done"];
    const stages = [...new Set(records.map((record) => record.current_stage))]
      .sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));
    return [
      { value: "all", label: "All requests" },
      ...stages.map((stage) => ({ value: stage, label: stageLabels[stage] || stage })),
      ...(returnedCount ? [{ value: "returned", label: "Returned for revision" }] : []),
    ];
  }, [records, returnedCount]);
  const columns = useMemo<ColumnDef<RequestWorkflowRecord>[]>(() => {
    const inspectColumn: ColumnDef<RequestWorkflowRecord> = {
      id: "inspect",
      header: "Open",
      width: "w-[104px]",
      align: "right",
      cell: (record) => <button type="button" aria-label={`Inspect ${record.sr_number}`} onClick={(event) => { event.stopPropagation(); setSelectedKey(`${record.workflow_type}:${record.sample_request_id}`); }} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11px] font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)]"><Eye className="h-3.5 w-3.5" />Inspect</button>,
    };

    if (mode === "costing") {
      return [
        {
          id: "request",
          header: "Request",
          width: "w-[150px]",
          sortable: true,
          cell: (record) => <div><div className="font-semibold text-[var(--on-surface)]">{record.sr_number}</div><div className="mt-0.5 text-[10px] text-[var(--on-surface-subtle)]">Costing</div></div>,
        },
        {
          id: "product",
          header: "Product / Customer",
          cell: (record) => <div className="min-w-0"><div className="truncate font-semibold text-[var(--on-surface)]">{record.product_description || "Product request"}</div><div className="truncate text-[11px] text-[var(--on-surface-muted)]">{record.customer}{record.brand_name ? ` · ${record.brand_name}` : ""}</div></div>,
        },
        { id: "material", header: "Material", width: "w-[140px]", cell: (record) => <span className="font-mono text-xs">{record.material_code || "—"}</span> },
        { id: "required", header: "Required date", width: "w-[130px]", cell: (record) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatRequiredDate(record.request_data?.required_date)}</span> },
        {
          id: "stage",
          header: "Workflow stage",
          width: "w-[190px]",
          cell: (record) => <div className="flex flex-col items-start gap-1"><span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-muted)]">{stageLabels[record.current_stage] || record.current_stage}</span>{record.reviewer_status === "returned" && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Returned for revision</span>}</div>,
        },
        { id: "updated", header: "Last activity", width: "w-[135px]", cell: (record) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatDate(record.updated_at)}</span> },
        inspectColumn,
      ];
    }

    return [
      {
        id: "request",
        header: "Request",
        width: "w-[150px]",
        sortable: true,
        cell: (record) => <div><div className="font-semibold text-[var(--on-surface)]">{record.sr_number}</div><div className="mt-0.5 text-[10px] text-[var(--on-surface-subtle)]">{record.workflow_type === "mockup" ? record.request_types.includes("sample") ? "Sample artwork variant" : "Mockup" : "Costing"}</div></div>,
      },
      {
        id: "product",
        header: "Product / Customer",
        cell: (record) => <div className="min-w-0"><div className="truncate font-semibold text-[var(--on-surface)]">{record.product_description || "Product request"}</div><div className="truncate text-[11px] text-[var(--on-surface-muted)]">{record.customer}{record.brand_name ? ` · ${record.brand_name}` : ""}</div></div>,
      },
      { id: "material", header: "Material", width: "w-[150px]", cell: (record) => <span className="font-mono text-xs">{record.material_code || "—"}</span> },
      {
        id: "handoff",
        header: "Handoff",
        width: "w-[210px]",
        cell: (record) => {
          const sampleVariant = record.workflow_type === "mockup" && record.request_types.includes("sample");
          const label = sampleVariant ? "Creative-approved artwork" : record.workflow_type === "costing" ? "Costing output" : "Studio mockup";
          const detail = sampleVariant ? "Sampling releases to Plant" : record.workflow_type === "costing" ? "Technical output review" : "Mockup review";
          return <div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sampleVariant ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-[var(--surface-low)] text-[var(--on-surface-muted)]"}`}>{label}</span><span className="mt-1 block text-[10px] text-[var(--on-surface-subtle)]">{detail}</span></div>;
        },
      },
      { id: "stage", header: "Current stage", width: "w-[180px]", cell: (record) => <div><span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-muted)]">{stageLabels[record.current_stage] || record.current_stage}</span>{record.workflow_type === "mockup" && record.request_types.includes("sample") && <span className="mt-1 block text-[10px] text-emerald-700 dark:text-emerald-300">Approved artwork · Plant release next</span>}</div> },
      { id: "owner", header: "Claimed by", width: "w-[150px]", cell: (record) => {
        const owner = String(record.workflow_data?.claimedBy || "").trim();
        return owner
          ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{owner}</span>
          : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Needs claim</span>;
      } },
      { id: "updated", header: "Last activity", width: "w-[135px]", cell: (record) => <span className="text-[11px] text-[var(--on-surface-muted)]">{formatDate(record.updated_at)}</span> },
      inspectColumn,
    ];
  }, [mode]);

  const title = mode === "costing" ? "Costing Work Queue" : "Sampling Workflow Review";
  const subtitle = mode === "costing"
    ? "Inspect the product brief, costing inputs, output history, and handoff before submitting to Sampling."
    : "Review Costing handoffs, Creative-approved sample artwork, and mockup reviews. Approved sample variants move to Plant.";
  const kpis = mode === "costing"
    ? [
      { label: "In Costing", value: costingCount, detail: "Needs Costing action", color: "bg-emerald-600", isActive: stageFilter === "costing", onClick: () => setStageFilter((current) => current === "costing" ? "all" : "costing") },
      { label: "Returned", value: returnedCount, detail: "Needs another pass", color: "bg-amber-600", isActive: stageFilter === "returned", onClick: () => setStageFilter((current) => current === "returned" ? "all" : "returned") },
    ]
    : [
      { label: "Awaiting review", value: records.length, detail: "All work ready for Sampling", color: "bg-emerald-600" },
      { label: "Sample variants", value: records.filter((item) => item.workflow_type === "mockup" && item.request_types.includes("sample")).length, detail: "Creative approved · release to Plant", color: "bg-emerald-600" },
      { label: "Costing & mockup", value: records.filter((item) => item.workflow_type === "costing" || !item.request_types.includes("sample")).length, detail: "Technical review handoffs", color: "bg-blue-600" },
    ];

  return (
    <DeskWorkspaceLayout
      title={title}
      subtitle={subtitle}
      businessYear={selectedYear}
      totalCount={mode === "costing" ? costingCount : records.length}
      totalLabel={mode === "costing" ? "in Costing" : "review items"}
      onRefresh={load}
      isRefreshing={isLoading}
      kpiItems={kpis}
      kpiGridCols={mode === "sampling" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}
      search={{ value: search, onChange: setSearch, placeholder: "Search SR, customer, material…" }}
      filterControls={mode === "costing" && filterOptions.length > 2 ? (
        <label className="flex h-8 items-center gap-2 rounded-lg bg-[var(--surface-low)] px-2.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">
          <span className="whitespace-nowrap">Stage</span>
          <select aria-label="Filter costing requests by stage" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="max-w-[190px] bg-transparent text-xs text-[var(--on-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
            {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ) : undefined}
      hasActiveFilters={Boolean(search) || stageFilter !== "all"}
      onResetFilters={() => { setSearch(""); setStageFilter("all"); }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-5">
        {error && <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
        {!error && (isLoading || visibleRecords.length > 0) && <section className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-lowest)]">
          <DataTable
            data={visibleRecords}
            columns={columns}
            keyExtractor={(record) => `${record.workflow_type}:${record.sample_request_id}`}
            isLoading={isLoading}
            selectedRowId={selectedKey}
            onRowClick={(record) => setSelectedKey(`${record.workflow_type}:${record.sample_request_id}`)}
            emptyMessage="No matching workflow records."
            pageSize={30}
          />
        </section>}
        {!isLoading && !error && visibleRecords.length === 0 && <section className="flex min-h-48 flex-1 flex-col items-center justify-center rounded-xl bg-[var(--surface-lowest)] px-6 py-10 text-center" role="status">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--accent-primary)]">{search || stageFilter !== "all" ? <Search className="h-5 w-5" /> : mode === "costing" ? <FileSpreadsheet className="h-5 w-5" /> : <Image className="h-5 w-5" />}</span>
          <h2 className="mt-3 text-sm font-semibold text-[var(--on-surface)]">{search || stageFilter !== "all" ? "No requests match these filters" : mode === "costing" ? "No Costing work assigned" : "No requests awaiting review"}</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--on-surface-muted)]">{search || stageFilter !== "all" ? "Adjust the search or stage filter to see more requests." : mode === "costing" ? "Requests appear after Creative releases the brief to Costing." : "Reviews appear after Creative approves sample artwork, Studio submits a mockup, or Costing submits its output."}</p>
          {(search || stageFilter !== "all") && <button type="button" onClick={() => { setSearch(""); setStageFilter("all"); }} className="mt-4 inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-[var(--accent-primary-strong)] hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">Clear filters</button>}
        </section>}
        {isLoading && <div role="status" className="sr-only">Refreshing workflow records</div>}
      </div>

      {selected && mode === "costing" && <CostingWorkflowInspectorModal record={selected} mode="costing" user={user} onClose={() => setSelectedKey(null)} onSaved={load} />}
      {selected && mode === "sampling" && selected.workflow_type === "costing" && <CostingWorkflowInspectorModal record={selected} mode="sampling" user={user} onClose={() => setSelectedKey(null)} onSaved={load} />}
      {selected && selectedIsSampleVariant && sampleDetail && <SampleRequestInspector request={sampleDetail} isOpen role="sampling" actorName={user?.name || user?.userid} actorUserId={user?.id} isAdmin={isAdminUser(user)} readOnly={isReadOnlyTeamHead(user)} onClose={() => { setSelectedKey(null); setSampleDetail(null); }} onRefresh={load} />}
      {selectedIsSampleVariant && sampleDetailLoading && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" role="status"><div className="rounded-xl bg-[var(--surface-lowest)] px-5 py-4 text-sm text-[var(--on-surface)]">Loading sample handoff…</div></div>}
      {selectedIsSampleVariant && sampleDetailError && <div role="alert" className="fixed bottom-5 right-5 z-[110] max-w-sm rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-lg">{sampleDetailError}</div>}
      {selected && mode === "sampling" && selected.workflow_type === "mockup" && !selectedIsSampleVariant && <MockupSamplingInspectorModal record={selected} user={user} onClose={() => setSelectedKey(null)} onSaved={load} />}
    </DeskWorkspaceLayout>
  );
};

export default WorkflowOperationsDesk;
