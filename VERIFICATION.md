# Live Website controls theme correction

2026-10-31T07:43:59.970Z

The standalone owner page now loads both existing theme stylesheets and supplies their nd-flow / website-controls-page classes. Removed legacy inline green/gold styles, matched the Brian's Dash branding and removed the stale v57 footer. Settings client logic is byte-for-byte unchanged. No public assets changed.

- 135 tests and production preflight passed; Worker built and downloaded code checksum verified.
- Desktop 1440px and mobile 390px fixtures rendered the exact production controls with navy/plum surfaces, cyan switches and rounded cards; screenshots inspected, no horizontal overflow. Fixture settings are read-only in memory.
- Live deployment 8ac32346-a287-427b-8987-d7d2c34c3665; source fecc2efe93b6ac4e4221a21a89913ffa2ee91614.
- Private settings revision 1 and all bindings preserved; public view stays on, AI and daily research stay off. No live authenticated settings-save or paid-provider test was performed.
- Details: docs/controls-theme-verification.json.

# Version 66 release validation

2026-10-31T07:22:58.708914+00:00

- Release ZIP: all 572 payload checksums match; Site v66 commit verified through Sites.
- Current private GitHub main: 02b4e39f2cb8d48cc437f1c14981faca6d6880d4; all 160 blobs verified before reconciliation.
- Live Worker remains c1b7e138-7e85-4ffe-ac26-1814bb597401 before publication.
- 135 tests passed; browser portability checks passed. New tests cover news, local events, career filtering, owner-only writes and disabled AI.
- Owner settings revision 1: public read-only true, AI false, daily research false. No paid calls or data migrations performed.
- Production deployed 13167f26-009b-469f-934b-3b91c7da8e98 / Worker aeadc586-0069-4128-ab3c-e26f52c092f7. Downloaded Worker SHA-256 matches the exact compiled build.
- All 94 immutable R2 assets matched size/ETag readback; 93 unmodified live assets also matched SHA-256 in a real browser. The index is intentionally transformed by the owner-link gateway and was verified through the rendered DOM.
- Desktop 1440px and mobile 390px: News navigation/view present, no horizontal overflow, owner editing disabled for visitors. Public APIs returned 200; settings GET and news/records/settings/AI POST returned 401.
- All four existing dashboard stores and site-settings.json remained unchanged by hash; bindings including the API-key binding are preserved, alternate Worker URLs disabled, AI/daily research off.
- GitHub standalone source: 81a586e3151abf6cf36bdf60e46bbd105996fd42 (190 files); original Site mirror: 9f2ea5f097cd57ec6dfa5d5398e24c1a0f80a8df (281 files). Final release records are committed afterward.
- See docs/release-v66-verification.json for exact check results.
- Authenticated owner settings-save and live paid providers have not been retested.

## Earlier validation history

# BDashh deployment verification - 30 October 2026

## Live release

- Website: https://bdashh.com/dashboard/
- Approved dashboard version: 57, source commit `d824a7d2e6477d005b0d3912c363828f1da34aa4`.
- Brian explicitly instructed launch now, API credits later, and no future version changes unless requested. Version 58 reconciliation and successful paid AI are therefore not launch prerequisites.
- Production Worker: bdashh-live.
- Version: c910b062-24d4-49e3-b558-24e621db1e64.
- Deployment: cb801522-a7f6-4378-8513-62f8ba6d8b67, uploaded 08:40:09 UTC.
- Preview Worker: bdashh-preview, version 846c6445-92f6-4bde-89ee-ee7e8b58210e.
- Preview URL: https://preview.bdashh.com/dashboard/
- Canonical redirect Worker: bdashh-www, version 530e15b05b544b1e905a0b379a3fc41e.

## Passed

