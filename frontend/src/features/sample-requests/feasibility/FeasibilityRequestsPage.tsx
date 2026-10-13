import React, { useState, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "../types";
import { getRequestTrackType } from "../utils/trackTypes";
import { formatOdooDate } from "../utils/dateUtils";
import {
  Search,
  X,
  Plus,
  Download,
  Trash2,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Building2,
  User,
  FlaskConical,
} from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";

export interface FeasibilityRequestsPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  uniquePlants: string[];
  uniqueCustomers: string[];
  user?: UserProfile | null;
  isAdmin: boolean;
  isReadOnly?: boolean;
  onOpenNewModal: () => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onMarketingApproveFeasibility: (
    requestId: string | number,
    approved: boolean,
    remark?: string
  ) => Promise<void>;
  onDeleteRequest: (req: SampleRequestItem, e?: React.MouseEvent) => Promise<void>;
  onBatchDelete: (selectedIds: Set<string | number>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onExportCSV: () => void;
  onUpdateStatus?: (reqId: string | number, newStatus: string) => Promise<void>;
}

export type MarketingFeasibilityTab =
  | "all"
  | "awaiting_claim"
  | "in_review"
  | "awaiting_counter_date"
  | "awaiting_decision"
  | "decision_complete";

type MarketingFeasibilityOutcome =
  | "all"
  | "feasible"
  | "conditional"
  | "approved"
  | "converted"
  | "rejected";

export const FeasibilityRequestsPage: React.FC<FeasibilityRequestsPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  selectedPlant,
  uniquePlants,
  uniqueCustomers,
  user,
  isAdmin,
  isReadOnly = false,
  onOpenNewModal,
  onInspectRequest,
  onMarketingApproveFeasibility,
  onDeleteRequest,
  onBatchDelete,
  onRefresh,
  onExportCSV,
}) => {
  const [filterTab, setFilterTab] = useState<MarketingFeasibilityTab>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<MarketingFeasibilityOutcome>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Strict separation for feasibility requests
  const feasibilityRequests = useMemo(() => {
    return requests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const mat = String(r.materialCode || "").toLowerCase();
      const idStr = String(r.id || "");

      return (
        kind === "feasibility" ||
        idStr.startsWith("feasibility-") ||
        mode === "feasibility_check" ||
        mode === "feasibility" ||
        mat.startsWith("fc-") ||
        Boolean(r.feasibilityType) ||
        Boolean(r.customFeasibilityType) ||
        getRequestTrackType(r) === "feasibility_check"
      );
    });
  }, [requests]);

  // Derived Customers List strictly from feasibility requests
  const customerList = useMemo(() => {
    const set = new Set<string>();
    feasibilityRequests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [feasibilityRequests]);

  // Operational metrics
  const metrics = useMemo(() => {
    const total = feasibilityRequests.length;
    let awaitingClaim = 0;
    let inReview = 0;
    let awaitingDecision = 0;
    let awaitingCounterDate = 0;
    let awaitingMarketingAction = 0;
    let decisionComplete = 0;
    let feasible = 0;
    let conditional = 0;
    let approved = 0;
    let converted = 0;
    let rejected = 0;

    feasibilityRequests.forEach((r) => {
      const hasSampVerdict = Boolean(r.samplingFeasibilityResponse);
      const dec = (r.marketingDecision || "").toLowerCase();
      const status = (r.status || "").toLowerCase();
      const isDecisionComplete =
        Boolean(r.marketingDecision) ||
        status.includes("approved") ||
        status.includes("rejected") ||
        status.includes("closed");

      if (!r.takenBySamp && !hasSampVerdict) {
        awaitingClaim++;
      } else if (r.takenBySamp && !hasSampVerdict) {
        inReview++;
      }

      if (hasSampVerdict && !isDecisionComplete) {
        awaitingDecision++;
      }
      if (r.counterDateDecision === "pending") awaitingCounterDate++;
      if (!isDecisionComplete && (r.counterDateDecision === "pending" || hasSampVerdict)) {
        awaitingMarketingAction++;
      }
      if (isDecisionComplete) decisionComplete++;

      if (r.samplingFeasibilityResponse === "Yes") feasible++;
      if (r.samplingFeasibilityResponse === "Maybe") conditional++;

      if (dec === "accepted" || status.includes("approved")) {
        approved++;
      }
      if (dec === "rejected" || status.includes("rejected") || status.includes("closed")) {
        rejected++;
      }
      if (Boolean(r.convertedSrNumber || r.convertedSampleRequestId)) {
        converted++;
      }
    });

    const evaluatedWithSla = feasibilityRequests.filter(
      (r) =>
        Boolean(r.samplingFeasibilityResponse) &&
        r.isRespondedOnTime !== null &&
        r.isRespondedOnTime !== undefined
    );
    const onTimeCount = evaluatedWithSla.filter((r) => r.isRespondedOnTime === true).length;
    const slaPercent =
      evaluatedWithSla.length > 0 ? Math.round((onTimeCount / evaluatedWithSla.length) * 100) : 100;

    return {
      total,
      awaitingClaim,
      inReview,
      awaitingDecision,
      awaitingCounterDate,
      awaitingMarketingAction,
      decisionComplete,
      feasible,
      conditional,
      approved,
      converted,
      rejected,
      slaPercent,
    };
  }, [feasibilityRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return feasibilityRequests.filter((r) => {
      if (filterTab === "awaiting_counter_date") {
        if (r.counterDateDecision !== "pending") return false;
      } else if (filterTab === "awaiting_claim") {
        if (r.takenBySamp || r.samplingFeasibilityResponse) return false;
      } else if (filterTab === "in_review") {
        if (!r.takenBySamp || r.samplingFeasibilityResponse) return false;
      } else if (filterTab === "awaiting_decision") {
        const status = (r.status || "").toLowerCase();
        const isComplete =
          Boolean(r.marketingDecision) ||
          status.includes("approved") ||
          status.includes("rejected") ||
          status.includes("closed");
        const needsCounterDate = r.counterDateDecision === "pending";
        const needsVerdictSignOff = Boolean(r.samplingFeasibilityResponse) && !isComplete;
        if (!needsCounterDate && !needsVerdictSignOff) return false;
      } else if (filterTab === "decision_complete") {
        const status = (r.status || "").toLowerCase();
        const isComplete =
          Boolean(r.marketingDecision) ||
          status.includes("approved") ||
          status.includes("rejected") ||
          status.includes("closed");
        if (!isComplete) return false;
      }

      if (outcomeFilter === "feasible") {
        if (r.samplingFeasibilityResponse !== "Yes") return false;
      } else if (outcomeFilter === "conditional") {
        if (r.samplingFeasibilityResponse !== "Maybe") return false;
      } else if (outcomeFilter === "approved") {
        const dec = (r.marketingDecision || "").toLowerCase();
        const st = (r.status || "").toLowerCase();
        if (dec !== "accepted" && !st.includes("approved")) return false;
      } else if (outcomeFilter === "converted") {
        if (!r.convertedSrNumber && !r.convertedSampleRequestId) return false;
      } else if (outcomeFilter === "rejected") {
        const dec = (r.marketingDecision || "").toLowerCase();
        const st = (r.status || "").toLowerCase();
        if (dec !== "rejected" && !st.includes("rejected") && !st.includes("closed")) return false;
      }

      if (customerFilter !== "all" && r.customer !== customerFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mat = (r.materialCode || "").toLowerCase();
        const desc = (r.productDescription || r.feasibilityDescription || r.descriptionNotes || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const plant = (r.targetPlant || "").toLowerCase();
        const samp = (r.takenBySamp || "").toLowerCase();
        const requester = (r.createdBy || "").toLowerCase();
        const cat = (r.customFeasibilityType || r.feasibilityType || "").toLowerCase();
        return (
          mat.includes(q) ||
          desc.includes(q) ||
          cust.includes(q) ||
          plant.includes(q) ||
          samp.includes(q) ||
          requester.includes(q) ||
          cat.includes(q)
        );
      }

      return true;
    });
  }, [feasibilityRequests, filterTab, outcomeFilter, customerFilter, searchTerm]);

  // Row selection
  const handleToggleSelectRow = (id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredRequests.map((r) => r.id);
    const allVisibleSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => (allVisibleSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCustomerFilter("all");
    setOutcomeFilter("all");
    setFilterTab("all");
  };

  const columns: ColumnDef<SampleRequestItem>[] = [
    {
      id: "request",
      header: "Request",
      width: "w-[130px]",
      cell: (req) => (
        <div className="min-w-0">
          <CopyBadge text={req.materialCode || `FC-${String(req.id).padStart(4, "0")}`} />
          <div className="mt-1 truncate text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            Raised{" "}
            {req.dateRequestCreated
              ? formatOdooDate(req.dateRequestCreated)
              : req.createdAt
              ? formatOdooDate(req.createdAt)
              : "—"}
          </div>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      width: "w-[170px]",
      cell: (req) => (
        <div className="min-w-0">
          <div
            className="truncate font-semibold text-xs text-zinc-900 dark:text-zinc-100"
            title={req.customer || "Customer not set"}
          >
            {req.customer || "—"}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      width: "w-[140px]",
      cell: (req) => {
        const category =
          req.customFeasibilityType ||
          (req.feasibilityType
            ? req.feasibilityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "Feasibility Check");
        return (
          <div className="min-w-0">
            <span
              className="inline-block max-w-[130px] truncate rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600 dark:text-zinc-300"
              title={category}
            >
              {category}
            </span>
          </div>
        );
      },
    },
    {
      id: "description",
      header: "Description / Scope",
      width: "min-w-[220px]",
      cell: (req) => {
        const desc =
          req.productDescription ||
          req.descriptionNotes ||
          req.feasibilityDescription ||
          "—";
        return (
          <div className="min-w-0">
            <span
              className="text-xs text-zinc-600 dark:text-zinc-400 truncate block max-w-sm"
              title={desc}
            >
              {desc}
            </span>
          </div>
        );
      },
    },
    {
      id: "required_date",
      header: "Required Date",
      width: "w-[150px]",
      cell: (req) => {
        const isFinalDecision =
          Boolean(req.marketingDecision) ||
          (req.status || "").toLowerCase().includes("approved") ||
          (req.status || "").toLowerCase().includes("rejected") ||
          (req.status || "").toLowerCase().includes("closed");

        const hasCounterDate = Boolean(req.sampCounterDate);

        // Check if date has passed without completion
        let isPastDue = false;
        if (!isFinalDecision && req.sampleRequiredDate) {
          const reqTime = new Date(req.sampleRequiredDate).setHours(0, 0, 0, 0);
          const todayTime = new Date().setHours(0, 0, 0, 0);
          if (!isNaN(reqTime) && reqTime < todayTime) {
            isPastDue = true;
          }
        }

        // Delay ONLY applies when the committed date has passed without delivery/response
        const isDelayed = isPastDue || req.isRespondedOnTime === false;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
              <Clock
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDelayed ? "text-rose-500 dark:text-rose-400" : "text-zinc-400 dark:text-zinc-500"
                }`}
              />
              <span className={isDelayed ? "font-semibold text-rose-600 dark:text-rose-400" : ""}>
                {req.sampleRequiredDate ? formatOdooDate(req.sampleRequiredDate) : "—"}
              </span>
            </div>

            {req.counterDateDecision === "pending" && req.sampCounterDate ? (
              <div className="flex items-center gap-1">
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                  title={`Sampling proposed revised date awaiting Marketing review: ${req.sampCounterDate}`}
                >
                  <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Proposed: {formatOdooDate(req.sampCounterDate)}</span>
                </span>
              </div>
            ) : isPastDue ? (
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  <span>Overdue</span>
                </span>
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "raised_by",
      header: "Requester",
      width: "w-[130px]",
      cell: (req) => (
        <div className="min-w-0">
          <div
            className="truncate font-medium text-xs text-zinc-900 dark:text-zinc-100"
            title={req.createdBy?.trim() || "Marketing"}
          >
            {req.createdBy?.trim() || "Marketing"}
          </div>
        </div>
      ),
    },
    {
      id: "samp_review",
      header: "Sampling Team Review",
      width: "w-[175px]",
      cell: (req) => {
        const verdict = req.samplingFeasibilityResponse;
        const isAssigned = Boolean(req.takenBySamp);

        if (!isAssigned && !verdict) {
          return (
            <div className="space-y-0.5">
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 block">
                Unassigned
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Awaiting Claim</span>
              </span>
            </div>
          );
        }

        const tone =
          verdict === "Yes"
            ? "success"
            : verdict === "No"
            ? "danger"
            : verdict === "Maybe"
            ? "info"
            : "warning";
        const label =
          verdict === "Yes"
            ? "Feasible"
            : verdict === "No"
            ? "Not Feasible"
            : verdict === "Maybe"
            ? "Conditional"
            : "In Review";

        return (
          <div className="space-y-0.5">
            <div
              className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate"
              title={req.takenBySamp || ""}
            >
              {req.takenBySamp || "Sampling Team"}
            </div>
            <StatusPill status={label} tone={tone} size="xs" />
          </div>
        );
      },
    },
    {
      id: "marketing_status",
      header: "Marketing Decision",
      width: "w-[160px]",
      cell: (req) => {
        const finalStatus = (req.status || "").toLowerCase();
        const isFinalDecision =
          Boolean(req.marketingDecision) ||
          finalStatus.includes("approved") ||
          finalStatus.includes("rejected") ||
          finalStatus.includes("closed");
        const needsDateDecision = !isFinalDecision && req.counterDateDecision === "pending";
        const needsSignoff = !isFinalDecision && Boolean(req.samplingFeasibilityResponse);

        if (req.marketingDecision === "Accepted" || finalStatus.includes("approved"))
          return <StatusPill status="Approved" tone="success" size="sm" />;
        if (
          req.marketingDecision === "Rejected" ||
          finalStatus.includes("rejected") ||
          finalStatus.includes("closed")
        )
          return <StatusPill status="Dropped" tone="danger" size="sm" />;
        if (needsDateDecision)
          return <StatusPill status="Date Decision Needed" tone="warning" size="sm" />;
        if (needsSignoff)
          return <StatusPill status="Sign-Off Needed" tone="warning" size="sm" />;
        return <StatusPill status="In Evaluation" tone="info" size="sm" />;
      },
    },
    {
      id: "actions",
      header: "Action",
      align: "right",
      width: "w-[100px]",
      cell: (req) => {
        const finalStatus = (req.status || "").toLowerCase();
        const isFinalDecision =
          Boolean(req.marketingDecision) ||
          finalStatus.includes("approved") ||
          finalStatus.includes("rejected") ||
          finalStatus.includes("closed");
        const needsDateDecision = !isFinalDecision && req.counterDateDecision === "pending";
        const needsSignoff = !isFinalDecision && Boolean(req.samplingFeasibilityResponse);

        return (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {req.convertedSrNumber ? (
              <StatusPill
                status={`In sampling · ${req.convertedSrNumber}`}
                tone="info"
                size="xs"
              />
            ) : needsDateDecision ? (
              <button
                type="button"
                onClick={() => onInspectRequest(req)}
                className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Review Date</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : needsSignoff ? (
              <button
                type="button"
                onClick={() => onInspectRequest(req)}
                className="select-none rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Sign-Off</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : null}
            {isAdmin && (
              <button
                type="button"
                onClick={(event) => onDeleteRequest(req, event)}
                aria-label={`Delete feasibility request ${req.materialCode || req.id}`}
                title="Delete request"
                className="inline-flex h-7 w-7 select-none items-center justify-center rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const kpiItems = [
    {
      label: "All Feasibility",
      value: metrics.total,
      detail: "Total pipeline",
      color: "bg-[var(--accent-primary)]",
      isActive:
        filterTab === "all" &&
        outcomeFilter === "all" &&
        customerFilter === "all" &&
        !searchTerm,
      onClick: clearFilters,
    },
    {
      label: "Needs Claim",
      value: metrics.awaitingClaim,
      detail: "Waiting for Sampling Team",
      color: "bg-amber-500",
      isActive: filterTab === "awaiting_claim",
      onClick: () => setFilterTab("awaiting_claim"),
    },
    {
      label: "In Sampling Review",
      value: metrics.inReview,
      detail: "Sampling team review",
      color: "bg-sky-500",
      isActive: filterTab === "in_review",
      onClick: () => setFilterTab("in_review"),
    },
    {
      label: "Sign-Off Needed",
      value: metrics.awaitingMarketingAction,
      detail: "Date or verdict sign-off",
      color: "bg-purple-500",
      isActive: filterTab === "awaiting_decision",
      onClick: () => setFilterTab("awaiting_decision"),
    },
    {
      label: "Decision Complete",
      value: metrics.decisionComplete,
      detail: "Approved or dropped",
      color: "bg-teal-500",
      isActive: filterTab === "decision_complete",
      onClick: () => setFilterTab("decision_complete"),
    },
  ];

  const hasActiveFilters = Boolean(
    searchTerm || customerFilter !== "all" || outcomeFilter !== "all" || filterTab !== "all"
  );

  return (
    <DeskWorkspaceLayout
      title="Feasibility Checks"
      businessYear={selectedYear}
      primaryAction={
        !isReadOnly
          ? {
              label: "New Request",
              icon: Plus,
              onClick: onOpenNewModal,
              title: "Submit New Technical Feasibility Request",
            }
          : undefined
      }
      onRefresh={onRefresh}
      isRefreshing={isLoading}
      onExportCSV={onExportCSV}
      exportDisabled={filteredRequests.length === 0}
      kpiItems={kpiItems}
      filterControls={
        <>
          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="min-w-[160px] max-w-[220px]"
              options={[
                { value: "all", label: `All Customers (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}

          <Select
            aria-label="Filter by outcome"
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as MarketingFeasibilityOutcome)}
            className="min-w-[140px]"
            options={[
              { value: "all", label: "All Outcomes" },
              { value: "feasible", label: "Feasible (Sampling Approved)" },
              { value: "conditional", label: "Conditional Feasibility" },
              { value: "approved", label: "Approved by Marketing" },
              { value: "converted", label: "Converted to Sampling" },
              { value: "rejected", label: "Dropped / Rejected" },
            ]}
          />
        </>
      }
      search={{
        value: searchTerm,
        onChange: setSearchTerm,
        placeholder: "Search code, customer, requester...",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={clearFilters}
    >
      <DataTable
        data={filteredRequests}
        columns={columns}
        keyExtractor={(req) => req.id}
        isLoading={isLoading}
        emptyMessage={
          feasibilityRequests.length === 0
            ? "No feasibility requests recorded yet for this year."
            : "No requests match the specified feasibility filters."
        }
        onRowClick={onInspectRequest}
        enableSelection={isAdmin}
        selectedIds={selectedIds}
        onToggleSelectRow={handleToggleSelectRow}
        onToggleSelectAll={handleToggleSelectAll}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 dark:text-white">
                {feasibilityRequests.length}
              </span>{" "}
              feasibility checks
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-emerald-700 dark:text-emerald-300 font-bold">
                {selectedIds.size} selected
              </span>
            )}
          </div>
        }
        toolbarRight={
          selectedIds.size > 0 && isAdmin ? (
            <button
              type="button"
              onClick={() => void onBatchDelete(selectedIds)}
              className="inline-flex h-7 select-none items-center gap-1 rounded-md bg-rose-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 cursor-pointer shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </button>
          ) : (
            <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
              Sampling Feasibility Queue
            </span>
          )
        }
      />
    </DeskWorkspaceLayout>
  );
};

export default FeasibilityRequestsPage;
