# Art Nexus checkpoint — before Non-Profit Product Pillars phase

**Checkpoint date:** 20 October 2026 (Asia/Manila)  
**Purpose:** Preserve the verified workspace before implementing the newly supplied Non-Profit Product Pillars.  
**Checkpoint type:** Full project-tree rollback archive plus this manifest; this workspace has no `.git` repository, so there is no commit to restore.

## Current verified baseline

- Current deliverable: the local Art Nexus preview at `index.html`.
- `npm test`: **passed** — 30 Node tests plus the V3, V4, V6, V7, and V8 regression harnesses.
- `npm run build`: **passed** — 28 embedded images; `index.html` is 4,801,848 bytes.
- Extracted built inline JavaScript: `node --check` **passed**.
- Local preview: HTTP 200; served byte count matched the build.
- Build SHA-256: `cf0eab77691e66dcf4ea661bcc5d594243d21b1e7683a4f9875d23668dd7cc80`.
- Screenshot-based browser audit was not run (Chromium/Playwright is not installed in this workspace).

## Current local features preserved by this checkpoint

- Explore More uses a fade-only reveal, prioritizes four similar works, and artwork preview dismissal returns to Browse without resetting the feed scroll.
- Folio Stack viewer is headerless, has floating theme/close controls, hides the artwork scrollbar while retaining scroll input, and shows an accessible mode-specific scroll cue.
- Folio Stack creation supports a spaced vertical layout (28 px between works) or a horizontally snapping carousel with swipe, previous/next controls, and keyboard arrows. The choice is stored in the local Creator work/feed data.
- Dark/light readability and existing Artwork Detail/Folio Stack modal regressions remain covered.

## Important production boundary

- Deployment remains paused. No provider configuration, credentials, database migration, or external-service activation occurred in this checkpoint.
- The Folio presentation choice is local-only: the current production catalog/RPC schema has no `folio_presentation` field. Cloud-loaded Folios therefore default to vertical until a separately authorized schema/RPC migration is implemented and applied.
- Existing production paths are still present in code (Supabase/Auth scaffolding, private Drive media, and PayMongo checkout code), but their live configuration and end-to-end behavior are not verified here.
- Existing `unlisted` Creator artwork status is not equivalent to private-by-link: current local Creator work can still appear in public portfolio/feed views. No new privacy model has been implemented yet.
- The existing campaign/event broker is local-only; no double-opt-in newsletter/email database is configured.

## Pillars phase status

The user supplied a new product direction covering cooperative governance, a Folio-first non-algorithmic experience, unlisted-by-default works, off-platform transactions, local 720p WebP previews, sovereign storage pointers, direct peer-to-peer transactions, double-opt-in campaigns, and a privacy policy draft effective 20 October 2026. These are captured as **target requirements, not verified current-state claims**. No code changes for this phase have been made yet.

## Key file fingerprints

| File | Bytes | SHA-256 |
|---|---:|---|
| `src/app.src.html` | 914,554 | `eb34ae67d6424344a609690fbd3c12a795b2ce65d7903921e350d956922f3d68` |
| `src/build.py` | 2,506 | `6ff2b80266c1f7efaef1afff1998c768991840415f9b117f97571adc26f88082` |
| `index.html` | 4,801,848 | `cf0eab77691e66dcf4ea661bcc5d594243d21b1e7683a4f9875d23668dd7cc80` |
| `tests/regression_v4.cjs` | 16,670 | `c3b7bccde9553e8217a2b53eb5a26b4253e14caa9fa79e8d84f7e062982653ab` |
| `tests/regression_v6.cjs` | 35,440 | `7cb4d0c005a6359fd2777fe8dd1741e4fe23c2cd8d8fb36e7090416c877922c8` |
| `tests/regression_v8.cjs` | 21,624 | `9fdeb1fcd1149270f770f9d6118f70201060677a5af774b7623f24ddb4eb1e32` |
| `tests/theme_contrast.test.mjs` | 13,011 | `37aa572ae7815ecde66504b7ce2f56a9d153f6ad6284b2566481f6a1076bebbf` |
| `THEME_READABILITY_SIMULATION_2026-10-16.md` | 4,913 | `2b399e62ef6dbe43f9f9751523f9011c9f64ceace5f6bcfaefb75a6ae10c2e4c` |

## Rollback archive

Full project-tree archive (secrets excluded; `.env.example` retained):
`/home/user/art-nexus-checkpoint-nonprofit-pillars-2026-10-20.tar.gz`

Verify the archive using the adjacent `.sha256` sidecar at `/home/user/art-nexus-checkpoint-nonprofit-pillars-2026-10-20.tar.gz.sha256`. Restore by extracting it under `/home/user/`; the project folder name in the archive is `art-nexus/`.
