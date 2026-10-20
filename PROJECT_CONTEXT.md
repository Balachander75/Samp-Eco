# Navneet SAMP Enterprise ERP — Master Project Context & Architecture

> **Single Source of Truth for Developers & AI Agents**  
> **Last Verified & Synchronized:** October 2026 | **Build Status:** Verified (`tsc -b && vite build` passing 100%)

---

## 1. Executive Summary & Domain Mission

**Navneet SAMP Operations** (Packaging & Sampling Management System - SMPS) is an enterprise web application engineered for **Navneet Education Limited**. It serves as the unified operational nervous system coordinating B2B packaging development, technical feasibility checks, seasonal program campaigns, artwork design, CAD structural dielines, bill-of-materials (BOM) costing, sampling prototyping, and manufacturing plant execution.

### Key Business Realities
- **Operational Cycle**: Operating on an **October 1 to September 30 Business Year** (e.g., `2026-2027`).
- **Manufacturing Plants**: Multiple operational plants, with primary packaging & sampling hubs at **1505 - Khaniwade** and **1508 - Dantali**.
- **Customer Base**: Over 199+ seeded corporate B2B clients and packaging customers.
- **Product Taxonomy**: Complex packaging product characteristics catalog (classes, characteristic names, UOMs, and options like binding styles, substrate calipers, paper grain directions, and machine tooling compatibility).

---

## 2. Departmental Workflow & Handoff Lifecycle

The application orchestrates requests through seven interconnected enterprise workspaces:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           1. MARKETING / SALES INTAKE                             │
│  - Catalog Product Search & Custom Specs: /sample-requests/product-staging        │
│  - Staging Drawer & Autosaved Drafts:     /sample-requests/draft-workspace        │
│  - Request Types: [Design] [Mockup] [Sampling] [Costing]                          │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │ Bulk Release
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│         2. CREATIVE STUDIO DESK        │ │       3. FEASIBILITY (SAMP TEAM)        │
│  Route: /creative-work/design          │ │  Route: /sample-requests/feasibility   │
│  - Artwork Briefs & Variant Generation │ │  - Tech verdict (Feasible/Revision/No) │
│  - Reference moodboards & Shutterstock │ │  - Counter-date proposal (2-day SLA)   │
│  - Proof uploads & Google Drive links  │ │  - Auto-accept background worker       │
│  - Submissions -> Marketing Sign-off   │ │  - One-click convert to Sample Request │
└────────────────────┬───────────────────┘ └────────────────────────────────────────┘
                     │ Approved
                     ▼
┌────────────────────────────────────────┐
│         4. STUDIO CAD & DIELINES       │
│  Route: /studio-work                   │
│  - Caliper microns & flute grades      │
│  - Grain direction & machine tooling   │
│  - 3D dieline simulation & prepress    │
└────────────────────┬───────────────────┘
                     │ Caliper & Dimensions Confirmed
                     ▼
┌────────────────────────────────────────┐
│           5. COSTING DESK              │
│  Route: /costing-team                  │
│  - Substrate & conversion unit costs   │
│  - Interactive margin slider (%)       │
│  - Commercial quote release            │
└────────────────────┬───────────────────┘
                     │ Quote Approved
                     ▼
┌────────────────────────────────────────┐
│       6. SAMPLING TEAM (SAMP TEAM)      │
│  Route: /samp-team-work                │
│  - Prototype physical fabrication      │
│  - Sample review & dispatch readiness  │
└────────────────────┬───────────────────┘
                     │ Physical Prototype Passed
                     ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       7. PLANT EXECUTION & MASS PRODUCTION                        │
│  Route: /plant (Filtered by assigned user plant: 1505, 1508)                      │
│  - Capacity confirmation & tooling validation                                     │
│  - Seasonal Program Planning material matrix (multi-row dual sign-off)            │
│  - Floor production -> QC inspection -> Logistics dispatch                        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack & Directory Architecture

### 3.1 Technology Stack

| Layer | Technology | Key Libraries / Notes |
|---|---|---|
| **Frontend Framework** | React 18.3 (Strict Mode) + TypeScript 5.6 | Vite 6 bundler, React Router v6.28 |
| **Frontend Styling** | Tailwind CSS v3.4 + Vanilla CSS tokens | `clsx`, `tailwind-merge`. Zero third-party component libraries |
| **Frontend Icons** | Lucide React (`lucide-react`) | **Exclusively Lucide**; no other libraries or emojis |
| **Backend API** | FastAPI 0.115+ (Python 3.11+) | Asynchronous lifespan, Uvicorn, Pydantic v2.9 |
| **Database & ORM** | PostgreSQL 14+/16+ + SQLAlchemy 2.0+ | `psycopg2-binary` / `psycopg3`, connection pooling |
| **Authentication** | JWT (HS256) via `python-jose` + `bcrypt` | 15-min access token, 7-day rotated refresh tokens in DB |

