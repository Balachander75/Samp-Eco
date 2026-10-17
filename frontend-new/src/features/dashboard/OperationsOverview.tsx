import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAllMarketingRequestsApi,
  fetchCreativeBriefsApi,
  fetchStudioDielinesApi,
  fetchCostingEstimationsApi,
} from "@/infrastructure/api";
import { SampleRequestItem } from "@/features/sample-requests/types";
import { UserProfile } from "@/features/auth";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { isDesignRequest } from "@/features/sample-requests/utils/trackTypes";
import {
  TrendingUp,
  Clock,
  Layers,
  Palette,
  Box,
  Boxes,
  FlaskConical,
  Calculator,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  ExternalLink,
  Zap,
  BarChart3,
  Hourglass,
  Building2,
  Package,
  LayoutDashboard,
  Users,
  ShieldAlert,
  Flame,
  Sunrise,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { EmptyState } from "@/components/ui/EmptyState";

export interface OperationsOverviewProps {
  user?: UserProfile;
  embedded?: boolean;
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

const TEAM_SERIES = [
  { key: "marketing", label: "Marketing", barClass: "bg-blue-500", dotClass: "bg-blue-500" },
  { key: "creative", label: "Creative", barClass: "bg-purple-500", dotClass: "bg-purple-500" },
  { key: "studio", label: "Studio", barClass: "bg-indigo-500", dotClass: "bg-indigo-500" },
  { key: "samp", label: "SAMP", barClass: "bg-teal-500", dotClass: "bg-teal-500" },
  { key: "costing", label: "Costing", barClass: "bg-amber-500", dotClass: "bg-amber-500" },
] as const;

type TeamSeriesKey = (typeof TEAM_SERIES)[number]["key"];
type TeamMix = Record<TeamSeriesKey, number>;

const emptyTeamMix = (): TeamMix => ({
  marketing: 0,
  creative: 0,
  studio: 0,
  samp: 0,
  costing: 0,
});

const OVERVIEW_SECTIONS = [
  { id: "ops-snapshot", label: "Snapshot", icon: LayoutDashboard },
  { id: "ops-pipeline", label: "Pipeline", icon: Layers },
  { id: "ops-trends", label: "Trends", icon: TrendingUp },
  { id: "ops-portfolio", label: "Portfolio", icon: BarChart3 },
  { id: "ops-teams", label: "Teams", icon: Users },
  { id: "ops-risks", label: "Risks & clients", icon: ShieldAlert },
  { id: "ops-categories", label: "Product mix", icon: Boxes },
  { id: "ops-watchlist", label: "Watchlist", icon: Flame },
];

export const OperationsOverview: React.FC<OperationsOverviewProps> = ({ user, embedded: _embedded = true }) => {
  const navigate = useNavigate();
  const { selectedYear } = useBusinessYear();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>("ops-snapshot");

  const [requests, setRequests] = useState<SampleRequestItem[]>([]);
  const [briefsCount, setBriefsCount] = useState<number>(0);
  const [dielinesCount, setDielinesCount] = useState<number>(0);
  const [costingsCount, setCostingsCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);
  const [trendMode, setTrendMode] = useState<"intake" | "teams">("intake");

  // View Mode Filters
  const [watchlistFilter, setWatchlistFilter] = useState<
    "all" | "delayed" | "urgent" | "ontime" | "samp" | "creative" | "costing"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showMonthlyTable, setShowMonthlyTable] = useState<boolean>(false);

  // Smooth scroll handler with active section update
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Scroll spy to update active section as user scrolls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollPos = container.scrollTop + 160;
      for (let i = OVERVIEW_SECTIONS.length - 1; i >= 0; i--) {
        const sec = document.getElementById(OVERVIEW_SECTIONS[i].id);
        if (sec && sec.offsetTop <= scrollPos) {
          setActiveSection(OVERVIEW_SECTIONS[i].id);
          break;
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

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
    if (!user?.name) return "Executive";
    return user.name.split(" ")[0];
  }, [user?.name]);

  // Load telemetry data from database APIs
  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [requestsData, briefsData, dielinesData, costingsData] = await Promise.all([
        fetchAllMarketingRequestsApi(selectedYear).catch(() => []),
        fetchCreativeBriefsApi().catch(() => []),
        fetchStudioDielinesApi().catch(() => []),
        fetchCostingEstimationsApi().catch(() => []),
      ]);
      setRequests(requestsData);
      setBriefsCount(briefsData.length);
      setDielinesCount(dielinesData.length);
      setCostingsCount(costingsData.length);
      const now = new Date();
      setLastRefreshed(
        now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      );
    } catch (err) {
      console.error("Operations telemetry sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Synchronize on focus or refresh event
  useEffect(() => {
    const handleRefresh = (e: Event) => {
      e.preventDefault();
      void loadData();
    };
    window.addEventListener("app:refresh-requested", handleRefresh);
    return () => window.removeEventListener("app:refresh-requested", handleRefresh);
  }, [loadData]);

  // =========================================================================
  // 1. SLA, AGING & DELAY COMPUTATION
  // =========================================================================
  const slaMetrics = useMemo(() => {
    const now = new Date();
    let totalCompleted = 0;
    let totalOnTime = 0;
    let totalDelayed = 0;
    let urgentCount = 0;

    // Aging Buckets
    let age0to3 = 0;
    let age4to7 = 0;
    let age8to14 = 0;
    let age15Plus = 0;

    // Delay Severity
    let delay1to3d = 0;
    let delay4to7d = 0;
    let delay7Plus = 0;

    const classified = requests.map((r) => {
      const statusStr = String(r.status || "").toLowerCase();
      const isClosed =
        statusStr.includes("dispatch") ||
        statusStr.includes("deal") ||
        statusStr.includes("closed") ||
        statusStr.includes("approved");

      let isDelayed = false;
      let isUrgent = false;
      let overdueDays = 0;

      // Age calculation
      const createdDate = new Date(r.dateRequestCreated || r.createdAt || Date.now());
      const ageDays = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 86400000));

      if (!isClosed) {
        if (ageDays <= 3) age0to3++;
        else if (ageDays <= 7) age4to7++;
        else if (ageDays <= 14) age8to14++;
        else age15Plus++;
      }

      // Target SLA calculation
      if (r.sampleRequiredDate) {
        const targetDate = new Date(r.sampleRequiredDate);
        if (!isNaN(targetDate.getTime())) {
          if (!isClosed && targetDate < now) {
            isDelayed = true;
            overdueDays = Math.max(1, Math.floor((now.getTime() - targetDate.getTime()) / 86400000));
            if (overdueDays <= 3) delay1to3d++;
            else if (overdueDays <= 7) delay4to7d++;
            else delay7Plus++;
          } else if (!isClosed) {
            const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
            if (diffDays <= 3) {
              isUrgent = true;
            }
          }
        }
      }

      if (isDelayed) totalDelayed++;
      else totalOnTime++;

      if (isClosed) totalCompleted++;
      if (isUrgent) urgentCount++;

      // Department Stage Resolution
      let departmentKey = "marketing";
      if (statusStr.includes("creative") || isDesignRequest(r)) departmentKey = "creative";
      else if (statusStr.includes("studio") || r.mockupRequired === "yes") departmentKey = "studio";
      else if (statusStr.includes("cost")) departmentKey = "costing";
      else if (statusStr.includes("samp") || statusStr.includes("pmt") || statusStr.includes("qc"))
        departmentKey = "samp";

      return {
        ...r,
        _ageDays: ageDays,
        _isDelayed: isDelayed,
        _overdueDays: overdueDays,
        _isUrgent: isUrgent,
        _isClosed: isClosed,
        _departmentKey: departmentKey,
      };
    });

    const total = requests.length;
    const onTimeRate = total > 0 ? Math.round((totalOnTime / total) * 100) : 100;
    const inFlightCount = Math.max(0, total - totalCompleted);

    return {
      total,
      totalCompleted,
      inFlightCount,
      totalOnTime,
      totalDelayed,
      urgentCount,
      onTimeRate,
      aging: { age0to3, age4to7, age8to14, age15Plus },
      delaySeverity: { delay1to3d, delay4to7d, delay7Plus },
      classified,
    };
  }, [requests]);

  // =========================================================================
  // 2. LIFECYCLE FUNNEL DISTRIBUTION (VIEW MODE PIPELINE GAUGE)
  // =========================================================================
  const lifecycleFunnel = useMemo(() => {
    let draftCount = 0;
    let creativeCount = 0;
    let studioCount = 0;
    let sampCount = 0;
    let costingCount = 0;
    let dispatchedCount = 0;

    slaMetrics.classified.forEach((r) => {
      const s = String(r.status || "").toLowerCase();
      if (r._isClosed) {
        dispatchedCount++;
      } else if (s.includes("draft") || s.includes("smt") || s.includes("intake")) {
        draftCount++;
      } else if (r._departmentKey === "creative") {
        creativeCount++;
      } else if (r._departmentKey === "studio") {
        studioCount++;
      } else if (r._departmentKey === "costing") {
        costingCount++;
      } else {
        sampCount++;
      }
    });

    const total = requests.length || 1;
    return {
      draft: { count: draftCount, pct: Math.round((draftCount / total) * 100) },
      creative: { count: creativeCount, pct: Math.round((creativeCount / total) * 100) },
      studio: { count: studioCount, pct: Math.round((studioCount / total) * 100) },
      samp: { count: sampCount, pct: Math.round((sampCount / total) * 100) },
      costing: { count: costingCount, pct: Math.round((costingCount / total) * 100) },
      dispatched: { count: dispatchedCount, pct: Math.round((dispatchedCount / total) * 100) },
    };
  }, [slaMetrics.classified, requests.length]);

  // =========================================================================
  // 3. MARKETING DECOMPOSITION & CHANNELS
  // =========================================================================
  const marketingDecomposition = useMemo(() => {
    const total = requests.length;

    const designRequests = requests.filter(
      (r) =>
        isDesignRequest(r) ||
        r.requestKind === "design" ||
        Number(r.numberOfDesigns || 0) > 0 ||
        (r.requestTypes || []).includes("design")
    );

    const mockupRequests = requests.filter(
      (r) =>
        r.mockupRequired === "yes" ||
        r.mockupRequired === "true" ||
        Boolean(r.mockupWorkflowState) ||
        (r.requestTypes || []).includes("mockup")
    );

    const samplingRequests = requests.filter(
      (r) =>
        (!isDesignRequest(r) && r.requestKind !== "feasibility") ||
        (r.requestTypes || []).includes("sample") ||
        Number(r.qtyForSampling || 0) > 0 ||
        r.creationMode === "binding" ||
        r.creationMode === "material_code"
    );

    const costingRequests = requests.filter(
      (r) =>
        Boolean(r.costingRequiredDate) ||
        Number(r.qtyDesignCosting || 0) > 0 ||
        (r.requestTypes || []).includes("costing")
    );

    const designCount = Math.max(designRequests.length, briefsCount);
    const mockupCount = Math.max(mockupRequests.length, dielinesCount);
    const samplingCount = samplingRequests.length;
    const costingCount = Math.max(costingRequests.length, costingsCount);

    const sumCategories = designCount + mockupCount + samplingCount + costingCount || 1;

    // Intake Channels
    let materialCodeCount = 0;
    let bindingCount = 0;
    let feasibilityCount = 0;
    let programCount = 0;

    requests.forEach((r) => {
      const mode = String(r.creationMode || "").toLowerCase();
      const kind = String(r.requestKind || "").toLowerCase();
      if (mode === "feasibility_check" || kind === "feasibility") feasibilityCount++;
      else if (mode === "program_planning" || kind === "program") programCount++;
      else if (mode === "binding") bindingCount++;
      else materialCodeCount++;
    });

    return {
      total,
      design: { count: designCount, pct: Math.round((designCount / sumCategories) * 100) },
      mockup: { count: mockupCount, pct: Math.round((mockupCount / sumCategories) * 100) },
      sampling: { count: samplingCount, pct: Math.round((samplingCount / sumCategories) * 100) },
      costing: { count: costingCount, pct: Math.round((costingCount / sumCategories) * 100) },
      channels: {
        materialCodeCount,
        bindingCount,
        feasibilityCount,
        programCount,
        materialPct: Math.round((materialCodeCount / (total || 1)) * 100),
        bindingPct: Math.round((bindingCount / (total || 1)) * 100),
        feasibilityPct: Math.round((feasibilityCount / (total || 1)) * 100),
        programPct: Math.round((programCount / (total || 1)) * 100),
      },
    };
  }, [requests, briefsCount, dielinesCount, costingsCount]);

  // =========================================================================
  // 4. DEPARTMENTAL COMPARATIVE HEALTH MATRIX (EXCLUDING PLANT)
  // =========================================================================
  const departmentHealth = useMemo(() => {
    const totalRequests = requests.length || 1;

    // 1. Marketing Team
    const mktTotal = requests.length;
    const mktDelayed = slaMetrics.classified.filter(
      (r) => r._departmentKey === "marketing" && r._isDelayed
    ).length;
    const mktActive = slaMetrics.classified.filter(
      (r) => r._departmentKey === "marketing" && !r._isClosed
    ).length;
    const mktOnTime = Math.max(0, mktTotal - mktDelayed);
    const mktSla = mktTotal > 0 ? Math.round((mktOnTime / mktTotal) * 100) : 100;

    // 2. Creative Studio
    const crTotal = Math.max(briefsCount, marketingDecomposition.design.count);
    const crDelayed = slaMetrics.classified.filter(
      (r) => r._departmentKey === "creative" && r._isDelayed
    ).length;
    const crActive = slaMetrics.classified.filter(
      (r) => r._departmentKey === "creative" && !r._isClosed
    ).length;
    const crOnTime = Math.max(0, crTotal - crDelayed);
    const crSla = crTotal > 0 ? Math.round((crOnTime / crTotal) * 100) : 100;

    // 3. Structural CAD
    const stTotal = Math.max(dielinesCount, marketingDecomposition.mockup.count);
    const stDelayed = slaMetrics.classified.filter(
      (r) => r._departmentKey === "studio" && r._isDelayed
    ).length;
    const stActive = slaMetrics.classified.filter(
      (r) => r._departmentKey === "studio" && !r._isClosed
    ).length;
    const stOnTime = Math.max(0, stTotal - stDelayed);
    const stSla = stTotal > 0 ? Math.round((stOnTime / stTotal) * 100) : 100;

    // 4. SAMP Lab
    const smTotal = marketingDecomposition.sampling.count;
    const smDelayed = slaMetrics.classified.filter(
      (r) => r._departmentKey === "samp" && r._isDelayed
    ).length;
    const smActive = slaMetrics.classified.filter(
      (r) => r._departmentKey === "samp" && !r._isClosed
    ).length;
    const smOnTime = Math.max(0, smTotal - smDelayed);
    const smSla = smTotal > 0 ? Math.round((smOnTime / smTotal) * 100) : 100;

    // 5. Costing Team
    const coTotal = Math.max(costingsCount, marketingDecomposition.costing.count);
    const coDelayed = slaMetrics.classified.filter(
      (r) => r._departmentKey === "costing" && r._isDelayed
    ).length;
    const coActive = slaMetrics.classified.filter(
      (r) => r._departmentKey === "costing" && !r._isClosed
    ).length;
    const coOnTime = Math.max(0, coTotal - coDelayed);
    const coSla = coTotal > 0 ? Math.round((coOnTime / coTotal) * 100) : 100;

    return [
      {
        id: "marketing",
        name: "Marketing Intake",
        scope: "Client Accounts & Intake",
        icon: Layers,
        route: "/sample-requests",
        total: mktTotal,
        active: mktActive,
        delayed: mktDelayed,
        onTime: mktOnTime,
        slaRate: mktSla,
        sharePct: Math.round((mktTotal / totalRequests) * 100),
        statusTone:
          mktSla >= 90
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            : "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
      },
      {
        id: "creative",
        name: "Creative Studio",
        scope: "Artwork & Prepress Proofs",
        icon: Palette,
        route: "/creative-work",
        total: crTotal,
        active: crActive,
        delayed: crDelayed,
        onTime: crOnTime,
        slaRate: crSla,
        sharePct: Math.round((crTotal / totalRequests) * 100),
        statusTone:
          crSla >= 90
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            : crSla >= 75
              ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40"
              : "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
      },
      {
        id: "studio",
        name: "Structural CAD",
        scope: "Dielines & 3D Packaging",
        icon: Box,
        route: "/studio-work",
        total: stTotal,
        active: stActive,
        delayed: stDelayed,
        onTime: stOnTime,
        slaRate: stSla,
        sharePct: Math.round((stTotal / totalRequests) * 100),
        statusTone:
          stSla >= 90
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            : "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
      },
      {
        id: "samp",
        name: "SAMP Lab",
        scope: "Physical Fabrication & QC",
        icon: FlaskConical,
        route: "/samp-team-work",
        total: smTotal,
        active: smActive,
        delayed: smDelayed,
        onTime: smOnTime,
        slaRate: smSla,
        sharePct: Math.round((smTotal / totalRequests) * 100),
        statusTone:
          smSla >= 90
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            : smSla >= 75
              ? "text-amber-600 bg-amber-50 dark:bg-amber-950/40"
              : "text-rose-600 bg-rose-50 dark:bg-rose-950/40",
      },
      {
        id: "costing",
        name: "Costing & BOM",
        scope: "Commercial Pricing & Margin",
        icon: Calculator,
        route: "/costing-team",
        total: coTotal,
        active: coActive,
        delayed: coDelayed,
        onTime: coOnTime,
        slaRate: coSla,
        sharePct: Math.round((coTotal / totalRequests) * 100),
        statusTone:
          coSla >= 90
            ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
            : "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
      },
    ];
  }, [
    requests,
    briefsCount,
    dielinesCount,
    costingsCount,
    marketingDecomposition,
    slaMetrics.classified,
  ]);

  // =========================================================================
  // 5. TOP CUSTOMER ACCOUNTS CONCENTRATION (PORTFOLIO HEALTH)
  // =========================================================================
  const topCustomers = useMemo(() => {
    const map: Record<
      string,
      { total: number; active: number; delayed: number; completed: number }
    > = {};

    slaMetrics.classified.forEach((r) => {
      const c = (r.customer || "").trim() || "Unassigned Customer";
      if (!map[c]) map[c] = { total: 0, active: 0, delayed: 0, completed: 0 };
      map[c].total++;
      if (r._isClosed) map[c].completed++;
      else map[c].active++;
      if (r._isDelayed) map[c].delayed++;
    });

    return Object.entries(map)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        active: stat.active,
        delayed: stat.delayed,
        completed: stat.completed,
        onTimeRate:
          stat.total > 0 ? Math.round(((stat.total - stat.delayed) / stat.total) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [slaMetrics.classified]);

  // =========================================================================
  // 6. PACKAGING CATEGORY MIX (VOLUME SHARE)
  // =========================================================================
  const categoryMix = useMemo(() => {
    const map: Record<string, number> = {};
    requests.forEach((r) => {
      const cat = (r.productCategory || r.productType || "").trim() || "Other";
      map[cat] = (map[cat] || 0) + 1;
    });

    const total = requests.length || 1;
    return Object.entries(map)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [requests]);

  // =========================================================================
  // 7. 12-MONTH TIMELINE & MATRIX (CURVE + NUMERICAL TABLE)
  // =========================================================================
  const monthlyTimeline = useMemo(() => {
    const monthCounts: Record<
      string,
      {
        intake: number;
        design: number;
        mockup: number;
        sampling: number;
        costing: number;
        onTime: number;
        delayed: number;
        teams: TeamMix;
      }
    > = {};

    BY_MONTHS.forEach((m) => {
      monthCounts[m.key] = {
        intake: 0,
        design: 0,
        mockup: 0,
        sampling: 0,
        costing: 0,
        onTime: 0,
        delayed: 0,
        teams: emptyTeamMix(),
      };
    });

    slaMetrics.classified.forEach((r) => {
      const dateStr = r.dateRequestCreated || r.createdAt;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const monthKey = String(d.getMonth() + 1).padStart(2, "0");
          if (monthCounts[monthKey]) {
            monthCounts[monthKey].intake++;
            if (isDesignRequest(r)) monthCounts[monthKey].design++;
            if (r.mockupRequired === "yes") monthCounts[monthKey].mockup++;
            if (!isDesignRequest(r)) monthCounts[monthKey].sampling++;
            if (r.costingRequiredDate) monthCounts[monthKey].costing++;

            if (r._isDelayed) monthCounts[monthKey].delayed++;
            else monthCounts[monthKey].onTime++;

            const team = TEAM_SERIES.find((series) => series.key === r._departmentKey);
            if (team) monthCounts[monthKey].teams[team.key]++;
          }
        }
      }
    });

    const maxVal = Math.max(...BY_MONTHS.map((m) => monthCounts[m.key].intake), 1);

    return {
      points: BY_MONTHS.map((m, idx) => ({
        index: idx,
        key: m.key,
        label: m.label,
        full: m.full,
        intake: monthCounts[m.key].intake,
        design: monthCounts[m.key].design,
        mockup: monthCounts[m.key].mockup,
        sampling: monthCounts[m.key].sampling,
        costing: monthCounts[m.key].costing,
        onTime: monthCounts[m.key].onTime,
        delayed: monthCounts[m.key].delayed,
        teams: monthCounts[m.key].teams,
        slaRate:
          monthCounts[m.key].intake > 0
            ? Math.round((monthCounts[m.key].onTime / monthCounts[m.key].intake) * 100)
            : 100,
      })),
      maxVal,
    };
  }, [slaMetrics.classified]);

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
      const normalizedY = p.intake / (monthlyTimeline.maxVal || 1);
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

  const managementReadout = useMemo(() => {
    const peakMonth = monthlyTimeline.points.reduce(
      (peak, month) => (month.intake > peak.intake ? month : peak),
      monthlyTimeline.points[0],
    );
    const latestRecordedIndex = monthlyTimeline.points.reduce(
      (latestIndex, month, index) => (month.intake > 0 ? index : latestIndex),
      -1,
    );
    const latestRecordedMonth = latestRecordedIndex >= 0
      ? monthlyTimeline.points[latestRecordedIndex]
      : null;
    const previousMonth = latestRecordedIndex > 0
      ? monthlyTimeline.points[latestRecordedIndex - 1]
      : null;
    const busiestOpenTeam = TEAM_SERIES.map((team) => ({
      ...team,
      count: slaMetrics.classified.filter(
        (request) => !request._isClosed && request._departmentKey === team.key,
      ).length,
    })).sort((a, b) => b.count - a.count)[0];

    return {
      peakMonth,
      busiestOpenTeam,
      latestRecordedMonth,
      previousMonth,
      monthChange: latestRecordedMonth && previousMonth
        ? latestRecordedMonth.intake - previousMonth.intake
        : null,
      monthChangePct: latestRecordedMonth && previousMonth && previousMonth.intake > 0
        ? Math.round(((latestRecordedMonth.intake - previousMonth.intake) / previousMonth.intake) * 100)
        : null,
      overdueShare: slaMetrics.inFlightCount
        ? Math.round((slaMetrics.totalDelayed / slaMetrics.inFlightCount) * 100)
        : 0,
    };
  }, [monthlyTimeline.points, slaMetrics.classified, slaMetrics.inFlightCount, slaMetrics.totalDelayed]);

  const intakeChannels = useMemo(() => [
    {
      key: "material",
      label: "Catalog Material Code",
      count: marketingDecomposition.channels.materialCodeCount,
      pct: marketingDecomposition.channels.materialPct,
      dotClass: "bg-blue-500",
      textClass: "text-blue-500",
    },
    {
      key: "binding",
      label: "Binding Configurator",
      count: marketingDecomposition.channels.bindingCount,
      pct: marketingDecomposition.channels.bindingPct,
      dotClass: "bg-indigo-500",
      textClass: "text-indigo-500",
    },
    {
      key: "feasibility",
      label: "Feasibility NPD Check",
      count: marketingDecomposition.channels.feasibilityCount,
      pct: marketingDecomposition.channels.feasibilityPct,
      dotClass: "bg-purple-500",
      textClass: "text-purple-500",
    },
    {
      key: "program",
      label: "Seasonal Programs",
      count: marketingDecomposition.channels.programCount,
      pct: marketingDecomposition.channels.programPct,
      dotClass: "bg-amber-500",
      textClass: "text-amber-500",
    },
  ], [marketingDecomposition.channels]);

  // =========================================================================
  // 8. WATCHLIST FILTERING
  // =========================================================================
  const filteredWatchlist = useMemo(() => {
    return slaMetrics.classified.filter((r) => {
      if (watchlistFilter === "delayed" && !r._isDelayed) return false;
      if (watchlistFilter === "urgent" && !r._isUrgent) return false;
      if (watchlistFilter === "ontime" && r._isDelayed) return false;
      if (watchlistFilter === "samp" && r._departmentKey !== "samp") return false;
      if (watchlistFilter === "creative" && r._departmentKey !== "creative") return false;
      if (watchlistFilter === "costing" && r._departmentKey !== "costing") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(r.srNumber || "").toLowerCase().includes(q) ||
          String(r.customer || "").toLowerCase().includes(q) ||
          String(r.productDescription || "").toLowerCase().includes(q) ||
          String(r.materialCode || "").toLowerCase().includes(q) ||
          String(r.status || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [slaMetrics.classified, watchlistFilter, searchQuery]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] font-sans select-text overflow-y-auto">

      {/* ── 1. GOATED EXECUTIVE COMMAND HEADER (PRODUCTION-GRADE) ── */}
      <header className="relative px-4 sm:px-6 lg:px-8 py-4 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] shrink-0 transition-colors">
        <div className="w-full flex flex-col xl:flex-row xl:items-center justify-between gap-4">

          {/* Left: Authoritative Title & Telemetry Status */}
          <div className="space-y-1 min-w-0">
            {/* Status & Scope Eyebrow */}
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-semibold text-[var(--on-surface)] tracking-tight">Operations Cockpit</span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--on-surface-subtle)]">
                <Calendar className="w-3 h-3 text-[var(--on-surface-subtle)]" />
                <span>FY {selectedYear === "ALL" ? "Consolidated" : selectedYear}</span>
              </span>
              <span className="text-[var(--border-strong)] hidden sm:inline">·</span>
              <span className="items-center gap-1.5 text-[11px] font-medium text-[var(--on-surface-muted)] hidden sm:inline-flex">
                <GreetingIcon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{greetingText}, {firstName}</span>
              </span>
            </div>

            {/* Main Executive Title */}
            <h1 className="font-display font-bold text-2xl lg:text-3xl tracking-tight text-[var(--on-surface)] leading-none">
              Operations Overview
            </h1>

            {/* Minimalist Subtext */}
            <p className="text-xs text-[var(--on-surface-muted)] flex items-center gap-2">
              <span>Real-time cross-functional velocity and SLA fidelity across production teams.</span>
            </p>
          </div>

          {/* Right: Unified Segmented Telemetry Ribbon + Actions */}
          <div className="flex items-center gap-3 flex-wrap xl:flex-nowrap shrink-0 xl:justify-end">

            {/* UNIFIED EXECUTIVE TELEMETRY RIBBON */}
            <div className="flex items-center rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs divide-x divide-[var(--border-subtle)] overflow-hidden">
              {/* Segment 1: Inflow */}
              <button
                type="button"
                onClick={() => scrollToSection("ops-snapshot")}
                className="px-3.5 py-2 flex flex-col text-left hover:bg-[var(--surface-container)] transition-colors cursor-pointer group"
                title="Total scoped requests this fiscal year"
              >
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--on-surface-subtle)] leading-tight group-hover:text-[var(--on-surface)]">
                  Inflow
                </span>
                <span className="font-mono font-bold text-sm text-[var(--on-surface)] tabular-nums leading-tight mt-0.5">
                  {slaMetrics.total.toLocaleString()}
                </span>
              </button>

              {/* Segment 2: In-Flight */}
              <button
                type="button"
                onClick={() => scrollToSection("ops-pipeline")}
                className="px-3.5 py-2 flex flex-col text-left hover:bg-[var(--surface-container)] transition-colors cursor-pointer group"
                title="Active requests currently in execution"
              >
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--on-surface-subtle)] leading-tight group-hover:text-[var(--on-surface)]">
                  In-Flight
                </span>
                <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 tabular-nums leading-tight mt-0.5">
                  {slaMetrics.inFlightCount.toLocaleString()}
                </span>
              </button>

              {/* Segment 3: On-Time SLA */}
              <button
                type="button"
                onClick={() => scrollToSection("ops-risks")}
                className="px-3.5 py-2 flex flex-col text-left hover:bg-[var(--surface-container)] transition-colors cursor-pointer group"
                title="Overall SLA on-time delivery rate"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--on-surface-subtle)] leading-tight group-hover:text-[var(--on-surface)]">
                    SLA Rate
                  </span>
                  <span className={`w-1.5 h-1.5 rounded-full ${slaMetrics.onTimeRate >= 90 ? "bg-emerald-500" : "bg-amber-500"}`} />
                </div>
                <span className={`font-mono font-bold text-sm tabular-nums leading-tight mt-0.5 ${
                  slaMetrics.onTimeRate >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {slaMetrics.onTimeRate}%
                </span>
              </button>

              {/* Segment 4: Overdue Risks */}
              <button
                type="button"
                onClick={() => {
                  setWatchlistFilter("delayed");
                  scrollToSection("ops-watchlist");
                }}
                className={`px-3.5 py-2 flex flex-col text-left transition-colors cursor-pointer group ${
                  slaMetrics.totalDelayed > 0 ? "hover:bg-rose-500/10" : "hover:bg-[var(--surface-container)]"
                }`}
                title={slaMetrics.totalDelayed > 0 ? `${slaMetrics.totalDelayed} tasks past SLA - click to inspect` : "All tasks within SLA target"}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono font-medium uppercase tracking-wider leading-tight ${
                    slaMetrics.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-[var(--on-surface-subtle)]"
                  }`}>
                    Overdue
                  </span>
                  {slaMetrics.totalDelayed > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </div>
                <span className={`font-mono font-bold text-sm tabular-nums leading-tight mt-0.5 ${
                  slaMetrics.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--on-surface)]"
                }`}>
                  {slaMetrics.totalDelayed}
                </span>
              </button>
            </div>

            {/* Compact Search & Action Controls */}
            <div className="flex items-center gap-2">
              {/* Quick Search */}
              <div className="relative flex items-center w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") scrollToSection("ops-watchlist");
                  }}
                  placeholder="Search records..."
                  className="w-full h-9 pl-8 pr-7 text-xs rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] focus:bg-[var(--surface-lowest)] border border-[var(--border-subtle)] focus:border-[var(--accent-primary)] text-[var(--on-surface)] placeholder-[var(--on-surface-subtle)] outline-none transition-all shadow-2xs font-sans"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 p-0.5 rounded-full hover:bg-[var(--surface-high)] text-[var(--on-surface-subtle)] hover:text-[var(--on-surface)] transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-[var(--on-surface-subtle)] bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded shadow-2xs">
                    /
                  </kbd>
                )}
              </div>

              {/* Sync Button */}
              <button
                type="button"
                onClick={loadData}
                disabled={isRefreshing}
                title={lastRefreshed ? `Last synced: ${lastRefreshed} · Click to refresh` : "Sync operational telemetry"}
                className="h-9 px-3 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] flex items-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95 disabled:opacity-50 select-none"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-colors ${
                    isRefreshing ? "text-[var(--accent-primary)] animate-spin" : "text-[var(--on-surface-muted)]"
                  }`}
                />
                <span className="text-xs font-semibold hidden md:inline">
                  {isRefreshing ? "Syncing" : "Sync"}
                </span>
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* ── MAIN DASHBOARD BODY ── */}
      <main className="w-full flex-1 p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── STICKY SECTION NAVIGATOR (SEGMENTED CONTROL PILL BAR) ── */}
        <nav
          aria-label="Operations overview sections"
          className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2 transition-all shadow-xs"
        >
          <div className="flex w-full items-center justify-between gap-3">
            {/* Scrollable Pills Carousel */}
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
              {OVERVIEW_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                const isWatchlist = section.id === "ops-watchlist";
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer select-none ${
                      isActive
                        ? "bg-[var(--surface-container)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--border-strong)]"
                        : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] border border-transparent font-medium"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"}`} />
                    <span>{section.label}</span>
                    {isWatchlist && slaMetrics.totalDelayed > 0 && (
                      <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white shadow-2xs">
                        {slaMetrics.totalDelayed}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Watchlist Action on Nav Right */}
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  scrollToSection("ops-watchlist");
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] border border-[var(--border-subtle)] text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs"
                title="Jump directly to watchlist table"
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Jump to Watchlist</span>
                {slaMetrics.totalDelayed > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                    {slaMetrics.totalDelayed}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={isRefreshing}
                title="Refresh operations telemetry"
                className="h-8 w-8 rounded-xl bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] flex items-center justify-center cursor-pointer shadow-2xs transition-colors md:hidden active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[var(--accent-primary)]" : ""}`} />
              </button>
            </div>
          </div>
        </nav>

        {/* ── 2. EXECUTIVE MULTI-FACTOR KPI STRIP (CLEAN VIEW-MODE METRICS) ── */}
        <section id="ops-snapshot" className="scroll-mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

          {/* Tile 1: Annual Inflow */}
          <div
            onClick={() => navigate("/sample-requests")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Annual Inflow
              </span>
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-low)] group-hover:bg-[var(--accent-primary-subtle)] text-[var(--on-surface-muted)] group-hover:text-[var(--accent-primary-strong)] flex items-center justify-center transition-colors">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {slaMetrics.total.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>100% total intake</span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 2: Global SLA Rate */}
          <div
            onClick={() => scrollToSection("ops-risks")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                On-Time SLA
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums flex items-baseline gap-1.5">
              <span>{slaMetrics.onTimeRate}%</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mb-1" />
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {slaMetrics.totalOnTime.toLocaleString()} on-track tasks
            </div>
          </div>

          {/* Tile 3: Breached / Overdue SLA */}
          <div
            onClick={() => {
              setWatchlistFilter("delayed");
              scrollToSection("ops-watchlist");
            }}
            className={`group p-4 rounded-xl bg-[var(--surface-lowest)] border hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 ${
              slaMetrics.totalDelayed > 0
                ? "border-rose-500/30 hover:border-rose-500/50 bg-rose-500/[0.02]"
                : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                slaMetrics.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--on-surface-subtle)]"
              }`}>
                Overdue Tasks
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                slaMetrics.totalDelayed > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-[var(--surface-low)] text-[var(--on-surface-subtle)]"
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-display font-bold tracking-tight tabular-nums ${
              slaMetrics.totalDelayed > 0 ? "text-rose-600 dark:text-rose-400" : "text-[var(--on-surface)]"
            }`}>
              {slaMetrics.totalDelayed}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              {slaMetrics.delaySeverity.delay7Plus > 0 ? `${slaMetrics.delaySeverity.delay7Plus} critical (>7d)` : "SLA past target"}
            </div>
          </div>

          {/* Tile 4: Urgent SLA (<72h) */}
          <div
            onClick={() => {
              setWatchlistFilter("urgent");
              scrollToSection("ops-watchlist");
            }}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-amber-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Imminent SLA
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-colors">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
              {slaMetrics.urgentCount}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Due within 72 hours
            </div>
          </div>

          {/* Tile 5: In-Flight Backlog */}
          <div
            onClick={() => scrollToSection("ops-pipeline")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-blue-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Active In-Flight
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors">
                <Hourglass className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {slaMetrics.inFlightCount}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Pending completion
            </div>
          </div>

          {/* Tile 6: Dispatched / Completed Deals */}
          <div
            onClick={() => navigate("/sample-requests")}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Dispatched / Won
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {slaMetrics.totalCompleted}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Delivered to client
            </div>
          </div>

        </section>

        {/* ── 2B. MANAGEMENT READOUT INTELLIGENCE STRIP ── */}
        <section aria-label="Management readout" className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Executive Intelligence Readout
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Automated operational audit highlights for the active business year.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[var(--on-surface-subtle)] self-start sm:self-auto">
              BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Readout 1: Peak Intake Month */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 hover:border-[var(--border-strong)] transition-all shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-container)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
                    Peak Intake
                  </span>
                  <span className="text-xs text-[var(--on-surface-muted)] truncate block">
                    Highest volume month
                  </span>
                </div>
              </div>
              <span className="text-right text-xs font-bold text-[var(--on-surface)] tabular-nums font-mono shrink-0">
                {managementReadout.peakMonth?.intake
                  ? `${managementReadout.peakMonth.full} · ${managementReadout.peakMonth.intake}`
                  : "No requests"}
              </span>
            </div>

            {/* Readout 2: Largest Queue */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 hover:border-[var(--border-strong)] transition-all shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Hourglass className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
                    Busiest Queue
                  </span>
                  <span className="text-xs text-[var(--on-surface-muted)] truncate block">
                    Most active in-flight
                  </span>
                </div>
              </div>
              <span className="text-right text-xs font-bold text-[var(--on-surface)] tabular-nums font-mono shrink-0">
                {managementReadout.busiestOpenTeam?.count
                  ? `${managementReadout.busiestOpenTeam.label} · ${managementReadout.busiestOpenTeam.count}`
                  : "No open requests"}
              </span>
            </div>

            {/* Readout 3: Overdue Rate */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 hover:border-[var(--border-strong)] transition-all shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
                    Past Target SLA
                  </span>
                  <span className="text-xs text-[var(--on-surface-muted)] truncate block">
                    SLA breach share
                  </span>
                </div>
              </div>
              <span className="text-right text-xs font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono shrink-0">
                {slaMetrics.totalDelayed} ({managementReadout.overdueShare}%)
              </span>
            </div>

            {/* Readout 4: MoM Change */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-low)] px-4 py-3 hover:border-[var(--border-strong)] transition-all shadow-2xs">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-container)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--on-surface-subtle)] block">
                    MoM Velocity
                  </span>
                  <span className="text-xs text-[var(--on-surface-muted)] truncate block">
                    Latest intake delta
                  </span>
                </div>
              </div>
              <span className="text-right text-xs font-bold text-[var(--on-surface)] tabular-nums font-mono shrink-0">
                {managementReadout.latestRecordedMonth && managementReadout.previousMonth && managementReadout.monthChange !== null
                  ? `${managementReadout.latestRecordedMonth.label} vs ${managementReadout.previousMonth.label} (${managementReadout.monthChange > 0 ? "+" : ""}${managementReadout.monthChange})`
                  : managementReadout.latestRecordedMonth?.intake
                    ? `${managementReadout.latestRecordedMonth.full} · ${managementReadout.latestRecordedMonth.intake}`
                    : "No monthly data"}
              </span>
            </div>
          </div>
        </section>

        {/* ── 3. GRAPHICAL PIPELINE LIFECYCLE FUNNEL (PROPORTIONAL DISTRIBUTION STRIP) ── */}
        <section id="ops-pipeline" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Requests by Current Workflow Stage
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Proportional distribution of active requests across teams and production stages.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--on-surface)] self-start sm:self-auto shadow-2xs">
              {slaMetrics.total.toLocaleString()} Total Units
            </span>
          </div>

          {/* Graphical Proportional Stacked Segment Bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-[var(--surface-low)] border border-[var(--border-subtle)]">
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.draft.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-slate-400 transition-all duration-300"
              title={`Intake / Draft: ${lifecycleFunnel.draft.count} (${lifecycleFunnel.draft.pct}%)`}
            />
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.creative.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-purple-500 transition-all duration-300"
              title={`Creative Artwork: ${lifecycleFunnel.creative.count} (${lifecycleFunnel.creative.pct}%)`}
            />
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.studio.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-indigo-500 transition-all duration-300"
              title={`Structural CAD: ${lifecycleFunnel.studio.count} (${lifecycleFunnel.studio.pct}%)`}
            />
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.samp.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-teal-500 transition-all duration-300"
              title={`SAMP Lab: ${lifecycleFunnel.samp.count} (${lifecycleFunnel.samp.pct}%)`}
            />
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.costing.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-amber-500 transition-all duration-300"
              title={`Costing & BOM: ${lifecycleFunnel.costing.count} (${lifecycleFunnel.costing.pct}%)`}
            />
            <div
              style={{ width: `${slaMetrics.total ? (lifecycleFunnel.dispatched.count / slaMetrics.total) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Dispatched / Won: ${lifecycleFunnel.dispatched.count} (${lifecycleFunnel.dispatched.pct}%)`}
            />
          </div>

          {/* Segment Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1 text-xs font-mono">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">Draft Intake</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.draft.count} ({lifecycleFunnel.draft.pct}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">Creative Artwork</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.creative.count} ({lifecycleFunnel.creative.pct}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">Studio CAD</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.studio.count} ({lifecycleFunnel.studio.pct}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">SAMP Lab</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.samp.count} ({lifecycleFunnel.samp.pct}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">Costing BOM</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.costing.count} ({lifecycleFunnel.costing.pct}%)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors shadow-2xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-[var(--on-surface-subtle)] block uppercase font-semibold">Dispatched</span>
                <span className="font-bold text-[var(--on-surface)] tabular-nums">{lifecycleFunnel.dispatched.count} ({lifecycleFunnel.dispatched.pct}%)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. ANNUAL INFLOW CURVE + NUMERICAL MATRIX TABLE ── */}
        <section id="ops-trends" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">

          {/* Curve Header & Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Monthly Requests & Team Mix
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] text-[10px] font-mono font-bold">
                  BY {selectedYear}
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Compare request intake and the current workstream mix across the selected business year.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <div className="inline-flex rounded-lg bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)]">
                <button
                  type="button"
                  aria-pressed={trendMode === "intake"}
                  onClick={() => setTrendMode("intake")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${trendMode === "intake" ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}
                >
                  Intake trend
                </button>
                <button
                  type="button"
                  aria-pressed={trendMode === "teams"}
                  onClick={() => setTrendMode("teams")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${trendMode === "teams" ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs" : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"}`}
                >
                  Team mix
                </button>
              </div>

              {trendMode === "intake" ? (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />
                  <span className="text-[var(--on-surface)] font-semibold">Request intake</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {TEAM_SERIES.map((team) => (
                    <span key={team.key} className="flex items-center gap-1 text-[var(--on-surface-muted)]">
                      <span className={`w-2 h-2 rounded-full ${team.dotClass}`} />
                      {team.label}
                    </span>
                  ))}
                </div>
              )}

              {/* Toggle Monthly Data Table */}
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
            {trendMode === "intake" ? (
              <svg
                viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
                className="w-full h-40 sm:h-48 overflow-visible"
                preserveAspectRatio="none"
              >
              <defs>
                <linearGradient id="solidCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal Guide Lines */}
              <line x1="30" y1="30" x2="770" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="88" y1="88" x2="770" y2="88" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="30" y1="146" x2="770" y2="146" stroke="var(--border-subtle)" />

              {/* Filled Area */}
              {svgCurve.areaPath && <path d={svgCurve.areaPath} fill="url(#solidCurveGrad)" />}

              {/* Main Curve */}
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

              {/* Data Nodes */}
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
            ) : (
              <div className="relative w-full pt-1">
                <div className="pointer-events-none absolute inset-x-0 top-3 bottom-7 flex flex-col justify-between" aria-hidden="true">
                  {[0, 1, 2, 3].map((line) => (
                    <div key={line} className="border-t border-dashed border-[var(--border-subtle)]" />
                  ))}
                </div>
                <div className="relative z-10 grid h-48 grid-cols-12 gap-0.5 sm:gap-2">
                  {monthlyTimeline.points.map((point, idx) => {
                    const total = TEAM_SERIES.reduce((sum, team) => sum + point.teams[team.key], 0);
                    const teamSummary = TEAM_SERIES.map((team) => `${team.label}: ${point.teams[team.key]}`).join(", ");
                    return (
                      <div
                        key={point.key}
                        role="img"
                        tabIndex={0}
                        aria-label={`${point.full}: ${point.intake} requests. ${teamSummary}`}
                        title={`${point.full}: ${point.intake} requests · ${teamSummary}`}
                        onMouseEnter={() => setHoveredMonthIndex(idx)}
                        onMouseLeave={() => setHoveredMonthIndex(null)}
                        onFocus={() => setHoveredMonthIndex(idx)}
                        onBlur={() => setHoveredMonthIndex(null)}
                        className="group flex min-w-0 flex-col items-center justify-end rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                      >
                        <div className="flex h-[168px] w-full flex-col items-center justify-end">
                          <span className="hidden h-4 text-[9px] font-mono font-semibold tabular-nums text-[var(--on-surface-muted)] sm:block">
                            {total || ""}
                          </span>
                          <div className="flex h-[144px] w-full items-end justify-center">
                            <div
                              className="flex w-3/5 max-w-8 min-w-[3px] flex-col-reverse overflow-hidden rounded-t-sm transition-opacity group-hover:opacity-80"
                              style={{ height: `${total ? Math.max((total / monthlyTimeline.maxVal) * 100, 2) : 0}%` }}
                            >
                              {TEAM_SERIES.map((team) => (
                                <div
                                  key={team.key}
                                  className={`block w-full shrink-0 ${team.barClass}`}
                                  style={{ height: `${total ? (point.teams[team.key] / total) * 100 : 0}%` }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className={`mt-1 text-[9px] sm:text-[11px] font-mono ${hoveredMonthIndex === idx ? "font-bold text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"}`}>
                          {point.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Solid Hover Tooltip */}
            {hoveredMonthIndex !== null && monthlyTimeline.points[hoveredMonthIndex] && (
              <div
                className="absolute top-2 z-20 pointer-events-none p-2.5 rounded-lg bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl text-xs font-sans"
                style={{
                  left: `${Math.min(Math.max(
                    trendMode === "intake"
                      ? svgCurve.points[hoveredMonthIndex].x / (svgCurve.width / 100)
                      : ((hoveredMonthIndex + 0.5) / monthlyTimeline.points.length) * 100,
                    8), 92)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-bold text-[var(--on-surface)] mb-1 font-display">
                  {monthlyTimeline.points[hoveredMonthIndex].full} (BY {selectedYear})
                </div>
                {trendMode === "intake" ? (
                  <div className="space-y-0.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-4 text-[var(--on-surface-muted)]">
                      <span className="text-[var(--on-surface-muted)]">Requests:</span>
                      <span className="font-bold text-[var(--on-surface)] tabular-nums">
                        {monthlyTimeline.points[hoveredMonthIndex].intake}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-emerald-600 dark:text-emerald-400">
                      <span>On-Time:</span>
                      <span className="font-bold tabular-nums">{monthlyTimeline.points[hoveredMonthIndex].onTime}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-rose-600 dark:text-rose-400">
                      <span>Delayed:</span>
                      <span className="font-bold tabular-nums">{monthlyTimeline.points[hoveredMonthIndex].delayed}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-1 text-[var(--on-surface-muted)]">
                      <span>Total requests:</span>
                      <span className="font-bold text-[var(--on-surface)] tabular-nums">{monthlyTimeline.points[hoveredMonthIndex].intake}</span>
                    </div>
                    {TEAM_SERIES.map((team) => (
                      <div key={team.key} className="flex items-center justify-between gap-4 text-[var(--on-surface-muted)]">
                        <span>{team.label}:</span>
                        <span className="font-bold text-[var(--on-surface)] tabular-nums">
                          {monthlyTimeline.points[hoveredMonthIndex].teams[team.key]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {showMonthlyTable && (
            <div className="overflow-x-auto pt-3 border-t border-[var(--border-subtle)]">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)] font-semibold">
                    <th className="py-2.5 px-3.5">Month</th>
                    <th className="py-2.5 px-3.5 text-right">Inflow</th>
                    <th className="py-2.5 px-3.5 text-right">Design</th>
                    <th className="py-2.5 px-3.5 text-right">CAD</th>
                    <th className="py-2.5 px-3.5 text-right">Sampling</th>
                    <th className="py-2.5 px-3.5 text-right">Costing</th>
                    <th className="py-2.5 px-3.5 text-right">On-Time</th>
                    <th className="py-2.5 px-3.5 text-right">Delayed</th>
                    <th className="py-2.5 px-3.5 text-right">SLA %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                  {monthlyTimeline.points.map((m) => (
                    <tr key={m.key} className="hover:bg-[var(--surface-low)] transition-colors">
                      <td className="py-2.5 px-3.5 font-semibold text-[var(--on-surface)]">{m.full}</td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[var(--on-surface)] tabular-nums">{m.intake}</td>
                      <td className="py-2.5 px-3.5 text-right text-[var(--on-surface-muted)] tabular-nums">{m.design}</td>
                      <td className="py-2.5 px-3.5 text-right text-[var(--on-surface-muted)] tabular-nums">{m.mockup}</td>
                      <td className="py-2.5 px-3.5 text-right text-[var(--on-surface-muted)] tabular-nums">{m.sampling}</td>
                      <td className="py-2.5 px-3.5 text-right text-[var(--on-surface-muted)] tabular-nums">{m.costing}</td>
                      <td className="py-2.5 px-3.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{m.onTime}</td>
                      <td className="py-2.5 px-3.5 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{m.delayed}</td>
                      <td className="py-2.5 px-3.5 text-right tabular-nums">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          m.slaRate >= 90
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : m.slaRate >= 75
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
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

        {/* ── 5. MARKETING DECOMPOSITION & CHANNELS (VIEW MODE) ── */}
        <section id="ops-portfolio" className="scroll-mt-16 grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left: 4 Deliverables Cards with Visual Share Meters */}
          <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <BarChart3 className="w-4 h-4 text-[var(--accent-primary)]" />
                  <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                    Deliverables Decomposition
                  </h2>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Decomposition into graphic artwork, structural CAD dielines, physical samples, and costing quotes.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs font-mono font-bold text-[var(--on-surface)] self-start sm:self-auto shadow-2xs">
                {marketingDecomposition.total.toLocaleString()} Total Units
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">

              {/* Deliverable 1: Design Requests */}
              <div
                onClick={() => navigate("/creative-work")}
                className="group p-3.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-purple-400/60 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)]">Design Briefs</h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Creative Artwork</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-500/20">
                    {marketingDecomposition.design.pct}%
                  </span>
                </div>
                {/* Visual Share Bar */}
                <div className="w-full bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div className="bg-purple-500 h-full rounded-full transition-all duration-300" style={{ width: `${marketingDecomposition.design.pct}%` }} />
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-2xl font-bold font-display text-[var(--on-surface)] tabular-nums">
                    {marketingDecomposition.design.count}
                  </span>
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Creative Desk <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Deliverable 2: Mockup Requests */}
              <div
                onClick={() => navigate("/studio-work")}
                className="group p-3.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-indigo-400/60 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)]">CAD Mockups</h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Dielines & 3D Form</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-500/20">
                    {marketingDecomposition.mockup.pct}%
                  </span>
                </div>
                {/* Visual Share Bar */}
                <div className="w-full bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${marketingDecomposition.mockup.pct}%` }} />
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-2xl font-bold font-display text-[var(--on-surface)] tabular-nums">
                    {marketingDecomposition.mockup.count}
                  </span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Studio Desk <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Deliverable 3: Sampling Prototypes */}
              <div
                onClick={() => navigate("/samp-team-work")}
                className="group p-3.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-emerald-400/60 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)]">Sampling Lab</h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Physical Prototypes</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20">
                    {marketingDecomposition.sampling.pct}%
                  </span>
                </div>
                {/* Visual Share Bar */}
                <div className="w-full bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${marketingDecomposition.sampling.pct}%` }} />
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-2xl font-bold font-display text-[var(--on-surface)] tabular-nums">
                    {marketingDecomposition.sampling.count}
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    SAMP Lab <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Deliverable 4: Costing Quotes */}
              <div
                onClick={() => navigate("/costing-team")}
                className="group p-3.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-amber-400/60 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)]">Costing & BOM</h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Pricing & Margins</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20">
                    {marketingDecomposition.costing.pct}%
                  </span>
                </div>
                {/* Visual Share Bar */}
                <div className="w-full bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${marketingDecomposition.costing.pct}%` }} />
                </div>
                <div className="flex items-baseline justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="text-2xl font-bold font-display text-[var(--on-surface)] tabular-nums">
                    {marketingDecomposition.costing.count}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Costing Desk <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Right: Intake Creation Mode / Channels Breakdown */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Boxes className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Intake Channels & Origin
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)] mb-3">
                Origin breakdown of client requests entering the operational lifecycle.
              </p>

              <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3.5">
                <div className="relative mx-auto h-24 w-24">
                  <svg
                    viewBox="0 0 100 100"
                    className="h-full w-full -rotate-90"
                    role="img"
                    aria-label={`Request origin mix across ${intakeChannels.reduce((sum, channel) => sum + channel.count, 0)} requests`}
                  >
                    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-container)" strokeWidth="13" />
                    {(() => {
                      const total = intakeChannels.reduce((sum, channel) => sum + channel.count, 0);
                      const circumference = 2 * Math.PI * 38;
                      let offset = 0;
                      return intakeChannels.map((channel) => {
                        const share = total ? channel.count / total : 0;
                        const arc = circumference * share;
                        const circle = (
                          <circle
                            key={channel.key}
                            cx="50"
                            cy="50"
                            r="38"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="13"
                            strokeDasharray={`${arc} ${circumference - arc}`}
                            strokeDashoffset={-offset}
                            className={channel.textClass}
                          />
                        );
                        offset += arc;
                        return circle;
                      });
                    })()}
                  </svg>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-lg font-bold leading-none text-[var(--on-surface)] tabular-nums">
                      {intakeChannels.reduce((sum, channel) => sum + channel.count, 0)}
                    </span>
                    <span className="mt-1 text-[9px] uppercase tracking-wide text-[var(--on-surface-subtle)] font-mono">requests</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs font-mono">
                  {intakeChannels.map((channel) => (
                    <div key={channel.key} className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 text-[var(--on-surface)]">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${channel.dotClass}`} />
                          <span className="truncate">{channel.label}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-[var(--on-surface)]">
                          {channel.count} <span className="font-normal text-[var(--on-surface-muted)]">({channel.pct}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                        <div className={`h-full rounded-full ${channel.dotClass}`} style={{ width: `${channel.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--on-surface-muted)]">Track Allocation</span>
              <span className="font-bold text-[var(--accent-primary)]">
                100% Accounted
              </span>
            </div>
          </div>

        </section>

        {/* ── 6. DEPARTMENTAL COMPARATIVE HEALTH MATRIX WITH VISUAL GAUGES ── */}
        <section id="ops-teams" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Team Workload & SLA Health
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Cross-department audit comparing active backlog, throughput capacity, and SLA compliance.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)] font-semibold">
                  <th className="py-2.5 px-3.5">Department</th>
                  <th className="py-2.5 px-3.5">Scope</th>
                  <th className="py-2.5 px-3.5 text-right">Workload</th>
                  <th className="py-2.5 px-3.5">Workload Share</th>
                  <th className="py-2.5 px-3.5 text-right">Active Queue</th>
                  <th className="py-2.5 px-3.5 text-right">On-Time</th>
                  <th className="py-2.5 px-3.5 text-right">Delayed</th>
                  <th className="py-2.5 px-3.5">SLA Fulfillment Gauge</th>
                  <th className="py-2.5 px-3.5 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {departmentHealth.map((dept) => {
                  const Icon = dept.icon;
                  return (
                    <tr key={dept.id} className="hover:bg-[var(--surface-low)] transition-colors">
                      <td className="py-3 px-3.5 font-semibold text-[var(--on-surface)] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[var(--surface-container)] flex items-center justify-center text-[var(--on-surface)] shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium">{dept.name}</span>
                      </td>
                      <td className="py-3 px-3.5 text-[var(--on-surface-muted)]">{dept.scope}</td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-[var(--on-surface)] tabular-nums">{dept.total}</td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2 w-28">
                          <div className="flex-1 bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-300" style={{ width: `${dept.sharePct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-[var(--on-surface-muted)] tabular-nums">{dept.sharePct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-[var(--on-surface)] tabular-nums">{dept.active}</td>
                      <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{dept.onTime}</td>
                      <td className="py-3 px-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {dept.delayed > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {dept.delayed}
                          </span>
                        ) : (
                          "0"
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2 w-36">
                          <div className="flex-1 bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                dept.slaRate >= 90 ? "bg-emerald-500" : dept.slaRate >= 75 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${dept.slaRate}%` }}
                            />
                          </div>
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${dept.statusTone}`}>
                            {dept.slaRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(dept.route)}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 shadow-2xs transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 7. AGING BOTTLENECK ANALYSIS + TOP ACCOUNTS CONCENTRATION ── */}
        <section id="ops-risks" className="scroll-mt-16 grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Bottleneck Aging Analysis with Graphical Ladder */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Open Request Age & Risk
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Aging distribution of in-flight requests since initial customer creation.
              </p>
            </div>

            {/* Visual Segmented Aging Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-[var(--surface-low)] border border-[var(--border-subtle)]">
              <div
                style={{
                  width: `${slaMetrics.inFlightCount > 0
                      ? Math.round((slaMetrics.aging.age0to3 / slaMetrics.inFlightCount) * 100)
                      : 25
                    }%`,
                }}
                className="bg-emerald-500 transition-all duration-300"
                title="0-3 Days"
              />
              <div
                style={{
                  width: `${slaMetrics.inFlightCount > 0
                      ? Math.round((slaMetrics.aging.age4to7 / slaMetrics.inFlightCount) * 100)
                      : 25
                    }%`,
                }}
                className="bg-blue-500 transition-all duration-300"
                title="4-7 Days"
              />
              <div
                style={{
                  width: `${slaMetrics.inFlightCount > 0
                      ? Math.round((slaMetrics.aging.age8to14 / slaMetrics.inFlightCount) * 100)
                      : 25
                    }%`,
                }}
                className="bg-amber-500 transition-all duration-300"
                title="8-14 Days"
              />
              <div
                style={{
                  width: `${slaMetrics.inFlightCount > 0
                      ? Math.round((slaMetrics.aging.age15Plus / slaMetrics.inFlightCount) * 100)
                      : 25
                    }%`,
                }}
                className="bg-rose-500 transition-all duration-300"
                title=">14 Days"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center font-mono">
              <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-[var(--on-surface-subtle)] block mb-1">0 - 3 Days</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {slaMetrics.aging.age0to3}
                </span>
                <span className="text-[10px] text-[var(--on-surface-muted)] block mt-0.5">Fresh</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-[var(--on-surface-subtle)] block mb-1">4 - 7 Days</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {slaMetrics.aging.age4to7}
                </span>
                <span className="text-[10px] text-[var(--on-surface-muted)] block mt-0.5">Standard</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-[var(--on-surface-subtle)] block mb-1">8 - 14 Days</span>
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {slaMetrics.aging.age8to14}
                </span>
                <span className="text-[10px] text-[var(--on-surface-muted)] block mt-0.5">Review</span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-[10px] uppercase font-semibold text-[var(--on-surface-subtle)] block mb-1">&gt;14 Days</span>
                <span className="text-xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {slaMetrics.aging.age15Plus}
                </span>
                <span className="text-[10px] text-[var(--on-surface-muted)] block mt-0.5">Stalled</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs text-[var(--on-surface-muted)] flex items-center justify-between">
              <span className="font-medium">Overdue Age Breakdown:</span>
              <span className="font-mono text-[11px] text-[var(--on-surface)] font-semibold">
                {slaMetrics.delaySeverity.delay1to3d} (1-3d) · {slaMetrics.delaySeverity.delay4to7d} (4-7d) · {slaMetrics.delaySeverity.delay7Plus} (&gt;7d)
              </span>
            </div>
          </div>

          {/* Top Customer Accounts Concentration with Visual Meters */}
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Top Customer Workload & SLA
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Key client portfolio request volume and on-time delivery rates.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)] font-semibold">
                    <th className="py-2.5 px-3">Customer Account</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right">Active</th>
                    <th className="py-2.5 px-3 text-right">Delayed</th>
                    <th className="py-2.5 px-3">On-Time Fulfillment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
                  {topCustomers.map((cust) => (
                    <tr key={cust.name} className="hover:bg-[var(--surface-low)] transition-colors">
                      <td className="py-3 px-3 font-semibold text-[var(--on-surface)] truncate max-w-[140px]">
                        {cust.name}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">{cust.total}</td>
                      <td className="py-3 px-3 text-right text-[var(--on-surface-muted)] tabular-nums">{cust.active}</td>
                      <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">{cust.delayed}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${cust.onTimeRate}%` }}
                            />
                          </div>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                            cust.onTimeRate >= 90
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}>
                            {cust.onTimeRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </section>

        {/* ── 8. PACKAGING CATEGORY MIX (VOLUME SHARE BARS) ── */}
        <section id="ops-categories" className="scroll-mt-16 p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Package className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Product Category Mix
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Distribution of client requests by substrate and packaging configuration.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {categoryMix.map((cat) => (
              <div key={cat.name} className="p-3.5 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--on-surface)] truncate" title={cat.name}>
                    {cat.name}
                  </span>
                  <span className="font-mono font-bold text-[var(--accent-primary)] text-[11px]">{cat.pct}%</span>
                </div>
                <div className="w-full bg-[var(--surface-container)] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[var(--accent-primary)] h-full rounded-full transition-all duration-300" style={{ width: `${cat.pct}%` }} />
                </div>
                <div className="text-[10px] font-mono text-[var(--on-surface-muted)] tabular-nums">
                  {cat.count} units logged
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 9. DETAILED OPERATIONAL AUDIT WATCHLIST TABLE (VIEW-MODE) ── */}
        <section id="ops-watchlist" className="scroll-mt-16 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs overflow-hidden">

          {/* Header with Search and Deep Filters */}
          <div className="p-5 sm:p-6 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Flame className="w-4 h-4 text-amber-500" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                  <span>Operations Watchlist</span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[11px] font-mono font-semibold text-[var(--on-surface-subtle)]">
                    {filteredWatchlist.length} records
                  </span>
                </h2>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Live inspection of individual requests, active department ownership, and delay turnaround.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter SR, Customer, Item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-low)] text-xs text-[var(--on-surface)] placeholder-[var(--on-surface-subtle)] border border-[var(--border-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] w-48 sm:w-56 shadow-2xs"
                />
              </div>

              {/* Segmented Filter Pills */}
              <div className="inline-flex rounded-xl bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)] text-xs font-medium shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("all")}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${watchlistFilter === "all"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                >
                  All ({slaMetrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("delayed")}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${watchlistFilter === "delayed"
                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-rose-600"
                    }`}
                >
                  Delayed ({slaMetrics.totalDelayed})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("urgent")}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${watchlistFilter === "urgent"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-amber-600"
                    }`}
                >
                  &lt;72h ({slaMetrics.urgentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("ontime")}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${watchlistFilter === "ontime"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-emerald-600"
                    }`}
                >
                  On-Time ({slaMetrics.totalOnTime})
                </button>
              </div>
            </div>
          </div>

          {/* Deep Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-low)] text-[10px] font-mono uppercase text-[var(--on-surface-subtle)] font-semibold">
                  <th className="py-2.5 px-4">SR Number</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Product Description</th>
                  <th className="py-2.5 px-3">Active Department</th>
                  <th className="py-2.5 px-3 text-center">Age (Days)</th>
                  <th className="py-2.5 px-3">Required Target</th>
                  <th className="py-2.5 px-3">SLA Status</th>
                  <th className="py-2.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isRefreshing ? (
                  <TableSkeletonRows rows={6} columns={8} />
                ) : filteredWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center">
                      <EmptyState
                        compact
                        title="No matching operational records"
                        description="Try clearing search filters or selecting another filter pill."
                        onResetFilters={
                          searchQuery || watchlistFilter !== "all"
                            ? () => {
                                setSearchQuery("");
                                setWatchlistFilter("all");
                              }
                            : undefined
                        }
                        resetLabel="Reset Search & Filters"
                      />
                    </td>
                  </tr>
                ) : (
                  filteredWatchlist.slice(0, 10).map((req) => {
                    const deptTones: Record<string, string> = {
                      marketing: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/60",
                      creative: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900/60",
                      studio: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60",
                      samp: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-900/60",
                      costing: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60",
                      plant: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/60",
                    };
                    const deptTone = deptTones[req._departmentKey.toLowerCase()] || "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300";

                    return (
                      <tr
                        key={req.id}
                        onClick={() => navigate("/sample-requests")}
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
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${deptTone}`}>
                            {req._departmentKey.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono tabular-nums text-[var(--on-surface)]">
                          {req._ageDays}d
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--on-surface)] tabular-nums">
                          {req.sampleRequiredDate || "—"}
                        </td>
                        <td className="py-3 px-3">
                          {req._isDelayed ? (
                            <StatusPill
                              status={`+${req._overdueDays}d Late`}
                              tone="danger"
                              icon={<AlertTriangle className="w-3 h-3" />}
                              size="xs"
                            />
                          ) : req._isUrgent ? (
                            <StatusPill
                              status="Due <72h"
                              tone="warning"
                              icon={<Clock className="w-3 h-3" />}
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="p-3.5 px-5 bg-[var(--surface-low)] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--on-surface-muted)]">
            <span>Showing top operational records in executive view mode.</span>
            <button
              type="button"
              onClick={() => navigate("/sample-requests")}
              className="font-semibold text-[var(--on-surface)] hover:text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Open Full Console View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </section>

      </main>

    </div>
  );
};

export default OperationsOverview;
