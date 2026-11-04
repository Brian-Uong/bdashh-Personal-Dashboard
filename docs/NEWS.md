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
