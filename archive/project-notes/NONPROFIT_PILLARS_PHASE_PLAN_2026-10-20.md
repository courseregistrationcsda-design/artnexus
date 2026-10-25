# Non-Profit Product Pillars — implementation phase plan

**Revised:** 21 October 2026 (Asia/Manila)  
**Status:** Phase 1 and the Phase 3 local media groundwork are implemented in this working tree. Poster-card/waterfall/shuffle behavior, Creator social links, Single Release/Folio Stack/Video Release publishing and local management, public-by-default local publication with an explicit private-draft choice, returning-visit direct Browse startup, the responsive Folio peek carousel, the Browse Pages/Infinite chooser, once-per-browser welcome/name persistence, and local-only heart controls are also implemented locally. Production visibility/API/storage synchronization remains gated by inventory and review. The current user-defined Phase 4 P2P marketplace work is gated: only a clearly marked, unapplied SQL draft and a checkout-removal manifest exist so far. **Not deployed; the full storage migration is not complete.**  
**Database status:** No live database was inspected. No executable top-level migration was added or applied, and no purge was run. The P2P column proposal is in `supabase/migrations/drafts/20261020_sync_p2p_endpoints_DRAFT.sql`, outside the normal top-level migration sequence; it is not production-ready. Phase 3 migration authoring remains blocked pending live schema/data/object inventory.  
**Provider status:** No live provider was contacted or configured. No secrets were changed.  
**Release posture:** Deployment remains paused pending later phase gates and explicit authorization.

## Product direction

1. **Creator-led governance is a target, not a present legal claim.** Define a cooperative only after its legal entity, membership, voting, elections, and dispute rules are verified.
2. **Folio-first creative presentation.** Prioritize process, sequence, medium, technique, tools, and license; do not rank art by engagement or build a virality loop.
3. **Public-by-default publishing in this local Creator workflow.** Clicking Publish adds a Single Release, Folio Stack, or Video Release to the local Creator profile/Browse preview by default; a separate, explicit private-draft choice keeps it off the profile. This is browser-local presentation only and does not authorize production catalog/API synchronization. “Unlisted” is not the same as private.
4. **No automatically generated share bearer URLs or access keys.** Saving a draft, signing up, opening a page, or publishing a portfolio must not silently create a share token. Any future sharing-token creation must be caused by the creator’s explicit action. Share-URL/token generation is disabled in the local preview; public-preview means visible inside this local app, not externally addressable. A bearer link can be forwarded; it is not identity verification or protection against copying.
5. **Artist-controlled transactions, not centralized checkout.** The target is artist-entered external links and direct artist-to-collector arrangements. Art Nexus must not claim to process payment, verify settlement, fulfill orders, or protect either party unless that capability is separately built and verified.
6. **Artist custody of masters.** Generate bounded previews locally and keep masters in artist-selected storage. The current Drive/public-thumbnail implementation is legacy and must be migrated deliberately; public or immutable storage is not automatically private or erasable.
7. **Accurate privacy and consent.** No campaign opt-in collection or legal policy publication from prototype copy. Describe observed data flows, retention, operators, processors, and deletion limits accurately.

## Phase 1 — local privacy boundary, tests, build, and repository inventory

**Status: complete in this working tree; not deployed.**

### Completed work

- Realigned the plan to explicit-only share-token creation. The local Creator profile/Browse preview may show Creator-selected public releases, but it does not create share URLs/tokens or synchronize those releases to the production catalog.
- Wired `routeInterceptor()` and a guarded `fetch()` into the actual inline app in `src/app.src.html`. It returns a local 403 response for same-origin `/api` requests and recognized Supabase, PayMongo, and Google provider hosts. This app has no `src/app/router.js`; no unused router module was added.
- Added a fail-closed server runtime mode in `server/_lib/config.mjs`. Auth, checkout, Drive, and PayMongo configuration resolve disabled even if provider environment variables exist. The only opt-out is an explicit mocked-test flag requiring `NODE_ENV=test`; the `/api/config` route also returns 403 in local community mode.
- Repaired the Folio-like expectation, added `replaceChildren()` to the V4 fake DOM, corrected V6 Explore More fixtures and removed obsolete event-broker/for-sale publisher expectations, and updated V8 privacy, external-link, and local-only assertions.
- Created `DATA_INVENTORY_2026-10-20.md` from repository migrations and code. It clearly distinguishes migration definitions from an unverified live database.
- Prepared a database-native, strict one-hour rate-limit retention design only. No migration, purge, or deployment was performed.
- Rebuilt `index.html` from `src/app.src.html` using the repository’s supported `npm run build` command.

### Verification recorded

