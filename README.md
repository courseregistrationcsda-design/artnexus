# ART NEXUS — art meet

Art Nexus is a self-contained, offline-capable front end with a prepared
serverless production integration. Open `index.html` for the built app; edit
`src/app.src.html` and rebuild to make UI changes. The embedded/local-preview
experience remains usable without provider configuration.

## Production status — not activated

The repository includes Vercel API routes and Supabase/PayMongo/Google Drive
integration code, but they are **not live services in this workspace**. The
Supabase migrations are unapplied, provider secrets are not configured, no
Vercel deployment or staging end-to-end test has run, and production readiness
has not been established. Existing PayMongo/checkout code is legacy scaffolding;
the current target is external peer-to-peer exchange with no central Art Nexus
payments. Do not deploy or activate the legacy checkout path. The deployment
runbook below is retained as historical setup reference, not current release
authorization. Do not apply migrations, synchronize endpoints, change providers
or storage, or deploy until a live schema/data/object inventory is reviewed and
separate approval is given. See the archived [live-inventory request](archive/project-notes/LIVE_INVENTORY_REQUEST_2026-10-20.md),
[code-only data inventory](archive/project-notes/DATA_INVENTORY_2026-10-20.md),
and [checkout-removal manifest draft](archive/project-notes/CHECKOUT_REMOVAL_MANIFEST_DRAFT_2026-10-20.md).

Historical local implementation snapshots are preserved in
[`archive/project-notes/PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md`](archive/project-notes/PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md)
and the [`production-readiness gap review`](archive/project-notes/PRODUCTION_READINESS_GAP_REVIEW_2026-10-16.md); they are not live-provider verification.

The visitor splash asks only for a name. That name personalizes the current tab;
email is collected only if the visitor later chooses a sign-up/account flow.
Local-preview accounts remain device-local and are not secure authentication.
Commission requests, demo orders, and creator-event previews are local-only;
they are not delivered to artists. Collaborate stays unavailable until an
artist-approved contact is supplied and verified.

## Current Creator community-edition UI (local, not deployed)

- Commission request/details and Studio commission controls, the Creator Studio
  WIP tab, the separate Artist Links transaction/support drawer/editor, and
  optional Master storage-pointer form are hidden with reversible UI flags and
  markers. Their implementation and stored values remain in place.
- Creator social links use platform dropdowns and one HTTPS URL field per row.
  Saved links show immediately on that local Creator profile without a separate
  moderation gate; external destinations open only after a click. No production
  schema or endpoint sync was added. Cross-account public profiles/directory
  remain gated on live inventory review and separate approval.
- New artwork, Folio, and video publish actions are public-only. Existing private
  drafts are preserved; editing details does not publish or change their
  visibility.
- YouTube/Vimeo video releases show provider thumbnails when available. Vimeo
  oEmbed may be contacted when adding/updating a video; thumbnail display may
  contact the provider. The in-app player iframe is created only after a visitor
  clicks Play and removed on close. Video data stays local; no production catalog
  synchronization or deployment was performed.

When deployed with correctly configured environment variables, the frontend
uses same-origin API routes. The API reports configuration presence, not live
provider connectivity. If the production API is absent or unconfigured, the app
keeps its embedded/local-preview behavior. Artwork-appreciation aggregation is
still optional via `window.ART_NEXUS_ARTWORK_SOCIAL_ENDPOINT`; without a service,
likes/bookmarks are device-local and do not represent cross-user totals.

## Package layout

```
art-nexus/
├── index.html        ← built single-file app
├── src/app.src.html  ← editable app source
├── src/build.py      ← optimize/in-line local artwork and emit index.html
├── api/              ← same-origin Vercel API routes
├── server/_lib/      ← shared auth, provider, validation, and rate-limit helpers
├── supabase/migrations/ ← ordered schema/RLS/storage/RPC migrations (not applied)
├── assets/           ← source artwork, logos, and artist portraits
├── tests/            ← Node API tests and V3/V4/V6/V7/V8 UI regressions
├── requirements-build.txt ← pinned Python build dependency
├── .github/workflows/verify.yml ← tests/build/syntax CI (no deployment step)
├── .vercelignore    ← excludes archived notes from Vercel upload
├── archive/project-notes/ ← preserved review/history docs, not runtime inputs
└── STAGING_DEPLOYMENT_RUNBOOK.md ← legacy setup notes; not release authorization
```

