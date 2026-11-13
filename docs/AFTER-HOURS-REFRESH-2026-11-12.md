# Investment refresh correction — November 12, 2026 Pacific

## Observed failure

The hosted refresh at 2026-11-13T02:54:09.947Z rejected all 13 current holdings as
older than saved afternoon quotes. Nasdaq's /info endpoint had switched to Closed
and supplied a calendar date. Date.parse treated that value as midnight UTC,
which incorrectly ordered the same-day closing quote before the intraday price.
The first parseable provider result stopped lookup, so no newer alternative was
attempted. The Yahoo fallback requested only daily regular-session data.

## Correction

- Compare date-only closes by Eastern trading date and session, retaining provider
  precision. A closing price supersedes a same-day regular intraday observation;
  a newer saved after-hours observation is not overwritten by the regular close.
- On closed Nasdaq sessions, check the same symbol's extended-trading endpoint.
  Bind it to the validated /info symbol, USD asset and company identity. Extract
  a dated, timed trade, not the next-resume date or an invented closing timestamp.
  Consider at most 100 rows and reject malformed/future timestamps and prices.
- Yahoo fallback requests one-minute samples with includePrePost=true. Select the
  latest valid sample or timestamped pre/post metadata, retaining session labels.
  An older primary quote also triggers fallback instead of ending the search.
- If a valid source has no newer quote, mark the holding as checked/retained,
  separately from actual provider failure. Keep saved prices on real failures.
  Show session, last check time and source notes in the holding cards.
- Preserve four-worker concurrency, provider-specific rate-limit backoff, 45-second
  reuse, conditional saves and the refresh lease. Bound source work to 70 seconds
  so it fits within the existing 90-second lease and 95-second browser timeout.
- The refresh action remains manual and available at any time. No market-open gate
  was added. It checks the latest data providers make available; it does not imply
  an active market, a new trade on every click, or a continuous overnight feed.

## Validation and scope

Regression cases cover same-day date precision, UTC-midnight/Eastern-day ordering,
regular/pre/post sessions, completed sessions and weekends, empty and malformed
extended feeds, future points, fallback/cooldowns, elapsed request budgets, genuine
outages, no-newer-data retention, 45-second reuse, and concurrent saved edits.
A live public Nasdaq lookup after the session ended returned the timestamped final
extended-hours trade. Hosted refresh and readback are performed after publication
and recorded in the release evidence. No paid AI request is part of this change.

No holding quantities, purchase costs, saved notes, briefing content, authentication,
sharing, schedule, or bdashh.com settings are changed by the implementation.
Normal authorized price refresh updates quote values, the workbook's Holdings
view and portfolio history. GitHub updates remain confined to Move Dashboard
Online, when Brian requests a bdashh.com release. This chat prepares the portable
package only; the separate website runtime and owner controls are preserved.
