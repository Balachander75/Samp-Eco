import React, { useState, useMemo } from "react";
import {
  User,
  KeyRound,
  Lock,
  Palette,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sliders,
  RefreshCw,
  ShieldCheck,
  Search,
  Layout,
  Copy,
  Building2,
  Layers,
} from "lucide-react";
import { APP_THEMES, useTheme } from "@/context/ThemeContext";
import { readAuthUser } from "@/lib/session";
import {
  changePasswordApi,
  type ChangePasswordPayload,
} from "@/infrastructure/api/userPreferencesApi";

interface StoredUser {
  id?: number;
  name?: string;
  userid?: string;
  email?: string;
  role?: string;
  sub_role?: string;
  team?: string;
  plant_code?: string;
  plant_codes?: string[];
  is_team_head?: boolean;
}

type SettingsTab = "appearance" | "profile" | "security";

export default function SettingsPage({ currentUser: propUser }: { currentUser?: StoredUser } = {}) {
  const { theme, setTheme, saveStatus } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  // Authenticated User Profile from props or session
  const currentUser = propUser || readAuthUser<StoredUser>() || {
    name: "Administrator",
    userid: "Admin",
    email: "parin.dedhia@navneet.com",
    role: "Administrator",
    team: "Core Operations",
    plant_code: "1505",
    plant_codes: ["1505", "1508", "1509"],
  };

  // ── Clipboard Feedback State ──
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Password Change State ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Dynamic Password Strength Calculation ──
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: "Empty", color: "bg-surface-container", text: "text-onSurface-subtle" };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "bg-rose-500", text: "text-rose-500" };
      case 2:
        return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-500" };
      case 3:
        return { score: 3, label: "Good", color: "bg-sky-500", text: "text-sky-500" };
      case 4:
        return { score: 4, label: "Strong", color: "bg-emerald-500", text: "text-emerald-500" };
      default:
        return { score: 0, label: "Very Weak", color: "bg-rose-500", text: "text-rose-500" };
    }
  }, [newPassword]);

  // ── Appearance Filter State ──
  const [themeModeFilter, setThemeModeFilter] = useState<"all" | "light" | "dark">("all");
  const [themeSearchQuery, setThemeSearchQuery] = useState("");

  const filteredThemes = useMemo(() => {
    return APP_THEMES.filter((t) => {
      if (themeModeFilter === "light" && t.mode !== "light") return false;
      if (themeModeFilter === "dark" && t.mode !== "dark") return false;
      if (themeSearchQuery.trim()) {
        const q = themeSearchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.vibe.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.badge && t.badge.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [themeModeFilter, themeSearchQuery]);

  const selectedTheme = useMemo(() => {
    return APP_THEMES.find((option) => option.id === theme) ?? APP_THEMES[0];
  }, [theme]);

  // ── Handle Password Submission ──
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Please enter your current password.",
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: "error",
        message: "New password must be at least 6 characters in length.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "New password and confirmation do not match.",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const payload: ChangePasswordPayload = {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      };
      const res = await changePasswordApi(payload);
      if (res.success) {
        setPasswordFeedback({
          type: "success",
          message: res.message || "Password updated successfully.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordFeedback({
          type: "error",
          message: res.message || "Failed to update password.",
        });
      }
    } catch (err: any) {
      const errorMessage =
        err?.detail?.error?.message ||
        err?.message ||
        "Failed to update password. Please verify your current password.";
      setPasswordFeedback({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userInitials = (currentUser.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-surface-base text-onSurface font-sans select-text">
      {/* ── 1. Clean Executive Header ── */}
      <header className="px-6 sm:px-8 py-3 bg-surface-lowest border-b border-border-subtle flex items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-onSurface tracking-tight font-display">
              Settings
            </h1>
            <p className="text-[11px] text-onSurface-muted">
              Manage your workspace appearance, user identity, and account credentials.
            </p>
          </div>
        </div>

        {/* User Chip & Reload */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface-low border border-border-subtle text-xs">
            <div className="relative">
              <div className="w-5 h-5 rounded bg-accent text-white flex items-center justify-center font-bold text-[10px] font-mono">
                {userInitials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-surface-lowest" />
            </div>
            <span className="font-semibold text-onSurface text-xs">{currentUser.name}</span>
            <span className="text-[10px] font-mono text-onSurface-subtle hidden sm:inline">
              @{currentUser.userid || "user"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Reload settings"
            className="h-7 w-7 rounded-lg border border-border-subtle bg-surface-lowest hover:bg-surface-low flex items-center justify-center text-onSurface-muted hover:text-onSurface transition-all cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* ── 2. Navigation Tabs Strip ── */}
      <div className="bg-surface-lowest border-b border-border-subtle px-6 sm:px-8 flex items-center gap-1 overflow-x-auto select-none no-scrollbar shrink-0">
        {[
          {
            id: "appearance",
            label: "Themes & Appearance",
            icon: Palette,
            count: APP_THEMES.length,
          },
          {
            id: "profile",
            label: "User Profile",
            icon: User,
          },
          {
            id: "security",
            label: "Account Security",
            icon: ShieldCheck,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`py-2.5 px-3.5 border-b-2 text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none ${
                isActive
                  ? "border-accent text-accent font-bold"
                  : "border-transparent text-onSurface-muted hover:text-onSurface font-medium"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "bg-surface-container text-onSurface-subtle"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 3. Main Content Pane ── */}
      <main className="flex-1 overflow-y-auto px-6 sm:px-8 py-5 w-full space-y-5">

        {/* ═══════════════════════════════════════════════════════════
            TAB 1: Appearance & Themes (Sleek, Compact, Real SaaS Feel)
            ═══════════════════════════════════════════════════════════ */}
        {activeTab === "appearance" && (
          <div className="space-y-4">
            {/* ── Sleek Filter Toolbar & Active Theme Status ── */}
            <div className="rounded-xl border border-border-subtle bg-surface-lowest px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              {/* Left: Mode Switcher & Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex p-0.5 rounded-lg bg-surface-low text-xs font-mono">
                  {[
                    { id: "all", label: `All (${APP_THEMES.length})`, icon: Layout },
                    {
                      id: "light",
                      label: `Light (${APP_THEMES.filter((t) => t.mode === "light").length})`,
                      icon: Sun,
                    },
                    {
                      id: "dark",
                      label: `Dark (${APP_THEMES.filter((t) => t.mode === "dark").length})`,
                      icon: Moon,
                    },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    const isSelected = themeModeFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setThemeModeFilter(item.id as any)}
                        className={`px-3 py-1.5 rounded-md transition-all font-semibold cursor-pointer flex items-center gap-1.5 text-xs ${
                          isSelected
                            ? "bg-surface-lowest text-onSurface shadow-xs font-bold"
                            : "text-onSurface-muted hover:text-onSurface"
                        }`}
                      >
                        <ItemIcon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className="relative min-w-[190px]">
                  <Search className="w-3.5 h-3.5 text-onSurface-subtle absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={themeSearchQuery}
                    onChange={(e) => setThemeSearchQuery(e.target.value)}
                    placeholder="Search theme or vibe..."
                    className="w-full pl-8 pr-6 py-1.5 rounded-lg text-xs bg-surface-low border border-border-subtle/60 text-onSurface placeholder:text-onSurface-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  {themeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setThemeSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-onSurface-subtle hover:text-onSurface text-xs font-mono cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Right: Active Theme Info & Live Sync Status */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-low/80 text-[11px]">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      saveStatus === "error"
                        ? "bg-rose-500"
                        : saveStatus === "saving"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-accent shadow-[0_0_8px_var(--accent-primary)]"
                    }`}
                  />
                  <span className="text-onSurface font-semibold">Active: {selectedTheme.name}</span>
                  <span className="text-onSurface-subtle capitalize">({selectedTheme.mode === "dark" ? "OLED Dark" : "Light"})</span>
                </div>
              </div>
            </div>

            {/* ── High-Contrast Live Component Test Strip ── */}
            <div className="rounded-xl bg-surface-low/60 border border-border-subtle/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-onSurface-subtle font-bold">
                  Live Preview:
                </span>
                <button
                  type="button"
                  className="theme-primary-cta px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-default transition-all shadow-xs"
                >
                  <span>Primary CTA</span>
                </button>
                <button
                  type="button"
                  className="release-cta-button px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-default shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Release</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-onSurface-subtle font-bold">
                  Status Isolation:
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Approved
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-brand-50 text-brand-800 border border-brand-200/90 dark:bg-brand-950/40 dark:text-brand-300 dark:border-brand-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  In Plant
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy("palette", JSON.stringify(selectedTheme.preview, null, 2))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-subtle bg-surface-lowest text-[11px] font-mono text-onSurface-muted hover:text-accent cursor-pointer transition-colors"
                title="Copy theme colors"
              >
                {copiedKey === "palette" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Palette</span>
                  </>
                )}
              </button>
            </div>

            {/* ── Compact & Sleek Theme Cards (No Harsh Wireframe Outlines) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredThemes.map((option) => {
                const isSelected = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      void setTheme(option.id);
                    }}
                    className={`group relative rounded-xl text-left p-3 transition-all duration-150 cursor-pointer select-none flex items-center justify-between gap-3 border ${
                      isSelected
                        ? "bg-accent/10 border-accent ring-1.5 ring-accent shadow-xs"
                        : "bg-surface-low/30 hover:bg-surface-lowest border-border-subtle/60 hover:border-border-strong shadow-2xs hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Left: Compact Palette Swatch Strip */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Overlapping Swatch Dots */}
                      <div className="flex items-center -space-x-1 shrink-0 py-0.5">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs relative z-30 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: option.preview.accent }}
                          title={`Accent: ${option.preview.accent}`}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs relative z-20 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: option.preview.accentSecondary }}
                          title={`Secondary: ${option.preview.accentSecondary}`}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs relative z-10 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: option.preview.surface }}
                          title={`Surface: ${option.preview.surface}`}
                        />
                      </div>

                      {/* Theme Name & Vibe */}
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-bold text-onSurface truncate group-hover:text-accent transition-colors">
                          {option.name}
                        </div>
                        <div className="text-[10px] text-onSurface-muted truncate font-mono mt-0.5">
                          {option.vibe}
                        </div>
                      </div>
                    </div>

                    {/* Right: Active Check or Mode Tag */}
                    <div className="shrink-0 flex items-center gap-1">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[var(--on-accent-primary,#ffffff)] text-[10px] font-mono font-bold shadow-2xs">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-surface-low/80 text-onSurface-subtle">
                          {option.mode === "dark" ? "OLED" : "Light"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 2: User Profile (Clean, Modern, User-Friendly)
            ═══════════════════════════════════════════════════════════ */}
        {activeTab === "profile" && (
          <section className="w-full rounded-xl border border-border-subtle bg-surface-lowest shadow-2xs overflow-hidden">
            {/* Profile Overview Header */}
            <div className="p-5 border-b border-border-subtle bg-surface-low/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent-secondary text-white flex items-center justify-center font-bold text-lg font-display shadow-xs">
                  {userInitials}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-onSurface font-display">
                      {currentUser.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold bg-accent/15 text-accent border border-accent/20">
                      {currentUser.role || "Administrator"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-onSurface-muted mt-0.5 font-mono">
                    <div className="flex items-center gap-1">
                      <span>@{currentUser.userid || "user"}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("userid", currentUser.userid || "user")}
                        className="text-onSurface-subtle hover:text-accent p-0.5 cursor-pointer"
                        title="Copy User ID"
                      >
                        {copiedKey === "userid" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <span>{currentUser.email}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy("email", currentUser.email || "")}
                        className="text-onSurface-subtle hover:text-accent p-0.5 cursor-pointer"
                        title="Copy Email"
                      >
                        {copiedKey === "email" ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-lowest border border-border-subtle text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-onSurface font-semibold">Active Session</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border-subtle border-b border-border-subtle text-xs">
              <div className="p-3 bg-surface-lowest space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-onSurface-subtle flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Primary Hub
                </span>
                <div className="font-bold font-mono text-onSurface">Plant {currentUser.plant_code || "1505"}</div>
              </div>

              <div className="p-3 bg-surface-lowest space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-onSurface-subtle flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Authorized Hubs
                </span>
                <div className="font-bold font-mono text-accent">
                  {(currentUser.plant_codes?.length || 1)} Facilities
                </div>
              </div>

              <div className="p-3 bg-surface-lowest space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-onSurface-subtle flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Role Clearance
                </span>
                <div className="font-bold text-onSurface">{currentUser.role || "Administrator"}</div>
              </div>

              <div className="p-3 bg-surface-lowest space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-onSurface-subtle flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Active Theme
                </span>
                <div className="font-bold text-accent font-display truncate">{selectedTheme.name}</div>
              </div>
            </div>

            {/* Account Details Form Grid */}
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.name || ""}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-semibold text-onSurface cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Username / ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.userid || ""}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-mono font-bold text-accent cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={currentUser.email || ""}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-mono text-onSurface cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.role || "Administrator"}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-semibold text-onSurface cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Primary Plant Hub
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.plant_code || "1505"}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-mono text-onSurface cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.team || currentUser.sub_role || "Core Operations"}
                    className="w-full h-9 px-3 rounded-lg border border-border-subtle bg-surface-low text-xs font-semibold text-onSurface cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Authorized Plants List */}
              {currentUser.plant_codes && currentUser.plant_codes.length > 0 && (
                <div className="pt-2 border-t border-border-subtle space-y-2">
                  <label className="block text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                    Authorized Plant Hubs
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.plant_codes.map((pc) => (
                      <span
                        key={pc}
                        className="px-2.5 py-1 rounded-md bg-surface-low border border-border-subtle text-xs font-mono font-semibold text-onSurface flex items-center gap-1.5"
                      >
                        <Building2 className="w-3 h-3 text-accent" />
                        <span>Plant {pc}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════
            TAB 3: Security & Password (Clean & Intuitive)
            ═══════════════════════════════════════════════════════════ */}
        {activeTab === "security" && (
          <section className="w-full rounded-xl border border-border-subtle bg-surface-lowest shadow-2xs overflow-hidden">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-low/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-onSurface font-display">
                    Change Password
                  </h2>
                  <p className="text-[11px] text-onSurface-muted">
                    Update your account password for secure ERP and sampling desk authorization.
                  </p>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-accent" />
            </div>

            <div className="p-5 space-y-5">
              {/* Feedback Alert */}
              {passwordFeedback && (
                <div
                  className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2.5 ${
                    passwordFeedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60"
                      : "bg-rose-50 text-rose-800 border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                  }`}
                >
                  {passwordFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{passwordFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Current Password */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        required
                        className="w-full h-9 px-3 pr-9 rounded-lg border border-border-subtle bg-surface-low text-xs text-onSurface placeholder:text-onSurface-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-onSurface-subtle hover:text-onSurface cursor-pointer p-0.5"
                      >
                        {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password (min. 6 chars)"
                        required
                        minLength={6}
                        className="w-full h-9 px-3 pr-9 rounded-lg border border-border-subtle bg-surface-low text-xs text-onSurface placeholder:text-onSurface-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-onSurface-subtle hover:text-onSurface cursor-pointer p-0.5"
                      >
                        {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono font-bold text-onSurface-subtle uppercase">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        required
                        minLength={6}
                        className="w-full h-9 px-3 pr-9 rounded-lg border border-border-subtle bg-surface-low text-xs text-onSurface placeholder:text-onSurface-subtle focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-onSurface-subtle hover:text-onSurface cursor-pointer p-0.5"
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="p-3 rounded-lg bg-surface-low border border-border-subtle space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-onSurface-muted">
                        Strength: <strong className={`font-bold ${passwordStrength.text}`}>{passwordStrength.label}</strong>
                      </span>
                      <span className="text-[10px] font-mono text-onSurface-subtle">
                        {passwordStrength.score}/4 criteria met
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 h-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`rounded-full transition-all duration-200 ${
                            passwordStrength.score >= step ? passwordStrength.color : "bg-surface-container"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div className="p-3 rounded-lg bg-surface-low border border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        newPassword.length >= 6 ? "bg-emerald-500 text-white" : "bg-surface-container text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span className={newPassword.length >= 6 ? "text-onSurface font-medium" : "text-onSurface-muted"}>
                      Min 6 chars
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)
                          ? "bg-emerald-500 text-white"
                          : "bg-surface-container text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={
                        /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)
                          ? "text-onSurface font-medium"
                          : "text-onSurface-muted"
                      }
                    >
                      Upper & lowercase
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)
                          ? "bg-emerald-500 text-white"
                          : "bg-surface-container text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={
                        /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)
                          ? "text-onSurface font-medium"
                          : "text-onSurface-muted"
                      }
                    >
                      Number / symbol
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                        newPassword && newPassword === confirmPassword
                          ? "bg-emerald-500 text-white"
                          : "bg-surface-container text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={
                        newPassword && newPassword === confirmPassword
                          ? "text-onSurface font-medium"
                          : "text-onSurface-muted"
                      }
                    >
                      Passwords match
                    </span>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordFeedback(null);
                    }}
                    className="h-8 px-3 rounded-lg bg-surface-lowest hover:bg-surface-low border border-border-subtle text-xs font-semibold text-onSurface-muted hover:text-onSurface transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="h-8 px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3 h-3" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
