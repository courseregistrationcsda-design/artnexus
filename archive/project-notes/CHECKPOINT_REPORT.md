# ART NEXUS — Product Update Checkpoint

**Checkpoint:** v0.40  
**Checkpoint date:** 15 October 2026  
**Baseline:** v0.30 Creator Core Engine  
**Status:** V9 changes My Profile to an accessible dropdown, fixes the frozen Edit Creator Profile flow, and makes Sign Out refresh without deleting the saved Creator profile. V8's Request Commission modal fix and V7 account snapshots remain; V6 welcome/discovery, commission availability, Folio, and V3/V4 commerce/event previews are preserved. V3+V4+V6+V7 regression suites pass. Real-browser visual/assistive-technology QA remains outstanding.

## What changed

### Animated visitor splash and Browse welcome

The former standalone three-second logo splash and Login/Register entry screen remain removed. The existing blurred-artwork screen is the initial splash and stays active until the visitor enters a name and valid email, then activates **Hello, stranger!** (Enter also submits). The visitor email is validated in-page only; neither name nor email is sent or persisted, and this does not create an account or authentication session. After the mandatory gate, V6 reveals a refined Cordillera Void welcome: medium-size “Welcome to,” a restrained Amber ART NEXUS wordmark, the visitor name in the default app font, a short Amber rule, and “art meet.” The name preserves its entered casing, caps at 42px, and wraps on balanced lines. Tiles scatter from center and fade as Browse comes through; the handoff ends at four seconds. There is no 500× brand zoom. Reduced-motion preference skips the journey and reveals Browse immediately. The 6px blurred artwork, 150% slow drift, four-second splash-art rotation, and softened pointer/touch ambient glow remain. The splash logo focuses the name field and cannot bypass the required gate; in-app logos retain their established Browse reset behavior.

### My Profile dropdown and account-state restoration

The header avatar opens only an accessible dropdown, not a full-screen My Profile
panel. While signed out it offers **Sign Up** and **Sign In** only. A currently
logged-in Creator sees **Creator Studio Dashboard**, **Edit Creator Profile**,
and **Sign Out**; a logged-in non-Creator can start Creator Setup but cannot see
the dashboard entry. The auth forms remain local-preview only and store name/email
in `artNexusLocalPreviewProfiles`; email-only Sign In restores the account's
Creator profile/portfolio/WIP, likes/bookmarks, followed artists, cart, and local
demo orders from its `artNexusLocalProfileState:` snapshot.

Sign Out saves the active snapshot, clears the active session, and refreshes the
app. It does not delete Creator profile data: the Creator identity, portfolio,
and WIP projects remain browsable in a signed-out preview, while private
account activity stays isolated in the snapshot until that profile signs in
again. Edit Creator Profile now closes the higher-layer My Profile dialog before
opening Creator Setup, preventing the form from being inert/hidden behind its
parent. No password, identity verification, secure authentication, or
cross-device account is provided. The mandatory visitor gate remains separate;
activate real auth and server-side account handling before deployment.

### Creator Studio signup path

After a Creator saves a new or updated Creator profile, the app opens the Creator
Studio Dashboard directly instead of taking a redundant detour through the
public artist profile. The signed-in Creator's My Profile dropdown provides
**Creator Studio Dashboard** and **Edit Creator Profile** for later visits; the
dashboard item is absent while signed out. The dashboard
and its portfolio/WIP data remain local-preview only.

Both the My Profile flow and Creator/Collector onboarding Sign Up reuse the splash's animated artwork backdrop: four-second crossfades, 150% slow drift, 6px blur, glass tint, and pointer/touch ripples. Pearl-white onboarding/profile cards stay solid and readable; reduced-motion behavior is retained. The same background element is returned to the visitor splash when a Sign Up surface closes.

### Ready-to-fill artist social links

`ARTIST_SOCIAL_LINKS` defines Instagram, Facebook, TikTok, Behance, and Website slots for each of the six seeded artists. The slots are intentionally empty until official URLs are supplied. Only validated HTTPS addresses render as active links; no real artist handles or URLs have been invented.

### Artwork engagement and detail backdrop

