import React, { useMemo, useState } from "react";
import {
  Layers,
  Building2,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { DeskWorkspaceLayout, DataTable, type ColumnDef, type DeskKpiItem } from "@/components/erp";
import type { UserProfile } from "@/features/auth";
import type { RequestWorkflowRecord } from "@/infrastructure/api";
import { CostingWorkflowInspectorModal } from "@/features/sample-requests/components/CostingWorkflowInspectorModal";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { exportRecordsToCsv } from "@/lib/csvExport";

interface CreativeCostingPageProps {
  requests: RequestWorkflowRecord[];
  isLoading: boolean;
  user?: UserProfile | null;
  selectedYear: string;
  onRefresh: () => Promise<void>;
}

export type CostingStageTab = "all" | "input_needed" | "input_provided" | "overdue";

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function formatCreativeDeadline(value: unknown) {
  const raw = String(value || "");
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw
    : new Intl.DateTimeFormat("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
  const [selectedStageTab, setSelectedStageTab] = useState<CostingStageTab>("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  const now = useMemo(() => new Date(), []);

  // Telemetry counts
  const telemetry = useMemo(() => {
    let inputNeeded = 0;
    let inputProvided = 0;
    let overdue = 0;

    requests.forEach((r) => {
      const hasRemark = Boolean(r.costing_creative_input_remark && r.costing_creative_input_remark.trim() !== "");
      const isInputNeeded = r.costing_creative_input_needed === true;

      if (isInputNeeded && !hasRemark) {
        inputNeeded++;
      }
      if (isInputNeeded && hasRemark) {
        inputProvided++;
      }

      if (r.creative_due_at) {
        const dt = new Date(r.creative_due_at);
        if (!isNaN(dt.getTime()) && dt < now && r.status !== "done") {
          overdue++;
        }
      }
    });

    return {
      all: requests.length,
      inputNeeded,
      inputProvided,
      overdue,
    };
  }, [requests, now]);

  // Unique sorted customers list for filter dropdown
  const customerOptions = useMemo(() => {
    const countsMap: Record<string, number> = {};
    requests.forEach((r) => {
      const c = (r.customer || "").trim();
      if (c) countsMap[c] = (countsMap[c] || 0) + 1;
    });

    const sorted = Object.entries(countsMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        value: name,
        label: `${name} (${count})`,
      }));

    return [{ value: "all", label: `All Customers (${requests.length})` }, ...sorted];
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const hasRemark = Boolean(r.costing_creative_input_remark && r.costing_creative_input_remark.trim() !== "");
      const isInputNeeded = r.costing_creative_input_needed === true;

      // Stage Tab Filter
      if (selectedStageTab === "input_needed" && (!isInputNeeded || hasRemark)) return false;
      if (selectedStageTab === "input_provided" && (!isInputNeeded || !hasRemark)) return false;
      if (selectedStageTab === "overdue") {
        if (!r.creative_due_at) return false;
        const dt = new Date(r.creative_due_at);
        if (isNaN(dt.getTime()) || dt >= now || r.status === "done") return false;
      }

      // Customer Filter
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) {
        return false;
      }

      // Search Query Filter
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matches = [
          r.sr_number,
          r.request_code,
          r.customer,
          r.brand_name,
          r.material_code,
          r.product_description,
          r.status,
          r.current_stage,
          r.costing_creative_input_remark,
        ].some((val) => String(val || "").toLowerCase().includes(query));
        if (!matches) return false;
      }

      return true;
    });
  }, [requests, selectedStageTab, customerFilter, search, now]);

  const selected = requests.find((request) => request.sample_request_id === selectedKey) || null;

  // KPI Ribbon Items matching Theme
  const kpiItems = useMemo<DeskKpiItem[]>(() => [
    {
      label: "All Costing Requests",
      value: telemetry.all,
      detail: "Total in review queue",
      color: "bg-[#245942]",
      isActive: selectedStageTab === "all",
      onClick: () => setSelectedStageTab("all"),
    },
    {
      label: "Awaiting Creative Input",
      value: telemetry.inputNeeded,
      detail: "Class & specs required",
      color: "bg-amber-500",
      isActive: selectedStageTab === "input_needed",
      onClick: () => setSelectedStageTab("input_needed"),
    },
    {
      label: "Creative Input Ready",
      value: telemetry.inputProvided,
      detail: "Remarks & specs logged",
      color: "bg-purple-500",
      isActive: selectedStageTab === "input_provided",
      onClick: () => setSelectedStageTab("input_provided"),
    },
    {
      label: "Overdue SLA",
      value: telemetry.overdue,
      detail: "Target deadline passed",
      color: "bg-rose-500",
      isActive: selectedStageTab === "overdue",
      onClick: () => setSelectedStageTab("overdue"),
    },
  ], [telemetry, selectedStageTab]);

  const hasActiveFilters = Boolean(search || selectedStageTab !== "all" || customerFilter !== "all");

  const handleResetFilters = () => {
    setSearch("");
    setSelectedStageTab("all");
    setCustomerFilter("all");
  };

  // CSV Export
  const handleExportCSV = () => {
    exportRecordsToCsv<RequestWorkflowRecord>({
      filename: `creative_costing_requests_${selectedYear}`,
      columns: [
        { header: "SR Number", accessor: (r) => r.sr_number || r.request_code || `CR-${r.sample_request_id}` },
        { header: "Customer", accessor: (r) => r.customer },
        { header: "Brand", accessor: (r) => r.brand_name || "" },
        { header: "Product Description", accessor: (r) => r.product_description },
        { header: "Material Code", accessor: (r) => r.material_code },
        {
          header: "Quantity",
          accessor: (r) => `${display(r.request_data?.quantity)} ${display(r.request_data?.unit_pc_pack)}`,
        },
        {
          header: "Creative Remark",
          accessor: (r) => display(r.costing_creative_input_remark),
        },
        { header: "Creative Due Date", accessor: (r) => display(r.creative_due_at) },
        { header: "Status", accessor: (r) => r.status },
      ],
      data: filteredRequests,
    });
  };

  // Standard Theme Columns
  const columns = useMemo<ColumnDef<RequestWorkflowRecord>[]>(() => [
    {
      id: "request",
      header: "Request",
      width: "w-[125px]",
      sortable: true,
      cell: (request) => {
        const code = request.sr_number || request.request_code || `CR-${request.sample_request_id}`;
        return (
          <div className="min-w-0">
            <div className="font-mono font-bold">
              <CopyBadge text={code} />
            </div>
            <div className="mt-0.5 text-[10px] font-mono text-[var(--on-surface-subtle)] truncate">
              Costing Review
            </div>
          </div>
        );
      },
    },
    {
      id: "customer",
      header: "Customer / Brand",
      width: "w-[130px]",
      sortable: true,
      cell: (request) => (
        <div className="min-w-0 max-w-[130px]">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)] truncate" title={request.customer}>
            <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
            <span className="truncate">{request.customer || "—"}</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5 truncate" title={request.brand_name || ""}>
            {request.brand_name || "Commercial Account"}
          </div>
        </div>
      ),
    },
    {
      id: "program",
      header: "Program / Year",
      width: "w-[120px]",
      cell: (request) => {
        const progName =
          request.program_name ||
          request.request_data?.programName ||
          request.request_data?.program_name ||
          request.request_data?.programCampaignTitle ||
          "—";
        const progYear =
          request.program_year ||
          request.request_data?.programYear ||
          request.request_data?.program_year;

        return (
          <div className="min-w-0 max-w-[120px]">
            <span className="block truncate font-semibold text-xs text-[var(--on-surface)]" title={progName}>
              {progName}
            </span>
            {progYear && (
              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                BY {progYear}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "product",
      header: "Product / Material",
      cell: (request) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-xs text-[var(--on-surface)]" title={request.product_description}>
            {request.product_description || "Product request"}
          </div>
          <div className="text-[11px] font-mono text-[var(--on-surface-muted)] truncate mt-0.5">
            {request.material_code ? `Material: ${request.material_code}` : "—"}
          </div>
        </div>
      ),
    },
    {
      id: "quantity",
      header: "Costing Qty",
      width: "w-[95px]",
      align: "center",
      cell: (request) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] bg-[var(--surface-low)] text-[var(--on-surface)] tabular-nums border border-[var(--border-subtle)]">
          {display(request.request_data?.quantity)} {display(request.request_data?.unit_pc_pack || "pcs")}
        </span>
      ),
    },
    {
      id: "creative_input",
      header: "Creative Input Status",
      width: "w-[130px]",
      cell: (request) => {
        const hasRemark = Boolean(request.costing_creative_input_remark && request.costing_creative_input_remark.trim() !== "");
        const isNeeded = request.costing_creative_input_needed === true;

        if (isNeeded && hasRemark) {
          return (
            <div className="space-y-0.5 min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                Input Logged
              </span>
              <div className="text-[10px] font-mono text-[var(--on-surface-muted)] truncate max-w-[125px]" title={request.costing_creative_input_remark || ""}>
                {request.costing_creative_input_remark}
              </div>
            </div>
          );
        }

        if (isNeeded) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
              Input Needed
            </span>
          );
        }

        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-[var(--on-surface-subtle)] bg-[var(--surface-low)] border border-[var(--border-subtle)]">
            Standard Spec
          </span>
        );
      },
    },
    {
      id: "due",
      header: "Creative Deadline",
      width: "w-[125px]",
      cell: (request) => {
        if (!request.creative_due_at) {
          return <span className="text-[11px] font-mono text-[var(--on-surface-subtle)]">Standard SLA</span>;
        }

        const dt = new Date(request.creative_due_at);
        const isPast = !isNaN(dt.getTime()) && dt < now && request.status !== "done";

        return (
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1 font-mono text-xs tabular-nums text-[var(--on-surface)] truncate">
              <Clock className={`w-3.5 h-3.5 shrink-0 ${isPast ? "text-rose-500" : "text-[var(--on-surface-subtle)]"}`} />
              <span className={isPast ? "font-semibold text-rose-600" : ""}>
                {formatCreativeDeadline(request.creative_due_at)}
              </span>
            </div>
            {isPast && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                <span>Overdue</span>
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: "w-[105px]",
      cell: (request) => (
        <StatusPill status={request.status || request.current_stage || "Creative"} size="sm" showDot />
      ),
    },
    {
      id: "actions",
      header: "Action",
      width: "w-[95px]",
      align: "right",
      cell: (request) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={`Respond to ${request.sr_number || request.request_code}`}
            onClick={() => setSelectedKey(request.sample_request_id)}
            className="select-none rounded-lg px-2 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <span>Respond</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      ),
    },
  ], [now]);

  return (
    <>
      <DeskWorkspaceLayout
        title="Costing Requests Review"
        businessYear={selectedYear}
        totalCount={requests.length}
        totalLabel="Total Requests"
        onRefresh={onRefresh}
        isRefreshing={isLoading}
        onExportCSV={handleExportCSV}
        exportDisabled={filteredRequests.length === 0}
        kpiItems={kpiItems}
        kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search SR, customer, material…",
        }}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        resetFiltersLabel="Clear Filters"
        extraFilterControls={
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Outcome Segmented Tabs (Compact) matching Feasibility/Sampling theme */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5 shadow-2xs shrink-0">
              {[
                { id: "all" as const, label: "All Requests", icon: Layers, count: telemetry.all },
                { id: "input_needed" as const, label: "Input Needed", icon: AlertTriangle, count: telemetry.inputNeeded },
                { id: "input_provided" as const, label: "Input Ready", icon: CheckCircle2, count: telemetry.inputProvided },
                { id: "overdue" as const, label: "Overdue", icon: Clock, count: telemetry.overdue },
              ].map((item) => {
                const isSelected = selectedStageTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedStageTab(item.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                      isSelected
                        ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold border border-[var(--border-subtle)]"
                        : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-lowest)]/50"
                    }`}
                  >
                    <item.icon className={`w-3 h-3 ${isSelected ? "text-[var(--accent-primary)]" : "opacity-70"}`} />
                    <span>{item.label}</span>
                    <span
                      className={`text-[9.5px] font-mono px-1 py-0.2 rounded-full tabular-nums ${
                        isSelected
                          ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                          : "text-[var(--on-surface-subtle)] bg-[var(--surface-lowest)]/60"
                      }`}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Customer Filter Dropdown */}
            <div className="w-48 sm:w-56">
              <Select
                aria-label="Filter by customer"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                size="sm"
                options={customerOptions}
              />
            </div>
          </div>
        }
      >
        <DataTable
          data={filteredRequests}
          columns={columns}
          keyExtractor={(request) => String(request.sample_request_id)}
          isLoading={isLoading}
          selectedRowId={selectedKey}
          onRowClick={(request) => setSelectedKey(request.sample_request_id)}
          tableClassName="w-full table-fixed min-w-0"
          containerClassName="overflow-y-auto overflow-x-hidden"
          emptyMessage={
            search
              ? `No Costing requests match the search "${search}".`
              : selectedStageTab !== "all"
              ? "No Costing requests match the selected stage."
              : "No Costing requests are waiting for Creative review."
          }
          pageSize={30}
        />
      </DeskWorkspaceLayout>

      {/* Inspector Modal */}
      {selected && (
        <CostingWorkflowInspectorModal
          record={selected}
          mode="creative"
          user={user}
          onClose={() => setSelectedKey(null)}
          onSaved={onRefresh}
        />
      )}
    </>
  );
};

export default CreativeCostingPage;
