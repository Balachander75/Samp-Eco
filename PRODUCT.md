# Navneet SAMP Operations

## Product

Navneet SAMP Operations is an internal web application for coordinating packaging and sampling work. It gives Marketing and operational teams a shared view of request intake, specifications, feasibility review, seasonal programs, and departmental work queues.

The intended workflow spans Marketing, Creative, Studio/CAD, Costing, SAMP, and plant execution. The repository currently implements several of those workspaces in the frontend; the existence of a screen or navigation item does not by itself mean that its data is persisted by a dedicated backend workflow.

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
- Shared navigation, light/dark theme, operational date selection, business-year display, loading/error boundaries, and refresh events.

Plant, Analytics & SLA, Members & Plants, System Settings, Help & Support, and Notifications are represented in navigation or shell controls, but currently do not all have dedicated functional workspaces. Routes without a dedicated workspace render an in-development placeholder. The notification control is a shell affordance, not a full notification center.

## Technology and architecture

- Frontend: React 18, TypeScript, Vite, React Router 6, Tailwind CSS, and Lucide icons (`frontend/`).
- Backend: FastAPI, Pydantic, SQLAlchemy, and PostgreSQL (`backend/`).
- Frontend modules live in `frontend/src/features/`; shared primitives and ERP blocks live in `components/ui/` and `components/erp/`; app shell and navigation live in `layouts/`.
- Backend HTTP routers, schemas, models, auth helpers, and database setup live under `backend/app/`.
- `VITE_API_URL` configures the frontend API origin. When unset, the frontend uses the current origin; the current Vite config does not define a development API proxy.
- `DATABASE_URL` configures the backend database. Its development default points to a local PostgreSQL database named `navneet_samp`.

The backend persists authentication, master, feasibility, program, and sample-request data in PostgreSQL. The sample-request router also contains JSON-file storage helpers for design-request records. The Creative, Studio, and Costing work desks include frontend workflow data and interactions; verify their backing data path before treating changes there as persisted operational records.

## Product principles

- Make the current operational state clear at a glance.
- Keep departmental handoffs legible and actionable.
- Preserve dense data access without making screens noisy.
- Make state-changing actions clear to the operator.
- Reuse Navneet/SAMP brand assets and existing workflow terminology.
- Provide responsive behavior, accessible controls, and useful loading and error states.

## Source of truth and scope

The checked-in implementation under `frontend/` and `backend/`, their configuration, and the project documentation are the source of truth for current behavior. Do not assume mock-only architecture: the current frontend calls a FastAPI backend, while some department desks still use local/static workflow data. No external customer claims or production deployment guarantees are implied.

This document describes the current repository state, which is evolving. Update it when workflows, integrations, or route coverage change.
