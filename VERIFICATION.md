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
