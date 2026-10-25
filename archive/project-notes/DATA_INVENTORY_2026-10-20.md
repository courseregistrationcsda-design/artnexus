# Art Nexus data inventory — repository and migration evidence

**Prepared:** 20 October 2026 (Asia/Manila)  
**Evidence scope:** repository source, serverless handlers, tests, and the two Supabase migration files listed below.  
**Live-system status:** **Not verified.** This is a schema/code inventory, not a query of a live Supabase project. The migrations do not prove that they were applied, and the repository does not reveal live rows, bucket objects, auth users, provider settings, logs, backups, or deployment state.

## How to read this inventory

- “Defined in migration” means the table or storage bucket is declared in repository SQL. It does **not** mean it exists in the live database.
- “Sensitive data” is a repository-level classification based on field purpose. It is not a legal classification or a claim about the live contents.
- Retention notes describe controls found in the checked-in migrations/code. Where no retention or purge was found, that is stated explicitly rather than inferred.
- Current source has a local-community runtime gate: outside the explicit mocked-test override, provider configuration flags resolve false even if environment credentials are present. That source change is **not deployed or verified against a hosted runtime**. The legacy schema and route code remain in the repository.

## Migration-defined database tables

| Table / source | Migration-defined contents | Data class / purpose | Repository route or use | Retention / deletion evidence |
|---|---|---|---|---|
| Supabase-managed `auth.users` | Supabase Auth identity referenced by `profiles.id`; application code uses email confirmation and session flows. Not created by the project migrations. | Account identifier, email, authentication/session state. Supabase-managed credentials and tokens are outside the public-schema migrations. | `server/_lib/supabase.mjs`; `/api/auth/*`. | Provider-managed. No live Auth configuration or retention setting was inspected. |
| `public.profiles` | `id`, `display_name`, `account_role`, `created_at`, `updated_at`. FK to Auth user. | Personal display name, role, account identifier. | Auth/profile and account-state code. | No TTL. User deletion cascades from Auth as declared; this does not prove provider backups are erased. |
| `public.creator_profiles` | `user_id`, `studio_name`, `bio`, `verified_mediums` JSON, `avatar_url`, `status`, timestamps. | Public/proposed creator profile and portfolio metadata. | `/api/creator/profile.mjs`, `/api/catalog.mjs`. | No TTL. FK deletion cascades from `profiles`; published/suspended states are not deletion. |
| `public.creator_works` | From `202610160001`: `id`, `creator_id`, `work_key`, `title`, `description`, `medium`, `image_url`, `folio_slides`, `status`, timestamps. From `202610160002`: `thumbnail_cache_url`, `gdrive_source_url`, `gdrive_preview_url`, `folio_source_urls`, `folio_preview_urls`. | Artwork text and media pointers; may include private Drive file URLs/IDs and public thumbnail URLs. | `/api/creator/works.mjs`, `/api/catalog.mjs`; Drive media functions. | No TTL. Creator FK cascades. **No `visibility` column exists in these migrations.** The legacy RPC can write `status='published'`; repository client-side private defaults are not production access control. |
| `public.artist_contacts` | `artist_id`, optional `artist_user_id`, `public_email`, `verified_at`, `public_contact_enabled`, `updated_at`. | Artist contact email and verification/publication state. | `/api/artists/contact.mjs`. | No TTL. Deleting a linked profile sets `artist_user_id` null; contact row may remain. No live contacts were verified. |
| `public.artwork_listings` | Listing key, creator, title/description, image pointer, sale type, currency, price, stock/reserved/sold counts, publication/status, timestamps. | Commercial listing, prices, stock and sale state. | `/api/catalog.mjs`, `/api/creator/works.mjs`, checkout/order RPCs. | No TTL. Creator deletion is restricted. Draft/suspended status is not deletion. Central checkout is legacy code and provider routes are gated in the current working tree, not removed from schema. |
| `public.creator_wip_projects` | Creator, `project_key`, title, status, `project_data` JSON, timestamps. | Creator work-in-progress notes and project metadata; JSON content is extensible. | Creator profile/state functions; no active dedicated public WIP service was verified. | No TTL. Creator FK cascades. `archived`/`draft` status is not deletion. |
| `public.commission_requests` | Creator and requester IDs, title, `budget_minor`, intended usage, brief, status, timestamps. | Personal commission proposal/request details; brief and intended-use text may be sensitive. | Legacy schema/RPC surface. Current local UI saves proposals locally and states they are not delivered. | No TTL. Creator/requester deletion is restricted. Terminal statuses are not deletion. Live row count/state unknown. |
| `public.creator_commission_settings` | Creator ID, intake-open flag, slot allocation, available slots, updated time. | Creator availability/preferences. | Legacy creator settings/RPCs; local preview settings are browser-stored. | No TTL. Creator FK cascades. |
| `public.orders` | User ID, status, currency, total, idempotency key, PayMongo checkout/payment IDs, `checkout_url`, `fulfillment_data` JSON, created/paid/updated times. | Purchase history, payment-provider identifiers, checkout bearer URL, fulfillment/contact/address details if supplied in JSON. | `/api/checkout.mjs`, `/api/order-status.mjs`, webhook and cron routes. | No row TTL found. Pending order expiry changes status; it does not delete the order. Checkout routes are fail-closed by source config in this working tree, not deployment-verified. |
| `public.order_items` | Order/listing IDs, listing key and title/type snapshots, quantity, unit amount, created time. | Purchase line-item history and price snapshots. | Checkout and order RPCs. | No TTL. Cascades when order is deleted; listing deletion is restricted. |
| `public.inventory_reservations` | Order/listing IDs, quantity, status, `reserved_until`, created time. | Temporary stock reservations linked to an order. | Checkout/expiry RPCs. | Expiry timestamp/status releases reservation logically. Migration does not establish automatic deletion of reservation rows. |
| `public.payment_events` | SHA-256 event hash, order ID, checkout-session ID, payment ID, event type, `received_at`. No raw webhook payload column. | Payment event identifiers and idempotency/audit metadata. | `/api/paymongo-webhook.mjs`, paid-order RPC. | No TTL/purge found. Payment webhooks are gated in the current working tree; no live provider/webhook config checked. |
| `public.api_rate_limit_buckets` | `key_hash` (64-char HMAC), `window_started_at`, `hit_count`, `updated_at`; indexed on `updated_at`. | Pseudonymous rate-limit state derived from scope and client address; raw IP is not a column in this table. | `server/_lib/rate-limit.mjs` → `consume_api_rate_limit`. | RPC upserts/resets counters but does **not** delete old rows. No cleanup job found. This is persistent Supabase data, not RAM. See the separate one-hour design below. |
| `public.creator_drive_connections` | User ID, Google email, Drive vault folder ID, encrypted refresh-token ciphertext/IV/tag, agreement version/time, connected/updated times. | Third-party account identifier, private folder pointer, encrypted OAuth refresh credential and consent evidence. | `/api/creator/drive/*`, `server/_lib/google-drive.mjs`. | No TTL. Disconnect RPC deletes the connection row; token revocation is best-effort provider behavior. Current runtime gate disables Drive routes in source; live connection rows and encryption-key configuration are unknown. |
| `public.artwork_download_tickets` | Hashed token, order/user/listing/creator/work IDs, `expires_at`, `used_at`, `created_at`. | One-time bearer-download capability and purchase linkage. Migration gives a 10-minute expiry and single-use consumption check. | `/api/orders/download-ticket.mjs`, `/api/orders/download.mjs`. | Expired/used tickets cannot be consumed, but the migration has no automatic row purge. This is an old paid-download feature, not a share-link feature. No share/access link is auto-generated by the local draft flow. |