The project history and review artifacts remain under `archive/project-notes/`;
they are preserved, not deleted, and configured for exclusion from future Vercel
uploads via `.vercelignore` (no deployment packaging was run to verify it).
`src/build.py` reads only `src/app.src.html`, its two local JavaScript modules,
and referenced files in `assets/`; tests and migration history remain in their
original paths.

## Local validation and rebuild

```sh
python3 -m pip install -r requirements-build.txt
npm test
npm run build
```

The build uses Pillow to optimize and inline the referenced images. A GitHub
Actions workflow is prepared to run the same tests, rebuild the app, check that
committed `index.html` matches the source, and syntax-check JavaScript/JSON once
the project is hosted on GitHub. It validates code only; it does not deploy or
require provider secrets, and it has not run on a remote CI service yet.

Missing images render as monogram placeholders until the asset file exists in
`assets/` — the build prints any pending names.

## Unified color system (v0.27)

The interface now uses a deliberately restrained, three-color foundation:
Cordillera Void `#1A172D`, Nexus Amber `#EE9E49`, and pure white `#FFFFFF`.
Those are the only opaque color literals in the design namespace. Pale rose,
purple, and crimson UI colors have been removed. “Silver” text, quiet card
surfaces, and fine borders are derived from token-based white transparency
rather than separate gray colors.

The entire app canvas remains Cordillera Void. Raised and inset cards use
subtle white-alpha charcoal layers; primary text and icons are white, secondary
typography is silver (72% white), muted offsets use 56% white, and Amber is
reserved for high-priority actions, active paths, and marketplace status tags.
Amber-filled controls and tags use Cordillera Void text. Standard forms use a
charcoal inset background with white placeholders at 0.7 opacity; onboarding
cards and fields are opaque pearl white with fixed, high-contrast Void copy.

The runtime guardrail tracks Void, inset, raised, Amber, and pearl-white surfaces, composites
translucent silver against the mapped surface, checks WCAG contrast and an
APCA-style Lc heuristic, and applies the foreground/focus roles. It observes
runtime-added content and evaluates focus indicators against their containing
surface. The APCA calculation is a heuristic, not a certification; historical
representative contrast checks are preserved in
`archive/project-notes/AUDIT_REPORT.md`.

## Production API boundaries

The repository contains Vercel-style same-origin routes. Their presence is not
evidence that a provider is configured or reachable; each path still requires
its environment variables, applied schema, and staging validation.

- **Configuration and identity:** `/api/config`, `/api/health`,
  `/api/auth/start`, `/api/auth/callback`, `/api/auth/session`,
  `/api/auth/logout`, `/api/auth/update-email`, and `/api/account/state`.
  Auth is email-link based and the saved account snapshot is server-owned when
  configured. Local-preview Sign Up/Sign In remains separate and is not secure
  authentication.
- **Creator profile, media, and catalog:** `/api/creator/profile`,
  `/api/creator/works`, `/api/creator/assets`, `/api/creator/drive/*`, and
  `/api/catalog`. Production catalog visibility and sale eligibility require a
  published Creator profile/work. Drive masters remain private; public media is
  restricted to the approved image/cache paths. Drive/OAuth functionality has
  not been exercised against a configured project.
- **Collaboration contacts:** `/api/artists/contact` fails closed unless a real,
  artist-approved and verified email is supplied. No contacts are fabricated or
  seeded in this workspace.
- **Checkout and fulfillment:** `/api/checkout`, `/api/order-status`,
  `/api/paymongo-webhook`, `/api/orders/download-ticket`, `/api/orders/download`,
  and `/api/cron/expire-orders` implement server-side flow scaffolding. PayMongo
  accepts test-mode keys only; no payment, order, download, refund, or shipping
  flow has been verified with a live provider. Commission requests and demo
  event previews remain local-only and are not delivered to artists.
