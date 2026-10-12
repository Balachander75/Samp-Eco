---
name: samp-ui-design-system
description: >
  Complete UI Design System for the SAMP Enterprise frontend. Use this skill
  before making ANY UI changes—new pages, new components, or modifications to
  existing ones. This skill documents the exact colour tokens, component
  patterns, icon rules, layout conventions, and production constraints that
  keep the entire app visually consistent. Violating these rules will cause
  UI regressions.
---

# SAMP UI Design System — Production Reference

> **READ THIS BEFORE TOUCHING ANY UI FILE.**
> This is the canonical design-system record for the SAMP Enterprise frontend.
> Following it exactly is the only way to guarantee UI consistency across all
> pages and departments.

---

## 1. Technology Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React + TypeScript (Vite) | Strict mode. No JS-only files for UI. |
| Styling | **Tailwind CSS v3** | Custom token extensions in `tailwind.config.js`. |
| Global CSS | `src/styles.css` | `@layer base / components / utilities`. |
| Icons | **Lucide React only** | No other icon library. No emoji in UI. |
| Fonts | Inter (UI), Space Grotesk (display), JetBrains Mono (data/code) | Loaded via Google Fonts in `index.html`. |
| Animations | CSS keyframes in `styles.css` + Tailwind utilities | Hardware-accelerated only (`transform`, `opacity`). |

---

## 2. Colour System & Design Tokens

### 2.1 CSS Custom Properties (`src/styles.css`)

These are the source-of-truth tokens. Always prefer these over raw hex values.

#### Light Mode (`:root`)

```css
--bg-app: #f8f9ff;
--bg-panel: #ffffff;
--bg-subtle: #eff4ff;
--bg-muted: #e5eeff;
--surface-base: #f8f9ff;
--surface-lowest: #ffffff;
--surface-low: #eff4ff;
--surface-container: #e5eeff;
--surface-high: #dce8fd;
--surface-highest: #d3e4fe;
--on-surface: #0b1c30;
--on-surface-muted: #4a5b70;
--on-surface-subtle: #73859b;
--border-subtle: rgba(187, 203, 185, 0.2);
--border-strong: rgba(187, 203, 185, 0.35);
--border-focus: #00d166;
--text-primary: #0b1c30;
--text-secondary: #4a5b70;
--text-muted: #73859b;
--accent-primary: #00d166;        /* Emerald Green — primary CTA */
--accent-primary-hover: #00b355;
--accent-primary-subtle: #e6faf0;
--accent-teal: #0070ff;           /* Cobalt Blue — links, nav actions */
--accent-teal-hover: #005ed9;
--accent-teal-subtle: #eff5ff;
--radius-control: 8px;
--radius-panel: 16px;
```

#### Dark Mode (`.dark`)

```css
--bg-app: #080a10;
--bg-panel: #0e121a;
--bg-subtle: #141a24;
--bg-muted: #1c2432;
--surface-base: #080a10;
--surface-lowest: #0e121a;
--surface-low: #141a24;
--surface-container: #1a2230;
--surface-high: #222c3e;
--surface-highest: #2c384e;
--on-surface: #f0f4fc;
--on-surface-muted: #9cb1cb;
--on-surface-subtle: #627791;
--border-subtle: rgba(255, 255, 255, 0.06);
--border-strong: rgba(255, 255, 255, 0.12);
--accent-primary: #00d166;
--accent-primary-subtle: rgba(0, 209, 102, 0.15);
--accent-teal: #0070ff;
--accent-teal-subtle: rgba(0, 112, 255, 0.15);
```

### 2.2 Tailwind Custom Colours (`tailwind.config.js`)

These are **already configured** — use the Tailwind class names directly.

```
brand-{50…950}   — Cobalt Blue scale (primary action/info)
luminous.green   = #00d166  (CSS class: text-luminous-green, bg-luminous-green)
luminous.blue    = #0070ff
surface.*        — Maps to CSS surface tokens above
onSurface.*      — Maps to CSS on-surface tokens
```