### 3.2 Workspace Directory Layout

```
d:/Projects/samp/
├── .agents/
│   └── skills/
│       └── samp-ui-design-system/     # Production UI Design System specification
├── backend-new/
│   ├── app/
│   │   ├── auth/                      # Security, JWT tokens, RBAC permissions & plant filters
│   │   ├── database.py                # Engine, SessionLocal, schema helpers, versioned migrations & column checks
│   │   ├── config.py                  # Pydantic BaseSettings, JWT keys, pool configurations
│   │   ├── main.py                    # Lifespan tasks, background workers, CORS, router mounts
│   │   ├── models/                    # SQLAlchemy ORM models (master, sample_request, feasibility, program, downstream)
│   │   ├── routers/                   # HTTP endpoints (auth, master, sample, downstream, feasibility, programs)
│   │   ├── schemas/                   # Pydantic request/response validation schemas
│   │   ├── services/                  # Core domain logic (SampleRequestService, FeasibilityService, etc.)
│   │   └── utils/                     # Business year calculations, date rules, rate limiters
│   ├── scripts/                       # Versioned schema and query-index migration scripts
│   ├── requirements.txt               # Python package dependencies
│   └── run.py                         # Local backend server runner (port 8001)
├── db/
│   ├── README.md                      # Database setup instructions
│   ├── schema.sql                     # Canonical DDL schema (16 tables, triggers, sequences)
│   └── seed_data.sql                  # Seed data (admin user, plants, 199 customers, characteristics)
├── frontend-new/
│   ├── public/                        # Static brand assets and logo
│   ├── src/
│   │   ├── App.tsx                    # Root router, lazy chunk splitting, route guards & autosave
│   │   ├── context/                   # Global state (ThemeContext, PlantContext, BusinessYearContext)
│   │   ├── layouts/                   # AppShell (topbar), Sidebar (fixed 244px), navigation.ts
│   │   ├── features/                  # Domain-driven feature modules:
│   │   │   ├── auth/                  # SignInPage, user credentials, permission helpers
│   │   │   ├── dashboard/             # OperationsOverview (executive telemetry, KPI ribbon)
│   │   │   ├── sample-requests/       # Marketing intake, drafts, Sampling, Costing, feasibility, programs
│   │   │   ├── creative/              # Creative briefs, artwork, and Studio CAD/dielines
│   │   │   ├── samp-team/             # Sampling Team desk, feasibility technical review
│   │   │   ├── plant/                 # Program review; floor/QC/dispatch remain placeholders
│   │   │   ├── members/               # Teams, enterprise users, plant assignments, governance
│   │   │   └── settings/              # SettingsPage (13 selectable enterprise theme palettes)
│   │   ├── components/
│   │   │   ├── ui/                    # Primitives (Button, StatusPill, ErrorBoundary, Select, etc.)
│   │   │   └── erp/                   # ERP widgets (DataTable, MetricRibbon, OperationalDatePicker, CustomerCombobox)
│   │   ├── infrastructure/api/        # Centralized HTTP Client (client.ts, sampleRequestsApi, feasibilityApi, etc.)
│   │   └── lib/                       # Pure utilities (businessYear.ts, session.ts, utils.ts)
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── DESIGN.md                          # Visual direction and styling foundation
├── PRODUCT.md                         # Product specifications and operational principles
└── PROJECT_CONTEXT.md                 # THIS FILE (Comprehensive Master Guide)
```

---

## 4. Security, Authentication & Role-Based Access Control (RBAC)

User access is strictly partitioned across two dimensions: **System Privilege** and **Department Team Assignment**.

### 4.1 Account Privileges

| User Type | DB Fields | Permissions & Scope |
|---|---|---|
| **Root Admin** | `role = 'admin'` | Global read-write access to all dashboards, user administration, plant management, bypasses department barriers. |
| **Team Member** | `role = 'user'`, `team = '<team>'`, `is_team_head = False` | Read and write access within their department queue. In Marketing, can only access their own created requests; in SAMP/Creative, can claim unassigned tasks. |
| **Team Head** | `role = 'user'`, `team = '<team>'`, `is_team_head = True` | **Strictly READ-ONLY** across their entire team's queue. Backend `require_workflow_write_access` raises `HTTP 403 Forbidden` on all `POST/PUT/PATCH/DELETE` calls. Frontend displays the `TeamHeadReadOnlyNotice`. |

