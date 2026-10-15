# Frontend Architecture

`frontend-new/` is the active frontend source. `src/App.tsx` owns authenticated route selection and lazy-loads the workspaces; `src/layouts/` provides the shared application shell. `BusinessYearProvider` and `PlantProvider` wrap authenticated pages so request lists and plant-scoped views use the same selected context.

Domain workspaces live under `src/features/`: Marketing and request workflows in `sample-requests/`, feasibility review in `sample-requests/feasibility/` and `samp-team/feasibility/`, program planning in `sample-requests/programs/`, Creative and Studio in `creative/`, and the executive view in `dashboard/`. Costing and Sampling share the workflow desk in `sample-requests/components/WorkflowOperationsDesk.tsx`.

Components use `src/infrastructure/api/` for server requests. `api/client.ts` centralizes the API origin, session token, JSON handling, and errors; domain API modules keep endpoint details out of page components. Shared interface pieces belong in `src/components/ui/` or `src/components/erp/`.

When adding or changing a workflow, keep route access, role checks, loading and error states, and API persistence aligned with the corresponding backend endpoint. Check `backend-new/README.md` for schema changes and deployment migrations.