- `npm test`: **32/32 Node tests passed**, followed by V3–V8 regression harnesses (V7 account-isolation checks included).
- `npm run build`: completed; generated `index.html` with 28 embedded images (4,825,365 bytes; SHA-256 `522dd1b8402df29982bbd5a0e0d92e905c5b81d7fdb0f983a69c41297fed0a63`).
- Inline source and generated-script syntax and regression harnesses were checked locally.

### Limits of this phase

- These are workspace results, not a production deployment or hosted-provider verification.
- The client interceptor guards browser `fetch()` calls, not manual navigation, `curl`, or other clients. Server-side config gates are also present, but the deployment environment was not tested.
- The migration-defined `creator_works` table has no `visibility` column, and the legacy catalog/API path selects published rows. Local visibility choices—including the new public-by-default publishing UI—do **not** establish production server-side visibility or privacy. A reviewed schema/API/RLS change is required before any Creator visibility preference can be treated as enforced in production.
- The repository cannot establish whether migrations were applied, which data is in a live project, which storage buckets contain objects, which secrets are configured, or what host/provider logs and backups retain.

## Phase 2 — server-enforced visibility and share controls (not started)

1. Define and review visibility semantics (`private`, explicit public/listed, and any future link-only state). Do not map existing `unlisted` or `published` rows to a new meaning without an approved backfill plan.
2. Add a migration for visibility and server-side authorization. Enforce it in the catalog query, every artwork/API route, Supabase grants/RLS, caches, and public asset delivery. Test direct URL/API access, cross-account isolation, and unauthenticated access.
3. Preserve the current local workflow’s public-by-default Publish action and explicit private-draft option; these controls remain local-only. Define production visibility/defaults separately during the live inventory and schema/API/RLS review, with an explicit scope/preview and an undo/unpublish path before any production listing.
4. Keep bearer sharing disabled until explicit user invocation, revocation/rotation, expiry policy, cache behavior, and recipient semantics are approved and tested. Never call a random or unlisted URL “private”; anyone who gets a bearer link can forward it.
5. Do not run or deploy schema changes until a separate migration review/authorization and rollback plan are approved.

## Phase 3 — media custody and off-platform artist transactions (in progress; migration blocked)

### Implemented locally in this phase

- Extracted browser Canvas/WebP processing to `src/media/pipeline.js`, embedded by `src/build.py` so the generated app remains standalone. It enforces 1280 × 720 landscape / 720 × 1280 portrait bounds, a 300,000-byte maximum, bounded retries, and a visible failure instead of returning an oversized/original fallback.
- Reused that same 720p WebP pipeline in the local draft/WIP preview path and the legacy configured upload path. The upload handler now accepts at most 300,000 bytes and checks WebP canvas dimensions against the same orientation-specific limits.
- Added `src/app/storage_nodes.js` with optional `storage_nodes[]` draft metadata and an accessible Creator Studio form. IPFS CID and Arweave transaction-ID checks are syntax-only, mark records unverified, and do not resolve/fetch. `local-handshake` is stored as a device-local note without a network URI. These pointers remain in local drafts; no database schema/API field has been added.
- Temporary Supabase public previews are permitted for now. Eventual migration scope is **all** current `creator-public-assets` media—avatars, artwork, WIP, and thumbnails—not only artwork thumbnails.
- Verification after the poster-card, randomized masonry, local external-video-link, Browse-mode, preview-tail cleanup, one-time device welcome, and local-heart updates: `npm test` passed **41/41 Node tests**, followed by V3–V8 regression harnesses. `npm run build` succeeded with 28 embedded images; generated `index.html` is 4,857,140 bytes, SHA-256 `81a8dc6019a2b067d3f4f2a3354005c62e98f339451854088694970225463698`. The built inline script passed `node --check`. Regression coverage asserts a single closing `</html>` tag and no trailing text, one-time welcome persistence, account display-name priority, and local hearts without shared counts.

### Migration gate and remaining work

- Wait for a live schema/data/object inventory before authoring database migration SQL. A sanitized, read-only inventory request and SELECT-only query checklist is prepared at `LIVE_INVENTORY_REQUEST_2026-10-20.md`. Do not drop or rename tables, columns, bucket registrations, or objects, and do not delete media until that inventory and an export/rollback plan are approved.
- No live database, bucket, object, or provider was inspected in this phase; no migration, deletion, deployment, or provider change occurred. Existing Google Drive/database media paths remain legacy and need deliberate later cutover.
- Keep local preview resizing as a limit on uploaded resolution, not a promise against copying, scraping, or AI ingestion. Keep artist-managed external transaction links explicit, HTTPS-only, and clearly outside Art Nexus checkout. Never invent artist emails or imply that a local request notified an artist.
- Retire legacy central cart/checkout/order/payment flows in a reviewed code/data migration. Existing schema and test-only legacy paths are not proof that hosted payments are active.

## UI follow-up — poster cards, external video links, and Browse modes (implemented locally; public engagement deferred)

