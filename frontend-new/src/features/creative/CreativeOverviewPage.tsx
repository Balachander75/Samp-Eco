import React, { useMemo, useState, useEffect } from "react";
import {
  Palette,
  Box,
  Layers,
  CheckCircle2,
  ArrowRight,
  Search,
  Download,
  Building2,
  Users,
  User,
  ShieldCheck,
  FileEdit,
  Send,
  Hourglass,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { CreativeBriefItem, SampleRequestItem } from "@/features/sample-requests/types";
import { UserProfile } from "@/features/auth";
import { fetchUsersApi, UserItem } from "@/infrastructure/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { Select } from "@/components/ui/Select";
import { CopyBadge } from "@/components/ui/CopyBadge";

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

  // Determine if user has Head authority
  const isHeadRole = useMemo(() => {
    if (isAdmin) return true;
    return Boolean(user?.is_team_head);
  }, [isAdmin, user]);

  // Two Persona View Modes:
  // "head": Sees aggregated stats for all creative studio members with member breakdown table
  // "specialist": Focuses strictly on the logged-in user's own briefs/tasks
  const [viewMode, setViewMode] = useState<"head" | "specialist">(() =>
    isHeadRole ? "head" : "specialist"
  );

  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");
  const [watchlistFilter, setWatchlistFilter] = useState<
    "all" | "drafts" | "concept" | "review" | "delayed"
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
        refCode: d.srNumber || d.requestCode || `DSG-${d.id}`,
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

  // Scoped designs based on active persona
  const scopedDesigns = useMemo(() => {
    if (viewMode === "specialist") {
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
  }, [allDesignItems, viewMode, selectedMemberFilter, currentUserName]);

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

  // SVG Spline Curve path math
  const svgCurve = useMemo(() => {
    const width = 800;
    const height = 160;
    const paddingX = 40;
    const paddingY = 24;
    const pts = monthlyTimeline.points;
    const max = Math.max(monthlyTimeline.maxVal, 2);

    const stepX = (width - paddingX * 2) / Math.max(pts.length - 1, 1);

    const mapped = pts.map((pt, i) => {
      const x = paddingX + i * stepX;
      const y = height - paddingY - (pt.inflow / max) * (height - paddingY * 2);
      return { ...pt, x, y };
    });

    if (mapped.length === 0) return { width, height, linePath: "", areaPath: "", points: [] };

    let linePath = `M ${mapped[0].x} ${mapped[0].y}`;
    for (let i = 0; i < mapped.length - 1; i++) {
      const p0 = mapped[i];
      const p1 = mapped[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      linePath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }

    const first = mapped[0];
    const last = mapped[mapped.length - 1];
    const areaPath = `${linePath} L ${last.x} ${height - paddingY} L ${first.x} ${height - paddingY} Z`;

    return {
      width,
      height,
      linePath,
      areaPath,
      points: mapped,
    };
  }, [monthlyTimeline]);

  // Top Customer Account Portfolios (Section 6)
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

  // Watchlist filtered items (Section 7)
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

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[var(--bg-app)] text-[var(--on-surface)] font-sans select-text overflow-y-auto">
      {/* ── 1. GREETING & CONTEXT HEADER (EXACT MARKETING OVERVIEW BLUEPRINT) ── */}
      <header className="px-5 sm:px-8 py-4 bg-[var(--surface-lowest)] border-b border-[var(--border-subtle)] shrink-0 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Greeting & Context */}
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,209,102,0.6)] animate-pulse"
                title="Operational Creative Pipeline Live Sync"
              />
              <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-[var(--on-surface)]">
                {greetingText}, {firstName}! Nice to see you.
              </h1>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--on-surface-muted)] font-mono">
              <span className="font-semibold text-[var(--on-surface)]">
                {isHeadRole ? "Creative Head Executive Console" : "Creative Designer Workspace"}
              </span>
              <span>·</span>
              <span>Business Year {selectedYear === "ALL" ? "Consolidated" : selectedYear}</span>
            </div>
          </div>

          {/* Right Action Toolbar */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* View Mode Toggle (Head vs Specialist) */}
            {isHeadRole && (
              <div className="inline-flex rounded-lg bg-[var(--surface-low)] p-0.5 border border-[var(--border-subtle)] text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("head");
                    setSelectedMemberFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${
                    viewMode === "head"
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
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-colors ${
                    viewMode === "specialist"
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

            {/* In Head View: Designer Selector Dropdown */}
            {isHeadRole && viewMode === "head" && (
              <Select
                aria-label="Filter by creative team member"
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

            {/* Export CSV */}
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

      {/* ── MAIN DASHBOARD BODY (MAX-W-7XL P-5 SM:P-8 SPACE-Y-6) ── */}
      <main className="max-w-7xl w-full mx-auto p-5 sm:p-8 space-y-6">
        {/* ── 2. CREATIVE MULTI-FACTOR KPI RIBBON (IMAGE 1 EXACT MATCH) ── */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Tile 1: Total Team Intake */}
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

          {/* Tile 2: Pending Drafts */}
          <div
            onClick={() => setWatchlistFilter("drafts")}
            className={`p-3.5 rounded-xl bg-[var(--surface-lowest)] border cursor-pointer shadow-2xs transition-colors ${
              telemetry.totalDrafts > 0
                ? "border-amber-300 dark:border-amber-900/60"
                : "border-[var(--border-subtle)]"
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

          {/* Tile 3: In Production */}
          <div
            onClick={() => setWatchlistFilter("concept")}
            className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] cursor-pointer shadow-2xs transition-colors"
          >
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

          {/* Tile 4: Awaiting Decision */}
          <div
            onClick={() => setWatchlistFilter("review")}
            className={`p-3.5 rounded-xl bg-[var(--surface-lowest)] border cursor-pointer shadow-2xs transition-colors ${
              telemetry.totalClientReview > 0
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
              {isLoading ? "—" : telemetry.totalClientReview}
            </div>
            <div className="text-[11px] text-[var(--on-surface-muted)] mt-1 font-mono">
              Needs client verdict
            </div>
          </div>

          {/* Tile 5: Fulfillment SLA */}
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

          {/* Tile 6: Dispatched */}
          <div
            className="p-3.5 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] cursor-pointer shadow-2xs transition-colors"
          >
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

        {/* ── 3. TEAM MEMBERS PERFORMANCE & REQUEST OWNERSHIP (IMAGE 1 SECTION 1) ── */}
        {isHeadRole && viewMode === "head" && (
          <section className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Creative Team Members Performance &amp; Request Ownership</span>
                </h2>
                <p className="text-xs text-[var(--on-surface-muted)]">
                  Leadership audit showing request volume, active pipeline, drafts, and delivery SLA for each creative coordinator.
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
                        No team members or brief assignments found for Business Year {selectedYear}.
                      </td>
                    </tr>
                  ) : (
                    memberAuditMatrix.map((member) => {
                      const isSelected = selectedMemberFilter === member.name;
                      return (
                        <tr
                          key={member.name}
                          className={`hover:bg-[var(--surface-low)] transition-colors ${
                            isSelected ? "bg-[var(--accent-primary-subtle)]/40" : ""
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
                                  className={`h-full rounded-full ${
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
                              className={`px-2 py-1 rounded text-[11px] font-sans font-semibold border cursor-pointer transition-colors ${
                                isSelected
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

        {/* ── 4. INTAKE CURVE & DELIVERY TRAJECTORY SPLINE (IMAGE 1 SECTION 2) ── */}
        <section className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="font-display font-bold text-base text-[var(--on-surface)] tracking-tight">
                  Creative Request Intake Curve &amp; Delivery Trajectory
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
                <linearGradient id="creativeCurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              <line x1="30" y1="30" x2="770" y2="30" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="30" y1="88" x2="770" y2="88" stroke="var(--border-subtle)" strokeDasharray="3 3" />
              <line x1="30" y1="146" x2="770" y2="146" stroke="var(--border-subtle)" />

              {svgCurve.areaPath && <path d={svgCurve.areaPath} fill="url(#creativeCurveGrad)" />}

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
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          m.slaRate >= 90 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
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

        {/* ── 5. CREATIVE WORKSTREAMS & CONSOLES (IDENTICAL DESK CARDS) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight">
                Dedicated Creative Workstreams &amp; Delivery Hubs
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Direct access to artwork briefs, packaging sampling &amp; CAD mockups, and prepress proofing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Stream 1: Artwork & Design Briefs Desk */}
            <div
              onClick={() => onNavigateToTab("design")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-low)] text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        Artwork &amp; Design Briefs Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Graphic Concepts &amp; Themes</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-[var(--surface-low)] text-[var(--on-surface)]">
                    {allDesignItems.length} Briefs
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3 leading-relaxed line-clamp-2">
                  Intake of client artwork requests, brand typography, Shutterstock licensing, and variant generation.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                <span className="font-mono tabular-nums">{allDesignItems.length} Briefs</span>
                <span className="flex items-center gap-0.5">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 2: Sampling & CAD Mockups Desk */}
            <div
              onClick={() => onNavigateToTab("sampling")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-teal-400 cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-low)] text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-teal-600 transition-colors">
                        Sampling &amp; CAD Mockups Desk
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">3D CAD &amp; Dummies</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                    {samplingMockupRequests.length} Tasks
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3 leading-relaxed line-clamp-2">
                  3D mockup simulations, structural parameters, and SAMP physical prototype coordination.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-teal-600 transition-colors">
                <span className="font-mono tabular-nums">{samplingMockupRequests.length} Tasks</span>
                <span className="flex items-center gap-0.5">
                  Open Desk <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Stream 3: Prepress Certification & QC */}
            <div
              onClick={() => onNavigateToTab("design")}
              className="p-4 rounded-xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] hover:border-emerald-400 cursor-pointer shadow-2xs group transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-low)] text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--on-surface)] group-hover:text-emerald-600 transition-colors">
                        Prepress Certification &amp; QC
                      </h4>
                      <span className="text-[10px] text-[var(--on-surface-subtle)] font-mono">Press-Ready Signoff</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {telemetry.totalCompleted} Certified
                  </span>
                </div>
                <p className="text-xs text-[var(--on-surface-muted)] mb-3 leading-relaxed line-clamp-2">
                  Final high-resolution PDF proof verification, plate separations, and plant print authorization.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold text-[var(--on-surface)] group-hover:text-emerald-600 transition-colors">
                <span className="font-mono tabular-nums">{telemetry.totalCompleted} Certified</span>
                <span className="flex items-center gap-0.5">
                  Audit Prepress <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
              Client accounts with the highest creative project volume and turnaround SLA health.
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
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--on-surface)] tabular-nums">
                        {account.total}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--on-surface-muted)] tabular-nums">
                        {account.active}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                        {account.delayed}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2 w-36">
                          <div className="flex-1 bg-[var(--surface-low)] h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
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

        {/* ── 7. DETAILED CREATIVE WATCHLIST TABLE (VIEW MODE) ── */}
        <section className="rounded-2xl bg-[var(--surface-lowest)] border border-[var(--border-subtle)] shadow-2xs overflow-hidden">
          {/* Header with Search and Segmented Filters */}
          <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-bold text-sm text-[var(--on-surface)] tracking-tight flex items-center gap-2">
                <span>Creative Request Pipeline Watchlist</span>
                <span className="text-xs font-mono font-normal text-[var(--on-surface-subtle)]">
                  ({filteredWatchlist.length} records shown)
                </span>
              </h3>
              <p className="text-xs text-[var(--on-surface-muted)]">
                Line-by-line inspection of individual creative briefs and packaging design requests.
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
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    watchlistFilter === "all"
                      ? "bg-[var(--surface-lowest)] text-[var(--on-surface)] font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)]"
                  }`}
                >
                  All ({telemetry.total})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("drafts")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    watchlistFilter === "drafts"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-amber-600"
                  }`}
                >
                  Drafts ({telemetry.totalDrafts})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("concept")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    watchlistFilter === "concept"
                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-purple-600"
                  }`}
                >
                  In Production ({telemetry.totalInProduction})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("review")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    watchlistFilter === "review"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold shadow-2xs"
                      : "text-[var(--on-surface-muted)] hover:text-indigo-600"
                  }`}
                >
                  Needs Action ({telemetry.totalClientReview})
                </button>
                <button
                  type="button"
                  onClick={() => setWatchlistFilter("delayed")}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    watchlistFilter === "delayed"
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
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--on-surface-muted)] font-mono">
                      Loading creative request pipeline...
                    </td>
                  </tr>
                ) : filteredWatchlist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--on-surface-muted)] font-sans">
                      No creative projects match the selected watchlist filter.
                    </td>
                  </tr>
                ) : (
                  filteredWatchlist.slice(0, 15).map((item) => (
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
                        <span className="group-hover:text-purple-600 transition-colors">
                          {item.title}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface-muted)] whitespace-nowrap">
                        {item.designer || item.createdBy || "Unassigned"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--on-surface-muted)] whitespace-nowrap">
                        {item.dueDate || "Standard"}
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
                          className="px-2.5 py-1 rounded bg-[var(--surface-low)] hover:bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--border-subtle)] font-medium text-xs transition cursor-pointer"
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
        </section>
      </main>
    </div>
  );
};

export default CreativeOverviewPage;
