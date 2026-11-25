// Synthetic provider responses only. No live prices, credentials or network access.
export const clock = Date.parse('2026-11-19T18:00:00Z');
export function nasdaq(at, status = 'Open', price = 100) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
 }).formatToParts(at).map(p => [p.type, p.value]));
 return {data: {symbol: 'NVDA', assetClass: 'STOCKS', companyName: 'NVIDIA', marketStatus: status,
  primaryData: {lastSalePrice: `$${price}`, netChange: '+1', lastTradeTimestamp:
   `${parts.month} ${parts.day}, ${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod} ET`},
  secondaryData: {lastSalePrice: '$99', netChange: '+1'}}};
}
export const yahoo = (at, price = 102) => ({chart: {result: [{meta: {
 symbol: 'NVDA', currency: 'USD', longName: 'NVIDIA', regularMarketPrice: price,
 regularMarketTime: at / 1000
}}]}});
export function fixture({time = clock, age = 90, status = 'Open', fallbackAge = 2, fallbackStatus = 200,
 previous, cooldowns = {}, afterPrimary, deadline = Infinity} = {}) {
 const calls = [], primaryAt = time - age * 60000, fallbackAt = time - fallbackAge * 60000;
 let current = time;
 return {calls, primaryAt, fallbackAt, options: {
  now: () => current, previous, cooldowns, deadline,
  fetcher: async (url, options) => {
   const provider = url.includes('/info?') ? 'Nasdaq' : url.includes('/extended-trading?') ? 'Nasdaq extended' :
    url.startsWith('https://query1.finance.yahoo.com/v8/finance/chart/') ? 'Yahoo Finance' : null;
   if (!provider) throw Error(`Unexpected fixture URL: ${url}`);
   if (!options.signal || options.cache !== 'no-store') throw Error('Request safeguards missing');
   calls.push(provider);
   if (provider === 'Nasdaq') {
    if (afterPrimary !== undefined) current = afterPrimary;
    return Response.json(nasdaq(primaryAt, status));
   }
   if (provider === 'Nasdaq extended') return new Response('', {status: 503});
   if (fallbackStatus !== 200) return new Response('', {status: fallbackStatus, headers: {'retry-after': '1200'}});
   return Response.json(yahoo(fallbackAt));
  }
 }};
}
const fallback = ['Nasdaq', 'Yahoo Finance'];
const primary = ['Nasdaq'];
export const cases = [
 {name: 'regular: 90-minute trade, no saved quote', config: {}, source: 'Yahoo Finance', calls: fallback},
 {name: 'regular: 90-minute trade equals saved observation', config: {previous: {price: 100, asOf: new Date(clock - 90 * 60000).toISOString()}}, source: 'Yahoo Finance', calls: fallback},
 {name: 'pre-market: 90-minute trade', config: {time: Date.parse('2026-11-19T13:00:00Z'), status: 'Pre-Market'}, source: 'Yahoo Finance', calls: fallback},
 {name: 'after-hours: 90-minute trade', config: {time: Date.parse('2026-11-19T23:00:00Z'), status: 'After-Hours'}, source: 'Yahoo Finance', calls: fallback},
 {name: 'outside coverage: summer date cannot establish an active session', config: {time: Date.parse('2026-06-15T17:00:00Z')}, source: 'Nasdaq', calls: primary},
 {name: 'fresh: 19-minute trade needs no fallback', config: {age: 19}, source: 'Nasdaq', calls: primary},
 {name: 'boundary: exactly 20 minutes needs no fallback', config: {age: 20}, source: 'Nasdaq', calls: primary},
 {name: 'boundary: 20 minutes plus one second triggers fallback', config: {age: 20 + 1 / 60}, source: 'Yahoo Finance', calls: fallback},
 {name: 'closed status during weekday: no age-triggered fallback', config: {status: 'Closed'}, source: 'Nasdaq', calls: ['Nasdaq', 'Nasdaq extended']},
 {name: 'weekend rejects stale open status', config: {time: Date.parse('2026-11-21T18:00:00Z')}, source: 'Nasdaq', calls: primary},
 {name: 'before 04:00 Eastern: no age-triggered fallback', config: {time: Date.parse('2026-11-19T08:59:00Z')}, source: 'Nasdaq', calls: primary},
 {name: '04:00 Eastern starts active window', config: {time: Date.parse('2026-11-19T09:00:00Z'), status: 'Pre-Market'}, source: 'Yahoo Finance', calls: fallback},
 {name: '20:00 Eastern ends active window', config: {time: Date.parse('2026-11-20T01:00:00Z'), status: 'After-Hours'}, source: 'Nasdaq', calls: primary},
 {name: 'unknown status does not assume an open market', config: {status: 'Unknown'}, source: 'Nasdaq', calls: primary},
 {name: 'older fallback cannot replace valid primary', config: {fallbackAge: 100}, source: 'Nasdaq', calls: fallback},
 {name: 'failed fallback keeps primary and its real timestamp', config: {fallbackStatus: 503}, source: 'Nasdaq', calls: fallback},
 {name: 'rate-limited fallback keeps primary and starts cooldown', config: {fallbackStatus: 429}, source: 'Nasdaq', calls: fallback},
 {name: 'fallback cooldown prevents outbound request', config: {cooldowns: {'Yahoo Finance': new Date(clock + 900000).toISOString()}}, source: 'Nasdaq', calls: primary},
 {name: 'budget exhausted after primary prevents fallback request', config: {deadline: clock + 1000, afterPrimary: clock + 1000}, source: 'Nasdaq', calls: primary}
];
export async function observe(fetchQuote, scenario) {
 const f = fixture(structuredClone(scenario.config));
 const quote = await fetchQuote('NVDA', f.options);
 const expected = {source: scenario.source, price: scenario.source === 'Nasdaq' ? 100 : 102,
  asOf: new Date(scenario.source === 'Nasdaq' ? f.primaryAt : f.fallbackAt).toISOString(), calls: scenario.calls};
 const observed = {source: quote.source, price: quote.price, asOf: quote.asOf, calls: f.calls};
 return {scenario: scenario.name, expected, observed, passed: JSON.stringify(expected) === JSON.stringify(observed),
  providerNotes: quote.providerNotes ?? null, cooldowns: f.options.cooldowns};
}
