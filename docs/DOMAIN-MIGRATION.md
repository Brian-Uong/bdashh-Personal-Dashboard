# Current two-host development workflow

As of October 30, 2026, bdashh.com is a separate Cloudflare deployment. This ChatGPT
Site is the development dashboard. Publishing here does not authorize publishing
bdashh.com or changing either host’s current visibility or AI settings.

The shared Website controls navigation points to /owner/settings on each host.
Here it returns an inert preview of the production controls; on bdashh.com the
owner-verified router serves the functional controls. The preview contains no
active script, provider request or settings writer. It never reads live settings.

The complete deployment source is /workspace/sites/bdashh-workspace, based on
Brian-Uong/bdashh-private. Merge shared UI changes into that source and retain its
authentication, site-settings backend, AI gates, scheduler, bindings and secrets.
Do not deploy this Sites-only tree wholesale to bdashh.com. Follow the complete
workspace’s source comparison and release instructions before a .com release.

## Historical migration guidance

# Preparing Brian’s Dash for a .com

## Preferred path: custom domain, same Site

Sites currently provides add/list/refresh/remove custom-domain operations. No custom
domain was attached as of October 29, 2026. Brian must select a domain he owns first.
Use the existing project, not a new Site: `appgprj_6ae23020eb70819199a6dbf59b793ff9`.

1. Export the workbook and migration backup from Owner tools. Preserve the current
   source revision and data. Pause editing during the final backup so the independent
   server stores do not change between reads; the backup is not a database transaction.
2. Add the exact chosen hostname through Sites. Use its returned CNAME or apex A
   targets and validation records verbatim; never guess DNS addresses.
3. Set those records at the domain’s DNS provider. Wait for domain and SSL statuses
   to become active. A domain is not ready merely because it was added.
4. Test the new HTTPS host: `/`, `/dashboard/`, hash navigation, local JS/CSS, public
   reads, anonymous write rejection, owner sign-in, and an owner save/readback.
   Confirm the custom host supports the Sites sign-in flow; if it does not, retain
   the original host for owner administration until supported sign-in is verified.
5. Test price refresh, Career hub refresh, address and café search, maps/routes,
   TradingView embeds, record editing/deletion/undo and workbook export.
6. Server records stay with the same Site/R2 binding. Browser localStorage does not
   transfer to another origin: use Restore browser preferences on the new host after
   signing in. This restores the allowlisted local choices, not server data. Save any
   drafts before reloading. Audio and motion preferences are included; temporary
   provider caches, sessions, credentials and cookies are not.
7. Keep the scheduled updater pointed at the already-authorized original Site origin
   initially. Both hosts should read the same store. Verify a scheduled write appears
   on the .com before changing any task destination. Never forward a service token to
   a new hostname merely because a page redirects there.
8. Keep the old host available during rollout. Decide canonical redirects only after
   sign-in, API paths, links and all schedules are verified. A redirect of a token-bearing
   update request must not silently forward its credential to another origin.

## Existing portable pieces

Browser API URLs are relative to the current origin and share bounded request/error
handling. Assets use relative paths. Workbook, records, quote validation and history
are separated from presentation. Source checks reject the old Site hostname in
browser JavaScript/HTML. Browser preference backup uses a strict key allowlist.

## A different hosting provider is a separate migration

A .com address alone does not require moving hosts. If moving away from Sites:

- Supply a compatible Cloudflare Worker runtime and durable R2 `BUCKET`, or implement
  and test a storage adapter with conditional writes. A static upload is insufficient.
- Replace Sites identity with verified authentication. Never trust client-supplied
  `oai-authenticated-*` headers on an ordinary host. Preserve owner-only writes,
  same-origin checks, service authorization and public read behavior.
- Provide secrets through the new host’s secret store. The current Sites dispatch
  token and sign-in routes are not portable to an unrelated service.
- Export and restore the actual server stores (`dashboard.json`, `discovery.json`,
  `research.json`, and portfolio-history records). Preserve record IDs, revisions,
  optimistic concurrency and snapshot timestamps. The backup’s portfolioHistory is
  the consolidated read model; restoring raw R2 history requires the format in
  `lib/portfolio-history.mjs`, not a blind JSON upload. Provider caches can regenerate.
- Provision a supported unattended writer on the new host. ChatGPT schedules do not
  move with a GitHub ZIP; update their authorized destination and verify write/readback.
- Check provider rate limits, usage terms, CORS and embed behavior on the new origin.
  Public-feed access is not a guaranteed service-level agreement.
