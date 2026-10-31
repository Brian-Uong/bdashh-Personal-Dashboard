# Brian's Dash verification — 2026-10-28

## Automated checks

`npm test`: **59 passed, 0 failed** after customization. `node --check` completed for all `dist/*.mjs` and `dist/app.js`. Checks include the original parser/map/demo/draft/live-refresh protections plus new coursework/holdings/CSV/stock research tests.

## Manual checks and limitations

A modern JavaScript-enabled browser and HTTP origin (not `file://`) are required. The current execution container's Chromium instance blocks navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, including localhost, so a rendered cross-browser/manual preview could **not** be completed here. Before publishing, run a local browser preview, open each section, test XLSX import and CSV replacement, and verify private Site behavior. The stock market news links are search shortcuts, not programmatically verified headlines; prices are workbook values, not live. A rotating research candidate is not an investment recommendation. The new separate private Site **was not deployed** by this package authoring step.

## Remaining production checks

- Verify the running Site can load workbook library (`xlsx@0.18.5` CDN in the original code). The original dependency is not claimed to be current or security-audited. Review and consider updating it before public-scale deployment.
- Check MapLibre 3D/Leaflet fallback with the host's CSP, current tile providers and WebGL. Photorealistic viewer requires the visitor's own scoped token and provider service access.
- Verify dashboard actions, data loading, browser draft prompts, date/time in Los Angeles, and visibility on 1440 px desktop and ~390 px mobile.
- Before adding sensitive connected data, test real account consent, read scopes, private Site access controls and true hosted behavior. Do not change sharing or publish without explicit user request.
