import React, { useEffect, useState, useRef } from "react";
import { UserProfile } from "@/features/auth";
import { hasWorkflowTeam, isAdmin } from "@/features/auth/permissions";
import { getNavigationGroupsForUser, NavigationItem, NavigationSubItem } from "./navigation";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { fetchSidebarBadges } from "./sidebarBadges";
import logoImg from "@/assets/logo.png";
import {
  CircleGauge,
  BriefcaseBusiness,
  PenTool,
  Shapes,
  Boxes,
  CircleDollarSign,
  Building2,
  Users,
  Settings2,
  BookOpen,
  LogOut,
  X,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

// Canonical ultra-modern Lucide icons mapped strictly per department
const ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: CircleGauge,
  operations: CircleGauge,
  marketing: BriefcaseBusiness,
  creative: PenTool,
  studio: Shapes,
  samp: Boxes,
  costing: CircleDollarSign,
  plant: Building2,
  members: Users,
  settings: Settings2,
  help: BookOpen,
};

export interface SidebarProps {
  user?: UserProfile | null;
  onLogout?: () => void;
  selectedPath: string;
  onSelectPath: (path: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  selectedPath,
  onSelectPath,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { selectedYear } = useBusinessYear();
  const [dynamicBadges, setDynamicBadges] = useState<Record<string, number>>({});
  const [badgeRefreshVersion, setBadgeRefreshVersion] = useState(0);
  const navigationGroups = user ? getNavigationGroupsForUser(user) : [];
  const admin = isAdmin(user);
  const canSeeMarketing = Boolean(user && (admin || hasWorkflowTeam(user, "marketing")));
  const canSeeSamp = Boolean(user && (admin || hasWorkflowTeam(user, "samp")));
  const canSeeCreativeStudio = Boolean(user && (admin || hasWorkflowTeam(user, "creative_studio")));
  const canSeeCosting = Boolean(user && (admin || hasWorkflowTeam(user, "costing")));
  const canSeePlant = Boolean(user && (admin || hasWorkflowTeam(user, "plant")));

  // Sidebar width collapsed rail state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("samp_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebarWidth = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("samp_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Dispatch window resize event so responsive grids, tables & charts re-adapt smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 280);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  // Single active accordion state: only ONE team is expanded at a time!
  // When switching from Marketing to Creative, Marketing automatically collapses.
  const [expandedSection, setExpandedSection] = useState<string | null>("marketing");

  const isItemActive = (item: NavigationItem) => {
    if (selectedPath === item.path) return true;
    if (selectedPath.startsWith(`${item.path}/`)) return true;
    if (
      item.aliases &&
      item.aliases.some(
        (alias) => selectedPath === alias || selectedPath.startsWith(`${alias}/`)
      )
    ) return true;
    return false;
  };

  const isSubItemActive = (sub: NavigationSubItem, parent: NavigationItem) => {
    if (selectedPath === sub.path) return true;
    if (sub.path !== parent.path && selectedPath.startsWith(sub.path)) return true;
    return false;
  };

  // Auto-expand the newly active section on route transition (and collapse previous)
  const prevPathRef = useRef(selectedPath);
  useEffect(() => {
    if (prevPathRef.current !== selectedPath) {
      prevPathRef.current = selectedPath;
      let matchedSectionId: string | null = null;
      for (const group of navigationGroups) {
        for (const item of group.items) {
          if ((item.subItems || item.subTeams) && isItemActive(item)) {
            matchedSectionId = item.id;
            break;
          }
        }
        if (matchedSectionId) break;
      }
      if (matchedSectionId) {
        setExpandedSection(matchedSectionId);
      }
    }
  }, [selectedPath, navigationGroups]);

  const toggleSection = (itemId: string) => {
    setExpandedSection((prev) => (prev === itemId ? null : itemId));
  };

  useEffect(() => {
    const refreshBadges = () => setBadgeRefreshVersion((version) => version + 1);
    window.addEventListener("samp:requests-changed", refreshBadges);
    window.addEventListener("samp:design-workflow-updated", refreshBadges);
    window.addEventListener("focus", refreshBadges);
    return () => {
      window.removeEventListener("samp:requests-changed", refreshBadges);
      window.removeEventListener("samp:design-workflow-updated", refreshBadges);
      window.removeEventListener("focus", refreshBadges);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const access = {
      marketing: canSeeMarketing,
      samp: canSeeSamp,
      creativeStudio: canSeeCreativeStudio,
      costing: canSeeCosting,
      plant: canSeePlant,
    };
    if (!Object.values(access).some(Boolean)) {
      setDynamicBadges({});
      return () => { cancelled = true; };
    }

    void fetchSidebarBadges(selectedYear, access).then((badges) => {
      if (!cancelled) setDynamicBadges(badges);
    }).catch(() => {
      if (!cancelled) setDynamicBadges({});
    });

    return () => { cancelled = true; };
  }, [
    badgeRefreshVersion,
    canSeeMarketing,
    canSeeSamp,
    canSeeCreativeStudio,
    canSeeCosting,
    canSeePlant,
    selectedYear,
  ]);

  // Escape to close mobile
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCloseMobile) onCloseMobile();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Lock body scroll for mobile drawer
  useEffect(() => {
    if (!isMobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isMobileOpen]);

  const handleItemClick = (item: NavigationItem) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      try {
        localStorage.setItem("samp_sidebar_collapsed", "false");
      } catch {}
      setExpandedSection(item.id);
      onSelectPath(item.path);
      if (onCloseMobile) onCloseMobile();
      return;
    }

    const hasChildren = Boolean(
      (item.subItems && item.subItems.length > 0) ||
      (item.subTeams && item.subTeams.length > 0)
    );

    if (hasChildren) {
      if (expandedSection === item.id) {
        // Toggle collapse if already open
        setExpandedSection(null);
      } else {
        // Expand this team and automatically un-expand / collapse the previous team!
        setExpandedSection(item.id);
        onSelectPath(item.path);
        if (onCloseMobile) onCloseMobile();
      }
    } else {
      // Navigating to standalone section: collapse any open accordion
      setExpandedSection(null);
      onSelectPath(item.path);
      if (onCloseMobile) onCloseMobile();
    }
  };

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel = isAdmin(user) ? "Admin" : user?.team || user?.sub_role || user?.role || "Member";

