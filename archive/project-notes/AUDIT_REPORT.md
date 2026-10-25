# ART NEXUS Prototype — Audit & Remediation Report

**Review date:** 14 October 2026 (baseline audit)  
**Creator Core Engine addendum:** 15 October 2026  
**V3 operational-preview addendum:** 15 October 2026  
**V4 Folio Stack integration addendum:** 15 October 2026  
**V6 branding and discovery-preview addendum:** 15 October 2026  
**V7 local-account/session addendum:** 15 October 2026  
**V8 commission-panel fix addendum:** 15 October 2026  
**V9 My Profile dropdown/sign-out addendum:** 15 October 2026  
**Build reviewed:** v0.40 (`index.html`, editable source: `src/app.src.html`)  
**Assessment at audit time:** The audited front-end defects below were remediated for the local demo build. This report predates the production integration work and contains historical statements about email-gated splash/auth, API availability, and commerce. For the current production-code status and blockers, see `PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md` and `PRODUCTION_READINESS_GAP_REVIEW_2026-10-16.md`. It remains useful for its local UI/accessibility/performance findings; it is not current API documentation.

## Executive summary (historical baseline)

The remediation order has been implemented while preserving the mobile-app shell, six-artist roster, 50-row feed, narrow-screen two-lane behavior, Batch 3–5 hooks, and all artwork assets. The feed defaults to numbered pages of 15 artworks, with an accessible switch to optional infinite scrolling in cumulative 15-item batches; solid artwork/info layers, a dark frosted-glass artwork-detail panel, the My Profile avatar with local-preview Sign Up/Sign In access, and an immersive detail zoom mode remain. App-level ART NEXUS logos still return to the first feed page and refresh the featured artist while preserving cart, account, and order data. The initial screen remains the animated visitor splash with randomized embedded artwork, a 6px blur, 150% zoom, slow drift, and a full-screen tinted glass wash. Visitors continue only after entering a name and valid email; the email is only validated and neither field is sent or persisted, and this gate does not create an account or authenticate a user. After valid submission, V6 restores the earlier animated artwork collage: randomized embedded/local tiles move outward from center into a responsive grid, then reveal a refined Cordillera Void composition with “Welcome to,” a restrained Amber ART NEXUS wordmark, visitor name, short Amber rule, and “art meet.” Tiles fade as Browse appears across a four-second handoff. All copy uses the default app font; the name caps at 42px, preserves entered casing, and wraps on balanced lines. The old oversized 500× brand-logo zoom is not used. Reduced-motion preference skips the animation and reveals Browse immediately. The established splash art crossfade/backdrop, footer, and softened pointer/touch ambient glow remain. There is no separate Login/Register entry screen or three-second static-logo interstitial; existing Creator/Collector onboarding remains available through its existing in-app setup controls, separate from the My Profile local-preview Sign Up/Sign In flow. The visitor-splash logo focuses the name field and cannot bypass validation. Onboarding panels and fields use solid pearl-white surfaces with palette-locked ink/Amber contrast; the featured-card sheen cycles every 10 seconds and the local-preview Sign Up CTA hint every 15 seconds (both respect reduced-motion preferences). The color-token layer and original app shell remain intact. V7 snapshots local account data by profile and restores Creator profile/portfolio/WIP, engagement, follows, cart, and local orders on email-only sign-in; Creator Studio opens immediately after successful Creator setup. V8 fixes the Request Commission panel by moving it outside the inert Artist Profile dialog while preserving modal focus restoration. V9 makes My Profile a dropdown (Sign Up/Sign In while signed out; Creator Studio only for a logged-in Creator), fixes the frozen Creator editor by closing the higher-layer parent first, and reloads on Sign Out while keeping the Creator profile/portfolio browsable from its saved local snapshot.

