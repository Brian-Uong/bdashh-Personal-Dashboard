# Preparing Brian’s Dash for a .com

## Preferred path: custom domain, same Site

Sites currently provides add/list/refresh/remove custom-domain operations. No custom
domain was attached as of October 29, 2026. Brian must select a domain he owns first.
Use the existing project, not a new Site: `appgprj_6ae23020eb70819199a6dbf59b793ff9`.

1. Export the workbook and migration backup from Owner tools. Preserve the current
   source revision and data. Pause editing during the final backup so the independent
   server stores do not change between reads; the backup is not a database transaction.
2. Add the exact chosen hostname through Sites. Use its returned CNAME or apex A
   targets and validation records verbatim; never guess DNS addresses.
3. Set those records at the domain’s DNS provider. Wait for domain and SSL statuses
   to become active. A domain is not ready merely because it was added.
4. Test the new HTTPS host: `/`, `/dashboard/`, hash navigation, local JS/CSS, public
   reads, anonymous write rejection, owner sign-in, and an owner save/readback.
   Confirm the custom host supports the Sites sign-in flow; if it does not, retain
   the original host for owner administration until supported sign-in is verified.
5. Test price refresh, Career hub refresh, address and café search, maps/routes,
   TradingView embeds, record editing/deletion/undo and workbook export.
6. Server records stay with the same Site/R2 binding. Browser localStorage does not
   transfer to another origin: use Restore browser preferences on the new host after
   signing in. This restores the allowlisted local choices, not server data. Save any
   drafts before reloading. Audio and motion preferences are included; temporary
   provider caches, sessions, credentials and cookies are not.
7. Keep the scheduled updater pointed at the already-authorized original Site origin
   initially. Both hosts should read the same store. Verify a scheduled write appears
   on the .com before changing any task destination. Never forward a service token to
   a new hostname merely because a page redirects there.
8. Keep the old host available during rollout. Decide canonical redirects only after
   sign-in, API paths, links and all schedules are verified. A redirect of a token-bearing
   update request must not silently forward its credential to another origin.

## Existing portable pieces

Browser API URLs are relative to the current origin and share bounded request/error
handling. Assets use relative paths. Workbook, records, quote validation and history
are separated from presentation. Source checks reject the old Site hostname in
browser JavaScript/HTML. Browser preference backup uses a strict key allowlist.

## A different hosting provider is a separate migration

A .com address alone does not require moving hosts. If moving away from Sites:

- Supply a compatible Cloudflare Worker runtime and durable R2 `BUCKET`, or implement
  and test a storage adapter with conditional writes. A static upload is insufficient.
- Replace Sites identity with verified authentication. Never trust client-supplied
  `oai-authenticated-*` headers on an ordinary host. Preserve owner-only writes,
  same-origin checks, service authorization and public read behavior.
- Provide secrets through the new host’s secret store. The current Sites dispatch
  token and sign-in routes are not portable to an unrelated service.
- Export and restore the actual server stores (`dashboard.json`, `discovery.json`,
  `research.json`, and portfolio-history records). Preserve record IDs, revisions,
  optimistic concurrency and snapshot timestamps. The backup’s portfolioHistory is
  the consolidated read model; restoring raw R2 history requires the format in
  `lib/portfolio-history.mjs`, not a blind JSON upload. Provider caches can regenerate.
- Provision a supported unattended writer on the new host. ChatGPT schedules do not
  move with a GitHub ZIP; update their authorized destination and verify write/readback.
- Check provider rate limits, usage terms, CORS and embed behavior on the new origin.
  Public-feed access is not a guaranteed service-level agreement.
- Run `npm run check`, build, staging smoke checks, desktop/mobile UI tests, backup
  and rollback rehearsal before switching DNS. Keep the old deployment intact.

## Future update contract

See `AGENTS.md`. Keep API paths same-origin, secrets server-only, provider failures
visible, stable storage keys, and regression tests for edits and refreshes. Update
this document whenever a hosting dependency changes. Do not label the dashboard
fully migrated until the actual target domain and authenticated update flow pass.

FC27 trading was retired at Brian's request after repeat refreshes proved unreliable.
The former tab and standalone page return to the overview; `/api/fc-market` returns
410 and makes no source or storage calls. Old optional `fc-market/v1/` R2 objects are
inactive and need not be migrated. The legacy `brians-dash-fc-trading-v1` browser key
stays on the backup allowlist so existing backups remain compatible. Source history
retains the experiment, but future changes must not re-enable it without Brian's request.