Browse cards and artwork detail include heart/appreciation and bookmark actions. Likes/bookmarks, local metadata, counts, and profile history are stored under `artNexusArtworkActivity` in this browser. Without a backend, a count is visibly marked “local” and reflects only this device/user's like (0 or 1), not a real cross-service total. A clean optional adapter uses `window.ART_NEXUS_ARTWORK_SOCIAL_ENDPOINT`: GET `?ids=...` hydrates appreciation counts and POST JSON `{ artwork_id, action }` submits appreciate/unappreciate/bookmark/unbookmark actions. No endpoint is supplied or configured; a production service must provide authentication, authorization, CSRF protection, and durable counts.

Artwork detail keeps the complete foreground art and adds a background clone at 200% scale, 70% opacity, and 28px blur. Both actions are positioned immediately above the solid information sheet, not in the upper-right header. The “Touch Canvas Active” badge has been removed.

### Drawer attribution

Removed the destructive “Reset session · re-run onboarding” drawer control and the old “Art Nexus prototype · v0.31” label. Replaced them with **Art Nexus by Cordillera School of Digital Arts, Inc. 2026.** The separate logo-driven Browse reset remains unchanged.

### Creator identity and session profile

Creator onboarding now persists a UUID-format `artist_id`, `studio_name`, `biography`, and a multi-value `verified_mediums` array in the existing `artNexusUserSession` local-storage record. Older local Creator sessions are migrated in place when canonical fields or a UUID are missing. The internal UI routing key (`creator-self`) remains separate from the persistent `artist_id`.

### Creator Studio Dashboard and artwork listings

Edit Profile opens the modal workspace with the exact ID `#creatorStudioDashboard`. Artwork records include title, description, medium, Boolean `is_for_sale`, `sale_type` (`'1-of-1'`, `'PRINTS'`, or `null`), and `price_value`.

- New works are stored locally and inserted at the top through `mockArtDatabase.unshift(newEntry);`; `populateMasonryFeed()` renders them immediately without a reload.
- The original 50 seeded cards retain their existing relative order.
- For Sale listings use the existing demo detail/cart/checkout logic: `1-of-1` maps to an Original; `PRINTS` maps to Prints. No payment is processed.
- When `is_for_sale` is false, the work is visibly labelled **Unlisted Portfolio Artifact**. It remains public, viewable, and interactive in Browse and the creator Portfolio, but exposes no price or purchase UI.
- Artwork metadata/images remain browser-local in `artNexusCreatorWorks`. Existing upload limits and local quota handling are retained.

### WIP project streams

The dashboard creates and updates local WIP projects with project name, status summary, completion percentage, and timestamped milestone entries containing log text and an optional resized preview image. Project data is stored under `artNexusCreatorWipProjects`. Public WIPs/Recents tab selectors remain, but their panels show the required migration overlay; existing WIP, milestone, and Recents content is retained underneath and not deleted.

“Public” here means visible inside this local prototype's creator profile; the package does not publish projects or artwork to a remote server.

### Cloud-registry integration boundary

An optional adapter can POST the creator session fields (`artist_id`, `studio_name`, `biography`, `verified_mediums`, and `updated_at`) when a deployment configures `window.ART_NEXUS_CREATOR_REGISTRY_ENDPOINT` before the app script loads. No cloud endpoint, registry route, API server, authentication, or server-side sync is included. Local preview accounts are never sent to this adapter; it applies only to the separate guest Creator flow when explicitly configured. Without a configured endpoint and successful response, the app remains local-only; local storage is not represented as cloud persistence.

## Preserved baseline