- 306 export checksums matched. Four actual saved-data API snapshots were imported and verified, including 11 holdings and 10 portfolio-history points.
- 89 automated tests passed with zero failures. Browser syntax, imports, local assets and domain portability passed. npm was unavailable, so its Node check commands were run directly.
- Tests cover owner JWT validation, wrong issuer/audience/email, anonymous reads, same-origin writes, private asset integrity, saved-data preservation, AI provenance/limits/locks, failed requests, merging and Pacific daylight-saving scheduling. External providers/storage are mocked.
- Wrangler 4.92.0 dry-run bundle passed: 128,534 bytes; SHA-256 `38af1ca3907a43bdde2a9f1062552270a9b86515e569467732e0f19f3ce65e41`. The same tested bundle was deployed on the main hostname with production bindings.
- 83 private R2 assets totaling 1,919,910 bytes were uploaded and checked by size and ETag. Release: `671c30ec3423cb541805ecf8`.
- Owner email-code sign-in and HTTP 200 dashboard/assets/API reads were verified on the preview before promotion. Browser invocation logs recorded TLSv1.3.
- Preview owner quote-refresh and portfolio-history POSTs returned 200. R2 metadata readback confirmed persistence at 07:53:25.749Z. Providers returned older prices, so newer saved quotes were retained; no new price or history point is claimed.
- Both saved-data copies and DNS were backed up under `backups/launch-v57-20261030T0838Z/` in private production R2 before cutover. Core content was compared, preview data was promoted, and all four objects were read back successfully. AI attempt counters were preserved.
- The previously tested Worker was renamed to bdashh-live. Secret binding presence was verified afterward and after the production upload; no key value was extracted.
- A separate replacement preview retains isolated data and the same owner Access audience. It has no API secret.
- Production Access is owner-only for uongb03@gmail.com, with OTP and no bypass policy. Worker host/audience settings match the production Access application.
- Three Wix apex A records and the www Wix CNAME were replaced by proxied Worker custom domains, with exact-record checks and backup/restore handling. Main, www and preview route readback matched their intended Workers.
- Real Cloudflare Browser Rendering checks of https://bdashh.com/dashboard/ and /api/sync successfully loaded the HTTPS page titled "Sign in ・ Cloudflare Access", identified the BDashh Private app/email form and returned no dashboard data.
- A later sequential browser check of https://www.bdashh.com/dashboard/ reached the same owner sign-in page. An earlier concurrent check was rate-limited; the successful sequential check is the evidence.
- Canonical redirect smoke checks verify preservation of path/query, fixed HTTPS destination, rejection of unexpected hosts and rejection of POST requests.
- All four Workers, including the inactive legacy Worker, have workers.dev/version-preview URLs disabled and no cron schedules. Production and preview daily AI flags are false; STARTUP_CHECK_ID is absent.
- Main and preview deployment preflights passed under the explicit version 57/deferred-AI policy.

## AI status: deferred by owner

Real unattended Cloudflare checks ran at 08:20:45Z and 08:24:45Z and verified atomic storage claim/readback. OpenAI requests failed; the diagnostic response code was `credit_balance_exhausted`. Career retry was skipped after the billing diagnosis. No generated research was saved, and prior holdings, sheets, briefing, discovery, research and history were preserved.

The account namespace bdashh-private-d09ad5.workers.dev was registered after authorization; public Worker URLs stayed disabled. Temporary cron and startup flag were removed. The existing secret is preserved on production. No purchases, billing changes, further AI calls or daily activation were made during final cutover.

## Limits and follow-up

- A fresh owner login and save on the final hostname are not yet recorded. Owner login/save evidence is from the identical version 57 code on the preview before promotion.
- Other-user browser rejection, planner add/reload/remove, full desktop/mobile visual checks, maps/charts/radio/job feeds and newly delivered quote values remain unverified live on the final hostname.
- Completed AI research, model entitlement, source quality and AI persistence remain unverified until API credits are available.
- Local Windows HTTP checks failed DNS resolution and the web checker could not open the private site. The successful Cloudflare-hosted browser checks provide live HTTPS/sign-in evidence instead.
- Runtime type generation previously failed with an environment permission/fetch error and is not marked passed.
- GitHub private-repository access remains unresolved; no source was pushed and no automatic deployment was set up.
- No original ChatGPT Site or automation was modified. Version 58 is intentionally excluded.
- Earlier approval-review rejections were resolved by the subsequent explicit instructions: account setup was approved, and Brian specifically authorized version 57 website cutover while deferring AI billing. No further approval rejection occurred during this cutover.

## Security repairs

Signing-key and OpenAI requests use manual redirects and reject non-success responses because Workers does not support redirect:error. Credentials are not forwarded to redirect destinations. Access diagnostics expose fixed categories only.

Provider errors use allowlisted billing/rate-limit codes; raw provider messages and arbitrary codes are never returned or stored. Tests verify redaction and preservation of saved results. The startup check has no HTTP endpoint or authentication bypass.

The publication policy is recorded in AGENTS.md and migration-status.json. Do not import or publish another dashboard version without Brian's explicit request, or enable AI schedules while activation remains deferred.


## Current state: paid AI paused by owner (30 October 2026)

This section supersedes the launch-only AI and deployment status above. Funded startup research completed and saved a briefing at 09:10 UTC and career results at 09:19 UTC. The 7 AM Pacific regular run later completed career research but failed briefing research; that failure was not investigated or retried during this cost-saving pause.

