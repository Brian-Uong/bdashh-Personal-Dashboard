# Brian’s Dash

Personal dashboard for investments, jobs and recruiters, planning, networking and
Southern California events. Public visitors can read saved records; only the owner
and authenticated scheduled updater can write.

## Development

Node.js 22.13+ and pnpm 11.25.0 are declared in `package.json`. Install the locked
dependencies with the Sites dependency helper in the managed environment, or
`pnpm install --frozen-lockfile` in your own development environment.

- `npm run dev` — local development (use the Sites preview workflow when hosted).
- `npm run check` — automated tests, JavaScript syntax, local assets and domain portability.
- `npm run build` — build the Cloudflare Worker and browser assets.
- `npm start` — preview the built Worker locally; does not publish.

For Sites changes, follow the Sites skill for source synchronization and deployment.
Read `AGENTS.md` before making changes.

## Source map

| Path | Purpose |
| --- | --- |
| `public/dashboard/` | Dashboard UI, charts, maps, forms and browser preferences |
| `app/api/` | Authenticated writes, public reads, provider integrations |
| `lib/` | Validation, record merging, quote parsing, access and history logic |
| `worker/index.ts`, `vite.config.ts` | Vinext / Cloudflare runtime integration |
| `.openai/hosting.json` | Existing Site identity and R2 binding |
| `tests/` | Data preservation, authorization, provider failure and UI-rendering tests |
| `docs/DOMAIN-MIGRATION.md` | Custom-domain preparation and host migration requirements |
| `docs/AUDIT-2026-10-29.md` | Verified checks and remaining service limitations |

## Saved data and secrets

The server requires the `BUCKET` R2 binding. `DASHBOARD_OWNER_EMAIL` identifies the
owner from trusted Sites identity headers; `DASHBOARD_SERVICE_TOKEN` authorizes the
scheduled writer. Configure secrets through the hosting platform, never in source.
The updater sends its supported credential in both platform and dashboard service
headers; see `public/dashboard/updater-access.md`.

A GitHub repository contains source code, not the production R2 data or scheduled
ChatGPT tasks. Static GitHub Pages hosting alone cannot run this backend.

## .com preparation

The current platform supports custom domains. Attaching your chosen domain to the
same Site is the first path to evaluate: it keeps the project and storage in place.
No domain is purchased, attached, or assumed by this repository.

Owner tools → **Download migration backup** exports saved dashboard data, leads,
research preferences, portfolio history and selected browser preferences. The JSON
contains personal information: keep it private, outside GitHub. On the new domain,
**Restore browser preferences** restores bookmarks, stages, map and display choices;
it intentionally does not overwrite server records. Keep the exported workbook too.