### 2.3 Department Semantic Colours

Every department has a fixed tonal palette. **Never change or swap these.**

| Department | Icon Colour | Badge Bg (light) | Badge Text (light) | Dark Badge Bg |
|---|---|---|---|---|
| Marketing (MK) | `text-blue-600` | `bg-blue-50` | `text-blue-700` | `dark:bg-blue-950/40 dark:text-blue-300` |
| Creative Studio (CR) | `text-purple-600` | `bg-purple-50` | `text-purple-700` | `dark:bg-purple-950/40 dark:text-purple-300` |
| Structural CAD (ST) | `text-indigo-600` | `bg-indigo-50` | `text-indigo-700` | `dark:bg-indigo-950/40 dark:text-indigo-300` |
| SAMP Lab (SM) | `text-teal-600` | `bg-teal-50` | `text-teal-700` | `dark:bg-teal-950/40 dark:text-teal-300` |
| Costing (CO) | `text-emerald-600` | `bg-emerald-50` | `text-emerald-700` | `dark:bg-emerald-950/40 dark:text-emerald-300` |
| Plant Review (PL) | `text-amber-600` | `bg-amber-50` | `text-amber-700` | `dark:bg-amber-950/40 dark:text-amber-300` |

### 2.4 Semantic Status Colours

These map to the `resolveStatusTone()` function in `src/components/ui/StatusPill.tsx`.

| Meaning | Tone Key | Tailwind Class Pattern |
|---|---|---|
| Dispatched / Won / Approved | `success` | `bg-emerald-50 text-emerald-800 border-emerald-200/90` (light) |
| Rejected / Blocked / Cancelled | `danger` | `bg-rose-50 text-rose-800 border-rose-200/90` |
| Pending / Feasibility / Review | `warning` | `bg-amber-50 text-amber-900 border-amber-200/90` |
| In-Flight (SAMP, Studio, Creative) | `info` | `bg-brand-50 text-brand-800 border-brand-200/90` |
| Draft / Neutral | `neutral` | `bg-zinc-100 text-zinc-700 border-zinc-200` |

Dark mode equivalents append `/40` on the bg and `/60` on the border (e.g. `dark:bg-emerald-950/40 dark:border-emerald-800/60`).

---

## 3. Typography Rules

### 3.1 Font Family Usage

```
Inter (sans)         → All body text, labels, form fields, table cells
Space Grotesk (display) → Page titles, section headers (class: font-display)
JetBrains Mono (mono)  → SR codes, timestamps, metric values, badge counts,
                          monospace labels (class: font-mono)
```

### 3.2 Type Scale

| Usage | Size | Weight | Class |
|---|---|---|---|
| Page title / H1 | `text-sm` (14px) | `font-bold` | `text-zinc-900 dark:text-white tracking-tight` |
| Section label / H2 | `text-xs` (12px) | `font-bold` | `uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono` |
| Card title | `text-sm` | `font-semibold` | `text-zinc-900 dark:text-white` |
| Body / Description | `text-xs` | `font-normal` | `text-zinc-500 dark:text-zinc-400 leading-relaxed` |
| Meta / Sub-label | `text-[11px]` | `font-medium/normal` | `text-zinc-400 font-mono` |
| Micro / Badge count | `text-[10px]` | `font-semibold` | `font-mono` |
| Metric value | `text-2xl` | `font-bold` | `tabular-nums tracking-tight text-zinc-900 dark:text-white` |

### 3.3 Critical Rule: `tabular-nums`

All numeric values displayed in metric tiles, table columns, and badge counts
**must** use `tabular-nums` (`font-feature-settings: "tnum"` or Tailwind's
`tabular-nums` class) to prevent layout shifts when numbers change.

---

## 4. Layout & Spacing Architecture

### 4.1 App Shell

```
AppShell (root)
  ├── Sidebar (244px, fixed, desktop only)   → src/layouts/Sidebar.tsx
  └── Main Area (flex-1)
        ├── AppShell TopBar (h-14)            → src/layouts/AppShell.tsx
        └── Page Content (flex-1, overflow-y-auto)
```

