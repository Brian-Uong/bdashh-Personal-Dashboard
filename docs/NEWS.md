# Standalone publication status — November 4, 2026

Version 73 is now deployed to bdashh.com with public-feed news refresh and the existing owner authorization. Live settings remain AI off and daily research off. The preserved production data has no saved news.json yet; reads return the default topic state until the owner saves or refreshes it. This release did not copy development Site articles or alter that Site’s morning automation. Entries below are dated development history, not current deployment restrictions.

# News tab

The shared dashboard has a searchable topic picker (including custom subjects), a
server-enforced maximum of five topics, saved-topic filters and article search.
NBA, F1 and Premier League are initial defaults. Saving zero topics pauses news.
Every selected topic has a separate card using the existing daily-briefing style.

`news.json` in BUCKET stores preferences and briefings independently of the workbook.
GET/POST /api/news use each host's existing access controls. Public reads follow
the host audience; writes require owner/service authorization on Sites or verified
Cloudflare owner identity on .com. Never transplant Sites identity-header trust to
the .com backend. Settings saves use topicsVersion; conditional R2 writes prevent
lost concurrent edits. Results must match current selected IDs and topicsVersion.
Older/idempotent writes cannot replace newer reports. Failed/empty checks retain
last good articles, with explicit status and original timestamps. Published dates
are verified source dates, not the date a card was refreshed.

The ChatGPT Site reuses its daily cloud automation to research topics while closed
and write/read back this endpoint. Its public /dashboard/news-updater.md documents
that Site's service flow. It contains no credentials. Do not send that Site token
to bdashh.com or migrate the cloud task without fresh explicit authorization.

For a future authorized bdashh.com release, worker/index.mjs includes /api/news and
/api/ai/news; runSchedule includes the news task at 7 AM America/Los_Angeles. It uses
the existing provider, daily attempt limits, schedule deduplication and Website
controls gates. Paid AI and daily research remain off in the live deployment. No
production setting, schedule, asset or Worker was changed for this feature. Tests
use injected provider results; no production OpenAI calls are made by checks.

Include news.json in future data exports/migrations without replacing existing
production choices. The browser migration backup includes its current read model.
The full local preview exposes empty News state and blocks every live write.

Each topic targets at least five new articles (up to ten per update). Fewer than
five verified unique new stories produces a partial edition. The store retains
the last 500 URL/headline identities per topic to exclude earlier editions.
Same-day additions may retain that day’s stories. The provider normalizer and
bounded research/output budget support the expanded coverage; existing AI-off
gates and daily attempt limits remain enforced.

## Five-article update — October 31, 2026

ChatGPT Site v62 is published from 3b850829dabb18a96c1d1ffcf534807f345849e0.
The existing daily automation remains enabled at 07:00 America/Los_Angeles; its
News contract is revision 2 and requests at least five fresh articles per selected
topic. Its investment briefing instructions and schedule were preserved exactly.
The revised unattended writer saved five verified articles for each of the five
saved topics: NBA, F1, Premier League, NFL and MLB (25 articles, news revision 4).
Exact API readback matched. The separate dashboard store was unchanged.
Authentication, cross-origin rejection and stale preferences were verified live.

Validation: Site checks passed all 77 tests and the vinext build succeeded. The
complete workspace passed all 116 tests and production preflight; a subsequent
provider coverage regression test also passed in the 15-test research suite. The
production dry-run build prepared 88 assets for release 231bc04719bc6055e05a5ec6.
No assets were uploaded to bdashh.com, no Worker was deployed there, and no GitHub
push or production API/settings change was made. Browser visual verification was
unavailable because the browser runtime could not start in this environment.

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