- Reworked Browse feed artwork cards to a poster-style overlay treatment inspired by the supplied reference. Image dimensions select portrait, square, landscape, or wide card proportions after load; `object-fit: contain` preserves the full artwork. Replaced the rigid row grid with a responsive multi-column waterfall so short and tall cards pack without large row gaps. Order is randomized once per app session but stays stable while filtering/browsing; Folio Stacks remain first and Explore More's four selected works retain priority. The caption treatment shows title, artist, and medium.
- Added optional HTTPS-only video links on artwork releases and a separate Video Release mode for standalone link-only video posts. Public and private local video entries are shown according to visibility in the Creator profile; links open in a new tab only after a user click. The preview does not upload video, embed a player, autoplay, or fetch the provider page. Video/social metadata remains account-scoped local state; it is not synchronized to the production catalog or shared API pending live inventory and review.
- Restored Browse's accessible Pages/Infinite switch. Pages remains the default; infinite mode loads 15 artworks at a time near the scroll sentinel and hides pagination. Switching modes resets to page 1 / the first batch and scrolls to the top. This preference is runtime-only (not persisted across reloads). A polite screen-reader status announces the active mode.
- Added an accessible “Leave a heart” control on Browse artwork cards, Artwork Detail, and Folio Stack. Heart selections are saved only in browser-local artwork activity; no server request, public/shared count, or artist notification is made. Existing private bookmark behavior remains separate. Shared counts and follows/follower counts remain deferred/suppressed.
- These changes touch only local source/UI and browser-local draft metadata. No schema, API, database, storage object, provider configuration, purge, or deployment was changed.
- The build and regression verification above includes card orientation/full-art CSS, no-grid waterfall rules, stable per-session shuffle, Folio-first and Explore More priority, safe HTTPS URLs, private-draft isolation, and the public-video-metadata gate. No browser visual audit was performed.

## Creator publishing and profile management — implemented locally (latest workflow; not deployed)

- Added editable Creator social-link entries with local profile display. Link fields, artwork/Folio releases, and link-only Video Releases remain scoped to the active Creator account in this browser's local app state; account switching and the existing sign-out/restore snapshot preserve account isolation.
- Creator Studio now has distinct **Single Release**, **Folio Stack**, and **Video Release** modes. Publish defaults to public in the local Creator profile/Browse preview; a separate explicit private-draft option keeps content off the profile. Standalone videos store only a validated HTTPS URL and metadata, never embed or fetch a provider, autoplay, upload video, or synchronize to a production catalog.
- Local Creator-authored Single Releases, Folio Stacks, and Video Releases can be edited or deleted from the Creator management UI. Production-loaded catalog work is tagged as managed and is not offered for local edit/delete; regression coverage verifies the handler refuses changes and the refusal persists across local storage reload.
- Public-vs-private filtering applies to local profile/Browse presentation. No production schema, API, catalog, storage, provider, database, or deployment change was made. Removing a local item removes its app copy only; browser/device backups may retain copies. Media still follows the strict 720p WebP orientation bounds and 300,000-byte ceiling; no original artwork upload was added by this local workflow.
- Verification: `npm test` passed **41/41 Node tests**, followed by V3–V8 regression harnesses. V4 covers public-by-default Single/Folio publishing, explicit private drafts, local edit/delete, production-managed edit/delete refusal, link-only video publishing/editing/deletion, HTTPS validation, local profile/Browse rendering, and the strict image-size limit. V8 covers social/video/work state snapshot/restore and account isolation. `npm run build` succeeded with 28 embedded images; `index.html` is **4,897,085 bytes**, SHA-256 `21b4f7ba0e892ca5094c579bd3577e9a722cd1e8c06c0051cf44e89182def0ce`. The built inline script passed `node --check`/VM syntax parsing; output contains exactly one closing `</html>` and no trailing text.
- These are local workspace results only. No browser visual audit, hosted persistence, live sync, or production catalog permission was tested or claimed.

## Relaunch and Folio carousel refinements — implemented locally (not deployed)

- Returning devices with a completed welcome marker/name or saved account name now go directly to Browse with both the landing gate and welcome overlay fully hidden. If browser storage is blocked/full and cannot preserve the once-per-device marker, the app fails open to Browse instead of showing the gate repeatedly. First-time visitors with usable storage still get the existing one-time welcome; account-specific display-name priority remains intact.
- Folio Stack Carousel now presents close, horizontally adjacent artwork cards with a visible portion of the next slide: 220–280px cards (42% of the track, clamped) on wider viewports and 74% on small screens, with an 8px gap. Snap targets and arrow/keyboard navigation now use each slide’s actual offset rather than the full viewport width. The vertical Folio layout is unchanged; artwork remains fully visible with `object-fit: contain`.
- Verification: `npm test` passed **41/41 Node tests** plus V3–V8 regression harnesses. V6 checks returning-device direct Browse, both splash layers hidden, storage-blocked fallback, responsive carousel rules, and per-card snapping. `npm run build` succeeded with 28 embedded images; `index.html` is **4,901,079 bytes**, SHA-256 `d62bc26d7b9847eaf7ae3c932ebdb3134b66783e3b996d0f2b80b9cc97be437a`. The built inline script passed syntax parsing; output has one closing `</html>` and no trailing text.
- Local workspace verification only. No production sync, migration, deployment, or live-browser visual audit occurred.

