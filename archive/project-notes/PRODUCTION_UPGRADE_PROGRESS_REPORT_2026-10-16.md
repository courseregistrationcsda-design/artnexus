# ART NEXUS — Production Upgrade Progress Report (Interim; Superseded)

**Prepared:** 16 October 2026  
**Report type:** Historical interim implementation snapshot  
**Status:** **SUPERSEDED — see `/home/user/art-nexus/PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md` for the final local implementation status and remaining release gates.**

> This file records an earlier checkpoint in the work and contains outdated statements about what had not yet been implemented. It is retained for history only. The current code/build/test status and remaining staging/provider validation are documented in the superseding implementation report.

## Executive summary

The pre-implementation checkpoint and audit are preserved. Work has begun on the separately selected production path—Vercel serverless functions, Supabase Auth/Postgres/Storage, and PayMongo test-mode Hosted Checkout—while keeping the existing local-preview path when production services are unconfigured.

There is now meaningful backend scaffolding for email-link authentication, server-owned Creator profiles, private saved-state snapshots, server-side order creation, payment webhooks, verified artist-contact lookup, and Creator media uploads. The frontend has begun branching between local-preview and secure-account states, and the latest requested UI changes have partial source edits.

However, important integration work is unfinished. The built `index.html` is older than the edited source; secure checkout is not yet connected from the frontend; the payment-return handler is referenced but not implemented; Creator artwork publishing is not yet wired from the UI to the production catalog; the current checkout API does not yet match the newly extended database RPC signature; and the SQL has not been applied or validated. No credentials, verified artist emails, or production sale-catalog seed are available. **No live account, cloud-storage, catalog, or payment workflow has been verified.**

## Baseline and deliverables

- Pre-upgrade checkpoint: `/home/user/art-nexus/CHECKPOINT_PRE_PRODUCTION_UPGRADES_2026-10-16.md`
- Rollback archive: `/home/user/art-nexus-preprod-checkpoint-2026-10-16.zip`
- Baseline audit: `/home/user/art-nexus/PRE_DEPLOYMENT_AUDIT_2026-10-16.md`
- This interim report: `/home/user/art-nexus/PRODUCTION_UPGRADE_PROGRESS_REPORT_2026-10-16.md`

The baseline audit recorded that the app was a local-preview prototype with no secure identity provider, durable catalog/order backend, media service, or payment provider. It also identified the release gates and the requested Explore More, verified-contact, artwork-viewer, and artifact-count fixes.

## Work completed or started

### Frontend and product behavior

- **Started production account-state integration** in `src/app.src.html`:
  - Reads public deployment configuration and distinguishes configured Supabase Auth from local-preview behavior.
  - Uses same-origin API routes for secure session checks, state synchronization, email-link requests, Creator profile saves, and sign-out.
  - Keeps client-side Creator role data from granting hosted Creator privileges; the production UI is intended to rely on the server-returned account role.
  - Adds production Sign Up / Sign In form branches and a signed-in account view.
  - Adds a cloud-save-before-sign-out path so Creator profile records are not intentionally deleted by sign-out.
  - Preserves the existing local account path when production services are not configured.
  - Retains automatic Creator Studio Dashboard launch after Creator signup in the existing flow.
- **Started production Creator media handling**:
  - The browser resizes images to JPEG, and a new same-origin API route is intended to place them in the Creator-owned Supabase Storage path.
  - The frontend now recognizes only public Creator-asset URLs matching the configured Supabase project origin.
- **Applied source edits for requested UX**:
  - Reduced the splash collage to 24 tiles and changed its travel effect toward transform/opacity animation.
  - Removed the “50 Artifacts Loaded” label and updater.
  - Moved the artwork close control to the upper-right and added outside-click close behavior. Escape handling remains part of the modal flow.
  - Removed generated ID-based collaboration emails. Contact actions now call the verified-contact endpoint and fail closed when no verified public email is available.
  - Began replacing the Explore More in-profile scroll with a Browse return transition and promoted recommendation ordering.