- Supplied mobile-app shell, graffiti brush logo and official logo placements, six seeded artists/portfolios, featured-artist shuffle, and all 28 embedded assets.
- Original 50 feed records, IDs, generator and relative order; new Creator entries are prepended. Existing two-lane phone feed, desktop natural-order rendering, pagination, optional infinite scrolling, search and filters remain. The desktop shell now fills the browser viewport, with fluid content gutters and a 3–6-column responsive grid.
- Batch 3–5 behavior/hooks, Gallery cart-icon and Collaborate rules, seeded profile tabs/Follow behavior, artwork detail, cart and demo checkout remain intact. Movement-page copy remains unchanged except the requested CTA line, now `Cordillera School of Digital Arts, Inc. 2026`.
- Latest palette: Cordillera Void `#1A172D`, Nexus Amber `#EE9E49`, white `#FFFFFF`, and silver-like offsets derived from token transparency.
- Existing 6px blurred artwork/ripple treatment, in-app logo reset behavior, immersive zoom, and reduced-motion handling; the entry experience is now the required visitor splash and personalized four-second welcome.
- Logo-triggered browse reset still preserves profile/session/cart/order data. No real payments or backend behavior are claimed.

## Verification

- `python3 src/build.py` completed successfully; the single-file app contains **28 embedded images**.
- Inline JavaScript passed `node --check`.
- Visitor-gate/welcome simulation confirmed malformed-email rejection, valid name/email routing to Browse, the personalized welcome, and exactly 20 distinct embedded artwork tiles with no duplicate sources. It checked the full-screen responsive sizing and a single continuous 3,880 ms zoom/fade keyframe, without separate held scatter/whiteout animations. Timing: message at 1,550 ms, whiteout at 2,650 ms, main-screen reveal at 3,300 ms, and Browse activation at 4,000 ms. Reduced-motion mode retained a static collage and reached Browse at the same endpoint.
- My Profile/artwork-social mock-DOM/localStorage/fetch simulation passed local sign-up, email-only sign-in, avatar initials, sign-out, activity history, persistent liked/bookmarked state, accessible pressed-state updates, device-local fallback counts, and configured aggregate GET/appreciation POST responses.
- V7 local-account harness passed Creator profile/portfolio/WIP and private-state restoration, cross-account isolation, and automatic Creator Studio handoff. V9 additionally verifies the dropdown's role-specific options, signed-out Creator preview, non-destructive reload, and the fixed edit-modal stack.
- Sign-up splash-backdrop harness confirmed the landing artwork background moves behind either Sign Up overlay, binds ripple listeners once, returns to the visitor splash on close, and resumes/stops its four-second cycle with the active screen.
- Responsive desktop source check confirmed the uncapped full-viewport shell above 430px, fluid side gutters for primary desktop content, three/four/five/six-column breakpoints at 760/1100/1500/1900px, and the original phone two-lane rules. This is a source-level check; visual browser screenshot QA remains outstanding.
- V9 static HTML checks passed: **270 unique IDs**; all 58 inputs, selects and textareas have an associated, wrapping, or explicit accessible label; all 51 distinct ARIA ID references resolve; no duplicate IDs, broken label targets, or external script/image references; `creatorStudioDashboard` and `profileAccessMenu` are present.
- Creator Core Engine source simulations passed UUID/profile mapping, verified-medium array handling, exact artwork sale metadata, local artwork/WIP persistence and restoration, missing-endpoint local-only behavior, and original 50-card relative-order preservation.
- Mock-DOM/FileReader/canvas workflow simulations exercised actual artwork submission and WIP project/milestone functions. They passed top insertion via `unshift`, immediate `populateMasonryFeed()` invocation, non-sale `false/null/null` matrix and exact Unlisted Portfolio Artifact label, `PRINTS` metadata, and timestamped chronological WIP updates. Separate feed/detail render simulations confirmed view-only Browse cards remain interactive without a price and the detail sheet hides price/cart controls for non-sale work while preserving valid Prints commerce. The browser APIs were mocked; this is not real image-decoding or visual browser QA.
- Refreshed `/home/user/art-nexus.zip`; `unzip -t` reported no errors.
- A visual browser walkthrough and VoiceOver/TalkBack/NVDA testing were not available. Focus management and assistive behavior remain source-level checks, not a conformance certification.

## Deliverables

- `index.html` — rebuilt, self-contained v0.40 prototype with the v0.30 Creator Core Engine retained.
- `src/app.src.html` — editable source.
- `src/build.py` — asset-embedding build script.
- `README.md` — v0.40 local Creator operations, My Profile dropdown, account/session restoration, welcome journey, commission-panel fix, deployment boundaries, and v0.30 Creator Core Engine.
- `AUDIT_REPORT.md` — v0.40 audit/addendum dated 15 October 2026; baseline review date remains 14 October 2026.
- `CHECKPOINT_REPORT.md` — this report.
- `/home/user/art-nexus.zip` — refreshed project archive.