### 4.2 Departmental Team Mappings (`team` column)

1. **`marketing`**: Intake, Staging, Draft Packages, Feasibility Requests, Seasonal Program Planning.
2. **`creative_studio`**: Spans both Creative Artwork briefs (`/creative-work`) and Studio CAD dielines (`/studio-work`).
3. **`samp`** (or `sampling`): Feasibility Technical Review, Prototype Fabrication, Program Sampling Review.
4. **`plant`**: Filtered to the plant code set directly on `users.plant_code` (defaults to Khaniwade `1505` if unspecified). All upstream teams (Marketing, Creative, Studio, Sampling, Costing) have their work centered on Khaniwade (`1505`).

---

## 5. Complete Database Schema & Domain Models

### 5.1 Core Tables & Relationships

| Table Name | Description | Key Columns / Indexes |
|---|---|---|
| `users` | Corporate user accounts | `id`, `name`, `userid`, `email`, `password_hash`, `role`, `team`, `is_team_head`, `plant_code`, `theme_id`, `is_active` |
| `plants` | Manufacturing facilities | `id`, `code` (e.g., 1505, 1003, 1503), `name`, `location`, `is_active` |
| `customers` | B2B enterprise clients | `id`, `name`, `country` (199 clients pre-seeded) |
| `create_sample_requests` | Marketing sample requests | `id`, `sr_number` (unique), `client_draft_key` (autosave idempotency), `year`, `customer`, `target_plant`, `status`, `request_types` (JSONB: design, mockup, sample, costing), `mockup_workflow_state` (JSONB) |
| `sample_request_types` | Request type audit timestamps | `sample_request_id` (FK), `design`, `mockup`, `sample`, `costing`, `design_selected_at`, etc. |
| `product_characteristics` | Catalog characteristic definitions | `id`, `class_name`, `characteristic_name`, `sequence`, `uom`, `options` (JSONB) |
| `product_details` | EAV values per request | `sample_request_id` (FK), `class_name`, `characteristic_name`, `value`, `uom` |
| `design_requests` | Creative artwork briefs | `id`, `request_code`, `sr_number`, `customer_name`, `status`, `number_of_designs`, `creative_submissions` (JSONB), `marketing_decision`, `remaining_design_count` |
| `design_request_activity_logs` | Creative workflow audit chatter | `design_request_id` (FK), `actor_name`, `actor_department`, `action`, `payload` (JSONB) |
| `feasibility_requests` | Technical feasibility checks | `id`, `request_code`, `customer_id` (FK), `target_plant`, `feasibility_type`, `description_notes`, `status`, `samp_counter_date`, `counter_date_decision`, `converted_sr_number` |
| `feasibility_activity_logs` | Feasibility audit & chatter | `feasibility_request_id` (FK), `actor_name`, `actor_department`, `action`, `payload` |
| `feasibility_reference_images` | Binary stored reference images | `feasibility_request_id` (FK), `original_name`, `content_type`, `image_data` (bytea) |
| `feasibility_technical_attachments` | Sampling Team technical evidence | `feasibility_request_id` (FK), `uploaded_by`, `original_name`, `file_data` (bytea) |
| `program_requests` | Seasonal Program Planning | `id`, `request_code`, `sr_number`, `customer_name`, `target_plant`, `program_campaign_title`, `program_year`, `sampling_verdict`, `plant_verdict` |
| `program_material_specifications` | Program material matrix rows | `program_request_id` (FK), `material_type`, `supplier_name`, `grade`, `color_variant`, `caliper_wt`, `quantity`, `unit`, `samp_remark` |
| `program_activity_logs` | Program chatter & pinned notes | `program_request_id` (FK), `actor_name`, `action`, `pinned_by_marketing`, `payload` |
| `studio_dielines` | CAD dielines & prepress | `id`, `dieline_code`, `sr_number`, `dimensions`, `substrate`, `caliper_microns`, `machine_compatibility`, `status`, `file_formats` (JSONB) |
| `creative_briefs` | Artwork proof submissions | `id`, `art_code`, `sr_number`, `brand`, `color_specs`, `proof_version`, `cmyk_check_passed`, `resolution_dpi`, `bleed_mm` |
| `costing_estimations` | BOM commercial calculations | `id`, `costing_code`, `sr_number`, `target_volume`, `substrate_unit_cost`, `conversion_unit_cost`, `margin_pct`, `quoted_unit_price` |
| `refresh_tokens` | Secure token rotation | `user_id`, `token_hash`, `expires_at`, `is_revoked` |
| `login_audit_logs` | Security telemetry | `user_id`, `identifier`, `ip_address`, `status`, `failure_reason` |