- Feed listing state now survives detail → cart → checkout. `FOR SALE` is an Original, `PRINTS AVAILABLE` is a Print, and a null-badge feed item cannot be purchased. The buy handler and checkout both re-check the listing. Original stock keys are stable across feed and catalog paths, preventing duplicate 1-of-1 cart entries.
- Browser zoom is restored. Feed cards, artist rows, artwork tiles, onboarding choices, and payment options use keyboard-operable native controls; profile tabs have tab semantics and arrow-key navigation; artwork retains keyboard zoom/reset shortcuts with no visible zoom toolbar.
- Checkout labels are associated with all fields; required/invalid state and linked error descriptions are updated during validation, and invalid fields receive focus.
- Profile, artwork, cart, checkout, navigation, and onboarding layers have names, modal state, focus entry/trapping/restoration, Escape handling, and background inerting. Toasts and dynamic status/error messages are announced.
- The former rose, purple, and crimson UI colors were replaced by a minimal Void / Amber / white palette with token-derived silver layers; a dynamic WCAG / APCA-style surface guardrail, Amber graffiti-logo variants, and accessible hover/focus pairs were added. Text selection remains available, redundant static facets were removed, and the unreachable drawer Collaborate route was removed. `openDrawerSection()` remains a documented Batch 3 host-integration hook.
- Optional same-origin clients validate a 50-card `/api/feed`, identity-match `/api/profile`, and POST Follow/Unfollow actions to `/api/social/follow`; absent or invalid routes retain embedded/local state. Follow preferences persist locally per active preview profile and restore after refresh/sign-in; there is no server Follow-state read endpoint, so remote follows are not hydrated. No API server is bundled, and profile reads are skipped without a server-issued ID.
- Creator signup now stores a UUID-layout `artist_id`, `studio_name`, `biography`, and multi-value `verified_mediums` array locally. The `#creatorStudioDashboard` modal publishes artwork metadata to the top of Browse without changing the relative order of the original 50 cards. Non-sale work is a public, view-only **Unlisted Portfolio Artifact** with no price or purchase control; For Sale items retain demo 1-of-1/Prints commerce. A separate local WIP project stream records progress and timestamped milestones with optional preview assets. Public WIPs/Recents tabs retain their selectors and local data but display the exact migration overlay. The opt-in cloud registry adapter is inert without a configured endpoint; no backend is bundled or claimed.
- Payment, wallet, receipt, and download interactions are explicitly labelled simulations. No payment provider, email service, carrier, or download backend is connected.
- **v0.32 profile and artwork activity:** the header Sign Up control is now a My Profile avatar. Local preview Sign Up/Sign In stores name and email in `artNexusLocalPreviewProfiles`, with email-only lookup and no password; it is not secure authentication and must not be represented as such. Both this flow and Creator/Collector onboarding reuse the splash's animated-art/ripple backdrop behind solid readable forms. The mandatory visitor name/valid-email gate remains separate and unsaved. Each of the six seeded artists has empty Instagram, Facebook, TikTok, Behance, and Website slots until real URLs are supplied. Browse cards and artwork detail have heart/bookmark actions; liked and bookmarked artwork history persists under `artNexusArtworkActivity`. Without a backend, appreciation counts are visibly marked “local” and represent only this device (0/1), not people across the service. An optional `window.ART_NEXUS_ARTWORK_SOCIAL_ENDPOINT` GET/POST adapter is documented in README.md; no endpoint is configured. Detail shows the complete artwork in front of a 200%-scale backdrop clone at 70% opacity and 28px blur, with actions above the information sheet; the “Touch Canvas Active” badge is absent.

## Remediation results, in the recommended order

### 1. Listing availability and 1-of-1 purchase protection — implemented

`openArtDetailModal()` now carries the feed card’s badge, listing source, purchase type, and stable stock key into artwork detail. `renderSale()` shows the correct badge and price for listed items and disables the buy action for an unlisted item, even when an unlisted feed card maps to a catalog work key. `buyNow()` rejects unavailable items and duplicate Originals. `validateCartForCheckout()` removes stale, ambiguous, unavailable, or duplicate Originals before checkout. Prints retain the digital-email path; Originals retain the shipping path. Legacy catalog cart entries can be identified from catalog keys/titles, while ambiguous legacy feed entries are not silently treated as Originals.

### 2. Mobile zoom and keyboard-operable controls — implemented

The viewport no longer sets `maximum-scale` or `user-scalable=no`. Native buttons open generated feed cards, artist rows, gallery tiles, and profile works without nesting the separate Buy action. Payment selection uses a native radio group; onboarding selectors are buttons with `aria-pressed`. The featured-artist hero retains Enter/Space activation; its subtle sheen is time-based and pointer-events-free. Artwork detail has no visible zoom toolbar: double-click, wheel, pinch, and `+` / `-` / `0` keyboard gestures zoom the canvas; zooming in hides the header and purchase sheet, and a click/tap or zooming back to 1 restores them. The purchase sheet uses a dark Cordillera Void glass layer (86% opacity) with a 16px backdrop blur and a high-opacity fallback so details remain legible over bright artwork. Focus-visible styling is retained for controls and custom focus targets.

### 3. Checkout labels and errors — implemented

All delivery, wallet, and card inputs have associated labels; payment choice is an explicitly labelled radio group. Eleven required delivery/email/card controls carry `aria-required`; all 12 validation controls, including the conditional wallet-phone field, have `aria-invalid` and linked help/error descriptions. Validation updates field state and descriptions, announces errors through the status region, and focuses the first invalid field. Card and wallet inputs remain local demo validation only.

### 4. Dialog focus and announcements — implemented in source

Artist profile, artwork detail, cart, checkout, navigation, and onboarding layers have accessible names and modal semantics. Opening a layer moves focus into it; Tab/Shift+Tab remain within it; Escape dismisses it; closing restores focus when the opener remains available. Nested artwork detail remembers and restores its parent profile and exact work trigger. Background siblings are made inert while the layer is open, with the cart backdrop preserved for pointer dismissal. Checkout steps and the artwork availability note have status/region semantics; the toast is a polite atomic status region.

### 5. Premium charcoal/Amber palette, contrast guardrail, selection, tabs, and zoom semantics — implemented

The CSS design namespace now uses only three opaque color tokens: Cordillera
Void `#1A172D`, Nexus Amber `#EE9E49`, and pure white `#FFFFFF`. Rose, purple,
and crimson UI hues have been removed. “Silver” text, fine borders, and raised
or inset charcoal panels use alpha derived from the white token rather than
additional raw colors. The entire canvas remains Cordillera Void; primary text
and icons are white, secondary text is 72%-white silver, muted offsets are
56%-white, and Amber is reserved for high-priority actions, active paths, and
marketplace status tags. Filled Amber controls/tags use Cordillera Void text.
The existing transparent Amber graffiti wordmark and official logo placements
are retained.