  const renderNavContent = (isDrawer = false) => {
    const compact = isCollapsed && !isDrawer;

    return (
      <div className="flex flex-col h-full select-none bg-[var(--sidebar-surface)]">
        {/* ── Brand Header (Clean, Proper Size Logo + Smooth Collapse Toggle) ── */}
        <div className="flex items-center justify-between shrink-0 h-14 px-3.5 bg-[var(--sidebar-surface)] border-b border-[var(--border-subtle)] relative overflow-hidden">
          {/* Brand Logo & Name */}
          <div
            className={`flex items-center gap-2.5 min-w-0 transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${
              compact ? "max-w-0 opacity-0 -translate-x-3 pointer-events-none" : "max-w-[170px] opacity-100 translate-x-0"
            }`}
          >
            <img
              src={logoImg}
              alt="Navneet"
              className="h-5 w-auto max-w-[82px] object-contain object-left shrink-0"
            />
            <span className="h-3.5 w-px bg-[var(--border-subtle)] shrink-0" aria-hidden="true" />
            <span className="font-display font-bold text-xs tracking-tight text-[var(--sidebar-text)] shrink-0">
              SAMP
            </span>
          </div>

          {/* Toggle Action (Right in full mode, Centered in compact mode) */}
          <div className={`flex items-center transition-all duration-250 ${compact ? "w-full justify-center" : ""}`}>
            {!isDrawer && (
              <button
                type="button"
                onClick={toggleSidebarWidth}
                title={compact ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--sidebar-text-subtle)] hover:bg-[var(--sidebar-surface-raised)] hover:text-[var(--sidebar-text)] transition-all cursor-pointer focus-visible:outline-none"
              >
                {compact ? (
                  <ChevronsRight className="w-4.5 h-4.5" />
                ) : (
                  <ChevronsLeft className="w-4 h-4" />
                )}
              </button>
            )}

            {isDrawer && onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation"
                className="w-7.5 h-7.5 rounded-lg flex items-center justify-center text-[var(--sidebar-text-subtle)] hover:bg-[var(--sidebar-surface-raised)] hover:text-[var(--sidebar-text)] transition-colors cursor-pointer focus-visible:outline-none"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Nav Scroll Area ── */}
        <div className={`flex-1 overflow-y-auto scrollbar-hidden space-y-4 py-2 transition-all duration-250 ${compact ? "px-2" : "px-3"}`}>
          {navigationGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1">
              {/* Clean Group Header */}
              <div
                className={`flex items-center transition-all duration-200 overflow-hidden ${
                  compact ? "h-2 px-1 justify-center" : "px-2.5 pt-2.5 pb-1"
                }`}
              >
                {!compact ? (
                  <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--sidebar-text-subtle)]/75 font-sans truncate">
                    {group.groupTitle}
                  </span>
                ) : (
                  <span className="w-4 h-px bg-[var(--border-subtle)]/80" />
                )}
              </div>

