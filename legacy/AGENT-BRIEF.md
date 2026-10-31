# Brian's Dash — private Site handoff for ChatGPT Work / Sites

## Goal

Build an **independent new PRIVATE Site** named **Brian's Dash** from the source in `dist/`, not from a screenshot or from the original creator's Site. Keep all source files, vendor attribution, and tests. This is the already-customized static implementation, with a custom midnight-blue/teal/violet design and five workflows: career, coursework, investments, planner, Southern California map/events. US Pacific time (`America/Los_Angeles`) and public regional reference location around Irvine/Riverside. Do not look up the original creator's accounts, contacts, spreadsheet, location or Site.

## Deployment/privacy gating

1. Check whether the recipient has ChatGPT Sites/Work access and what kind of deployment artifact is supported. A static ZIP alone is not proof that it is compatible with Sites hosting. If incompatible, adapt the code while preserving the existing source and tests.
2. Create a **separate new Site** (not a fork of an unknown owner's live Site). Leave it **private to the creator**; verify the access-control setting and actual full hosted URL in the Sites UI. Do not claim the local source is protected by login.
3. For private connected data, determine whether this account/workspace can use plugin-based Site integrations. Only if supported, use the official Sites plugin discovery/runtime (not OAuth tokens in JavaScript), visitor-specific ChatGPT sign-in/consent, and server-side authorization. Ask before accessing the recipient's real data and request minimal read scopes. Read one agreed folder/calendar/sheet, not all accessible files by default. Verify each connection with an actual authorized read and reflect last-updated timestamps. Avoid confusing a ChatGPT connector with an integrated Site connector.
4. User wants **read-only permissions by default**. Do not send emails, create calendar items, trade stocks, sync changes upstream, publish sources, change sharing, or create an automation without explicit consent. Site metadata, account IDs and any identity logic belong on the server with appropriate access controls, never exposed in client source.
5. Keep private financial data in visitor-specific protected storage or ephemeral server state. Avoid public shares, indexable feeds and hard-coded real holdings. If Site connector support is unavailable, retain this static workbook mode as an honestly labeled fallback.

## Requested accounts and status

- Gmail, Google Calendar and Google Drive/Sheets: installed in ChatGPT; Site support/consent not automatically granted. Suggested scopes: read selected upcoming events, read selected application and course files, read only user-approved job-related emails.
- Microsoft Outlook and Outlook Calendar: optional connectors separately offered; installation/authorization needs user action. OneDrive is **not confirmed** as a direct Site connector; test supported alternatives instead of inventing capability.
- Finances: installed in ChatGPT, **no verified brokerage authorization in this artifact**. Ask the user to connect financial accounts via Finances/Plaid; Robinhood availability and investment fields depend on supported institutions. The static website has no Robinhood session or live portfolio API. Never request user passwords or brokerage tokens. Never implement trade execution.
- Personal Excel/CSV: already supported as local, memory-only imports.

## Daily stock brief requirement

User requests daily stock news for currently owned tickers and one research-backed stock idea each day. The static site currently supports **click-through current-news searches**, locally imported holdings and a **transparently labeled educational rotating spotlight**. This is *not* a live recommendation engine or a background news service.

For a live experience, get the user's chosen update time (time zone known: Pacific), confirm current ticker universe (Finances only if authorized and supported), choose reputable market-news/data sources, ensure dated article links and source attribution, and implement a scheduled research workflow **only when explicitly approved**. A Work automation may deliver ChatGPT messages but does not automatically populate Site data or gain background access to visitor-connected accounts. Do not make unsupported claims about live price data or autonomous recommendation accuracy. Research should discuss valuation, uncertainty, diversification, catalysts, and risks; no trading.

## Maps to preserve

MapLibre GL + OpenFreeMap 3D tactical, Leaflet 2D fallback, Photon café lookup, Nominatim search, OSRM driving estimate (no live traffic), Google Maps deep links, Cesium Photorealistic 3D tiles with user-supplied scoped token, fly-to/orbit controls, event/office location dossiers, attribution and reduced-motion settings. Unknown locations remain unknown. Public Irvine reference point is *not* the user's address. Never persist Cesium tokens.

## Source and testing

- Source `dist/index.html`, `dist/app.js`, `dist/personal.mjs`, `dist/brians.css`, all existing map modules and vendor licenses.
- Four additional spreadsheet tabs are defined by `personal.mjs` and documented in `docs/DATA-SCHEMA.md`.
- Run `npm test`, `node --check` on JS modules, then preview desktop/mobile; verify setup, blank/demo, XLSX import/export, holdings CSV import, new navigation views, map and Leaflet fallback, photorealistic token panel, draft protection and private hosted access.
- Be clear about network dependencies, stale quote values, data provenance, local browser storage and the difference between working source and published private Site.
