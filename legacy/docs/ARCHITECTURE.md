# Architecture and map stack

The app is static. `dist/` is editable source, served as-is. There is no backend, database, build step or inherited hosting identity.

| File | Responsibility |
|---|---|
| index.html / app.js | Dashboard shell, record navigation, imports, session workbook, refresh and setup controls |
| source-config.mjs | Validate and normalise recipient-supplied Google Sheets URL |
| demo-data.mjs / *-workbook.json | Fictional demo and blank schemas; moving demo dates |
| core.mjs | Tab definitions, fixed header positions, date parsing and record metrics |
| networking.mjs | Contact mapping by header, dossiers and message drafts |
| map-data.mjs | Build company/event locations from workbook coordinates; no built-in company catalogue |
| opportunity-map.mjs | Tactical renderer, pins, dossier, geocoding, travel origin, routing, photo iframe |
| map-style.json | Existing navy-and-gold OpenFreeMap vector style |
| location-intel.mjs | Photon cafés and Wikidata/Wikipedia company lookup |
| commute.mjs | Demo travel origin, distances, route parsing and formatting |
| photorealistic.html / .mjs / .css | Lazy Cesium viewer, scoped token input, fly-to/orbit and disconnection |
| nope-cannon.mjs / orbital-scene.mjs / missile-pov.mjs | Optional decorative dismissal/flight effects; no real-world action |
| vendor/ | MapLibre and Leaflet browser assets with retained licence notices |

## Provider contracts used by the code

| Feature | Endpoint / library | Inputs and limits |
|---|---|---|
| Tactical 3D | MapLibre GL JS; https://tiles.openfreemap.org/planet | Vector tiles; building fill-extrusion uses render_height / render_min_height |
| 2D fallback | Leaflet; https://tile.openstreetmap.org/{z}/{x}/{y}.png | Tile usage policy applies; no bulk prefetch |
| Nearby cafés | https://photon.komoot.io/reverse | Longitude/latitude, 1.5 km radius, amenity:cafe, limit 10; cache and display coverage limitations |
| Address matching | https://nominatim.openstreetmap.org/search | Explicit address lookup only; coordinates can be entered manually |
| Driving | https://routing.openstreetmap.de/routed-car/route/v1/driving/ | longitude,latitude pairs; distance metres, duration seconds; 15-second timeout; no live traffic |
| Company background | Wikidata and Wikipedia APIs | User-triggered company search; user selects match; not a verified contact workplace |
| Photorealistic | CesiumJS 1.124 via cesium.com CDN | createGooglePhotorealistic3DTileset(); own Cesium ion token, asset permissions, coverage and WebGL required |
| Spreadsheet parsing | SheetJS 0.18.5 via jsDelivr | XLSX imports, blank-template export and browser-draft export |

These public services are not a guaranteed unlimited backend. Check current provider policies before scaling or commercial deployment, use modest request rates, retain attribution and provide fallbacks. Review bundled dependency versions before production use; they are retained from the source snapshot, not asserted to be latest or vulnerability-free.

## Important implementation notes

- Map coordinates are always `[longitude, latitude]`; table columns are separately named Latitude / Longitude.
- Company contacts join by normalised organisation name. One pin per company uses the first valid coordinate pair; split company records or extend the schema for multiple offices.
- Unknown/online events remain unlocated until an explicit location is supplied. Search results need user confirmation.
- `sourceGeneration` prevents responses from a disconnected sheet replacing current state. Draft/open-form checks run both before and after downloads.
- Browser map overrides take precedence over workbook coordinates. Clear site data if a user wants imported coordinates to replace an old saved pin.
- `command-starter-` prefixes isolate browser preferences from the source app. Each independent deployment should use a separate origin.
- Photo iframe messages check origin and parent/window identity. Tokens are not saved; switching to Tactical stops photo rendering but retains the tab's token until Disconnect or tab close.
- The cinematic launch point is a public demonstration coordinate. Effects are decorative and do not alter source records.

## Adapting to another use case

Start with labels and fictional sample content. Change schema and parsers together if replacing career tabs with customers, projects or research. Keep verification/unknown labels; never invent live feeds, coordinates or connection status. Add authenticated server routes only after checking hosting and connector support.

---

## Brian's Dash additions

| Source | Role |
|---|---|
| `personal.mjs` | Four additional personal workspaces, pure parsers, daily research spotlight, Holdings CSV validation, safe HTML rendering and snapshot metrics |
| `brians.css` | Teal/violet on midnight-blue visual system, workspace cards, finance and course tables, responsive layout |
| `app.js` (customized) | Integrates new navigation, high-level daily briefing and local Holdings CSV upload into the original workbook/map shell |
| `personal.test.mjs` | Tests new tab schema, parsing, portfolio price provenance, CSV import validation, XSS escaping, stock spotlight and map preservation |

The original career workbook parser and geographic location construction remain in place; no original owner's data was imported. New tabs are row-1-header tables. No background fetcher, brokerage API, market price feed, or authentication backend has been added. Old static Google public-sheet support remains behind advanced opt-in; it is not a private integration. The existing `brians-dash-` keys isolate map preferences from the original deployment.
