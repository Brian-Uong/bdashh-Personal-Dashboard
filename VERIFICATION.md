# Version 88 release verification — November 25, 2026

Version 88 is live at https://bdashh.com/dashboard/#overview. Both GitHub branches are synchronized to the exact published Site v88 source and the reconciled standalone release.

- 307 automated tests and the Worker build passed.
- All 135 immutable asset sizes and SHA-256 hashes were verified after upload.
- The deployed Worker matches the compiled build: `90988814d5db01e35736ec6f6692e3cd01e90ad484bd07c7e792d9ccd5b3ff39`.
- 19 production HTTP checks passed, including the dashboard, new feature modules, all five cyan favicon files, read-only access, AI-off status, and protected owner settings.
- Dashboard HTML exactly matches the prepared source plus the existing owner-link/Website-controls adaptation.
- Desktop browser inspection confirmed the glass design, career navigation, career-year selector, and read-only view.
- Worker configuration fingerprints match before and after deployment. Saved data/settings were not written; secrets and schedules were retained. The original hosted Site was not changed.
- Verified 281 standalone source files and 369 exact development snapshot files before deployment. This evidence-only follow-up adds one public report.

Authenticated owner saves, live provider refreshes, paid AI calls and mobile browser checks were not performed. Production records remain independent; no development data was imported.

Release source: `eeef0efa9d2d777eb4beb42b813f42fa84ece5b4`. Exact Site snapshot: `b861bc688d888259e0a82a05183627589c9dcc8c`.
See [the full verification record](docs/release-v88-production-verification.json).

---

# November 19, 2026 — online favicon-only release

Published the cyan-on-navy pixel B/D icon to bdashh.com. All 207 checks passed; 128 immutable assets and production icon bytes were checksum verified. Worker configuration was preserved. See [the complete evidence](docs/bdashh-online-001-evidence.md) for routes, formats, hashes, browser observations and verification limits.

# Version 80 release verification — November 13, 2026

Version 80 is live on bdashh.com. Both GitHub source branches are synchronized.

- All 207 automated tests and the Worker build passed.
- Verified 730 original package checksums, 124 uploaded assets, 255 standalone source files and 344 development source files.
- The deployed Worker matches the tested build.
- All 11 live HTTP checks passed: public reads, owner-only writes, protected controls and disabled AI.
- Desktop browser checks verified Overview, the recommendation journal and all 11 holding logos.
- Existing saved data, settings and schedules were preserved. No paid AI call or data migration occurred.

Live authenticated owner saves and mobile visual checks were not performed. The production journal starts empty because development records were not imported.

See [the public verification record](docs/release-v80-production-verification.json) for the release evidence. Historical release records remain in Git history. Public summaries omit account and access identifiers.