### 4.2 Page Layout Template

Every feature page **must** follow this exact shell structure:

```tsx
<div className="flex-1 flex flex-col h-full min-h-0 bg-[#fafafa] dark:bg-[#000000]
               text-zinc-900 dark:text-zinc-100 font-sans select-text">

  {/* 1. Sub-header: breadcrumbs / page title / action buttons */}
  <header className="px-5 sm:px-8 py-3 bg-white dark:bg-[#0a0a0a]
                     border-b border-zinc-200 dark:border-zinc-800
                     flex flex-wrap items-center justify-between gap-4 shrink-0">
    ...
  </header>

  {/* 2. Optional: Segmented department tabs strip */}
  <div className="bg-white dark:bg-[#0a0a0a] border-b border-zinc-200 dark:border-zinc-800
                  px-5 sm:px-8 flex items-center gap-2 overflow-x-auto select-none no-scrollbar shrink-0">
    ...
  </div>

  {/* 3. Optional: Telemetry / KPI Metrics Section */}
  <section className="bg-zinc-50/50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/80
                      px-5 sm:px-8 py-4">
    <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      ...metric tiles...
    </div>
  </section>

  {/* 4. Main scrollable content area */}
  <main className="flex-1 overflow-y-auto p-5 sm:p-8 max-w-7xl w-full mx-auto space-y-7">
    ...
  </main>

</div>
```

### 4.3 Sidebar Layout

- **Width**: `244px` (fixed, not resizable)
- **Background**: `bg-white border-r border-slate-200` (light only — sidebar is always light)
- **Brand header**: `h-14 px-4`, displays logo image
- **Nav scroll**: `flex-1 overflow-y-auto scrollbar-hidden p-2.5`
- **User card** (bottom): `p-2.5 border-t border-slate-200 bg-white`
- **Active nav item**: `bg-emerald-50 text-[#006d32] border border-emerald-200/70 font-bold shadow-2xs` + left accent bar `bg-[#006d32]`
- **Sub-items** appear indented with left border `border-l-2 border-emerald-500/20`

### 4.4 Content Max Width

All main content areas are constrained to `max-w-7xl mx-auto` with horizontal
padding `px-5 sm:px-8`.

---

## 5. Component Patterns

### 5.1 Card (Work Desk / Department Hub)

The canonical "department desk card" used in OperationsOverview and everywhere:

```tsx
<div className="group p-5 rounded-xl bg-white dark:bg-[#0c0d12]
                border border-zinc-200/80 dark:border-zinc-800/80
                hover:border-zinc-400 dark:hover:border-zinc-600
                transition-all flex flex-col justify-between shadow-2xs hover:shadow-sm">
  {/* Header: icon + title + tag + badge */}
  <div className="flex items-start justify-between gap-3 mb-3">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900
                      border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
        {/* Department icon — see Section 7 for which icon per department */}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white
                        group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          Card Title
        </h3>
        <span className="text-[10px] uppercase font-mono text-zinc-400 tracking-wider">Tag Label</span>
      </div>
    </div>
    {/* Badge — use department colour from Section 2.3 */}
    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium border shrink-0 {badgeTone}">
      {count} Items
    </span>
  </div>

  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
    Description text
  </p>

  {/* Sub-links */}
  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-900 mb-4">
    <button className="px-2.5 py-1 rounded text-[11px] font-medium
                        bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800
                        text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-800
                        transition-colors cursor-pointer">
      Sub View Label
    </button>
  </div>

  {/* CTA footer */}
  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-900
                  flex items-center justify-between
                  text-xs font-semibold text-zinc-900 dark:text-white
                  group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer">
    <span>Open Console</span>
    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
  </div>
</div>
```

### 5.2 Metric Telemetry Tile

Used in the KPI ribbon on OperationsOverview:

