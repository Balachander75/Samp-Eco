import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  Sunrise,
  Sun,
  Moon,
  X,
  Flame,
  LayoutDashboard,
  Boxes,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { MetricRibbonSkeleton } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRequestRequiredDate } from "../sampling/utils/requestTypeUtils";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Authority check: Admin or Team Head has full organization audit view
  const isHeadRole = useMemo(() => {
    if (isAdmin) return true;
    return Boolean(user?.is_team_head);
  }, [isAdmin, user]);

  // Selected Marketing DB user filter when in Head mode (defaults to "all" for full overview)
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");

  // Section navigation state
  const [activeSection, setActiveSection] = useState<string>("mkt-snapshot");

  // Watchlist filtering & search states
  const [watchlistFilter, setWatchlistFilter] = useState<
    "all" | "drafts" | "feasibility" | "delayed" | "ontime"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Time-based greeting with adaptive daylight icon
  const { greetingText, GreetingIcon } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return { greetingText: "Good morning", GreetingIcon: Sunrise };
    }
    if (hour >= 12 && hour < 17) {
      return { greetingText: "Good afternoon", GreetingIcon: Sun };
    }
    return { greetingText: "Good evening", GreetingIcon: Moon };
  }, []);

  const firstName = useMemo(() => {
    if (!user?.name) return "Marketer";
    return user.name.split(" ")[0];
  }, [user?.name]);

  // Determine current user identifier tokens for precise request matching
  const currentUserName = useMemo(() => {
    return (user?.name || "").trim();
  }, [user?.name]);

  const currentUserIdentifier = useMemo(() => {
    return (user?.userid || "").trim();
  }, [user?.userid]);

  // Marketing DB Users loaded from backend API (strictly Marketing team members)
  const [dbUsers, setDbUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    // Strictly load Marketing department users for the Marketing overview
    fetchUsersApi("marketing")
      .then((mktUsers) => {
        if (!isMounted) return;
        const marketingOnly = (mktUsers || []).filter((u) => {
          const team = (u.team || "").toLowerCase().trim();
          const role = (u.role || "").toLowerCase().trim();
          return team === "marketing" || role.includes("marketing");
        });
        setDbUsers(marketingOnly);
      })
      .catch((err) => {
        console.warn("Could not load marketing users:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Keyboard shortcut '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // =========================================================================
  // 1. EXTRACT MARKETING TEAM MEMBERS (100% STRICTLY MARKETING DEPT)
  // =========================================================================
  const teamMembersList = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        userid?: string;
        email?: string;
        role?: string;
        count: number;
        dbUser?: UserItem;
      }
    >();

    // 1. Seed strictly with registered marketing users from DB
    dbUsers.forEach((u) => {
      const displayName = (u.name || u.userid || "").trim();
      if (displayName) {
        map.set(displayName.toLowerCase(), {
          name: displayName,
          userid: u.userid,
          email: u.email,
          role: u.role || u.subRole || "Marketing Coordinator",
          count: 0,
          dbUser: u,
        });
      }
    });

    // 2. Aggregate request counts created by these marketing users
    requests.forEach((r) => {
      const creator = (r.createdBy || r.requestCreatedBy || "").trim();
      if (!creator) return;
      const key = creator.toLowerCase();

      for (const [k, item] of map.entries()) {
        if (k === key || (k.length > 2 && (k.includes(key) || key.includes(k)))) {
          item.count += 1;
          break;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [dbUsers, requests]);

  // =========================================================================
  // 2. DATA FILTERING: ADMIN/LEAD SEES ALL; NORMAL USER SEES ONLY THEIR OWN
  // =========================================================================
  const scopedRequests = useMemo(() => {
    // Standard User: strictly scoped to their own personal requests
    if (!isHeadRole) {
      const meName = currentUserName.toLowerCase();
      const meId = currentUserIdentifier.toLowerCase();

      return requests.filter((r) => {
        if (user?.id && r.createdByUserId && String(r.createdByUserId) === String(user.id)) {
          return true;
        }
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
        if (!creator) return false;

        if (meId && (creator === meId || creator.includes(meId) || meId.includes(creator))) {
          return true;
        }
        if (meName && (creator === meName || creator.includes(meName) || meName.includes(creator))) {
          return true;
        }
        return false;
      });
    }

    // Admin / Team Head: by default sees all marketing requests across all users!
    // If a specific marketing team member is selected in the dropdown or table, filter by that member:
    if (selectedMemberFilter !== "all") {
      const target = selectedMemberFilter.toLowerCase().trim();
      return requests.filter((r) => {
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
        return (
          creator === target ||
          (target.length > 2 && (creator.includes(target) || target.includes(creator)))
        );
      });
    }

    // Default for Admin: all organization requests
    return requests;
  }, [
    requests,
    isHeadRole,
    selectedMemberFilter,
    currentUserName,
    currentUserIdentifier,
    user?.id,
  ]);

  // =========================================================================
  // 3. CORE MARKETING SLA & LIFECYCLE CLASSIFICATION
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

      // Awaiting Marketing Action
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

      const requiredDate = getRequestRequiredDate(r);
      if (requiredDate) {
        const targetDate = new Date(requiredDate);
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
  // 4. TEAM MEMBERS PERFORMANCE AUDIT (FOR ADMIN / HEAD VIEW)
  // =========================================================================
  const memberAuditMatrix = useMemo(() => {
    return teamMembersList.map((member) => {
      const memberReqs = requests.filter((r) => {
        const creator = (r.createdBy || r.requestCreatedBy || "").toLowerCase().trim();
        const memberName = member.name.toLowerCase().trim();
        return (
          creator === memberName ||
          (memberName.length > 2 && (creator.includes(memberName) || memberName.includes(creator)))
        );
      });

      const total = memberReqs.length;
      const delayed = memberReqs.filter((r) => {
        const requiredDate = getRequestRequiredDate(r);
        if (!requiredDate) return false;
        const d = new Date(requiredDate);
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
        userid: member.userid,
        role: member.role,
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
  // 6. 12-MONTH INFLOW TIMELINE (CATMULL-ROM SPLINE + EXPANDABLE TABLE)
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
    const height = 180;
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

    const firstPt = dataPoints[0];
    const lastPt = dataPoints[dataPoints.length - 1];
    const baselineY = height - paddingY;
    const area = `${d} L ${lastPt.x.toFixed(1)} ${baselineY} L ${firstPt.x.toFixed(1)} ${baselineY} Z`;

    return {
      linePath: d,
      areaPath: area,
      points: dataPoints,
      width,
      height,
    };
  }, [monthlyTimeline]);

  // =========================================================================
  // 7. TOP CUSTOMER ACCOUNTS (PORTFOLIO CONCENTRATION)
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
  // 8. WATCHLIST FILTERING & SEARCH
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
          String(r.requestCode || "").toLowerCase().includes(q) ||
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

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const SECTIONS = useMemo(() => {
    const list = [
      { id: "mkt-snapshot", label: "Snapshot", icon: LayoutDashboard },
      { id: "mkt-workstreams", label: "Workstreams", icon: Boxes },
      { id: "mkt-trends", label: "Intake Trends", icon: TrendingUp },
    ];
    if (isHeadRole) {
      list.push({ id: "mkt-team-audit", label: "Team Audit", icon: Users });
    }
    list.push(
      { id: "mkt-accounts", label: "Accounts", icon: Building2 },
      { id: "mkt-watchlist", label: "Watchlist", icon: Flame }
    );
    return list;
  }, [isHeadRole]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] font-sans select-text overflow-y-auto">

      {/* ── 1. SOLID EXECUTIVE GREETING & COMMAND HEADER ── */}
      <header className="px-4 sm:px-6 lg:px-8 py-3.5 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] shrink-0 transition-colors">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">

          {/* Left: Dynamic Daylight Greeting with Role & Scope Badge */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] shadow-2xs">
                <GreetingIcon className="w-3.5 h-3.5" />
              </span>
              <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight text-[var(--on-surface)] flex items-center gap-2">
                <span>{greetingText}, {firstName}!</span>
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--on-surface-muted)]">
              {/* Role badge */}
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--on-surface)]">
                {isHeadRole ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Marketing Department Overview · All Team Inflow</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>My Marketing Portfolio · Personal Inflow</span>
                  </>
                )}
              </span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="font-mono text-[11px] text-[var(--on-surface-subtle)]">
                Business Year {selectedYear}
              </span>
              {selectedMemberFilter !== "all" && (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] border border-[var(--accent-primary)]/30">
                    Scoped to: {selectedMemberFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedMemberFilter("all")}
                      className="ml-1 hover:opacity-75 cursor-pointer"
                      title="Clear scope"
                    >
                      ×
                    </button>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right: Marketing Member Filter Dropdown & Fast Actions */}
          <div className="flex flex-wrap items-center gap-2.5">

            {/* In Admin/Head View: Direct Marketing DB User Dropdown Selector */}
            {isHeadRole && (
              <div className="relative">
                <select
                  aria-label="Filter overview by marketing member"
                  value={selectedMemberFilter}
                  onChange={(e) => setSelectedMemberFilter(e.target.value)}
                  className="h-9 pl-3 pr-8 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] text-xs font-semibold cursor-pointer shadow-2xs outline-none focus:border-[var(--accent-primary)] transition-all font-sans"
                >
                  <option value="all">👥 All Marketing Members ({teamMembersList.length})</option>
                  {teamMembersList.map((m) => (
                    <option key={m.name} value={m.name}>
                      👤 {m.name} ({m.count} reqs)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input with Hotkey Kbd */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-40 sm:w-52 pl-8 pr-7 text-xs rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] focus:bg-[var(--surface-lowest)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] text-[var(--on-surface)] placeholder-[var(--on-surface-subtle)] outline-none transition-all shadow-2xs font-sans"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--surface-high)] text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-[var(--on-surface-subtle)] bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded shadow-2xs">
                  /
                </kbd>
              )}
            </div>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={onExportCSV}
              className="h-9 px-3 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-[0.985]"
              title="Export current view to CSV"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

        </div>
      </header>

      {/* ── STICKY SECTION NAVIGATOR (PILL BAR) ── */}
      <nav
        aria-label="Marketing overview sections"
        className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2 transition-all shadow-xs"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const isWatchlist = section.id === "mkt-watchlist";
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${
                    isActive
                      ? "bg-[var(--surface-container)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--border-strong)]"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] border border-transparent font-medium"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive ? "text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"
                    }`}
                  />
                  <span>{section.label}</span>
                  {isWatchlist && telemetry.totalDelayed > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white shadow-2xs">
                      {telemetry.totalDelayed}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick jump to delayed watchlist */}
          {telemetry.totalDelayed > 0 && (
            <button
              type="button"
              onClick={() => {
                setWatchlistFilter("delayed");
                scrollToSection("mkt-watchlist");
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{telemetry.totalDelayed} Overdue</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── MAIN DASHBOARD BODY ── */}
      <main className="w-full flex-1 p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── 2. EXECUTIVE MULTI-FACTOR KPI STRIP ── */}
        {isLoading ? (
          <div id="mkt-snapshot" className="scroll-mt-16">
            <MetricRibbonSkeleton count={6} />
          </div>
        ) : (
          <section id="mkt-snapshot" className="scroll-mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

          {/* Tile 1: Intake Volume */}
          <div
            onClick={() => {
              setWatchlistFilter("all");
              scrollToSection("mkt-watchlist");
            }}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                {isHeadRole ? "Total Inflow" : "My Intake"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-low)] group-hover:bg-[var(--accent-primary-subtle)] text-[var(--on-surface-muted)] group-hover:text-[var(--accent-primary-strong)] flex items-center justify-center transition-colors">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.total.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>
                {isHeadRole
                  ? selectedMemberFilter !== "all"
                    ? `Scoped: ${selectedMemberFilter}`
                    : `${teamMembersList.length} coordinators`
                  : "Raised by you"}
              </span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 2: Delivery Fulfillment SLA */}
          <div
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Fulfillment SLA
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums flex items-baseline gap-1.5">
              <span>{isLoading ? "—" : `${telemetry.onTimeRate}%`}</span>
              <span className={`w-2 h-2 rounded-full inline-block mb-1 ${telemetry.onTimeRate >= 80 ? "bg-emerald-500" : "bg-amber-500"}`} />
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {telemetry.totalOnTime.toLocaleString()} on-track tasks
            </div>
          </div>

          {/* Tile 3: Breached / Overdue SLA */}
          <div
            onClick={() => {
              setWatchlistFilter("delayed");
              scrollToSection("mkt-watchlist");
            }}
            className={`group p-4 rounded-xl bg-[var(--surface-lowest)] border hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 ${
              telemetry.totalDelayed > 0
                ? "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/[0.02]"
                : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                telemetry.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--on-surface-subtle)]"
              }`}>
                Overdue Tasks
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                telemetry.totalDelayed > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-display font-bold tracking-tight tabular-nums ${
              telemetry.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--on-surface)]"
            }`}>
              {isLoading ? "—" : telemetry.totalDelayed}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              {telemetry.totalDelayed > 0 ? "SLA past target date" : "100% on schedule"}
            </div>
          </div>

          {/* Tile 4: Pending Drafts */}
          <div
            onClick={() => {
              setWatchlistFilter("drafts");
              scrollToSection("mkt-watchlist");
            }}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-amber-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Pending Drafts
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-colors">
                <FileEdit className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {isLoading ? "—" : telemetry.totalDrafts}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Awaiting release
            </div>
          </div>

          {/* Tile 5: In Production Fabrication */}
          <div
            onClick={() => navigate("/sample-requests/sampling")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-blue-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                In Production
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors">
                <Hourglass className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalInProduction}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Active in sampling/studio
            </div>
          </div>

          {/* Tile 6: Dispatched / Won Deals */}
          <div
            onClick={() => navigate("/sample-requests/sampling")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Dispatched / Won
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors">
                <Send className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalCompleted}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Delivered to client
            </div>
          </div>

        </section>
        )}

        {/* ── 3. WORKSTREAMS & DESKS ── */}
        <section id="mkt-workstreams" className="scroll-mt-16 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Dedicated Marketing Workstreams & Delivery Hubs</span>
              </h2>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Direct access to physical sampling, feasibility NPD reviews, and seasonal catalog program matrices.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* Stream 1: Physical Sampling */}
            <div
              onClick={() => navigate("/sample-requests/sampling")}
              className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-low)] text-[var(--accent-primary)] flex items-center justify-center">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)] transition-colors">
                        Physical Sampling Desk
                      </h3>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Notebooks & Boxes</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-[var(--surface-low)] text-[var(--on-surface)]">
                    {workstreams.sampling.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Client sample intake, PMT technical verification, and physical dispatch tracking.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)]">
                <span className="font-mono tabular-nums">{workstreams.sampling.count} Requests</span>
                <span className="flex items-center gap-1">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 2: Feasibility NPD */}
            <div
              onClick={() => navigate("/sample-requests/feasibility")}
              className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-purple-400 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Feasibility NPD Desk
                      </h3>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Technical Feasibility</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                    {workstreams.feasibility.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Technical feasibility evaluations before client commitment and tooling allocation.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400">
                <span className="font-mono tabular-nums">{workstreams.feasibility.count} NPD Checks</span>
                <span className="flex items-center gap-1">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 3: Seasonal Retail Programs */}
            <div
              onClick={() => navigate("/sample-requests/programs")}
              className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-indigo-400 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        Seasonal Programs Desk
                      </h3>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Back to School & Retail</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                    {workstreams.program.pct}%
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                  Catalog product matrices, multi-item program planning, and customer range sign-off.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                <span className="font-mono tabular-nums">{workstreams.program.count} Programs</span>
                <span className="flex items-center gap-1">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

          </div>
        </section>

        {/* ── 4. ANNUAL MARKETING INFLOW SPLINE CURVE & MONTHLY TABLE ── */}
        <section id="mkt-trends" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Marketing Request Intake Curve & Delivery Trajectory
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] text-[10px] font-mono font-bold">
                  BY {selectedYear}
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Trajectory of requests raised progressing into sampling review and physical delivery.
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
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{showMonthlyTable ? "Hide Matrix" : "View Numbers"}</span>
              </button>
            </div>
          </div>

          {/* Solid SVG Spline Curve */}
          <div className="relative w-full overflow-hidden pt-1">
            <svg
              viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
              className="w-full h-36 sm:h-44 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="mktCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
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
                    <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="var(--surface-lowest)"
                      stroke="var(--accent-primary)"
                      strokeWidth={isHovered ? 2.5 : 2}
                    />
                    <text
                      x={pt.x}
                      y={svgCurve.height - 4}
                      textAnchor="middle"
                      className={`text-[11px] font-mono ${
                        isHovered ? "fill-[var(--accent-primary)] font-bold" : "fill-[var(--on-surface-subtle)]"
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
                className="absolute top-2 z-20 pointer-events-none p-3 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl text-xs font-sans backdrop-blur-md"
                style={{
                  left: `${Math.min(
                    Math.max(svgCurve.points[hoveredMonthIndex].x / (svgCurve.width / 100), 12),
                    82
                  )}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-bold text-[var(--on-surface)] mb-1.5 font-display flex items-center justify-between gap-3">
                  <span>{svgCurve.points[hoveredMonthIndex].full}</span>
                  <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">BY {selectedYear}</span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-4 text-[var(--on-surface-muted)]">
                    <span>Intake:</span>
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
                    <tr key={m.key} className="hover:bg-[var(--surface-low)] transition-colors">
                      <td className="py-2 px-3 font-semibold text-[var(--on-surface)]">{m.full}</td>
                      <td className="py-2 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">{m.inflow}</td>
                      <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{m.onTime}</td>
                      <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{m.delayed}</td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            m.slaRate >= 90
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
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

        {/* ── 5. ADMIN EXCLUSIVE: TEAM MEMBERS PERFORMANCE & OWNERSHIP AUDIT MATRIX ── */}
        {isHeadRole && (
          <section
            id="mkt-team-audit"
            className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Marketing Team Members Performance & Request Ownership</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                    {memberAuditMatrix.length} Members
                  </span>
                </h2>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Audit showing request volume, active pipeline, drafts, and delivery SLA for each marketing coordinator.
                </p>
              </div>

              {selectedMemberFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedMemberFilter("all")}
                  className="px-3 py-1 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-xs text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium cursor-pointer transition-all active:scale-95"
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
                    <th className="py-2.5 px-3 text-right">In Production</th>
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
                          className={`hover:bg-[var(--surface-low)] transition-colors ${
                            isSelected ? "bg-[var(--accent-primary-subtle)]/35" : ""
                          }`}
                        >
                          <td className="py-3 px-3 font-semibold text-[var(--on-surface)] flex items-center gap-2.5 font-sans">
                            <span className="w-7 h-7 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] font-bold text-xs flex items-center justify-center text-[var(--accent-primary)] shadow-2xs">
                              {member.name[0]?.toUpperCase()}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{member.name}</span>
                                {member.isCurrentUser && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[var(--surface-container)] text-[var(--accent-primary-strong)] font-mono font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                              {member.role && (
                                <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono block">
                                  {member.role}
                                </span>
                              )}
                            </div>
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
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    member.slaRate >= 90
                                      ? "bg-emerald-500"
                                      : member.slaRate >= 75
                                      ? "bg-amber-500"
                                      : "bg-rose-500"
                                  }`}
                                  style={{ width: `${member.slaRate}%` }}
                                />
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                  member.slaRate >= 90
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
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold border cursor-pointer transition-all active:scale-95 shadow-2xs ${
                                isSelected
                                  ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
                                  : "bg-[var(--surface-low)] text-[var(--on-surface)] border-[var(--border-subtle)] hover:bg-[var(--surface-container)]"
                              }`}
                            >
                              {isSelected ? "Scoped ✓" : "Scope"}
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

        {/* ── 6. TOP CUSTOMER PORTFOLIO CONCENTRATION ── */}
        <section id="mkt-accounts" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-3">
          <div>
            <h2 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Top Customer Account Portfolios</span>
            </h2>
            <p className="text-xs text-[var(--on-surface-muted)]">
              Key client accounts with the highest request volume and fulfillment health.
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
                    <tr key={account.name} className="hover:bg-[var(--surface-low)] transition-colors">
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
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${account.onTimeRate}%` }}
                            />
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              account.onTimeRate >= 90
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            }`}
                          >
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

        {/* ── 7. DETAILED MARKETING WATCHLIST TABLE ── */}
        <section id="mkt-watchlist" className="scroll-mt-16 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs overflow-hidden">

          {/* Table Header with Live Search & Segmented Filter Pills */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <span>Marketing Request Pipeline Watchlist</span>
                <span className="text-xs font-mono font-normal text-[var(--on-surface-subtle)]">
                  ({filteredWatchlist.length} records shown)
                </span>
              </h2>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Line-by-line inspection of individual requests with real-time status and SLA tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented Filter Pills */}
              <div className="inline-flex rounded-xl bg-[var(--surface-low)] p-1 border border-[var(--border-subtle)] text-xs font-medium shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("all")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 ${
                    watchlistFilter === "all"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--border-strong)]"
                      : "text-[var(--on-surface-muted)] border border-transparent"
                  }`}
                >
                  All ({telemetry.total})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("drafts")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 ${
                    watchlistFilter === "drafts"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold shadow-2xs border border-amber-300/50"
                      : "text-[var(--on-surface-muted)] hover:text-amber-600 border border-transparent"
                  }`}
                >
                  Drafts ({telemetry.totalDrafts})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("feasibility")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 ${
                    watchlistFilter === "feasibility"
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold shadow-2xs border border-purple-300/50"
                      : "text-[var(--on-surface-muted)] hover:text-purple-600 border border-transparent"
                  }`}
                >
                  Needs Action ({telemetry.totalAwaitingMarketingAction})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("delayed")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95 ${
                    watchlistFilter === "delayed"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold shadow-2xs border border-rose-300/50"
                      : "text-[var(--on-surface-muted)] hover:text-rose-600 border border-transparent"
                  }`}
                >
                  Delayed ({telemetry.totalDelayed})
                </button>
              </div>
            </div>
          </div>

          {/* Watchlist Table Body */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)] bg-[var(--surface-low)]">
                  <th className="py-2.5 px-4">Request Code</th>
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
                          !isHeadRole
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
                  filteredWatchlist.slice(0, 15).map((req) => (
                    <tr
                      key={req.id}
                      onClick={() => onInspectRequest(req)}
                      className="hover:bg-[var(--surface-low)] cursor-pointer group transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)]">
                        {req.requestCode || req.srNumber || `SR-${req.id}`}
                      </td>
                      <td className="py-3 px-3 font-medium text-[var(--on-surface)] truncate max-w-[140px]">
                        {req.customer || "—"}
                      </td>
                      <td className="py-3 px-3 text-[var(--on-surface-muted)] truncate max-w-[200px]">
                        {req.productDescription || "—"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-low)] text-[var(--on-surface-muted)] text-[11px] font-mono">
                          <User className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span className="truncate max-w-[90px]">{req.createdBy || "Unassigned"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface)] tabular-nums">
                        {getRequestRequiredDate(req) || "—"}
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
                        <ChevronRight className="w-4 h-4 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 inline transition-all" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note & Quick Routing */}
          <div className="p-3.5 px-5 bg-[var(--surface-low)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--on-surface-muted)]">
            <span>
              Showing {Math.min(15, filteredWatchlist.length)} of {filteredWatchlist.length} records in pipeline.
            </span>
            <button
              type="button"
              onClick={() => navigate("/sample-requests/sampling")}
              className="font-semibold text-[var(--on-surface)] hover:text-[var(--accent-primary)] flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95"
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