- **Legacy adapters:** `/api/feed`, `/api/profile`, and `/api/social/follow` are
  not included as server routes. The legacy client adapter is disabled unless a
  developer explicitly sets `window.ART_NEXUS_LEGACY_PLATFORM_SYNC = true`
  before app startup. The production catalog uses `/api/catalog` and account
  snapshots use `/api/account/state` instead.
- **Optional artwork appreciation adapter:** if a deployment sets
  `window.ART_NEXUS_ARTWORK_SOCIAL_ENDPOINT` before app startup, it may provide
  aggregate counts and accept appreciate/bookmark actions. The service must
  authenticate users and enforce authorization, CSRF protection, validation,
  and durable storage. Without it, likes/bookmarks are local and counts are not
  cross-user totals.
- **Optional guest Creator registry:** the legacy guest-only
  `window.ART_NEXUS_CREATOR_REGISTRY_ENDPOINT` adapter is separate from account
  authentication. It is not a substitute for the authenticated Creator profile
  route and must implement its own authorization and validation.

Absent or unconfigured production routes leave the embedded/local-preview app
available. For exact configuration steps and release checks, use
`STAGING_DEPLOYMENT_RUNBOOK.md`; never place secrets in source or chat.

## Current app features

- **Name-only visitor splash** — asks for a name, not an email. The name stays in
  tab `sessionStorage` for a personalized Browse greeting and in-app appreciation/
  bookmark feedback. It is prefilled—but not automatically submitted—to account
  sign-up if the visitor chooses to create an account. Email is collected in the
  sign-up/auth flow, not at the splash.
- **Personalized welcome collage** — after the name gate, embedded/local artwork
  tiles move outward into a responsive collage, then reveal a refined Cordillera
  Void composition: “Welcome to,” a restrained Amber ART NEXUS wordmark, the
  visitor name, a short Amber rule, and “art meet.” All text uses the default app
  font. The name is capped at 42px and fits to balanced line widths, preserving
  entered casing. Tiles fade as Browse appears; the handoff takes 4 seconds. There
  is no oversized logo zoom; reduced-motion preference skips the transition. The
  splash keeps its four-second embedded-art crossfade, slow drift, softened blur,
  glass tint, and diffused ripples.
- **My Profile dropdown** — signed-out visitors see Sign Up and Sign In. An
  active Creator sees Creator Studio Dashboard, Edit Creator Profile, and Sign
  Out; a signed-in non-Creator can start Creator Setup but does not see Creator
  tools. In unconfigured local preview, signup/sign-in is device-local and is
  not identity verification. When hosted auth is configured, the separate
  Supabase email-link flow and account routes are used; neither path has been
  tested against a live provider. Sign-out retains the Creator profile data.
- **Onboarding** (Batch 2) — retains Creator / Collector setup through existing
  in-app controls; onboarding cards and fields remain solid pearl white with dark
  high-contrast copy, accessible preference controls, and the CSDA+ mark
- **Creator Studio and profile data** — personal account name and public studio
  name are separate editable values. Creator signup opens the dashboard; profile
  editing closes higher modal layers before opening Creator Setup. New local
  artwork, Folio, and video releases publish publicly; private drafts from before
  this behavior stay private and are not changed by editing details. The Creator
  Studio WIP tab, commission controls, Artist Links editor, and optional Master
  pointer form are currently UI-hidden without deleting source or data. Local
  preview edits remain on-device; configured production Creator profile and work
  routes require the unapplied schema, environment secrets, and staging
  validation before use.
- **Creator WIP streams** — project and milestone data remains device-local,
  but the Creator Studio WIP tab is hidden in the current community edition.
  Public WIPs/Recents selectors retain the migration overlay where public
  modules are not implemented; no stored WIP data is removed.
- **Creator data boundaries** — local session, works, WIP projects, follows,
  likes/bookmarks, and demo commerce remain local in preview. Configured Creator
  profiles/works and private account snapshots use authenticated API routes.
  Production behavior must not be inferred from localStorage or mocked tests.
