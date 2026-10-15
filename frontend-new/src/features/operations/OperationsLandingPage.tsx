import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowRight, CalendarDays, ClipboardList, Factory, FlaskConical, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { DeskWorkspaceLayout } from "@/components/erp";
import { fetchFeasibilityRequestsApi, fetchProgramRequestsApi, fetchCostingWorkflowsApi, fetchSamplingWorkflowReviewsApi, type RequestWorkflowRecord } from "@/infrastructure/api";
import { fetchPlantSamplingQueueApi } from "@/infrastructure/api/sampleRequestsApi";
import type { SampleRequestItem } from "@/features/sample-requests/types";

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
        setMetrics([
          { label: "Awaiting review", value: reviews.length, detail: "Costing, sample artwork, and Mockup handoffs", icon: ShieldCheck, tone: "emerald" },
          { label: "Feasibility checks", value: feasibility.length, detail: "Requests in the current year", icon: FlaskConical, tone: "blue" },
          { label: "Program plans", value: programs.length, detail: "Plans assigned for technical review", icon: ClipboardList, tone: "violet" },
        ]);
      } else if (area === "costing") {
        const workflows: RequestWorkflowRecord[] = await fetchCostingWorkflowsApi(selectedYear);
        setMetrics([
          { label: "Costing queue", value: workflows.filter((item) => item.current_stage === "costing").length, detail: "Ready for Costing work", icon: ClipboardList, tone: "emerald" },
          { label: "Awaiting Sampling", value: workflows.filter((item) => item.current_stage === "sampling_review").length, detail: "Output submitted for review", icon: ShieldCheck, tone: "amber" },
          { label: "Closed", value: workflows.filter((item) => item.current_stage === "done").length, detail: "Approved and completed", icon: Activity, tone: "blue" },
        ]);
      } else {
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
    } finally {
      setIsLoading(false);
    }
  }, [area, selectedYear]);

  useEffect(() => { void load(); }, [load]);

  return (
    <DeskWorkspaceLayout
      title={content.title}
      subtitle={content.subtitle}
      businessYear={selectedYear}
      totalCount={metrics[0]?.value || 0}
      totalLabel={area === "costing" ? "items in flow" : area === "plant" ? "samples received" : "items awaiting review"}
      onRefresh={load}
      isRefreshing={isLoading}
      kpiItems={metrics.map((metric) => ({ label: metric.label, value: isLoading ? "—" : metric.value, detail: metric.detail, color: metric.tone === "emerald" ? "bg-emerald-600" : metric.tone === "blue" ? "bg-blue-600" : metric.tone === "amber" ? "bg-amber-600" : "bg-violet-600" }))}
      kpiGridCols="grid-cols-1 sm:grid-cols-3"
    >
      <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-[var(--surface-lowest)] p-5 sm:p-7">
            <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]"><CalendarDays className="h-3.5 w-3.5" />{yearLabel(selectedYear)}</p><h2 className="mt-2 text-xl font-bold tracking-tight text-[var(--on-surface)]">Your team workspace</h2><p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--on-surface-muted)]">Open a queue to inspect its source record, review the recorded activity, and complete the next available action.</p></div>
            <button type="button" onClick={() => void load()} disabled={isLoading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />Refresh overview</button>
          </section>

          {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {content.links.map((link) => {
              const Icon = link.icon;
              return <button type="button" key={link.path} onClick={() => navigate(link.path)} className="group flex min-h-40 flex-col justify-between rounded-2xl bg-[var(--surface-lowest)] p-5 text-left transition-colors hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--accent-primary)] group-hover:bg-[var(--surface-lowest)]"><Icon className="h-5 w-5" /></span>
                <span className="mt-5 flex items-end justify-between gap-4"><span><span className="block text-sm font-bold text-[var(--on-surface)]">{link.title}</span><span className="mt-1 block text-xs leading-relaxed text-[var(--on-surface-muted)]">{link.detail}</span></span><ArrowRight className="mb-0.5 h-4 w-4 shrink-0 text-[var(--on-surface-subtle)] transition-transform group-hover:translate-x-1" /></span>
              </button>;
            })}
          </section>
          {isLoading && <p className="text-xs text-[var(--on-surface-subtle)]" role="status">Loading live workspace counts…</p>}
        </div>
      </main>
    </DeskWorkspaceLayout>
  );
};

export default OperationsLandingPage;