```tsx
<div onClick={handleClick}
     className="p-3.5 rounded-lg bg-white dark:bg-[#0c0d12]
                border border-zinc-200/80 dark:border-zinc-800/80
                hover:border-{colour}-500/50 transition cursor-pointer shadow-2xs">
  <div className="text-[11px] font-medium text-{colour}-600 dark:text-{colour}-400
                  uppercase tracking-wider mb-1 flex items-center gap-1.5">
    <span className="w-1.5 h-1.5 rounded-full bg-{colour}-500" />
    <span>Metric Label</span>
  </div>
  <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
    {value}
  </div>
  <div className="text-[11px] text-{colour}-600/80 dark:text-{colour}-400/80 font-mono mt-1">
    Sub-label text
  </div>
</div>
```

Colour per metric:
- **Active Pipeline** → neutral zinc (no colour accent)
- **Pending Feasibility** → amber
- **SLA < 72h** → rose
- **Lab Prototyping** → teal
- **Dispatched / Won** → emerald
- **Creative Queue** → purple
- **Plant Programs** → amber (same as feasibility — different label)

### 5.3 Sub-header Bar (Page Top Bar)

```tsx
<header className="px-5 sm:px-8 py-3 bg-white dark:bg-[#0a0a0a]
                   border-b border-zinc-200 dark:border-zinc-800
                   flex flex-wrap items-center justify-between gap-4 shrink-0">
  {/* Left: status dot + page title + breadcrumb pill + sync time */}
  {/* Right: action buttons */}
</header>
```

### 5.4 Department Tab Strip

```tsx
<div className="bg-white dark:bg-[#0a0a0a] border-b border-zinc-200 dark:border-zinc-800
                px-5 sm:px-8 flex items-center gap-2 overflow-x-auto select-none no-scrollbar shrink-0">
  <button className={`py-2.5 px-3 border-b-2 text-xs font-medium flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
    isActive
      ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-semibold"
      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
  }`}>
    <Icon className="w-3.5 h-3.5" />
    <span>Label</span>
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
      isActive
        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200 font-bold"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
    }`}>{count}</span>
  </button>
</div>
```

### 5.5 Action Buttons (Sub-header)

Three button variants used in page headers — always in this exact order (right-aligned):

```tsx
{/* 1. Secondary: Ghost / Outlined — e.g. "New Request" */}
<button className="h-8 px-3 rounded-md bg-white hover:bg-zinc-50
                   dark:bg-zinc-900 dark:hover:bg-zinc-800
                   border border-zinc-200 dark:border-zinc-800
                   text-xs font-medium text-zinc-800 dark:text-zinc-200
                   flex items-center gap-1.5 transition-colors cursor-pointer">
  <PlusIcon className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
  <span>New Request</span>
</button>

{/* 2. Primary: Filled — e.g. "Open Console" */}
<button className="h-8 px-3.5 rounded-md
                   bg-zinc-900 hover:bg-zinc-800 text-white
                   dark:bg-white dark:hover:bg-zinc-200 dark:text-black
                   text-xs font-semibold flex items-center gap-1.5
                   transition-colors cursor-pointer shadow-xs">
  <span>Open {label}</span>
  <ArrowRight className="w-3.5 h-3.5" />
</button>

{/* 3. Icon-only: Refresh */}
<button className="h-8 w-8 rounded-md border border-zinc-200 dark:border-zinc-800
                   bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800
                   flex items-center justify-center text-zinc-600 dark:text-zinc-300
                   transition-colors cursor-pointer">
  <RefreshCw className="w-3.5 h-3.5" />
