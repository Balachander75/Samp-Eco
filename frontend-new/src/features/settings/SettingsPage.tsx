import React, { useState } from "react";
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
  Sparkles,
  Search,
  Layout,
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

type SettingsTab = "profile" | "security" | "appearance";

export default function SettingsPage({ currentUser: propUser }: { currentUser?: StoredUser } = {}) {
  const { theme, setTheme, saveStatus } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

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

  // ── Appearance Filter State ──
  const [themeModeFilter, setThemeModeFilter] = useState<"all" | "light" | "dark">("all");
  const [themeCategoryFilter, setThemeCategoryFilter] = useState<string>("all");
  const [themeSearchQuery, setThemeSearchQuery] = useState("");

  const filteredThemes = APP_THEMES.filter((t) => {
    if (themeModeFilter === "light" && t.mode !== "light") return false;
    if (themeModeFilter === "dark" && t.mode !== "dark") return false;
    if (themeCategoryFilter !== "all" && t.category !== themeCategoryFilter) return false;
    if (themeSearchQuery.trim()) {
      const q = themeSearchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.vibe.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedTheme =
    APP_THEMES.find((option) => option.id === theme) ?? APP_THEMES[0];

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
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#fafafa] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 font-sans select-text">
      {/* ── 1. Page Header ── */}
      <header className="px-6 sm:px-10 py-3.5 bg-white dark:bg-[#0a0a0a] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">
              Settings
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage your profile, account security, and workspace appearance.
            </p>
          </div>
        </div>

        {/* User Badge & Quick Reload */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="w-5 h-5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-[10px] font-mono">
              {userInitials}
            </div>
            <span className="font-semibold text-zinc-900 dark:text-white">
              {currentUser.name}
            </span>
            <span className="text-[11px] font-mono text-zinc-400 hidden sm:inline">
              @{currentUser.userid || "user"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            title="Reload settings"
            className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ── 2. Full-Width Navigation Tabs Strip ── */}
      <div className="bg-white dark:bg-[#0a0a0a] border-b border-zinc-200 dark:border-zinc-800 px-6 sm:px-10 flex items-center gap-3 overflow-x-auto select-none no-scrollbar shrink-0">
        {[
          { id: "profile", label: "Profile", icon: User },
          { id: "security", label: "Security", icon: KeyRound },
          { id: "appearance", label: "Appearance", icon: Palette },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`py-3 px-3.5 border-b-2 text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap select-none ${
                isActive
                  ? "border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white font-medium"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 3. Full-Screen Main Content Pane ── */}
      <main className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 w-full space-y-6">

        {/* ═══ TAB 1: Profile ═══ */}
        {activeTab === "profile" && (
          <section className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12] shadow-2xs overflow-hidden">
            {/* Profile Overview Banner */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-950/40">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-lg font-display shadow-2xs">
                  {userInitials}
                </div>
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                    {currentUser.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span className="font-mono">@{currentUser.userid || "user"}</span>
                    <span>·</span>
                    <span>{currentUser.email}</span>
                  </div>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                {currentUser.role || "Administrator"}
              </span>
            </div>

            {/* Account Details Grid */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.name || ""}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Username / ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.userid || ""}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Work Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={currentUser.email || ""}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Assigned Role
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.role || "Administrator"}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Primary Plant Hub
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.plant_code || "1505"}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-mono text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.team || currentUser.sub_role || "Core Operations"}
                    className="w-full h-10 px-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs font-medium text-zinc-800 dark:text-zinc-200 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Authorized Plants List */}
              {currentUser.plant_codes && currentUser.plant_codes.length > 0 && (
                <div className="pt-2">
                  <label className="block text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Authorized Plants
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentUser.plant_codes.map((pc) => (
                      <span
                        key={pc}
                        className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200"
                      >
                        {pc}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ═══ TAB 2: Security & Password ═══ */}
        {activeTab === "security" && (
          <section className="w-full rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12] shadow-2xs overflow-hidden">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Change Password</span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Update your account password for secure access to the SAMP workspace.
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>

            <div className="p-6 space-y-6">
              {/* Feedback Alert */}
              {passwordFeedback && (
                <div
                  className={`p-3.5 rounded-lg border text-xs font-medium flex items-center gap-2.5 ${
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

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="w-full h-10 px-3.5 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min. 6 chars)"
                        required
                        minLength={6}
                        className="w-full h-10 px-3.5 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        minLength={6}
                        className="w-full h-10 px-3.5 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Validation Status Checklist */}
                <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        newPassword.length >= 6
                          ? "bg-emerald-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span>Minimum 6 characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        newPassword && newPassword === confirmPassword
                          ? "bg-emerald-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span>Passwords match</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordFeedback(null);
                    }}
                    className="h-9 px-4 rounded-lg bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="h-9 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isChangingPassword ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ═══ TAB 3: Appearance (Themes Studio) ═══ */}
        {activeTab === "appearance" && (
          <section className="w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d12] shadow-sm overflow-hidden">
            {/* Header & Controls */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                      <Palette className="w-4 h-4" />
                    </span>
                    <span>Workspace Theme Studio</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                      13 Curated Palettes
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Select your bespoke theme. Changes apply instantly across all desks, tables, top navigation, and inspection modals with zero reload.
                  </p>
                </div>

                {/* Mode Filter Toggle */}
                <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 text-xs font-mono shadow-inner">
                  {[
                    { id: "all", label: `All (${APP_THEMES.length})`, icon: Layout },
                    { id: "light", label: `Light (${APP_THEMES.filter((t) => t.mode === "light").length})`, icon: Sun },
                    { id: "dark", label: `Dark OLED (${APP_THEMES.filter((t) => t.mode === "dark").length})`, icon: Moon },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setThemeModeFilter(item.id as any)}
                        className={`px-3 py-1.5 rounded-lg transition-all font-medium cursor-pointer flex items-center gap-1.5 ${
                          themeModeFilter === item.id
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        {ItemIcon && <ItemIcon className="w-3.5 h-3.5" />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Pills & Quick Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  {[
                    { id: "all", label: "All Collections" },
                    { id: "enterprise", label: "Enterprise Swiss" },
                    { id: "creative", label: "Studio Creative" },
                    { id: "dark_oled", label: "Dark OLED & Cyber" },
                    { id: "minimal", label: "Editorial & Brutal" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setThemeCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                        themeCategoryFilter === cat.id
                          ? "bg-[var(--accent-primary)] text-white font-bold shadow-xs"
                          : "bg-zinc-100 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/60 dark:border-zinc-800/60"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={themeSearchQuery}
                    onChange={(e) => setThemeSearchQuery(e.target.value)}
                    placeholder="Search themes by name or vibe..."
                    className="w-full pl-8 pr-3 py-1 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  {themeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setThemeSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-[10px] font-mono cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* ── Active Theme Spotlight Showcase ── */}
              <div className="p-4 rounded-xl border border-[var(--accent-primary)]/30 bg-gradient-to-r from-[var(--accent-primary)]/5 via-transparent to-[var(--accent-teal)]/5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: selectedTheme.preview.accent }}
                  >
                    <Sparkles className="w-6 h-6 text-white stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">
                        {selectedTheme.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                        {selectedTheme.vibe}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {selectedTheme.mode === "dark" ? "OLED Dark" : "Light Porcelain"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {selectedTheme.description}
                    </p>
                  </div>
                </div>

                {/* Active Swatches Strip */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono">
                    <span className="text-zinc-400">Primary:</span>
                    <span className="w-3.5 h-3.5 rounded-full shadow-2xs border border-black/10" style={{ backgroundColor: selectedTheme.preview.accent }} />
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedTheme.preview.accent}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono">
                    <span className="text-zinc-400">Secondary:</span>
                    <span className="w-3.5 h-3.5 rounded-full shadow-2xs border border-black/10" style={{ backgroundColor: selectedTheme.preview.accentSecondary }} />
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedTheme.preview.accentSecondary}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-mono">
                    <span className="text-zinc-400">Canvas:</span>
                    <span className="w-3.5 h-3.5 rounded-full shadow-2xs border border-black/10" style={{ backgroundColor: selectedTheme.preview.canvas }} />
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedTheme.preview.canvas}</span>
                  </div>
                </div>
              </div>

              {/* ── Modern Interactive Theme Cards Grid ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      className={`group relative rounded-xl border text-left transition-all duration-200 cursor-pointer select-none overflow-hidden flex flex-col ${
                        isSelected
                          ? "bg-[var(--accent-primary)]/5 dark:bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/40 shadow-md translate-y-[-1px]"
                          : "bg-white dark:bg-[#0e1118] border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-sm hover:translate-y-[-1px]"
                      }`}
                    >
                      {/* Mini Live UI Workspace Mockup */}
                      <div
                        className="w-full h-20 p-2.5 flex gap-2 relative overflow-hidden border-b border-black/5 dark:border-white/5 transition-opacity group-hover:opacity-95"
                        style={{ backgroundColor: option.preview.canvas }}
                      >
                        {/* Mini Sidebar */}
                        <div
                          className="w-8 h-full rounded-md flex flex-col justify-between p-1 shrink-0 shadow-2xs"
                          style={{ backgroundColor: option.preview.sidebar }}
                        >
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: option.preview.accent }} />
                          <div className="space-y-1">
                            <div className="w-full h-1 rounded" style={{ backgroundColor: option.preview.accent, opacity: 0.8 }} />
                            <div className="w-3/4 h-1 rounded bg-black/20 dark:bg-white/20" />
                            <div className="w-1/2 h-1 rounded bg-black/20 dark:bg-white/20" />
                          </div>
                        </div>

                        {/* Mini Content Area */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          {/* Mini Topbar */}
                          <div className="flex items-center justify-between gap-1 pb-1">
                            <div className="h-1.5 w-14 rounded-full bg-black/15 dark:bg-white/15" />
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: option.preview.accentSecondary }} />
                          </div>

                          {/* Mini KPI Cards row */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div
                              className="p-1 rounded shadow-2xs flex flex-col justify-between"
                              style={{ backgroundColor: option.preview.surface }}
                            >
                              <div className="w-3 h-1 rounded" style={{ backgroundColor: option.preview.accent }} />
                              <div className="w-5 h-1.5 rounded font-bold mt-1" style={{ backgroundColor: option.preview.accent }} />
                            </div>
                            <div
                              className="p-1 rounded shadow-2xs flex flex-col justify-between"
                              style={{ backgroundColor: option.preview.surface }}
                            >
                              <div className="w-3 h-1 rounded" style={{ backgroundColor: option.preview.accentTertiary }} />
                              <div className="w-4 h-1.5 rounded mt-1" style={{ backgroundColor: option.preview.accentSecondary }} />
                            </div>
                          </div>
                        </div>

                        {/* Subtle theme mode badge overlay */}
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 dark:bg-black/80 text-white backdrop-blur-sm">
                          {option.mode === "dark" ? "OLED" : "LIGHT"}
                        </span>
                      </div>

                      {/* Card Content & Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-[var(--accent-primary)] transition-colors">
                              {option.name}
                            </h3>
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold shrink-0">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Active</span>
                              </span>
                            ) : option.badge ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                                {option.badge}
                              </span>
                            ) : null}
                          </div>

                          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                            <span>{option.vibe}</span>
                          </div>

                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 line-clamp-1 mt-1">
                            {option.description}
                          </p>
                        </div>

                        {/* Palette Color Dots Preview */}
                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {[
                              { color: option.preview.accent, title: "Primary Accent" },
                              { color: option.preview.accentSecondary, title: "Secondary Accent" },
                              { color: option.preview.accentTertiary, title: "Tertiary Accent" },
                              { color: option.preview.surface, title: "Card Surface" },
                              { color: option.preview.canvas, title: "Workspace Canvas" },
                            ].map((swatch, idx) => (
                              <span
                                key={idx}
                                title={swatch.title}
                                className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-2xs transition-transform group-hover:scale-110"
                                style={{ backgroundColor: swatch.color }}
                              />
                            ))}
                          </div>

                          <span className="text-[10px] font-mono text-zinc-400 uppercase">
                            {option.id}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Status Footer */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      saveStatus === "error"
                        ? "bg-rose-500"
                        : saveStatus === "saving"
                        ? "bg-amber-500 animate-pulse"
                        : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                    }`}
                  />
                  <span>
                    {saveStatus === "saved"
                      ? "Theme synchronized to your account across all sessions."
                      : saveStatus === "saving"
                      ? "Synchronizing theme preference..."
                      : "Theme changes preview and render instantly."}
                  </span>
                </span>
                <span className="text-[11px] text-zinc-400">
                  Active Palette: <strong className="text-zinc-700 dark:text-zinc-200">{selectedTheme.name}</strong> ({selectedTheme.vibe})
                </span>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
