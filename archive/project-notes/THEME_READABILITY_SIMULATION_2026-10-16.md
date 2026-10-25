# Theme and readability simulation — 2026-10-16

## Changes covered

- Added a persistent **Light / Dark** theme switch on the visitor splash, main app headers, and Folio Stack viewer. Dark remains the default; the selection is stored locally under `artNexusAppTheme`. The single-artwork preview intentionally has no header.
- Reworked the Folio Stack viewer to use the single-artwork viewer's blurred artwork backdrop, floating detail sheet, floating Like / Bookmark actions, and existing sale/local commission controls. Creator Studio now offers two Folio layouts: a vertical sequence with a 28 px gap between artworks, or a horizontal snap carousel with swipe, arrow buttons, and left/right keyboard navigation. The selected layout is saved in the local Creator work/feed data. The production catalog schema does not yet include this preference, so cloud listings default to vertical; no database migration was applied.
- Raised muted-copy contrast slightly and made the existing color guardrail choose foregrounds according to the active theme. The Creator Drive agreement remains white text on `#1A172D`.
- Corrected Creator Studio fields so their visible background matches the `pearl` surface used by the contrast guardrail. Account/commission labels now use theme-correct foregrounds, placeholders retain guardrail-selected colors, and the light-theme Drive panel has a dark surface behind its white text. Settings copy and labels were slightly enlarged for readability.
- Removed the top bar from the single-artwork detail preview and the Folio Stack viewer. Outside-click and Escape dismissal remain; the Folio Stack theme and close controls stay available as floating buttons, and the artwork scrollbar is hidden without disabling scrolling. An accessible cue shows “Scroll down” for vertical Folios or “Swipe or use the arrows” for carousels, then fades when movement begins or after about five seconds.
- Revised Explore More to remove the recommendation lift/expand and cloned-card morph. The artist hub now uses only a 180 ms opacity fade to reveal Browse (reduced motion: 1 ms). The four previewed recommendations remain prioritized; clicking a similar work opens its detail preview, and closing it returns to Browse without resetting the feed scroll position.

## Simulation method

Ran `tests/theme_contrast.test.mjs`. It applies the app's WCAG contrast-ratio and APCA-style foreground-selection rules to five semantic surfaces (`void`, `inset`, `raised`, `amber`, and `pearl`) and four text roles (`primary`, `secondary`, `muted`, and `accent`) in both themes: **40 foreground/surface checks total**. A dedicated Creator Studio regression also checks settings labels, field value/placeholder pairs, field boundaries, and the light-theme Drive panel against their actual theme-specific surfaces.

| Theme | Checks passing | Minimum WCAG contrast | Minimum APCA Lc |
|---|---:|---:|---:|
| Dark | 20 / 20 | 6.91:1 | 56.1 |
| Light | 20 / 20 | 5.66:1 | 68.2 |

All simulated text pairs exceed the 4.5:1 WCAG AA text-contrast threshold. Direct Creator Studio checks now report:

| Theme | Settings label | Field value | Placeholder | Field boundary* |
|---|---:|---:|---:|---:|
| Dark | 15.53:1 | 17.44:1 | 6.46:1 | 3.56:1 |
| Light | 14.84:1 | 16.21:1 | 8.42:1 | 5.21:1 |

The light-theme Drive panel's white-on-`#1A172D` copy is 17.44:1. *Field boundaries use the WCAG 3:1 non-text UI-component criterion. APCA-style values are a guardrail heuristic, not a certification.

## Validation

- `npm test`: passed 30 Node tests plus the V3, V4, V6, V7, and V8 regression harnesses.
- `npm run build`: passed; generated the single-file preview with 28 embedded images (about 4,689 KB total; 4,801,848 bytes).
- Extracted the inline JavaScript from the current `index.html`; `node --check` passed.
- Preview served the latest build with HTTP 200 (4,801,848 bytes); checks confirmed both Folio creation choices, 28 px vertical gaps, carousel controls, hidden artwork scrollbar with retained scrolling, the Explore More transition, and the removed preview headers.
- Theme selection, Folio Stack save/like states, vertical/carousel layouts, not-listed/sale state, close behavior, scroll-cue dismissal, carousel keyboard/swipe navigation, Creator Studio contrast rules, single-artwork dismissal/Browse-scroll behavior, and Explore More recommendation ordering/fade behavior are covered by regressions.
- Built preview SHA-256: `cf0eab77691e66dcf4ea661bcc5d594243d21b1e7683a4f9875d23668dd7cc80`.

## Scope note

This is a token/surface simulation and automated frontend regression pass; it does not measure text rendered over every possible artwork image. The current workspace has no installed Chromium/Playwright runtime, so no browser screenshot-based desktop audit was run. Artwork-dependent areas retain the blurred backdrop/overlay treatment, while text and actions sit on the detail sheet.