## V3 production-prompt implementation addendum — 15 October 2026

- **My Profile → Creator Setup handoff:** fixed the modal stacking dead-end. The My Profile overlay had a higher z-index than onboarding, so opening Creator Setup left the new overlay behind it. The handoff now closes My Profile with focus restoration preserved, then activates onboarding as the top modal.
- Public WIPs and Recents still have their tab selectors. Tapping either selector
  shows the exact local overlay text: **“🛠️ Under Construction • This studio
  workspace module is migrating to our secure backend pipeline.”** The overlay
  stays panel-local so the profile header and tabs remain usable; it does not
  erase underlying WIP/Recents markup or local milestone records.
- Creator Studio's Artwork panel now starts with a local commission governor,
  0–5 slots, a unified proposal/order queue, alert count, and event preview log.
  First-time Creator profiles start open with five slots; the Creator can close
  intake or adjust the count. The public commission CTA appears only on the local Creator profile;
  closed or full intake displays exactly
  `🔒 Commissions Full (5/5 Slots Taken)`. Commission requests enter
  `Pending_Acceptance`; accept decrements one slot and changes state to
  `In_Production`, while rejection changes it to `Rejected`.
- For-sale Creator uploads create the local **🔥 New Collection Update!** event
  preview. The 1-of-1 body is
  `[Studio Name] just launched a premium 1-of-1 original cultural artifact into the browse feed!`.
  The broker labels the event **Local preview only · not sent**; no external
  follower resolution, push, email, or backend request is claimed.
- Demo checkout records local buyer orders at `Pending_Acceptance` and adds
  every demo order to the device-local review queue/alert count, available from
  Creator Studio after a Creator profile is set up. Accept/reject writes
  `In_Production`/`Rejected` to the queue and matching buyer-side `artNexusOrders`
  entry. The receipt, order copy, and UI state remain simulation-only; no real
  funds or payment hold exist.
- Print stock remains finite and permanently locked on sellout; no reprinting or
  restocking path was added. The no-reproduction commitment remains in creator
  posting and buyer details. Original COA/fulfillment remains a visual preview;
  this app does not wet-sign, charge, or mail a certificate/artwork.

### V3 verification

- `node --check` passed on the extracted inline JavaScript after the V3 wiring.
- A targeted Node/mock-DOM/localStorage harness exercised the My Profile →
  Creator Setup modal handoff, exact closed/open public commission CTA, local
  proposal submission, pending badge count, commission acceptance and one-slot
  decrement, local order queue acceptance/rejection and buyer-status propagation,
  local-only event status, and exact WIPs/Recents overlay copy with underlying
  WIP content retained. This is a source-function
  simulation, not browser QA.
- `python3 src/build.py` generated a self-contained file with 28 embedded images.
- No real authentication, notification, payment, order hold, wet signature,
  email, delivery, or backend service is present. Visual browser, keyboard, and
  assistive-technology QA remain outstanding.


## V4 Folio Stack production-prompt addendum — 15 October 2026

- Creator Studio now offers **Single Release / Folio Stack** before the existing
  upload form. Folio mode handles up to eight images selected locally, uses the
  first as its cover, displays a horizontal thumbnail track, supports secondary
  slide removal and further additions through a dotted upload/drop slot, and
  saves the stack additively in the existing Creator work storage. Each file is
  resized locally; no remote upload is implied.
- Browse renders one cover-image poster card per Folio Stack with a clear
  translucent Cordillera Void stacked-card mark. The card opens a full-screen
  vertical image-strip lightbox; the Creator Profile Portfolio routes Folio work
  into that same gallery. For-sale details flow into the existing art-detail and
  demo checkout behavior.
- The for-sale Folio local event has exact title `🔥 New Collection Update!`
  and exact body `[Studio Name] just launched a new Folio Stack into the browse
  feed!`. It remains a local preview; it is not a follower push.
