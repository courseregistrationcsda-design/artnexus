# Art Nexus — staging setup and validation runbook

This runbook is the handoff for the Supabase, PayMongo, Google Drive, and Vercel account steps. Provider accounts are not connected to this workspace, and the Supabase/Vercel CLIs are not installed here, so dashboard creation, migration execution, secret injection, and deployment still require an account owner. **Do not paste credentials or secret values into chat or commit them to source.** Set them directly in the provider dashboards or in an ignored local `.env.local` file.

> **Status and architecture notice:** This runbook predates the current external peer-to-peer / no-central-Art-Nexus-payments direction. PayMongo, checkout, fulfillment, paid-download, endpoint-sync, storage-migration, and deployment steps below are historical scaffolding, not approved instructions. Do not execute them or deploy. Before any applied migration, public endpoint sync, or storage migration, complete the live schema/data/object inventory in [`archive/project-notes/LIVE_INVENTORY_REQUEST_2026-10-20.md`](archive/project-notes/LIVE_INVENTORY_REQUEST_2026-10-20.md), compare it with the repository-only [`DATA_INVENTORY_2026-10-20.md`](archive/project-notes/DATA_INVENTORY_2026-10-20.md), review the exact effects, and obtain separate authorization. Preserve existing data and historical migrations.

## Repository work already prepared

- The schema and migrations are in `supabase/migrations/`, in strict order:
  1. `202610160001_production_foundation.sql` — profiles, Creator works/listings, inventory reservations, orders, four-argument checkout RPC, RLS, and storage policies/buckets.
  2. `202610160002_private_drive_media.sql` — private Drive references/connections, WebP cache field, controlled previews, private one-time paid downloads, and disconnect/source-unavailable handling.
- `creator-public-assets` is created/upserted as a **public** bucket by migration 001. It contains public Creator images and the small Browse thumbnail cache. Migration 001 also creates the private account-state and legacy private-originals buckets. Drive masters and zoom previews are stored in the Creator's private Google Drive vault, not in a public Supabase bucket.
- The PayMongo webhook endpoint is `/api/paymongo-webhook`; its accepted event is `checkout_session.payment.paid` and it intentionally accepts sandbox (`livemode: false`) events only.
- The Vercel cron is already declared in `vercel.json` at `/api/cron/expire-orders`, every 15 minutes.
- Local validation (16 October 2026) passes `npm test` (25 Node tests plus V3/V4/V6/V7/V8 regressions), `npm run build`, and JavaScript syntax checks. A GitHub Actions verification workflow runs code-only tests/build/syntax checks and has no deployment step. This does not substitute for applying the SQL or verifying real provider credentials.

## Phase 1 — Supabase project, schema, storage, and email Auth (blocked)

Do not start this phase until the live-inventory review and separate approval described above are complete. The migration files are repository definitions, not proof of live schema/data/storage state.

### Dashboard actions

- [x] Supabase project created (user confirmed); project name: **Art Nexus**. Choose a region appropriate for your users and data-residency needs.
- [ ] In **SQL Editor**, run the *entire* contents of `202610160001_production_foundation.sql` first. Wait for a successful completion.
- [ ] Then run the *entire* contents of `202610160002_private_drive_media.sql`. Do not run 002 first or skip 001.
- [ ] In **Storage**, verify `creator-public-assets` exists and is public. The migration creates/upserts it; a separate manual bucket is normally unnecessary. The only public artwork media should be cached thumbnails/approved public images—not Drive masters.
- [ ] In **Authentication → Providers**, enable Email signups and confirm email sign-in is available.
- [ ] In **Authentication → URL Configuration**, set the Site URL to the stable staging HTTPS origin. Add the exact callback URL `https://<staging-domain>/api/auth/callback` to the allowed redirect URLs. Add the production domain separately when one exists.
- [ ] Confirm the Creator profile moderation process can set a trusted staging profile to `published`. Production listings and checkout are intentionally unavailable until that moderation state is published.

### Values to place in Vercel later

From the Supabase project’s API/settings page, keep the project URL, anon/publishable key, and service-role/secret key available **only in your password manager/dashboard**. The application expects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`; the service-role key is server-only.

## Phase 2 — PayMongo sandbox

- [ ] Switch the PayMongo dashboard to **Test Mode** and create/use the test secret key (`sk_test_…`). The current hosted-checkout integration does not use a PayMongo public key.
- [ ] Add a webhook endpoint at the actual stable staging URL: `https://<staging-domain>/api/paymongo-webhook`.
- [ ] Subscribe to **`checkout_session.payment.paid`**. Do not select `checkout_session.paid`; that is not the event this handler processes. PayMongo's Hosted Checkout docs describe the former as the successful Checkout Session payment event.
- [ ] Copy the webhook signing secret (`whsk_…`) directly into Vercel as **`PAYMONGO_WEBHOOK_SECRET`** (canonical). `PAYMONGO_WEBHOOK_SIGNING_SECRET` is also accepted as a compatibility alias; set one name, not both.
- [ ] Keep the staging environment in test mode. This project’s runtime config intentionally accepts only `PAYMONGO_MODE=test`, `sk_test_…`, and `whsk_…`.

Official event reference: [PayMongo Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout).

## Phase 3 — Vercel staging deployment and environment variables

### Deployment

