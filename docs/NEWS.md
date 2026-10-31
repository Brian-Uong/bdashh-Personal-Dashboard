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