---

## 6. API Route Structure & Protocol Specifications

Base URL in local dev: `http://localhost:8001` (configured via `VITE_API_URL`).

### 6.1 Authentication (`/api/auth`)
- `POST /api/auth/login` — Authenticate credentials; returns user profile, access token, and refresh token cookie.
- `POST /api/auth/refresh` — Rotate refresh token and issue fresh 15-minute access token.
- `POST /api/auth/logout` — Revoke active refresh token.
- `GET  /api/auth/me` — Read currently authenticated profile and plant permissions.
- `PUT  /api/auth/theme` — Persist active user theme preference.

### 6.2 Sample Requests & Operations (`/api/v1/sample-requests`)
- `GET    /api/v1/sample-requests` — Paginated list with filters (`year`, `plant`, `search`, `status`, `track`).
- `POST   /api/v1/sample-requests` — Create single sample request.
- `POST   /api/v1/sample-requests/batch` — Bulk create sample requests from Staging.
- `GET    /api/v1/sample-requests/{id}` — Fetch request details with EAV product characteristics.
- `PATCH  /api/v1/sample-requests/{id}` — Update request attributes.
- `POST   /api/v1/sample-requests/batch-status` — Bulk transition status across multiple requests.
- Sample and workflow request records are retained; individual and batch request deletion is not available.
- `GET    /api/v1/sample-requests/business-years` — Aggregated summary across business years.

### 6.3 Creative Design Requests (`/api/v1/design-requests`)
- `GET    /api/v1/design-requests` — List design briefs and artwork tasks.
- `POST   /api/v1/design-requests/{id}/claim` — Creative designer claims unassigned task.
- `POST   /api/v1/design-requests/{id}/counter-date-proposal` — Propose revised target completion date.
- `POST   /api/v1/design-requests/{id}/counter-date-decision` — Marketing accepts/rejects proposed date.
- `PUT    /api/v1/design-requests/{id}/creative-output` — Submit design links and Shutterstock rows.
- `POST   /api/v1/design-requests/{id}/marketing-decision` — Accept designs or request remaining variants.
- `POST   /api/v1/design-requests/{id}/request-followup` — Forward accepted design into Mockup/Sampling.

### 6.4 Technical Feasibility (`/api/v1/feasibility-requests`)
- `GET    /api/v1/feasibility-requests` — List feasibility inquiries.
- `POST   /api/v1/feasibility-requests` — Marketing raises new feasibility inquiry.
- `PUT    /api/v1/feasibility-requests/{id}/samp-verdict` — SAMP technical evaluation (`Feasible`, `Revisions Required`, `Not Feasible`).
- `POST   /api/v1/feasibility-requests/{id}/counter-date` — SAMP proposes revised review date.
- `POST   /api/v1/feasibility-requests/{id}/counter-date-decision` — Marketing decides on counter date.
- `POST   /api/v1/feasibility-requests/{id}/marketing-decision` — Final commercial sign-off (`Accepted`, `Rejected`).
- `POST   /api/v1/feasibility-requests/{id}/convert-to-sampling` — Converts approved feasibility directly into commercial sample request.

### 6.5 Seasonal Program Planning (`/api/v1/program-requests`)
- `GET    /api/v1/program-requests` — List seasonal program requests.
- `POST   /api/v1/program-requests` — Create program planning request.
- `PUT    /api/v1/program-requests/{id}/materials/{mat_id}/samp-remark` — SAMP updates technical matrix remark.
- `POST   /api/v1/program-requests/{id}/sampling-verdict` — SAMP signs off program feasibility.
- `POST   /api/v1/program-requests/{id}/plant-verdict` — Plant team signs off tooling & capacity.

---

## 7. Frontend Architecture & Design System Rules

The UI strictly adheres to `.agents/skills/samp-ui-design-system/SKILL.md`.

### 7.1 Typography Rules
- **Inter (sans)**: All body text, tables, form inputs, and descriptions.
- **Space Grotesk (`font-display`)**: Page titles and section headlines.
- **JetBrains Mono (`font-mono`)**: All SR codes, timestamps, badge counts, and metrics.
- **`tabular-nums`**: **MANDATORY** on all numeric values in tables, badges, and metric cards to eliminate layout shifts.