The runtime guardrail marks Void, inset, raised, Amber, and pearl-white surface contexts,
composites alpha-derived foreground/background layers, evaluates WCAG contrast
and an APCA-style Lc estimate, then applies foreground and focus roles. It
observes dynamically added content and judges the focus ring against the nearest
containing surface. Dark contexts use white / silver / Amber roles; Amber
surfaces use Void copy/icons. All sale and print-availability badges use Amber
with Void text. Focus and hover pairs are palette-locked. The APCA-style helper
is a heuristic and has not been independently validated against the official
library; it is not an APCA certification. General pulsing status animation,
saturated glows, and scale-based press effects remain removed or softened;
only the explicitly requested restrained featured-card sheen and Sign Up
nudge run periodically, and both are disabled for reduced-motion preferences.
Outside the specifically requested controls, the existing DOM order, grids, and event handlers remain unchanged.

Standard inputs and selects retain their dark inset treatment. Onboarding uses
opaque pearl-white cards and fields with Cordillera Void copy. The 76%-Void
secondary copy measures 8.00:1 WCAG over pearl white, and 72%-Void placeholders
measure 6.93:1; the runtime surface map recognizes the new pearl token. Standard
inset-field placeholders remain at 8.45:1 WCAG and about Lc 64.

Representative WCAG 2.2 and APCA-style contrast calculations (absolute Lc):

| Foreground / background | WCAG ratio | APCA-style Lc | Role |
|---|---:|---:|---|
| White / Cordillera Void | **17.44:1** | **104.8** | Primary text/icons |
| 72%-white silver / Cordillera Void | **9.45:1** | **66.7** | Secondary copy |
| 56%-white silver / Cordillera Void | **6.19:1** | **47.4** | Muted offsets |
| Nexus Amber / Cordillera Void | **7.99:1** | **58.5** | Highlights/focus on dark |
| Cordillera Void / Nexus Amber | **7.99:1** | **59.3** | Amber controls and status tags |
| 70%-white placeholder / Cordillera Void | **8.99:1** | **64.2** | Placeholder over base Void |
| 70%-white placeholder / inset field | **8.45:1** | **64.1** | Actual charcoal form treatment |
| Nexus Amber / raised charcoal layer | **6.91:1** | **56.1** | Highlight on a raised panel |

Silver values include alpha compositing; the inset field row includes both the
3.5%-white field backing and 0.7-opacity placeholder. These representative
pairs are calculated, not a full browser-based accessibility certification.

Global text-selection suppression remains removed; only the artwork image
surface suppresses selection/drag. Profile tabs retain tab semantics, selected
state, panel relationships, roving focus, and Left/Right/Home/End navigation.

### 6. Redundancies and remaining stubs — cleaned/labeled

Static “Any …” options were removed from the artist/style/material facets because `setFacetOptions()` supplies them at startup. The drawer’s Collaborate destination branch was removed; collaboration remains profile-only, while the required integration hook is documented. Network and My Gallery are visibly marked “Coming soon” and give an explanatory message. Save and Follow state is session-only and says so. The generated feed still intentionally reuses catalog assets; it remains illustrative rather than 50 unique works.

## Visitor splash, welcome transition, and logo reset

In-app Art Nexus logos (screen headers, artwork detail, navigation drawer, onboarding, checkout, and generated receipt) remain keyboard-operable buttons that close open layers, reset transient browse filters/page position, refresh the featured artist, and return to the feed start. They preserve cart, account, and order data. On the required visitor splash, the logo instead focuses the name field; it cannot bypass the name/email gate.

The former three-second static logo interstitial and Login/Register entry screen have been removed. The animated visitor splash is the initial screen and remains until the visitor enters a name and valid email, then selects the clickable “Hello, stranger!” message (Enter submits too). The email is validated but neither saved nor sent; the gate creates no account or authenticated session. The embedded art crossfades every four seconds at a base 150% scale, drifts slowly, and uses the established 6px blur (40% of the prior 15px value). The rounded translucent card remains removed; a full-screen dark glass wash keeps the text and fields readable without boxing in the art. Mouse/pen movement and taps/clicks on the splash create short water-ripple rings. After submission, all available distinct artwork sources are deduplicated and randomized into an edge-to-edge responsive collage. A single staggered journey carries tiles from the center into the full-screen grid, then continues zooming and fading them toward white without a held pause. The welcome text appears during the motion; Browse starts revealing as the whiteout and tile fade continue. The overall transition remains four seconds. Reduced-motion settings suppress the movement and fades while retaining a static collage until the transition completes; no external image, font, or script is introduced.

## Desktop browsing layout

The default 50-card feed is paginated into 15 artworks per page (15/15/15/5), with numbered pages and Previous/Next controls. The accessible “Infinite scroll” switch replaces pagination with cumulative batches of 15 and an intersection-observed load sentinel (with a scroll-event fallback); status text announces the loaded count and end of feed. Filtering starts each mode from the beginning. The featured-artist hero appears only on page one in paginated mode and stays at the start of the infinite feed. At app-frame widths from 760px, the desktop view uses a three-column grid; at 1100px it expands to four, 1500px to five, and 1900px to six columns. Narrower frames retain the existing alternating two-lane feed. Cards are rendered once in natural DOM/reading order for the desktop grid; a resize observer switches layouts as the app frame changes size. Batch 3 feed IDs/hooks and the original 50-card generator remain intact.

