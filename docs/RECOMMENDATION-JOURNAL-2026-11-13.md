# Recommendation journal — November 13, 2026

Investments now keeps a permanent, dated journal of three researched stock ideas.
The independent R2 object recommendations-v1.json contains original editions,
research fields, server-recorded publication time, immutable 7 AM Pacific reference
and tracking-entry quotes, and refreshable latest quotes. Same-date retries are
idempotent; alternate tickers cannot replace the recorded edition. Original picks
are saved before source checks so a provider outage cannot erase a losing pick.
Holdings and their quote/portfolio history stores are never mutated by this writer.

7 AM references come from independently verified minute observations at or within
the minute before 7 AM Pacific, with DST resolved through the corresponding Eastern
10 AM. Prices are never backdated or estimated. For a pick added after 7 AM, return
tracking begins with the first fresh captured quote following publication; the
7 AM observation is context, not evidence of an earlier prediction. Missing prices
remain pending. Existing same-day briefing provenance is retained where identifiable.

Manual and scheduled refresh use the same authenticated endpoint, conditional writes,
a 90-second lease, one-minute reuse, four workers, at most 20 unique symbols per
batch, oldest-check ordering and provider cooldowns. Failed sources retain marks.
Older records remain indefinitely, including after purchase. UI reports quote times,
late publication, stale prices, per-share/percentage changes and unweighted aggregates.
These are paper price returns without dividends, fees, taxes or split adjustment,
not executed investment profits. Repeated tickers remain separate dated observations.
The list is searchable and paged in the browser; CSV and migration backup include
all records. No new localStorage key is introduced.

The public read / owner-or-service write model is unchanged. The new service writer
contract is /dashboard/recommendations-updater.md, revision 1. The existing 7 AM
ChatGPT automation must read it, refresh existing picks before recording the new
three, and preserve unrelated News/Career/Events tasks and dashboard-only delivery.
The gated independent AI path has the same three-candidate research schema/policy
and persists returned recommendations through the same ledger. No paid calls were
activated or needed. bdashh.com and GitHub remain unchanged; standalone packaging
retains the private router and owner JWT checks and registers the new route there.

Selection policy compares at least six eligible candidates when supported, excludes
held companies/share classes, ETFs and crypto, and records verified fresh catalysts,
earnings/cash-flow quality, valuation basis, concentration, risks, invalidation and
1–3 month horizon. Fewer than three require an explicit evidence-shortfall reason.
No guaranteed-profit language, invented targets or forced rebound theses.