- Commission proposals require intended usage rights and the intake card shows
  its tracking ID, title, budget, client, rights, and accept/decline actions.
  Existing five-slot first-time default, exact locked CTA, commission resolution,
  checkout `Pending_Acceptance` routing and buyer-side `In_Production` / `Rejected`
  propagation remain intact.
- The V4 regression suite also confirms the exact public WIP/Recents overlay,
  Folio storage normalization, cover/slide feed metadata, gallery slide sequence,
  removal behavior, and the precise local collection-event payload.

### V4 verification record

- `node --check` passed on the source inline JavaScript and the built inline
  JavaScript.
- `node tests/regression_v4.cjs` passed all baseline V3 plus V4 targeted mock-DOM
  and localStorage regression cases.
- Static HTML validation found 254 unique IDs, zero duplicates, and no broken
  ARIA ID or label references.
- `python3 src/build.py` built the single-file app with 28 embedded images;
  `http://127.0.0.1:8000/index.html` returned HTTP 200 and served V4 controls.
- No real browser visual, keyboard/screen-reader, actual image-decoding, remote
  upload, real payment, follower-delivery, backend or authentication test was
  possible or is claimed. These V4 additions remain local prototype features.

## V4 deliverables

- `index.html` — rebuilt v0.34 single-file prototype.
- `src/app.src.html` — active V4 source.
- `src/build.py` — asset-inlining build step.
- `tests/regression_v4.cjs` — no-dependency targeted regression harness.
- `README.md`, `AUDIT_REPORT.md`, and this report — V4 requirements, boundaries,
  verification, and limitations.
- `/home/user/art-nexus.zip` — refreshed project archive.


## V6 animated welcome, Folio anchors, and artist discovery — 15 October 2026

- The required visitor name/valid-email gate remains intact. The collage now
  reveals a compact Cordillera Void composition: medium “Welcome to,” a smaller
  Amber wordmark, visitor name, short Amber rule, and “art meet.” All text uses
  the default app font; the name preserves entered casing, caps at 42px, and
  wraps on balanced lines. Browse appears over four seconds. No oversized
  brand/logo zoom is used; reduced-motion preference skips the journey. Splash
  effects, exact footer, featured sheen, and Sign Up hint remain.
- Artist profiles no longer show the redundant See Full Gallery button.
  Centered Explore More smoothly scrolls the profile to an upward-entering,
  ease-in recommendation panel. Similar artwork cards appear before the style /
  material chips. A visible Back to Browse button closes the profile and restores
  focus to its opener. Existing artwork/Folio routes are unchanged.
- The long Feed mode bar is removed. A visible, labelled Infinite scroll switch
  now sits beside Filters and retains `aria-checked`, descriptive title, and live
  status text while using the existing pagination/infinite-scroll behavior.
- Pointer ripples no longer draw solid outlines. They are diffuse low-opacity
  glow fields with high blur and fewer active elements.
- Open commission state appears as an Amber status pill on the Creator public
  profile header and directory row only when the true local open/positive-slot
  state supports it. The public Creator CTA keeps its exact closed/full label
  but remains enabled and reports its closed state on activation; search rows
  remain click-accessible.
- Browse Folio cards now state `FOLIO STACK` explicitly beside the stack icon.
  Creator Studio has secondary-slide up/down ordering while retaining the cover.
  The vertical lightbox is a flush image stream with a dynamic `FOLIO STACK
  ACTIVE` metadata footer, local Save Collection/bookmark action, and local
  Creator commission action. For-sale details still enter existing demo
  checkout. Sample Unsplash URLs and fake artist/title content were not used.

### V6 verification record

