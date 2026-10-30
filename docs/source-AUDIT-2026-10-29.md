# Dashboard audit — 29 October 2026

## Changes

- Collapsed page guides, compact header spacing, keyboard focus and skip link.
- Shared same-origin JSON client with bounded requests, useful errors and no automatic write retries.
- Imported drafts survive background reloads; explicit saved-data reloads avoid overlapping requests; workbook writes detect stale versions.
- Greenhouse URL aliases match the same vacancy, preserving the original curated record and avoiding duplicate feed entries.
- Career refresh respects disabled jobs/people preferences without closing those saved listings.
- Nearby cafe lookup now uses a bounded same-origin server route, avoiding browser CORS dependence during a domain change.
- Owner migration export includes saved dashboard, discovery, preferences, portfolio history and an explicit browser-preference allowlist. Browser restore validates input and never changes server records.
- Domain migration guide and repository maintenance rules establish requirements for future updates.

## Verification

`npm run check`: 63 tests passed, plus authored JavaScript syntax, local imports/assets and current-hostname checks. Tests cover authorization, record editing/deletion/undo, fractional holdings, quote behavior, stale writes, disabled career categories, API errors and migration validation.

Live service-authorized checks on the public production site, before this UI release:

| Check | Result |
| --- | --- |
| Saved dashboard, research, discovery and portfolio history | HTTP 200 |
| Address search for Irvine Spectrum Center | HTTP 200, 5 results |
| Quote refresh | HTTP 200; all 11 positions updated, no failures |
| Career refresh | HTTP 200; all 4 sources completed; 10 job matches and 10 recruiters checked |
| Legacy Yahoo stock detail/history endpoint | HTTP 503, upstream rate limit |

No disposable records were inserted into production. Mutation edge cases are covered with mocked storage tests. Live refreshes update real saved results as intended.

## Limits and follow-up

The visible stock-detail charts use TradingView; the unused legacy Yahoo endpoint remains subject to provider rate limits. External feeds, embedded charts and map services cannot be guaranteed continuously available. Saved data and error messages remain the fallback.

The cloud browser is a public, signed-out session. Owner-only controls are verified through code/tests and service-authorized routes, not a full signed-in browser workflow. Mobile layout uses responsive CSS; no device-specific certification is claimed. Local preview could not be reached from the browser; verify the published interface after deployment.

A custom domain has not been selected or attached. Follow DOMAIN-MIGRATION.md before switching origins or hosts. Existing daily schedules keep their approved canonical update destination and support the public dashboard.

Published smoke check: nearby cafe search returned HTTP 200 with real Irvine results. Browser checks confirmed job filtering and the collapsed guide; further navigation verified after deployment.

## Individual chart repair

A user screenshot showed a blank GOOGL embedded chart. Replaced the hand-built
TradingView iframe URL and custom sandbox with TradingView's documented embedding
loader. Added bounded loading guidance, script-load failure handling, cleanup on
range/holding changes, and a prominent direct chart link. The host cannot inspect
cross-origin chart contents, so it does not claim an iframe load proves that market
data rendered. Browser/provider restrictions can still require the direct link.
The unpublished FC27 experiment is excluded from this repair release.
