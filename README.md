# BDashh — Brian's personal dashboard

Standalone source for **https://bdashh.com/dashboard/**, hosted on Brian's Cloudflare account. This private repository is separate from the original ChatGPT Site. Brian's future dashboard business is a separate project.

**Approved dashboard baseline: version 57**, original source commit `d824a7d2e6477d005b0d3912c363828f1da34aa4`, plus the explicitly requested visibility and AI controls. Do not import newer Site versions or publish new features until Brian asks.

## Website controls

Open **https://bdashh.com/owner/settings**, or **Owner tools → Website controls**, and sign in as the configured owner using the Cloudflare email code.

| Control | Behavior |
| --- | --- |
| Public website | On: visitors can read the actual saved dashboard. Off: owner sign-in required. |
| OpenAI API | On: authenticated owner research may use credits. Off: no new manual or scheduled AI calls. A running call may finish. |
| Daily research | Separate opt-in for news and career research at 7 AM America/Los_Angeles. Turning OpenAI off also turns this off. |

Settings save immediately to private R2 `site-settings.json`. **Preserve this object across deployments.** Environment variables are fallback settings. Last checked on 30 October 2026: public viewing on, OpenAI off, daily research off, revision 1. This is a snapshot; the owner page shows the current state.

The stored OpenAI secret remains server-side. Paid research was successfully tested after funding, then paused at Brian's request. Turning AI on does not itself run research or resume the daily schedule.

## Hosting and access

| Resource | Production | Preview |
| --- | --- | --- |
| Worker | `bdashh-live` | `bdashh-preview` |
| Host | `bdashh.com` | `preview.bdashh.com` |
| Data bucket | `bdashh-private-data` | `bdashh-private-preview-data` |
| Visibility | Owner-controlled | Private |
| OpenAI secret | Preserved | Not configured |
| Scheduled trigger | `0 14,15 * * *`; skips paid work while disabled | None |

Cloudflare Access protects `/owner` and its settings page. The Worker verifies the owner's JWT signature, issuer, audience, expiry and email for protected reads and every write or paid operation. Mutations require the same origin. Public viewing never grants editing access. Public workers.dev and version-preview URLs stay disabled.

Wix remains the registrar; Cloudflare serves DNS and the website. `bdashh-www` redirects GET/HEAD to the canonical host and has no storage or credentials. The legacy `bdashh-private` Worker is unrouted. Preview uses isolated data; its deployed version predates the owner-controls addition.

## Repository and release workflow

Repository: **https://github.com/Brian-Uong/bdashh-private**. GitHub app installation `176991194` grants selected-repository access. The earlier 404 occurred while account authorization existed without an accessible app installation. Private-repository read/write access was confirmed on 30 October 2026.

**Saving code to GitHub does not publish the website.** No deployment workflow is included, and production has no Cloudflare build trigger connected to this repository. Keep releases manual unless Brian explicitly requests otherwise.

1. Make and test changes in a branch or working copy.
2. Save reviewed source to this private repository.
3. Publish to bdashh.com only after Brian explicitly requests the release.
4. For changed static files, upload and verify the immutable R2 asset release before deploying the Worker that references it.
5. Preserve production data, secrets and current website controls; record the actual release and verification.

The original ChatGPT Site and its schedules remain independent. This repository contains the standalone application, not later original-Site versions. Courtside is excluded; retired FC functionality stays retired.

## Local checks and build

With Node.js 22.13+ and npm available:

```sh
npm install
npm run check
npm run build
```

`check` validates browser syntax, imports, assets, portability, existing tests and deployment configuration. `build` prepares the asset manifest and performs a Wrangler dry run; it does not publish. Wrangler is pinned to 4.92.0. The current workspace uses Node 24 and an already-installed copy of that Wrangler version.

For an explicitly approved release, `npm run deploy:preview` targets isolated preview and `npm run deploy` targets production. These commands do not upload static assets. Preflight verifies the approved version, recorded asset release, migration/access evidence and release authorization; it does not replace review of requested changes.

Assets are served through the Worker from private `bdashh-private-assets`. Verified v57 release: `671c30ec3423cb541805ecf8`, 83 files, 1,919,910 bytes. Keep generated `worker/assets-manifest.mjs` in source control. `.gitattributes` preserves exact line endings so a checkout retains the verified asset hashes.

## Data and credentials

Saved data lives in private R2: `dashboard.json`, `discovery.json`, `research.json`, `portfolio-history-v1.json`, plus website settings and operational objects. Source control is not a live-data backup. Local snapshots in `private-data/`, secrets, environment files, dependencies and generated build output are excluded.

Do not copy OpenAI keys or Cloudflare credentials into this repository. Existing secrets must survive deployment without being exported. Code rollback does not undo data changes; back up data before migrations. Browser-local preferences and drafts are specific to their original browser and hostname.

Standalone email, calendar and brokerage integrations need their own authorized connections; ChatGPT connections do not automatically transfer.

## Verification and history

See `VERIFICATION.md` for chronological checks and limitations, and `migration-status.json` for deployment IDs and release policy. Later entries supersede earlier launch, billing and access states.

The owner-controls release passed 100 automated tests, a Worker dry-run build and browser UI fixture checks. Live anonymous checks verified public reads, rejected settings writes, and owner sign-in protection. A live authenticated settings save has not yet been exercised by the assistant. No paid AI call is needed for GitHub synchronization.
