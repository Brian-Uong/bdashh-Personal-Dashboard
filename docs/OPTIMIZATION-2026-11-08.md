# Dashboard refinement — November 8, 2026 Pacific

## Comparison and scope

Freshly compared the original Site v73 (7c0ac4e8d71082ed4af24325b68353b1385cd9a3)
with GitHub main 69a630159611e74860f18b0379cc49fa084931bf in
Brian-Uong/bdashh-Personal-Dashboard. The controls stylesheet was already identical
(blob 0f67b133bb1ae0439d19209bcc3d9a2289a594d1). The online controls template was
1bc5af7fc8ad244c06bd0ebb32656fa79076396c. The difference was intentionally disabled
Site controls, rather than an old theme or missing online switch.

Kept the online cards, styling and all three control IDs. Added a clearly labeled
ChatGPT context card, separate online preview heading, useful news/briefing links,
and an explicit external link to the real owner controls. Preview switches do not
read, simulate, or change live settings. The separate 7 AM Pacific ChatGPT task is
explained without claiming its current run succeeded. Unconfigured paid-AI status
now explains the available ChatGPT and direct-source options.

## Usability fixes

- Tab clicks now create browser history; Back/Forward restore the selected view.
  Duplicate clicks do not add entries. Malformed and retired links recover to
  Overview; career and map legacy links remain supported.
- Skip to content retains the active view and URL, so it does not leave a stray
  anchor entry in tab history.
- Saved briefings show Today’s briefing, Previous briefing / awaiting today’s
  update, or an unknown-date warning using Pacific calendar dates. A future
  timestamp is not presented as current. Older reports and sources are preserved.
- Removed repeated Application Tracker introductory text.

No API provider integration, authentication, sharing, data schema, browser-storage
key, schedule, production setting or paid request was changed. Online source is
retained in the complete portable package. This is not a bdashh.com deployment.

## Checks

The Site regression suite and production build pass. Desktop browser checks cover
all seven main views, Applications, Back/Forward, skip-to-content, and the controls
page. The local preview has isolated empty data and anonymous read-only access;
it does not validate an owner session or invoke a paid AI provider. Existing
freshness, deduplication, cooldown, writer authorization, saved-data retention,
optimistic concurrency and draft protection tests remain in the full suite.
Responsive controls CSS is retained; no mobile viewport emulation is claimed.
Hosted publication/readback and standalone package checks are recorded with the
release evidence, separately from this source audit.

## Suggested next additions, not implemented

1. **Updates & health** — last successful briefing, news topic check, career search,
   event search and quote check; distinguish no new results, source failures and
   stale data. Read real per-feature timestamps, never infer success from the clock.
   Add run controls only for available, authorized free refreshes.
2. **Action inbox** — one queue for application follow-ups, networking reminders,
   planner tasks and approaching events. Link back to the original records to
   avoid a second, conflicting task database. Start as an Overview panel.
3. **Goals & projects** — weekly milestones for job search and personal projects,
   linked to existing activities, with progress derived from recorded completions.

Build Updates & health first: it directly answers whether a daily update arrived.
Avoid adding more navigation until each new view has a distinct daily purpose.