              {/* Nav Items */}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isItemActive(item);
                  const isExpanded = expandedSection === item.id;
                  const IconComponent = ITEM_ICONS[item.id] || ITEM_ICONS[item.departmentKey];
                  const badgeValue = dynamicBadges[item.id];
                  const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                  const hasSubTeams = Boolean(!item.subItems && item.subTeams && item.subTeams.length > 0);

                  return (
                    <div key={item.id} className="relative group transition-all duration-150">
                      {/* Unified Adaptive Nav Row */}
                      <div
                        onClick={() => handleItemClick(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleItemClick(item);
                          }
                        }}
                        className={`w-full flex items-center h-9 rounded-xl cursor-pointer select-none text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-accent)] focus-visible:ring-offset-1 ${
                          compact ? "justify-center px-0" : "px-2.5 gap-2.5"
                        } ${
                          active
                            ? "bg-[var(--sidebar-accent)]/[0.09] text-[var(--sidebar-text)] font-semibold shadow-2xs border border-[var(--sidebar-accent)]/15"
                            : "bg-transparent hover:bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] font-medium border border-transparent"
                        }`}
                      >
                        {/* Leading Icon (Steady anchor) */}
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center relative">
                          {IconComponent && (
                            <IconComponent
                              className={`w-4.5 h-4.5 transition-transform duration-150 ${
                                active
                                  ? "text-[var(--sidebar-accent)] stroke-[2.1]"
                                  : "text-[var(--sidebar-text-subtle)] group-hover:text-[var(--sidebar-text)] group-hover:scale-105 stroke-[1.8]"
                              }`}
                            />
                          )}
                          {compact && badgeValue !== undefined && badgeValue > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--sidebar-surface)]" />
                          )}
                        </div>

                        {/* Title & Badges */}
                        <div
                          className={`flex-1 flex items-center justify-between min-w-0 transition-all duration-200 overflow-hidden ${
                            compact
                              ? "max-w-0 opacity-0 -translate-x-2 pointer-events-none"
                              : "max-w-[190px] opacity-100 translate-x-0"
                          }`}
                        >
                          <span
                            className={`overflow-hidden text-ellipsis whitespace-nowrap text-[13px] tracking-tight transition-colors duration-150 ${
                              active
                                ? "font-semibold text-[var(--sidebar-text)]"
                                : "font-medium text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)]"
                            }`}
                          >
                            {item.title}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0 ml-auto pl-1">
                            {badgeValue !== undefined && badgeValue > 0 && (
                              <span
                                className={`rounded-full px-1.5 py-0.2 text-[9.5px] font-mono font-bold tabular-nums transition-colors duration-150 ${
                                  active
                                    ? "bg-[var(--sidebar-accent)] text-white shadow-2xs"
                                    : "bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text-muted)]"
                                }`}
                                aria-label={`${badgeValue} requests`}
                              >
                                {badgeValue}
                              </span>
                            )}

                            {(hasSubItems || hasSubTeams) && (
                              <span
                                role="button"
                                tabIndex={0}
                                title={isExpanded ? "Collapse section" : "Expand section"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSection(item.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.stopPropagation();
                                    toggleSection(item.id);
                                  }
                                }}
                                className="w-4.5 h-4.5 flex items-center justify-center rounded-md text-[var(--sidebar-text-subtle)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-surface-raised)] transition-all cursor-pointer shrink-0"
                                aria-label={isExpanded ? "Collapse section" : "Expand section"}
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                    isExpanded ? "rotate-0 text-[var(--sidebar-text)]" : "-rotate-90 text-[var(--sidebar-text-subtle)]"
                                  }`}
                                />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Floating Tooltip in Collapsed Mode */}
                      {compact && (
                        <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-medium shadow-2xl backdrop-blur-md z-50 whitespace-nowrap pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95">
                          <span className="font-sans">{item.title}</span>
                          {badgeValue !== undefined && badgeValue > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-mono text-[9px] font-bold">
                              {badgeValue}
                            </span>
                          )}
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-slate-900/95 rotate-45" />
                        </div>
                      )}

                      {/* Sub-items (Clean typography, NO icons) */}
                      {!compact && hasSubItems && (
                        <div
                          className={`grid transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isExpanded
                              ? "grid-rows-[1fr] opacity-100 mt-1 mb-1.5"
                              : "grid-rows-[0fr] opacity-0 my-0 pointer-events-none"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-4 pl-2.5 border-l border-[var(--border-subtle)] flex flex-col gap-0.5 py-0.5">
                              {item.subItems!.map((sub) => {
                                const isSubActive = isSubItemActive(sub, item);
                                const subBadge = sub.badgeKey ? dynamicBadges[sub.badgeKey] : undefined;

                                return (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={() => {
                                      onSelectPath(sub.path);
                                      if (onCloseMobile) onCloseMobile();
                                    }}
                                    className={`group/sub w-full flex items-center justify-between gap-2 h-7.5 px-2.5 rounded-lg cursor-pointer select-none text-left transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-accent)] ${
                                      isSubActive
                                        ? "bg-[var(--sidebar-accent)]/[0.09] text-[var(--sidebar-accent)] font-semibold border border-[var(--sidebar-accent)]/15 shadow-2xs"
                                        : "bg-transparent hover:bg-[var(--sidebar-surface-raised)]/80 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] font-medium border border-transparent"
                                    }`}
                                    aria-current={isSubActive ? "page" : undefined}
                                  >
                                    <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                                      <span
                                        className={`overflow-hidden text-ellipsis whitespace-nowrap text-[12px] tracking-tight transition-colors duration-150 ${
                                          isSubActive
                                            ? "font-semibold text-[var(--sidebar-accent)]"
                                            : "font-medium text-[var(--sidebar-text-muted)] group-hover/sub:text-[var(--sidebar-text)]"
                                        }`}
                                      >
                                        {sub.title}
                                      </span>
                                    </div>
                                    {subBadge !== undefined && subBadge > 0 && (
                                      <span
                                        className={`shrink-0 rounded-full px-1.5 py-0.2 text-[9.5px] font-mono font-bold tabular-nums transition-colors duration-150 ${
                                          isSubActive
                                            ? "bg-[var(--sidebar-accent)] text-white shadow-2xs"
                                            : "bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text-muted)]"
                                        }`}
                                        aria-label={`${subBadge} requests`}
                                      >
                                        {subBadge}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SubTeams (Clean typography, NO icons) */}
                      {!compact && hasSubTeams && (
                        <div
                          className={`grid transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            isExpanded
                              ? "grid-rows-[1fr] opacity-100 mt-1 mb-1.5"
                              : "grid-rows-[0fr] opacity-0 my-0 pointer-events-none"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-4 pl-2.5 border-l border-[var(--border-subtle)] flex flex-col gap-0.5 py-0.5">
                              {item.subTeams!.map((sub, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex items-center h-7 px-2.5 rounded-lg text-xs text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-surface-raised)]/60 transition-colors"
                                >
                                  <span className="overflow-hidden text-ellipsis whitespace-nowrap font-medium text-[11.5px]">{sub}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Bottom User Card ── */}
        <div className="p-2.5 bg-[var(--sidebar-surface)] shrink-0 border-t border-[var(--border-subtle)]/70 relative group">
          <div
            className={`flex items-center rounded-xl bg-[var(--sidebar-surface-raised)]/80 hover:bg-[var(--sidebar-surface-raised)] transition-all ${
              compact ? "justify-center p-1.5" : "gap-2.5 p-2"
            }`}
          >
            {/* Initials Avatar */}
            <div
              className="w-8 h-8 rounded-lg shrink-0 bg-gradient-to-br from-[#1b4332] to-[#285e48] text-white font-bold text-xs font-display flex items-center justify-center shadow-xs cursor-default"
              title={`${user?.name || "User"} (${roleLabel})`}
            >
              {initials}
            </div>

            {/* User details */}
            <div
              className={`flex-1 min-w-0 transition-all duration-200 overflow-hidden ${
                compact ? "max-w-0 opacity-0 pointer-events-none" : "max-w-[130px] opacity-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--sidebar-text)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {user?.name || "User"}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              </div>
              <span className="block text-[10px] text-[var(--sidebar-text-subtle)] overflow-hidden text-ellipsis whitespace-nowrap font-sans font-medium uppercase tracking-tight">
                {roleLabel}
              </span>
            </div>

            {/* Logout Action */}
            {onLogout && !compact && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                aria-label="Sign out"
                className="rounded-lg p-1.5 text-[var(--sidebar-text-subtle)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 focus-visible:outline-none"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Floating Tooltip in Collapsed Mode for User */}
          {compact && (
            <div className="absolute left-[calc(100%+10px)] bottom-2 hidden md:group-hover:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/95 text-white text-xs font-medium shadow-2xl backdrop-blur-md z-50 whitespace-nowrap pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95">
              <span>{user?.name || "User"}</span>
              <span className="text-[10px] text-slate-400">({roleLabel})</span>
              <span className="absolute -left-1 bottom-3 w-2 h-2 bg-slate-900/95 rotate-45" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar with buttery-smooth hardware-accelerated width transition */}
      <aside
        className="app-sidebar-viewport hidden md:flex flex-col sticky top-0 shrink-0 z-30 h-screen transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border-r border-[var(--border-subtle)]"
        style={{ width: isCollapsed ? 64 : 244 }}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="fixed inset-y-0 left-0 z-50 flex flex-col shadow-2xl h-screen" style={{ width: 244 }}>
            {renderNavContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
