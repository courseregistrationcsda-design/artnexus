# Art Nexus — Production Readiness Gap Review

**Review date:** 16 October 2026 (Asia/Manila)  
**Scope:** Current repository code, test suite, deployment scaffolding, runbook, and built local preview.  
**Decision:** **Not production-ready; deployment remains paused.** The backend and provider integrations are prepared in code but have not been activated or verified against real services.

## Executive summary

The current implementation report correctly says the main production code paths exist, but there are still important release gates that cannot be closed from this workspace. I found a few additional repository-level gaps that *were* safe to address locally: stale README claims, unconditional requests to legacy API paths that are not present in this project, missing CI/build reproducibility scaffolding, and too little explicit coverage for fail-closed production configuration.

Those local issues are now addressed. The repo has a no-deploy GitHub Actions verification workflow, a pinned Python build dependency, stricter configuration tests, legacy-adapter calls disabled by default, updated project documentation, and this current gap report. These are code/repository improvements only—not evidence of provider connectivity, database validity, or a successful remote CI run.

## Gaps closed locally in this review

### 1. Verification pipeline was absent

- Added `.github/workflows/verify.yml` for Node 20 and Python 3.13.
- It runs `npm test`, rebuilds the single-file app, fails if the committed `index.html` does not match the source, and checks API/server/test JavaScript, the built inline script, and `vercel.json`.
- It has no deploy job, uses no provider secrets, and only runs remotely after the repository is pushed/connected to GitHub. No GitHub CI run has occurred from this workspace.
- Added `requirements-build.txt` with pinned `Pillow==12.3.0` so CI can reproduce the image-inlining build environment.

### 2. Project documentation contradicted the current implementation

- Updated `README.md` to distinguish the local preview from configured-but-unverified production code, document the actual API families, and describe the name-only visitor gate.
- Corrected the old README claims that there was no API server, that the splash required email, and that the only checkout was a local mock.
- Marked old audits as historical snapshots and pointed to current implementation/release reports.
- Updated the staging runbook’s local test/build status; it still clearly says that migrations, provider setup, credentials, and staging E2E are outstanding.

### 3. Legacy client adapters called routes not included in this project

- `/api/feed`, `/api/profile`, and `/api/social/follow` are not server routes here; they could cause noisy 404s or imply a sync path that does not exist.
- The legacy adapter is now disabled unless a developer explicitly sets `window.ART_NEXUS_LEGACY_PLATFORM_SYNC = true` before startup. Production catalog and private account-state paths remain the dedicated `/api/catalog` and `/api/account/state` routes.
- Local Follow state still saves locally; authenticated account snapshots can sync through the existing account-state route when configured. No separate follow-service delivery is claimed.
- Added a regression assertion that default startup/follow actions do not call the missing legacy endpoints.

### 4. Production configuration guardrails lacked focused coverage

- Added tests for incomplete Supabase configuration, invalid origins, live PayMongo keys/mode, unsupported payment methods, and the public config response not exposing private credentials.
- Existing tests already cover the PayMongo webhook-secret alias and the major mocked route contracts.

## Validation performed

- `npm test` — **passed: 25 Node tests plus V3, V4, V6, V7, and V8 regression harnesses.**
- `npm run build` — **passed:** generated the current self-contained `index.html` with 28 embedded images.
- Syntax validation — **passed** for all API/server/test JavaScript files, the built inline app script, `vercel.json`, and the new CI workflow YAML.
- Local preview on port 8000 — **HTTP 200.** Confirmed the splash has exactly one input (visitor name), no email control, and the legacy sync guard is present.
- No remote GitHub CI job ran; this workspace is not connected to a Git remote. The workflow’s committed-artifact diff step will be exercised after the project is placed in GitHub.

These checks use local execution and mocked API/provider responses. They do **not** establish that a Supabase, PayMongo, Google, or Vercel deployment works.

## Remaining release blockers (cannot safely be completed here)

| Gap | Why it remains open | What closes it |
|---|---|---|
| **Supabase/Postgres migration validation** | The two SQL migrations have not been applied or parsed by a live Postgres instance. Supabase CLI, `psql`, and Docker are absent, and the database is not connected to this workspace. | Apply to a disposable staging project in order; inspect grants/RLS/storage policies; run role-boundary and inventory-concurrency tests before any production apply. |
| **Secrets and deployment** | No Vercel project/domain or provider secrets are configured here. Deployment is explicitly paused. | Owner configures the environment variables directly in provider dashboards, shares only non-secret setup status, and explicitly authorizes a staging deployment. Never paste secrets into chat or source. |
| **Supabase Auth E2E** | Email-link start, callback, refresh, role hydration, account snapshot, and email-change flows have only mocked/local coverage. | Configure Supabase Auth redirect URLs/templates and exercise real sign-up, confirmation, sign-in/out, account switching, and cross-user isolation in staging. |
| **PayMongo sandbox E2E** | The runtime accepts test-mode keys only, but no sandbox credentials/webhook registration exists. | Create a sandbox endpoint for `checkout_session.payment.paid`; verify hosted checkout, signature, retries/idempotency, order status, and cancellation paths with real test events. |
| **Google Drive/OAuth** | Private-master, controlled-preview, and cache code is present, but no OAuth client or Drive test account is configured. | Configure the OAuth Web client and exercise private vault creation, upload, preview, source removal, reconnect, and revocation in staging. Keep Drive masters private. |
| **Moderation and production catalog** | Checkout/public visibility are deliberately gated on a published Creator profile/work. No trusted staging moderation action or approved seller/listing dataset was supplied. | Establish a trusted moderation process and provide reviewed creator/listing data with confirmed ownership, prices, sale types, and finite inventory. Do not bypass the publish gate. |
| **Artist collaboration contacts** | No artist-approved verified emails were supplied. | Provide verified, consented contacts through a controlled process; otherwise Collaborate stays unavailable. Do not invent addresses. |
| **Cron plan** | `vercel.json` requests a 15-minute order-expiry schedule. Vercel Hobby cannot satisfy that cadence, and Vercel Cron runs only on Production deployments. | Choose a suitable Vercel plan or a separate scheduler; manually exercise the protected staging endpoint before registering production scheduling. |
| **Fulfillment/legal operations** | Carrier coverage/rates, digital delivery, refunds, seller payouts, chargebacks, taxes/receipts, retention/deletion, and support ownership are not approved or connected. | Decide and document business policies and provider workflows before enabling real-money production. Sandbox payment is not fulfillment. |
| **Security/accessibility/performance evidence** | There has been no live RLS/IDOR/CSRF/webhook-replay assessment, real-browser screen-reader review, CSP audit, or physical-device performance trace. The current inline-script/handler architecture requires `'unsafe-inline'` in the configured CSP. | Stage a scoped review and device/accessibility pass. Hardening the inline-handler/CSP architecture is a larger code migration, not something to claim complete from the current static tests. |

## Recommendation

The production-code gaps that can be closed without account access are now addressed, and the local verification suite passes. What remains is chiefly provider setup, live database/security validation, operational decisions, and release evidence—not additional safe code-only changes. Keep deployment paused. If you would rather defer those external gates, it is reasonable to switch back to front-end refinements now; the backend release blockers will remain documented here.
