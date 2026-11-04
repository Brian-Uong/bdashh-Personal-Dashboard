# Current release scope — November 4, 2026

Brian explicitly requested the latest website release, matching GitHub source and a resume-ready README. Version 73 is selected. This request supersedes the historical development-only and v57/v66 publication restrictions below for this release. Preserve the current controls theme, private repository, owner authentication, live records, secrets, visibility and AI settings. Future releases still require an explicit request. Never change the separate business project or original Site schedules as a side effect.

# Canonical BDashh development workspace

This is the complete workspace for Brian’s dashboard. It starts from the verified
bdashh.com source package v10 and includes the original Site v59 retirement fixes.
Brian’s October 30 clarification authorizes publication to the ChatGPT-hosted dashboard here only. Deployment to bdashh.com remains unapproved.

- Develop here. Do not use the older Sites-only checkout as the base for releases.
- Do not push to GitHub, deploy either host, upload production assets, alter settings,
  or change schedules until Brian explicitly asks. Prior v57 launch approvals are history.
- Keep Website controls, OpenAI and daily-research switches, Cloudflare owner JWT
  verification, private router, AI gates and both R2 bindings with every release.
- Production choices live in site-settings.json; never replace it with preview defaults.
  Preserve API secrets, saved records, IDs, revisions, and preview/production isolation.
- The default dev command is an isolated UI preview. Its server and disabled controls
  are development tooling only. Never bundle scripts/workspace-server.mjs into the Worker.
- Courtside and FC27 remain retired; do not restore them unless Brian asks.
- Before any authorized release, read docs/WORKSPACE-WORKFLOW.md, retrieve the latest
  GitHub and deployed source, compare against docs/online-source-baseline.json, and
  resolve upstream changes before packaging. Do not promise zero merge conflicts.
- Run npm run check and npm run build. Use the production source, not generated
  preview HTML, for the release. Keep runtime data and credentials out of source exports.

## Historical production constraints (still applicable unless superseded above)

# BDashh publication rules

- This is Brian's personal dashboard at bdashh.com. His future business is separate. On 30 October 2026 he explicitly requested public testing and confirmed "I know this is for testing so its ok to make it public". Public visitors may read his actual saved dashboard; all writes and paid AI controls remain owner-only.
- The owner explicitly selected dashboard version 57, source commit d824a7d2e6477d005b0d3912c363828f1da34aa4, for the website on 30 October 2026. New versions on the original ChatGPT Site must not be imported or published here until he asks. Development work alone does not authorize publishing a new feature version.
- The owner explicitly authorized launching version 57 now and handling API credits later. Do not require funded AI or version 58 reconciliation as launch prerequisites. Keep daily AI flags and cron schedules disabled until activation is authorized and billing works. Preserve honest failure messages and saved results.
- Production may expose only the approved read-only dashboard paths when PUBLIC_READ_ONLY is true. Cloudflare Access protects /owner; verified owner JWTs protect every write and paid AI operation. Preview stays private. Alternate public Workers URLs stay disabled. Never grant owner identity to a public visitor.
- Keep secrets server-side. Preserve existing secret bindings during deploys; never export keys or log provider credentials.
- Preserve user data, record IDs, fractional holdings and conditional writes. Preview and production use separate data buckets. Back up data before migration and do not overwrite owner edits with test fixtures.
- Do not modify the original ChatGPT Site or its schedules as a side effect of this standalone website deployment.
- Check browser/source portability and the relevant tests before publishing. Upload and checksum any changed static asset release before the Worker points to it. Record actual checks in VERIFICATION.md and migration-status.json; never claim unperformed browser or provider checks.
- The authoritative publish policy is in migration-status.json. Later website feature-version changes require the owner's explicit instruction and corresponding policy update.

- On 30 October 2026, after funded verification, Brian requested pausing API credit use while continuing development in ChatGPT. Keep production OPENAI_MODEL blank, both daily AI flags false, and cron triggers empty until he explicitly requests reactivation. Preserve the stored API secret. This later pause supersedes the earlier activation authorization.

- On 30 October 2026 Brian authorized owner-operated Website controls for public/private visibility and OpenAI on/off. Persist these choices in private site-settings.json; authenticated owner changes are explicit authorization. Keep paid AI and daily research off at initial deployment. A passive twice-daily cron may check these settings but must do no AI or quote work while disabled. Preserve current settings across future deployments; never overwrite them with defaults. These controls are an authorized addition to the v57 baseline; do not import newer Site feature versions.

## Current packaging and source handoff rule

After every completed Site version, prepare a versioned release package with
`npm run release:package -- --site-version NUMBER --site-commit FULL_SHA --site-snapshot PATH`.
Read the exact Site source and latest private GitHub release workflow first. Preserve
concurrent UI changes. This development packaging mode does not change deployment
authorization, production settings or data. Include the full standalone source,
compiled Worker, immutable assets, exact Site snapshot, hashes and release instructions.
Brian's standing instruction in the current upstream GitHub workflow authorizes
synchronizing the exact published Site source to its private site-source branch.
Keep main and bdashh.com publication separate and honor the latest explicit scope.

## Hosted API cost preference (November 3, 2026)

Brian requires no paid API use on the ChatGPT-hosted dashboard here. Do not create
or configure an OpenAI key or enable paid calls here based only on a ChatGPT
subscription. A later request must explicitly acknowledge separate API billing.
Public-feed news refresh is independent of paid AI. Preserve the 7 AM ChatGPT task.
