# Investments visual and interaction refinement — November 13, 2026

Company identity uses verified, bundled company assets across recommendations,
holdings, allocation legends, company-news cards and the stock explorer. Each
asset has provenance in public/dashboard/company-logos/sources.json. Logos are
decorative beside explicit ticker/company text. Fixed dimensions, lazy loading,
async decoding and a local initials fallback avoid broken-image layouts. There
are no logo-service subscriptions or per-view third-party logo requests.

Investment section shortcuts use buttons and in-page focus/scroll; they do not
change the dashboard section hash. Reduced-motion preferences are respected.
Holdings expose quote timestamps/source and a separate change versus prior close;
this is never conflated with the position's gain since purchase or called a live
tick. Missing previous closes produce no invented change. The new sort uses this
same measure. Search and sort are session-only and survive saved-data redraws.

Recommendation rendering skips identical markup and retains open research
disclosures, focused search and its caret when prices change. Passive saved-data
reads are bounded to once a minute while the Investments view is active and the
user is not reading an expanded section or editing. This does not call a market
provider or an AI service. Initial loading no longer shows a sample research stock.

No holdings, recommendation entries, source research, news, schedules, credentials
or audience settings are changed. Company marks are identifiers, not endorsements.
All refresh writers, auth checks and fixed recommendation baselines are retained.
The standalone package keeps owner controls and authentication. No GitHub update,
bdashh.com deployment or paid API activation is part of this work.
