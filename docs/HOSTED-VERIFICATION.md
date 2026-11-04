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

The v70 check reached the adapter but failed. Bounded diagnostics in v71 showed Google RSS returning HTTP 503 for all five selected topics. Version 72 adds the independent Bing News RSS fallback; it still enforces the 48-hour date window, publisher attribution, safe HTTPS destinations, bounded responses, no followed redirects, and retention of saved news when both sources fail. No paid provider is called.

## Final live result — version 72

The authenticated hosted refresh succeeded on November 3, 2026: five topics
checked, 23 new articles persisted (news revision 14). The immediate repeat
returned cached without another source check. Topics, holdings and all unrelated
dashboard data matched their pre-check values exactly. Paid AI remains
unconfigured. The machine-readable evidence is hosted-news-verification-v72.json.

Checks passed: 132 Site tests, 163 portable-source tests, the actual Workers
runtime fallback/readback/cooldown regression, and the Site build. The access
verification is no longer blocked.
