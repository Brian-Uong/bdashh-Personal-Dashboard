# Development and release workflow

Work in this complete source tree. It includes the production Cloudflare gateway,
Website controls, server settings, OpenAI research, daily scheduler, and all shared
dashboard UI. The older ChatGPT Site checkout alone is not a valid bdashh.com release.
The user authorized this reconciliation as workspace work only.

The online package was version 10 of BDashh-private-migration.zip. Its recorded Worker
version and deployment matched Cloudflare's active bdashh-live deployment on October
30, 2026. All 154 GitHub files were checked against commit 46720ba51eb4d9cea9281dacc07b7a6fe2895eba; repository documentation updates were incorporated. The original ChatGPT Site v59 contains no additional active UI feature beyond
that baseline: its sports-retirement navigation/API compatibility changes and browser
backup key have been carried forward. Preserve the standalone owner-auth implementation.

## Daily development

Use npm run dev for an isolated full UI preview. It uses an empty workbook and a
simulated owner UI so all tools can be seen. All server mutations return WORKSPACE_ONLY;
no Cloudflare storage, keys, provider calls, or scheduler is connected. Website controls
use the production markup with switches disabled and an explicit preview message.
The production Worker never imports the preview server or generated preview HTML.

Keep live operational choices in site-settings.json. Do not add that file or live
dashboard stores to source. Defaults are not a replacement for the owner's choices.
Turning AI off must block manual and scheduled paid requests and clear daily research.
Public viewing must never grant writes, and unknown identity must fail closed.

## When Brian explicitly requests a release

1. Read the latest GitHub main tree and the current bdashh-live deployment/version.
   GitHub source might have changed since this workspace was prepared. A successful
   comparison against an old archive is not evidence that the current live tree matches.
2. Materialize the full latest online source and run npm run compare:online -- <directory>.
   The command compares baseline, workspace and incoming hashes without writing files.
   It exits nonzero for incoming changes missing locally and overlapping edits, including
   deletions. Merge those changes deliberately and rerun relevant checks.
3. Keep the online owner controls, authentication, scheduler, private assets gateway,
   and environment configuration. Never replace the production tree wholesale with an
   older Site export. Preserve current site-settings.json, secrets, data and revisions.
4. Record the fresh baseline and explicit release request in workspace-status.json,
   then update migration-status.json for the actual release. Local work is not approval.
   Refresh stored baseline hashes only after reconciliation; do not mask conflicts.
5. Run checks/build, upload and verify the immutable static-asset release, and only then
   deploy the matching Worker when authorized. Preserve Access and separate preview data.
   Recheck the online version immediately before publishing to catch concurrent changes.
6. Verify signed-out behavior, owner login, data reads and settings persistence without
   toggling paid AI or changing visibility just for a test. Update actual verification.

These checks detect drift; they cannot guarantee that future edits never conflict.
Any GitHub push and any live deployment require the requested scope to be explicit.

## Package every completed version

After each published Site version, export its exact clean source with source:export,
reconcile shared changes into this complete tree, and record the Site version/SHA
in workspace-status.json. Run release:package with --site-version, --site-commit
and --site-snapshot. This development mode prepares a verified ZIP even when a
.com release has not been requested; it never sets production approval fields.
The normal release:prepare path retains its stale-source/authorization guard.

The ZIP contains separate standalone and Site source folders, compiled Worker,
static assets, machine-readable upload packets, README and per-file SHA-256 hashes.
Every file is read back from the ZIP and checked. Dependencies, runtime stores,
settings and credentials are excluded. Keep each version's package separate.
VALIDATION.json records the checks and dry-run build for the exact packaged source,
including timestamps and explicit verification limits. Regenerate the package after
any source edit; an older validation report does not cover new changes. Packaging is
part of completing each update, not an unattended background process. Provide the
downloadable ZIP at handoff; publishing to bdashh.com or GitHub follows Brian's
explicitly requested scope.
Read the current private GitHub release workflow for the standing site-source
handoff; website publication and main synchronization remain a distinct release.
