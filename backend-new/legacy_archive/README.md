# Legacy backend archive

`scripts/` preserves the old backend's one-off database repair, import, and verification scripts so the `backend/` folder can eventually be removed without losing their source history.

These scripts are archived for reference. They are not imported by the API, are not part of deployment migrations, and may depend on the old backend schema or external data sources. The active migration path is documented in [`../README.md`](../README.md) and lives in `app/migrations.py` and `scripts/migrations/`. Review and adapt any archived script before using it against a database.
