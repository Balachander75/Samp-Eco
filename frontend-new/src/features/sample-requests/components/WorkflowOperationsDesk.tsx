import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  Boxes,
  Calculator,
  Eye,
  Factory,
  FileSpreadsheet,
  Image,
  Palette,
  RefreshCw,
  Search,
} from "lucide-react";
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
import { DesignRequestInspectorModal } from "./DesignRequestInspectorModal";
import {
  fetchDesignRequestApi,
  fetchSampleRequestByIdApi,
  mapDesignRequestToSampleRequest,
} from "@/infrastructure/api/sampleRequestsApi";
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
  design_review: "Design review",
  plant: "Plant execution",
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
  const [deliverableFilter, setDeliverableFilter] = useState<"all" | "sample" | "design" | "mockup" | "costing" | "resample">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sampleDetail, setSampleDetail] = useState<SampleRequestItem | null>(null);
  const [sampleDetailLoading, setSampleDetailLoading] = useState(false);
  const [sampleDetailError, setSampleDetailError] = useState<string | null>(null);

  const [designDetail, setDesignDetail] = useState<SampleRequestItem | null>(null);
  const [designDetailLoading, setDesignDetailLoading] = useState(false);
  const [designDetailError, setDesignDetailError] = useState<string | null>(null);

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

  const sampleCount = useMemo(
    () => records.filter((r) => r.workflow_type === "sample" && !r.request_data?.is_resample && !r.workflow_data?.isResample).length,
    [records]
  );
  const resampleCount = useMemo(
    () => records.filter((r) => r.workflow_type === "sample" && Boolean(r.request_data?.is_resample || r.workflow_data?.isResample)).length,
    [records]
  );
  const designCount = useMemo(
    () => records.filter((r) => r.workflow_type === "design").length,
    [records]
  );
  const mockupCount = useMemo(
    () => records.filter((r) => r.workflow_type === "mockup").length,
    [records]
  );
  const costingCount = useMemo(
    () => records.filter((r) => (mode === "costing" ? r.current_stage === "costing" : r.workflow_type === "costing")).length,
    [records, mode]
  );
  const returnedCount = useMemo(
    () => records.filter((record) => record.reviewer_status === "returned").length,
    [records]
  );

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return records.filter((record) => {
      // Deliverable filter in sampling mode
      if (mode === "sampling" && deliverableFilter !== "all") {
        const isResample = Boolean(record.request_data?.is_resample || record.workflow_data?.isResample);
        if (deliverableFilter === "sample" && (record.workflow_type !== "sample" || isResample)) return false;
        if (deliverableFilter === "resample" && (record.workflow_type !== "sample" || !isResample)) return false;
        if (deliverableFilter === "design" && record.workflow_type !== "design") return false;
        if (deliverableFilter === "mockup" && record.workflow_type !== "mockup") return false;
        if (deliverableFilter === "costing" && record.workflow_type !== "costing") return false;
      }

      // Stage filter
      const matchesStage = stageFilter === "all"
        || (stageFilter === "returned" ? record.reviewer_status === "returned" : record.current_stage === stageFilter);
      if (!matchesStage) return false;

      // Text search
      if (!query) return true;
      return [
        record.request_code,
        record.sr_number,
        record.customer,
        record.brand_name,
        record.material_code,
        record.product_description,
        record.status,
        record.reviewer_status,
        record.workflow_type,
        stageLabels[record.current_stage] || record.current_stage,
      ].some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
  }, [records, search, stageFilter, deliverableFilter, mode]);

  const selected = useMemo(() => {
    return records.find((record) => `${record.workflow_type}:${record.sample_request_id}` === selectedKey) || null;
  }, [records, selectedKey]);

  useEffect(() => {
    if (!selected || mode !== "sampling") {
      setSampleDetail(null);
      setSampleDetailError(null);
      setSampleDetailLoading(false);
      setDesignDetail(null);
      setDesignDetailError(null);
      setDesignDetailLoading(false);
      return;
    }

    let active = true;

    if (selected.workflow_type === "sample") {
      setSampleDetail(null);
      setSampleDetailError(null);
      setSampleDetailLoading(true);
      fetchSampleRequestByIdApi(selected.sample_request_id)
        .then((request) => { if (active) setSampleDetail(request); })
        .catch((reason) => { if (active) setSampleDetailError(reason instanceof Error ? reason.message : "Could not open the sample request."); })
        .finally(() => { if (active) setSampleDetailLoading(false); });
    } else {
      setSampleDetail(null);
      setSampleDetailLoading(false);
    }

    if (selected.workflow_type === "design") {
      setDesignDetail(null);
      setDesignDetailError(null);
      setDesignDetailLoading(true);
      fetchDesignRequestApi(selected.sample_request_id)
        .then((design) => {
          if (active) {
            setDesignDetail(mapDesignRequestToSampleRequest(design));
          }
        })
        .catch((reason) => { if (active) setDesignDetailError(reason instanceof Error ? reason.message : "Could not open the design brief."); })
        .finally(() => { if (active) setDesignDetailLoading(false); });
    } else {
      setDesignDetail(null);
      setDesignDetailLoading(false);
    }

    return () => { active = false; };
  }, [selected, mode]);

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
      header: "Action",
      width: "w-[104px]",
      align: "right",
      cell: (record) => (
        <button
          type="button"
          aria-label={`Inspect ${record.request_code || record.sr_number || "request"}`}
          onClick={(event) => {
            event.stopPropagation();
            setSelectedKey(`${record.workflow_type}:${record.sample_request_id}`);
          }}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11px] font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)] cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          Review
        </button>
      ),
    };

    if (mode === "costing") {
      return [
        {
          id: "request",
          header: "Request",
          width: "w-[150px]",
          sortable: true,
          cell: (record) => (
            <div>
              <div className="font-semibold text-[var(--on-surface)]">{record.request_code || record.sr_number || "Request"}</div>
              <div className="mt-0.5 text-[10px] text-[var(--on-surface-subtle)]">Costing</div>
            </div>
          ),
        },
        {
          id: "product",
          header: "Product / Customer",
          cell: (record) => (
            <div className="min-w-0">
              <div className="truncate font-semibold text-[var(--on-surface)]">{record.product_description || "Product request"}</div>
              <div className="truncate text-[11px] text-[var(--on-surface-muted)]">{record.customer}{record.brand_name ? ` · ${record.brand_name}` : ""}</div>
            </div>
          ),
        },
        { id: "material", header: "Material", width: "w-[140px]", cell: (record) => <span className="font-mono text-xs">{record.material_code || "—"}</span> },
        { id: "required", header: "Required date", width: "w-[130px]", cell: (record) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatRequiredDate(record.request_data?.required_date)}</span> },
        {
          id: "stage",
          header: "Workflow stage",
          width: "w-[190px]",
          cell: (record) => (
            <div className="flex flex-col items-start gap-1">
              <span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-muted)]">{stageLabels[record.current_stage] || record.current_stage}</span>
              {record.reviewer_status === "returned" && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">Returned for revision</span>}
            </div>
          ),
        },
        { id: "updated", header: "Last activity", width: "w-[135px]", cell: (record) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatDate(record.updated_at)}</span> },
        inspectColumn,
      ];
    }

    // Sampling mode columns: Deliverable-rich columns
    return [
      {
        id: "request",
        header: "Request",
        width: "w-[170px]",
        sortable: true,
        cell: (record) => {
          const isResample = Boolean(record.request_data?.is_resample || record.workflow_data?.isResample);
          return (
            <div>
              <div className="font-bold text-[var(--on-surface)]">{record.request_code || record.sr_number || "Request"}</div>
              {record.workflow_type === "sample" && (
                isResample ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-500/20">
                    <Factory className="w-2.5 h-2.5 text-blue-600" />
                    Resample → Plant
                  </span>
                ) : (
                  <span className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-500/20">
                    <Beaker className="w-2.5 h-2.5 text-teal-600" />
                    Sample Request
                  </span>
                )
              )}
              {record.workflow_type === "design" && (
                <span className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-500/20">
                  <Palette className="w-2.5 h-2.5 text-purple-600" />
                  Design Brief
                </span>
              )}
              {record.workflow_type === "mockup" && (
                <span className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-500/20">
                  <Boxes className="w-2.5 h-2.5 text-indigo-600" />
                  Studio Mockup
                </span>
              )}
              {record.workflow_type === "costing" && (
                <span className="mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20">
                  <Calculator className="w-2.5 h-2.5 text-amber-600" />
                  Costing BOM
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "product",
        header: "Product / Customer",
        cell: (record) => (
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--on-surface)]">{record.product_description || "Product request"}</div>
            <div className="truncate text-[11px] text-[var(--on-surface-muted)]">
              {record.customer}{record.brand_name ? ` · ${record.brand_name}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "material",
        header: "Material",
        width: "w-[130px]",
        cell: (record) => <span className="font-mono text-xs">{record.material_code || "—"}</span>,
      },
      {
        id: "scope",
        header: "Review Scope",
        width: "w-[210px]",
        cell: (record) => {
          const isResample = Boolean(record.request_data?.is_resample || record.workflow_data?.isResample);
          if (record.workflow_type === "sample") {
            return (
              <div>
                <span className="text-[11px] font-semibold text-[var(--on-surface)]">
                  {isResample ? "Repeat sample direct to Plant" : "Technical review & release to Plant"}
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--on-surface-subtle)]">
                  {isResample ? "Direct manufacturing dispatch" : "Sampling PMT verification"}
                </span>
              </div>
            );
          }
          if (record.workflow_type === "design") {
            return (
              <div>
                <span className="text-[11px] font-semibold text-[var(--on-surface)]">Design brief &amp; moodboard</span>
                <span className="mt-0.5 block text-[10px] text-[var(--on-surface-subtle)]">Creative specifications</span>
              </div>
            );
          }
          if (record.workflow_type === "mockup") {
            return (
              <div>
                <span className="text-[11px] font-semibold text-[var(--on-surface)]">Physical CAD / 3D mockup</span>
                <span className="mt-0.5 block text-[10px] text-[var(--on-surface-subtle)]">Studio technical structure</span>
              </div>
            );
          }
          return (
            <div>
              <span className="text-[11px] font-semibold text-[var(--on-surface)]">Costing BOM estimation</span>
              <span className="mt-0.5 block text-[10px] text-[var(--on-surface-subtle)]">Technical output review</span>
            </div>
          );
        },
      },
      {
        id: "stage",
        header: "Current Stage",
        width: "w-[180px]",
        cell: (record) => {
          const isReleased = record.status === "Released to Plant";
          const isAwaitingSampling = record.status === "Sampling Review (PMT)" || record.current_stage === "sampling_review";
          return (
            <div>
              {isReleased ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/20">
                  Released to Plant
                </span>
              ) : isAwaitingSampling ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-500/20">
                  Awaiting Sampling Release
                </span>
              ) : (
                <span className="rounded-full bg-[var(--surface-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface-muted)]">
                  {record.status || stageLabels[record.current_stage] || record.current_stage}
                </span>
              )}
              {record.reviewer_status === "returned" && (
                <span className="mt-1 block text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  Returned for revision
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "plant",
        header: "Target Plant",
        width: "w-[130px]",
        cell: (record) => {
          const plant = record.request_data?.target_plant || record.workflow_data?.plantReleaseTarget || "Khaniwade";
          return (
            <div className="flex items-center gap-1.5 text-xs text-[var(--on-surface)]">
              <Factory className="h-3.5 w-3.5 text-teal-600" />
              <span>{String(plant)}</span>
            </div>
          );
        },
      },
      {
        id: "updated",
        header: "Last Activity",
        width: "w-[125px]",
        cell: (record) => <span className="text-[11px] tabular-nums text-[var(--on-surface-muted)]">{formatDate(record.updated_at)}</span>,
      },
      inspectColumn,
    ];
  }, [mode]);

  const title = mode === "costing" ? "Costing Work Queue" : "Sampling Team Review & Operations Desk";
  const subtitle = mode === "costing"
    ? "Inspect the product brief, costing inputs, output history, and handoff before submitting to Sampling."
    : "Review all Sampling deliverables: Standard Sample Requests, Design Briefs, Studio Mockups, Costing handoffs, and Direct Plant Resamples.";

  const kpis = mode === "costing"
    ? [
      { label: "In Costing", value: costingCount, detail: "Needs Costing action", color: "bg-emerald-600", isActive: stageFilter === "costing", onClick: () => setStageFilter((current) => current === "costing" ? "all" : "costing") },
      { label: "Returned", value: returnedCount, detail: "Needs another pass", color: "bg-amber-600", isActive: stageFilter === "returned", onClick: () => setStageFilter((current) => current === "returned" ? "all" : "returned") },
    ]
    : [
      {
        label: "All Reviews",
        value: records.length,
        detail: "Complete Sampling queue",
        color: "bg-emerald-600",
        isActive: deliverableFilter === "all",
        onClick: () => setDeliverableFilter("all"),
      },
      {
        label: "Sampling Requests",
        value: sampleCount,
        detail: "Needs Sampling release to Plant",
        color: "bg-teal-600",
        isActive: deliverableFilter === "sample",
        onClick: () => setDeliverableFilter((c) => c === "sample" ? "all" : "sample"),
      },
      {
        label: "Design Briefs",
        value: designCount,
        detail: "Design specs & moodboards",
        color: "bg-purple-600",
        isActive: deliverableFilter === "design",
        onClick: () => setDeliverableFilter((c) => c === "design" ? "all" : "design"),
      },
      {
        label: "Mockups",
        value: mockupCount,
        detail: "Studio 3D & artwork review",
        color: "bg-indigo-600",
        isActive: deliverableFilter === "mockup",
        onClick: () => setDeliverableFilter((c) => c === "mockup" ? "all" : "mockup"),
      },
      {
        label: "Costing",
        value: costingCount,
        detail: "BOM sheets & rate cards",
        color: "bg-amber-600",
        isActive: deliverableFilter === "costing",
        onClick: () => setDeliverableFilter((c) => c === "costing" ? "all" : "costing"),
      },
      {
        label: "Direct Resamples",
        value: resampleCount,
        detail: "Direct to Plant (Repeat orders)",
        color: "bg-blue-600",
        isActive: deliverableFilter === "resample",
        onClick: () => setDeliverableFilter((c) => c === "resample" ? "all" : "resample"),
      },
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
      kpiGridCols={mode === "sampling" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" : "grid-cols-1 sm:grid-cols-2"}
      search={{ value: search, onChange: setSearch, placeholder: "Search SR, customer, material, deliverable…" }}
      filterControls={
        mode === "sampling" ? (
          <label className="flex h-8 items-center gap-2 rounded-lg bg-[var(--surface-low)] px-2.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">
            <span className="whitespace-nowrap">Deliverable</span>
            <select
              aria-label="Filter sampling reviews by deliverable type"
              value={deliverableFilter}
              onChange={(e) => setDeliverableFilter(e.target.value as any)}
              className="bg-transparent text-xs text-[var(--on-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer"
            >
              <option value="all">All Deliverables ({records.length})</option>
              <option value="sample">Sampling Requests ({sampleCount})</option>
              <option value="design">Design Briefs ({designCount})</option>
              <option value="mockup">Mockup Reviews ({mockupCount})</option>
              <option value="costing">Costing Reviews ({costingCount})</option>
              <option value="resample">Direct Resamples ({resampleCount})</option>
            </select>
          </label>
        ) : mode === "costing" && filterOptions.length > 2 ? (
          <label className="flex h-8 items-center gap-2 rounded-lg bg-[var(--surface-low)] px-2.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">
            <span className="whitespace-nowrap">Stage</span>
            <select
              aria-label="Filter costing requests by stage"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="max-w-[190px] bg-transparent text-xs text-[var(--on-surface)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : undefined
      }
      hasActiveFilters={Boolean(search) || stageFilter !== "all" || deliverableFilter !== "all"}
      onResetFilters={() => {
        setSearch("");
        setStageFilter("all");
        setDeliverableFilter("all");
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-5">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {!error && (isLoading || visibleRecords.length > 0) && (
          <section className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-[var(--surface-lowest)]">
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
          </section>
        )}
        {!isLoading && !error && visibleRecords.length === 0 && (
          <section className="flex min-h-48 flex-1 flex-col items-center justify-center rounded-xl bg-[var(--surface-lowest)] px-6 py-10 text-center" role="status">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-low)] text-[var(--accent-primary)]">
              {search || stageFilter !== "all" || deliverableFilter !== "all" ? (
                <Search className="h-5 w-5" />
              ) : mode === "costing" ? (
                <FileSpreadsheet className="h-5 w-5" />
              ) : (
                <Image className="h-5 w-5" />
              )}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
              {search || stageFilter !== "all" || deliverableFilter !== "all" ? "No requests match these filters" : mode === "costing" ? "No Costing work assigned" : "No requests awaiting review"}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--on-surface-muted)]">
              {search || stageFilter !== "all" || deliverableFilter !== "all"
                ? "Adjust the search or deliverable filter to see more requests."
                : mode === "costing"
                  ? "Requests appear after Creative releases the brief to Costing."
                  : "Reviews appear when Sample Requests, Design Briefs, Mockups, or Costing handoffs are raised."}
            </p>
            {(search || stageFilter !== "all" || deliverableFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStageFilter("all");
                  setDeliverableFilter("all");
                }}
                className="mt-4 inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-[var(--accent-primary-strong)] hover:bg-[var(--surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </section>
        )}
        {isLoading && <div role="status" className="sr-only">Refreshing workflow records</div>}
      </div>

      {/* Costing Workspace Inspector */}
      {selected && mode === "costing" && (
        <CostingWorkflowInspectorModal
          record={selected}
          mode="costing"
          user={user}
          onClose={() => setSelectedKey(null)}
          onSaved={load}
        />
      )}

      {/* Sampling: Sample Request Inspector (with full Sampling role controls) */}
      {selected && mode === "sampling" && selected.workflow_type === "sample" && sampleDetail && (
        <SampleRequestInspector
          request={sampleDetail}
          isOpen
          role="sampling"
          actorName={user?.name || user?.userid}
          actorUserId={user?.id}
          isAdmin={isAdminUser(user)}
          readOnly={isReadOnlyTeamHead(user)}
          onClose={() => {
            setSelectedKey(null);
            setSampleDetail(null);
          }}
          onRefresh={load}
        />
      )}
      {selected && mode === "sampling" && selected.workflow_type === "sample" && sampleDetailLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" role="status">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-lowest)] px-5 py-4 text-sm font-semibold text-[var(--on-surface)] shadow-xl">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-600" />
            Loading sample request details…
          </div>
        </div>
      )}
      {selected && mode === "sampling" && selected.workflow_type === "sample" && sampleDetailError && (
        <div role="alert" className="fixed bottom-5 right-5 z-[110] max-w-sm rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-lg border border-rose-200">
          {sampleDetailError}
        </div>
      )}

      {/* Sampling: Design Request Inspector (for design briefs) */}
      {selected && mode === "sampling" && selected.workflow_type === "design" && designDetail && (
        <DesignRequestInspectorModal
          request={designDetail}
          isOpen
          mode="sampling"
          onClose={() => {
            setSelectedKey(null);
            setDesignDetail(null);
          }}
          onRefresh={load}
        />
      )}
      {selected && mode === "sampling" && selected.workflow_type === "design" && designDetailLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" role="status">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-lowest)] px-5 py-4 text-sm font-semibold text-[var(--on-surface)] shadow-xl">
            <RefreshCw className="h-4 w-4 animate-spin text-purple-600" />
            Loading design brief details…
          </div>
        </div>
      )}
      {selected && mode === "sampling" && selected.workflow_type === "design" && designDetailError && (
        <div role="alert" className="fixed bottom-5 right-5 z-[110] max-w-sm rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 shadow-lg border border-rose-200">
          {designDetailError}
        </div>
      )}

      {/* Sampling: Costing Technical Review Inspector */}
      {selected && mode === "sampling" && selected.workflow_type === "costing" && (
        <CostingWorkflowInspectorModal
          record={selected}
          mode="sampling"
          user={user}
          onClose={() => setSelectedKey(null)}
          onSaved={load}
        />
      )}

      {/* Sampling: Mockup Review Inspector */}
      {selected && mode === "sampling" && selected.workflow_type === "mockup" && (
        <MockupSamplingInspectorModal
          record={selected}
          user={user}
          onClose={() => setSelectedKey(null)}
          onSaved={load}
        />
      )}
    </DeskWorkspaceLayout>
  );
};

export default WorkflowOperationsDesk;
