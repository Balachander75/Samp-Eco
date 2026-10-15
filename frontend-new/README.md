# Navneet SAMP Operations Frontend

This is the active React application for the Navneet SAMP Operations workspace. It contains the Operations Overview and the Marketing, Seasonal Program Planning, Creative, Studio, Costing, SAMP, member, and settings workspaces.

## Run locally

From this directory:

```bash
npm ci
npm run dev
```

Vite uses port `5175`. The available scripts are `dev`, `build`, and `preview`. Set `VITE_API_URL` when the API is hosted on a different origin; when it is empty, requests use the current origin. The Vite configuration does not define a development proxy.

The active API is in the sibling `../backend-new/` directory. See [backend deployment and database instructions](../backend-new/README.md) before starting it. Do not commit `.env` files or place credentials in `VITE_*` variables.

## Source layout

- `src/features/` contains the dashboard and domain workspaces.
- `src/components/ui/` and `src/components/erp/` contain shared interface components.
- `src/layouts/` and `src/App.tsx` define the application shell and route handling.
- `src/infrastructure/api/` contains the shared HTTP client and API modules.
- `src/context/` and `src/lib/` contain shared state and browser utilities.
- `public/` and `src/assets/` contain static brand assets.

For product scope and workflow caveats, see [PRODUCT.md](../PRODUCT.md). For the current project map, see [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md).
