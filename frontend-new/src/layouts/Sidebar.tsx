import React, { useEffect, useState } from "react";
import { UserProfile } from "@/features/auth";
import { hasWorkflowTeam, isAdmin } from "@/features/auth/permissions";
import { getNavigationGroupsForUser, NavigationItem } from "./navigation";
import { useBusinessYear } from "@/context/BusinessYearContext";
import {
  fetchFeasibilityRequestsApi,
  fetchProgramRequestsApi,
  fetchCostingWorkflowsApi,
} from "@/infrastructure/api";
import logoImg from "@/assets/logo.png";
import {
  Activity,
  Layers,
  Palette,
  Box,
  FlaskConical,
  Calculator,
  Factory,
  Users,
  Settings,
  HelpCircle,
  LogOut,
  X,
} from "lucide-react";

// Canonical approved Lucide icons mapped strictly per department
const ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: Activity,
  operations: Activity,
  marketing: Layers,
  creative: Palette,
  studio: Box,
  samp: FlaskConical,
  costing: Calculator,
  plant: Factory,
  members: Users,
  settings: Settings,
  help: HelpCircle,
};

// Clean enterprise navigation button with smooth active transitions
const NavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  "aria-current"?: "page";
  children: React.ReactNode;
}> = ({ active, onClick, children, ...rest }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full flex items-center justify-between gap-2.5 h-[38px] px-3 rounded-xl cursor-pointer select-none text-left transition-all duration-200 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1 ${
        active
          ? "bg-[var(--sidebar-accent-subtle)] text-[var(--sidebar-accent)] font-semibold shadow-2xs"
          : "bg-transparent hover:bg-[var(--sidebar-surface-raised)]/70 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] font-medium"
      }`}
      {...rest}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--accent-primary)] transition-all duration-200" />
      )}
      {children}
    </button>
  );
};

const SubNavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 h-7 px-2.5 rounded-lg cursor-pointer select-none text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${
        active
          ? "bg-[var(--sidebar-accent-subtle)] text-[var(--sidebar-accent)] font-semibold"
          : "bg-transparent hover:bg-[var(--sidebar-surface-raised)]/60 text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] font-normal"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </button>
  );
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
  const canSeeRequests = Boolean(
    user && (
      admin ||
      hasWorkflowTeam(user, "marketing") ||
      hasWorkflowTeam(user, "samp") ||
      hasWorkflowTeam(user, "plant")
    )
  );
  const canSeeCreativeCosting = Boolean(user && (admin || hasWorkflowTeam(user, "creative_studio")));

  useEffect(() => {
    const refreshBadges = () => setBadgeRefreshVersion((version) => version + 1);
    window.addEventListener("samp:requests-changed", refreshBadges);
    window.addEventListener("focus", refreshBadges);
    return () => {
      window.removeEventListener("samp:requests-changed", refreshBadges);
      window.removeEventListener("focus", refreshBadges);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!canSeeRequests) {
      setDynamicBadges({});
      return () => { cancelled = true; };
    }

    Promise.all([
      fetchFeasibilityRequestsApi({ year: selectedYear }).catch(() => []),
      fetchProgramRequestsApi(selectedYear).catch(() => []),
    ]).then(([feasibilityRequests, programRequests]) => {
      if (cancelled) return;

      const feasibilityCount = feasibilityRequests.length;
      const programCount = programRequests.length;
      const totalRequestCount = feasibilityCount + programCount;

      setDynamicBadges({
        marketing: totalRequestCount,
        pendingFeas: feasibilityCount,
        programs: programCount,
        samp: totalRequestCount,
        sampFeasibility: feasibilityCount,
        sampPrograms: programCount,
        plant: programCount,
        plantPrograms: programCount,
      });
    });

    return () => { cancelled = true; };
  }, [badgeRefreshVersion, canSeeRequests, selectedYear]);

  useEffect(() => {
    let cancelled = false;
    if (!canSeeCreativeCosting) {
      setDynamicBadges((current) => {
        if (!("creativeCosting" in current)) return current;
        const next = { ...current };
        delete next.creativeCosting;
        return next;
      });
      return () => { cancelled = true; };
    }

    fetchCostingWorkflowsApi(selectedYear, "creative").then((requests) => {
      if (!cancelled) setDynamicBadges((current) => ({ ...current, creativeCosting: requests.length }));
    }).catch(() => {
      if (!cancelled) setDynamicBadges((current) => ({ ...current, creativeCosting: 0 }));
    });
    return () => { cancelled = true; };
  }, [badgeRefreshVersion, canSeeCreativeCosting, selectedYear]);

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
    onSelectPath(item.path);
    if (onCloseMobile) onCloseMobile();
  };

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

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel = isAdmin(user) ? "Admin" : user?.team || user?.sub_role || user?.role || "Member";

  const renderNavContent = (isDrawer = false) => (
    <div className="flex flex-col h-full select-none bg-[var(--sidebar-surface)]">
      {/* ── Brand Header (Navneet Logo + SAMP Brand) ── */}
      <div className="flex items-center justify-between shrink-0 h-14 px-4 bg-[var(--sidebar-surface)] border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={logoImg}
            alt="Navneet"
            className="h-6 w-auto max-w-[105px] object-contain object-left"
          />
          <span className="h-4 w-px bg-[var(--border-subtle)] shrink-0" aria-hidden="true" />
          <span className="font-display font-bold text-sm tracking-tight text-[var(--sidebar-text)] shrink-0">
            SAMP
          </span>
        </div>

        {isDrawer && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--sidebar-text-subtle)] hover:bg-[var(--sidebar-surface-raised)] hover:text-[var(--sidebar-text)] transition-colors cursor-pointer focus-visible:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Nav Scroll Area ── */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden px-3 py-2 space-y-4">
        {navigationGroups.map((group) => (
          <div key={group.groupTitle} className="space-y-1">
            {/* Group Label */}
            <div className="px-2.5 py-1">
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-[var(--sidebar-text-subtle)] font-mono">
                {group.groupTitle}
              </span>
            </div>

            {/* Nav Items */}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isItemActive(item);
                const IconComponent = ITEM_ICONS[item.id] || ITEM_ICONS[item.departmentKey];
                const badgeValue = dynamicBadges[item.id];

                return (
                  <div key={item.id}>
                    <NavButton
                      active={active}
                      onClick={() => handleItemClick(item)}
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                        {IconComponent && (
                          <IconComponent
                            className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                              active
                                ? "text-[var(--sidebar-accent)]"
                                : "text-[var(--sidebar-text-subtle)] group-hover:text-[var(--sidebar-text)]"
                            }`}
                          />
                        )}
                        <span
                          className={`overflow-hidden text-ellipsis whitespace-nowrap text-[13px] tracking-tight transition-colors duration-200 ${
                            active
                              ? "font-semibold text-[var(--sidebar-text)]"
                              : "font-medium text-[var(--sidebar-text-muted)] group-hover:text-[var(--sidebar-text)]"
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>

                      {badgeValue !== undefined && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold tabular-nums transition-colors duration-200 ${
                            active
                              ? "bg-[var(--sidebar-accent)] text-[var(--on-accent-primary)]"
                              : "bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text-muted)]"
                          }`}
                          aria-label={`${badgeValue} requests`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </NavButton>

                    {/* Sub-items (smooth nested items when active) */}
                    {active && item.subItems && item.subItems.length > 0 && (
                      <div className="my-1 ml-4 pl-3 border-l border-[var(--border-subtle)] flex flex-col gap-0.5 transition-all duration-200">
                        {item.subItems.map((sub) => {
                          const isSubActive = selectedPath === sub.path || (sub.path !== item.path && selectedPath.startsWith(sub.path));
                          const subBadge = sub.badgeKey ? dynamicBadges[sub.badgeKey] : undefined;
                          return (
                            <SubNavButton
                              key={sub.id}
                              active={isSubActive}
                              onClick={() => {
                                onSelectPath(sub.path);
                                if (onCloseMobile) onCloseMobile();
                              }}
                            >
                              <div className="flex items-center min-w-0 flex-1 overflow-hidden">
                                <span
                                  className={`overflow-hidden text-ellipsis whitespace-nowrap text-xs transition-colors duration-150 ${
                                    isSubActive
                                      ? "font-semibold text-[var(--sidebar-accent)]"
                                      : "font-normal text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
                                  }`}
                                >
                                  {sub.title}
                                </span>
                              </div>
                              {subBadge !== undefined && (
                                <span
                                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums transition-colors duration-150 ${
                                    isSubActive
                                      ? "bg-[var(--sidebar-accent)] text-[var(--on-accent-primary)]"
                                      : "bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text-muted)]"
                                  }`}
                                  aria-label={`${subBadge} requests`}
                                >
                                  {subBadge}
                                </span>
                              )}
                            </SubNavButton>
                          );
                        })}
                      </div>
                    )}

                    {/* SubTeams (when active and no subItems) */}
                    {active && !item.subItems && item.subTeams && item.subTeams.length > 0 && (
                      <div className="my-1 ml-4 pl-3 border-l border-[var(--border-subtle)] flex flex-col gap-0.5 transition-all duration-200">
                        {item.subTeams.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center h-7 px-2 rounded-lg text-xs text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-surface-raised)]/60 transition-colors"
                          >
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap font-normal">{sub}</span>
                          </div>
                        ))}
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
      <div className="p-3 bg-[var(--sidebar-surface)] shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--sidebar-surface-raised)]/70 hover:bg-[var(--sidebar-surface-raised)] transition-colors">
          <div className="w-8 h-8 rounded-lg shrink-0 bg-[var(--sidebar-accent)] text-[var(--on-accent-primary)] font-bold text-xs font-display flex items-center justify-center shadow-2xs">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--sidebar-text)] overflow-hidden text-ellipsis whitespace-nowrap">
                {user?.name || "User"}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
            </div>
            <span className="block text-[10px] text-[var(--sidebar-text-subtle)] overflow-hidden text-ellipsis whitespace-nowrap font-mono">
              {roleLabel}
            </span>
          </div>
          {onLogout && (
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
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="app-sidebar-viewport hidden md:flex flex-col sticky top-0 shrink-0 z-30 h-screen" style={{ width: 244 }}>
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
