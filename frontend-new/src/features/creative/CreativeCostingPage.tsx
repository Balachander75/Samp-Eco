import React, { useMemo, useState } from "react";
import { Eye, FileSpreadsheet } from "lucide-react";
import { DeskWorkspaceLayout, DataTable, type ColumnDef } from "@/components/erp";
import type { UserProfile } from "@/features/auth";
import type { RequestWorkflowRecord } from "@/infrastructure/api";
import { CostingWorkflowInspectorModal } from "@/features/sample-requests/components/CostingWorkflowInspectorModal";

interface CreativeCostingPageProps {
  requests: RequestWorkflowRecord[];
  isLoading: boolean;
  user?: UserProfile | null;
  selectedYear: string;
  onRefresh: () => Promise<void>;
}

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatDate(value: unknown) {
  const raw = String(value || "");
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString();
}

function formatCreativeDeadline(value: unknown) {
  const raw = String(value || "");
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export const CreativeCostingPage: React.FC<CreativeCostingPageProps> = ({
  requests,
  isLoading,
  user,
  selectedYear,
  onRefresh,
}) => {
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<number | null>(null);

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return requests;
    return requests.filter((request) => [
      request.sr_number,
      request.customer,
      request.brand_name,
      request.material_code,
      request.product_description,
      request.status,
      request.costing_creative_input_remark,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [requests, search]);

  const selected = requests.find((request) => request.sample_request_id === selectedKey) || null;
  const columns = useMemo<ColumnDef<RequestWorkflowRecord>[]>(() => [
    {
      id: "request",
      header: "Request",
      width: "w-[150px]",
      sortable: true,
      cell: (request) => <div><div className="font-semibold text-[var(--on-surface)]">{request.sr_number}</div><div className="mt-0.5 text-[10px] text-[var(--on-surface-subtle)]">Costing · Creative review</div></div>,
    },
    {
      id: "product",
      header: "Product / Customer",
      cell: (request) => <div className="min-w-0"><div className="truncate font-semibold text-[var(--on-surface)]">{request.product_description || "Product request"}</div><div className="truncate text-[11px] text-[var(--on-surface-muted)]">{request.customer}{request.brand_name ? ` · ${request.brand_name}` : ""}</div></div>,
    },
    { id: "material", header: "Material", width: "w-[145px]", cell: (request) => <span className="font-mono text-xs">{display(request.material_code)}</span> },
    {
      id: "quantity",
      header: "Costing quantity",
      width: "w-[150px]",
      cell: (request) => <span className="text-xs font-semibold">{display(request.request_data?.quantity)} <span className="font-normal text-[var(--on-surface-muted)]">{display(request.request_data?.unit_pc_pack)}</span></span>,
    },
    { id: "due", header: "Required date", width: "w-[130px]", cell: (request) => <span className="text-[11px] text-[var(--on-surface-muted)]">{formatDate(request.request_data?.required_date)}</span> },
    { id: "creative-deadline", header: "Creative deadline (IST)", width: "w-[155px]", cell: (request) => <span className="text-[11px] font-semibold text-[var(--on-surface-muted)]">{formatCreativeDeadline(request.creative_due_at)}</span> },
    {
      id: "inspect",
      header: "Inspect",
      width: "w-[104px]",
      align: "right",
      cell: (request) => <button type="button" aria-label={`Inspect ${request.sr_number}`} onClick={(event) => { event.stopPropagation(); setSelectedKey(request.sample_request_id); }} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11px] font-semibold text-[var(--on-surface)] hover:bg-[var(--surface-low)]"><Eye className="h-3.5 w-3.5" />Inspect</button>,
    },
  ], []);

  return (
    <>
      <DeskWorkspaceLayout
        title="Costing Requests"
        subtitle="Review product specifications, complete highlighted Creative fields, then send each request to Costing."
        businessYear={selectedYear}
        totalCount={requests.length}
        totalLabel="requests awaiting Creative review"
        onRefresh={onRefresh}
        isRefreshing={isLoading}
        kpiItems={[{ label: "Awaiting handoff", value: requests.length, detail: "Costing requests in the Creative queue", color: "bg-violet-600" }]}
        kpiGridCols="grid-cols-1"
        search={{ value: search, onChange: setSearch, placeholder: "Search SR, customer, material…" }}
        hasActiveFilters={Boolean(search)}
        onResetFilters={() => setSearch("")}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
          <section className="min-w-0 overflow-hidden rounded-xl bg-[var(--surface-lowest)]">
            <DataTable
              data={visibleRequests}
              columns={columns}
              keyExtractor={(request) => String(request.sample_request_id)}
              isLoading={isLoading}
              selectedRowId={selectedKey}
              onRowClick={(request) => setSelectedKey(request.sample_request_id)}
              emptyMessage={search ? "No Costing requests match this search." : "No Costing requests are waiting for Creative review."}
              pageSize={30}
            />
          </section>
          {!isLoading && requests.length === 0 && <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-lowest)] p-4 text-xs text-[var(--on-surface-muted)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-low)]"><FileSpreadsheet className="h-4 w-4" /></span><span>Marketing Costing requests appear here first. Review their class specifications and send them to the Costing work queue.</span></div>}
        </div>
      </DeskWorkspaceLayout>

      {selected && <CostingWorkflowInspectorModal record={selected} mode="creative" user={user} onClose={() => setSelectedKey(null)} onSaved={onRefresh} />}
    </>
  );
};

export default CreativeCostingPage;
