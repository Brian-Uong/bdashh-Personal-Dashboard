import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchQuote} from '../lib/market-quotes.mjs';
import {cases, observe, clock, nasdaq, yahoo} from './fixtures/quote-freshness.mjs';

for (const scenario of cases) test(scenario.name, async () => {
 const result = await observe(fetchQuote, scenario);
 assert.deepEqual(result.observed, result.expected);
});

test('fallback 429 is shared across refreshes, then retried only at expiry', async () => {
 let time = clock, yahooCalls = 0;
 const cooldowns = {};
 const options = {now: () => time, cooldowns, fetcher: async url => {
  if (url.includes('/info?')) return Response.json(nasdaq(time - 90 * 60000));
  yahooCalls++;
  return yahooCalls === 1 ? new Response('', {status: 429, headers: {'retry-after': '1200'}}) : Response.json(yahoo(time - 60000));
 }};
 const first = await fetchQuote('NVDA', options);
 assert.equal(first.price, 100);
 assert.match(first.providerNotes, /20 minutes/);
 assert.match(first.providerNotes, /HTTP 429/);
 assert.equal(cooldowns['Yahoo Finance'], new Date(clock + 1200000).toISOString());
 time += 1199999;
 const next = await fetchQuote('NVDA', options);
 assert.match(next.providerNotes, /cooling down/);
 assert.equal(yahooCalls, 1);
 time++;
 assert.equal((await fetchQuote('NVDA', options)).source, 'Yahoo Finance');
 assert.equal(yahooCalls, 2);
});

for (const [header, delay] of [['5', 900000], ['not-a-date', 900000], [new Date(clock + 1800000).toUTCString(), 1800000]]) {
 test(`fallback Retry-After ${header} respects minimum or longer server delay`, async () => {
  const cooldowns = {};
  await fetchQuote('NVDA', {now: () => clock, cooldowns, fetcher: async url =>
   url.includes('/info?') ? Response.json(nasdaq(clock - 90 * 60000)) :
    new Response('', {status: 429, headers: {'retry-after': header}})});
  assert.equal(cooldowns['Yahoo Finance'], new Date(clock + delay).toISOString());
 });
}

test('invalid fallback identity retains primary and exposes rejection', async () => {
 const payload = yahoo(clock - 60000); payload.chart.result[0].meta.symbol = 'OTHER';
 const quote = await fetchQuote('NVDA', {now: () => clock, fetcher: async url =>
  Response.json(url.includes('/info?') ? nasdaq(clock - 90 * 60000) : payload)});
 assert.equal(quote.price, 100);
 assert.equal(quote.asOf, new Date(clock - 90 * 60000).toISOString());
 assert.match(quote.providerNotes, /identity/);
});

test('fallback timeout preserves the valid primary without retrying', async () => {
 let calls = 0;
 const quote = await fetchQuote('NVDA', {now: () => clock, fetcher: async url => {
  calls++;
  if (url.includes('/info?')) return Response.json(nasdaq(clock - 90 * 60000));
  throw new DOMException('Controlled timeout', 'TimeoutError');
 }});
 assert.equal(calls, 2);
 assert.equal(quote.price, 100);
 assert.match(quote.providerNotes, /request timed out/);
});