At 15:30:39 UTC (8:30 AM Pacific), production configuration was changed without uploading application code: OPENAI_MODEL is empty, ENABLE_DAILY_BRIEFING and ENABLE_DAILY_CAREER are false, and cron triggers are empty. The API secret and all unrelated bindings were preserved exactly and verified by readback. Manual AI requests fail configuration validation before any provider or storage operation. The saved results, authentication and v57 asset release remain unchanged.

Production version: 9b7c7ef7-d387-4721-ab95-765499b49b83. Deployment: 94c24a66-ff57-41de-befa-dc1c1e763acf. Public alternate URLs remain disabled. No in-flight research was present on verification. Local source has now been synchronized with the previously deployed career-request repair; no new code was published during this pause.

Local smoke checks verified zero provider/storage calls for both manual tasks with a blank model, and no scheduled work with disabled flags across Pacific summer/winter time. Reactivation requires Brian's explicit request; restore the model and, only if requested, the daily flags and schedule. Do not restore an older active deployment as a shortcut.

After synchronizing local source/configuration for the pause: all 89 automated tests and production preflight passed. These tests use mocked external providers; no paid test call was made.


## Current audience: public read-only testing (30 October 2026)

Brian explicitly requested making the website public and confirmed that this was acceptable for testing. This supersedes the earlier private-only audience requirement. Dashboard source version 57 and immutable static asset release 671c30ec3423cb541805ecf8 are unchanged.

Production Worker version 79e0ca2b-20af-4285-ba5a-d26aea52ae46, deployment 119b3e8e-f43e-4103-84ac-bc4d20209ccf, was uploaded at 17:34:22 UTC. Cloudflare Access was narrowed to bdashh.com/owner at 17:34:39 UTC. The same exact owner email policy, audience, OTP provider and 24-hour session remain in use. Domain-scoped application cookies are cryptographically verified by the Worker for owner actions outside /owner; unsigned cookies or identity headers do not grant editing. The public index's existing sign-in link is changed to /owner in the response without changing stored v57 assets.

Validated: all 92 tests, browser syntax/import/asset portability checks, production preflight, and Wrangler 4.92.0 dry-run bundle (131006 bytes; SHA-256 c0696f54a8d920a30773c8e3a5d3f16e44a05ebb32e52d22baa693d5136dcaa0). New tests cover anonymous reads without owner identity, blocked writes/AI/unknown APIs, signed owner-cookie authentication, invalid/wrong-owner/wrong-audience/duplicate cookies, same-origin writes and fixed owner-login redirects.

Live fresh-browser checks: dashboard loaded with READ ONLY, data-owner=false and the /owner link; /api/access returned canEdit=false; saved dashboard and discovery reads returned 200. Anonymous POST /api/sync and /api/ai/briefing both returned 401. /api/ai/status reported configured=false and both daily jobs false. /owner loaded Cloudflare Access sign-in. A fresh authenticated owner-cookie editing session was not exercised live; cryptographic and route behavior passed local tests.

Paid AI remains paused (blank model, disabled flags, no cron). Existing key, R2 bindings, saved content, preview privacy and disabled alternate Worker URLs are preserved. No original ChatGPT Site or automation was changed. Public responses retain no-store and noindex headers for testing; these are not access restrictions. Private configuration backup: operations/before-public-test-20261030.json; deployed source: operations/releases/v57-public-test-20261030.json.


## Current operations: owner Website controls (30 October 2026)

Brian explicitly authorized easy visibility and OpenAI switches. The owner-only page is https://bdashh.com/owner/settings, also linked inside Owner tools. Its controls save immediately through authenticated, same-origin requests to /api/site-settings. Private R2 site-settings.json is the runtime source of truth. Future deployments must preserve it, never reset it from migration-status or environment defaults. Public/private, AI on/off, and optional daily research are independent choices; AI off also turns daily research off. Enabling AI alone does not enable daily research or make a paid call. Requests already in flight may finish.

Initial live settings are revision 1: publicReadOnly=true, aiEnabled=false, dailyResearchEnabled=false. Missing/corrupt settings fail closed. Each request reads current settings without a cache; AI checks again before provider calls. Conditional writes and revisions reject stale browser updates. Signed owner cookies work in both visibility modes. Private visitor page requests lead to /owner; private data APIs and controls still reject anonymous access. The key remains server-side and never appears in the controls response.

The passive cron 0 14,15 * * * only performs research at 7 AM Pacific when both AI and daily research are enabled by the owner. With initial settings it makes no research or quote refresh calls. Legacy model and daily environment flags remain blank/false as a fallback. The existing v57 static asset release is unchanged; owner-control HTML and its dashboard link are served by the Worker. No newer Site feature version was imported.