## Migration-defined Supabase Storage buckets

| Bucket | Migration setting | Expected content / access | Retention evidence |
|---|---|---|---|
| `account-state` | Private; JSON only; 4,000,000-byte limit. Owner-scoped storage policies in `202610160001`. | Per-user account-state snapshot object at `<user-id>/snapshot.json`; the API allowlist includes Creator session/work/WIP, bookmarks, stock and selected queue state. | No object TTL or backup-purge policy in the migration. Current provider gate is not deployed/verified. |
| `creator-public-assets` | Public bucket; JPEG/PNG/WebP/GIF; 15,728,640-byte limit. Owner-scoped write/update/delete policies. | Public creator artwork/avatar/thumbnail assets. A public URL is not private and may be copied or cached. | No TTL or automatic purge found. Owner deletion policy does not establish removal from caches/backups. |
| `creator-private-originals` | Private bucket; JPEG/PNG/WebP/PDF; 52,428,800-byte limit; owner-scoped CRUD policies. | Intended private original/master media. Repository production media flow currently references Google Drive and the public thumbnail bucket; live usage of this bucket is unknown. | No TTL or automated deletion found. |

## Phase 3 source changes (not a live inventory)

These are current working-tree facts only; they do not show that any production deployment or database has changed.

- `src/media/pipeline.js` generates browser-side WebP previews with orientation-specific 1280 × 720 / 720 × 1280 ceilings and a strict maximum of 300,000 bytes. If the encoder cannot meet the bound, it returns an error rather than an oversized blob or original-file fallback. The standalone build embeds this module.
- `api/creator/assets.mjs` currently accepts a `thumbnail` WebP up to and including 300,000 bytes and inspects RIFF/WEBP dimensions against the same orientation-specific limits. This is an API code change only; the endpoint still writes to the legacy public `creator-public-assets` bucket when configured.
- `src/app/storage_nodes.js` and the Creator Studio form store optional `storage_nodes[]` on local drafts. IPFS/Arweave checks are syntactic only, never cryptographic verification or reachability tests, and the app does not auto-resolve/fetch them. `local-handshake` is a device-local note, not a URL. No database column, server API, or migration was added for these fields.
- The product owner approved temporary Supabase public preview hosting, but selected waiting for a live schema/data/object inventory before migration authoring. Eventual migration scope includes every object in `creator-public-assets`—avatars, artwork, WIP, and thumbnails. This repository inventory remains migration/code-derived, not a verified live inventory.

