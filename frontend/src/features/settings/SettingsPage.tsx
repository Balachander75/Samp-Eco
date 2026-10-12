import React, { useState } from "react";
import { Check, Sun, Moon, Palette, ShieldCheck, Zap } from "lucide-react";
import { APP_THEMES, type AppTheme, useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { theme, setTheme, saveStatus } = useTheme();
  const [filterMode, setFilterMode] = useState<"all" | "light" | "dark">("all");

  const selectedTheme =
    APP_THEMES.find((option) => option.id === theme) ?? APP_THEMES[0];

  const filteredThemes = APP_THEMES.filter((t) => {
    if (filterMode === "light") return t.mode === "light";
    if (filterMode === "dark") return t.mode === "dark";
    return true;
  });

  const saveMessage =
    saveStatus === "saving"
      ? "Syncing selection to account…"
      : saveStatus === "saved"
      ? "Theme saved to profile."
      : saveStatus === "error"
      ? "Saved locally; cloud sync retry available."
      : "Theme applies immediately across the entire workspace.";

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto bg-[var(--bg-app)] p-6 sm:p-8 text-[var(--on-surface)] select-text transition-colors">
      <div className="mx-auto w-full max-w-5xl space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded-md bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]">
                <Palette className="w-4 h-4" />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--on-surface-subtle)]">
                Theme &amp; Appearance
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--on-surface)] font-display">
              Workspace Appearance
            </h1>
            <p className="text-xs text-[var(--on-surface-muted)] mt-0.5">
              Select an enterprise palette. Changes apply instantly across all screens, tables, and inspection workspaces.
            </p>
          </div>

          {/* Current Active Badge */}
          <div className="inline-flex items-center gap-2.5 self-start sm:self-auto px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-lowest)] shadow-2xs text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full animate-pulse shadow-xs"
              style={{ backgroundColor: selectedTheme.preview.accent }}
            />
            <span className="font-semibold text-[var(--on-surface)]">
              {selectedTheme.name}
            </span>
            <span className="font-mono text-[10px] text-[var(--on-surface-subtle)]">
              ({selectedTheme.mode === "dark" ? "Dark" : "Light"})
            </span>
          </div>
        </header>

        {/* ── Mode Filter Tabs ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex p-1 rounded-xl bg-[var(--surface-low)] border border-[var(--border-subtle)] text-xs font-mono">
            {[
              { id: "all", label: `All Palettes (${APP_THEMES.length})` },
              { id: "light", label: `☀️ Light Mode (${APP_THEMES.filter(t => t.mode === "light").length})` },
              { id: "dark", label: `🌙 Dark Mode (${APP_THEMES.filter(t => t.mode === "dark").length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
                  filterMode === tab.id
                    ? "bg-[var(--surface-lowest)] text-[var(--accent-primary)] font-bold shadow-2xs border border-[var(--border-subtle)]"
                    : "text-[var(--on-surface-muted)] hover:text-[var(--on-surface)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-[var(--on-surface-subtle)] hidden sm:block">
            Click any palette to switch instantly
          </span>
        </div>

        {/* ── Theme Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                className={`group relative text-left p-4 rounded-xl transition-all duration-150 cursor-pointer select-none border ${
                  isSelected
                    ? "bg-[var(--surface-lowest)] ring-2 ring-[var(--accent-primary)] border-transparent shadow-sm"
                    : "bg-[var(--surface-lowest)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] hover:shadow-sm"
                }`}
              >
                {/* Header: Name + Mode / Active Pill */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--on-surface)] group-hover:text-[var(--accent-primary)] transition-colors">
                      {option.name}
                    </span>
                    {option.vibe && (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-[var(--surface-low)] text-[var(--on-surface-muted)] border border-[var(--border-subtle)]">
                        {option.vibe}
                      </span>
                    )}
                  </div>

                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)] text-[10px] font-mono font-bold">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[var(--on-surface-subtle)] flex items-center gap-1">
                      {option.mode === "dark" ? (
                        <Moon className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <Sun className="w-3 h-3 text-amber-500" />
                      )}
                    </span>
                  )}
                </div>

                {/* Short Description */}
                <p className="text-xs text-[var(--on-surface-muted)] line-clamp-1 mb-3">
                  {option.description}
                </p>

                {/* Palette Swatches Bar */}
                <div
                  className="p-2.5 rounded-lg border flex items-center justify-between"
                  style={{
                    backgroundColor: option.preview.canvas,
                    borderColor: option.preview.border,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Primary Accent */}
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs"
                      style={{ backgroundColor: option.preview.accent }}
                      title="Accent Primary"
                    />
                    {/* Secondary Accent */}
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs"
                      style={{ backgroundColor: option.preview.accentSecondary }}
                      title="Accent Secondary"
                    />
                    {/* Tertiary / Highlight */}
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs"
                      style={{ backgroundColor: option.preview.accentTertiary }}
                      title="Highlight"
                    />
                    {/* Surface Container */}
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 shadow-2xs"
                      style={{ backgroundColor: option.preview.surface }}
                      title="Surface"
                    />
                  </div>

                  {/* Contrast text specimen */}
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: option.preview.accentSoft,
                      color: option.preview.accent,
                    }}
                  >
                    {option.mode === "dark" ? "Dark Mode" : "Light Mode"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Status Bar ── */}
        <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)] text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                saveStatus === "error"
                  ? "bg-rose-500"
                  : saveStatus === "saving"
                  ? "bg-amber-500 animate-ping"
                  : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
              }`}
            />
            <span className="text-[var(--on-surface-muted)]">
              {saveMessage}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[10.5px] text-[var(--on-surface-subtle)]">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Synced across devices
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Instant Hardware Swap
            </span>
          </div>
        </footer>

      </div>
    </main>
  );
}