- Run `npm run check`, build, staging smoke checks, desktop/mobile UI tests, backup
  and rollback rehearsal before switching DNS. Keep the old deployment intact.

## Future update contract

See `AGENTS.md`. Keep API paths same-origin, secrets server-only, provider failures
visible, stable storage keys, and regression tests for edits and refreshes. Update
this document whenever a hosting dependency changes. Do not label the dashboard
fully migrated until the actual target domain and authenticated update flow pass.

FC27 trading was retired at Brian's request after repeat refreshes proved unreliable.
The former tab and standalone page return to the overview; `/api/fc-market` returns
410 and makes no source or storage calls. Old optional `fc-market/v1/` R2 objects are
inactive and need not be migrated. The legacy `brians-dash-fc-trading-v1` browser key
stays on the backup allowlist so existing backups remain compatible. Source history
retains the experiment, but future changes must not re-enable it without Brian's request.

Courtside sports betting was retired at Brian's request on October 30, 2026.
Its tab, odds provider integration, preview examples and scanner have been removed.
Old tab/setup links return to the overview, and `/api/sports/nba` returns 410 without
provider or storage access. Inactive `sports/nba-analysis-v1.json` snapshots need not
be migrated. The `brians-dash-sports-v1` preference key stays on the backup allowlist
for compatibility with existing backups; no active feature reads it. Do not re-enable
sports betting or continue its development unless Brian asks for it again.

## News tab (October 30, 2026)

News adds /api/news and news.json (preferences plus per-topic editions). Up to five
saved topics feed the existing 7 AM Pacific cloud task, independently of investment
research. /dashboard/news-updater.md revision 2 is the unattended writer contract.
The owner/service writer validates selected IDs, topic revisions, HTTPS citations,
publication times and content sizes. Conditional writes, per-topic timestamps and
idempotent retries protect newer data. A failed/empty check keeps the last good
articles and displays their original age. Public visitors can read/filter; only
an owner can change saved interests. The browser backup includes the news store.

The complete .com workspace contains the same UI/data module plus native news
routing/research behind its existing owner authentication and AI/daily switches.
Only this ChatGPT Site is published for the request. No .com deployment, GitHub
push, settings activation, or migration of the scheduled task is authorized.

Validation: 74 Site tests pass, including news limits, source validation, stale
preferences, conditional writes, retry order, failure retention and safe card
rendering. The complete production-compatible tree passes 113 tests. Browser QA
was unavailable because the browser process could not start (workspace mount
failure); no visual verification is claimed. The hosted writer/readback and final
build are checked as part of publication.

News quantity correction: each topic now requests at least five new articles.
The API accepts up to ten, labels a shortfall partial and deduplicates normalized
URLs/headlines within and across editions (last 500 identities per topic). Same-day
additions can retain the current edition. Earlier editions cannot be counted as
new. Request size is capped at 96 KB. The 7 AM Pacific schedule is unchanged.

## Local events and career search (October 31, 2026 UTC)

Local Events now has an owner-only /api/events writer with bounded public calendar
checks and a separate AI-curated input. Both enforce California OC/IE geography and
local dates within 90 days. Duplicate source/date rows retain notes; conditional
writes preserve concurrent workbook updates. A lease and cooldown prevent overlapping
provider checks; source failures retain existing results and surface partial status.
The optional dashboard.eventSearch metadata lives in dashboard.json; the transient
event-search-lock.json lease does not need migration. No new secret is required.

Career live checks now include Esri's employer feed, county-aware matching and
entry-level prioritization. The UI separates direct checks from AI research and
shows the saved research report instead of implying that a reload invokes AI.
The hosted workspace has no OpenAI API key; its broader AI research belongs to the
existing 7 AM Pacific task via /dashboard/career-updater.md revision 1. Confirm the
unattended writer/readback before adding that contract to the existing task.
The canonical .com tree retains the gated OpenAI route and receives matching UI,
region/date checks and stronger research instructions; do not activate its switches.

Validation: all 86 Site tests and all 128 canonical tests pass, including regional
false positives, local-date parsing, conditional admission prices, duplicate/note
preservation, source failure and concurrent saves. Live local source checks reached
Irvine, Orange and Corona organizer pages and Esri's feed. Production build and
service writer/readback are verified during publication. Browser QA is unavailable
because the supported browser cannot launch in this workspace; no visual check is claimed.

