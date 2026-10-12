import React, { useState, useMemo, useEffect } from "react";
import { UserProfile } from "@/features/auth";
import { SampleRequestItem } from "@/features/sample-requests/types";
import {
  claimFeasibilityTaskApi,
  recordFeasibilityViewedApi,
} from "@/infrastructure/api";
import { FeasibilityInspectorModal } from "@/features/sample-requests/components/FeasibilityInspectorModal";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import {
  Search,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface SampFeasibilityReviewPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant: string;
  uniquePlants: string[];
  uniqueCustomers: string[];
  user?: UserProfile | null;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
  showToast: (msg: string) => void;
}

export type FeasibilityFilterTab =
  | "all"
  | "awaiting_claim"
  | "in_review"
  | "my_claimed"
  | "awaiting_marketing"
  | "completed";

const indiaDateKey = (value?: string | Date | null): string | null => {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const dayNumber = (dateKey: string): number => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const dayKey = (ordinal: number): string => new Date(ordinal * 86_400_000).toISOString().slice(0, 10);

const isOperationalWorkday = (ordinal: number): boolean => {
  const date = new Date(ordinal * 86_400_000);
  const weekday = date.getUTCDay();
  if (weekday >= 1 && weekday <= 5) return true;
  if (weekday !== 6) return false;
  return Math.ceil(date.getUTCDate() / 7) % 2 === 1;
};

const addOperationalWorkdays = (date: string, workdays: number): string => {
  let ordinal = dayNumber(date);
  while (workdays > 0) {
    ordinal += 1;
    if (isOperationalWorkday(ordinal)) workdays -= 1;
  }
  return dayKey(ordinal);
};

const operationalWorkdaysBetween = (start: string, end: string): number => {
  let count = 0;
  for (let ordinal = dayNumber(start) + 1; ordinal <= dayNumber(end); ordinal += 1) {
    if (isOperationalWorkday(ordinal)) count += 1;
  }
  return count;
};

const getSlaDisplay = (request: SampleRequestItem, today: string) => {
  if (request.counterDateDecision === "pending") return { label: "Paused · Marketing", tone: "paused" as const };
  const requiredDate = indiaDateKey(request.sampleRequiredDate);
  if (!requiredDate) return { label: "No target date", tone: "neutral" as const };
  const deadline = addOperationalWorkdays(requiredDate, Math.max(0, request.sampSlaPausedWorkdays || 0));
  const closedDate = indiaDateKey(request.feasibilityClosedAt);

  if (closedDate) {
    const onTime = request.isRespondedOnTime ?? closedDate <= deadline;
    if (onTime) return { label: "On time", tone: "good" as const };
    const lateBy = operationalWorkdaysBetween(deadline, closedDate);
    return { label: lateBy ? `Delayed · ${lateBy} wd` : "Delayed", tone: "late" as const };
  }

  if (today > deadline) {
    const lateBy = operationalWorkdaysBetween(deadline, today);
    return { label: lateBy ? `Delayed · ${lateBy} wd` : "Delayed", tone: "late" as const };
  }
  if (today === deadline) return { label: "Due today", tone: "due" as const };
  const remaining = operationalWorkdaysBetween(today, deadline);
  return { label: `On time · ${remaining} wd left`, tone: "good" as const };
};

export const SampFeasibilityReviewPage: React.FC<SampFeasibilityReviewPageProps> = ({
  requests,
  isLoading,
  uniqueCustomers,
  user,
  isAdmin,
  onRefresh,
  showToast,
}) => {
  const [filterTab, setFilterTab] = useState<FeasibilityFilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | number | null>(null);
  const [todayKey, setTodayKey] = useState(() => indiaDateKey(new Date()) || "");

  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(indiaDateKey(new Date()) || ""), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Filter requests to strictly feasibility evaluation checks
  const feasibilityRequests = useMemo(() => {
    return requests.filter((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      const mat = String(r.materialCode || "").toLowerCase();
      const sr = String(r.srNumber || "").toLowerCase();
      const idStr = String(r.id || "");
      return (
        kind === "feasibility" ||
        idStr.startsWith("feasibility-") ||
        mode === "feasibility_check" ||
        mode === "feasibility" ||
        mat.startsWith("fc-") ||
        sr.startsWith("fc-") ||
        sr.startsWith("fs-") ||
        Boolean(r.feasibilityType) ||
        Boolean(r.customFeasibilityType)
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
    let awaitingMarketing = 0;
    let myClaimed = 0;
    let completed = 0;

    const currentUserName = (user?.name || "").toLowerCase();

    feasibilityRequests.forEach((r) => {
      const hasVerdict = Boolean(r.samplingFeasibilityResponse);
      const isClaimed = Boolean(r.takenBySamp);
      const claimedBy = (r.takenBySamp || "").toLowerCase();

      if (r.counterDateDecision === "pending") awaitingMarketing++;

      if (!isClaimed && !hasVerdict) {
        awaitingClaim++;
      } else if (isClaimed && !hasVerdict) {
        inReview++;
        if (currentUserName && claimedBy === currentUserName) {
          myClaimed++;
        }
      }

      if (hasVerdict) completed++;
    });

    const evaluatedWithSla = feasibilityRequests.filter(
      (r) =>
        Boolean(r.samplingFeasibilityResponse) &&
        r.isRespondedOnTime !== null &&
        r.isRespondedOnTime !== undefined
    );
    const onTimeCount = evaluatedWithSla.filter((r) => r.isRespondedOnTime === true).length;
    const slaPercent =
      evaluatedWithSla.length > 0
        ? Math.round((onTimeCount / evaluatedWithSla.length) * 100)
        : null;

    return {
      total,
      awaitingClaim,
      inReview,
      awaitingMarketing,
      myClaimed,
      completed,
      slaPercent,
    };
  }, [feasibilityRequests, user?.name]);

  // Filtered dataset
  const filteredRequests = useMemo(() => {
    const currentUserName = (user?.name || "").toLowerCase();

    return feasibilityRequests.filter((r) => {
      // Tab filter
      if (filterTab === "awaiting_marketing" && r.counterDateDecision !== "pending") return false;
      if (filterTab === "awaiting_claim" && (r.takenBySamp || r.samplingFeasibilityResponse)) {
        return false;
      }
      if (filterTab === "in_review" && (!r.takenBySamp || r.samplingFeasibilityResponse)) {
        return false;
      }
      if (filterTab === "my_claimed") {
        if (!r.takenBySamp || r.samplingFeasibilityResponse) return false;
        if (!currentUserName || (r.takenBySamp || "").toLowerCase() !== currentUserName) {
          return false;
        }
      }
      if (filterTab === "completed" && !r.samplingFeasibilityResponse) return false;

      // Customer filter
      if (customerFilter !== "all" && r.customer !== customerFilter) return false;

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const code = (r.materialCode || "").toLowerCase();
        const sr = (r.srNumber || "").toLowerCase();
        const cust = (r.customer || "").toLowerCase();
        const desc = (r.productDescription || r.feasibilityDescription || "").toLowerCase();
        const samp = (r.takenBySamp || "").toLowerCase();
        const fType = (r.customFeasibilityType || r.feasibilityType || "").toLowerCase();
        return (
          code.includes(q) ||
          sr.includes(q) ||
          cust.includes(q) ||
          desc.includes(q) ||
          samp.includes(q) ||
          fType.includes(q)
        );
      }

      return true;
    });
  }, [feasibilityRequests, filterTab, customerFilter, searchTerm, user?.name]);

  // Open inspector modal
  const handleOpenInspect = (req: SampleRequestItem) => {
    recordFeasibilityViewedApi(req.id).catch(() => {});
    setSelectedRequest(req);
    setIsInspectorOpen(true);
  };

  const clearFilters = () => {
    setFilterTab("all");
    setCustomerFilter("all");
    setSearchTerm("");
  };

  // 1-Click inline claim
  const handleInlineClaim = async (req: SampleRequestItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (claimingId) return;
    setClaimingId(req.id);
    try {
      await claimFeasibilityTaskApi(req.id);
      showToast(`Task ${req.materialCode || req.srNumber} claimed by ${user?.name || "you"}.`);
      await onRefresh();
    } catch (err) {
      console.error("Failed to claim task:", err);
      showToast(err instanceof Error ? err.message : "Failed to claim task");
    } finally {
      setClaimingId(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    exportRecordsToCsv({
      filename: `SAMP_Feasibility_Review_${dateStr}.csv`,
      columns: [
        { header: "Request Code", accessor: (r) => r.materialCode || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        {
          header: "Feasibility Category",
          accessor: (r) => r.customFeasibilityType || r.feasibilityType || "Standard",
        },
        { header: "Target SLA Date", accessor: (r) => r.sampleRequiredDate || "" },
        { header: "Claimed By (SAMP)", accessor: (r) => r.takenBySamp || "Unclaimed" },
        {
          header: "Technical Verdict",
          accessor: (r) => r.samplingFeasibilityResponse || "Pending",
        },
        { header: "Verdict Remark", accessor: (r) => r.samplingFeasibilityRemark || "" },
        { header: "Marketing Decision", accessor: (r) => r.marketingDecision || "Pending" },
        { header: "Created Date", accessor: (r) => r.dateRequestCreated || r.createdAt || "" },
      ],
      data: filteredRequests,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-base)] text-[var(--on-surface)] select-text">
      <header className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-5 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[var(--on-surface)] sm:text-lg">Feasibility checks</h1>
            <p className="mt-0.5 text-[11px] text-[var(--on-surface-subtle)]">Technical review queue for the SAMP team</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">SAMP Team · {metrics.total} tasks</span>
            <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--on-surface-muted)]">On-time SLA · {metrics.slaPercent === null ? "—" : `${metrics.slaPercent}%`}</span>
            <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] disabled:opacity-50" title="Refresh queue">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button type="button" onClick={handleExportCSV} disabled={filteredRequests.length === 0} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-low)] disabled:opacity-50" title="Export CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      <section aria-label="Feasibility task summary" className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-2.5 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {[
            { label: "Requests", value: metrics.total, detail: "All feasibility tasks", color: "bg-[var(--accent-primary)]", filter: "all" as const },
            { label: "Needs claim", value: metrics.awaitingClaim, detail: "Waiting for SAMP", color: "bg-teal-500", filter: "awaiting_claim" as const },
            { label: "In review", value: metrics.inReview, detail: "Claimed by SAMP", color: "bg-sky-500", filter: "in_review" as const },
            { label: "Date decision", value: metrics.awaitingMarketing, detail: "Waiting for Marketing", color: "bg-amber-500", filter: "awaiting_marketing" as const },
            { label: "Completed", value: metrics.completed, detail: "Technical verdict sent", color: "bg-emerald-500", filter: "completed" as const },
          ].map((item) => {
            const active = item.filter === "all"
              ? filterTab === "all" && customerFilter === "all" && !searchTerm
              : filterTab === item.filter;
            return (
              <button key={item.label} type="button" onClick={item.filter === "all" ? clearFilters : () => setFilterTab(item.filter)} aria-pressed={active} className={`min-w-0 rounded-lg border px-3 py-2 text-left shadow-2xs transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--surface-low)] ${active ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20" : "border-[var(--border-subtle)] bg-[var(--surface-lowest)]"}`}>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold leading-none tabular-nums text-[var(--on-surface)]">{item.value}</span>
                  <span className="truncate text-[10px] text-[var(--on-surface-subtle)]">{item.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilterTab(filterTab === "my_claimed" ? "all" : "my_claimed")} aria-pressed={filterTab === "my_claimed"} className={`h-9 rounded-lg border px-3 text-xs font-semibold transition-colors ${filterTab === "my_claimed" ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20 text-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"}`}>
            My tasks <span className="ml-1 font-mono tabular-nums">{metrics.myClaimed}</span>
          </button>
          {customerList.length > 0 && (
            <select aria-label="Filter by customer" value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="h-9 min-w-[170px] max-w-[240px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] px-3 text-xs font-medium text-[var(--on-surface)] outline-none transition focus:border-[var(--border-focus)]">
              <option value="all">All customers</option>
              {customerList.map((customer) => <option key={customer} value={customer}>{customer}</option>)}
            </select>
          )}
          <div className="group relative min-w-[220px] flex-1 sm:max-w-[360px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input type="text" placeholder="Search code, customer, requester..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-lowest)] pl-[34px] pr-8 text-xs text-[var(--on-surface)] outline-none transition-all placeholder:text-[var(--on-surface-subtle)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--accent-primary)]/15" />
            {searchTerm && <button type="button" onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--on-surface-subtle)] transition-colors hover:bg-[var(--surface-low)]" title="Clear search"><X className="h-3 w-3" /></button>}
          </div>
          {(searchTerm || customerFilter !== "all" || filterTab !== "all") && <button type="button" onClick={clearFilters} className="h-9 rounded-lg px-2.5 text-xs font-medium text-[var(--on-surface-muted)] transition-colors hover:bg-[var(--surface-low)] hover:text-[var(--on-surface)]">Clear filters</button>}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-low)] px-5 py-2 text-xs text-[var(--on-surface-muted)] sm:px-6">
        <span>Showing <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{filteredRequests.length}</span> of <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">{feasibilityRequests.length}</span> feasibility tasks</span>
        <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">Newest requests first</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto scrollbar-hidden bg-[var(--surface-base)] flex flex-col">
        <table className="w-full min-w-[980px] text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--surface-low)]">
            <tr className="font-mono text-[11px] uppercase tracking-wider text-[var(--on-surface-subtle)] select-none">
              <th className="py-2.5 pl-6 pr-4 font-semibold whitespace-nowrap">Request / Owner</th>
              <th className="py-2.5 px-4 font-semibold">Customer & category</th>
              <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Target & SLA</th>
              <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Review Status</th>
              <th className="py-2.5 pl-4 pr-6 font-semibold text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <h3 className="text-sm font-semibold text-[var(--on-surface)]">No feasibility tasks</h3>
                    <p className="mt-1 text-xs text-[var(--on-surface-subtle)]">
                      {searchTerm || customerFilter !== "all" || filterTab !== "all" ? "No tasks match these filters." : "There are no tasks in this queue."}
                    </p>
                    {(searchTerm || customerFilter !== "all" || filterTab !== "all") && (
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
              filteredRequests.map((req) => {
                const category =
                  req.customFeasibilityType ||
                  (req.feasibilityType
                    ? req.feasibilityType
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    : "New Category");
                return (
                  <tr
                    key={req.id}
                    onClick={() => handleOpenInspect(req)}
                    className={`group cursor-pointer transition-colors ${req.counterDateDecision === "pending" ? "bg-[var(--accent-primary-subtle)] hover:bg-[var(--surface-low)]" : "hover:bg-[var(--surface-low)]"}`}
                  >
                    {/* Feasibility code and requester */}
                    <td className="py-1.5 pl-6 pr-4 font-mono font-bold whitespace-nowrap">
                      <CopyBadge text={req.materialCode || `FC-${String(req.id).padStart(4, "0")}`} />
                      <div className="mt-0.5 max-w-[250px] truncate font-sans text-[10px] font-medium text-[var(--on-surface-subtle)]" title={`Requested by ${req.createdBy || "Marketing team"}`}>
                        Requested by <span className="font-semibold text-[var(--on-surface-muted)]">{req.createdBy || "Marketing team"}</span>
                      </div>
                    </td>

                    {/* Customer and feasibility category */}
                    <td className="max-w-[300px] px-4 py-1.5">
                      <div className="flex min-w-0 flex-col items-start gap-1">
                        <span className="max-w-[180px] truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-low)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--on-surface-muted)]">
                          {category}
                        </span>
                        <span className="max-w-[260px] truncate text-[11px] font-semibold text-[var(--on-surface)]" title={req.customer || "Customer not specified"}>
                          {req.customer || "Customer not specified"}
                        </span>
                      </div>
                    </td>
{/* Target date and live SLA state */}
                    <td className="whitespace-nowrap px-4 py-1.5 font-mono text-[var(--on-surface-muted)]">
                      <div className="font-semibold text-[var(--on-surface)]">
                        {req.sampleRequiredDate ? formatOdooDate(req.sampleRequiredDate) : "Flexible"}
                      </div>
                      {(() => {
                        const sla = getSlaDisplay(req, todayKey);
                        const toneClass = sla.tone === "late"
                          ? "bg-rose-50 text-rose-700"
                          : sla.tone === "paused"
                          ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"
                          : sla.tone === "due"
                          ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"
                          : sla.tone === "good"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]";
                        return <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-sans font-semibold ${toneClass}`}>{sla.label}</span>;
                      })()}
                    </td>

                    {/* Combined claim, evaluation, and date proposal status */}
                    <td className="py-1.5 px-4 whitespace-nowrap">
                      {req.takenBySamp ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="text-[11px] font-semibold text-[var(--on-surface)]">
                            {req.samplingFeasibilityResponse ? "Reviewed by" : "In review"}: {req.takenBySamp}
                          </span>
                          {req.counterDateDecision === "pending" ? (
                            <span className="inline-flex rounded-full bg-[var(--accent-primary-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-primary)]">
                              Marketing date decision needed
                            </span>
                          ) : req.samplingFeasibilityResponse === "Yes" ? (
                            <span className="text-[10px] font-semibold text-emerald-700">Feasible</span>
                          ) : req.samplingFeasibilityResponse === "Maybe" ? (
                            <span className="text-[10px] font-semibold text-sky-700">Conditional</span>
                          ) : req.samplingFeasibilityResponse === "No" ? (
                            <span className="text-[10px] font-semibold text-rose-700">Not feasible</span>
                          ) : (
                            <span className="text-[10px] text-[var(--on-surface-subtle)]">Technical review pending</span>
                          )}
                          {req.marketingDecision && (
                            <span className={`text-[10px] font-medium ${req.marketingDecision === "Accepted" ? "text-emerald-700" : "text-rose-700"}`}>
                              Marketing {req.marketingDecision.toLowerCase()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleInlineClaim(req, e)}
                          disabled={claimingId === req.id}
                          className="inline-flex px-3 py-1 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-bold transition cursor-pointer active:scale-95"
                          title="Claim this task for technical evaluation"
                        >
                          <span>{claimingId === req.id ? "Claiming..." : "Claim Task"}</span>
                        </button>
                      )}
                    </td>

                    {/* Evaluation Action */}
                    <td className="py-1.5 pl-4 pr-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenInspect(req)}
                          className="cursor-pointer rounded-md border border-[var(--border-subtle)] bg-[var(--surface-low)] px-3 py-1.5 text-xs font-semibold text-[var(--on-surface-muted)] transition hover:bg-[var(--surface-container)]"
                        >
                          {req.counterDateDecision === "pending" ? "View date proposal" : req.samplingFeasibilityResponse ? "View Verdict" : "Evaluate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

      </div>

      {/* ── SAMP Technical Inspector & Verdict Modal ── */}
      {selectedRequest && (
        <FeasibilityInspectorModal
          request={selectedRequest}
          isOpen={isInspectorOpen}
          onRefresh={onRefresh}
          onClose={() => {
            setIsInspectorOpen(false);
            onRefresh();
          }}
          user={user}
          isAdmin={isAdmin}
          sourceDesk="samp"
        />
      )}
    </div>
  );
};

export default SampFeasibilityReviewPage;