</button>
```

### 5.6 Activity Feed Row (Audit Stream)

```tsx
<div className="p-3.5 px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3
                hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 cursor-pointer transition group">
  {/* Left */}
  <div className="flex items-center gap-3 min-w-0">
    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white
                     bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
      {srNumber}
    </span>
    <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-800" />
    <div className="min-w-0">
      <span className="text-xs font-medium text-zinc-900 dark:text-white truncate block
                       group-hover:text-blue-600 transition-colors">
        {description}
      </span>
      <span className="text-[11px] text-zinc-400 font-mono">
        Client: {customer} · Plant {targetPlant}
      </span>
    </div>
  </div>
  {/* Right */}
  <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
    <span className="px-2 py-0.5 rounded text-[10px] font-mono
                     bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
      {status}
    </span>
    <span className="text-[11px] font-mono text-zinc-400">{slaDate}</span>
    <ChevronRight className="w-3.5 h-3.5 text-zinc-400
                              group-hover:translate-x-0.5 transition-transform" />
  </div>
</div>
```

### 5.7 Section Container (Card wrapper for a group of rows)

```tsx
<section className="bg-white dark:bg-[#0c0d12]
                    border border-zinc-200/80 dark:border-zinc-800/80
                    rounded-xl shadow-2xs overflow-hidden">
  {/* header */}
  <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800
                  flex flex-wrap items-center justify-between gap-3">
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Title</h3>
      <p className="text-xs text-zinc-500 mt-0.5">Sub-description</p>
    </div>
  </div>
  {/* rows */}
  <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
    ...rows...
  </div>
  {/* footer */}
  <div className="p-3 px-5 bg-zinc-50/60 dark:bg-zinc-950
                  border-t border-zinc-100 dark:border-zinc-900
                  flex items-center justify-between text-xs text-zinc-500">
    <span>Caption</span>
    <button className="font-semibold text-zinc-900 dark:text-white hover:underline
                        flex items-center gap-1 cursor-pointer">
      <span>Action Link</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  </div>
