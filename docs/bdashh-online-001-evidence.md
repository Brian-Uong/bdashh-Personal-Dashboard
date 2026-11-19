# Online B/D favicon — production evidence

Verified 2026-11-19T09:25:31.104998+00:00 (November 19, 2026, Pacific).

Published to https://bdashh.com/dashboard/ from source commit `a916ce4e75840e4d1bd3b9080aa4611f67271a5b`. Dashboard v80 is retained.

## Change

Electric cyan `#25E8FF` pixel B/D monogram on navy `#071421`, 12.44:1 contrast. Deterministic 16×16 grid, matching SVG, 16/32 PNG, 16/32/48 ICO, and 180-pixel touch icon. Five root-relative page-head links use `?v=bd-online-1`.

The dashboard body, behavior, authentication, and paid API gates are unchanged. ICO MIME support and the generated asset manifest are the only supporting runtime-build changes. `scripts/generate-favicon.py` reproduces the icon files with Python standard-library modules.

## Verification

- All 256 starting source blobs matched current GitHub main before editing. Unrelated files were retained.
- Existing checks: 207 passed, 0 failed; build and release preparation passed.
- All 128 immutable asset objects were read back and checked for exact SHA-256 and size before production deployment.
- Production compiled Worker SHA-256 matches the prepared build. Server code is identical outside its generated static-asset manifest.
- Worker bindings, compatibility, observability, and other selected configuration match the pre-release fingerprint.
- `/`, `/dashboard`, `/dashboard/`, and `/dashboard/index.html` resolve to HTTP 200 HTML containing all five icon links. Hash-based dashboard bookmarks use the same document.
- Chrome independently loaded the production dashboard, found the five icon links, and decoded the 32×32 production PNG at its expected dimensions.
- Anonymous access remains read-only; the public AI-status endpoint reports configured and daily flags false. No paid calls were made.

| Production file | HTTP / type | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `/favicon.svg?v=bd-online-1` | 200 / `image/svg+xml` | 1369 | `1801c4870caf11396d46e7f30402692a06834fd47eb4391ac8bae716ec338fd1` |
| `/favicon.ico?v=bd-online-1` | 200 / `image/x-icon` | 461 | `5d3256a541750e175e945bba87dc8e912c078f4f4b6a49d5c1e001f1c4a35d32` |
| `/favicon-16x16.png?v=bd-online-1` | 200 / `image/png` | 114 | `61188f26ffabb71d97ca122de5186b43d1fe41f1b20e04c79bf80775ad0725c4` |
| `/favicon-32x32.png?v=bd-online-1` | 200 / `image/png` | 133 | `dfa8fef704a4df4d3dbd9cb8c3ba7b4b86ec9343194ff407e42bce6cadc5f2bb` |
| `/apple-touch-icon.png?v=bd-online-1` | 200 / `image/png` | 537 | `81f24b04015dd4fa9005dd0d6f7a159b7f83fdbb5dad53b7be30f5c13e454716` |

The unversioned `/favicon.ico` also returns the same 461-byte ICO. Image decoding confirmed PNG dimensions and all three ICO frames.

## Limits and preservation

Private settings/data comparisons were blocked by automatic approval review. No private data-bucket reads or writes were performed. A separate configuration-metadata verification attempt was rejected; it was replaced with the successful fingerprint-only check. The first urllib HTTP attempt returned 403; all 12 curl checks and the independent Chrome checks passed.

No bookmark was edited in the browser. A previously cached bookmark icon may need the dashboard reopened before refreshing. The private ChatGPT Site, `site-source` branch, and all unrelated source were left unchanged.

Full machine-readable observations: [bdashh-online-001-evidence.json](bdashh-online-001-evidence.json).