Hosted verification found that Corona's GrowthZone calendars can fail from the
Worker while succeeding from local research. Those failures remain visible.
UC Riverside's official Localist API is an additional independent Inland Empire
source: two pages, maximum 200 entries and eight accepted events, actual published
venue address/geo, current occurrence dates, and audience/fee labels. Unknown
locations and virtual events are omitted; no campus footer address is inferred.
API reference: https://developer.localist.com/doc/api.

The v63 hosted service check saved nine new organizer events, checked 18 employer
job matches across all five career sources, saved two AI-reviewed job assessments
and one verified Corona event, and read back all writes. Existing event rows, notes,
holdings, quotes, briefing and unrelated workbook tabs were unchanged. The existing
7 AM Pacific task now includes career-updater revision 1; prompt, enabled state and
unchanged schedule were read back. Paid OpenAI research is unconfigured here.

October 31 refinement: the Site has authenticated on-demand AI routes, gated by its own server-side OpenAI key/model. Its morning ChatGPT automation is unchanged. bdashh.com’s API pause is deliberate; routine development checks focus here and do not activate or deploy there. Shared provider fallbacks and refresh fixes remain portable.

# On-demand headlines — November 3, 2026

Saving topics now checks their public news feeds immediately. Choosing a topic
filter checks that selection, and Refresh articles performs a real source check.
Background polling still only reads saved data and pauses during reading/editing.
Refreshes use the authenticated `/api/news` action `refresh`, saved topic IDs and
`baseTopicsVersion`. No OpenAI call or API key is involved. Five-minute per-topic
caching, a conditional 60-second lease, 15-second source timeouts, bounded response
sizes and 100 parsed candidates per feed prevent overlapping/unbounded requests.
Newly selected topics can be fetched independently of cached existing topics.

Only feed-reported publication dates within 48 hours are admitted; future/undated
entries and previously seen URLs/headlines are skipped. At most ten new articles
per topic are saved. Source failures and no-new-story checks preserve previous
articles with their original dates and explicit status. Headline-only entries are
labeled as Google News results and do not claim AI-generated summaries. Morning
ChatGPT research and its schedule remain separate and unchanged.

`news-feed-refresh.json` is disposable lease/cooldown metadata; no migration is
required. `news.json` optionally carries `format: feed-headline` on each item.
Existing readers, researcher writes, topic versions and backup format remain valid.

The Google News RSS response limits feed use to personal, non-commercial readers.
This adapter is for Brian's personal dashboard only; do not transplant it into
the commercial pdashboards product without replacing/reviewing the source license.
Normal provider availability and cache delays can affect refreshes.

Paid AI remains unconfigured on the ChatGPT Site. A ChatGPT subscription does not automatically
cover independent OpenAI API calls from hosted website code. Brian requires no
paid API usage here; do not provision/enable it without a later explicit request
acknowledging separate billing. bdashh.com API/settings and deployments are unchanged.

Validation: feed freshness/deduplication, selected-topic refresh, caching,
concurrent refreshes, changed-preference rejection, failure retention, automatic
UI save-to-refresh, rapid filter changes, draft protection and read-only reload
are covered by regression tests. Browser preview is unavailable: its managed
relay is missing. Live feed parsing succeeded; hosted checks follow publication.

## Hosted access and runtime correction — November 3, 2026

Automated verification must resolve the current URL from Sites get_site and send
both documented service authorization headers on reads as well as writes. The
old check began with unauthenticated reads and did not validate HTTP/JSON errors
before reading payload fields. It could stop before exercising the endpoint.
`scripts/verify-hosted-news.py` now validates every response, refuses redirects,
keeps credentials only in memory, and defaults to read-only checks. Its explicit
`--refresh` mode checks real news refresh/readback, unchanged topics, preservation
of unrelated dashboard data, cooldown reuse and disabled paid AI.

Authenticated hosted verification exposed a separate news adapter defect:
Cloudflare Workers rejects `redirect: error` at Request construction, before any
source fetch. The adapter now uses `manual` and rejects non-2xx responses, still
without following redirects. `scripts/check-news-worker.mjs` exercises the actual
workerd Request implementation, ephemeral R2 writes/readback and refresh caching;
Node-only tests could not catch this platform difference. The unit suite also
checks that redirected feeds cannot overwrite saved news.

The deployed dashboard and its sign-in link were checked in the supported browser:
the News page loads, and Owner sign in reaches OpenAI's login form. Anonymous
browser sessions correctly stay read-only; no owner session was impersonated.
No authentication rule, public/private setting, key, paid API flag or bdashh.com
deployment was changed. The existing 7 AM task is preserved.
