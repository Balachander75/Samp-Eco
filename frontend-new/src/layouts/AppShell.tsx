import React, { useState, useEffect, useRef, useMemo } from "react";
import { UserProfile } from "@/features/auth";
import { isAdmin } from "@/features/auth/permissions";
import { Sidebar } from "./Sidebar";
import { getNavigationTitle } from "./navigation";
import { useBusinessYear } from "@/context/BusinessYearContext";
import { usePlant } from "@/context/PlantContext";
import {
  Menu,
  Calendar,
  Clock,
  X,
  ChevronDown,
  LogOut,
  Palette,
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

  const [isPlantDropdownOpen, setIsPlantDropdownOpen] = useState(false);
  const plantDropdownRef = useRef<HTMLDivElement>(null);

  const {
    selectedPlant,
    setSelectedPlant,
    plantOptions,
    activePlantLabel,
  } = usePlant();

  const plantsList = useMemo(() => [
    {
      code: "ALL",
      name: "Consolidated (All Plants)",
      label: "Consolidated (All Plants)",
    },
    ...plantOptions.map((p) => ({
      code: p.code,
      name: p.name,
      label: p.displayName,
    })),
  ], [plantOptions]);

  const handleSelectPlant = (plantCode: string) => {
    setSelectedPlant(plantCode);
    setIsPlantDropdownOpen(false);
  };

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(target)) {
        setIsYearDropdownOpen(false);
      }
      if (plantDropdownRef.current && !plantDropdownRef.current.contains(target)) {
        setIsPlantDropdownOpen(false);
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

  // Live system date & time sync
  const [currentDateTime, setCurrentDateTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString("en-IN", {
    weekday: "short",
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

  const activeTitle = getNavigationTitle(currentPath);

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
        {/* Enterprise Thematic Utility Top Bar */}
        <header className="app-topbar h-14 bg-[var(--sidebar-surface)] text-[var(--sidebar-text)] flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border-subtle)] shrink-0 z-40 transition-colors duration-200 gap-3">
          {/* Left: Mobile Menu Toggle, Active Workspace Title & Live Status Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2 rounded-xl text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-surface-raised)] transition-colors focus:outline-none cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="font-display font-bold text-sm tracking-tight text-[var(--sidebar-text)] truncate select-none">
                {activeTitle}
              </h1>
              <span className="w-1 h-1 rounded-full bg-[var(--sidebar-text-subtle)]/40 shrink-0 hidden sm:inline" />

              {/* Live System Telemetry Status */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--sidebar-surface-raised)] text-[var(--sidebar-text)] border border-[var(--border-subtle)] shadow-2xs transition-all select-none">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--sidebar-text)]">
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Right: Multi-Plant Selector, Live Date/Time, BY, Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Multi-Plant Scope Selector */}
            <div className="relative" ref={plantDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPlantDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 bg-[var(--sidebar-surface-raised)] hover:bg-[var(--sidebar-surface-raised)]/90 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--sidebar-text)] cursor-pointer transition select-none shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                title="Select active plant scope"
                aria-label={`Plant scope: ${activePlantLabel}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--sidebar-accent)] shrink-0" />
                <span className="text-[10px] text-[var(--sidebar-text-muted)] uppercase font-mono font-semibold hidden md:inline">Plant:</span>
                <span className="font-semibold text-xs truncate max-w-[92px] sm:max-w-[130px] text-[var(--sidebar-text)]">
                  {activePlantLabel}
                </span>
                <ChevronDown className={`w-3 h-3 text-[var(--sidebar-text-muted)] ml-0.5 transition-transform duration-200 ${isPlantDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isPlantDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl z-50 p-1.5 text-xs select-none animate-in fade-in duration-100">
                  <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase text-[var(--on-surface-muted)] font-bold border-b border-[var(--border-subtle)] mb-1">
                    Select Plant Scope
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-0.5">
                    {plantsList.map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => handleSelectPlant(opt.code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition cursor-pointer ${
                          selectedPlant === opt.code
                            ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-semibold"
                            : "hover:bg-[var(--surface-low)] text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] font-medium"
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        {selectedPlant === opt.code && <span className="text-[var(--accent-primary-strong)] font-bold ml-1">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Clock & Date Badge */}
            <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[var(--sidebar-surface-raised)] border border-[var(--border-subtle)] text-xs text-[var(--sidebar-text-muted)] shadow-2xs select-none">
              <div className="flex items-center gap-1.5 text-[var(--sidebar-text-muted)]">
                <Calendar className="w-3.5 h-3.5 text-[var(--sidebar-accent)]" />
                <span className="font-medium text-[11px]">{formattedDate}</span>
              </div>
              <span className="text-[var(--sidebar-text-subtle)]/40">·</span>
              <div className="flex items-center gap-1.5 font-mono font-semibold text-[var(--sidebar-text)]">
                <Clock className="w-3.5 h-3.5 text-[var(--sidebar-accent)]" />
                <span className="tabular-nums text-[11px]">{formattedTime}</span>
              </div>
            </div>

            {/* Business Year Selector */}
            <div className="relative hidden sm:inline-block" ref={yearDropdownRef}>
              <button
                type="button"
                onClick={() => setIsYearDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 bg-[var(--sidebar-surface-raised)] hover:bg-[var(--sidebar-surface-raised)]/90 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--sidebar-text)] font-mono text-xs font-semibold cursor-pointer select-none transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
                title="Business Year (October to September)"
              >
                <span>{selectedYear === "ALL" ? "All Years" : `BY ${selectedYear}`}</span>
                <ChevronDown className={`w-3 h-3 text-[var(--sidebar-text-muted)] transition-transform duration-200 ${isYearDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isYearDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl z-50 p-1.5 text-xs select-none animate-in fade-in duration-100 max-h-72 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear("ALL");
                      setIsYearDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-mono transition cursor-pointer ${
                      selectedYear === "ALL"
                        ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-bold"
                        : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                    }`}
                  >
                    <span>All Business Years</span>
                    <span className="text-[11px] text-[var(--on-surface-subtle)] tabular-nums">{totalRecords.toLocaleString()}</span>
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-mono transition cursor-pointer ${
                          isSelected
                            ? "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] font-bold"
                            : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)]"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>BY {y.year}</span>
                          {y.is_current && <span className="text-[10px] text-[var(--accent-primary-strong)] font-sans font-bold">(Current)</span>}
                        </span>
                        <span className="text-[11px] text-[var(--on-surface-subtle)] tabular-nums">{y.count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User Profile Pill & Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)] cursor-pointer select-none group focus-visible:outline-none"
              >
                <span className="w-8 h-8 rounded-xl bg-[var(--sidebar-accent)] text-[var(--on-accent-primary,white)] font-bold flex items-center justify-center text-xs font-display shadow-2xs group-hover:opacity-90 transition-opacity">
                  {initials}
                </span>
                <span className="hidden xl:inline text-xs font-semibold text-[var(--sidebar-text)] truncate max-w-[120px]">
                  {user?.name || "Admin"}
                </span>
                <ChevronDown className={`w-3 h-3 text-[var(--sidebar-text-muted)] transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[var(--surface-lowest)] text-[var(--on-surface)] border border-[var(--border-subtle)] shadow-xl z-50 p-1.5 text-xs select-none animate-in fade-in duration-100">
                  <div className="px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                    <p className="font-bold text-[var(--on-surface)] truncate font-display">{user?.name}</p>
                    <p className="text-[10px] text-[var(--on-surface-muted)] font-mono">{isAdmin(user) ? "Admin" : user?.team || user?.sub_role || "Member"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate("/settings");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[var(--on-surface-muted)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-low)] rounded-lg transition-colors text-left cursor-pointer font-medium"
                  >
                    <Palette className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Workspace Settings & Themes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-lg transition-colors text-left cursor-pointer font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Toast Alert */}
        {globalToast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs ${globalToast.tone === "error" ? "bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/70 dark:text-rose-100 dark:border-rose-800" : "bg-[var(--accent-primary-subtle)] text-[var(--accent-primary-strong)] border-[var(--border-subtle)]"}`}>
              <span className="w-2 h-2 rounded-full shrink-0 bg-[var(--accent-primary)]" />
              <span className="flex-1 leading-snug font-medium">{globalToast.message}</span>
              <button
                type="button"
                onClick={() => setGlobalToast(null)}
                className="text-current opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition"
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
