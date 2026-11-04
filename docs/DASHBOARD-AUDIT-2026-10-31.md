# Brian’s Dash refinements — October 31, 2026

This change set targets the ChatGPT-hosted development dashboard. bdashh.com’s API pause is intentional. No .com API activation, settings change, deployment or GitHub push is part of this work. Shared fixes are mirrored into the complete portable workspace, preserving its separate authentication, persistent controls and scheduler.

## Corrections

- Employer refresh updates current provider facts while preserving saved IDs, personal notes and curated assessments. Detailed vacancies are rechecked against current role/location preferences.
- Career source scans reject results when preferences change during collection or a save retry. Career polling pauses in hidden sections and during AI work; overlapping panel refreshes are prevented.
- News top-ups retain earlier verified articles from the same day, up to ten. Prior-day articles cannot fill the next edition. Polling pauses while reading/editing, rechecks activity after network responses, and avoids rebuilding unchanged cards.
- Malformed AI career responses fail without replacing saved leads. All-failed news research reports failure; mixed coverage reports partial with counts.
- The hosted Site now has authenticated on-demand routes for portfolio briefings, career research and news. Owner tools expose all three. Missing configuration is explicit; no automatic paid requests run on page load. Attempts have per-task daily caps, duplicate-request locks and source validation. The existing morning ChatGPT automation is unchanged.
- Stock history now tries independent Nasdaq data when Yahoo is unavailable. Provider-specific cooldowns, cache reuse, stale labels, symbol/currency validation and the SPCX identity guard remain. Daily closing data is explicitly labeled unadjusted; intraday data identifies extended-hours coverage. The existing TradingView UI remains available.
- Corona calendars have one fixed official GrowthZone alternate when the primary is unavailable. The collector records the actual source used, keeps date/venue validation and deduplication, and does not retry around HTTP 429 limits.
- Authorization regression checks include events and every hosted AI writer. Owner/service authorization happens before provider requests.

## Evidence

The hosted source passes 120 automated tests, browser-module syntax checks, import checks and local-asset checks. The complete portable source receives its own check/build in the versioned release package. Existing coverage includes fractional holdings, record editing/deletion/undo, optimistic concurrency, saved-data retention, API-off gates, owner verification, daylight-saving schedules and packaging safeguards.

Read-only live provider checks returned 960 GOOGL intraday samples and 22 daily samples from Nasdaq. With primary Corona requests deliberately simulated as 403 in the local test harness, the actual alternate calendars returned six Chamber and five community matches; UCR returned eight, with 16 distinct regional events after deduplication. These local checks do not by themselves establish Worker access. Hosted post-publication checks are recorded separately in the release package.

Earlier hosted checks covered dashboard/data/news/event reads, address and café searches, 31 referenced assets and retired endpoint responses. Direct career collection reached all five sources with 18 job matches and ten people entries. These are sourced candidates for review, not guarantees of eligibility.

## Remaining verification limits

- On-demand AI needs this Site’s own secure OpenAI connection. Source integration and failure/limit behavior are tested, but a real paid research run cannot be verified while its key/model are absent. The OpenAI Developers connection was offered for secure setup; do not paste keys into chat or copy credentials from bdashh.com.
- Supported browser startup and the managed preview relay are unavailable in this environment. Desktop/mobile interactions, owner login in a browser, third-party chart/map rendering and measured browser performance are unverified. No Core Web Vitals or zero-defect claim is made.
- Third-party feeds can still become unavailable or rate-limited; failures and cached/partial coverage must stay visible. Calendar, email and brokerage synchronization are not connected features; manual planner/holdings workflows remain supported.

## Handoff

Use the versioned package’s exact Site source snapshot for the dashboard here and its complete standalone tree for a future separate-host release. Build output, checksums, validation and release instructions are included. Publishing here does not authorize a .com deployment. Preserve production settings, secrets, data and newer source changes during any future reconciliation.

## Live-check follow-up

Version 67 verified the Nasdaq daily and intraday fallback on the hosted Worker. Its Corona Chamber calendars still returned 403 even at the official alternate host, so a separate City of Corona public-calendar feed was added for independent city coverage. Chamber failures remain visible. Nasdaq intraday x-values represent Eastern wall time; labels are now checked and converted to UTC using the applicable daylight-saving offset, with a new cache namespace. Summer/winter timestamp regression checks cover this provider quirk.
