import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Factory,
  PackageCheck,
  Layers,
  Building2,
  Clock,
  AlertTriangle,
  Sparkles,
  Package,
  ArrowUpRight,
} from "lucide-react";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { DeskWorkspaceLayout, DataTable, type ColumnDef } from "@/components/erp";
import { TopLoadingBar } from "@/components/ui/loading";
const SampleRequestInspector = React.lazy(() =>
  import("@/features/sample-requests/components/SampleRequestInspector").then((m) => ({
    default: m.SampleRequestInspector,
  }))
);
import type { SampleRequestItem } from "@/features/sample-requests/types";
import type { UserProfile } from "@/features/auth";
import { isAdmin as isAdminUser } from "@/features/auth/permissions";
import {
  fetchPlantSamplingQueueApi,
  fetchSampleRequestsApi,
} from "@/infrastructure/api/sampleRequestsApi";
import { formatOdooDate } from "@/features/sample-requests/utils/dateUtils";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { Select } from "@/components/ui/Select";
import { exportRecordsToCsv } from "@/lib/csvExport";

interface PlantSamplingQueueProps {
  user?: UserProfile | null;
}

export type PlantSamplingTab = "all" | "upcoming" | "direct" | "variants" | "my_claims" | "overdue";

function stageSource(request: SampleRequestItem): string {
  return request.mockupWorkflowState?.samplingRouting?.creativeChangesRequired
    ? "Creative variant"
    : "Direct resample";
}

export function isReleasedToPlant(r: SampleRequestItem): boolean {
  const isClosed = Boolean(
    r.is_closed ||
    r.mockupWorkflowState?.is_closed ||
    r.closure != null ||
    String(r.status || "").toLowerCase().includes("closed")
  );
  if (isClosed) return false;
  const s = String(r.status || "").toLowerCase();
  return s.includes("released to plant") || s === "released" || s === "plant";
}

export function isUpcoming(r: SampleRequestItem): boolean {
  const isClosed = Boolean(
    r.is_closed ||
    r.mockupWorkflowState?.is_closed ||
    r.closure != null ||
    String(r.status || "").toLowerCase().includes("closed")
  );
  if (isClosed) return false;
  const s = String(r.status || "").toLowerCase();
  if (["delivered", "completed", "cancelled", "rejected", "dispatched", "dispatched / closed"].includes(s)) {
    return false;
  }
  return !isReleasedToPlant(r);
}

export function getUpcomingPhaseInfo(r: SampleRequestItem): {
  phase: string;
  badgeColor: string;
  dotColor: string;
  description: string;
} {
  const statusLower = String(r.status || "").toLowerCase();
  const mockupStage = String(r.mockupWorkflowState?.stage || "").toLowerCase();
  const feasibilityStatus = String((r as any).feasibilityStatus || "").toLowerCase();
  const costingStatus = String((r as any).costingStatus || "").toLowerCase();

  const isClosed = Boolean(
    r.is_closed ||
    r.mockupWorkflowState?.is_closed ||
    r.closure != null ||
    statusLower.includes("closed")
  );
  if (isClosed) {
    return {
      phase: "Request Closed",
      badgeColor: "bg-rose-500/10 text-rose-700  border border-rose-500/20",
      dotColor: "bg-rose-500",
      description: "Request closed by marketing",
    };
  }

  // 1. Released to Plant
  if (isReleasedToPlant(r)) {
    return {
      phase: "Plant Fabrication",
      badgeColor: "bg-emerald-500/10 text-emerald-700  border border-emerald-500/20",
      dotColor: "bg-emerald-500",
      description: "Released to plant for fabrication",
    };
  }

  // 2. Feasibility Phase
  if (
    statusLower.includes("feasibility") ||
    feasibilityStatus === "pending" ||
    feasibilityStatus === "in_review" ||
    feasibilityStatus === "reviewing"
  ) {
    return {
      phase: "Feasibility Review",
      badgeColor: "bg-sky-500/10 text-sky-700  border border-sky-500/20",
      dotColor: "bg-sky-500",
      description: "Technical feasibility assessment",
    };
  }

  // 3. Creative / CAD Mockup Phase
  if (
    mockupStage.includes("creative") ||
    statusLower.includes("creative") ||
    statusLower.includes("mockup") ||
    statusLower.includes("concept") ||
    statusLower.includes("artwork")
  ) {
    return {
      phase: "CAD / Artwork Design",
      badgeColor: "bg-purple-500/10 text-purple-700  border border-purple-500/20",
      dotColor: "bg-purple-500",
      description: "Artwork design & CAD simulation",
    };
  }

  // 4. Costing Phase
  if (
    statusLower.includes("costing") ||
    costingStatus === "pending" ||
    costingStatus === "in_review"
  ) {
    return {
      phase: "Costing Estimation",
      badgeColor: "bg-amber-500/10 text-amber-700  border border-amber-500/20",
      dotColor: "bg-amber-500",
      description: "BOM costing & margin evaluation",
    };
  }

  // 5. Sampling Team Review / Release Prep
  if (
    statusLower.includes("sampling review") ||
    statusLower.includes("pmt") ||
    statusLower.includes("prepress") ||
    statusLower.includes("sampling approved") ||
    statusLower.includes("awaiting release")
  ) {
    return {
      phase: "Sampling Review",
      badgeColor: "bg-teal-500/10 text-teal-700  border border-teal-500/20",
      dotColor: "bg-teal-500",
      description: "Sampling team review & release prep",
    };
  }

  // 6. Default Intake / Specification Gathering
  return {
    phase: "Intake & Specs",
    badgeColor: "bg-zinc-500/10 text-zinc-700  border border-zinc-500/20",
    dotColor: "bg-zinc-500",
    description: "Marketing intake & specification gathering",
  };
}