These frontend changes are **partial and untested**. In particular, production secure checkout is not yet wired to the UI, and the Explore More regression tests still need to be updated to the new behavior.

### Backend and data scaffolding

Existing project files include Vercel API routes and shared helpers for:

- `/api/config`, health checks, and rate-limit support.
- Supabase email-link request, callback verification, session check, and logout.
- Server-side Creator profile writes and authenticated account-state snapshots in a private Storage bucket.
- PayMongo test-mode Hosted Checkout creation, idempotent order/reservation RPC calls, signed webhook handling, order status, and stale-order expiry.
- Verified artist-contact lookup. No real contacts are seeded, so this deliberately returns unavailable until verified data is supplied.

A new route, `api/creator/assets.mjs`, was added for authenticated, rate-limited JPEG uploads to a Creator-owned public-assets path. It validates the resized JPEG bytes and uses the server-side service-role key; it has not been exercised against a Supabase project.

The migration at `supabase/migrations/202610160001_production_foundation.sql` contains the initial production schema and has received additional in-progress edits for Creator artwork metadata, public work/listing handling, inventory-backed checkout, fulfillment details, and Storage policies. The migration has **not** been applied, parsed by a live Postgres instance, or reviewed against an actual Supabase project.

### Configuration and deployment scaffolding

- `.env.example` provides placeholders for Supabase, PayMongo test mode, rate-limiting, public origin, and cron secrets.
- The project includes a Vercel configuration, Node.js API helpers, and a Python build command.
- No secret values have been placed in source or requested in chat.
- No Vercel deployment or CI/CD pipeline has been exercised.

## Current blockers and known integration gaps

| Area | Current state | Why it blocks release |
|---|---|---|
| **Build artifact** | `src/app.src.html` has been edited; `index.html` is older and has not been rebuilt. | A static/Vercel deployment could ship stale UI and omit the new work. |
| **Automated tests** | No tests or regression suites have run since these source/backend/schema edits. | Syntax, regressions, accessibility, auth boundaries, checkout paths, and migration behavior remain unverified. |
| **Payment-return UI** | `initializeProductionServices()` references `handleProductionPaymentReturn()`, but that function is not yet implemented. | Returning from PayMongo cannot yet be reconciled in the UI. |
| **Checkout RPC mismatch** | The migration now expects `create_checkout_order(uuid, jsonb, uuid, jsonb)` with fulfillment data; `api/checkout.mjs` still calls the earlier three-argument form. | After the migration is applied, checkout creation will fail until API and SQL are brought into agreement. |
| **Frontend Hosted Checkout** | The PayMongo backend scaffold exists, but the frontend has not yet routed eligible authenticated carts to it. | The app must not represent the demo card/wallet flow as production payment. |
| **Public Creator catalog** | Creator works/listing schema additions are in progress, but no matching Creator-work API or full feed/catalog read integration is complete. | New Creator work cannot yet be relied upon as a durable, cross-user production listing. |
| **Catalog data** | No reviewed sale catalog seed or verified listing inventory was supplied. | Secure checkout rejects local/mock items that do not exist in the server-owned catalog. |
| **Supabase validation** | No project credentials or staging database are available; migration/RLS/Storage policies are unapplied. | Auth, profile-role changes, state snapshots, upload permissions, and inventory RPCs have no live validation. |
| **PayMongo validation** | No sandbox secret or webhook secret is available; no provider test has run. | Hosted checkout, signature verification, event retry, and idempotency are unverified. |
| **Artist collaboration contacts** | Verified artist emails have not been supplied. | Collaboration remains unavailable by design; no ID-derived or fabricated email should be used. |
| **Fulfillment** | The demo shipping tiers and print-email field exist, but no carrier, digital download, refund, or customer-support flow is connected. | A paid order cannot be considered fulfilled or launch-ready. |
| **Privacy and legal operations** | Retention, deletion/export, payment terms, tax, dispute/refund, and shipping policies have not been signed off. | Required product and operational decisions remain open before public sales. |
| **Security and performance QA** | No CSP/security-header audit, cross-account attack tests, device profiling, or screen-reader pass has been done after edits. | The baseline audit’s P0/P1 gates remain open. |

