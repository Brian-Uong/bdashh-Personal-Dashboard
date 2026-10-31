# Brian's Dash — personal command centre

An independent customization of the supplied Command Centre Starter, with a midnight-blue/teal/violet interface for five workflows: **career & applications**, **MSBA coursework**, **personal investments**, **daily planning**, and **Southern California map/events**. This folder contains a static website in `dist/`, not a ChatGPT Site deployment or an account login.

## Open it locally

From the `Brians-Dash` folder, run:

```sh
python3 -m http.server 3000 --directory dist
```

Then open `http://localhost:3000` in a modern browser. Do not double-click `index.html`: this application uses JavaScript modules and `fetch` for its templates. Internet is needed for the SheetJS workbook library and external map services. Node 20+ can run `npm test` with no npm package download.

## Get started

1. Open **Data & connections** and click **Download Brian's Dash template** to create the 12-tab `.xlsx` starter. The original eight career/event tabs remain; four new tabs are `Coursework`, `Daily Planner`, `Holdings`, and `Stock Research`.
2. Enter only the data you want this browser to display. There are **no built-in real contacts, addresses, financial positions, school assignments, or external account permissions**.
3. Click **Import workbook**. The imported spreadsheet remains in browser memory until you leave or reload the tab. Use **Export workbook** to save a new copy of any browser draft edits.
4. In **Investments**, use **Import holdings CSV** for a positions snapshot containing `Symbol`/`Ticker` and `Quantity`/`Shares`. A Robinhood *account-activity* export is not automatically a holdings snapshot. An unsupported CSV is rejected instead of inventing a portfolio.
5. **Today's headlines** links open current external news searches for your imported tickers. Daily research spotlight is a rotating education prompt, **not a buy signal, verified research recommendation or automatic news feed**. An actual daily sourced recommendation and push briefing require an explicitly configured scheduled research workflow.
6. **SoCal map** opens the retained MapLibre tactical view (raised buildings), Leaflet 2D fallback, map search and café search. The default pin is a **public Irvine reference point, not your home**. Reposition the travel origin if you want driving estimates. Photorealistic mode uses your own scoped Cesium ion token and provider permissions.

To explore the interface first, choose **Explore fictional demo** in Data & connections. Its people/events are fictional and pinned at public Irvine and Riverside locations. The app normally opens an empty workbook rather than demo information.

## Privacy and account boundaries

- The **static dashboard** reads your local workbook/CSV and intentionally makes no login or brokerage connection. It does not upload imported file contents to a dashboard server. It may send addresses, coordinates, map requests and clicked external search queries to relevant map/news providers; see `docs/CONNECTIONS.md`.
- **Gmail, Google Calendar, Google Drive, Outlook and Finances** connections to ChatGPT do **not automatically authorize this site**. A separate Site must request its own supported permissions and use visitor-specific access. Do not copy OAuth tokens or passwords into a source file.
- **Finances** has been installed in ChatGPT at customization time. To test Robinhood, follow Finances → Connect accounts via Plaid. Actual brokerage availability and data fields are not confirmed and may vary; this webpage has no Finances connector implementation.
- Do not put your private data in a publicly accessible Google Sheet to "solve" site authentication. The optional public-sheet feature from the original starter is deliberately tucked under an Advanced warning; avoid it for personal data.
- Browser map preferences and travel origin use `localStorage` with `brians-dash-` keys. Imported workbook rows, stock positions, Sheet URL and Cesium token are not saved to local storage by this code. Clearing site data clears browser map preferences.
- This package is **not protected by a password**. If hosted at a public URL, its HTML/CSS/JS will be public. Publish through a **new PRIVATE Site with actual access controls** or keep it local.

## Prepare a separate private ChatGPT Site

Open **ChatGPT Work** on web/desktop, upload `Brians-Dash.zip` and ask it to build a **new private Site** from `dist/`, using the instructions in `AGENT-BRIEF.md`. The Site workflow must check compatibility, your account/workspace eligibility, connected-app permissions, and hosted behavior before publishing. Site deployment has **not** occurred in this chat, and no Site URL has been issued.

For the supported Sites feature and privacy steps, see:
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://learn.chatgpt.com/docs/sites/data-and-connections

Retain `THIRD-PARTY-NOTICES.md` and attribution in the deployed app. Deploy only `dist/` if using the no-backend static option.
