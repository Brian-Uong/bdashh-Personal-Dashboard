# Hosted verification

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