## Recommendations — prioritized next steps

### P0 — Finish integrations before any deployment that advertises accounts or checkout

1. **Complete the secure auth flow end to end.** Implement the email-link request/callback/session refresh/retry paths; finish UI error states and confirm that local-preview identity never unlocks hosted Creator tools. Test account switching and verify that one user cannot read or overwrite another user’s snapshot.
2. **Reconcile schema and API signatures.** Update `api/checkout.mjs` to validate and pass the new fulfillment payload, or revise the migration/function signature consistently. Then add matching tests for mixed original/print carts, shipping tiers, quantities, idempotency retries, and stale reservations.
3. **Complete Creator publishing APIs.** Add owner-authorized create/update/unpublish operations for Creator works and sale listings; wire artwork and WIP actions to those routes; return the authoritative listing key and inventory state; and expose a safe public read API for published works.
4. **Connect the frontend to PayMongo Hosted Checkout only for eligible server-listed items.** Require a verified Supabase session, group cart rows by server listing key, send no client-calculated total, redirect only to a validated PayMongo checkout URL, and reconcile the return page using authenticated order status. Never ask for card/CVC details in the Art Nexus UI for a hosted flow.
5. **Keep sandbox status prominent.** Hosted checkout and webhook completion should remain explicitly test-mode/no-real-charge until provider, fulfillment, and accounting workflows are approved. Do not label a paid sandbox order as shipped or digitally delivered.
6. **Run the build and full regressions.** Use `npm run build` and the intended regression suite; update tests for Explore More and add tests for auth-mode isolation, Creator role checks, safe media URLs, storage quotas, cart idempotency, webhook signatures, and account-state sync failures.
7. **Validate SQL in staging before any production apply.** Apply the migration to a disposable Supabase project, inspect RLS/grants/Storage policies, run adversarial role and concurrency tests, then apply through a reviewed migration process.

### P1 — Prepare usable, trustworthy data and operations

1. **Provide verified artist emails in a controlled workspace file** (not generated from artist IDs). Add only artist-approved public contacts, verify each address, record consent/verification metadata, and ensure the public-contact switch can be disabled.
2. **Prepare a production listing seed** with artist/creator ownership, title, sale type, PHP price, finite stock, item image, and public status. Each seller and price must be confirmed. Until then, secure checkout should reject the mock catalog.
3. **Configure secrets only in Vercel environment variables.** Use distinct Preview and Production environments, restrict who can view secrets, keep the Supabase service-role and PayMongo webhook keys server-side, and rotate any exposed value. Do not send secrets in chat.
4. **Complete fulfillment scope.** Decide address retention, delivery coverage/pricing, digital-download delivery, cancellations/refunds, chargebacks, tax/receipt obligations, seller payouts, and customer-support ownership before enabling any real-money mode.
5. **Add audit logging and monitoring** for auth callback failures, profile changes, upload failures, order state changes, webhook retries, reservation expiry, and rate-limit denials—without logging tokens, full addresses, card data, or private emails.

### P2 — Harden and optimize before broad launch

- Add a CSP and security headers compatible with the current inline-script/inline-handler architecture, then progressively reduce inline event handlers and stored-DOM attack surface.
- Run cross-account IDOR/privilege-escalation tests, CSRF/origin checks, webhook replay/idempotency tests, and RLS/Storage-policy tests.
- Profile image-heavy feed and artwork-viewer scrolling on low/mid-tier phones; test reduced motion, keyboard-only use, screen readers, and short/landscape displays.
- Keep responsive media variants, quota handling, upload retries, and delete/retention behavior on the production roadmap.

## Release decision

**Recommendation: continue implementation in a staging branch; do not deploy this as a production marketplace yet.** The local-preview path can remain available, but the hosted production features should only be advertised after the P0 gates are implemented and independently verified. The existing PayMongo backend is sandbox scaffolding—not evidence of a working payment service—and no production credentials, catalog records, artist emails, or live-provider checks are present.
