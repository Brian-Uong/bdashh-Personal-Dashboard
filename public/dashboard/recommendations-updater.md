# Brian’s Dash recommendation journal — revision 2

Applies to the existing daily 7 AM America/Los_Angeles task. Use the current Site
origin and both service headers obtained from get_site for the verified project.
No paid API calls, API-key setup, trades, messages, GitHub or bdashh.com updates.
Do not change sharing or any user settings. Routine delivery stays dashboard-only.

## Research and eligibility

At the start read /api/sync and /api/recommendations; refresh existing recommendation
prices BEFORE recording the new edition so the cooldown does not postpone older
checks. Preserve every historical
record. If today's Pacific-date edition already exists, its picks/ranking/thesis
are locked: keep those picks in the journal and refresh prices, never replace a
loser with another candidate or backdate a pick. Otherwise choose THREE ranked
individual USD-listed stocks outside the latest positive-share holdings, excluding
alternate tickers/share classes of held companies. No ETFs, funds or cryptocurrency.
Re-read holdings immediately before saving. Aim for liquid established companies,
with a 1–3 month research horizon consistent with Brian’s shorter-than-one-year
investment horizon. A daily recommendation is not an instruction to day trade.

Compare at least six eligible candidates when evidence allows. Assess:
1. Verified fresh material catalyst and why it matters now.
2. Earnings quality, cash generation and balance-sheet resilience.
3. Valuation relative to an explicitly named earnings/cash-flow measure and peers
   when verified. Distinguish trailing GAAP, forward adjusted and non-GAAP measures.
   State unavailable rather than guessing a multiple or calling an unpriced stock cheap.
4. Downside risk, thesis invalidation and catalyst timing within the horizon.
5. Liquidity and added sector/factor concentration versus the actual portfolio.
Prefer distinct drivers across the three. Disclose correlated AI/semiconductor
exposure when evidence makes more than one such name preferable. Do not select
merely because the price fell. The first card is the strongest research judgment,
not a promise of the day's highest return. Never manufacture probabilities, price
targets or expected gains. Review the journal's observations to identify recurring
mistakes without treating a small sample, mixed horizons or repeated tickers as
proof that a selection rule works.

Use original company releases, regulatory filings and reliable original reporting.
Each pick needs at least one directly supporting source published within the last
48 hours. Verify original dates, not crawl/repost dates. Exact timestamps are best;
a date-only source is usable only when the whole possible publication day is within
the cutoff. Older sources may support labeled background analysis. Never invent a
third pick: save fewer with a specific reason after actually comparing candidates.
On weekends/holidays maintain research freshness and mark closed-market quote
availability honestly. Do not relabel the prior close as a 7 AM trade.

## Save before the other briefing sections

POST /api/recommendations with this JSON (up to three picks):
{
 "action":"record", "date":"YYYY-MM-DD in Pacific time",
 "comparison":"Short factual comparison of candidates reviewed, reasons selected/rejected and concentration tradeoff.",
 "reason":"Required if fewer than three verified picks; otherwise empty",
 "picks":[{
  "ticker":"TICKER","company":"Company name","sector":"Sector",
  "thesis":"30–45 original words; identify the investment case as research judgment",
  "catalyst":"Concrete catalyst and timing","valuation":"Verified measure or explicitly unavailable",
  "risk":"Main downside risks","invalidation":"What would undermine the thesis",
  "horizon":"1–3 months",
  "sources":[{"title":"Source title","url":"Exact verified HTTPS URL","publishedAt":"Verified original ISO timestamp or YYYY-MM-DD"}]
 }]
}
Do not submit prices, entry dates, gains or fabricated 7 AM values. The server sets
recordedAt and fetches its own quotes. It saves original picks before source checks,
then attempts exact/nearest-prior minute references at 7 AM PT and latest quotes.
The 7 AM target follows Pacific daylight saving time. If the source cannot supply
that minute, the reference stays unavailable. For late publications the earlier
7 AM reference is context only: performance uses the first fresh captured quote
following publication, never a retrospective favorable starting point. On-time
picks use the verified 7 AM reference when available. Missing entries stay pending.
An existing AMAT/other idea from today's saved briefing can retain original briefing
provenance; the tracker still does not invent an entry price or backdate tracking.

Read /api/recommendations back and verify each date/ticker, immutable thesis,
recordedAt, source, 7 AM reference (or honest missing status) and entry quote.
If a timeout occurs, read before retrying: recording may have succeeded. A repeat
with the same date/tickers returns the original edition without rewriting it.
Conflicting daily picks are rejected. Report any real failure; never clear history.

POST {"action":"refresh"} to /api/recommendations to update older suggestions each
run. The endpoint checks up to 20 unique symbols, least recently checked first,
with bounded concurrency and provider cooldowns; lastRefresh.remainingTickers tells
you how many selected symbols remain. Keep additional batches bounded (at most
three per run, honoring the one-minute cooldown); don't busy-wait or hammer sources.
Partial source failures retain saved prices. Do not claim unrefreshed historical
quotes are current. No records are deleted when a stock later joins the portfolio.

## Briefing presentation

The journal's three cards are the prominent recommendations in Investments.
Keep the existing separate news briefing concise: optional portfolio snapshot and
up to five genuinely fresh market/holdings
news cards. The detailed rationale, valuation, risks and selection comparison live
in the journal only. Do not include stock picks, recommendation lines, rankings or
recommendation links in briefing.text, briefing.items or briefing.sources; the
overview and full daily briefing contain market/holdings news only. Retain the existing strict
48-hour news filter, source citations, skipped no-news holdings and <=250-word
briefing.text limit. Save through /api/sync with only briefing; preserve holdings,
quantities, costs, quotes, notes and all unrelated data. Regenerating the news
briefing must not alter any locked journal picks. Read the briefing back to confirm.

Do the existing News, Career and Local Events work independently; a category failure
must not prevent other updates. Keep the existing schedule and dashboard-only
routine delivery. This replaces all former one-Stock-Pick-of-the-Day instructions.
