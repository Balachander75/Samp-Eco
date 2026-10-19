import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { UserProfile } from "@/features/auth";
import { isAdmin as checkIsAdmin, hasWorkflowTeam } from "@/features/auth/permissions";
import { usePlant } from "@/context/PlantContext";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { SampleRequestItem, FeasibilityRequestPayload } from "../types";
import { formatOdooDate } from "../utils/dateUtils";
import {
  Plus,
  Clock,
  AlertTriangle,
  Search,
  X,
  Layers,
  CheckCircle2,
  Check,
  ArrowRight,
} from "lucide-react";
import { CopyBadge, StatusPill, Select } from "@/components/ui";
import { DataTable, type ColumnDef, DeskWorkspaceLayout } from "@/components/erp";
import { exportRecordsToCsv } from "@/lib/csvExport";
import { indiaDateKey, addOperationalWorkdays } from "@/lib/operationalWorkdays";
import { TopLoadingBar } from "@/components/ui/loading";
const FeasibilityInspectorModal = React.lazy(() =>
  import("../components/FeasibilityInspectorModal").then((m) => ({ default: m.FeasibilityInspectorModal }))
);
const NewFeasibilityModal = React.lazy(() =>
  import("../components/NewFeasibilityModal").then((m) => ({ default: m.NewFeasibilityModal }))
);
import {
  fetchFeasibilityRequestsApi,
  createFeasibilityRequestApi,
} from "@/infrastructure/api";
import { useMasterData } from "../hooks/useMasterData";
import { getFeasibilityTypeDisplay } from "../utils/feasibilityParsers";

export type MarketingFeasibilityTab =
  | "all"
  | "awaiting_claim"
  | "in_review"
  | "awaiting_counter_date"
  | "awaiting_decision"
  | "decision_complete";

export type MarketingFeasibilityOutcome =
  | "all"
  | "feasible"
  | "conditional"
  | "approved"
  | "converted"
  | "rejected";

export interface FeasibilityRequestsPageProps {
  user?: UserProfile | null;
  sourceDesk?: "marketing" | "samp";
  isReadOnly?: boolean;
}