- **Browse feed** (Batch 3) — featured artist reshuffles without an immediate
  repeat and appears only at the start of the feed; exactly 15 artworks per
  numbered page by default with Previous/Next navigation; an accessible feed-mode
  switch optionally replaces pagination with cumulative infinite scrolling in
  15-artwork batches; two-lane narrow-screen masonry and a responsive desktop
  grid; search and artist/style/material/availability filters; heart counts are
  visibly marked “local” until a server aggregate is received (“total”); bookmarks
  persist as this-device artwork history; listing state carries through
  to detail and checkout
- **Desktop browsing** — the app shell fills the available browser viewport;
  browse, artist, gallery, and movement content expand with fluid side gutters,
  and the natural-order feed scales from three to six columns as the frame grows
- **Data boundaries** — production Creator catalog reads use `/api/catalog`;
  account snapshots use authenticated `/api/account/state`. The older `/api/feed`,
  `/api/profile`, and `/api/social/follow` adapters are gated off by default because
  those routes are not bundled. Likes/bookmarks can use a separately configured
  aggregate adapter; otherwise activity remains local.
- **Browse Artist** — searchable directory that preserves the six seeded artists
  and their portfolios; a local-preview creator gets a separate profile row
- **Artist Profile Hub** (Batch 4A) — dark profile, verified badge for seeded
  artists, device-local profile behavior, and semantic Portfolio/WIPs/Recents
  selectors. Local Creator profiles support artist-entered public social links
  with HTTPS validation and no moderation gate; cross-account/social catalog
  publication remains gated pending live inventory review. Commission and
  Artist Links transaction controls are hidden. Public WIPs/Recents panels show
  the migration overlay while retaining local content. Creator self-edit remains
  available through Edit Profile and Creator Studio.
- **Artist galleries** — cart-free header with the official logo retained;
  artwork tiles have separate accessible open/Buy actions
- **Artwork Detail** (Batch 4B) — full artwork over a background clone at 200%
  scale, 70% opacity, and 28px blur; persistent heart/bookmark actions sit just
  above the details sheet, not in the upper-right header. The former “Touch Canvas
  Active” badge is removed. Double-click, wheel, pinch, and keyboard zoom remain;
  immersive zoom hides detail chrome; Add to Cart stays availability-aware.
- **Cart Drawer** (Batch 5) — item types, removal, subtotal, duplicate 1-of-1
  protection, and checkout-time availability recheck
- **Checkout boundary** — the unconfigured/local-preview flow is a demo and
  does not charge, reserve shared stock, or deliver goods. The repository also
  contains an authenticated server checkout, PayMongo Hosted Checkout, webhook,
  order-status, and private-download path for eligible published listings; it
  is sandbox-only in configuration and has not been tested with real credentials.
  No live payment, seller payout, carrier, refund, or fulfillment service is
  active.
- **The Movement** — CSDA / Artrovert story page
- **Responsive adaptation** — compact phones, short/landscape layouts, safe-area
  insets, and expanded tablet/desktop widths while retaining the two-lane feed
- **Premium charcoal/Amber finish** — Void canvas, token-derived silver surfaces
  and borders, Amber marketplace tags/actions, transparent Amber graffiti logo,
  and a dynamic WCAG/APCA-style surface guardrail
- **Accessibility remediation** — labelled fields and validation states, modal
  focus containment/restoration, Escape dismissal, live status messages, visible
  keyboard focus, restored browser zoom, and selectable page text
- **Logo navigation reset** — app-level ART NEXUS logos remain keyboard-operable
  actions that return to the first feed page, choose a fresh featured artist, and
  reset browse-only filters while preserving cart, account, and order data. On the
  visitor splash, the logo focuses the required name field and cannot bypass the gate.
- **Sign-up access** — the header now uses a My Profile avatar instead of a Sign
  Up button. The local-preview Sign Up CTA retains a restrained 15-second
  glow/grow hint (disabled for reduced-motion preferences); the featured-artist
  card receives a subtle sheen every 10 seconds
