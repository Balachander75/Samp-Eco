import React, { useState, useMemo, useEffect, useCallback } from "react";
import { UserProfile } from "@/features/auth";
import { isAdmin as checkIsAdmin } from "@/features/auth/permissions";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { SampleRequestItem } from "@/features/sample-requests/types";
import {
  claimFeasibilityTaskApi,
  recordFeasibilityViewedApi,
  fetchFeasibilityRequestsApi,
} from "@/infrastructure/api";
import { FeasibilityInspectorModal } from "@/features/sample-requests/components/FeasibilityInspectorModal";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import {
  CopyBadge,
  StatusPill,
  Select,
} from "@/components/ui";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";

export interface SampFeasibilityReviewPageProps {
  requests?: SampleRequestItem[];
  isLoading?: boolean;
  user?: UserProfile | null;
  onRefresh?: () => Promise<void>;
  showToast?: (msg: string) => void;
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
  requests: initialRequests,
  isLoading: initialLoading,
  user,
  onRefresh: parentRefresh,
  showToast,
}) => {
  const { currentBusinessYear } = useBusinessYear();
  const isAdmin = checkIsAdmin(user);

  const [internalRequests, setInternalRequests] = useState<SampleRequestItem[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);

  const [filterTab, setFilterTab] = useState<FeasibilityFilterTab>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | number | null>(null);
  const [todayKey, setTodayKey] = useState(() => indiaDateKey(new Date()) || "");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notify = useCallback(
    (msg: string) => {
      if (showToast) {
        showToast(msg);
      } else {
        setToastMessage(msg);
        window.setTimeout(() => setToastMessage(null), 3500);
      }
    },
    [showToast]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTodayKey(indiaDateKey(new Date()) || ""), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadRequests = useCallback(async () => {
    setInternalLoading(true);
    try {
      const data = await fetchFeasibilityRequestsApi({
        year: currentBusinessYear || undefined,
      });
      setInternalRequests(data);
    } catch (err) {
      console.error("Failed to load feasibility tasks for SAMP Review:", err);
    } finally {
      setInternalLoading(false);
    }
  }, [currentBusinessYear]);

  useEffect(() => {
    if (!initialRequests) {
      void loadRequests();
    }
  }, [initialRequests, loadRequests]);

  useEffect(() => {
    const handleChanged = () => {
      if (parentRefresh) {
        void parentRefresh();
      } else {
        void loadRequests();
      }
    };
    window.addEventListener("samp:requests-changed", handleChanged);
    return () => window.removeEventListener("samp:requests-changed", handleChanged);
  }, [parentRefresh, loadRequests]);

  const requests = initialRequests ?? internalRequests;
  const isLoading = initialLoading ?? internalLoading;

  const handleRefresh = useCallback(async () => {
    if (parentRefresh) {
      await parentRefresh();
    } else {
      await loadRequests();
    }
  }, [parentRefresh, loadRequests]);

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
      notify(`Task ${req.materialCode || req.srNumber} claimed by ${user?.name || "you"}.`);
      await handleRefresh();
    } catch (err) {
      console.error("Failed to claim task:", err);
      notify(err instanceof Error ? err.message : "Failed to claim task");
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
        {
          header: "Description / Scope",
          accessor: (r) => r.productDescription || r.descriptionNotes || r.feasibilityDescription || "",
        },
        { header: "Target SLA Date", accessor: (r) => r.sampleRequiredDate || "" },
        { header: "Requester", accessor: (r) => r.createdBy || "Marketing" },
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

  // 10 Distinct Enterprise ERP Columns
  const columns: ColumnDef<SampleRequestItem>[] = useMemo(
    () => [
      {
        id: "request",
        header: "Request",
        width: "w-[125px]",
        cell: (req) => (
          <div className="min-w-0">
            <CopyBadge text={req.materialCode || `FC-${String(req.id).padStart(4, "0")}`} />
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
              className="truncate font-semibold text-xs text-[var(--on-surface)]"
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
              : "New Category");
          return (
            <div className="min-w-0">
              <span
                className="inline-block max-w-[130px] truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--on-surface-muted)]"
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
        width: "min-w-[210px]",
        cell: (req) => {
          const desc =
            req.productDescription ||
            req.descriptionNotes ||
            req.feasibilityDescription ||
            "—";
          return (
            <div className="min-w-0">
              <span
                className="text-xs text-[var(--on-surface-muted)] truncate block max-w-sm"
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
        width: "w-[130px]",
        cell: (req) => (
          <div className="whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-[var(--on-surface)]">
            {req.sampleRequiredDate ? formatOdooDate(req.sampleRequiredDate) : "Flexible"}
          </div>
        ),
      },
      {
        id: "sla",
        header: "SLA / Timeline",
        width: "w-[150px]",
        cell: (req) => {
          const sla = getSlaDisplay(req, todayKey);
          const tone =
            sla.tone === "late"
              ? "danger"
              : sla.tone === "good"
              ? "success"
              : sla.tone === "due"
              ? "warning"
              : sla.tone === "paused"
              ? "info"
              : "neutral";
          return <StatusPill status={sla.label} tone={tone} size="xs" />;
        },
      },
      {
        id: "requester",
        header: "Requester",
        width: "w-[130px]",
        cell: (req) => (
          <div className="min-w-0">
            <span
              className="truncate font-medium text-xs text-[var(--on-surface)] block"
              title={req.createdBy?.trim() || "Marketing"}
            >
              {req.createdBy?.trim() || "Marketing"}
            </span>
          </div>
        ),
      },
      {
        id: "reviewer",
        header: "Assigned Reviewer",
        width: "w-[150px]",
        cell: (req) => {
          if (req.takenBySamp) {
            return (
              <div
                className="font-mono text-xs font-semibold text-[var(--on-surface)] truncate flex items-center gap-1.5"
                title={req.takenBySamp}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
                <span className="truncate">{req.takenBySamp}</span>
              </div>
            );
          }
          return (
            <button
              type="button"
              onClick={(e) => handleInlineClaim(req, e)}
              disabled={claimingId === req.id}
              className="inline-flex px-2.5 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs"
              title="Claim this task for technical evaluation"
            >
              <span>{claimingId === req.id ? "Claiming..." : "Claim Task"}</span>
            </button>
          );
        },
      },
      {
        id: "verdict",
        header: "Review Status",
        width: "w-[150px]",
        cell: (req) => {
          const verdict = req.samplingFeasibilityResponse;
          if (verdict === "Yes") return <StatusPill status="Feasible" tone="success" size="xs" />;
          if (verdict === "No") return <StatusPill status="Not Feasible" tone="danger" size="xs" />;
          if (verdict === "Maybe") return <StatusPill status="Conditional" tone="info" size="xs" />;
          if (req.counterDateDecision === "pending")
            return <StatusPill status="Date Review" tone="warning" size="xs" />;
          if (req.takenBySamp)
            return <StatusPill status="In Review" tone="warning" size="xs" />;
          return <StatusPill status="Awaiting Claim" tone="neutral" size="xs" />;
        },
      },
      {
        id: "actions",
        header: "Action",
        width: "w-[110px]",
        align: "right",
        cell: (req) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleOpenInspect(req)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition shadow-2xs active:scale-95 ${
                req.samplingFeasibilityResponse
                  ? "border border-[var(--border-subtle)] bg-[var(--surface-low)] hover:bg-[var(--surface-high)] text-[var(--on-surface)]"
                  : req.counterDateDecision === "pending"
                  ? "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100"
                  : "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white"
              }`}
            >
              {req.counterDateDecision === "pending"
                ? "View Date"
                : req.samplingFeasibilityResponse
                ? "Sign-Off"
                : "Evaluate"}
            </button>
          </div>
        ),
      },
    ],
    [todayKey, claimingId, notify]
  );

  const kpiItems = [
    {
      label: "Requests",
      value: metrics.total,
      detail: "All feasibility tasks",
      color: "bg-[var(--accent-primary)]",
      isActive: filterTab === "all" && customerFilter === "all" && !searchTerm,
      onClick: clearFilters,
    },
    {
      label: "Needs claim",
      value: metrics.awaitingClaim,
      detail: "Waiting for SAMP",
      color: "bg-teal-500",
      isActive: filterTab === "awaiting_claim",
      onClick: () => setFilterTab("awaiting_claim"),
    },
    {
      label: "In review",
      value: metrics.inReview,
      detail: "Claimed by SAMP",
      color: "bg-sky-500",
      isActive: filterTab === "in_review",
      onClick: () => setFilterTab("in_review"),
    },
    {
      label: "Date decision",
      value: metrics.awaitingMarketing,
      detail: "Waiting for Marketing",
      color: "bg-amber-500",
      isActive: filterTab === "awaiting_marketing",
      onClick: () => setFilterTab("awaiting_marketing"),
    },
    {
      label: "Completed",
      value: metrics.completed,
      detail: "Technical verdict sent",
      color: "bg-emerald-500",
      isActive: filterTab === "completed",
      onClick: () => setFilterTab("completed"),
    },
  ];

  const hasActiveFilters = Boolean(
    searchTerm || customerFilter !== "all" || filterTab !== "all"
  );

  return (
    <>
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs font-semibold shadow-xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}

      <DeskWorkspaceLayout
        title="Feasibility Checks"
        businessYear={currentBusinessYear}
        totalCount={metrics.total}
        totalLabel="tasks"
        extraBadges={
          metrics.slaPercent !== null ? (
            <span className="px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)] text-[10px] font-mono font-bold">
              On-time SLA · {metrics.slaPercent}%
            </span>
          ) : null
        }
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        onExportCSV={handleExportCSV}
        exportDisabled={filteredRequests.length === 0}
        kpiItems={kpiItems}
        extraFilterControls={
          <button
            type="button"
            onClick={() => setFilterTab(filterTab === "my_claimed" ? "all" : "my_claimed")}
            aria-pressed={filterTab === "my_claimed"}
            className={`h-8 rounded-lg border px-3 text-xs font-semibold transition-colors cursor-pointer ${
              filterTab === "my_claimed"
                ? "border-[var(--accent-primary)] bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)]/20 text-[var(--accent-primary)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-lowest)] text-[var(--on-surface-muted)] hover:bg-[var(--surface-low)]"
            }`}
          >
            My tasks <span className="ml-1 font-mono tabular-nums">{metrics.myClaimed}</span>
          </button>
        }
        filterControls={
          customerList.length > 0 ? (
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
          ) : null
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
              ? "No feasibility tasks found in the review queue."
              : "No tasks match the selected filters."
          }
          onRowClick={handleOpenInspect}
          toolbarLeft={
            <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--on-surface-muted)]">
              <span>
                Showing{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                  {filteredRequests.length}
                </span>{" "}
                of{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                  {feasibilityRequests.length}
                </span>{" "}
                feasibility tasks
              </span>
            </div>
          }
        />

        {/* ── SAMP Technical Inspector & Verdict Modal ── */}
        {selectedRequest && (
          <FeasibilityInspectorModal
            request={selectedRequest}
            isOpen={isInspectorOpen}
            onRefresh={handleRefresh}
            onClose={() => {
              setIsInspectorOpen(false);
              void handleRefresh();
            }}
            user={user}
            isAdmin={isAdmin}
            sourceDesk="samp"
          />
        )}
      </DeskWorkspaceLayout>
    </>
  );
};

export default SampFeasibilityReviewPage;