## Browser/device data outside the database

Local browser state is not the same as hosted database storage. The repository uses keys/prefixes including:

| Browser key / group | Contents indicated by source | Notes |
|---|---|---|
| `artNexusLocalPreviewProfiles`, `artNexusLocalProfileSessionEmail`, `artNexusLocalProfileState:<email>` | Local profile name/email/avatar and a per-profile snapshot. | Visible to anyone with access to the same browser profile/device. Email appears in the local profile snapshot key (URL-encoded), not as a server-side database row. |
| `artNexusUserSession`, `artNexusLocalPillarState:<id-or-email>` | Local Creator/account session fields and per-account local Creator state snapshot. | Snapshot can include saved Creator data; it is browser storage, not a secure vault or a hosted account backup. |
| `artNexusCreatorPrivateDrafts`; legacy `artNexusCreatorWorks`; `artNexusCreatorWipProjects` | Private artwork metadata, locally resized 720p WebP previews, optional `storage_nodes[]` pointer metadata, an optional HTTPS external-video URL, and WIP/project notes. | New drafts and pointer/video metadata are private to this browser in local mode. Video is link-only: no video upload, embed, autoplay, or provider fetch; opening the link is an explicit external navigation. IPFS/Arweave entries are untrusted, syntax-checked metadata only; `local-handshake` is a local note. Browser/device backups and origin-level access remain possible. Public video metadata is still deferred pending live inventory. |
| `artNexusCreatorTransactionLinks:<scope>` | Artist-entered HTTPS external links and labels. | Saved on-device in local mode; links themselves are not verified or payment proof. No automatic link/token generation. |
| `artNexusCreatorCommissionSettings:<scope>`, `artNexusCreatorCommissionRequests:<scope>`, `artNexusLocalCommissionProposals:<scope>`, legacy `artNexusCreatorOrderQueue:<scope>` | Commission availability, local requests/proposals and legacy queue data. | Local proposal/request UI says not sent or delivered. Old stored values may remain on a device; no purge was executed. |
| `artNexusArtworkActivity` | Private bookmarks plus artwork title/artist/updated-time metadata. | Public heart counts, follows, follower counts, and engagement events are not enabled. Existing bookmarks remain private and browser-local. Public heart persistence/display is deferred pending live schema, policy, and data inventory; no counts are fabricated. |
| `artNexusVisitorName` in `sessionStorage` | Visitor-entered name. | Session-scoped browser storage; no campaign opt-in is collected. |
| `artNexusAppTheme` | Display-theme preference. | Preference only. |
| Legacy commerce keys (`artNexusCart`, `artNexusOrders`, `artNexusFeedPrintStock`, pending checkout state) | Older cart/order/stock flow state may exist in code or old browser storage. | Local-community mode guards commerce and provider behavior. No cleanup of pre-existing browser values was run. |