- `node --check` passed on the source inline script and the rebuilt single-file script; `python3 src/build.py` embedded all 28 images.
- `node tests/regression_v4.cjs` and `node tests/regression_v6.cjs` passed. The V6 suite covers preserved V3/V4 checks, the four-second collage welcome and phases, compact app-font welcome and balanced name sizing, reduced-motion skip, no 500× brand zoom, recommendation rendering, Explore More ease-in scroll/reduced-motion handling and Back to Browse focus restoration, compact feed switch states, commission badges/CTA, Folio ordering/cover protection, gallery actions, and local event payload.
- Static HTML validation found 269 unique IDs, no duplicates, and no unresolved ARIA, label, or fragment references. The rebuilt HTTP preview returned 200 and included V6 Folio, welcome, and availability controls.
- Browser visual, accessibility, performance, and physical-device image tests remain outstanding. No real auth, remote storage, follower delivery, or payments exist.

## V6 deliverables

- `index.html` — rebuilt v0.37 single-file app at that checkpoint.
- `src/app.src.html` — active V6 source at that checkpoint.
- `tests/regression_v4.cjs` and `tests/regression_v6.cjs` — retained and expanded no-dependency regression suites.
- Updated `README.md`, `AUDIT_REPORT.md`, and this checkpoint.
- `/home/user/art-nexus.zip` — refreshed V6 archive.

## V7 local-account/session addendum — 15 October 2026

- Creator signup now opens the Creator Studio Dashboard after saving, and My
  Profile retains a direct **Open Creator Studio Dashboard** button.
- Sign-out moves app state into an email-keyed local snapshot, clears the active
  session and user-specific UI/data, and preserves saved account records. Sign-in
  restores Creator profile/portfolio/WIP, likes/bookmarks, follows, cart, local
  orders, and other `artNexus*` state on this device. No password, secure auth,
  server account, or cloud storage was introduced.
- `node tests/regression_v7.cjs` passed local state reset/restore and two-account
  isolation checks; `regression_v4.cjs` and `regression_v6.cjs` also remain green.
- V7 archive: `/home/user/art-nexus.zip` (superseded by the V8 refresh below).

## V8 Request Commission panel fix — 15 October 2026

The Request Commission dialog was nested inside the Artist Profile modal. Opening
it caused the modal manager to mark that parent `inert`, which also made the
nested form inert and unresponsive. The dialog is now a sibling layer at the app
viewport level; the Artist Profile can remain inert behind it while the request
form stays interactive and focusable. Closing or submitting the form returns
focus to the profile modal.

- `node tests/regression_v6.cjs` now verifies the dialog is outside the profile
  modal, opens with interactive inputs and focus, and restores the profile when
  closed; request submission/queue tests remain passing.
- V3/V4/V6/V7 regression suites remain passing; latest build/archive is
  `/home/user/art-nexus.zip`.

## V9 My Profile dropdown and non-destructive Sign Out — 15 October 2026

- Clicking the My Profile avatar now opens a dropdown only. Signed-out users see
  **Sign Up** and **Sign In**; only a currently logged-in Creator sees the
  **Creator Studio Dashboard** entry. A logged-in Creator also gets Edit Creator
  Profile and Sign Out; a non-Creator can start optional Creator Setup.
- Edit Creator Profile closes the My Profile layer before launching onboarding,
  eliminating the higher-z-index parent that previously made the editor appear
  frozen. The edit form restores focus to the My Profile trigger when available.
- Sign Out saves the local account snapshot and reloads the app. The Creator
  profile/portfolio/WIP remain browsable in a signed-out preview; the account
  registry and snapshot remain intact, and private likes/follows/cart/orders
  remain isolated until email-only sign-in restores them. No password, secure
  authentication, server login, or cloud persistence was added.
- `node tests/regression_v7.cjs` now checks the logged-out and logged-in dropdown
  states, signed-out Creator preview preservation, account restore/isolation, and
  the former frozen-edit modal stack. V3/V4/V6/V7 regression suites pass.
- `python3 src/build.py` rebuilt `index.html` with 28 embedded images (3,795 KB
  image payload; 4,465 KB single-file output); source/build JavaScript syntax
  checks pass. The static page has 270 unique IDs and 51 resolvable ARIA ID
  references.
- HTTP smoke check returned **200** for the rebuilt 4,572,179-byte app and
  confirmed both `profileAccessMenu` and `commissionRequestOverlay` are present.
- V9 archive: `/home/user/art-nexus.zip` (refreshed with the v0.40 build; ZIP
  integrity check passed).
