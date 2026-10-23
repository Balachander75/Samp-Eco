import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "@/features/auth";
import { getAssignedWorkspaceTeam, isAdmin, isRootAdmin } from "@/features/auth/permissions";
import { Sidebar } from "./Sidebar";
import { getNavigationTitle } from "./navigation";
import { useBusinessYear } from "@/context/BusinessYearContext";
import {
  Menu,
  Calendar,
  Clock,
  X,
  ChevronDown,
  LogOut,
  Palette,
  ShieldCheck,
} from "lucide-react";

export interface AppShellProps {
  user: UserProfile;
  onLogout: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

interface GlobalToast {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  onLogout,
  currentPath,
  onNavigate,
  children,
}) => {
  const {
    selectedYear,
    setSelectedYear,
    yearsList,
    totalRecords,
  } = useBusinessYear();

  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setIsYearDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [globalToast, setGlobalToast] = useState<GlobalToast | null>(null);

  // Global Toast event subscription & auto-dismiss
  useEffect(() => {
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<GlobalToast>>;
      if (customEvent.detail?.message) {
        setGlobalToast({
          id: String(Date.now()),
          message: customEvent.detail.message,
          tone: customEvent.detail.tone || "info",
        });
      }
    };
    window.addEventListener("app:toast", handleToast);
    return () => window.removeEventListener("app:toast", handleToast);
  }, []);

  useEffect(() => {
    if (!globalToast) return;
    const timer = setTimeout(() => {
      setGlobalToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [globalToast]);

  // Live system date & time sync
  const [currentDateTime, setCurrentDateTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedWeekday = currentDateTime.toLocaleDateString("en-IN", {
    weekday: "short",
  });

  const formattedDate = currentDateTime.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = currentDateTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // User initials (up to 2 chars)
  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const activeTitle = getNavigationTitle(currentPath, user);
  const canManageBusinessYear = isAdmin(user);
  const assignedTeam = getAssignedWorkspaceTeam(user);
  const assignedTeamLabel = assignedTeam
    ? assignedTeam.charAt(0).toUpperCase() + assignedTeam.slice(1)
      : user?.team;
  const userRoleDisplay = isRootAdmin(user)
    ? "Root Admin"
    : isAdmin(user)
      ? `${assignedTeamLabel || "Team"} Admin`
      : user?.team
        ? `${user.team.charAt(0).toUpperCase() + user.team.slice(1)} ${user?.is_team_head ? "Head" : "Member"}`
        : user?.sub_role || "Member";

  return (
    <div className="app-shell flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans transition-colors duration-150">
      {/* Primary Navigation Sidebar */}
      <Sidebar
        user={user}
        onLogout={onLogout}
        selectedPath={currentPath}
        onSelectPath={onNavigate}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Modern Enterprise Header */}
        <header className="app-topbar h-14 bg-[var(--sidebar-surface)] text-[var(--sidebar-text)] flex items-center justify-between px-3 sm:px-5 md:px-6 border-b border-[var(--border-subtle)] shrink-0 z-40 transition-colors duration-200 gap-3">
          {/* Left: Mobile Navigation Drawer Trigger & Active Workspace Title */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2 rounded-xl text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-surface-raised)] active:scale-95 transition-all duration-150 focus:outline-none cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="hidden sm:inline text-[11px] font-mono uppercase tracking-wider text-[var(--sidebar-text-muted)] font-medium">
                Workspace /
              </span>
              <h1 className="font-display font-bold text-sm tracking-tight text-[var(--sidebar-text)] truncate select-none">
                {activeTitle}
              </h1>
            </div>
          </div>

          {/* Right: Beautiful Date/Time, BY Selector, Animated Profile Card */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Live Clock & Date Capsule */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--sidebar-surface-raised)]/80 hover:bg-[var(--sidebar-surface-raised)] border border-[var(--border-subtle)]/75 text-xs text-[var(--sidebar-text-muted)] shadow-2xs transition-all duration-150 select-none group">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--sidebar-accent)] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                <span className="font-medium text-[11px] text-[var(--sidebar-text)] tracking-tight">
                  <span className="text-[var(--sidebar-text-muted)] mr-1">{formattedWeekday},</span>
                  {formattedDate}
                </span>
              </div>
              <span className="w-px h-3 bg-[var(--border-subtle)] shrink-0" />
              <div className="flex items-center gap-1.5 font-mono text-[var(--sidebar-text)]">
                <Clock className="w-3.5 h-3.5 text-[var(--sidebar-accent)] shrink-0 transition-transform duration-200 group-hover:scale-105" />
                <span className="tabular-nums text-[11px] font-semibold tracking-tight">
                  {formattedTime}
                </span>
              </div>
            </div>

            {/* Business Year (BY) Selector */}
            <div className="relative" ref={yearDropdownRef}>
              {canManageBusinessYear ? (
                <button
                  type="button"
                  onClick={() => setIsYearDropdownOpen((prev) => !prev)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold cursor-pointer select-none transition-all duration-150 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] active:scale-[0.98] ${
                    isYearDropdownOpen
                      ? "bg-[var(--sidebar-surface-raised)] border-[var(--sidebar-accent)]/30 text-[var(--sidebar-text)] ring-2 ring-[var(--sidebar-accent)]/10"
                      : "bg-[var(--sidebar-surface-raised)]/80 hover:bg-[var(--sidebar-surface-raised)] border-[var(--border-subtle)]/75 text-[var(--sidebar-text)]"
                  }`}
                  title="Business Year (October to September)"
                  aria-label="Select Business Year"
                  aria-expanded={isYearDropdownOpen}
                >
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-[var(--sidebar-accent)]/15 text-[var(--sidebar-accent)] font-sans">
                    BY
                  </span>
                  <span className="tabular-nums tracking-tight text-[11.5px]">
                    {selectedYear === "ALL" ? "All Years" : selectedYear}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[var(--sidebar-text-muted)] transition-transform duration-200 ${
                      isYearDropdownOpen ? "rotate-180 text-[var(--sidebar-text)]" : ""
                    }`}
                  />
                </button>
              ) : (
                <div
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border-subtle)]/75 bg-[var(--sidebar-surface-raised)]/80 text-xs font-mono font-semibold select-none"
                  title="Selected Business Year (view only)"
                >
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-[var(--sidebar-accent)]/15 text-[var(--sidebar-accent)] font-sans">
                    BY
                  </span>
                  <span className="tabular-nums tracking-tight text-[11.5px]">
                    {selectedYear === "ALL" ? "All Years" : selectedYear}
                  </span>
                </div>
              )}

              {canManageBusinessYear && isYearDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-2xl z-50 p-1.5 text-xs select-none header-dropdown-menu backdrop-blur-xl">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]/60 mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--on-surface-muted)] font-bold">
                      Business Year (FY)
                    </span>
                    <span className="text-[10px] font-mono text-[var(--on-surface-subtle)]">
                      Oct – Sep
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedYear("ALL");
                        setIsYearDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-mono text-xs transition-colors cursor-pointer ${
                        selectedYear === "ALL"
                          ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-bold"
                          : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedYear === "ALL" ? "bg-[var(--accent-primary)]" : "bg-transparent"}`} />
                        <span>All Business Years</span>
                      </div>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-[var(--surface-container)]/70 text-[var(--on-surface-subtle)] tabular-nums font-semibold">
                        {totalRecords.toLocaleString()}
                      </span>
                    </button>

                    {yearsList.map((y) => {
                      const isSelected = selectedYear === y.year;
                      return (
                        <button
                          key={y.year}
                          type="button"
                          onClick={() => {
                            setSelectedYear(y.year);
                            setIsYearDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-mono text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-bold"
                              : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-[var(--accent-primary)]" : "bg-transparent"}`} />
                            <span className="tracking-tight">BY {y.year}</span>
                            {y.is_current && (
                              <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-[var(--surface-container)]/70 text-[var(--on-surface-subtle)] tabular-nums font-semibold">
                            {y.count.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Capsule & Entrance-Animated Dropdown Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex items-center gap-2 pl-2 sm:pl-2.5 py-1 pr-1.5 sm:pr-2.5 rounded-xl border border-transparent cursor-pointer select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] active:scale-[0.98] ${
                  isUserMenuOpen
                    ? "bg-[var(--sidebar-surface-raised)] border-[var(--border-subtle)] shadow-2xs"
                    : "hover:bg-[var(--sidebar-surface-raised)]/70"
                }`}
                title="Account Menu"
                aria-expanded={isUserMenuOpen}
              >
                <div className="relative">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--sidebar-accent)] to-[var(--accent-primary)] text-white font-bold flex items-center justify-center text-xs font-display shadow-2xs tracking-wider">
                    {initials}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--sidebar-surface)]" />
                </div>

                <div className="hidden sm:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-[var(--sidebar-text)] truncate max-w-[110px] md:max-w-[130px]">
                    {user?.name || "Admin"}
                  </span>
                  <span className="text-[10px] text-[var(--sidebar-text-muted)] font-mono truncate max-w-[110px]">
                    {userRoleDisplay}
                  </span>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-[var(--sidebar-text-muted)] transition-transform duration-200 ${
                    isUserMenuOpen ? "rotate-180 text-[var(--sidebar-text)]" : ""
                  }`}
                />
              </button>

              {/* Animated Profile Card Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-2xl shadow-black/15 dark:shadow-black/50 p-2 z-50 select-none header-dropdown-menu backdrop-blur-xl">
                  {/* User Profile Header Tile */}
                  <div className="p-3 rounded-xl bg-[var(--surface-low)]/80 border border-[var(--border-subtle)]/60 mb-1.5 flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--sidebar-accent)] to-[var(--accent-primary)] text-white font-bold flex items-center justify-center text-sm font-display shadow-sm shrink-0">
                      {initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[var(--on-surface)] text-sm truncate font-display leading-tight">
                        {user?.name}
                      </p>
                      <p className="text-[10.5px] text-[var(--on-surface-muted)] font-mono truncate mt-0.5">
                        {user?.email || user?.userid || "Active Session"}
                      </p>
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-mono font-semibold bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)]">
                          <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                          <span>{userRoleDisplay}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-0.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onNavigate("/settings");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] rounded-xl transition-all duration-150 text-left cursor-pointer font-medium text-xs group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[var(--surface-container)] flex items-center justify-center shrink-0 group-hover:bg-[var(--accent-primary-subtle)] transition-colors">
                        <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--on-surface)]">Workspace Themes</div>
                        <div className="text-[10px] text-[var(--on-surface-subtle)] truncate">Customize colors & appearance</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl transition-all duration-150 text-left cursor-pointer font-semibold text-xs group mt-1"
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 group-hover:bg-rose-500/20 transition-colors">
                        <LogOut className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div>Sign Out</div>
                        <div className="text-[10px] text-rose-500/70 font-normal">End your current session</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Toast Alert */}
        {globalToast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs ${globalToast.tone === "error" ? "bg-rose-50 text-rose-950 border-rose-200" : "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] border-[var(--border-subtle)]"}`}>
              <span className="w-2 h-2 rounded-full shrink-0 bg-[var(--accent-primary)]" />
              <span className="flex-1 leading-snug font-medium">{globalToast.message}</span>
              <button
                type="button"
                onClick={() => setGlobalToast(null)}
                className="text-current opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-black/5 cursor-pointer transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Routed View with Silky Smooth Hardware-Accelerated Transitions */}
        <main
          key={currentPath}
          className="flex-1 min-h-0 overflow-hidden flex flex-col page-transition-root"
        >
          {children}
        </main>
      </div>
    </div>
  );
};