**Responsive desktop update (15 October 2026):** the desktop shell no longer stops at a 1440px max-width; it fills the available browser viewport. Browse hero/tools/feed, artist directory, gallery, and Movement content now scale with fluid side gutters instead of 900–1120px desktop caps. On very wide screens the feed, gallery, and artist directory add columns rather than stretching a narrow centered canvas. The phone shell (up to 430px) and alternating two-lane feed are unchanged. These CSS changes were source/build-checked; visual browser screenshot QA remains outstanding.

## Creator Core Engine (v0.30)

Creator signup persists `artist_id` as a UUID-format identifier, `studio_name`, `biography`, and `verified_mediums` as an array in `artNexusUserSession`. Legacy Creator sessions are migrated in-place when a UUID or canonical fields are missing. The creator identity remains separate from the six seeded artists; the profile's internal routing key stays `creator-self`, while the persistent `artist_id` is the creator record identifier. No server identity is issued locally.

Edit Profile opens the modal workspace with the exact selector `#creatorStudioDashboard`. Artwork submissions carry title, description, medium, Boolean `is_for_sale`, `sale_type` (`1-of-1`, `PRINTS`, or `null`), and `price_value`. Existing demo artwork images are resized to JPEG locally; uploads accept JPEG/PNG/WebP/GIF up to 15 MB, with an eight-work cap and local-storage error handling. Each new feed entry is inserted using `mockArtDatabase.unshift(newEntry);` and rendered through `populateMasonryFeed()` without a reload. Creator entries appear ahead of the original 50 feed cards; the seeded 50 remain in their existing relative order. A sync after reload rebuilds these client-owned entries from local storage.

When `is_for_sale` is false, the UI labels the work **Unlisted Portfolio Artifact**. It remains visible, open, and interactive in Browse and the creator Portfolio, but has no displayed price or purchase control. It is included in the `NOT LISTED` filter. For Sale items require a valid sale type and PHP amount and enter the existing demo detail/cart/checkout path as either a 1-of-1 Original or Prints listing. Cart and checkout availability are rechecked against the current local work and sale metadata; stale or changed listings are rejected. No real payment is processed.

The dashboard also stores WIP projects in `artNexusCreatorWipProjects`: project name, current status summary, 0–100 completion percentage, and chronological milestones with ISO timestamp, log text, and optional resized preview asset. Public WIPs/Recents tab selectors remain, but taps show the exact migration overlay while underlying local data remains intact. Artwork, profile, and WIP data are local to this browser. Public artwork is visible within the prototype's profile/Browse UI; WIP/Recents tabs are currently frozen behind the migration overlay. Nothing is published to a remote service. A session-registry adapter can POST `artist_id`, `studio_name`, `biography`, and `verified_mediums` only when a deployment configures `window.ART_NEXUS_CREATOR_REGISTRY_ENDPOINT`; there is no configured endpoint or backend route in this package, so local storage is never described as cloud sync.

The Creator row and six seeded artists remain separate. Clearing the session or switching to Collector explicitly removes local Creator data; the universal-logo browsing reset still preserves account/profile/cart data. User-authored text is cleaned and escaped, and uploaded data is constrained to safe JPEG data URLs. Browser storage quota and availability can vary.

## Optional platform-data sync

The client attempts same-origin `GET /api/feed` only when served over HTTP(S). It adopts the response only when it normalizes to exactly 50 valid cards matching the current feed schema; IDs, artist IDs, embedded-image keys, badges, heights, and prices are checked, and feed text is HTML-escaped before display. Otherwise, the local 50-item generator remains active. Requests time out after six seconds. The legacy profile request runs only when the stored local session has a nonempty server-issued `id`; the response ID must match, and only recognized session fields are merged. The Creator's UUID-format `artist_id` is client-generated, not a server-issued ID and does not independently authenticate or sync the profile. Cloud registry POST is a separate optional adapter; no endpoint is bundled.

This package contains no `/api/feed` or `/api/profile` server. Live API behavior was not tested against a backend; an absent endpoint leaves the offline demo usable.

## Optional social Follow sync

The Follow button keeps its immediate `Set`-based class/text/`aria-pressed` behavior and sends a same-origin JSON `POST /api/social/follow` with the selected artist ID and action. The action comes from the pre-click state: Following → `unfollow`, Follow → `follow` (correcting the pasted snippet’s reversed conditional). Requests use the shared six-second timeout; non-2xx/network failures are logged while local page-session state is retained. Duplicate clicks are suppressed while that artist’s request is pending. No server route or Follow-state read contract is included, so backend acceptance/persistence and refresh hydration were not verified.

## Demo-only transaction wording

The checkout is titled **Demo Checkout**. The payment step warns that wallet/card flows are simulations, asks users not to enter real credentials, and states that no funds move. Wallet status and transaction receipts identify themselves as simulated. The receipt says **Demo Receipt — No Charge Processed**; print email/download messaging states that no email or file backend is connected. Shipping form copy says no carrier or fulfillment service is connected.

## Verification record

