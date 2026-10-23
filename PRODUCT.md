# Navneet SAMP Operations

## Product

Navneet SAMP Operations is an internal web application for coordinating packaging and sampling work. It gives Marketing and operational teams a shared view of request intake, specifications, feasibility review, seasonal programs, and departmental work queues.

The intended workflow spans Marketing, Creative, Studio/CAD, Costing, SAMP, and plant planning. Most request and downstream desk data is persisted by the active backend; plant execution screens beyond program review remain placeholders.

## Users and operating context

The product is for internal Navneet users, including Marketing, Creative, Studio, Costing, SAMP, plant, and administrative roles. Users work from an operations overview or a department desk, search and filter requests, inspect product details, and use the actions available in that workflow. Interfaces need to support dense operational scanning, keyboard use, and smaller screens.

## Current capabilities

- Sign-in through the FastAPI authentication API, with client-side session persistence and protected application routes.
- Root Admin has global access, including Operations Overview and user administration. Each team account is assigned to one department; Members can use its workflow, while Team Heads have read-only access to their team's workflow data.
- Operations Overview, Marketing/Sample Requests, Seasonal Program Planning, Product Staging, Creative, Studio, Costing, and SAMP Team workspaces.
- Sample request records with product characteristics and request types.
- Feasibility requests with SAMP verdicts, Marketing decisions, and an activity timeline.
- Seasonal program requests with material specification rows and SAMP remarks.
- Customer and plant reference data APIs.
- Department workspace interactions such as filtering, selection, detail inspection, status updates, and CSV export where implemented.
- Shared navigation, eight-palette light theme, operational date selection, business-year display, loading/error boundaries, and refresh events.

Plant, Analytics & SLA, Members & Plants, System Settings, Help & Support, and Notifications are represented in navigation or shell controls, but currently do not all have dedicated functional workspaces. Routes without a dedicated workspace render an in-development placeholder. The notification control is a shell affordance, not a full notification center.

## Technology and architecture

- Frontend: React 18, TypeScript, Vite, React Router 6, Tailwind CSS, and Lucide icons (`frontend-new/`).
- Backend: FastAPI, Pydantic, SQLAlchemy, and PostgreSQL (`backend-new/`).
- Frontend modules live in `frontend-new/src/features/`; shared primitives and ERP blocks live in `frontend-new/src/components/ui/` and `frontend-new/src/components/erp/`; app shell and navigation live in `frontend-new/src/layouts/`.
- Backend HTTP routers, schemas, models, auth helpers, database setup, and versioned migrations live under `backend-new/app/`.
- `VITE_API_URL` configures the frontend API origin. When unset, the frontend uses the current origin; the current Vite config does not define a development API proxy.
- `DATABASE_URL` configures the backend database. Its development default points to a local PostgreSQL database named `navneet_samp`.

The active backend persists authentication, master, feasibility, program, sample-request, Creative brief, Studio dieline, and Costing estimation data in PostgreSQL. Some plant execution screens remain placeholders; verify each workflow's API before treating it as operational.

## Product principles

- Make the current operational state clear at a glance.
- Keep departmental handoffs legible and actionable.
- Preserve dense data access without making screens noisy.
- Make state-changing actions clear to the operator.
- Reuse Navneet/SAMP brand assets and existing workflow terminology.
- Provide responsive behavior, accessible controls, and useful loading and error states.

## Source of truth and scope

The active implementation under `frontend-new/` and `backend-new/`, their configuration, and the project documentation are the source of truth for current behavior. The frontend calls a FastAPI backend; some plant screens remain local placeholders. No external customer claims or production deployment guarantees are implied.

This document describes the current repository state, which is evolving. Update it when workflows, integrations, or route coverage change.
