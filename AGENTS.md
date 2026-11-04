# Brian's Dash maintenance rules

Apply these rules to every future dashboard change, including before a .com move.

## Brian's development workflow (October 30, 2026)

- Develop and test all future updates here as local previews.
- Do not push to GitHub, merge with the online dashboard, save/publish a new hosted
  version, deploy, or change live data unless Brian explicitly requests that action.
- GitHub access and production hosting are not prerequisites for preview development.
- Keep the latest working source and a clearly labeled preview available for review.
  Fictional preview data must never appear as a live recommendation.

- Courtside sports betting was scrapped on October 30, 2026. Do not restore or
  continue that feature unless Brian asks for it again.

## Development focus (October 31, 2026)

- Focus checks and fixes on the ChatGPT-hosted dashboard here.
- bdashh.com has its API intentionally turned off while incomplete; this is not a defect.
- Keep changes portable, but do not activate its API, change its settings, push to GitHub, or deploy there as part of development here.

## Two-host workflow

- The ChatGPT-hosted Site is Brian’s development dashboard here. His October 30
  correction authorizes this Site publication only; do not deploy bdashh.com.
- /owner/settings on this Site shows disabled previews. The complete functional
  controls/backend live in /workspace/sites/bdashh-workspace and the private
  Brian-Uong/bdashh-private repository. Use that complete tree for .com releases.
- Preserve its Cloudflare owner JWT authentication, private router, OpenAI and daily
  switches, and site-settings.json when merging shared UI changes. Never replace it
  with this Sites-only checkout. Compare current online source before releases.

## Maintenance

- Keep the existing Site project ID and public audience unless Brian requests a change.
- Read `docs/DOMAIN-MIGRATION.md` before changing hosting, authentication, storage,
  scheduled writers, browser storage keys, or URL construction.
- Prefer attaching a custom domain to this same Site over migrating its backend.
  Do not register a domain, modify DNS, or switch hosts without Brian specifying it.
- Use same-origin `/api/...` URLs via `public/dashboard/api-client.mjs`. Keep
  navigational and asset paths relative; never hardcode the current Site hostname
  into browser code. Third-party provider links remain explicit HTTPS URLs.
- Preserve Sites authentication. Public reads do not permit writes. Every writer
  must enforce owner/service authorization server-side before accessing storage.
  Do not treat identity headers as trusted on a different hosting platform.
- Keep secrets server-side, out of source, prompts, logs, exports and browser code.
- Keep provider calls bounded; respect cooldowns, prevent duplicate refreshes,
  retain valid saved results on failure, and label cached/partial/source failures.
  Never silently retry a non-idempotent save or fabricate prices or research.
- Preserve fractional holdings, average cost, record IDs, saved notes and optimistic
  concurrency. Imported local drafts must not be overwritten by background polling.
- Keep daily tasks compatible with public and private audiences. Routine data updates
  do not republish or change sharing. Keep the approved canonical updater destination
  until a new destination and credential flow have been explicitly verified.
- Preserve browser-storage keys or provide a migration. Extend the migration backup
  whitelist when introducing persistent user preferences; never export credentials.
- Run `npm run check` and a production build. For affected provider features,
  perform one live smoke check and report limits. Use supported browser tooling for
  desktop/mobile UI checks when available; do not claim unperformed verification.
- Update the audit/migration notes when hosting assumptions or tool behavior changes.
  Keep personal backups, secrets, and production data out of the repository.

## Required release package after every version update

Brian requested clean packaging after every version update on October 30, 2026.
After publishing here and verifying it, update the complete canonical workspace and
run its `npm run release:package -- --site-version <number> --site-commit <full SHA>`.
Keep the versioned full-source ZIP, built Worker/assets, checksum manifest, checks
and release instructions together. The Sites-only source is never a .com package.
Preserve concurrent Site edits and production controls. Packaging is authorized;
GitHub pushes, bdashh.com deployments and settings changes still require their
applicable explicit authorization. Consult the latest request before publishing.

## Hosted API cost preference (November 3, 2026)

Brian requires no paid API use on the ChatGPT-hosted dashboard here. Do not create
or configure an OpenAI key or enable paid calls here based only on a ChatGPT
subscription. A later request must explicitly acknowledge separate API billing.
Public-feed news refresh is independent of paid AI. Preserve the 7 AM ChatGPT task.