- **Prototype destinations** — Network and My Gallery stay in source for future
  development but are hidden from the navigation submenu; a non-interactive
  drawer note mentions both plus marketplace functions. Artwork hearts and
  bookmarks remain device-local; follows and follower counts are suppressed.

See the archived [production implementation snapshot](archive/project-notes/PRODUCTION_UPGRADE_IMPLEMENTATION_REPORT_2026-10-16.md)
for historical local verification. The archived audit reports are pre-production
snapshots, not current provider or deployment verification.


## Historical local-preview feature notes

The dated V3/V4/V6 sections below describe earlier feature releases. When they
conflict with the current production status/API boundaries or the current app
features above, those sections are historical; use the current sections above
and the implementation report for present behavior.

### V3 operational preview features (15 October 2026)

- **My Profile → Creator Setup:** the handoff now closes the higher-layer My
  Profile dialog before opening onboarding, so Creator Setup is visible and does
  not become trapped behind the account overlay.
- **Public WIPs/Recents migration state:** the existing tab selectors and stored
  WIP/milestone/Recents data remain. Public WIPs and Recents panels show the
  exact panel-local message `🛠️ Under Construction • This studio workspace
  module is migrating to our secure backend pipeline.` Content remains in local
  storage/DOM and is not deleted or exposed through those public panels.
- **Commission governor and intake:** first-time Creator profiles start with
  intake open and five slots so the public CTA works immediately; Creator Studio
  provides a local open/closed control and a 0–5 slot count above artwork
  publishing. The public Creator
  profile displays the commission action only for the local Creator profile;
  closed/full intake shows exactly `🔒 Commissions Full (5/5 Slots Taken)`. A
  request form adds local `Pending_Acceptance` proposals to the queue. Accepting
  a commission decrements a slot and changes its local state to `In_Production`;
  rejection changes it to `Rejected`. These are local prototype records, not
  contracts, notifications, payments, or server transactions.
- **Event/order previews:** a for-sale Creator artwork upload adds a local event
  payload titled **🔥 New Collection Update!** with the specified 1-of-1 body in
  Creator Studio's preview log. It is recorded locally only; no follower registry
  or push service exists. Demo checkout saves a buyer-side local order at
  `Pending_Acceptance`. Every demo order also enters the device-local review
  queue and alert count, available from Creator Studio when a Creator profile is
  set up; accept/reject actions change the queue and buyer-side order to
  `In_Production`/`Rejected`. This is local admin simulation only—no funds, real
  holds, emails, or fulfillment are created.
- **Print/COA boundary:** print editions remain finite and locked/grey when sold
  out, with no restock/reprint route. The no-reproduction commitment stays visible.
  Original COA/fulfillment content is a preview only; no wet signature, payment,
  or physical mailing is provided.

The V4 regression suite is retained at `tests/regression_v4.cjs`; its historical
checkpoint and audit are archived at `archive/project-notes/CHECKPOINT_REPORT.md`
and `archive/project-notes/AUDIT_REPORT.md`. A real-browser visual and
assistive-technology pass remains outstanding.


### V4 Folio Stack integration (15 October 2026)

- **Creator Studio format toggle:** choose Single Release or Folio Stack before
  the shared upload form. Folio mode accepts multiple local image files, resizes
  them in-browser, assigns the first image as the cover, and shows a horizontal
  thumbnail track. Up to eight images may be selected; secondary slides can be
  removed, and more images can be added through the dotted upload/drop slot.
  Local-preview selection/storage remain on-device. The separately gated
  production Creator media flow is authenticated and uses private Drive masters
  with controlled preview/cache paths; it has not been exercised against a live
  provider.
- **Browse and portfolio:** each Folio Stack is one masonry poster card using
  its cover image, with a translucent Cordillera Void stacked-card icon at the
  upper-right. Opening a Folio card shows a full-screen vertical image-strip
  lightbox instead of the flat detail view. The Creator's Portfolio uses the
  same Folio route; sale details continue into the existing artwork-detail and
  demo checkout path.
- **Commission usage-rights intake:** the local proposal form requires an
  intended-usage-rights field. The unified Creator queue shows the request
  tracking ID, title, client, budget, rights, and Accept Proposal / Decline
  Request actions. Slot governor defaults, closed/full CTA, and status routing
  remain as in V3.