Production version c1b7e138-7e85-4ffe-ac26-1814bb597401; deployment e6e831d3-79e2-44c9-8b39-93388ac2e73a at 18:06:29 UTC. Wrangler dry-run passed; bundle 146482 bytes, SHA-256 35c5cd87d7a4f8df66f87b8edb8f7af2978bc0c46316296bc4bd61589457e177. All 100 automated tests passed, including identity/origin checks, independent settings persistence, stale/concurrent edits, private owner access, invalid settings, and AI off preventing injected provider calls. Browser/source portability and deployment preflight passed.

Cloudflare browser fixture at 320 px exercised public/private, AI on/off, daily opt-in, automatic daily-off on master-off, and restoration of the initial state without horizontal overflow. It used mocked settings responses and made no paid calls. Local Edge could not launch reliably in the sandbox; the cloud browser fixture was used instead. The state handlers were independently exercised against conditional-write memory storage.

Live anonymous checks confirmed the public v57 dashboard still loads READ ONLY with the controls link, /api/site-settings GET and POST both return 401, AI status reports configured=false and both daily flags false, and /owner/settings requires Cloudflare Access. The stored key and disabled alternate Worker URLs were verified. A live authenticated owner settings write was not exercised. No saved dashboard objects were changed and no paid OpenAI request was issued during validation.

Backups: operations/before-owner-controls-20261030.json and operations/releases/v57-owner-controls-20261030.json. Original ChatGPT Site and schedules remain unchanged.

## GitHub repository access and source import — 30 October 2026

GitHub now reports installation 176991194 under Brian-Uong with selected-repository access. Brian-Uong/bdashh-private is private and reports read/write permission. Its existing main head, 0e96e4c83422885d166464a94568ac5180c5f026, contains only the starter README. The import preserves that commit as its parent.

The current standalone v57 source includes the authorized owner controls. All 100 tests and production preflight passed again. Wrangler 4.92.0 dry-run output is byte-identical to the deployed owner-controls bundle: 146482 bytes, SHA256 35c5cd87d7a4f8df66f87b8edb8f7af2978bc0c46316296bc4bd61589457e177. Static asset bytes are checked against the existing release manifest before upload.

The upload allowlist excludes private-data, environment files, credentials, dependencies, build directories and audit artifacts. A credential-pattern scan allows only the explicitly identified dummy test key. Git attributes preserve original line endings. README now documents the current owner controls and manual release process instead of superseded launch/billing instructions.

Cloudflare reports no production build triggers. R2 settings readback remains revision 1: public viewing on, OpenAI off, daily research off. No website deployment or paid AI call is part of this repository import. Source upload verification is recorded separately after remote readback.

### Completed repository import

At 2026-10-30T18:44:45.025Z, remote main points to import commit db262ec1987d09533c8eb0b4182667364e7c9f49, tree ef9d5d0e31beca776b7a568e1c708f191fd05848. GitHub readback confirms the repository remains private. All 154 remote file blob hashes and sizes match the local upload manifest, with no missing or extra files and no truncated tree response. The initial README commit is preserved as the import's parent. This verification record is a subsequent documentation-only commit.

The private-repository access blocker is resolved. GitHub is now the stored source for the standalone v57 website and authorized owner controls. Future website publication still requires Brian's request. No deployment trigger, API setting, live dashboard data or original Site was changed during this work.

## Shared source handoff and repeatable release preparation

Added source snapshot export, release provenance checks, checksum-based GitHub deltas, and release packet preparation. Native connected GitHub/Cloudflare tools perform publication after preparation; the scripts do not create an unattended cross-chat automation. The first site-source mirror remains unpopulated and version 65 is still pending source retrieval from its cloud development checkout.

All 107 automated tests passed. Tests include a real local Git source export, wrong-commit/dirty-checkout rejection, sensitive-file exclusion, exact UTF-8 and binary round trips, credential-pattern rejection without logging values, changed-file comparisons and stale source/asset rejection. Release-check correctly rejects the real v65 request against the current v57 standalone source before building or publishing.

A separate fixture copied from the verified v57 standalone source exercised the full preparation path with Wrangler 4.92.0. It produced GitHub, assets, Worker and release-plan packets, verified 83 assets under release 671c30ec3423cb541805ecf8, and reproduced Worker SHA256 35c5cd87d7a4f8df66f87b8edb8f7af2978bc0c46316296bc4bd61589457e177. Only the isolated fixture's provenance was set to v57 for this test; production and the real pending v65 request were unchanged. No remote deployment, saved-data change or paid AI call occurred.
