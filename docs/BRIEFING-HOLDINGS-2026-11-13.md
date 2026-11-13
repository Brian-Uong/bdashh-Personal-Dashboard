# News-only briefings and changing holdings

Daily stock recommendations now appear only in the recommendation journal. Both
briefing renderers exclude legacy recommendation cards, sections and pick-only
sources without rewriting saved research. The updater contract is revision 2 and
the shared recommendation policy explicitly separates news from journal picks.

Known company logos remain bundled. Newly added valid tickers use the public
Financial Modeling Prep image CDN, with no key and a no-referrer policy. Requests
contain the ticker, never quantities, costs or account details. Missing images use
initials and are not retried on every redraw in the same page session. External
logo availability is not guaranteed. Source documentation:
https://site.financialmodelingprep.com/developer/docs/stable/search-symbol

Adding a holding clears the previous search so it is immediately visible. Removing
the only search match clears that filter while preserving the chosen sort. Cards,
allocation and current totals remain derived from current holdings. Saved journal
entries and portfolio history are retained. An empty portfolio says No holdings yet.

Validation uses fictional local UI holdings and isolated backend storage, covering
add, remove, re-add, filters, automatic logo loading, empty state and saved briefing
filtering. No live portfolio mutation or paid provider call is required.
Shared changes are included in the standalone handoff; GitHub and bdashh.com are
outside this development release.