</section>
```

### 5.8 Status Pill — Use `StatusPill` Component

**Always** use the existing `StatusPill` component from `@/components/ui/StatusPill`
for request status rendering. Never inline custom status colours.

```tsx
import { StatusPill } from "@/components/ui/StatusPill";
<StatusPill status={request.status} size="sm" showDot />
```

Tone is resolved automatically by `resolveStatusTone()`.

### 5.9 Data Table

Use `DataTable` from `@/components/erp/DataTable` for all tabular data.
Never build ad-hoc tables outside this component.

Table structure conventions:
- Header: `desk-table-head` class → `text-[11px] font-semibold uppercase tracking-wider text-zinc-500`
- Row height: `h-10` (40px), hover: `hover:bg-zinc-50/80 dark:hover:bg-white/[0.02]`
- SR Number column: `font-mono font-bold text-blue-600 dark:text-blue-400`
- Text cells: `text-xs text-zinc-900 dark:text-zinc-200`
- Muted cells: `text-xs text-zinc-500 dark:text-zinc-400 font-mono`

### 5.10 Drawer / Slide-Over Panels

Animation class: `animate-smooth-drawer` (defined in `styles.css`)
Backdrop: `animate-smooth-backdrop bg-black/60`

```tsx
<div className="fixed inset-0 z-40 animate-smooth-backdrop bg-black/60" />
<div className="fixed inset-y-0 right-0 z-50 w-[480px] max-w-full
                flex flex-col bg-white dark:bg-[#0e131f]
                border-l border-zinc-200 dark:border-zinc-800 shadow-2xl
                animate-smooth-drawer">
  ...
</div>
```

### 5.11 Modal

Animation: `animate-smooth-modal`

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-smooth-backdrop bg-black/60">
  <div className="w-full max-w-lg bg-white dark:bg-[#0e131f]
                  rounded-xl border border-zinc-200 dark:border-zinc-800
                  shadow-2xl overflow-hidden animate-smooth-modal">
    ...
  </div>
</div>
```

---

## 6. Interactive States & Micro-animations

### 6.1 Hover Transitions

Always use `transition-all duration-150` or `transition-colors` for colour changes.
Use `transition-transform` separately for movement animations.

### 6.2 Card Hover Lift

Use the utility class `card-hover-lift` for cards that should lift on hover:

```css
/* Already defined in styles.css */
.card-hover-lift {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.18s ease;
}
.card-hover-lift:hover {
  transform: translateY(-1.5px);
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.08);
}
```

### 6.3 Icon Button Chevron Nudge

```tsx
<ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
<ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
```

### 6.4 Live Sync Indicator

Use an animated pulse dot to indicate live data:

```tsx
<span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
```

Only shown in page headers where live data sync is active.

---

## 7. Icon System Rules

### 7.1 Library

**Only Lucide React** (`lucide-react`). No other icon library. No emoji.
Import only icons actually used in the file.

### 7.2 Icon Sizes

| Context | Size Class |
|---|---|
| Inline text / sub-label | `w-3 h-3` |
| Buttons / action icons | `w-3.5 h-3.5` |
| Card icons (in icon box) | `w-4 h-4` |
| Empty state / large display | `w-5 h-5` or `w-6 h-6` |

### 7.3 Canonical Department Icons (FIXED — never change)

| Department | Icon |
|---|---|
| Marketing / Intake | `Layers` |
| Creative / Artwork | `Palette` |
| Structural CAD / Studio | `Box` |
| SAMP Lab / Sampling | `FlaskConical` |
| Costing / BOM | `Calculator` |
| Plant / Manufacturing | `Factory` |
| Operations / Dashboard | `Activity` |

### 7.4 Canonical Action Icons (FIXED)

| Action | Icon |
|---|---|
| Navigate forward / CTA | `ArrowRight` |
| Expand row | `ChevronRight` |
| Add / Create | `Plus` |
| Refresh data | `RefreshCw` |
| Close drawer/modal | `X` |
| Search | `Search` |
| Clock / timestamp | `Clock` |
| Warning / Urgent | `AlertTriangle` |
| Completed / Approved | `CheckCircle2` |
| Live feed | `Activity` |
| Logout | `LogOut` |

---

## 8. Dark Mode Rules

- **Dark mode class**: `.dark` (Tailwind class-based, toggled by `ThemeContext`).
- **Every** Tailwind colour must have a matching `dark:` variant.
- Background hierarchy (dark): `#000000` (app) → `#0a0a0a` (panels) → `#0c0d12` (cards) → `#12141c` (nested)
- Borders (dark): `border-zinc-800` or `dark:border-white/[0.08]`
- Sidebar is **always light** (`bg-white border-r border-slate-200`) — no dark mode on sidebar.

---

## 9. Shared CSS Utility Classes (from `styles.css`)

Use these class names directly in JSX — don't re-implement them inline:

| Class | Purpose |
|---|---|
| `.desk-shell` | Base flex column shell for all workspace pages |
| `.desk-header` | Page sub-header bar |
| `.desk-filter-bar` | Filter/search bar below header |
| `.desk-table-container` | Flex grow table wrapper |
| `.desk-table-head` | Sticky table header |
| `.desk-table-footer` | Table footer with pagination |
| `.card-hover-lift` | Card micro-lift animation on hover |
| `.animate-smooth-drawer` | Slide-in drawer animation |
| `.animate-smooth-modal` | Pop-in modal animation |
| `.animate-smooth-backdrop` | Fade-in overlay |
| `.animate-smooth-toast` | Slide-down toast notification |
| `.scrollbar-hidden` | Hide scrollbar (mobile) |
| `.glass-panel` | Frosted glass (light/dark) |
| `.tonal-lift` | Soft depth shadow with hover lift |
| `.font-display` | Apply Space Grotesk font |
| `.glow-emerald` | Emerald glow box-shadow |
| `.glow-cyan` | Blue glow box-shadow |

---

## 10. Production Constraints & Anti-Patterns

### ❌ NEVER DO

1. **No random icons** — Use only icons from Section 7.3 and 7.4 tables.
2. **No raw hex values** in new code — use CSS tokens or Tailwind classes.
3. **No inline `style={{}}` for colours** — Tailwind classes only.
4. **No custom `<table>` elements** — use `DataTable` from `@/components/erp/DataTable`.
5. **No custom status badges** — use `StatusPill` from `@/components/ui/StatusPill`.
6. **No `!important` overrides** in component files.
7. **No third-party UI libraries** (no MUI, no Radix standalone, no shadcn, no Ant Design).
8. **No light/dark inconsistency** — if you add `bg-zinc-100`, also add `dark:bg-zinc-900`.
9. **No numeric values without `tabular-nums`** in metric tiles and table cells.
10. **No emoji or special Unicode symbols** as visual elements in UI.
11. **No changing sidebar** to dark mode — sidebar is intentionally always light.
12. **No new fonts** — only Inter, Space Grotesk, and JetBrains Mono.
13. **No `rounded-full` on cards** — only on pills/badges. Cards use `rounded-xl` or `rounded-lg`.
14. **No omitting `transition-colors` and `cursor-pointer`** on interactive elements.
15. **No non-semantic `div` click handlers** without `role="button"` and `tabIndex={0}` and `onKeyDown`.

### ✅ ALWAYS DO

1. Check Section 7.3 for the correct icon for a given department.
2. Use `font-mono` for SR numbers, timestamps, badge counts, and code values.
3. Add `shrink-0` to badges, icons, and action elements that must not shrink.
4. Add `min-w-0` and `truncate` to text containers inside flex rows that can overflow.
5. Write both light and dark mode classes for every visual element.
6. Use `select-none` on all interactive UI elements (buttons, cards, tabs).
7. Use `select-text` on content area wrappers where users may copy text.
8. Respect `max-w-7xl mx-auto` content width constraints.
9. For all drawers, use the `animate-smooth-drawer` CSS class.
10. Keep page-level `<h1>` as `text-sm font-bold` in the sub-header — not in the main content area.

---

## 11. Adding a New Feature Page — Checklist

Before writing code, go through this checklist:

- [ ] Uses `desk-shell` or the equivalent flex-column root from Section 4.2
- [ ] Sub-header follows the pattern in Section 5.3 (breadcrumb → title → year pill → sync time → actions)
- [ ] Department tabs (if multi-dept view) follow Section 5.4
- [ ] All colours are from Section 2 tokens — no new raw hex values
- [ ] Department icon chosen from Section 7.3 table
- [ ] Badge colour chosen from Section 2.3 table for the correct department
- [ ] All action icons chosen from Section 7.4 table
- [ ] All text has `dark:` counterparts
- [ ] Numbers in metrics use `tabular-nums`
- [ ] SR codes displayed in `font-mono font-bold text-blue-600 dark:text-blue-400`
- [ ] Drawer animation uses `animate-smooth-drawer`
- [ ] Modal animation uses `animate-smooth-modal`
- [ ] `StatusPill` used for request status, not a custom badge
- [ ] `DataTable` used for tabular data, not a custom `<table>`
- [ ] No icons outside the approved lists in Section 7
- [ ] `cursor-pointer transition-colors` on all buttons and interactive divs

---

## 12. File Location Reference

| What | Path |
|---|---|
| Global CSS tokens | `src/styles.css` |
| Tailwind config | `tailwind.config.js` |
| AppShell layout | `src/layouts/AppShell.tsx` |
| Sidebar layout | `src/layouts/Sidebar.tsx` |
| Navigation config | `src/layouts/navigation.ts` |
| Button component | `src/components/ui/Button.tsx` |
| StatusPill component | `src/components/ui/StatusPill.tsx` |
| DataTable component | `src/components/erp/DataTable.tsx` |
| MetricRibbon | `src/components/erp/MetricRibbon.tsx` |
| ProcessStageRibbon | `src/components/erp/ProcessStageRibbon.tsx` |
| Operations Dashboard | `src/features/dashboard/OperationsOverview.tsx` |
| Marketing Overview | `src/features/sample-requests/overview/MarketingOverviewPage.tsx` |
| Theme Context | `src/context/ThemeContext.tsx` |
| Business Year Context | `src/context/BusinessYearContext.tsx` |
| Plant Context | `src/context/PlantContext.tsx` |
