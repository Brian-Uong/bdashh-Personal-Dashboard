# FC27 trading — retired

Brian requested a final attempt at live recommendations, followed by removal if
refresh could not be made useful. The tab was retired on October 29, 2026 (Pacific)
after the following production and source checks:

- FUTBIN continued to return HTTP 403 from the hosted Worker.
- FUT.GG returned a Cloudflare access block.
- NokaFut exposed a PC quote but console history on the checked card.
- FUT Flipper's public PC endpoints worked in a production probe. A full scan read
  144 catalogue cards, checked 24 and saved 19 with histories; one met the 10% net
  return test. A repeat refresh failed on a stale catalogue. After restricting saved
  catalogues to discovery only and requiring separate fresh details/history, the
  next full production scan timed out on the individual card reads. The initial
  success was insufficient to establish a dependable on-demand feature.
- FUTWIZ's detail page was reachable, but no working end-to-end PC scan was established.

The navigation entry, field guide, client UI, styles, scanner and cache code have
been removed. Old hash links and the standalone page return to the overview.
GET/POST `/api/fc-market` return 410 without source calls, storage reads or writes.
The temporary diagnostic handler has also been removed. Optional old cache objects
and browser preferences are inactive; no personal records were deleted.

Git history retains the experiment. Do not re-enable it without Brian requesting
another attempt and a repeatable live refresh passing on the production host.