- **Build:** `python3 src/build.py` completed; the output is one self-contained HTML file with 28 embedded images.
- **API client harness:** passed strict 50-card replacement/fallback, safe text escaping, profile ID matching, rejection of a mismatched profile, and the rule that profile sync is skipped without a server ID.
- **Social Follow harness:** passed `follow`/`unfollow` action mapping, same-origin JSON POST options, and retention of optimistic page-session state after a simulated HTTP failure.
- **JavaScript:** extracted the inline script and ran `node --check`; passed.
- **V9 static HTML/accessibility checks:** 270 unique IDs; all 58 input/select/textarea controls have an associated, wrapping, or explicit accessible label; all 51 distinct ARIA ID references resolve; no duplicate IDs, broken label targets, or external script/image references. `creatorStudioDashboard` and `profileAccessMenu` are present. These are source-level checks, not a complete accessibility audit.
- **Creator Core Engine source harness:** passed UUID creation/profile mapping, verified-medium array handling, new artwork schema validation, local artwork and WIP-project persistence/restore, explicit local-only registry behavior without an endpoint, and original 50-card relative-order preservation after prepending creator entries.
- **Creator dashboard workflow simulation (mock DOM/FileReader/canvas):** exercised actual artwork-submission and WIP project/milestone functions. It passed top insertion via `unshift`, immediate `populateMasonryFeed()` invocation, the non-sale `false/null/null` matrix, exact Unlisted Portfolio Artifact label, `PRINTS` metadata, and timestamped chronological WIP updates. Separate render simulations confirmed that Browse cards remain clickable without a price, the detail UI hides price/cart controls for non-sale entries, and valid Prints retain demo commerce UI. The canvas/browser APIs were mocked; this is not real browser image-decoding or visual QA.
- **Modal lifecycle harness (mock DOM):** passed nested profile → artwork-detail open/close, focus return to the profile artwork trigger, profile-link transition, and final return to the original feed opener. This exercises source functions with a mocked DOM; it is not a browser test.
- **Purchase logic harness:** passed `FOR SALE` propagation, `PRINTS AVAILABLE` → Print classification, rejection of an unbadged feed card even when it maps to a catalog work, ambiguous legacy-feed rejection, feed/catalog 1-of-1 duplicate prevention, explicit stale-unavailable rejection, checkout cleanup, and exact-title legacy-catalog recovery.
- **Desktop layout harness:** passed narrow two-lane split and wide-grid single rendering in natural feed/reading order.
- **Feed pagination harness:** checked 50 items split into pages of 15/15/15/5, numbered navigation, Previous/Next bounds, page-one reset on filter changes, and featured-artist visibility only on page one.
- **Infinite-scroll harness:** checked default pagination, switch `aria-checked` state, pagination suppression in infinite mode, cumulative 15-item loads through all 50 artworks, end-of-feed status/sentinel hiding, filter restart, switching back to page one, and both IntersectionObserver and scroll-event fallback loading.
- **Immersive zoom harness:** checked double-click zoom/restore, click-to-return, wheel and pinch state transitions, and hiding/restoring the detail controls without visible zoom buttons.
- **Detail-sheet styling check:** verified the built purchase panel uses an 86%-opaque Cordillera Void glass layer, 16px backdrop blur, and a WebKit-prefixed fallback; this is a code/style check, not a browser screenshot review.
- **Visitor splash/welcome harness (mock DOM/timers):** confirmed malformed-email rejection, a valid-name/email route into Browse, personalized greeting, and generation of all 20 distinct embedded artwork sources exactly once (including duplicate-source feed records). Checked full-screen responsive tile dimensions and the single continuous 3,880 ms zoom/fade keyframe (with no separate held scatter/whiteout animation), plus timer phases: message at 1,550 ms, whiteout at 2,650 ms, main-screen reveal at 3,300 ms, and Browse enabled at 4,000 ms. Reduced-motion mode retained a static collage and enabled Browse at the same four-second endpoint. This is a source-function simulation, not visual browser QA.
- **v0.32 Profile/engagement harness (mock DOM/localStorage/fetch):** passed local sign-up, email-only sign-in, initials avatar, sign-out, activity history, persisted like/bookmark state, accessible pressed-state updates, and local 0/1 fallback counts. The optional artwork-social adapter correctly consumed aggregate GET counts and accepted an appreciation POST response. Static checks confirmed five empty ready-to-fill social-link slots per seeded artist, the 2× / 70%-opacity / 28px-blurred background clone, detail actions above the sheet, and removal of the Touch Canvas badge. This is source-function simulation, not secure authentication, backend testing, or visual browser QA.
- **Sign-up splash-backdrop lifecycle harness:** confirmed the same landing artwork node transfers behind both sign-up surfaces, binds modal pointer-ripple listeners once, returns to the visitor splash on close, and restarts/stops the four-second art cycle according to the active screen. The existing reduced-motion stylesheet behavior remains in force.
- **Pearl onboarding contrast check:** verified the white surface maps to the contrast-white token, charcoal copy/fields use palette tokens, and calculated WCAG ratios exceed 6.9:1 for placeholder/secondary text and 17.4:1 for primary copy.
- **Motion cue check:** confirmed a 10-second featured-card sheen and 15-second Sign Up pulse, with both disabled for `prefers-reduced-motion`.
- **Universal-logo reset harness:** confirmed app-level first-feed-page navigation, featured-artist refresh, browse-filter reset, visitor-gate protection before valid entry, and preservation of cart/account/order state without changing persisted account/order data.
- **Landing-background harness:** verified random embedded-art rotation every four seconds, 150% drift, 6px blur with no rounded card overlay, pointer-movement/tap ripples across the visitor splash, the separate expanding/scattering artwork collage, and reduced-motion gating.
- **Preserved:** 50-item feed generator, six-artist roster, alternating narrow-screen two-lane split, existing badge/height/price rules, key Batch 3–5 IDs/hooks, mobile prototype framing, and embedded-asset build.
- **Palette/token audit:** CSS contains exactly the three allowed opaque hex tokens and no non-token hex or raw numeric RGB literals; silver, borders, and surface layers use token-derived white/Amber alpha.
- **WCAG/APCA-style guardrail harness:** exercised Void, inset, raised, Amber, and pearl-white contexts, including high-contrast onboarding card/field, dark-chip, Amber-selection, and focus roles. Amber tags resolve to Void text; the 0.7-opacity white placeholder on an inset field measures 8.45:1 WCAG and approximately |Lc| 64.1. These values are heuristic/calculated, not certification.
- **Logo/build checks:** 28 referenced images embedded, including transparent Amber graffiti wordmark variants; generated wordmark RGB is the exact Nexus Amber token. The receipt wordmark keeps its existing placement on the raised charcoal backing.
- **Contrast table:** representative token and derived-surface pairs are listed in Section 5, including alpha-composited placeholder values.

