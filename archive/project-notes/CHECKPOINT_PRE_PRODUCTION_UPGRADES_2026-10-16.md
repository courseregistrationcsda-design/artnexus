# Pre-production-upgrade checkpoint

**Created:** 16 October 2026  
**Purpose:** Preserve the exact pre-upgrade Art Nexus baseline before any implementation changes.  
**Baseline:** V0.40 / V9 local-preview prototype.  
**State:** No application code, build, tests, or architecture has been changed for the requested production-upgrade work yet.

## Verification state at checkpoint

- `node tests/regression_v4.cjs && node tests/regression_v6.cjs && node tests/regression_v7.cjs` passed before this checkpoint.
- `src/app.src.html` and `index.html` each had 270 unique IDs, no duplicates, and no statically unresolved ARIA ID references.
- The diagnostic-only audit found the latest UI requests are still pending: close X is left-aligned and outside-click close is absent; the “50 Artifacts Loaded” label remains; collaboration fabricates ID-derived mail addresses; Explore More scrolls within the artist profile and does not prioritize recommendations.
- Real artist contact emails, payment-provider credentials, database/auth configuration, and production environment credentials were not supplied.

## Baseline file fingerprints

| File | Bytes | SHA-256 |
|---|---:|---|
| `src/app.src.html` | 684885 | `4b240342b3b92bab944b4a5b7721b8ca679a32bcd9e305ba89011d89607da580` |
| `src/build.py` | 2506 | `6ff2b80266c1f7efaef1afff1998c768991840415f9b117f97571adc26f88082` |
| `index.html` | 4572179 | `1b197f85dbff03da78c14791665142623ba9767f9bf5647aa536e3924cb516e5` |
| `README.md` | 24135 | `17f331b4d0f5abd1ad675ce6f54368248955ef610bef64ef5fb6473d5b186911` |
| `AUDIT_REPORT.md` | 48555 | `472cbbfd03927c3402921a8c2760c9bc7db072b4974a66582b8192c797704d15` |
| `CHECKPOINT_REPORT.md` | 26879 | `c2ba38cba34dd5619b100881bc2810c7f4f112e3502ad180094e3ccd0d480697` |
| `PRE_DEPLOYMENT_AUDIT_2026-10-16.md` | 21801 | `f5522f64d6cc6324977382e474b5b8454c6fcd22cf54f08af8c9d86d1d4ab209` |
| `tests/regression_v4.cjs` | 15253 | `08a9ae79803abf8ac3811df453679ef8ad402f3bb844f56e2abaa82defb9d0c0` |
| `tests/regression_v6.cjs` | 30373 | `08db9b4c51d8794672093eeb06c8b0e1bb5826ed9a5edbc55a72fb0b5a240984` |
| `tests/regression_v7.cjs` | 16836 | `2d8751386b9ef217af4612629d5472b6f7cd68e09ccd1562f6b789d9cd207b8e` |

## Rollback archive

A date-stamped ZIP snapshot of the complete project tree (including this checkpoint and the diagnostic audit) is created alongside the project at:
`/home/user/art-nexus-preprod-checkpoint-2026-10-16.zip`.

The archive is a rollback copy only; no production credentials or `.env` secrets are included.
