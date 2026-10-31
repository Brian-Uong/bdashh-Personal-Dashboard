# Brian's Dash at bdashh.com

Standalone personal dashboard with owner authentication, private R2 storage, website visibility and AI controls. Version 66 is live at https://bdashh.com/dashboard/: News topics, local-event and career search improvements, seamless navigation and matching Website controls.

Develop with `npm run dev` (isolated preview). Validate with `npm run check`. Package each development version with `npm run release:package`; prepare an owner-requested website release with `npm run release:prepare`. Read docs/RELEASE-WORKFLOW.md for GitHub and Cloudflare publication and verification. The two preparation commands do not publish.

The authoritative settings and saved data stay in production storage. AI and daily research remain off until the owner turns them on. Verified publication details are recorded in migration-status.json and docs/release-v66-verification.json. Future releases require a new owner request. GitHub main contains standalone source, and site-source holds the original published Site snapshot.