- **For-sale Folio event preview:** the local event is titled
  **🔥 New Collection Update!** and its body is `[Studio Name] just launched a
  new Folio Stack into the browse feed!` It is visible only in the device-local
  preview log; no follower delivery or push is claimed.
- **Compatibility:** Folio metadata is additive to local Creator work records;
  non-sale artifacts stay view-only, print stock remains finite and locked after
  sellout. The local-preview commerce flow remains a demo; production catalog and
  checkout are separate gated server paths.

Run the no-dependency regression harness with:

```sh
node tests/regression_v4.cjs
```

The source-function test suite covers the V3 commission/order/public-overlay
cases plus V4 Folio normalization, local image selection state, cover/slide
routing, vertical gallery rendering, secondary-slide removal, proposal-rights
persistence/queue display, and the exact for-sale Folio event payload. It mocks
browser APIs and is not a substitute for real-browser visual or assistive-
technology QA.


### V6 branding, Folio anchors, and discovery updates (15 October 2026)

- **Welcome animation restoration:** after the required visitor-name gate,
  artwork tiles scatter into a responsive collage, then reveal a compact Cordillera
  Void brand composition. The Amber wordmark is smaller; “Welcome to,” the
  visitor name, divider, and “art meet” use the default app font. The name is
  capped at 42px, keeps its entered casing, and wraps on balanced lines. Browse
  appears over the 4-second handoff. There is no 500× logo zoom; reduced-motion
  users skip the animation. The gate, splash backdrop, exact footer, featured
  sheen, and Sign Up hint remain.
- **Ambient ripples:** the sharp outline rings are replaced by low-opacity,
  high-radius blurred glow fields. Pointer events remain, but the effect is
  throttled and capped to keep it subtle.
- **Artist-profile discovery:** removed the redundant “See Full Gallery” footer
  button. Explore More returns to Browse with an animated recommendation panel
  sliding up/fading out; the four previewed artworks are prioritized at the top
  of Browse, and filters are reapplied after ordering. A Back to Browse control
  remains available for direct exit. Cards retain the existing detail/Folio
  routes; no sample art or artist metadata is invented.
- **Compact feed mode:** moved the Infinite scroll switch inline beside Filters
  instead of using the full-width mode bar. Its visible label, switch semantics,
  descriptive title, and live state text explain that it loads more artworks as
  the visitor scrolls.
- **Availability status:** an Amber-on-dark `● OPEN FOR COMMISSION` pill appears
  in the public Creator profile header and artist directory row only when the
  current operational state is explicitly open and has slots. Closed/full profile
  CTAs retain the exact `🔒 Commissions Full (5/5 Slots Taken)` copy but remain
  click-accessible and return a local status message instead of behaving as a
  disabled lockout. Search rows remain clickable.
- **Folio anchors and detail:** Browse cards now show the exact white uppercase
  `FOLIO STACK` label beside the stack icon. The dashboard adds ↑/↓ ordering for
  secondary slides while keeping the first image fixed as the cover. The lightbox
  presents actual locally stored images in a flush, borderless vertical stream,
  then a dynamic footer card with `FOLIO STACK ACTIVE`, the real title/creator and
  optional description. Save Collection reuses the existing local bookmark
  history; the commission action routes into the existing local request flow.
  No remote Unsplash assets or sample artist/title data were added.

Run the no-dependency V6 regression suite with:

```sh
node tests/regression_v6.cjs
```

It exercises the V3/V4 cases plus the 4-second collage gate-to-Browse handoff and
compact app-font welcome layout, 42px balanced name cap, absence of the oversized
brand zoom, reduced-motion skip, recommendation rendering, Explore More's
ease-in scroll and Back to Browse exit, compact descriptive feed switch, clickable
closed state and conditional open badges, Folio ordering/cover protection, explicit
card label, flush gallery sequence,
footer/save actions, and exact local event payload. Browser APIs are mocked;
this is not a substitute for visual, real-image, or assistive-technology QA.
