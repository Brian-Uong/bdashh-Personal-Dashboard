# Brian's Dash — data connections and privacy boundaries

| Data source | In the downloaded static app | In ChatGPT | Site integration required |
|---|---|---|---|
| Private `.xlsx` workbook | Yes, locally in memory | Could analyze if supplied | No; fallback works in browser |
| Holdings CSV | Yes, positions snapshot with headers; browser only | Could analyze if supplied | No; fallback works in browser |
| Google Calendar | **Not connected** | Available connector | Supported Site plugin runtime, consent, tested read, scoped access |
| Google Drive / Google Sheets | **Not connected** (public sheet advanced option intentionally discouraged) | Available connector | Supported private Site plugin + scoped file access |
| Gmail | **Not connected** | Available connector | Supported private Site plugin + user-approved read access |
| Outlook email / calendar | **Not connected** | Connector offered but authorization may be pending | Supported Site plugin + read consent |
| OneDrive | **Not connected** | No verified direct OneDrive plugin in this setup | Verify provider and Site support separately |
| Finances / brokerage | **Not connected** | Finances installed, account authorization unverified | Verify Finances Site eligibility; Robinhood availability via Plaid is not guaranteed |
| Live stock prices / headlines | **Not connected** | Can research current sources in chat | Authenticated or licensed external market data provider; current-news links need no connection |
| ChatGPT scheduled brief | Not implemented | Separate Automations workflow if user approves time and tickers | Does **not** imply automatic Site updates |

The static app never reads OAuth tokens or financial credentials. Loaded workbook and CSV data stay in this tab's memory and are not transmitted to an app server. Google Sheet optional public read is disabled by default behind an Advanced consent section. A person who can read a public sheet can read it independently of the dashboard; never put private records there.

Map interactions still contact external map providers for tiles and, when triggered, send addresses/coordinates or company search terms. Click-through stock-news searches send the ticker term to the selected news/search provider. Cesium tokens are entered in the user's own browser panel, sent to Cesium for tile access and not persisted by this code. Browser map origin, overrides, skipped-event choices and short-lived café cache are stored under `brians-dash-` keys in local storage; routes may be stored in session storage. Clear browser site data to remove map preferences.

**Private Site publishing** must be handled by the platform (e.g., Work/Sites), not by an unprotected static URL. A "PRIVATE" badge in the UI is an explanation, not a login system. This package has no auth backend.
