import React, { useMemo, useState, useEffect } from "react";
import { SampleRequestItem } from "../types";
import {
  getRequestTrackType,
  isDesignRequest,
} from "../utils/trackTypes";
import { UserProfile } from "@/features/auth";
import { fetchUsersApi, UserItem } from "@/infrastructure/api";
import {
  Layers,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Download,
  ChevronRight,
  TrendingUp,
  Users,
  User,
  ShieldCheck,
  FileEdit,
  Send,
  Building2,
  Hourglass,
  BarChart3,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { EmptyState } from "@/components/ui/EmptyState";

export interface MarketingOverviewPageProps {
  requests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant?: string;
  user?: UserProfile | null;
  isAdmin?: boolean;
  onOpenNewModal: (track?: "marketing_request" | "feasibility_check" | "program_planning") => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onExportCSV: () => void;
}

// 12-Month Business Year sequence (October to September)
const BY_MONTHS = [
  { key: "10", label: "Oct", full: "October" },
  { key: "11", label: "Nov", full: "November" },
  { key: "12", label: "Dec", full: "December" },
  { key: "01", label: "Jan", full: "January" },
  { key: "02", label: "Feb", full: "February" },
  { key: "03", label: "Mar", full: "March" },
  { key: "04", label: "Apr", full: "April" },
  { key: "05", label: "May", full: "May" },
  { key: "06", label: "Jun", full: "June" },
  { key: "07", label: "Jul", full: "July" },
  { key: "08", label: "Aug", full: "August" },
  { key: "09", label: "Sep", full: "September" },
];

export const MarketingOverviewPage: React.FC<MarketingOverviewPageProps> = ({
  requests,
  isLoading,
  selectedYear,
  user,
  isAdmin = false,
  onInspectRequest,
  onExportCSV,
}) => {
  const navigate = useNavigate();

  // Determine if the current user has Marketing Head / Lead authority
  const isHeadRole = useMemo(() => {
    if (isAdmin) return true;
    return Boolean(user?.is_team_head);
  }, [isAdmin, user]);

  // Two Persona View Modes:
  // "head": Sees aggregated stats for all marketing members with member breakdown table
  // "specialist": Focuses strictly on the logged-in user's own requests
  const [viewMode, setViewMode] = useState<"head" | "specialist">(() =>
    isHeadRole ? "head" : "specialist"
  );

  // Selected member filter when in Head mode
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");

  // Filtering & search states
  const [watchlistFilter, setWatchlistFilter] = useState<
    "all" | "drafts" | "feasibility" | "delayed" | "ontime"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Time-based greeting
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const firstName = useMemo(() => {
    if (!user?.name) return "Marketer";
    return user.name.split(" ")[0];
  }, [user?.name]);

  // Returning user greeting check
  const isReturningUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("samp_mkt_visited");
      if (stored) return true;
      localStorage.setItem("samp_mkt_visited", "true");
      return false;
    } catch {
      return false;
    }
  }, []);

  // Determine the logged-in user's identifier for request matching
  const currentUserName = useMemo(() => {
    return (user?.name || user?.userid || "Admin").trim();
  }, [user?.name, user?.userid]);

  // Real marketing department members from backend users table
  const [marketingUsers, setMarketingUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchUsersApi("marketing")
      .then((usersList) => {
        if (isMounted && Array.isArray(usersList)) {
          setMarketingUsers(usersList);
        }
      })
      .catch((err) => {
        console.warn("Could not load marketing users list:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // =========================================================================
  // 1. TEAM MEMBERS EXTRACTION & RECOGNITION (100% REAL DATA ONLY)
  // =========================================================================
  const teamMembersList = useMemo(() => {
    const countsMap: Record<string, number> = {};

    // 1. Seed registered marketing team members from company directory
    marketingUsers.forEach((u) => {
      const name = (u.name || u.userid || "").trim();
      if (name) {
        countsMap[name] = 0;
      }
    });

    // 2. Aggregate actual creators recorded on requests
    requests.forEach((r) => {
      const creator = (r.createdBy || "").trim();
      if (!creator) return;

      const matchedKey = Object.keys(countsMap).find(
        (k) => k.toLowerCase() === creator.toLowerCase()
      );
      if (matchedKey) {
        countsMap[matchedKey] = (countsMap[matchedKey] || 0) + 1;
      } else {
        countsMap[creator] = (countsMap[creator] || 0) + 1;
      }
    });

    return Object.entries(countsMap)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [marketingUsers, requests]);

  // =========================================================================
  // 2. DATA FILTERING BY ACTIVE PERSONA (HEAD VS SPECIALIST)
  // =========================================================================
  const scopedRequests = useMemo(() => {
    if (viewMode === "specialist") {
      // Filter strictly to the logged-in user's own requests (100% genuine)
      const me = currentUserName.toLowerCase();
      return requests.filter((r) => {
        const creator = (r.createdBy || "").toLowerCase().trim();
        return creator === me || (me.length > 2 && (creator.includes(me) || me.includes(creator)));
      });
    }

    // In Head mode, apply member filter if selected
    if (selectedMemberFilter !== "all") {
      const target = selectedMemberFilter.toLowerCase().trim();
      return requests.filter((r) => {
        const creator = (r.createdBy || "").toLowerCase().trim();
        return (
          creator === target ||
          (target.length > 2 && (creator.includes(target) || target.includes(creator)))
        );
      });
    }

    return requests;
  }, [requests, viewMode, selectedMemberFilter, currentUserName]);

  // =========================================================================
  // 3. CORE MARKETING SLA & STAGE CLASSIFICATION
  // =========================================================================
  const telemetry = useMemo(() => {
    const now = new Date();
    let totalDrafts = 0;
    let totalInProduction = 0;
    let totalAwaitingMarketingAction = 0;
    let totalCompleted = 0;
    let totalOnTime = 0;
    let totalDelayed = 0;
    let urgentCount = 0;

    const classified = scopedRequests.map((r) => {
      const statusStr = String(r.status || "").toLowerCase();
      const track = getRequestTrackType(r);

      const isDraft =
        statusStr.includes("draft") ||
        statusStr.includes("smt") ||
        statusStr.includes("pending allocation");

      const isClosed =
        statusStr.includes("dispatch") ||
        statusStr.includes("deal") ||
        statusStr.includes("closed") ||
        statusStr.includes("approved");

      // Awaiting Marketing Action:
      // (1) Feasibility evaluated by lab but marketing decision not recorded
      // (2) Creative proof submitted awaiting marketing review
      const isFeasibilityAwaitingAction =
        track === "feasibility_check" &&
        Boolean(r.samplingFeasibilityResponse) &&
        !r.marketingDecision;

      const isCreativeAwaitingAction =
        r.marketingDesignDecision === "awaiting_marketing_review";

      const needsMarketingAction = isFeasibilityAwaitingAction || isCreativeAwaitingAction;

      let isDelayed = false;
      let isUrgent = false;
      let overdueDays = 0;

      if (r.sampleRequiredDate) {
        const targetDate = new Date(r.sampleRequiredDate);
        if (!isNaN(targetDate.getTime())) {
          if (!isClosed && targetDate < now) {
            isDelayed = true;
            overdueDays = Math.max(1, Math.floor((now.getTime() - targetDate.getTime()) / 86400000));
          } else if (!isClosed) {
            const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            if (diffDays <= 3) {
              isUrgent = true;
            }
          }
        }
      }

      if (isDraft) totalDrafts++;
      else if (!isClosed) totalInProduction++;

      if (isClosed) totalCompleted++;
      if (needsMarketingAction) totalAwaitingMarketingAction++;

      if (isDelayed) totalDelayed++;
      else totalOnTime++;

      if (isUrgent) urgentCount++;

      return {
        ...r,
        _isDraft: isDraft,
        _isClosed: isClosed,
        _needsMarketingAction: needsMarketingAction,
        _isDelayed: isDelayed,
        _overdueDays: overdueDays,
        _isUrgent: isUrgent,
      };
    });

    const total = scopedRequests.length;
    const onTimeRate = total > 0 ? Math.round((totalOnTime / total) * 100) : 100;

    return {
      total,
      totalDrafts,
      totalInProduction,
      totalAwaitingMarketingAction,
      totalCompleted,
      totalOnTime,
      totalDelayed,
      urgentCount,
      onTimeRate,
      classified,
    };
  }, [scopedRequests]);

  // =========================================================================
  // 4. TEAM MEMBERS PERFORMANCE AUDIT (FOR MARKETING HEAD VIEW)
  // =========================================================================
  const memberAuditMatrix = useMemo(() => {
    return teamMembersList.map((member) => {
      // Find actual requests created by this member (or assigned)
      const memberReqs = requests.filter((r) => {
        const creator = (r.createdBy || "").toLowerCase().trim();
        const memberName = member.name.toLowerCase().trim();
        return (
          creator === memberName ||
          (memberName.length > 2 && (creator.includes(memberName) || memberName.includes(creator)))
        );
      });

      const total = memberReqs.length;
      const delayed = memberReqs.filter((r) => {
        if (!r.sampleRequiredDate) return false;
        const d = new Date(r.sampleRequiredDate);
        const s = String(r.status || "").toLowerCase();
        return (
          d < new Date() &&
          !s.includes("dispatch") &&
          !s.includes("closed") &&
          !s.includes("approved") &&
          !s.includes("deal")
        );
      }).length;

      const drafts = memberReqs.filter((r) => {
        const s = String(r.status || "").toLowerCase();
        return (
          s.includes("draft") ||
          s.includes("smt") ||
          s.includes("intake") ||
          s.includes("pending allocation")
        );
      }).length;

      const active = Math.max(0, total - drafts);
      const onTime = Math.max(0, total - delayed);
      const slaRate = total > 0 ? Math.round((onTime / total) * 100) : 100;

      const isCurrentUser =
        member.name.toLowerCase().trim() === currentUserName.toLowerCase().trim() ||
        (currentUserName.length > 2 &&
          (member.name.toLowerCase().includes(currentUserName.toLowerCase()) ||
            currentUserName.toLowerCase().includes(member.name.toLowerCase())));

      return {
        name: member.name,
        total,
        active,
        drafts,
        delayed,
        slaRate,
        isCurrentUser,
      };
    });
  }, [teamMembersList, requests, currentUserName]);

  // =========================================================================
  // 5. WORKSTREAM DECOMPOSITION (SAMPLING, FEASIBILITY, PROGRAMS, DESIGN)
  // =========================================================================
  const workstreams = useMemo(() => {
    let samplingCount = 0;
    let feasibilityCount = 0;
    let programCount = 0;
    let designCount = 0;
    let mockupCount = 0;
    let costingCount = 0;

    scopedRequests.forEach((r) => {
      const track = getRequestTrackType(r);
      if (track === "feasibility_check") feasibilityCount++;
      else if (track === "program_planning") programCount++;
      else samplingCount++;

      if (isDesignRequest(r)) designCount++;
      if (r.mockupRequired === "yes") mockupCount++;
      if (r.costingRequiredDate) costingCount++;
    });

    const total = scopedRequests.length || 1;

    return {
      sampling: { count: samplingCount, pct: Math.round((samplingCount / total) * 100) },
      feasibility: { count: feasibilityCount, pct: Math.round((feasibilityCount / total) * 100) },
      program: { count: programCount, pct: Math.round((programCount / total) * 100) },
      design: { count: designCount, pct: Math.round((designCount / total) * 100) },
      mockup: { count: mockupCount, pct: Math.round((mockupCount / total) * 100) },
      costing: { count: costingCount, pct: Math.round((costingCount / total) * 100) },
    };
  }, [scopedRequests]);

  // =========================================================================
  // 6. 12-MONTH INFLOW TIMELINE (CURVE + NUMERICAL TABLE)
  // =========================================================================
  const monthlyTimeline = useMemo(() => {
    const monthCounts: Record<
      string,
      { inflow: number; onTime: number; delayed: number }
    > = {};

    BY_MONTHS.forEach((m) => {
      monthCounts[m.key] = { inflow: 0, onTime: 0, delayed: 0 };
    });

    telemetry.classified.forEach((r) => {
      const dateStr = r.dateRequestCreated || r.createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const monthKey = String(d.getMonth() + 1).padStart(2, "0");
          if (monthCounts[monthKey]) {
            monthCounts[monthKey].inflow++;
            if (r._isDelayed) monthCounts[monthKey].delayed++;
            else monthCounts[monthKey].onTime++;
          }
        }
      }
    });

    const maxVal = Math.max(...BY_MONTHS.map((m) => monthCounts[m.key].inflow), 1);

    return {
      points: BY_MONTHS.map((m, idx) => ({
        index: idx,
        key: m.key,
        label: m.label,
        full: m.full,
        inflow: monthCounts[m.key].inflow,
        onTime: monthCounts[m.key].onTime,
        delayed: monthCounts[m.key].delayed,
        slaRate:
          monthCounts[m.key].inflow > 0
            ? Math.round((monthCounts[m.key].onTime / monthCounts[m.key].inflow) * 100)
            : 100,
      })),
      maxVal,
    };
  }, [telemetry.classified]);

  // Clean Catmull-Rom Bezier Spline
  const svgCurve = useMemo(() => {
    const width = 800;
    const height = 170;
    const paddingX = 30;
    const paddingY = 24;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;

    const dataPoints = monthlyTimeline.points.map((p, i) => {
      const x = paddingX + (i / (monthlyTimeline.points.length - 1)) * chartW;
      const normalizedY = p.inflow / (monthlyTimeline.maxVal || 1);
      const y = height - paddingY - normalizedY * chartH;
      return { x, y, ...p };
    });

    if (dataPoints.length === 0) return { linePath: "", areaPath: "", points: [], width, height };

    let d = `M ${dataPoints[0].x.toFixed(1)} ${dataPoints[0].y.toFixed(1)}`;
    for (let i = 0; i < dataPoints.length - 1; i++) {
      const p0 = dataPoints[i === 0 ? 0 : i - 1];
      const p1 = dataPoints[i];
      const p2 = dataPoints[i + 1];
      const p3 = dataPoints[i + 2 < dataPoints.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastX = dataPoints[dataPoints.length - 1].x;
    const firstX = dataPoints[0].x;
    const bottomY = height - paddingY;
    const area = `${d} L ${lastX.toFixed(1)} ${bottomY.toFixed(1)} L ${firstX.toFixed(1)} ${bottomY.toFixed(1)} Z`;

    return { linePath: d, areaPath: area, points: dataPoints, width, height };
  }, [monthlyTimeline]);

  // =========================================================================
  // 7. TOP CLIENT ACCOUNTS (PORTFOLIO HEALTH)
  // =========================================================================
  const topAccounts = useMemo(() => {
    const map: Record<string, { total: number; active: number; delayed: number }> = {};
    telemetry.classified.forEach((r) => {
      const c = (r.customer || "").trim() || "Unassigned Customer";
      if (!map[c]) map[c] = { total: 0, active: 0, delayed: 0 };
      map[c].total++;
      if (!r._isClosed) map[c].active++;
      if (r._isDelayed) map[c].delayed++;
    });

    return Object.entries(map)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        active: stat.active,
        delayed: stat.delayed,
        onTimeRate:
          stat.total > 0 ? Math.round(((stat.total - stat.delayed) / stat.total) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [telemetry.classified]);

  // =========================================================================
  // 8. WATCHLIST FILTERING
  // =========================================================================
  const filteredWatchlist = useMemo(() => {
    return telemetry.classified.filter((r) => {
      if (watchlistFilter === "drafts" && !r._isDraft) return false;
      if (watchlistFilter === "feasibility" && !r._needsMarketingAction) return false;
      if (watchlistFilter === "delayed" && !r._isDelayed) return false;
      if (watchlistFilter === "ontime" && r._isDelayed) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          String(r.srNumber || "").toLowerCase().includes(q) ||
          String(r.customer || "").toLowerCase().includes(q) ||
          String(r.productDescription || "").toLowerCase().includes(q) ||
          String(r.materialCode || "").toLowerCase().includes(q) ||
          String(r.status || "").toLowerCase().includes(q) ||
          String(r.createdBy || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [telemetry.classified, watchlistFilter, searchTerm]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] font-sans select-text overflow-y-auto">

      {/* ── 1. SOLID MARKETING GREETING & COMMAND HEADER ── */}
      <header className="px-5 sm:px-8 py-3.5 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">

          {/* Left: Dynamic Greeting with Role Context */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shrink-0" />
              <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight text-[var(--on-surface)]">
                {greetingText}, {firstName}! {isReturningUser && <span className="text-[var(--on-surface-muted)] font-normal text-sm sm:text-base">Nice to see you.</span>}
              </h1>
            </div>
            <p className="text-xs text-[var(--on-surface-muted)] flex items-center gap-2">
              <span>{isHeadRole ? "Marketing Head Executive Console" : "Marketing Specialist Portfolio"}</span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="font-mono text-[11px] text-[var(--on-surface-subtle)]">
                Business Year {selectedYear}
              </span>
            </p>
          </div>

          {/* Right: Persona Switcher & View Controls */}
          <div className="flex items-center gap-2.5">
            {/* Persona Switcher for Marketing Heads / Admins */}
            {isHeadRole && (
              <div className="inline-flex rounded-lg bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("head");
                    setSelectedMemberFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${viewMode === "head"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  title="View aggregated department performance across all team members"
                >
                  <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Team Head View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("specialist")}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${viewMode === "specialist"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                  title="Filter strictly to your personal requests"
                >
                  <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>My Requests</span>
                </button>
              </div>
            )}

            {/* In Head View: Team Member Filter Dropdown */}
            {isHeadRole && viewMode === "head" && (
              <Select
                aria-label="Filter by marketing team member"
                value={selectedMemberFilter}
                onChange={(e) => setSelectedMemberFilter(e.target.value)}
                size="sm"
                options={[
                  { value: "all", label: `All Team Members (${teamMembersList.length})` },
                  ...teamMembersList.map((m) => ({
                    value: m.name,
                    label: m.name,
                    count: m.count,
                  })),
                ]}
              />
            )}

            {/* Export CSV (Pure View Mode Action) */}
            <button
              type="button"
              onClick={onExportCSV}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

        </div>
      </header>

      {/* ── MAIN DASHBOARD BODY ── */}
      <main className="max-w-7xl w-full mx-auto p-5 sm:p-8 space-y-6">

        {/* ── 2. MARKETING EXECUTIVE MULTI-FACTOR KPI STRIP (VIEW MODE) ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Tile 1: Total Scoped Intake */}
          <div
            onClick={() => setWatchlistFilter("all")}
            className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] cursor-pointer shadow-2xs transition-colors"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                {viewMode === "head" ? "Total Team Intake" : "My Total Requests"}
              </span>
              <Layers className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.total}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              {viewMode === "head" ? `${teamMembersList.length} contributors` : "Raised by you"}
            </div>
          </div>

          {/* Tile 2: Pending Drafts (Waiting to Release) */}
          <div
            onClick={() => setWatchlistFilter("drafts")}
            className={`p-3.5 rounded-xl bg-[var(--surface-lowest)] border cursor-pointer shadow-2xs transition-colors ${telemetry.totalDrafts > 0 ? "border-amber-300 dark:border-amber-900/60" : "border-[var(--border-subtle)]"
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending Drafts
              </span>
              <FileEdit className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {isLoading ? "—" : telemetry.totalDrafts}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Awaiting release
            </div>
          </div>

          {/* Tile 3: In Production Fabrication */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                In Production
              </span>
              <Hourglass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalInProduction}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Active in lab/studio
            </div>
          </div>

          {/* Tile 4: Feasibility / NPD Awaiting Decision */}
          <div
            onClick={() => setWatchlistFilter("feasibility")}
            className={`p-3.5 rounded-xl bg-[var(--surface-lowest)] border cursor-pointer shadow-2xs transition-colors ${telemetry.totalAwaitingMarketingAction > 0
                ? "border-purple-300 dark:border-purple-900/60"
                : "border-[var(--border-subtle)]"
              }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Awaiting Decision
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-purple-600 dark:text-purple-400 tabular-nums">
              {isLoading ? "—" : telemetry.totalAwaitingMarketingAction}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Needs client verdict
            </div>
          </div>

          {/* Tile 5: On-Time Delivery SLA */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                Fulfillment SLA
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : `${telemetry.onTimeRate}%`}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {telemetry.totalOnTime} on-track tasks
            </div>
          </div>

          {/* Tile 6: Dispatched / Won Deals */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                Dispatched
              </span>
              <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalCompleted}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Delivered to client
            </div>
          </div>

        </section>

        {/* ── 3. MARKETING HEAD EXCLUSIVE: TEAM MEMBERS ALLOCATION MATRIX ── */}
        {isHeadRole && viewMode === "head" && (
          <section className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Marketing Team Members Performance & Request Ownership</span>
                </h2>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Leadership audit showing request volume, active pipeline, drafts, and delivery SLA for each marketing coordinator.
                </p>
              </div>

              {selectedMemberFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedMemberFilter("all")}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] text-xs text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium cursor-pointer"
                >
                  Clear Member Filter
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)]">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3 text-right">Total Requests</th>
                    <th className="py-2.5 px-3 text-right">Active In Production</th>
                    <th className="py-2.5 px-3 text-right">Pending Drafts</th>
                    <th className="py-2.5 px-3 text-right">Delayed SLA</th>
                    <th className="py-2.5 px-3">Delivery SLA Fulfillment</th>
                    <th className="py-2.5 px-3 text-right">Filter Scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                  {memberAuditMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-[var(--on-surface-muted)] font-sans">
                        No team members or request ownership records found for Business Year {selectedYear}.
                      </td>
                    </tr>
                  ) : (
                    memberAuditMatrix.map((member) => {
                    const isSelected = selectedMemberFilter === member.name;
                    return (
                      <tr
                        key={member.name}
                        className={`hover:bg-[var(--surface-low)] transition-colors ${isSelected ? "bg-[var(--accent-primary-subtle)]/40" : ""
                          }`}
                      >
                        <td className="py-3 px-3 font-semibold text-[var(--on-surface)] flex items-center gap-2.5 font-sans">
                          <span className="w-6 h-6 rounded-full bg-[var(--surface-low)] border border-[var(--border-subtle)] font-bold text-[10px] flex items-center justify-center text-[var(--accent-primary)]">
                            {member.name[0]}
                          </span>
                          <span>{member.name}</span>
                          {member.isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--surface-low)] text-[var(--accent-primary)] font-mono font-bold">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">
                          {member.total}
                        </td>
                        <td className="py-3 px-3 text-right text-[var(--on-surface-muted)] tabular-nums">
                          {member.active}
                        </td>
                        <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                          {member.drafts}
                        </td>
                        <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                          {member.delayed}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 w-36">
                            <div className="flex-1 bg-[var(--surface-low)] h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${member.slaRate >= 90
                                    ? "bg-emerald-500"
                                    : member.slaRate >= 75
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                style={{ width: `${member.slaRate}%` }}
                              />
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${member.slaRate >= 90
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                }`}
                            >
                              {member.slaRate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMemberFilter(isSelected ? "all" : member.name)
                            }
                            className={`px-2 py-1 rounded text-[11px] font-sans font-semibold border cursor-pointer transition-colors ${isSelected
                                ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                                : "bg-[var(--surface-low)] text-[var(--on-surface)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]"
                              }`}
                          >
                            {isSelected ? "Filtered ✓" : "Scope"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── 4. ANNUAL MARKETING INFLOW SPLINE CURVE & MONTHLY TABLE ── */}
        <section className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Marketing Request Intake Curve & Delivery Trajectory
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                  BY {selectedYear}
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Trajectory of requests raised by marketing progressing into sampling and physical verification.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />
                <span className="text-[var(--on-surface)] font-semibold">Inflow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[var(--on-surface-muted)]">On-Time</span>
              </div>

              <button
                type="button"
                onClick={() => setShowMonthlyTable((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{showMonthlyTable ? "Hide Matrix" : "View Monthly Numbers"}</span>
              </button>
            </div>
          </div>

          {/* Solid SVG Stock Spline Curve */}
          <div className="relative w-full overflow-hidden pt-1">
            <svg
              viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
              className="w-full h-36 sm:h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="mktCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              <line x1="30" y1="30" x2="770" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="30" y1="88" x2="770" y2="88" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="30" y1="146" x2="770" y2="146" stroke="var(--border-subtle)" />

              {svgCurve.areaPath && <path d={svgCurve.areaPath} fill="url(#mktCurveGrad)" />}

              {svgCurve.linePath && (
                <path
                  d={svgCurve.linePath}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {svgCurve.points.map((pt, idx) => {
                const isHovered = hoveredMonthIndex === idx;
                return (
                  <g
                    key={pt.key}
                    onMouseEnter={() => setHoveredMonthIndex(idx)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                    className="cursor-pointer"
                  >
                    <circle cx={pt.x} cy={pt.y} r={12} fill="transparent" />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5 : 3.5}
                      fill="var(--surface-lowest)"
                      stroke="var(--accent-primary)"
                      strokeWidth={isHovered ? 2.5 : 2}
                    />
                    <text
                      x={pt.x}
                      y={svgCurve.height - 4}
                      textAnchor="middle"
                      className={`text-[11px] font-mono ${isHovered ? "fill-[var(--accent-primary)] font-bold" : "fill-[var(--on-surface-subtle)]"
                        }`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {hoveredMonthIndex !== null && svgCurve.points[hoveredMonthIndex] && (
              <div
                className="absolute top-2 z-20 pointer-events-none p-2.5 rounded-lg bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl text-xs font-sans"
                style={{
                  left: `${Math.min(
                    Math.max(svgCurve.points[hoveredMonthIndex].x / (svgCurve.width / 100), 10),
                    82
                  )}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-bold text-[var(--on-surface)] mb-1 font-display">
                  {svgCurve.points[hoveredMonthIndex].full} (BY {selectedYear})
                </div>
                <div className="space-y-0.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-4 text-[var(--on-surface-muted)]">
                    <span>Marketing Inflow:</span>
                    <span className="font-bold text-[var(--on-surface)] tabular-nums">
                      {svgCurve.points[hoveredMonthIndex].inflow}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                    <span>On-Time:</span>
                    <span className="font-bold tabular-nums">
                      {svgCurve.points[hoveredMonthIndex].onTime}
                    </span>
                  </div>
                  {svgCurve.points[hoveredMonthIndex].delayed > 0 && (
                    <div className="flex items-center justify-between gap-4 text-rose-600 dark:text-rose-400">
                      <span>Delayed:</span>
                      <span className="font-bold tabular-nums">
                        {svgCurve.points[hoveredMonthIndex].delayed}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Expandable Monthly Numbers */}
          {showMonthlyTable && (
            <div className="overflow-x-auto pt-2 border-t border-[var(--border-subtle)]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)]">
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-right">Inflow Volume</th>
                    <th className="py-2 px-3 text-right">On-Time</th>
                    <th className="py-2 px-3 text-right">Delayed</th>
                    <th className="py-2 px-3 text-right">SLA Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                  {monthlyTimeline.points.map((m) => (
                    <tr key={m.key} className="hover:bg-[var(--surface-low)]">
                      <td className="py-2 px-3 font-semibold text-[var(--on-surface)]">{m.full}</td>
                      <td className="py-2 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">{m.inflow}</td>
                      <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{m.onTime}</td>
                      <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{m.delayed}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${m.slaRate >= 90 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}>
                          {m.slaRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </section>

        {/* ── 5. MARKETING WORKSTREAMS & CONSOLES DECOMPOSITION ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight">
                Dedicated Marketing Workstreams & Delivery Hubs
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Direct access to physical sampling, feasibility NPD reviews, and seasonal program matrices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* Stream 1: Sampling Requests */}
            <div
              onClick={() => navigate("/sample-requests/sampling")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-low)] text-[var(--accent-primary)] flex items-center justify-center">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)] transition-colors">
                        Physical Sampling Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Notebooks & Boxes</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[var(--surface-low)] text-[var(--on-surface)]">
                    {workstreams.sampling.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Client sample intake, PMT laboratory verification, and physical dispatch tracking.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)]">
                <span className="font-mono tabular-nums">{workstreams.sampling.count} Requests</span>
                <span className="flex items-center gap-0.5">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 2: Feasibility NPD Checks */}
            <div
              onClick={() => navigate("/sample-requests/feasibility")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-purple-400 cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-purple-600 transition-colors">
                        Feasibility NPD Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Technical Feasibility</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                    {workstreams.feasibility.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Technical feasibility evaluations before client commitment and tooling allocation.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-purple-600">
                <span className="font-mono tabular-nums">{workstreams.feasibility.count} NPD Checks</span>
                <span className="flex items-center gap-0.5">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 3: Seasonal Retail Programs */}
            <div
              onClick={() => navigate("/sample-requests/programs")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-indigo-400 cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-indigo-600 transition-colors">
                        Seasonal Programs Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Back to School & Retail</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {workstreams.program.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Catalog product matrices, multi-item program planning, and customer range sign-off.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-indigo-600">
                <span className="font-mono tabular-nums">{workstreams.program.count} Programs</span>
                <span className="flex items-center gap-0.5">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ── 6. TOP CUSTOMER PORTFOLIO CONCENTRATION ── */}
        <section className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-3">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Top Customer Account Portfolios</span>
            </h3>
            <p className="text-xs text-[var(--on-surface-muted)]">
              Marketing accounts with the highest intake volume and delivery SLA health.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)]">
                  <th className="py-2 px-3">Customer Account</th>
                  <th className="py-2 px-3 text-right">Total Requests</th>
                  <th className="py-2 px-3 text-right">In Production</th>
                  <th className="py-2 px-3 text-right">Delayed</th>
                  <th className="py-2 px-3">On-Time Fulfillment Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                {topAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[var(--on-surface-muted)] font-sans">
                      No customer account records found.
                    </td>
                  </tr>
                ) : (
                  topAccounts.map((account) => (
                  <tr key={account.name} className="hover:bg-[var(--surface-low)]">
                    <td className="py-2.5 px-3 font-semibold text-[var(--on-surface)] font-sans">
                      {account.name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">{account.total}</td>
                    <td className="py-2.5 px-3 text-right text-[var(--on-surface-muted)] tabular-nums">{account.active}</td>
                    <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{account.delayed}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 w-36">
                        <div className="flex-1 bg-[var(--surface-low)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${account.onTimeRate}%` }}
                          />
                        </div>
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${account.onTimeRate >= 90 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}>
                          {account.onTimeRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </section>

        {/* ── 7. DETAILED MARKETING WATCHLIST TABLE (VIEW MODE) ── */}
        <section className="rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs overflow-hidden">

          {/* Header with Search and Segmented Filters */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <span>Marketing Request Pipeline Watchlist</span>
                <span className="text-xs font-mono font-normal text-[var(--on-surface-subtle)]">
                  ({filteredWatchlist.length} records shown)
                </span>
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Line-by-line inspection of individual requests created by marketing coordinators.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter SR, Customer, Item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-low)] text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-subtle)] border border-[var(--border-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] w-48 sm:w-56"
                />
              </div>

              {/* Segmented Filter Pills */}
              <div className="inline-flex rounded-lg bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("all")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${watchlistFilter === "all"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)]"
                    }`}
                >
                  All ({telemetry.total})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("drafts")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${watchlistFilter === "drafts"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-amber-600"
                    }`}
                >
                  Drafts ({telemetry.totalDrafts})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("feasibility")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${watchlistFilter === "feasibility"
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-purple-600"
                    }`}
                >
                  Needs Action ({telemetry.totalAwaitingMarketingAction})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("delayed")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${watchlistFilter === "delayed"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-rose-600"
                    }`}
                >
                  Delayed ({telemetry.totalDelayed})
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)] bg-[var(--surface-low)]">
                  <th className="py-2.5 px-4">SR Number</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Product Description</th>
                  <th className="py-2.5 px-3">Creator</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isLoading ? (
                  <TableSkeletonRows rows={6} columns={7} />
                ) : filteredWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center">
                      <EmptyState
                        compact
                        title={
                          viewMode === "specialist"
                            ? `No personal requests for BY ${selectedYear}`
                            : "No matching marketing requests"
                        }
                        description="Try resetting search filters or switching your view scope."
                        onResetFilters={
                          searchTerm || watchlistFilter !== "all"
                            ? () => {
                                setSearchTerm("");
                                setWatchlistFilter("all");
                              }
                            : undefined
                        }
                        resetLabel="Reset Search & Filters"
                      />
                    </td>
                  </tr>
                ) : (
                  filteredWatchlist.slice(0, 10).map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => onInspectRequest(req)}
                      className="hover:bg-[var(--surface-low)] cursor-pointer group transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)]">
                        {req.srNumber || "—"}
                      </td>
                      <td className="py-3 px-3 font-medium text-[var(--on-surface)] truncate max-w-[140px]">
                        {req.customer || "—"}
                      </td>
                      <td className="py-3 px-3 text-[var(--on-surface-muted)] truncate max-w-[200px]">
                        {req.productDescription || "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface-subtle)] truncate max-w-[110px]">
                        {req.createdBy || "Unassigned"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface)] tabular-nums">
                        {req.sampleRequiredDate || "—"}
                      </td>
                      <td className="py-3 px-3">
                        {req._isDraft ? (
                          <StatusPill
                            status="Draft"
                            tone="amber"
                            icon={<FileEdit className="w-3 h-3" />}
                            size="xs"
                          />
                        ) : req._isDelayed ? (
                          <StatusPill
                            status={`+${req._overdueDays}d Late`}
                            tone="danger"
                            icon={<AlertTriangle className="w-3 h-3" />}
                            size="xs"
                          />
                        ) : req._needsMarketingAction ? (
                          <StatusPill
                            status="Needs Decision"
                            tone="purple"
                            icon={<ShieldCheck className="w-3 h-3" />}
                            size="xs"
                          />
                        ) : (
                          <StatusPill
                            status="On-Time"
                            tone="success"
                            icon={<CheckCircle2 className="w-3 h-3" />}
                            size="xs"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <ChevronRight className="w-4 h-4 text-[var(--on-surface-subtle)] group-hover:translate-x-0.5 inline transition-transform" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="p-3.5 px-5 bg-[var(--surface-low)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--on-surface-muted)]">
            <span>Showing top marketing records in executive view mode.</span>
            <button
              type="button"
              onClick={() => navigate("/sample-requests/sampling")}
              className="font-semibold text-[var(--on-surface)] hover:text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Go to Sampling Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </section>

      </main>

    </div>
  );
};

export default MarketingOverviewPage;
