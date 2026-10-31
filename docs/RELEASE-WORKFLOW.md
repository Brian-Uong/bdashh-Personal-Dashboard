# Shared source and website releases

Brian wants routine updates to be easy to publish, with the exact released source saved in private GitHub. A request to update bdashh.com authorizes completing its Cloudflare release and GitHub synchronization together. Development edits alone still do not authorize a production release.

## The two source branches

- `site-source`: the latest source from the Brian's Dash development Site, with its exact Site version and source commit recorded in `source-release.json`. Populate and verify it from the cloud development checkout after each published dashboard update. This branch is a source handoff; it does not deploy bdashh.com.
- `main`: the independently hosted application, including Cloudflare owner authentication, private R2 storage, server-side AI and persistent website controls. Every bdashh.com release must have matching source here.

**Bootstrap status:** the `site-source` branch has not yet been populated. Version 65 is published on the development Site, but its source remains in that Site's cloud repository. This local Windows session cannot resolve the Site Git host. Conversation-history access supplies context, not that remote filesystem. Do the first source handoff from the existing cloud development chat where the files are already available; do not ask Brian to shuttle ZIPs between chats.

Original Site: `appgprj_6ae23020eb70819199a6dbf59b793ff9`. Repository: `Brian-Uong/bdashh-private`. Keep the separate pdashboards business project out of this workflow.

## After a dashboard update in the cloud development chat

1. Read this repository's current `AGENTS.md` and this workflow. Use Sites to identify the saved version and exact source commit. Read the actual source; do not rebuild features from chat summaries.
2. Fetch `scripts/export-source-snapshot.mjs` and `scripts/release-files.mjs` from this repository into a helper directory. They need only Node and Git; keep their relative layout together.
3. Run against the clean source checkout that was just published:

   ```sh
   node /absolute/helpers/export-source-snapshot.mjs --source /absolute/site-checkout --version 65 --commit fe20b5651a2e1b60136346a2c63b19ccfb19cf7f --output /absolute/source-handoff
   ```

   Replace version and commit with the current Sites result. The command checks the Site identity, exact Git commit and clean tracked files; excludes saved data, environment files, dependencies and build output; checks common credential patterns; and writes an ASCII JSON packet with hashes. It does not upload or publish. Review the export; a pattern scan is not a guarantee that arbitrary sensitive content is absent.

4. Use the connected GitHub tools to synchronize the packet to `site-source`, retaining existing branch history. If absent, create the branch from a verified existing commit, then replace that branch's tree with the exact exported source plus `source-release.json` (the packet's `source` object). Do not mix the original Site and standalone runtime in one branch. Confirm the repository is private first.
5. For text files, use Git tree entries with `content`; for binary files, create a base64 blob and use its returned SHA. Compare blob hashes with the remote tree and send only changed content. Commit, update the ref with the expected old head, then verify every remote path/hash and the recorded version. On a concurrent change, read and reconcile the new head; never force past another update.
6. Report source synchronization only after readback succeeds. If Brian also requested a bdashh.com release, continue below in the same cloud workspace. Do not modify Site schedules or its sharing as a side effect.

## Prepare an explicitly requested bdashh.com release

1. Read the latest `site-source/source-release.json`, branch head, standalone `main` and live Cloudflare settings. Use native GitHub reads even when the local machine cannot reach the Site Git host. Once bootstrap is complete, a ZIP transfer is unnecessary.
2. Reconcile the original source changes into the standalone checkout. Keep the independent authentication and storage adapters. Check every new API route, browser import and scheduled feature; do not blindly replace the standalone Worker with the ChatGPT Site Worker. Keep existing production data and website settings. Source updates do not automatically migrate saved data between the two sites.
3. Record the actual reconciled source commit/version in `migration-status.json`, including `requested_release.source_retrieved` and `standalone_adaptation_completed`. Update `release_policy` only after inspecting the source. These fields are evidence, not switches to set merely to bypass a check.
4. Run `npm run release:prepare`. It checks source provenance, runs the tests, regenerates and verifies static asset hashes, performs a Worker dry run, and creates:

   - `github-source.json`: exact standalone files with Git blob hashes.
   - `assets.json`: immutable R2 asset contents, sizes and hashes.
   - `worker.json`: the compiled Worker and its checksum.
   - `release-plan.json`: version, paths, release IDs and required verification.

   Packets also have 48,000-character ASCII chunks for environments with tool-output limits. No remote mutation occurs in preparation. Use `--wrangler /absolute/path/to/wrangler.js` only if the pinned local dependency must be located explicitly.

## Publish using the connected GitHub and Cloudflare tools

1. Reconfirm the owner-requested release, private GitHub access, current branch heads, production deployment, bindings and private `site-settings.json`. Back up the current deployment metadata and relevant data before any schema migration. Preserve all secret bindings without reading their values.
2. Sync the prepared standalone source to GitHub and verify remote blob hashes. Keep that source commit as the release reference. A partial GitHub upload is not a completed release.
3. Upload immutable assets to `bdashh-private-assets` under their packet keys. Verify every size and checksum before pointing the Worker at the new asset release. Reuse already verified identical objects and retain old releases for rollback.
4. Deploy the prepared Worker to `bdashh-live`, preserving the current bindings and secret bindings. Do not overwrite the private settings object or change the owner's AI, daily-research or visibility choices. No paid AI test is required when AI is off.
5. Read back the production deployment and perform the appropriate public/private, asset, API and owner-route smoke checks. If uncertain or unsuccessful, report the partial state and retain the previous release for recovery; do not claim success from an upload response alone.
6. Save the actual Site source version, GitHub source commit, asset release, Worker version/deployment, checks and limitations to `migration-status.json` and `VERIFICATION.md`, then sync those records to GitHub. Verify the final head and source hashes. Mark the requested release completed only after both services are verified.

This workflow uses existing connected tools. It does not need a new public deployment endpoint, an API key in browser code, automatic deployment of every edit, or API spending while the master AI control is off. The scripts prepare releases; they are not an installed unattended cross-chat automation.
