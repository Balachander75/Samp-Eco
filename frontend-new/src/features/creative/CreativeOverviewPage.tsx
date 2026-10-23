import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  Palette,
  Box,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Download,
  Building2,
  Users,
  User,
  ShieldCheck,
  FileEdit,
  Send,
  BarChart3,
  TrendingUp,
  Sunrise,
  Sun,
  Moon,
  ChevronRight,
  X,
  Flame,
  LayoutDashboard,
  Sparkles,
  Clock,
} from "lucide-react";
import { CreativeBriefItem, SampleRequestItem } from "@/features/sample-requests/types";
import { UserProfile } from "@/features/auth";
import { fetchUsersApi, UserItem } from "@/infrastructure/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { CopyBadge } from "@/components/ui/CopyBadge";
import { TableSkeletonRows } from "@/components/erp/TableSkeletonRows";
import { EmptyState } from "@/components/ui/EmptyState";
import { BY_MONTHS } from "@/lib/businessYear";

export interface CreativeOverviewPageProps {
  briefs: CreativeBriefItem[];
  designRequests: SampleRequestItem[];
  samplingMockupRequests: SampleRequestItem[];
  isLoading: boolean;
  selectedYear: string;
  selectedPlant?: string;
  user?: UserProfile | null;
  isAdmin?: boolean;
  onNavigateToTab: (tab: "design" | "sampling") => void;
  onInspectBrief: (brief: CreativeBriefItem) => void;
  onInspectRequest: (req: SampleRequestItem) => void;
  onRefresh?: () => Promise<void>;
  onExportCSV?: () => void;
}

