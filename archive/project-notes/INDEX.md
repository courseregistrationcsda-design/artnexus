# Archived project notes

These Markdown reports, checkpoints, inventories, and plans were moved here to keep the project root focused on source, build, runtime, tests, and deployment files. They are **preserved, not deleted**, and are not inputs to `npm test`, `npm run build`, the CI workflow, API routes, or Vercel runtime. The root `.vercelignore` is configured to exclude the archive from future uploads; no deployment packaging was run to verify it.

## Current review gates and working notes

- [Live schema/data/object inventory request](LIVE_INVENTORY_REQUEST_2026-10-20.md) — required before any applied migration, public endpoint sync, storage migration, or production change.
- [Repository-derived data inventory](DATA_INVENTORY_2026-10-20.md) — describes code and migration definitions only; it is not evidence of the live database or storage state.
- [Checkout-removal manifest draft](CHECKOUT_REMOVAL_MANIFEST_DRAFT_2026-10-20.md) — review-only; no checkout code, historical migration, or transaction data was removed by archiving.
- [Nonprofit pillars phase plan](NONPROFIT_PILLARS_PHASE_PLAN_2026-10-20.md) — working plan and retained safety decisions.
- [Pre-phase checkpoint](CHECKPOINT_NONPROFIT_PRODUCT_PILLARS_PREPHASE_2026-10-20.md) — historical snapshot supporting the phase plan.

## Historical reports and checkpoints

- [Audit report](AUDIT_REPORT.md)
- [Pre-deployment audit](PRE_DEPLOYMENT_AUDIT_2026-10-16.md)
- [Theme readability simulation](THEME_READABILITY_SIMULATION_2026-10-16.md)
- [V4 checkpoint report](CHECKPOINT_REPORT.md)
- [Pre-production-upgrades checkpoint](CHECKPOINT_PRE_PRODUCTION_UPGRADES_2026-10-16.md)
- [Production-upgrade progress report](PRODUCTION_UPGRADE_PROGRESS_REPORT_2026-10-16.md)
- [Production-upgrade implementation report](PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md)
- [Production-readiness gap review](PRODUCTION_READINESS_GAP_REVIEW_2026-10-16.md)

For the current repository overview, see the [root README](../../README.md). The root [staging runbook](../../STAGING_DEPLOYMENT_RUNBOOK.md) is retained as historical setup material, not release authorization. None of the archived snapshots establishes live provider, database, storage, or deployment state. No migration, endpoint sync, storage change, or deployment is authorized by this archive operation.