## External systems, logs and unknowns

- **Supabase Auth/Database/Storage:** used by legacy serverless code when configured. The current source configuration now fails closed outside mocked tests; this does not establish what is configured or running in a hosted deployment.
- **Google Drive and PayMongo:** legacy routes and schema remain. Both are disabled by the local-community runtime gate in the current working tree; hosted credentials, connected accounts, webhook history, files, and provider retention were not inspected.
- **Hosting/server logs:** server functions emit some error logs; host access/function logs, IP retention, CDN/cache behavior, and their deletion schedules are not available from the repository.
- **Analytics/ad SDKs:** read-only source review found no obvious analytics/ad SDK or external script tags in active source. This is not a live network, hosting-log, or deployment audit.
- **Campaign/newsletter data:** no campaign opt-in or mailing-list collection is enabled by this prototype. No consent records, email campaign table, export, or purge workflow was identified.
- **Legal/operator facts:** not established. This file is not a legal privacy policy and does not assert DPA/GDPR compliance, cooperative status, zero liability, or permanent erasure.

## Rate-limit storage: current behavior and strict one-hour design (design only)

**Current facts:** `consumeRateLimit()` HMACs `scope:clientAddress` with `RATE_LIMIT_HMAC_SECRET` and sends the 64-character hex result to the Supabase RPC. The SQL table is persistent. `consume_api_rate_limit()` creates or updates a row and resets counters when a window elapses; it does not delete the row. There is no repository cleanup job. Therefore, the current schema does **not** provide one-hour retention, and no history purge has occurred.

**Target design requested by the product owner:** retain rate-limit records for no more than one hour, using a database-native purge. This is a proposal only; **no migration was written or applied, no purge was run, and nothing was deployed.**

1. Replace the indefinitely reused single-key bucket with time-bounded bucket records. Add immutable `expires_at` (and a bucket/window identifier in the key) so an update cannot renew an old row's retention clock. Use the existing server-side HMAC approach; do not store raw client IP in the rate-limit table.
2. Keep every persisted rate-limit window shorter than the hard retention boundary. A practical schedule is a 58-minute maximum record TTL with a database purge running every minute, leaving buffer for scheduling delay; any API limits currently set to 60 minutes would need an explicit policy choice (reduce them slightly or redesign the limiter before migration). Do not silently claim the existing one-hour limits remain identical under a shorter TTL.
3. Use a database-native scheduled delete (for example, Supabase Postgres `pg_cron`) on an indexed expiry field, and also delete expired rows opportunistically inside the rate-limit RPC. The scheduled task is required so an idle system still purges data. Verify extension availability, job ownership, execution delay, failure alerting, and query plans in the actual project before calling the maximum guaranteed.
4. Test concurrent increments, boundary behavior, expiry, clock/scheduler delays, and failures. A missing/late purge job must be observable and must not be described as compliant with the one-hour target.
5. Separately audit platform/edge/function logs and backups: this database-row design does not limit IP retention in Vercel/hosting logs, Supabase logs, or backups.

**Operational limitation:** with a one-minute scheduler, a 58-minute per-record TTL gives a nominal worst case below one hour if the job runs on schedule; it is not a mathematical guarantee if the scheduler is delayed or disabled. The live project's scheduler and logs are unverified. The migration and operational validation need separate authorization.

## Repository evidence

- `supabase/migrations/202610160001_production_foundation.sql`
- `supabase/migrations/202610160002_private_drive_media.sql`
- `server/_lib/config.mjs`, `server/_lib/rate-limit.mjs`, `server/_lib/supabase.mjs`
- `api/account/state.mjs`, `api/catalog.mjs`, `api/creator/works.mjs`, `api/creator/assets.mjs`, and `api/**`
- `src/app.src.html` (local browser storage, privacy notice, local-mode behavior)
