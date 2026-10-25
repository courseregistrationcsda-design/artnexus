# Centralized checkout retirement — deletion manifest draft

**Status:** Review proposal only. No checkout files, tests, schema, live data, secrets, or deployment configuration have been deleted or changed in this manifest step. The Browse mode update and the unapplied P2P column draft are separate local changes.

## Path reconciliation

The requested source paths do not match this repository. There is no Stripe or escrow module at the supplied `src/api/...` paths. The active implementation is a PayMongo-oriented API under root `api/`, shared helpers under `server/_lib/`, and a monolithic UI in `src/app.src.html`. The local-only build currently hides/disables much of the checkout UI, but the code remains in the tree.

## Candidate local runtime removals (after approval)

| Existing path | Current role | Proposed handling |
|---|---|---|
| `api/checkout.mjs` | Creates hosted checkout sessions and calls order RPCs. | Remove if the central checkout route is retired. |
| `api/cron/expire-orders.mjs` | Reconciles/expirs provider-backed and orphan checkout orders. | Remove with its scheduled invocation. |
| `api/order-status.mjs` | Returns the authenticated buyer's server order status. | Remove if no centralized orders remain. |
| `api/orders/download-ticket.mjs` | Issues one-use download tickets only for a server-paid order. | Remove if paid-order fulfillment is retired. |
| `api/orders/download.mjs` | Streams the private master after validating the paid order/ticket. | Remove if paid-order fulfillment is retired; review any desired non-payment download model separately. |
| `api/paymongo-webhook.mjs` | Verifies provider webhook signatures and records paid-order transitions. | Remove with the PayMongo flow. |
| `server/_lib/paymongo.mjs` | Checkout-session payloads, provider reconciliation, webhook parsing/signature helpers. | Remove once no remaining runtime import exists. |
| `server/_lib/config.mjs` | Contains PayMongo secrets/configuration and public `checkoutConfigured` / `paymentMode` fields alongside auth, Supabase, and Drive config. | Remove only the payment-specific settings and serialization; preserve the shared auth/Drive/Supabase configuration. |
| `vercel.json` | Includes PayMongo in `form-action`, configures the order-expiry function, and schedules `/api/cron/expire-orders`. | Remove only the PayMongo form-action allowance and order-expiry function/cron entries; preserve unrelated security headers. |

## UI removal boundary

`src/app.src.html` contains the legacy cart/checkout UI and handlers even though CSS hides checkout-related elements in the local community mode. Relevant anchors include the `#screenCheckout` and cart markup near the checkout screen, `goToCheckout()` / `startProductionCheckout()` / `submitPayment()` and order-return handlers, and the cart/sale item logic. The file is a single large app source, so a reviewed patch should remove targeted markup, styles, handlers, and dead state rather than deleting the file or unrelated Creator features.

**Preserve unless separately directed:** artist-entered external transaction links and the copy that clearly says they open outside Art Nexus; local commission-proposal previews and their non-notification disclaimers; Creator/Profile/Browse/Folio/Explore More behavior; and artist-controlled contact information. These are not centralized checkout routes. Reassess sale/listing fields separately instead of silently deleting artwork or Creator metadata.

## Tests requiring a coordinated rewrite

| Path | Checkout/payment coverage to remove or replace |
|---|---|
| `tests/production.test.mjs` | Checkout normalization, hosted session request, and PayMongo URL validation. |
| `tests/production-reconciliation.test.mjs` | Order status, webhook signature/paid transition, expiry cron, and checkout RPC assertions. |
| `tests/private-media.test.mjs` | Paid-order and one-use-ticket gates for master downloads; retain unrelated Drive/private-media security tests. |
| `tests/config.test.mjs` | PayMongo runtime-configuration cases; retain auth, local-mode, and secret-exposure tests. |
| `tests/regression_v6.cjs` | Contains a legacy checkout/order-retirement comment, a `closeSale()` behavior check, and assertions that sale metadata is hidden in local-only mode. Update only checkout-specific comments/behavior; preserve Folio and Browse mode coverage. |
| `tests/regression_v8.cjs` | Asserts PayMongo fetches are blocked in local mode and artist-managed external links remain allowed; preserve the external-link/privacy boundary and replace provider-route assertions if PayMongo support is removed. |
| `tests/regression_v4.cjs` | Contains a local-only cart/order-retirement comment plus local commission preview tests; update stale wording but retain the non-notification and local-only commission checks. |

Do not simply delete entire test files: several also cover unrelated runtime, Drive, account, privacy, or Creator behavior. After an approved removal, run `npm test`, `npm run build`, and `node --check` on the generated inline script.

## Historical database definitions and live-data gate

The repository's historical migration files define more than checkout, so they should not be edited or removed to simulate a purge:

- `supabase/migrations/202610160001_production_foundation.sql` includes `orders`, `order_items`, `inventory_reservations`, `payment_events`, checkout/PayMongo RPCs, plus core profiles, Creator records, catalog, commission, and rate-limit objects.
- `supabase/migrations/202610160002_private_drive_media.sql` includes `artwork_download_tickets` and paid-order ticket functions, plus unrelated Drive connection and media functionality.

Removing those historical files would damage repository migration history and future environment setup. Dropping live tables/functions, deleting transaction rows, or changing retention is a separate destructive database change. It remains blocked on the sanitized live schema/data/RLS/object inventory, record-retention review, backup/rollback plan, and explicit authorization. This code cleanup cannot establish that legal or regulatory obligations disappear.

## Related P2P integration facts (repository only; not live-verified)

- Existing Creator profile persistence is routed through `api/creator/profile.mjs` and the `upsert_creator_profile` database RPC; its current contract has no `p2p_links` argument.
- `api/catalog.mjs` selects and serializes an explicit set of profile fields and currently omits `p2p_links`; adding a database column alone will not synchronize it into the app catalog.
- The repository migration definition grants public/authenticated `SELECT` on `creator_profiles` with a published-or-own row policy. If that matches live state, adding a column to the same table can change what published profile data is selectable. Verify live grants/RLS and the API allowlist before exposing endpoints.
- The proposed endpoint validator/drawer paths are not present in this repository. The app source is currently `src/app.src.html`; any extracted client module would also need to be integrated into `src/build.py`.
- No current feature verifies wallet ownership, cryptographic signatures, gateway authenticity, chat signatures, or Folio/source hashes. Do not ship those as factual safety claims.

## Approval checkpoint

Please review the candidate local runtime/UI/test removals above. Until the exact removal scope is approved, keep these files intact. Regardless of code-removal approval, no production migration, data deletion, provider-secret change, or deployment is included here.