### 7.2 Strict Design Constraints
- ❌ **No raw hex colors in JSX** — Use CSS custom property tokens or configured Tailwind utility classes.
- ❌ **No random icons** — Only approved icons from `lucide-react` (e.g., Marketing = `Layers`, Creative = `Palette`, Studio CAD = `Box`, SAMP = `FlaskConical`, Costing = `Calculator`, Plant = `Factory`).
- ❌ **No emojis or custom icon sets** in the UI.
- ❌ **No custom HTML `<table>` elements** — Always use the shared `DataTable` (`components/erp/DataTable.tsx`).
- ❌ **No ad-hoc status badges** — Always use `StatusPill` (`components/ui/StatusPill.tsx`).
- ❌ **No dark mode on the Sidebar** — Sidebar is intentionally locked to a crisp, light executive presentation (`bg-white border-r border-slate-200`).

### 7.3 Multi-Theme Appearance System (`ThemeContext.tsx`)
The app supports 13 curated enterprise palettes:
- **Enterprise / Light**: *Jade Atelier* (`emerald` - Default), *Cobalt Office* (`ocean`), *Nordic Frost* (`nordic-frost`).
- **Creative / Studio**: *Iris Paper* (`violet`), *Coral Studio* (`rose`), *Orchid Afterdark* (`nocturne`).
- **Minimal / Editorial**: *Citrus & Ink* (`amber`), *Sahara Dune* (`terracotta`), *Neo Brutalism* (`neo-brutalism`).
- **Dark / OLED**: *Obsidian Blue* (`midnight`), *Abyssal Teal* (`forest-night`), *Tokyo Neon* (`tokyo-neon`), *Stealth Titanium* (`titanium`).

---

## 8. Fast Development & Local Run Playbook

### 8.1 Prerequisites
- Node.js 18+ & npm 9+
- Python 3.11+
- PostgreSQL 14+ running on `localhost:5432`

### 8.2 Database Initialization
```bash
# 1. Create the database
createdb -U postgres -h localhost navneet_samp

# 2. Run DDL schema
psql -U postgres -h localhost -d navneet_samp -f db/schema.sql

# 3. Seed reference master data & admin user
psql -U postgres -h localhost -d navneet_samp -f db/seed_data.sql
```

### 8.3 Running Backend
```bash
cd backend-new

# Create & activate virtual environment (Windows PowerShell)
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run FastAPI dev server (Port 8001)
python run.py
```
*Interactive Swagger documentation:* `http://localhost:8001/docs`

### 8.4 Running Frontend
```bash
cd frontend-new

# Install packages
npm install

# Start Vite dev server (Port 5175)
npm run dev

# Verify clean production build
npm run build
```

---

## 9. Quick "Where Do I Make Changes?" Index

| If you need to modify... | Target File / Directory |
|---|---|
| **Marketing Request intake, wizard or staging drawer** | `frontend-new/src/features/sample-requests/components/staging/` |
| **Draft workspace, bulk release, or autosave logic** | `frontend-new/src/features/sample-requests/components/DraftWorkspacePage.tsx` |
| **Sample requests table columns, status pills, or filters** | `frontend-new/src/features/sample-requests/sampling/` |
| **Sample request inspection sheet tabs** | `frontend-new/src/features/sample-requests/components/inspector/` |
| **Feasibility review tabs, counter-dates, or verdicts** | `frontend-new/src/features/sample-requests/components/FeasibilityInspectorModal.tsx` |
| **Seasonal Program Planning dual review & material matrix** | `frontend-new/src/features/sample-requests/components/ProgramPlanningWorkspace.tsx` |
| **Creative artwork brief submissions** | `frontend-new/src/features/creative/CreativeDesignOutputModal.tsx` |
| **Studio CAD dielines, calipers, or 3D view** | `frontend-new/src/features/creative/StudioWorkDesk.tsx` |
| **Costing workflow and pricing review** | `frontend-new/src/features/sample-requests/components/WorkflowOperationsDesk.tsx` |
| **Plant program review or assigned manufacturing plants** | `frontend-new/src/features/plant/` & `frontend-new/src/context/PlantContext.tsx` |
| **Enterprise members, teams, or plant assignments** | `frontend-new/src/features/members/` |
| **Backend API endpoints or domain validation** | `backend-new/app/routers/` & `backend-new/app/services/` |
| **Database models or new table columns** | `backend-new/app/models/` & `backend-new/app/database.py` |
| **Global navigation items, routes, or sidebar badges** | `frontend-new/src/layouts/navigation.ts` & `frontend-new/src/App.tsx` |
| **Design tokens, themes, or appearance settings** | `frontend-new/src/context/ThemeContext.tsx` & `frontend-new/src/styles.css` |