## Limitations / not tested

A real-browser visual pass, viewport-by-viewport layout inspection, end-to-end pointer/keyboard walkthrough, VoiceOver/TalkBack/NVDA testing, and assistive-technology verification were not available in the sandbox. Therefore focus behavior and screen-reader announcements are code-reviewed and statically checked, not certified by hands-on testing. The `/api/feed`, `/api/profile`, `/api/social/follow`, and optional artwork-social endpoint are not included and were not tested against a live server; serve this file from the same origin as configured routes to enable sync. Follow state has no GET hydration path in the supplied contract. The email-only local My Profile preview is not authentication; connect a real provider and server before online deployment. Local artwork appreciation counts are not cross-user totals. Payment, fulfillment, email, and downloads cannot be verified because their backends do not exist; no real payments or files are processed.


## V3 operational-preview addendum — 15 October 2026

### My Profile → Creator Setup modal handoff

The report that the Setup CTA left users on My Profile was traced to the
profile overlay's z-index (1850) exceeding onboarding's (1800). Opening Creator
Setup now closes the profile layer first and preserves the original focus-return
target, then activates onboarding. This prevents the setup layer from sitting
behind the account dialog and avoids an unnecessary nested-modal stack.

### Commission intake and public migration panels

Creator Studio now includes a local open/closed commission governor with an
integer 0–5 slot field and a proposal/order intake. A first-time Creator profile
starts with intake open and five available slots so the Request Commission CTA
is usable immediately; creators can close intake or adjust the slot count. The
commission CTA is shown only on the local Creator's profile. Closed/full state uses the exact label
`🔒 Commissions Full (5/5 Slots Taken)`. Requests begin in
`Pending_Acceptance`; accepting consumes one slot and sets `In_Production`, and
rejecting sets `Rejected`. Alert counts derive from local pending queue records.

Public WIPs/Recents selectors remain in the profile. Their overlay reads exactly
`🛠️ Under Construction • This studio workspace module is migrating to our secure backend pipeline.`
The panels' underlying content and stored Creator WIP/milestone data remain;
public selection does not delete it.

### Event and checkout order routing

For-sale Creator uploads append a device-local preview titled **🔥 New Collection
Update!**. A 1-of-1 upload uses the exact payload body
`[Studio Name] just launched a premium 1-of-1 original cultural artifact into the browse feed!`.
The event log resolves recipients as unavailable and states **Local preview
only · not sent**. No asynchronous push or remote event is represented.

Demo checkout saves `Pending_Acceptance` in the local buyer order and writes
every demo order to the device-local review queue/alert count, which appears in
Creator Studio after a local Creator profile is set up. Accept/reject writes
`In_Production`/`Rejected` to both queue and matching buyer order. The local order
copy explicitly states no payment was captured; this is not a real funds hold,
payment, or fulfillment transaction.

### V3 checks performed

- Extracted inline JavaScript passes `node --check`.
- Targeted mock-DOM/localStorage harness passes the My Profile → Creator Setup
  modal handoff, public CTA closed/open labels, proposal creation, alert count,
  slot decrement on accepted proposal, order acceptance/rejection propagation,
  event-local-only status, and exact overlay text with WIP content retained.
- `python3 src/build.py` produces one HTML file with all 28 referenced images
  embedded.
- This check set is code-level; visual/browser, cross-device, backend, payment,
  notification, wet-signature, delivery, and assistive-technology behavior
  cannot be certified because those services/hardware tests are absent.


## V4 Folio Stack integration addendum — 15 October 2026

### Local Folio creation and Browse routing

Creator Studio now has a Single Release / Folio Stack format toggle before the
shared artwork form. Folio mode accepts up to eight local images, resizes them
in the browser, treats the first selected image as the cover, and stores the
remaining images as secondary slides in the existing Creator work record.
Creators can see the horizontal thumbnail track, append through the dotted
file/drop slot, remove secondary slides, or clear the selection. No cloud image
upload is represented.

A valid Folio requires at least two images. Its Browse masonry representation
is one poster card with the cover image and a translucent dark stacked-card
icon in the upper-right. Browse and the Creator's Portfolio route Folio works
to a full-screen, vertically scrolling image-strip lightbox. The for-sale
lightbox action enters the existing artwork-detail flow; demo cart/checkout
semantics are unchanged.