export const CreativeOverviewPage: React.FC<CreativeOverviewPageProps> = ({
  briefs,
  designRequests,
  samplingMockupRequests,
  isLoading,
  selectedYear,
  user,
  isAdmin = false,
  onNavigateToTab,
  onInspectBrief,
  onInspectRequest,
  onExportCSV,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Authority check: Admin or Team Head has full creative studio leadership overview
  const isHeadRole = useMemo(() => {
    if (isAdmin) return true;
    return Boolean(user?.is_team_head);
  }, [isAdmin, user]);

  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");
  const [activeSection, setActiveSection] = useState<string>("creative-snapshot");
  const [watchlistFilter, setWatchlistFilter] = useState<
    "all" | "drafts" | "concept" | "review" | "delayed"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showMonthlyTable, setShowMonthlyTable] = useState(false);
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Dynamic Daylight Greeting with adaptive icon
  const { greetingText, GreetingIcon } = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return { greetingText: "Good morning", GreetingIcon: Sunrise };
    }
    if (hour >= 12 && hour < 16) {
      return { greetingText: "Good afternoon", GreetingIcon: Sun };
    }
    return { greetingText: "Good evening", GreetingIcon: Moon };
  }, []);

  const firstName = useMemo(() => {
    if (!user?.name) return "Designer";
    return user.name.split(" ")[0];
  }, [user?.name]);

  const currentUserName = useMemo(() => {
    return (user?.name || user?.userid || "Designer").trim();
  }, [user?.name, user?.userid]);

  // Creative Studio department members from backend users table
  const [creativeUsers, setCreativeUsers] = useState<UserItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetchUsersApi("creative")
      .then((usersList) => {
        if (isMounted && Array.isArray(usersList)) {
          setCreativeUsers(usersList);
        }
      })
      .catch((err) => {
        console.warn("Could not load creative users list:", err);
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

  // Normalize unified design items
  const allDesignItems = useMemo(() => {
    const list: Array<{
      id: string;
      refCode: string;
      title: string;
      customer: string;
      trend: string;
      targetAudience: string;
      variantsCount: number;
      designer: string;
      createdBy: string;
      dueDate: string;
      createdDate: string;
      status: string;
      proofStatus: CreativeBriefItem["proofStatus"];
      isBrief: boolean;
      rawBrief?: CreativeBriefItem;
      rawReq?: SampleRequestItem;
    }> = [];

    // 1. Briefs
    briefs.forEach((b) => {
      list.push({
        id: b.id,
        refCode: b.artCode,
        title: b.title,
        customer: b.brand,
        trend: (b as any).trend || "General Packaging",
        targetAudience: (b as any).targetAudience || "General Consumer",
        variantsCount: b.variantsCount || 1,
        designer: b.designer || (b as any).assignedTo || (b as any).createdBy || "Unassigned",
        createdBy: (b as any).createdBy || b.designer || "",
        dueDate: b.dueDate || "",
        createdDate: (b as any).createdAt || (b as any).dateRequestCreated || "",
        status: b.proofStatus,
        proofStatus: b.proofStatus,
        isBrief: true,
        rawBrief: b,
      });
    });

    // 2. Design Requests
    designRequests.forEach((d) => {
      let proofStatus: CreativeBriefItem["proofStatus"] = "Brief Intake";
      const s = String(d.status || "").toLowerCase();
      const workflowStatus = String(d.designRequestStatus || d.status || "").toLowerCase();

      if (s.includes("approved") || s.includes("released") || d.marketingDesignDecision === "accepted") {
        proofStatus = "Prepress Approved";
      } else if (workflowStatus.includes("revisions") || d.marketingDesignDecision === "remaining_requested") {
        proofStatus = "Revisions Requested";
      } else if (s.includes("review") || d.marketingDesignDecision === "awaiting_marketing_review") {
        proofStatus = "Client Review";
      } else if (s.includes("creative")) {
        proofStatus = "In Concept";
      }

      list.push({
        id: String(d.id),
        refCode: d.requestCode || d.srNumber || `DR-${d.id}`,
        title: d.productDescription || (d as any).opportunityName || "Packaging Artwork Brief",
        customer: d.customer || "General Account",
        trend: d.trend || "Corporate Core",
        targetAudience: d.targetAudience || "General Commercial",
        variantsCount: Number(d.designsCustomerCreative || d.productArtworkNos) || d.numberOfDesigns || 1,
        designer: d.claimedBy || d.createdBy || "Unassigned",
        createdBy: d.createdBy || "",
        dueDate: d.sampleRequiredDate || d.targetArtworkDateCreative || d.designRequiredDate || "",
        createdDate: d.dateRequestCreated || d.createdAt || "",
        status: d.status || "Creative",
        proofStatus,
        isBrief: false,
        rawReq: d,
      });
    });

    return list;
  }, [briefs, designRequests]);

  // Extract team members list
  const teamMembersList = useMemo(() => {
    const countsMap: Record<string, number> = {};

    creativeUsers.forEach((u) => {
      const name = (u.name || u.userid || "").trim();
      if (name) countsMap[name] = 0;
    });

    allDesignItems.forEach((item) => {
      const assignee = (item.designer || item.createdBy || "").trim();
      if (!assignee || assignee === "Unassigned") return;

      const matchedKey = Object.keys(countsMap).find(
        (k) => k.toLowerCase() === assignee.toLowerCase()
      );
      if (matchedKey) {
        countsMap[matchedKey] = (countsMap[matchedKey] || 0) + 1;
      } else {
        countsMap[assignee] = (countsMap[assignee] || 0) + 1;
      }
    });

    return Object.entries(countsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [creativeUsers, allDesignItems]);

  // Scoped designs based on user role
  const scopedDesigns = useMemo(() => {
    if (!isHeadRole) {
      const me = currentUserName.toLowerCase();
      return allDesignItems.filter((d) => {
        const designer = (d.designer || "").toLowerCase();
        const creator = (d.createdBy || "").toLowerCase();
        return (
          designer === me ||
          creator === me ||
          (me.length > 2 && (designer.includes(me) || creator.includes(me)))
        );
      });
    }

    if (selectedMemberFilter !== "all") {
      const target = selectedMemberFilter.toLowerCase();
      return allDesignItems.filter((d) => {
        const designer = (d.designer || "").toLowerCase();
        const creator = (d.createdBy || "").toLowerCase();
        return (
          designer === target ||
          creator === target ||
          (target.length > 2 && (designer.includes(target) || creator.includes(target)))
        );
      });
    }

    return allDesignItems;
  }, [allDesignItems, isHeadRole, selectedMemberFilter, currentUserName]);

  // Core Creative Telemetry
  const telemetry = useMemo(() => {
    const now = new Date();
    let totalDrafts = 0;
    let totalInProduction = 0;
    let totalClientReview = 0;
    let totalCompleted = 0;
    let totalOnTime = 0;
    let totalDelayed = 0;

    const classified = scopedDesigns.map((d) => {
      const isApproved = d.proofStatus === "Prepress Approved";
      const isDraft = d.proofStatus === "Brief Intake";
      const isProduction = d.proofStatus === "In Concept";
      const isReview = d.proofStatus === "Client Review" || d.proofStatus === "Revisions Requested";

      let isDelayed = false;
      let overdueDays = 0;

      if (d.dueDate) {
        const targetDate = new Date(d.dueDate);
        if (!isNaN(targetDate.getTime())) {
          if (!isApproved && targetDate < now) {
            isDelayed = true;
            overdueDays = Math.max(1, Math.floor((now.getTime() - targetDate.getTime()) / 86400000));
          }
        }
      }

      if (isDraft) totalDrafts++;
      else if (!isApproved) totalInProduction++;

      if (isReview) totalClientReview++;
      if (isApproved) totalCompleted++;

      if (isDelayed) totalDelayed++;
      else totalOnTime++;

      return {
        ...d,
        _isDraft: isDraft,
        _isProduction: isProduction,
        _isReview: isReview,
        _isApproved: isApproved,
        _isDelayed: isDelayed,
        _overdueDays: overdueDays,
      };
    });

    const total = scopedDesigns.length;
    const onTimeRate = total > 0 ? Math.round((totalOnTime / total) * 100) : 100;

    return {
      total,
      totalDrafts,
      totalInProduction,
      totalClientReview,
      totalCompleted,
      totalOnTime,
      totalDelayed,
      onTimeRate,
      classified,
    };
  }, [scopedDesigns]);

  // Member Audit Matrix for Head view
  const memberAuditMatrix = useMemo(() => {
    return teamMembersList.map((member) => {
      const memberItems = allDesignItems.filter((d) => {
        const des = (d.designer || "").toLowerCase().trim();
        const cre = (d.createdBy || "").toLowerCase().trim();
        const mem = member.name.toLowerCase().trim();
        return des === mem || cre === mem || (mem.length > 2 && (des.includes(mem) || cre.includes(mem)));
      });

      const total = memberItems.length;
      const active = memberItems.filter((d) => d.proofStatus === "In Concept").length;
      const drafts = memberItems.filter((d) => d.proofStatus === "Brief Intake").length;
      const delayed = memberItems.filter((d) => {
        if (!d.dueDate) return false;
        const dt = new Date(d.dueDate);
        return dt < new Date() && d.proofStatus !== "Prepress Approved";
      }).length;

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
  }, [teamMembersList, allDesignItems, currentUserName]);

  // 12-Month Timeline curve
  const monthlyTimeline = useMemo(() => {
    const monthCounts: Record<
      string,
      { inflow: number; onTime: number; delayed: number }
    > = {};

    BY_MONTHS.forEach((m) => {
      monthCounts[m.key] = { inflow: 0, onTime: 0, delayed: 0 };
    });

    telemetry.classified.forEach((item) => {
      const dateStr = item.createdDate || item.dueDate;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const monthKey = String(d.getMonth() + 1).padStart(2, "0");
          if (monthCounts[monthKey]) {
            monthCounts[monthKey].inflow++;
            if (item._isDelayed) monthCounts[monthKey].delayed++;
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
    const paddingX = 36;
    const paddingY = 24;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;
    const pts = monthlyTimeline.points;
    const max = Math.max(monthlyTimeline.maxVal, 2);

    const dataPoints = pts.map((p, i) => {
      const x = paddingX + (i / Math.max(pts.length - 1, 1)) * chartW;
      const normalizedY = p.inflow / max;
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

  // Top Customer Account Portfolios
  const topAccounts = useMemo(() => {
    const map: Record<string, { total: number; active: number; delayed: number }> = {};
    telemetry.classified.forEach((r) => {
      const c = (r.customer || "").trim() || "Unassigned Brand";
      if (!map[c]) map[c] = { total: 0, active: 0, delayed: 0 };
      map[c].total++;
      if (!r._isApproved) map[c].active++;
      if (r._isDelayed) map[c].delayed++;
    });

    return Object.entries(map)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        active: stat.active,
        delayed: stat.delayed,
        onTimeRate: stat.total > 0 ? Math.round(((stat.total - stat.delayed) / stat.total) * 100) : 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [telemetry.classified]);

  // Watchlist filtered items
  const filteredWatchlist = useMemo(() => {
    let items = telemetry.classified;

    if (watchlistFilter === "drafts") {
      items = items.filter((d) => d._isDraft);
    } else if (watchlistFilter === "concept") {
      items = items.filter((d) => d._isProduction);
    } else if (watchlistFilter === "review") {
      items = items.filter((d) => d._isReview);
    } else if (watchlistFilter === "delayed") {
      items = items.filter((d) => d._isDelayed);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      items = items.filter(
        (d) =>
          d.refCode.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.customer.toLowerCase().includes(q) ||
          d.trend.toLowerCase().includes(q) ||
          d.designer.toLowerCase().includes(q)
      );
    }

    return items;
  }, [telemetry.classified, watchlistFilter, searchTerm]);

  // Smooth scroll handler
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Section Navigation Links
  const SECTIONS = useMemo(() => {
    const list = [
      { id: "creative-snapshot", label: "Snapshot", icon: LayoutDashboard },
      { id: "creative-workstreams", label: "Workstreams", icon: Boxes },
      { id: "creative-cadence", label: "Cadence & Trends", icon: TrendingUp },
    ];
    if (isHeadRole) {
      list.push({ id: "creative-team", label: "Team Audit", icon: Users });
    }
    list.push(
      { id: "creative-accounts", label: "Top Accounts", icon: Building2 },
      { id: "creative-watchlist", label: "Pipeline Watchlist", icon: Flame }
    );
    return list;
  }, [isHeadRole]);

  // CSV Export fallback handler
  const handleExport = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    const headers = ["Ref Code", "Customer", "Title", "Designer", "Due Date", "Status"];
    const rows = filteredWatchlist.map((item) => [
      item.refCode,
      item.customer,
      `"${(item.title || "").replace(/"/g, '""')}"`,
      item.designer,
      item.dueDate,
      item.status,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `creative_pipeline_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] font-sans select-text overflow-y-auto">
      {/* ── 1. SOLID EXECUTIVE GREETING & COMMAND HEADER ── */}
      <header className="px-4 sm:px-6 lg:px-8 py-3.5 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] shrink-0 transition-colors">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Greeting & Context */}
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
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--on-surface)]">
                {isHeadRole ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Creative Studio Head Executive Console · Department Overview</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Creative Designer Portfolio · Personal Workstream</span>
                  </>
                )}
              </span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="font-mono text-[11px] text-[var(--on-surface-subtle)]">
                Business Year {selectedYear === "ALL" ? "Consolidated" : selectedYear}
              </span>
              {selectedMemberFilter !== "all" && (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] border border-[var(--accent-primary)]/30">
                    Scoped: {selectedMemberFilter}
                    <button
                      type="button"
                      onClick={() => setSelectedMemberFilter("all")}
                      className="ml-1 hover:opacity-75 cursor-pointer font-bold"
                      title="Clear scope"
                    >
                      ×
                    </button>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input with Hotkey Kbd */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--on-surface-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search studio briefs..."
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
              onClick={handleExport}
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
        aria-label="Creative overview sections"
        className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-lowest)]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2 transition-all shadow-xs"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const isWatchlist = section.id === "creative-watchlist";
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer select-none active:scale-[0.98] ${isActive
                    ? "bg-[var(--surface-container)] text-[var(--on-surface)] font-bold shadow-2xs border border-[var(--border-strong)]"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] border border-transparent font-medium"
                    }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-[var(--accent-primary)]" : "text-[var(--on-surface-subtle)]"
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
                scrollToSection("creative-watchlist");
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
        {/* ── 2. CREATIVE MULTI-FACTOR KPI RIBBON ── */}
        <section id="creative-snapshot" className="scroll-mt-16 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Tile 1: Total Studio Intake */}
          <div
            onClick={() => {
              setWatchlistFilter("all");
              scrollToSection("creative-watchlist");
            }}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                {isHeadRole ? "Studio Intake" : "My Briefs"}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[var(--surface-low)] group-hover:bg-[var(--accent-primary-subtle)] text-[var(--on-surface-muted)] group-hover:text-[var(--accent-primary-strong)] flex items-center justify-center transition-colors">
                <Palette className="w-3.5 h-3.5" />
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
                    : `${teamMembersList.length} designers`
                  : "Assigned to you"}
              </span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-[var(--accent-primary)] group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 2: Pending Drafts */}
          <div
            onClick={() => {
              setWatchlistFilter("drafts");
              scrollToSection("creative-watchlist");
            }}
            className={`group p-4 rounded-xl bg-[var(--surface-lowest)] border hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 ${telemetry.totalDrafts > 0
              ? "border-amber-300 dark:border-amber-900/60 hover:border-amber-400"
              : "border-[var(--border-subtle)] hover:border-amber-400/50"
              }`}
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
              {isLoading ? "—" : telemetry.totalDrafts.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>Awaiting intake / spec</span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 3: In Production / Concept */}
          <div
            onClick={() => {
              setWatchlistFilter("concept");
              scrollToSection("creative-watchlist");
            }}
            className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-purple-400 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                In Production
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalInProduction.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>Active in design studio</span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 4: Client Review / Action */}
          <div
            onClick={() => {
              setWatchlistFilter("review");
              scrollToSection("creative-watchlist");
            }}
            className={`group p-4 rounded-xl bg-[var(--surface-lowest)] border hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200 ${telemetry.totalClientReview > 0
              ? "border-indigo-300 dark:border-indigo-900/60 hover:border-indigo-400"
              : "border-[var(--border-subtle)] hover:border-indigo-400/50"
              }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Needs Decision
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
              {isLoading ? "—" : telemetry.totalClientReview.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>Client review / revisions</span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>

          {/* Tile 5: Turnaround SLA */}
          <div className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Fulfillment SLA
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : `${telemetry.onTimeRate}%`}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono flex items-center justify-between">
              <span>{telemetry.totalOnTime} on-track tasks</span>
              <span className="text-[10px] font-bold">Target 95%</span>
            </div>
          </div>

          {/* Tile 6: Prepress Dispatched */}
          <div className="group p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-teal-500/40 hover:shadow-2xs hover:-translate-y-0.5 cursor-pointer transition-all duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)] group-hover:text-[var(--on-surface)] transition-colors">
                Dispatched
              </span>
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center transition-colors">
                <Send className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-display font-bold tracking-tight text-[var(--on-surface)] tabular-nums">
              {isLoading ? "—" : telemetry.totalCompleted.toLocaleString()}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono flex items-center justify-between">
              <span>Certified &amp; released</span>
              <ChevronRight className="w-3 h-3 text-[var(--on-surface-subtle)] group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </section>

        {/* ── 3. DEDICATED WORKSTREAMS & DELIVERY HUBS ── */}
        <section id="creative-workstreams" className="scroll-mt-16 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Dedicated Creative Workstreams &amp; Delivery Hubs</span>
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Direct access to artwork briefs, packaging sampling &amp; CAD mockups, and prepress proofing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Stream 1: Artwork & Graphic Design Desk */}
            <div
              onClick={() => onNavigateToTab("design")}
              className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-purple-400/80 cursor-pointer shadow-2xs group transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Artwork &amp; Design Briefs Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
                        Graphic Concepts &amp; Themes
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                    {allDesignItems.length} Briefs
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-4 leading-relaxed">
                  Intake of client artwork requests, brand typography, Shutterstock licensing, and variant generation.
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                <span className="font-mono tabular-nums text-[var(--on-surface-muted)]">
                  {allDesignItems.length} active briefs
                </span>
                <span className="flex items-center gap-1">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 2: Sampling & CAD Mockups Desk */}
            <div
              onClick={() => onNavigateToTab("sampling")}
              className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-teal-400/80 cursor-pointer shadow-2xs group transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                      <Box className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        Sampling &amp; CAD Mockups Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
                        3D Structural &amp; Dummies
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800/40">
                    {samplingMockupRequests.length} Tasks
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-4 leading-relaxed">
                  3D structural dummy mockups, substrate matching, folding simulations, and SAMP physical prototype verification.
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                <span className="font-mono tabular-nums text-[var(--on-surface-muted)]">
                  {samplingMockupRequests.length} active mockups
                </span>
                <span className="flex items-center gap-1">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 3: Prepress Certification & QC */}
            <div
              onClick={() => onNavigateToTab("design")}
              className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-400/80 cursor-pointer shadow-2xs group transition-all duration-200 flex flex-col justify-between hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        Prepress Certification &amp; QC
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">
                        Press-Ready Signoff
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                    {telemetry.totalCompleted} Certified
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-4 leading-relaxed">
                  Final high-resolution PDF proof verification, CMYK/Pantone separations, and plant print authorization.
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                <span className="font-mono tabular-nums text-[var(--on-surface-muted)]">
                  {telemetry.totalCompleted} certified projects
                </span>
                <span className="flex items-center gap-1">
                  Audit Prepress <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. INFLOW CADENCE & DELIVERY VELOCITY SPLINE ── */}
        <section id="creative-cadence" className="scroll-mt-16 p-4 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Creative Request Intake Cadence &amp; Delivery Velocity
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                  BY {selectedYear === "ALL" ? "Consolidated" : selectedYear}
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Monthly trajectory of creative briefs progressing through concepting, sampling, and final prepress release.
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
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{showMonthlyTable ? "Hide Matrix" : "View Monthly Breakdown"}</span>
              </button>
            </div>
          </div>

          {/* Smooth Catmull-Rom Bezier Spline Curve */}
          <div className="relative w-full overflow-hidden pt-2">
            <svg
              viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
              className="w-full h-40 sm:h-48 overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="creativeSplineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="var(--accent-primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {/* Grid Guideline lines */}
              <line x1="36" y1="30" x2="764" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="36" y1="85" x2="764" y2="85" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="36" y1="140" x2="764" y2="140" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="36" y1="156" x2="764" y2="156" stroke="var(--border-subtle)" />

              {/* Area gradient under spline */}
              {svgCurve.areaPath && <path d={svgCurve.areaPath} fill="url(#creativeSplineGrad)" />}

              {/* Solid Spline Line */}
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

              {/* Data Interactive Nodes */}
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
                    {isHovered && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={8}
                        fill="var(--accent-primary)"
                        opacity="0.25"
                        className="animate-ping"
                      />
                    )}
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
                      className={`text-[11px] font-mono select-none ${isHovered ? "fill-[var(--accent-primary)] font-bold" : "fill-[var(--on-surface-subtle)]"
                        }`}
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Floating Tooltip */}
            {hoveredMonthIndex !== null && svgCurve.points[hoveredMonthIndex] && (
              <div
                className="absolute top-2 z-20 pointer-events-none p-3 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
                style={{
                  left: `${Math.min(
                    Math.max(svgCurve.points[hoveredMonthIndex].x / (svgCurve.width / 100), 10),
                    82
                  )}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="font-bold text-[var(--on-surface)] mb-1.5 font-display flex items-center justify-between gap-4">
                  <span>{svgCurve.points[hoveredMonthIndex].full}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                    BY {selectedYear}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex items-center justify-between gap-4 text-[var(--on-surface-muted)]">
                    <span>Brief Inflow:</span>
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
                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] uppercase font-bold text-[var(--on-surface-subtle)]">Fulfillment:</span>
                    <span className="font-bold text-[var(--accent-primary)] tabular-nums">
                      {svgCurve.points[hoveredMonthIndex].slaRate}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Expandable Monthly Numbers */}
          {showMonthlyTable && (
            <div className="overflow-x-auto pt-3 border-t border-[var(--border-subtle)] animate-in fade-in duration-200">
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
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${m.slaRate >= 90
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-500/20"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/20"
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

        {/* ── 5. CREATIVE TEAM MEMBERS AUDIT (HEAD VIEW) ── */}
        {isHeadRole && (
          <section id="creative-team" className="scroll-mt-16 p-4 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Creative Team Performance &amp; Assignment Audit</span>
                </h2>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Leadership audit showing brief volume, active pipeline, drafts, and turnaround SLA across studio coordinators.
                </p>
              </div>

              {selectedMemberFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedMemberFilter("all")}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-xs text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>Clear Member Scope</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)]">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3 text-right">Total Briefs</th>
                    <th className="py-2.5 px-3 text-right">Active In Concept</th>
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
                        No team members or brief assignments found for Business Year {selectedYear}.
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
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold border cursor-pointer transition-colors ${isSelected
                                ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)] shadow-2xs"
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

        {/* ── 6. TOP CUSTOMER ACCOUNT PORTFOLIOS ── */}
        <section id="creative-accounts" className="scroll-mt-16 p-4 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div>
            <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Top Customer Account Portfolios</span>
            </h3>
            <p className="text-xs text-[var(--on-surface-muted)]">
              Client accounts with the highest creative project volume and turnaround SLA health.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[10px] font-mono uppercase text-[var(--on-surface-muted)]">
                  <th className="py-2.5 px-3">Customer Account</th>
                  <th className="py-2.5 px-3 text-right">Total Requests</th>
                  <th className="py-2.5 px-3 text-right">In Production</th>
                  <th className="py-2.5 px-3 text-right">Delayed</th>
                  <th className="py-2.5 px-3">On-Time Fulfillment Rate</th>
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
                      <td className="py-3 px-3 font-semibold text-[var(--on-surface)] font-sans">
                        {account.name}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">
                        {account.total}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--on-surface-muted)] tabular-nums">
                        {account.active}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                        {account.delayed}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 w-36">
                          <div className="flex-1 bg-[var(--surface-low)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${account.onTimeRate}%` }}
                            />
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${account.onTimeRate >= 90
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

        {/* ── 7. DETAILED CREATIVE WATCHLIST TABLE ── */}
        <section id="creative-watchlist" className="scroll-mt-16 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs overflow-hidden">
          {/* Header with Search and Segmented Filters */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <Flame className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Creative Request Pipeline Watchlist</span>
                <span className="text-xs font-mono font-normal text-[var(--on-surface-subtle)]">
                  ({filteredWatchlist.length} records shown)
                </span>
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Line-by-line inspection of individual creative briefs, artwork requests, and CAD mockups.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented Filter Pills */}
              <div className="inline-flex rounded-xl bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)] text-xs font-medium shadow-2xs">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("all")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${watchlistFilter === "all"
                    ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                    }`}
                >
                  All ({telemetry.total})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("drafts")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${watchlistFilter === "drafts"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold shadow-2xs border border-amber-500/20"
                    : "text-[var(--on-surface-muted)] hover:text-amber-600"
                    }`}
                >
                  Drafts ({telemetry.totalDrafts})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("concept")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${watchlistFilter === "concept"
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold shadow-2xs border border-purple-500/20"
                    : "text-[var(--on-surface-muted)] hover:text-purple-600"
                    }`}
                >
                  In Production ({telemetry.totalInProduction})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("review")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${watchlistFilter === "review"
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold shadow-2xs border border-indigo-500/20"
                    : "text-[var(--on-surface-muted)] hover:text-indigo-600"
                    }`}
                >
                  Needs Action ({telemetry.totalClientReview})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("delayed")}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${watchlistFilter === "delayed"
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold shadow-2xs border border-rose-500/20"
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
                  <th className="py-2.5 px-4">Ref Code</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Product Description</th>
                  <th className="py-2.5 px-3">Designer / Creator</th>
                  <th className="py-2.5 px-3">Target Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isLoading ? (
                  <TableSkeletonRows columns={7} rows={6} />
                ) : filteredWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        title="No creative projects found"
                        description={
                          searchTerm
                            ? `No records match the query "${searchTerm}".`
                            : "No creative projects match the selected filter."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredWatchlist.slice(0, 25).map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        if (item.rawBrief) onInspectBrief(item.rawBrief);
                        else if (item.rawReq) onInspectRequest(item.rawReq);
                      }}
                      className="hover:bg-[var(--surface-low)] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <CopyBadge text={item.refCode} />
                      </td>
                      <td className="py-3 px-3 font-semibold text-[var(--on-surface)] whitespace-nowrap">
                        {item.customer || "—"}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate text-[var(--on-surface)] font-medium">
                        <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {item.title}
                        </span>
                        {item.trend && (
                          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-low)] text-[var(--on-surface-muted)]">
                            {item.trend}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface-muted)] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[var(--surface-low)] border border-[var(--border-subtle)] text-[9px] flex items-center justify-center font-bold text-[var(--accent-primary)]">
                            {(item.designer || item.createdBy || "U")[0]}
                          </span>
                          <span>{item.designer || item.createdBy || "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {item._isDelayed ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <Clock className="w-3 h-3" />
                            <span>{item.dueDate}</span>
                          </span>
                        ) : (
                          <span className="text-[var(--on-surface-muted)]">
                            {item.dueDate || "Standard"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusPill status={item.status} size="sm" showDot />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.rawBrief) onInspectBrief(item.rawBrief);
                            else if (item.rawReq) onInspectRequest(item.rawReq);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium text-xs transition-colors cursor-pointer shadow-2xs group-hover:border-[var(--accent-primary)]"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredWatchlist.length > 25 && (
            <div className="p-3 text-center border-t border-[var(--border-subtle)] text-xs text-[var(--on-surface-muted)] font-mono">
              Showing first 25 of {filteredWatchlist.length} records. Filter or search to narrow results.
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default CreativeOverviewPage;