- [ ] Connect/import this project into a Vercel project, or run the Vercel CLI from the actual project directory after `vercel login` and `vercel link`.
- [ ] Create/choose a **stable staging domain** before final provider configuration. A changing per-deployment preview URL is awkward for OAuth redirect allow-lists and webhook registration.
- [ ] Add the staging environment variables below, deploy a Preview/staging build, and redeploy after changing any variables.
- [ ] Configure the Google OAuth Web client with the authorized redirect URI `https://<staging-domain>/api/creator/drive/callback`. Set `GOOGLE_DRIVE_REDIRECT_URI` to that exact URI (or leave it blank to derive it from `PUBLIC_APP_URL`). Add the staging origin as an authorized origin if Google requires it for browser uploads.
- [ ] In Supabase Auth, allow `https://<staging-domain>/api/auth/callback` as noted above.
- [ ] Register the PayMongo test webhook using the same staging domain.

### Required environment variables

Use `.env.example` as the canonical list. Set Preview and Production scopes deliberately; keep all credentials out of source control.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase Auth/public project key used by server-side Auth requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database/RPC key; never expose to browser code |
| `PUBLIC_APP_URL` | Exact staging HTTPS origin, no trailing slash or path |
| `RATE_LIMIT_HMAC_SECRET` | Random, stable secret for API rate-limit pseudonyms |
| `GOOGLE_DRIVE_CLIENT_ID` | Google OAuth Web client ID |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_DRIVE_REDIRECT_URI` | Optional exact callback URI; otherwise derived from `PUBLIC_APP_URL` |
| `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hex characters; keep stable to decrypt stored refresh tokens |
| `PAYMONGO_MODE` | `test` for staging |
| `PAYMONGO_SECRET_KEY` | PayMongo sandbox secret (`sk_test_…`) |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo sandbox webhook signing secret (`whsk_…`) |
| `PAYMONGO_PAYMENT_METHOD_TYPES` | Optional subset of `card,gcash,paymaya,qrph` |
| `CRON_SECRET` | Random bearer secret; Vercel sends it to the configured Cron endpoint |
| `NODE_ENV` | `production` on Vercel deployments |

Generate random secrets locally (never in chat), e.g. `openssl rand -hex 32`. Keep the Drive encryption key unchanged after token records are created; rotating it without re-encrypting stored tokens disconnects those Drive connections.

## Phase 4 — order-expiry cron

- [ ] Confirm `vercel.json` retains `{"path":"/api/cron/expire-orders","schedule":"*/15 * * * *"}`.
- [ ] Set `CRON_SECRET` in the Vercel environment. Vercel adds it as `Authorization: Bearer …` when invoking a Cron Job.
- [ ] On staging, exercise the endpoint manually with the bearer header from a local terminal after creating an abandoned test checkout. Never put the secret in a URL, source file, or chat.
- [ ] Vercel Cron Jobs run only for **Production deployments**, not Preview deployments. Therefore the staging cron should be tested manually; register the scheduled job only when deploying the production branch/domain.
- [ ] **Plan gate:** Vercel Hobby is limited to one Cron invocation per day. The repository’s 15-minute schedule requires a plan supporting that cadence (or an external scheduler). Do not use `vercel deploy --prod` just to test staging if it would affect a live production domain.

Official references: [Vercel Cron quickstart](https://vercel.com/docs/cron-jobs/quickstart) and [managing Cron Jobs/security](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## Phase 5 — staging end-to-end validation

Run these only after Phase 1 migrations complete and the staging deployment has the correct environment variables:

1. **Creator onboarding:** sign up and confirm email; save a Creator profile. Use the trusted staging moderation process to mark the Creator profile published before testing sale listings.
2. **Private Drive media:** accept the Creator Storage Agreement, connect the Google test OAuth account, upload one small artwork. Verify the master and WebP preview are private in `My Drive/ArtNexus_Vault/`, with no “anyone with the link” permission. Verify the Browse cache is WebP, at most 600 px wide, under 150 KB, and in `creator-public-assets`.
3. **Catalog/availability:** confirm the work appears in `/api/catalog` only while a current Drive connection exists. Confirm the API payload contains the cached thumbnail and controlled Art Nexus preview path, not Drive source URLs. Removing the connection should hide the Creator’s public catalog entries and unpublish sale listings; a Drive 403/404 should unlist the affected work.
4. **Inventory/checkout:** add a published listing to the cart and start checkout. Inspect the database to verify a pending order and inventory reservation; try changing the browser total and confirm the server still uses database listing prices/stock.
5. **Hosted checkout/webhook:** verify redirect to `https://checkout.paymongo.com`. Complete a supported sandbox payment and confirm PayMongo sends `checkout_session.payment.paid` to the staging webhook. Verify the signature, `livemode: false`, and server-side paid-order RPC. Confirm the UI clears the cart only after `/api/order-status` reports `paid`.
6. **Private download:** request a download from the paid order. Confirm a fresh short-lived one-time ticket streams the Drive master; replaying the link must fail. An unpaid order must not receive a ticket.
7. **Expiry:** create a separate abandoned test checkout. Invoke the protected cron endpoint manually on staging (or wait for the production schedule after launch). Confirm provider expiry is reconciled before the database releases its reservation.

## Current handoff / blockers

The Supabase project is user-confirmed and both repository migrations remain unapplied. There is no verified live schema/data/storage/object inventory in this workspace. The next step is **not** to run migration 001: complete the archived live-inventory request, compare the observed state with the repository-derived inventory, review exact effects and rollback/export coverage, and obtain separate explicit approval. Until that happens, do not apply SQL, synchronize endpoints, migrate storage, change providers, or deploy. The external peer-to-peer / no-central-Art-Nexus-payments direction supersedes the PayMongo/checkout instructions below; those sections are historical only. If a later authorized staging task is approved, report only non-secret status and share no credentials or secret values.