## Phase 4 — peer-to-peer marketplace (in progress locally; production work gated)

- Browse's accessible Pages/Infinite switch is restored in the local app. Pages is the default; infinite mode adds 15-artwork batches near the scroll sentinel. The full test suite and current build pass; the preference is runtime-only and is not persisted across reloads.
- The name welcome is now shown once per browser/device storage. The display name persists locally across visits; an active production or local profile’s display name takes precedence, so switching accounts updates the in-app identity. The app displays a name/initials, not passwords or stored authentication secrets.
- Created `supabase/migrations/drafts/20261020_sync_p2p_endpoints_DRAFT.sql` after the user selected an unapplied local draft. It adds `creator_profiles.p2p_links` with a non-null JSON array check, but remains intentionally outside the top-level migration sequence and must not be run/moved until inventory review and explicit authorization. It checks only top-level array shape; it does not validate link fields, URLs, wallet ownership/signatures, gateway verification, or source hashes.
- No endpoint validator, P2P drawer, profile write synchronization, catalog serialization, production schema change, or public sync has been implemented. Repository code currently routes profile writes through `api/creator/profile.mjs` / `upsert_creator_profile`; `api/catalog.mjs` allowlists profile fields and does not return `p2p_links`. The migration-defined public grants/RLS must be checked against live state before exposing the column.
- Do not ship claims of “verified” gateways, 0% protocol fees, in-app chat signatures, or Folio-hash source encryption as existing features. Those mechanisms are not present or verified; buyer guidance must state only verified capabilities.
- No checkout code has been deleted. The supplied deletion paths do not match the repository. A read-only proposed removal inventory is at `CHECKOUT_REMOVAL_MANIFEST_DRAFT_2026-10-20.md`; the user selected “manifest first.” Actual runtime modules, monolithic UI references, Vercel cron/CSP, tests, and historical Supabase objects are mapped there. Historical migrations and transaction data are not to be erased as part of code retirement.
- The user selected “unapplied migration draft” for the P2P schema and “manifest first” for checkout removal. No live inventory, migration application, data deletion, provider-secret change, or deployment occurred. Follow `LIVE_INVENTORY_REQUEST_2026-10-20.md` and obtain separate approval before any shared-state change.

## Later track — governance, campaign consent, operations, and publication (not started)

- Verify legal/operator roles, cooperative status, membership/voting rules, and any required Philippines legal/privacy review before using such claims.
- Do not collect campaign contacts until double opt-in evidence, separated storage, access, export, retention, deletion, backup purge, and incident procedures exist and are verified.
- Audit hosting/CDN/function logs, Supabase logs, provider processors, backups, and operational access before publishing a policy.
- Publish only wording that matches the deployed system. Do not claim GDPR/DPA compliance, zero liability/regulatory burden, immediate/permanent erasure, or complete absence of tracking without evidence.

## Rate-limit retention decision — strict one-hour design only

The existing `api_rate_limit_buckets` table is persistent Supabase data. Its current RPC upserts and resets counters but does not delete inactive rows; no cleanup job was found. The approved direction is a database-native purge with an at-most-one-hour target. The specific schema/RPC/scheduler design, its execution-delay caveat, and current fields are documented in `DATA_INVENTORY_2026-10-20.md`.

**Not authorized or performed:** writing/applying a migration, running a purge, changing live data, changing provider settings/secrets, or deploying. The design must be reviewed against actual Supabase `pg_cron` availability, job health, logs, and the current 60-minute API limits before implementation.

## Preservation and release checklist

- Preserve responsive and accessible design, local preview, Creator/Profile/Explore More fixes, private bookmark behavior, Folio vertical spacing/carousel/swipe/buttons/keyboard controls, and Browse position on return.
- Preserve separate personal and public studio names, Creator Studio signup handoff, sign-out without Creator-data loss, correct account restoration/isolation, and `productionPublicArtists`/`creatorDisplayName()` behavior.
- Keep Artwork Detail and Folio Stack viewers headerless with outside-click/Escape close, Folio actions and scroll cue, fade-only Explore More, and four similar-work priorities.
- Keep logos as transparent PNGs without opaque plaques or padding.
- Verify no provider configuration or secret changes, no data migration/purge, and no deployment without explicit authorization.
