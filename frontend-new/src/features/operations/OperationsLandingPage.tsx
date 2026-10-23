import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, ClipboardList, Factory, FlaskConical, ShieldCheck, TriangleAlert } from "lucide-react";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { DataTable, DeskWorkspaceLayout, type ColumnDef } from "@/components/erp";
import { fetchFeasibilityRequestsApi, fetchProgramRequestsApi, fetchCostingWorkflowsApi, fetchSamplingWorkflowReviewsApi, type RequestWorkflowRecord } from "@/infrastructure/api";
import { fetchPlantSamplingQueueApi } from "@/infrastructure/api/sampleRequestsApi";
import type { SampleRequestItem } from "@/features/sample-requests/types";
import {
  createSamplingWorkflowColumns,
  getWorkflowStageLabel,
  sortSamplingWorkflowRecords,
  type SamplingWorkflowSortField,
} from "@/features/sample-requests/components/samplingWorkflowColumns";

type OperationsArea = "sampling" | "costing" | "plant";

interface OperationsLandingPageProps {
  area: OperationsArea;
}

interface Metric {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}

interface WorkspaceLink {
  title: string;
  detail: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const landingContent: Record<OperationsArea, { title: string; subtitle: string; links: WorkspaceLink[] }> = {
  sampling: {
    title: "SAMP Team Overview",
    subtitle: "A live view of reviewer workload, feasibility checks, and program planning for the selected business year.",
    links: [
      { title: "Workflow reviews", detail: "Review mockups and costing handoffs", path: "/samp-team-work/sampling", icon: ShieldCheck },
      { title: "Feasibility review", detail: "Technical and commercial feasibility queue", path: "/samp-team-work/feasibility", icon: FlaskConical },
      { title: "Program planning", detail: "Review material readiness and team notes", path: "/samp-team-work/programs", icon: ClipboardList },
    ],
  },
  costing: {
    title: "Costing Overview",
    subtitle: "Track the Costing queue and see where requests sit across Marketing, Creative, Costing, and Sampling.",
    links: [
      { title: "Open Costing work queue", detail: "Inspect inputs, attach costing output, and submit for Sampling review", path: "/costing-team/costing", icon: ClipboardList },
    ],
  },
  plant: {
    title: "Plant Overview",
    subtitle: "See released sample requests at intake and open seasonal program plans assigned to your plant.",
    links: [
      { title: "Plant program planning", detail: "See assigned programs, SKU readiness, and Sampling notes", path: "/plant/programs", icon: Factory },
      { title: "Plant sampling intake", detail: "Claim released samples and open their specifications and artwork brief", path: "/plant/sampling", icon: FlaskConical },
    ],
  },
};

function yearLabel(year: string) {
  if (!year || year.toUpperCase() === "ALL") return "All business years";
  return year.includes("-") ? `BY ${year}` : `FY ${year}`;
}

export const OperationsLandingPage: React.FC<OperationsLandingPageProps> = ({ area }) => {
  const navigate = useNavigate();
  const { selectedYear } = useBusinessYear();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [workflowRecords, setWorkflowRecords] = useState<RequestWorkflowRecord[]>([]);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowStage, setWorkflowStage] = useState("all");
  const [sortField, setSortField] = useState<SamplingWorkflowSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const content = landingContent[area];

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (area === "sampling") {
        const [reviews, feasibility, programs] = await Promise.all([
          fetchSamplingWorkflowReviewsApi(selectedYear),
          fetchFeasibilityRequestsApi(selectedYear),
          fetchProgramRequestsApi(selectedYear),
        ]);
        setWorkflowRecords(reviews);
        const awaitingReview = reviews.filter((item) => item.current_stage === "sampling_review" && !item.is_closed).length;
        const otherTeamWork = reviews.filter((item) => !item.is_closed && !["sampling_review", "done"].includes(item.current_stage)).length;
        setMetrics([
          { label: "Workflow requests", value: reviews.length, detail: "Across the review process", icon: Activity, tone: "emerald" },
          { label: "Ready for SAMP", value: awaitingReview, detail: "Waiting for reviewer action", icon: ShieldCheck, tone: "amber" },
          { label: "Other team work", value: otherTeamWork, detail: "Creative, Studio, Costing, Marketing, and Plant", icon: ClipboardList, tone: "blue" },
          { label: "Feasibility checks", value: feasibility.length, detail: "Requests in the current year", icon: FlaskConical, tone: "blue" },
          { label: "Program plans", value: programs.length, detail: "Plans assigned for technical review", icon: ClipboardList, tone: "violet" },
        ]);
      } else if (area === "costing") {
        setWorkflowRecords([]);
        const workflows: RequestWorkflowRecord[] = await fetchCostingWorkflowsApi(selectedYear);
        setMetrics([
          { label: "Costing queue", value: workflows.filter((item) => item.current_stage === "costing").length, detail: "Ready for Costing work", icon: ClipboardList, tone: "emerald" },
          { label: "Awaiting Sampling", value: workflows.filter((item) => item.current_stage === "sampling_review").length, detail: "Output submitted for review", icon: ShieldCheck, tone: "amber" },
          { label: "Closed", value: workflows.filter((item) => item.current_stage === "done").length, detail: "Approved and completed", icon: Activity, tone: "blue" },
        ]);
      } else {
        setWorkflowRecords([]);
        const [programs, plantSamples]: [SampleRequestItem[], SampleRequestItem[]] = await Promise.all([
          fetchProgramRequestsApi(selectedYear),
          fetchPlantSamplingQueueApi(selectedYear),
        ]);
        setMetrics([
          { label: "Samples received", value: plantSamples.length, detail: "Released to this Plant", icon: Factory, tone: "emerald" },
          { label: "Sampling notes added", value: programs.filter((item) => Boolean(item.samplingRemark?.trim())).length, detail: "Technical notes recorded", icon: FlaskConical, tone: "blue" },
          { label: "Assigned programs", value: programs.length, detail: "Seasonal plans visible to this plant", icon: ClipboardList, tone: "violet" },
        ]);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load overview data. Refresh to try again.");
      setMetrics([]);
      if (area === "sampling") setWorkflowRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [area, selectedYear]);