For-sale Folio uploads add a device-local event with title
**🔥 New Collection Update!** and body
`[Studio Name] just launched a new Folio Stack into the browse feed!`. The
preview is labelled **Local preview only · not sent**; no follower registry or
push-delivery service is connected.

### Commission rights field

The local commission request form now requires an intended-usage-rights value.
The Creator queue retains the request tracking ID and displays the title, client,
budget, rights, scope, and Accept Proposal / Decline Request actions. Existing
first-time-open five-slot defaults, exact closed/full CTA, commission state
transitions, local event previews, and V3 order/buyer status propagation remain.

### V4 verification

- Extracted inline JavaScript from both `src/app.src.html` and the built
  `index.html`; `node --check` passed for the generated script.
- `node tests/regression_v4.cjs` passed baseline V3 modal handoff, commission
  governor/CTA, proposal state, order state propagation, and exact WIP/Recents
  overlay assertions; V4 rights persistence/queue rendering; Folio image/cover
  and feed normalization; vertical lightbox rendering; secondary-slide removal;
  local for-sale publication; and the exact collection-event title/body/local
  status.
- A static HTML pass found 254 unique IDs, no duplicate IDs, no unresolved
  ARIA ID references, and no unresolved `label[for]` targets.
- `python3 src/build.py` generated the self-contained `index.html` with 28
  embedded images. The running HTTP preview returned status 200 and included
  the Folio and usage-rights controls.
- A real-browser visual walkthrough and screen-reader testing were not available.
  The harness uses mocked browser APIs; it does not certify real image decoding,
  touch/drag behavior, focus presentation, or assistive-technology conformance.
- All behavior remains a local prototype. No server authentication, remote
  storage, verified mediums, payment processing, follower delivery, backend
  transactions, signatures, or physical fulfillment are claimed.


## V6 branding, availability, and seamless Folio presentation — 15 October 2026

### Welcome handoff

The visitor splash remains the first screen and still requires a name plus a
valid email before Browse can open. After the gate, randomized embedded/local
tiles start from center and scatter into a responsive collage. The reveal is a
compact Cordillera Void composition: a medium-size “Welcome to” heading, a
restrained Amber ART NEXUS wordmark, the visitor name in the default app font, a
short Amber rule, and “art meet.” The name preserves its entered casing, caps at
42px, and uses balanced line wrapping. The artwork softens/fades as Browse comes
through; the four-second handoff, no-500×-logo-zoom rule, reduced-motion skip,
gate, and privacy behavior remain unchanged.

The existing splash's slow blurred-art rotation, reduced-motion behavior, footer
text/diamond, featured sheen, and Sign Up hint remain intact.

### Ambient and commission status systems

Sharp high-opacity ripple strokes were removed from the landing ripple effect.
The pointer-triggered interaction now uses low-opacity Amber/white radial glow
fields with high-radius blur, lower event frequency, and a smaller active cap.

A public `● OPEN FOR COMMISSION` pill is rendered on the local Creator's profile
header and artist-directory/search rows only while that Creator is explicitly
open and has at least one slot. Other artists receive no fabricated availability
status; explicit open flags are supported only where supplied. The existing exact
closed/full button copy remains, but the public Creator CTA is no longer
`disabled` and stays keyboard/pointer activatable. Clicking while intake is
closed/full yields the existing local status toast. Queue acceptance limits
remain enforced separately.

### Folio card anchor, ordering, and continuous viewer

The one-card Browse representation now places the exact visible label `FOLIO
STACK` beside its stack icon in a translucent Cordillera Void badge, preserving
the locked palette. Secondary slides can be reordered with accessible up/down
controls; the first selected image remains fixed as cover. The lightbox keeps its
full-screen modal/focus route but uses a max-width, seamless, borderless vertical
image stream: local Folio images are stacked flush with zero inter-slide margin,
padding, or border. It adds a dynamic `FOLIO STACK ACTIVE` footer populated from
the actual Creator work, a Save Collection action tied to the current bookmark
manager, and a click-accessible commission action for a local Creator Folio.
The existing sale-details/demo checkout bar remains. Remote Unsplash URLs and
sample artist/title strings from the illustrative markup were not used.

### Artist-profile Explore More and recommendations

The redundant “See [pronoun] Full Gallery” button is removed from the profile
footer; the Portfolio tab and the open artist profile already provide that path.
The centered Explore More control now smoothly scrolls the profile scroller to the
recommendation panel, which enters upward with a 680 ms ease-in motion. Similar
artwork cards are presented first, followed by profile-derived style/material
chips. A visible Back to Browse button closes the profile and restores focus to its
opener, so the recommendation transition does not strand the visitor. The cards
use only current local feed/Creator data and existing artwork/Folio detail routes.
If no exact style match is available, the panel says so and offers other local
feed work rather than implying a match.

### Compact infinite-scroll switch

The full-width Feed mode strip has been removed. The descriptive Infinite scroll
switch now sits beside Filters in the Browse tools row. Its visible label and
switch role/checked state, title, and live description identify the behavior;
turning it on retains the existing page-size and infinite loader logic.

### V6 verification

- Source and built inline scripts pass `node --check`.
- `node tests/regression_v4.cjs` and `node tests/regression_v6.cjs` pass the
  retained commission/order/WIP/Recents cases and targeted Folio, ordering,
  footer, badge, gate, and event-payload checks.