export const FeasibilityRequestsPage: React.FC<FeasibilityRequestsPageProps> = ({
  user,
  sourceDesk = "marketing",
  isReadOnly = false,
}) => {
  const { selectedPlant } = usePlant();
  const { currentBusinessYear } = useBusinessYear();
  const isAdmin = checkIsAdmin(user);
  // RBAC: Only marketing desk members or admins on Marketing desk can raise new feasibility requests
  const canRaiseRequest = sourceDesk === "marketing" && (isAdmin || hasWorkflowTeam(user, "marketing"));

  const { customers: masterCustomers } = useMasterData();

  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterTab, setFilterTab] = useState<MarketingFeasibilityTab>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<MarketingFeasibilityOutcome>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  // Multi-row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectRow = (id: string | number) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filteredRequests.length > 0 && filteredRequests.every((r) => selectedIds.has(String(r.id)))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => String(r.id))));
    }
  };

  // Clear selection on filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterTab, outcomeFilter, customerFilter, searchTerm]);

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SampleRequestItem | null>(null);

  // Load requests from backend
  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchFeasibilityRequestsApi({
        year: currentBusinessYear || undefined,
      });
      setRequests(data);
    } catch (err) {
      console.error("Failed to load feasibility requests:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentBusinessYear]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Listen to cross-component data changes
  useEffect(() => {
    const handleChanged = () => {
      void loadRequests();
    };
    window.addEventListener("samp:requests-changed", handleChanged);
    return () => window.removeEventListener("samp:requests-changed", handleChanged);
  }, [loadRequests]);

  // Unique customers list
  const customerList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.customer && r.customer.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  // Operational metrics
  const metrics = useMemo(() => {
    const total = requests.length;
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

    requests.forEach((r) => {
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
      if (Boolean(r.convertedRequestCode || r.convertedSrNumber || r.convertedSampleRequestId)) {
        converted++;
      }
    });

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
    };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Plant filter (if plant context is set and not "All")
      if (selectedPlant && selectedPlant !== "All Plants" && r.targetPlant) {
        if (r.targetPlant !== selectedPlant && !r.targetPlant.includes(selectedPlant)) {
          // Keep showing if user plant is flexible
        }
      }

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
        if (!r.convertedRequestCode && !r.convertedSrNumber && !r.convertedSampleRequestId) return false;
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
        const convertedCode = (r.convertedRequestCode || r.convertedSrNumber || "").toLowerCase();
        return (
          convertedCode.includes(q) ||
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
  }, [requests, selectedPlant, filterTab, outcomeFilter, customerFilter, searchTerm]);

  const clearFilters = () => {
    setSearchTerm("");
    setCustomerFilter("all");
    setOutcomeFilter("all");
    setFilterTab("all");
  };

  // Create feasibility request handler
  const handleCreateRequest = async (payload: FeasibilityRequestPayload) => {
    try {
      const created = await createFeasibilityRequestApi(payload);
      if (created) {
        await loadRequests();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("Failed to create feasibility request:", err);
      throw err;
    }
  };

  // Export CSV handler
  const handleExportCSV = () => {
    if (filteredRequests.length === 0) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    exportRecordsToCsv({
      filename: `feasibility_checks_${dateStr}.csv`,
      columns: [
        { header: "Request Code", accessor: (r) => r.materialCode || `FC-${r.id}` },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Category", accessor: (r) => r.customFeasibilityType || r.feasibilityType || "" },
        { header: "Scope / Description", accessor: (r) => r.productDescription || "" },
        { header: "Target Date", accessor: (r) => r.sampleRequiredDate || "" },
        { header: "Requester", accessor: (r) => r.createdBy || "" },
        { header: "SAMP Reviewer", accessor: (r) => r.takenBySamp || "" },
        { header: "SAMP Verdict", accessor: (r) => r.samplingFeasibilityResponse || "Pending" },
        { header: "Marketing Decision", accessor: (r) => r.marketingDecision || "" },
        { header: "Status", accessor: (r) => r.status || "" },
        { header: "Created Date", accessor: (r) => r.dateRequestCreated || r.createdAt || "" },
      ],
      data: filteredRequests,
    });
  };

  // Inspect request handler
  const handleInspectRequest = (req: SampleRequestItem) => {
    setSelectedRequest(req);
    setIsInspectorOpen(true);
  };

  // Columns definition
  // Columns definition (Concise, Beautifully Clubbed, Zero Horizontal Scroll)
  const columns: ColumnDef<SampleRequestItem>[] = useMemo(
    () => [
      {
        id: "request",
        header: "Request",
        width: "w-[125px]",
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
        id: "customer",
        header: "Customer",
        width: "w-[140px]",
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
        id: "feasibility_type",
        header: "Feasibility Type",
        width: "w-[130px]",
        cell: (req) => {
          const typeLabel = getFeasibilityTypeDisplay(req);
          return (
            <div className="min-w-0">
              <span
                className="inline-block max-w-[120px] truncate rounded border border-[var(--border-subtle)] bg-[var(--surface-low)] px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[var(--on-surface)]"
                title={typeLabel}
              >
                {typeLabel}
              </span>
            </div>
          );
        },
      },
      {
        id: "description",
        header: "Scope / Description",
        width: "min-w-0 flex-1",
        cell: (req) => {
          const desc =
            req.productDescription ||
            req.descriptionNotes ||
            req.feasibilityDescription ||
            "—";

          return (
            <div className="min-w-0">
              <span
                className="text-xs text-[var(--on-surface-muted)] truncate block leading-normal font-normal"
                title={desc}
              >
                {desc}
              </span>
            </div>
          );
        },
      },
      {
        id: "target_date",
        header: "Target Date",
        width: "w-[115px]",
        cell: (req) => {
          const isFinalDecision =
            Boolean(req.marketingDecision) ||
            (req.status || "").toLowerCase().includes("approved") ||
            (req.status || "").toLowerCase().includes("rejected") ||
            (req.status || "").toLowerCase().includes("closed");

          let isPastDue = false;
          if (!isFinalDecision && req.counterDateDecision !== "pending" && req.sampleRequiredDate) {
            const reqKey = indiaDateKey(req.sampleRequiredDate);
            const todayKey = indiaDateKey(new Date());
            if (reqKey && todayKey) {
              const deadline = addOperationalWorkdays(reqKey, Math.max(0, req.sampSlaPausedWorkdays || 0));
              if (todayKey > deadline) {
                isPastDue = true;
              }
            }
          }

          const isDelayed = req.counterDateDecision !== "pending" && (isPastDue || req.isRespondedOnTime === false);

          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs tabular-nums text-[var(--on-surface)]">
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isDelayed ? "text-rose-500" : "text-[var(--on-surface-subtle)]"
                  }`}
                />
                <span className={isDelayed ? "font-semibold text-rose-600 dark:text-rose-400" : ""}>
                  {req.sampleRequiredDate ? formatOdooDate(req.sampleRequiredDate) : "—"}
                </span>
              </div>

              {req.counterDateDecision === "pending" && req.sampCounterDate ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                  title={`Sampling proposed revised date: ${req.sampCounterDate}`}
                >
                  <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Prop: {formatOdooDate(req.sampCounterDate)}</span>
                </span>
              ) : isPastDue ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  <span>Overdue</span>
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "samp_verdict",
        header: "SAMP Verdict",
        width: "w-[150px]",
        cell: (req) => {
          const verdict = req.samplingFeasibilityResponse;
          const isAssigned = Boolean(req.takenBySamp);

          if (!isAssigned && !verdict) {
            return (
              <div className="space-y-0.5">
                <StatusPill status="Awaiting Claim" tone="warning" size="xs" />
                <span className="font-mono text-[10px] text-[var(--on-surface-subtle)] block">
                  Unassigned
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
              <StatusPill status={label} tone={tone} size="xs" />
              <div
                className="font-mono text-[10.5px] text-[var(--on-surface-muted)] truncate"
                title={req.takenBySamp || "Sampling Team"}
              >
                {req.takenBySamp || "Sampling Team"}
              </div>
            </div>
          );
        },
      },
      {
        id: "marketing_decision",
        header: "Marketing Decision",
        width: "w-[145px]",
        cell: (req) => {
          const finalStatus = (req.status || "").toLowerCase();
          const isFinalDecision =
            Boolean(req.marketingDecision) ||
            finalStatus.includes("approved") ||
            finalStatus.includes("rejected") ||
            finalStatus.includes("closed");
          const needsDateDecision = !isFinalDecision && req.counterDateDecision === "pending";
          const needsSignoff = !isFinalDecision && Boolean(req.samplingFeasibilityResponse);

          const convertedCode = req.convertedRequestCode || req.convertedSrNumber;
          if (convertedCode) {
            return (
              <div className="space-y-0.5">
                <StatusPill status="Converted" tone="success" size="xs" />
                <span
                  className="block font-mono text-[10px] font-bold text-[var(--accent-primary)] truncate"
                  title={`Converted to ${convertedCode}`}
                >
                  Code: {convertedCode}
                </span>
              </div>
            );
          }
          if (req.marketingDecision === "Accepted" || finalStatus.includes("approved"))
            return <StatusPill status="Approved" tone="success" size="xs" />;
          if (
            req.marketingDecision === "Rejected" ||
            finalStatus.includes("rejected") ||
            finalStatus.includes("closed")
          )
            return <StatusPill status="Dropped" tone="danger" size="xs" />;
          if (needsDateDecision)
            return <StatusPill status="Review Date" tone="warning" size="xs" />;
          if (needsSignoff)
            return <StatusPill status="Sign-Off Needed" tone="warning" size="xs" />;
          return <StatusPill status="In Evaluation" tone="info" size="xs" />;
        },
      },
      ...(isAdmin
        ? [
            {
              id: "raised_by",
              header: "Raised By",
              width: "w-[120px]",
              cell: (req: SampleRequestItem) => (
                <div className="min-w-0">
                  <div
                    className="truncate font-medium text-xs text-[var(--on-surface)]"
                    title={req.createdBy?.trim() || "Marketing"}
                  >
                    {req.createdBy?.trim() || "Marketing"}
                  </div>
                </div>
              ),
            },
          ]
        : []),
    ],
    [isAdmin]
  );

  // 5 KPI strip items (Stage Filtering)
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
      detail: "Waiting for SAMP Lab",
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
    <>
      <DeskWorkspaceLayout
        title="Feasibility Checks"
        businessYear={currentBusinessYear}
        primaryAction={
          canRaiseRequest && !isReadOnly
            ? {
                label: "New Request",
                icon: Plus,
                onClick: () => setIsNewModalOpen(true),
                title: "Submit New Technical Feasibility Request",
              }
            : undefined
        }
        onRefresh={loadRequests}
        isRefreshing={isLoading}
        onExportCSV={handleExportCSV}
        exportDisabled={filteredRequests.length === 0}
        kpiItems={kpiItems}
        filterControls={
          <>
            {/* Quick Outcome Segmented Tabs (Compact) */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5 shadow-2xs shrink-0">
              {[
                { id: "all", label: "All Outcomes", icon: Layers, count: metrics.total },
                { id: "feasible", label: "Feasible", icon: CheckCircle2, count: metrics.feasible },
                { id: "conditional", label: "Conditional", icon: AlertTriangle, count: metrics.conditional },
                { id: "approved", label: "Approved", icon: Check, count: metrics.approved },
                { id: "converted", label: "Converted", icon: ArrowRight, count: metrics.converted },
              ].map((item) => {
                const isSelected = outcomeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOutcomeFilter(item.id as MarketingFeasibilityOutcome);
                    }}
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

            {/* Integrated Search Input right next to Outcome Tabs on Top Row */}
            <div className="group relative min-w-[180px] flex-1 max-w-[280px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--on-surface-subtle)] transition-colors group-focus-within:text-[var(--accent-primary)]" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search code, customer, scope... ('/')"
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

            {/* Customer Filter Dropdown */}
            {customerList.length > 0 && (
              <Select
                aria-label="Filter by customer"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="min-w-[130px] max-w-[170px]"
                options={[
                  { value: "all", label: `Customers (${customerList.length})` },
                  ...customerList.map((c) => ({ value: c, label: c })),
                ]}
              />
            )}
          </>
        }
        hasActiveFilters={hasActiveFilters}
        onResetFilters={clearFilters}
        resetFiltersLabel="Clear Filters"
      >
        <DataTable
          data={filteredRequests}
          columns={columns}
          keyExtractor={(req) => String(req.id)}
          isLoading={isLoading}
          enableSelection={true}
          selectedIds={selectedIds}
          onToggleSelectRow={toggleSelectRow}
          onToggleSelectAll={toggleSelectAll}
          tableClassName="w-full table-fixed min-w-0"
          containerClassName="overflow-y-auto overflow-x-hidden"
          emptyMessage={
            requests.length === 0
              ? "No feasibility requests recorded yet for this year."
              : "No requests match the specified feasibility filters."
          }
          onRowClick={handleInspectRequest}
          toolbarLeft={
            <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--on-surface-muted)]">
              <span className="truncate">
                Showing{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                  {filteredRequests.length}
                </span>{" "}
                of{" "}
                <span className="font-mono font-semibold tabular-nums text-[var(--on-surface)]">
                  {requests.length}
                </span>{" "}
                feasibility checks
              </span>
              {selectedIds.size > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary)] text-white shadow-2xs">
                  {selectedIds.size} selected
                </span>
              )}
            </div>
          }
          toolbarRight={
            <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
              Sampling Feasibility Queue
            </span>
          }
        />
      </DeskWorkspaceLayout>

      {isLoading && <TopLoadingBar isLoading={true} />}

      <React.Suspense fallback={null}>
        {/* Inspector Modal */}
        {selectedRequest && isInspectorOpen && (
          <FeasibilityInspectorModal
            request={selectedRequest}
            isOpen={isInspectorOpen}
            onClose={() => {
              setIsInspectorOpen(false);
              setSelectedRequest(null);
            }}
            onRefresh={loadRequests}
            user={user}
            isAdmin={isAdmin}
            sourceDesk={sourceDesk}
          />
        )}

        {/* New Feasibility Request Modal */}
        {isNewModalOpen && canRaiseRequest && !isReadOnly && (
          <NewFeasibilityModal
            isOpen={isNewModalOpen && canRaiseRequest && !isReadOnly}
            onClose={() => setIsNewModalOpen(false)}
            onSubmit={handleCreateRequest}
            customers={masterCustomers}
            existingCustomers={customerList}
            requestCreatedBy={user?.name || user?.userid}
            defaultPlant={selectedPlant && selectedPlant !== "All Plants" ? selectedPlant : "Navneet - Khaniwade"}
          />
        )}
      </React.Suspense>
    </>
  );
};

export default FeasibilityRequestsPage;