  const workflowStageOptions = useMemo(() => [
    { value: "all", label: "All stages" },
    ...[...new Set(workflowRecords.map((record) => record.current_stage))]
      .sort((a, b) => getWorkflowStageLabel(a).localeCompare(getWorkflowStageLabel(b)))
      .map((stage) => ({ value: stage, label: getWorkflowStageLabel(stage) })),
  ], [workflowRecords]);

  const filteredWorkflowRecords = useMemo(() => {
    const query = workflowSearch.trim().toLocaleLowerCase();
    const filtered = workflowRecords.filter((record) => {
      if (workflowStage !== "all" && record.current_stage !== workflowStage) return false;
      if (!query) return true;
      return [
        record.request_code,
        record.sr_number,
        record.customer,
        record.program_name,
        record.program_year,
        record.product_description,
        record.current_stage,
        record.workflow_type,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
    return sortSamplingWorkflowRecords(filtered, sortField, sortDirection);
  }, [workflowRecords, workflowSearch, workflowStage, sortField, sortDirection]);

  const workflowColumns = useMemo<ColumnDef<RequestWorkflowRecord>[]>(() => createSamplingWorkflowColumns((record) => {
    navigate(`/samp-team-work/sampling?request=${encodeURIComponent(`${record.workflow_type}:${record.sample_request_id}`)}`);
  }), [navigate]);

  const handleWorkflowSort = useCallback((field: string) => {
    const nextField = field as SamplingWorkflowSortField;
    if (sortField === nextField) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortField(nextField);
      setSortDirection("asc");
    }
  }, [sortField]);

  const openWorkflowRecord = useCallback((record: RequestWorkflowRecord) => {
    navigate(`/samp-team-work/sampling?request=${encodeURIComponent(`${record.workflow_type}:${record.sample_request_id}`)}`);
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  return (
    <DeskWorkspaceLayout
      title={content.title}
      subtitle={content.subtitle}
      businessYear={selectedYear}
      totalCount={metrics[0]?.value || 0}
      totalLabel={area === "costing" ? "items in flow" : area === "plant" ? "samples received" : "workflow items"}
      onRefresh={load}
      isRefreshing={isLoading}
      kpiItems={metrics.map((metric) => ({ label: metric.label, value: isLoading ? "—" : metric.value, detail: metric.detail, color: metric.tone === "emerald" ? "bg-emerald-600" : metric.tone === "blue" ? "bg-blue-600" : metric.tone === "amber" ? "bg-amber-600" : "bg-violet-600" }))}
      kpiGridCols={area === "sampling" ? "grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-3"}
      search={area === "sampling" ? { value: workflowSearch, onChange: setWorkflowSearch, placeholder: "Search request, customer, program…" } : undefined}
      filterControls={area === "sampling" ? (
        <label className="flex h-8 items-center gap-2 rounded-lg bg-[var(--surface-low)] px-2.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">
          <span className="whitespace-nowrap">Stage</span>
          <select
            aria-label="Filter workflow requests by stage"
            value={workflowStage}
            onChange={(event) => setWorkflowStage(event.target.value)}
            className="max-w-[190px] bg-transparent text-xs text-[var(--on-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          >
            {workflowStageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ) : undefined}
      hasActiveFilters={area === "sampling" && (Boolean(workflowSearch) || workflowStage !== "all")}
      onResetFilters={area === "sampling" ? () => { setWorkflowSearch(""); setWorkflowStage("all"); } : undefined}
    >
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-[1680px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-[var(--surface-lowest)] p-5 sm:p-7">
            <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]"><CalendarDays className="h-3.5 w-3.5" />{yearLabel(selectedYear)}</p><h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--on-surface)]">Your team workspace</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--on-surface-muted)]">Open a queue to inspect its source record, review the recorded activity, and complete the next available action.</p></div>
          </section>

          {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800  "><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.links.map((link) => {
              const Icon = link.icon;
              return <button type="button" key={link.path} onClick={() => navigate(link.path)} className="group flex min-h-40 flex-col justify-between rounded-2xl bg-[var(--surface-lowest)] p-5 text-left transition-colors hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--accent-primary)] group-hover:bg-[var(--surface-lowest)]"><Icon className="h-5 w-5" /></span>
                <span className="mt-5 flex items-end justify-between gap-4"><span><span className="block text-sm font-bold text-[var(--on-surface)]">{link.title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--on-surface-muted)]">{link.detail}</span></span><ArrowRight className="mb-0.5 h-4 w-4 shrink-0 text-[var(--on-surface-subtle)] transition-transform group-hover:translate-x-1" /></span>
              </button>;
            })}
          </section>
          {area === "sampling" && (
            <section className="flex min-h-[32rem] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--surface-lowest)]">
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-sm font-bold text-[var(--on-surface)]">Sampling workflow overview</h3>
                  <p className="mt-1 text-xs text-[var(--on-surface-muted)]">All requests across teams. Open any row to inspect the work and take the available Sampling action.</p>
                </div>
                <span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[10px] font-semibold tabular-nums text-[var(--on-surface-muted)]">
                  {filteredWorkflowRecords.length} {filteredWorkflowRecords.length === 1 ? "request" : "requests"}
                </span>
              </div>
              <div className="min-h-[26rem] min-w-0 flex-1 overflow-hidden border-t border-[var(--border-subtle)]">
                <DataTable
                  data={filteredWorkflowRecords}
                  columns={workflowColumns}
                  tableClassName="w-full min-w-[1300px] table-fixed"
                  containerClassName="overflow-auto overscroll-contain"
                  density="normal"
                  keyExtractor={(record) => `${record.workflow_type}:${record.sample_request_id}`}
                  isLoading={isLoading}
                  onRowClick={openWorkflowRecord}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSortChange={handleWorkflowSort}
                  emptyMessage={workflowSearch || workflowStage !== "all" ? "No workflow requests match these filters." : "No workflow requests found for this business year."}
                  pageSize={30}
                />
              </div>
            </section>
          )}
          {isLoading && <p className="text-xs text-[var(--on-surface-subtle)]" role="status">Loading live workspace counts…</p>}
        </div>
      </main>
    </DeskWorkspaceLayout>
  );
};

export default OperationsLandingPage;