export const PlantSamplingQueue: React.FC<PlantSamplingQueueProps> = ({ user }) => {
  const { selectedYear } = useBusinessYear();
  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [selected, setSelected] = useState<SampleRequestItem | null>(null);
  const [selectedTab, setSelectedTab] = useState<PlantSamplingTab>("all");
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [plantFilter, setPlantFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const now = useMemo(() => new Date(), []);
  const userId = user?.id == null ? null : String(user.id);
  const readOnly = Boolean(user?.is_team_head) && !isAdminUser(user);

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [releasedList, allList] = await Promise.all([
        fetchPlantSamplingQueueApi(selectedYear).catch(() => []),
        fetchSampleRequestsApi(selectedYear, false, "sample").catch(() => []),
      ]);

      // Merge both datasets uniquely
      const map = new Map<string, SampleRequestItem>();

      allList.forEach((item) => {
        map.set(String(item.id), item);
      });

      releasedList.forEach((item) => {
        const existing = map.get(String(item.id));
        map.set(String(item.id), {
          ...existing,
          ...item,
          status: item.status || "Released to Plant",
        });
      });

      const merged = Array.from(map.values());
      setRequests(merged);
      setSelected((current) =>
        current ? merged.find((item) => String(item.id) === String(current.id)) || null : null
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Plant sampling requests could not be loaded. Refresh to try again."
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await load();
  };

  const isRequestOverdue = useCallback(
    (r: SampleRequestItem) => {
      if (
        r.sampleRequiredDate &&
        !["delivered", "completed", "cancelled", "dispatched", "dispatched / closed"].includes(
          String(r.status || "").toLowerCase()
        )
      ) {
        const dt = new Date(r.sampleRequiredDate);
        return !isNaN(dt.getTime()) && dt < now;
      }
      return false;
    },
    [now]
  );

  // Categorized subsets
  const releasedRequests = useMemo(
    () => requests.filter((r) => isReleasedToPlant(r)),
    [requests]
  );

  const upcomingRequests = useMemo(
    () => requests.filter((r) => isUpcoming(r)),
    [requests]
  );

  const claimedByMe = useMemo(
    () =>
      releasedRequests.filter(
        (request) => userId && String(request.mockupWorkflowState?.claimedByUserId ?? "") === userId
      ),
    [releasedRequests, userId]
  );

  const directResamples = useMemo(
    () =>
      releasedRequests.filter(
        (request) => !request.mockupWorkflowState?.samplingRouting?.creativeChangesRequired
      ),
    [releasedRequests]
  );

  const variantWork = useMemo(
    () =>
      releasedRequests.filter(
        (request) => Boolean(request.mockupWorkflowState?.samplingRouting?.creativeChangesRequired)
      ),
    [releasedRequests]
  );

  const overdueCount = useMemo(
    () => requests.filter((r) => isRequestOverdue(r)).length,
    [requests, isRequestOverdue]
  );

  // Dropdown options
  const customerList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.customer?.trim()) set.add(r.customer.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  const plantList = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => {
      if (r.targetPlant?.trim()) set.add(r.targetPlant.trim());
    });
    return Array.from(set).sort();
  }, [requests]);

  // Filtered visible requests
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((r) => {
      const released = isReleasedToPlant(r);
      const upcoming = isUpcoming(r);

      // Stage Tab filter
      if (selectedTab === "all" && !released) {
        return false;
      }
      if (selectedTab === "upcoming" && !upcoming) {
        return false;
      }
      if (
        selectedTab === "direct" &&
        (!released || r.mockupWorkflowState?.samplingRouting?.creativeChangesRequired)
      ) {
        return false;
      }
      if (
        selectedTab === "variants" &&
        (!released || !r.mockupWorkflowState?.samplingRouting?.creativeChangesRequired)
      ) {
        return false;
      }
      if (
        selectedTab === "my_claims" &&
        (!released || !userId || String(r.mockupWorkflowState?.claimedByUserId ?? "") !== userId)
      ) {
        return false;
      }
      if (selectedTab === "overdue" && !isRequestOverdue(r)) {
        return false;
      }

      // Dropdown filters
      if (customerFilter !== "all" && (r.customer || "").trim() !== customerFilter) {
        return false;
      }
      if (plantFilter !== "all" && (r.targetPlant || "").trim() !== plantFilter) {
        return false;
      }

      // Search query
      if (!query) return true;
      const phaseInfo = getUpcomingPhaseInfo(r);
      return (
        (r.srNumber || "").toLowerCase().includes(query) ||
        (r.requestCode || "").toLowerCase().includes(query) ||
        (r.customer || "").toLowerCase().includes(query) ||
        (r.brandName || "").toLowerCase().includes(query) ||
        (r.materialCode || "").toLowerCase().includes(query) ||
        (r.productDescription || "").toLowerCase().includes(query) ||
        (r.targetPlant || "").toLowerCase().includes(query) ||
        stageSource(r).toLowerCase().includes(query) ||
        phaseInfo.phase.toLowerCase().includes(query)
      );
    });
  }, [requests, search, selectedTab, customerFilter, plantFilter, userId, isRequestOverdue]);

  const handleResetFilters = () => {
    setSearch("");
    setSelectedTab("all");
    setCustomerFilter("all");
    setPlantFilter("all");
  };

  const hasActiveFilters = Boolean(
    search.trim() || selectedTab !== "all" || customerFilter !== "all" || plantFilter !== "all"
  );

  const handleExportCSV = () => {
    exportRecordsToCsv({
      filename: `plant_sampling_${selectedTab}_${new Date().toISOString().split("T")[0]}.csv`,
      columns: [
        { header: "SR Code", accessor: (r) => r.srNumber || r.requestCode || `SR-${r.id}` },
        { header: "Queue Category", accessor: (r) => (isUpcoming(r) ? "Upcoming Pipeline" : "Plant Intake") },
        { header: "Current Workflow Phase", accessor: (r) => getUpcomingPhaseInfo(r).phase },
        { header: "Product Description", accessor: (r) => r.productDescription || "" },
        { header: "Customer", accessor: (r) => r.customer || "" },
        { header: "Brand", accessor: (r) => r.brandName || "" },
        { header: "Material Code", accessor: (r) => r.materialCode || "" },
        { header: "Plant Destination", accessor: (r) => r.targetPlant || "" },
        { header: "Task Owner", accessor: (r) => r.mockupWorkflowState?.claimedBy || "Unclaimed" },
        { header: "Target SLA Date", accessor: (r) => r.sampleRequiredDate || "" },
        { header: "Status", accessor: (r) => r.status || "" },
      ],
      data: visible,
    });
  };

  // Concise columns fitting single screen width without horizontal scroll
  const columns = useMemo<ColumnDef<SampleRequestItem>[]>(
    () => [
      {
        id: "request",
        header: "SR / Reference Code",
        width: "w-[145px]",
        sortable: true,
        cell: (r) => {
          const upcoming = isUpcoming(r);
          return (
            <div>
              <CopyBadge text={r.srNumber || r.requestCode || `SR-${r.id}`} />
              <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-mono text-[var(--on-surface-subtle)]">
                {upcoming ? (
                  <span className="inline-flex items-center gap-0.5 text-indigo-600  font-bold">
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    <span>Upcoming</span>
                  </span>
                ) : (
                  <span>{stageSource(r)}</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "product",
        header: "Product & Category",
        cell: (r) => {
          const categoryHierarchy = [
            r.productCategory,
            r.productSubCategory,
            r.productThirdCategory,
          ]
            .filter(Boolean)
            .join(" / ");
          return (
            <div className="max-w-xs min-w-0">
              <div
                className="font-semibold text-xs text-[var(--on-surface)] truncate"
                title={r.productDescription || (r as any).opportunityName || "Deliverable"}
              >
                {r.productDescription || (r as any).opportunityName || "Commercial Sample"}
              </div>
              <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 truncate">
                {categoryHierarchy || r.materialCode || "Fabrication"}
              </div>
            </div>
          );
        },
      },
      {
        id: "customer",
        header: "Customer / Brand",
        width: "w-[145px]",
        cell: (r) => (
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[var(--on-surface)]">
              <Building2 className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
              <span className="truncate max-w-[125px]" title={r.customer || ""}>
                {r.customer || "—"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[var(--on-surface-subtle)] mt-0.5 pl-5">
              {r.brandName || "Commercial Account"}
            </div>
          </div>
        ),
      },
      {
        id: "material",
        header: "Material Code",
        width: "w-[125px]",
        cell: (r) => (
          <span className="font-mono text-xs text-[var(--on-surface)] font-medium">
            {r.materialCode || "—"}
          </span>
        ),
      },
      {
        id: "plant",
        header: "Plant Destination",
        width: "w-[125px]",
        cell: (r) => (
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--on-surface)]">
            <Factory className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] shrink-0" />
            <span className="truncate">{r.targetPlant || "Khaniwade"}</span>
          </div>
        ),
      },
      {
        id: "phase",
        header: "Current Phase",
        width: "w-[160px]",
        cell: (r) => {
          const phaseInfo = getUpcomingPhaseInfo(r);
          const upcoming = isUpcoming(r);
          return (
            <div className="space-y-0.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${phaseInfo.badgeColor}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${phaseInfo.dotColor} ${
                    upcoming ? "animate-pulse" : ""
                  }`}
                />
                <span>{phaseInfo.phase}</span>
              </span>
              <div
                className="text-[10px] text-[var(--on-surface-subtle)] truncate max-w-[150px]"
                title={phaseInfo.description}
              >
                {phaseInfo.description}
              </div>
            </div>
          );
        },
      },
      {
        id: "sla",
        header: "Target SLA Date",
        width: "w-[125px]",
        cell: (r) => {
          const isOverdue = isRequestOverdue(r);
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--on-surface)]">
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isOverdue ? "text-rose-500" : "text-[var(--on-surface-subtle)]"
                  }`}
                />
                <span
                  className={
                    isOverdue
                      ? "font-semibold text-rose-600 "
                      : "text-[var(--on-surface-muted)]"
                  }
                >
                  {r.sampleRequiredDate ? formatOdooDate(r.sampleRequiredDate) : "Standard SLA"}
                </span>
              </div>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200   ">
                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                  <span>Overdue</span>
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "claim",
        header: "Task Owner",
        width: "w-[135px]",
        cell: (r) => {
          const isClosed = Boolean(
            r.is_closed ||
            r.mockupWorkflowState?.is_closed ||
            r.closure != null ||
            String(r.status || "").toLowerCase().includes("closed")
          );
          if (isClosed) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-700  border border-rose-500/20">
                Closed
              </span>
            );
          }
          const upcoming = isUpcoming(r);
          const claimedBy = r.mockupWorkflowState?.claimedBy;
          if (upcoming) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-500/10 text-indigo-700  border border-indigo-500/20">
                Pre-Release
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[9px] font-bold flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                {(claimedBy || "U")[0].toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-[var(--on-surface)] truncate">
                  {claimedBy || "Unclaimed"}
                </div>
                <span
                  className={`inline-flex rounded-md px-1.5 py-0.2 text-[9px] font-mono font-bold ${
                    !claimedBy
                      ? "bg-amber-500/10 text-amber-700  border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-700  border border-emerald-500/20"
                  }`}
                >
                  {!claimedBy ? "Needs Claim" : "Assigned"}
                </span>
              </div>
            </div>
          );
        },
      },
    ],
    [isRequestOverdue]
  );

  const kpiItems = [
    {
      label: "Plant Intake",
      value: loading ? "—" : releasedRequests.length,
      detail: "Active in fabrication",
      color: "bg-[#245942]",
      isActive: selectedTab === "all",
      onClick: () => setSelectedTab("all"),
    },
    {
      label: "Upcoming",
      value: loading ? "—" : upcomingRequests.length,
      detail: "Pre-production queue",
      color: "bg-indigo-600",
      isActive: selectedTab === "upcoming",
      onClick: () => setSelectedTab("upcoming"),
    },
    {
      label: "Direct Resamples",
      value: loading ? "—" : directResamples.length,
      detail: "Direct plant release",
      color: "bg-blue-600",
      isActive: selectedTab === "direct",
      onClick: () => setSelectedTab("direct"),
    },
    {
      label: "Artwork Variants",
      value: loading ? "—" : variantWork.length,
      detail: "Creative-approved designs",
      color: "bg-purple-600",
      isActive: selectedTab === "variants",
      onClick: () => setSelectedTab("variants"),
    },
    {
      label: "Claimed By Me",
      value: loading ? "—" : claimedByMe.length,
      detail: "Your active plant handoffs",
      color: "bg-amber-500",
      isActive: selectedTab === "my_claims",
      onClick: () => setSelectedTab("my_claims"),
    },
    {
      label: "Overdue SLA",
      value: loading ? "—" : overdueCount,
      detail: "Past target delivery date",
      color: "bg-rose-500",
      isActive: selectedTab === "overdue",
      onClick: () => setSelectedTab("overdue"),
    },
  ];

  return (
    <DeskWorkspaceLayout
      title="Plant Sampling Intake & Execution"
      subtitle="Physical fabrication queue and pre-production advance visibility for plant operations."
      businessYear={selectedYear}
      totalCount={requests.length}
      totalLabel="samples tracked"
      onRefresh={handleRefresh}
      isRefreshing={loading || isRefreshing}
      onExportCSV={handleExportCSV}
      exportDisabled={visible.length === 0}
      kpiItems={kpiItems}
      kpiGridCols="grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6"
      extraFilterControls={
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-low)] p-0.5">
          {[
            { id: "all" as const, label: "Plant Intake", icon: Layers, count: releasedRequests.length },
            { id: "upcoming" as const, label: "Upcoming Pipeline", icon: ArrowUpRight, count: upcomingRequests.length },
            { id: "direct" as const, label: "Direct Resamples", icon: Package, count: directResamples.length },
            { id: "variants" as const, label: "Artwork Variants", icon: Sparkles, count: variantWork.length },
            { id: "my_claims" as const, label: "My Claims", icon: PackageCheck, count: claimedByMe.length },
            { id: "overdue" as const, label: "Overdue", icon: AlertTriangle, count: overdueCount },
          ].map((item) => {
            const isSelected = selectedTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer select-none ${
                  isSelected
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] shadow-2xs font-bold"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] font-bold"
                      : "text-[var(--on-surface-subtle)]"
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>
      }
      filterControls={
        <>
          {plantList.length > 0 && (
            <Select
              aria-label="Filter by plant destination"
              value={plantFilter}
              onChange={(e) => setPlantFilter(e.target.value)}
              className="min-w-[140px] max-w-[170px]"
              options={[
                { value: "all", label: `All Plants (${plantList.length})` },
                ...plantList.map((p) => ({ value: p, label: p })),
              ]}
            />
          )}

          {customerList.length > 0 && (
            <Select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="min-w-[150px] max-w-[180px]"
              options={[
                { value: "all", label: `All Brands (${customerList.length})` },
                ...customerList.map((c) => ({ value: c, label: c })),
              ]}
            />
          )}
        </>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: "Search SR, customer, material, plant, phase…",
      }}
      hasActiveFilters={hasActiveFilters}
      onResetFilters={handleResetFilters}
      resetFiltersLabel="Reset Filters"
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800  "
        >
          {error}
        </div>
      )}

      <DataTable
        data={visible}
        columns={columns}
        keyExtractor={(request) => String(request.id)}
        isLoading={loading || isRefreshing}
        onRowClick={setSelected}
        emptyMessage={
          hasActiveFilters
            ? "No sample handoffs match your active filters or search query."
            : selectedTab === "upcoming"
            ? "There are currently no upcoming pre-production sample requests in the pipeline."
            : "Plant sampling intake is clear. When samples are released to Plant, they will appear here."
        }
        pageSize={30}
        toolbarLeft={
          <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 ">
            <span className="truncate">
              Showing{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 ">
                {visible.length}
              </span>{" "}
              of{" "}
              <span className="font-mono font-semibold tabular-nums text-zinc-900 ">
                {requests.length}
              </span>{" "}
              {selectedTab === "upcoming" ? "upcoming pre-production deliverables" : "plant deliverables"}
            </span>
          </div>
        }
      />

      {loading && <TopLoadingBar isLoading={true} />}

      <React.Suspense fallback={null}>
        {selected && (
          <SampleRequestInspector
            request={selected}
            isOpen={Boolean(selected)}
            onClose={() => setSelected(null)}
            role="plant"
            readOnly={readOnly}
            isAdmin={isAdminUser(user)}
            actorName={user?.name || user?.userid}
            actorUserId={user?.id}
            onRefresh={load}
          />
        )}
      </React.Suspense>
    </DeskWorkspaceLayout>
  );
};

export default PlantSamplingQueue;
