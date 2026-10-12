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
import { DataTable, type ColumnDef } from "@/components/erp/DataTable";
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
        const desc = (r.productDescription || r.feasibilityDescription || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const samp = (r.takenBySamp || "").toLowerCase();
        const requester = (r.createdBy || "").toLowerCase();
        return (
          mat.includes(q) ||
          desc.includes(q) ||
          cust.includes(q) ||
          samp.includes(q) ||
          requester.includes(q)
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
      width: "w-[150px]",
      cell: (req) => (
        <div className="min-w-0">
          <CopyBadge text={req.materialCode || `FC-${String(req.id).padStart(4, "0")}`} />
          <div className="mt-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
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
      id: "customer_scope",
      header: "Customer & Category",
      width: "min-w-[200px] max-w-[260px]",
      cell: (req) => {
        const category =
          req.customFeasibilityType ||
          (req.feasibilityType
            ? req.feasibilityType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "NPD Feasibility");
        return (
          <div className="min-w-0 max-w-[260px]">
            <div
              className="truncate font-semibold text-[var(--on-surface)]"
              title={req.customer || "Customer not set"}
            >
              {req.customer || "—"}
            </div>
            <div className="mt-1 min-w-0">
              <span
                className="max-w-[145px] shrink-0 truncate rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--on-surface-muted)]"
                title={category}
              >
                {category}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "required_date",
      header: "Required Date",
      width: "w-[125px]",
      cell: (req) => (
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-[var(--on-surface)]">
          {req.sampleRequiredDate ? formatOdooDate(req.sampleRequiredDate) : "—"}
        </span>
      ),
    },
    {
      id: "raised_by",
      header: "Requester",
      width: "w-[155px]",
      cell: (req) => (
        <div className="min-w-0 max-w-[155px]">
          <div
            className="truncate font-semibold text-[var(--on-surface)]"
            title={req.createdBy?.trim() || "Marketing"}
          >
            {req.createdBy?.trim() || "Marketing"}
          </div>
          <span className="mt-1 inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--on-surface-muted)]">
            Marketing Desk
          </span>
        </div>
      ),
    },
    {
      id: "samp_review",
      header: "SAMP Technical Review",
      width: "w-[185px]",
      cell: (req) => {
        const verdict = req.samplingFeasibilityResponse;
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
            : "Awaiting Claim";
        return (
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center text-[11px] text-[var(--on-surface-muted)] font-mono">
              <span className="truncate" title={req.takenBySamp || "Not yet claimed by SAMP"}>
                {req.takenBySamp || "Unassigned"}
              </span>
            </div>
            <StatusPill status={label} tone={tone} size="xs" />
          </div>
        );
      },
    },
    {
      id: "marketing_status",
      header: "Marketing Decision",
      width: "w-[180px]",
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
      width: "w-[170px]",
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
                className="select-none rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Review Date</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : needsSignoff ? (
              <button
                type="button"
                onClick={() => onInspectRequest(req)}
                className="select-none rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>Sign-Off</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onInspectRequest(req)}
                className="inline-flex select-none items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
              >
                <span>Inspect</span>
                <ChevronRight className="h-3 w-3 text-[var(--on-surface-subtle)]" />
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={(event) => onDeleteRequest(req, event)}
                aria-label={`Delete feasibility request ${req.materialCode || req.id}`}
                title="Delete request"
                className="inline-flex h-7 w-7 select-none items-center justify-center rounded-lg text-[var(--on-surface-subtle)] transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-app)] text-[var(--on-surface)] select-text font-sans">
      {/* ── 1. Compact Enterprise Header ── */}
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--on-surface)] font-display">
                  NPD Feasibility Checks
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                  BY {selectedYear}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[var(--on-surface-muted)]">
                Technical NPD reviews and marketing commercial sign-off before physical tooling.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Register New Request Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={onOpenNewModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-colors bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] shadow-2xs cursor-pointer"
                title="Submit New Technical Feasibility Request"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Request</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={onExportCSV}
              disabled={filteredRequests.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-container)] px-3 text-xs font-semibold text-[var(--on-surface)] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              title="Export To CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Interactive KPI Workflow Strip (Direct Queue Filters) ── */}
      <section
        aria-label="Feasibility workflow summary"
        className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2.5 sm:px-8"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            {
              label: "All Feasibility",
              value: metrics.total,
              detail: "Total NPD pipeline",
              color: "bg-[var(--accent-primary)]",
              filter: "all" as const,
            },
            {
              label: "Needs Claim",
              value: metrics.awaitingClaim,
              detail: "Waiting for SAMP Lab",
              color: "bg-teal-500",
              filter: "awaiting_claim" as const,
            },
            {
              label: "In Lab Review",
              value: metrics.inReview,
              detail: "Under technical trial",
              color: "bg-sky-500",
              filter: "in_review" as const,
            },
            {
              label: "Sign-Off Needed",
              value: metrics.awaitingMarketingAction,
              detail: "Date or verdict sign-off",
              color: "bg-amber-500",
              filter: "awaiting_decision" as const,
            },
            {
              label: "Decision Complete",
              value: metrics.decisionComplete,
              detail: "Approved or dropped",
              color: "bg-emerald-500",
              filter: "decision_complete" as const,
            },
          ].map((item) => {
            const isSelected =
              item.filter === "all"
                ? filterTab === "all" &&
                  outcomeFilter === "all" &&
                  customerFilter === "all" &&
                  !searchTerm
                : filterTab === item.filter;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (item.filter === "all") {
                    clearFilters();
                  } else {
                    setFilterTab(item.filter);
                  }
                }}
                className={`min-w-0 rounded-xl border p-2.5 text-left shadow-2xs transition-all cursor-pointer ${
                  isSelected
                    ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20"
                    : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-low)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-muted)]">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
                  )}
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-lg font-display font-bold tabular-nums text-[var(--on-surface)]">
                    {item.value}
                  </span>
                  <span className="truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                    {item.detail}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Compact Filter Controls (Search, Customer, Outcome) ── */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-2 sm:px-8">
        <div className="flex flex-wrap items-center gap-2.5">
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
              { value: "feasible", label: "Feasible (Lab Approved)" },
              { value: "conditional", label: "Conditional Feasibility" },
              { value: "approved", label: "Approved by Marketing" },
              { value: "converted", label: "Converted to Sampling" },
              { value: "rejected", label: "Dropped / Rejected" },
            ]}
          />

          {/* Search Input */}
          <div className="group relative min-w-[200px] flex-1 sm:max-w-[340px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              type="text"
              placeholder="Search code, customer, requester..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] pl-8 pr-7 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-container)] cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {(searchTerm ||
            customerFilter !== "all" ||
            outcomeFilter !== "all" ||
            filterTab !== "all") && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 select-none rounded-lg px-2 text-xs font-semibold text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)] cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── 4. High-Performance Full-Bleed Table Workspace ── */}
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
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--on-surface-muted)]">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                {filteredRequests.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                {feasibilityRequests.length}
              </span>{" "}
              feasibility checks
            </span>
            {selectedIds.size > 0 && (
              <span className="shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[var(--accent-primary)] font-bold">
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
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
              SAMP Lab Feasibility Queue
            </span>
          )
        }
      />
    </div>
  );
};

export default FeasibilityRequestsPage;