- Static HTML validation found no duplicate IDs or unresolved ARIA/label
  references. The V6 harness verifies the staggered 4-second art-collage journey,
  1,550/2,650/3,300/4,000 ms phases, reduced-motion skip, no oversized brand zoom,
  compact app-font welcome and balanced name sizing, recommendation rendering,
  Explore More's ease-in scroll/reduced-motion path
  and Back to Browse exit, focus restoration,
  compact feed switch, Folio labels, diffused ripples, and availability badges.
- `python3 src/build.py` embedded 28 images, and the live preview returned HTTP
  200 with V6 controls.
- No real-browser visual, performance, screen-reader, or device-level drag/image
  QA was available. The test DOM and image processing are mocked. No server auth,
  remote image upload, follower push, or payment is claimed.

## V7 local-account/session addendum — 15 October 2026

### Local profile isolation and restoration

Local preview Sign Out now snapshots every app `artNexus*` state key except the
shared local-profile registry/session metadata and per-profile snapshots. The
snapshot is keyed by normalized email and includes Creator session/portfolio/WIP
records, artwork activity, follows, cart, demo orders, and related local state.
The app then clears those keys and the in-memory Creator, follow, likes/bookmarks,
cart, and operational state. Sign In restores the matching snapshot and reloads
the profile; switching between local profiles saves the prior account and avoids
cross-account state leakage. The profile record remains stored, and this is still
email-only local preview access—not secure authentication or cloud persistence.
Local preview Creator sessions also skip the optional Creator registry adapter; it
remains separate and only applies to the pre-existing guest Creator flow when
explicitly configured.

### Creator Studio signup path

After Creator profile save, the app opens `#creatorStudioDashboard` directly.
My Profile also has a persistent **Open Creator Studio Dashboard** action beside
**Edit Creator Profile**. No separate detour through the public Creator profile
is required.

### V7 verification

- `node tests/regression_v7.cjs` passed account snapshot restoration for
  profile/portfolio/WIP, likes/bookmarks, follows, cart and orders, two-profile
  isolation, and the direct Creator Studio signup handoff. V9 extends it to
  dropdown access and non-destructive sign-out.
- `node tests/regression_v4.cjs` and `node tests/regression_v6.cjs` continue to
  pass, preserving Folio, commerce, welcome, recommendations, and Creator Core.
- The final rebuilt HTTP preview and archive check are recorded in the checkpoint.

## V8 Request Commission panel fix — 15 October 2026

The request form was a descendant of `#screenArtistProfile`. The modal manager
correctly inerted the parent profile when activating the request dialog, but that
also inerted the nested form, making it appear frozen. `#commissionRequestOverlay`
is now a sibling modal at the app viewport level. The parent profile remains
inert behind the dialog while the request fields and submit/cancel controls stay
interactive; closing/submitting restores the profile modal and focus.

- `node tests/regression_v6.cjs` checks the sibling DOM structure, live dialog
  activation, focus on the client field, inert parent behavior, dialog close,
  request persistence, and the existing local intake queue.
- V3/V4/V6/V7 regression suites remain passing; no payment or remote submission
  is introduced.

## V9 My Profile dropdown, frozen-edit fix, and non-destructive Sign Out — 15 October 2026

My Profile no longer opens the previous full-screen profile panel. Its header
avatar now opens a keyboard-operable dropdown. A signed-out visitor sees only
Sign Up and Sign In. The Creator Studio Dashboard entry is rendered only when a
local Creator account is active; an active Creator also sees Edit Creator Profile
and Sign Out, while an active non-Creator may start optional Creator Setup.
Sign-up/sign-in forms remain local-preview only, with email-only lookup and no
password or secure authentication.

The Edit Creator Profile freeze was caused by opening the onboarding editor
while the higher-z-index `#profileAccessOverlay` remained visible and active. The
edit flow now closes that parent before activating `#onboardingOverlay`, clears
stale modal-stack state, and restores focus to the My Profile trigger when
possible. The same path remains usable from the Creator hub.

Sign Out now snapshots the account, clears the active-session pointer, and calls
`window.location.reload()`. It preserves the local account record and Creator
snapshot. On the next startup, the public Creator identity, portfolio, and WIP
projects are hydrated from the saved snapshot into a signed-out preview; likes,
bookmarks, follows, cart, orders, and other account activity remain isolated and
are restored only when that profile signs in again. No Creator profile data is
deleted, and no secure/server authentication or cloud persistence is implied.

- `node tests/regression_v7.cjs` verifies signed-out Sign Up/Sign In-only menu
  contents, active Creator Dashboard/Edit/Sign Out contents, preservation of
  Creator identity and portfolio after Sign Out, local account restoration and
  cross-account isolation, plus the formerly frozen Edit Creator Profile modal
  stack.
- `node tests/regression_v4.cjs`, `node tests/regression_v6.cjs`, and
  `node tests/regression_v7.cjs` pass. The V6 commission-dialog sibling fix and
  request queue remain unchanged.
- Build output is v0.40 with 28 embedded images (3,795 KB payload; 4,465 KB
  single-file output); extracted JavaScript passes `node --check`. The rebuilt
  HTTP preview returned 200 and contains both the profile dropdown and the
  independent commission dialog. ZIP integrity check passed for
  `/home/user/art-nexus.zip`.
