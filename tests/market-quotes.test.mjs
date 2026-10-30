import test from 'node:test';import assert from 'node:assert/strict';
import {easternTimestamp,parseNasdaq,fetchQuote} from '../lib/market-quotes.mjs';
const now=()=>Date.parse('2026-10-28T22:00:00Z');
const nasdaq={data:{symbol:'KO',assetClass:'STOCKS',companyName:'Coca-Cola',marketStatus:'After-Hours',primaryData:{lastSalePrice:'$92.74',netChange:'+0.86',lastTradeTimestamp:'Oct 28, 2026 5:31 PM ET'},secondaryData:{lastSalePrice:'$91.88',netChange:'+0.70'}}};
test('Eastern quote times respect summer and winter offsets',()=>{assert.equal(easternTimestamp('Oct 28, 2026 5:31 PM ET'),'2026-10-28T21:31:00.000Z');assert.equal(easternTimestamp('Closed at Jan 9, 2026 4:00 PM ET'),'2026-01-09T21:00:00.000Z');});
test('after-hours quote is labeled and previous close comes from regular session',()=>{const q=parseNasdaq(nasdaq,'KO',now());assert.equal(q.price,92.74);assert.equal(q.session,'After-Hours');assert.ok(Math.abs(q.previousClose-91.18)<0.001);assert.throws(()=>parseNasdaq(nasdaq,'SPCX',now()));assert.throws(()=>parseNasdaq({...nasdaq,data:{...nasdaq.data,symbol:'SPCX',companyName:'SPAC ETF'}},'SPCX',now()));});
test('Nasdaq rate limit falls back and backs off only that provider',async()=>{const cooldowns={},calls=[];const fetcher=async url=>{calls.push(url);return url.includes('nasdaq')?new Response('{}',{status:429,headers:{'retry-after':'1200'}}):Response.json({chart:{result:[{meta:{symbol:'KO',currency:'USD',regularMarketPrice:91.73,regularMarketTime:now()/1000-60}}]}});};const q=await fetchQuote('KO',{fetcher,cooldowns,now});assert.equal(q.source,'Yahoo Finance');assert.equal(cooldowns.Nasdaq,'2026-10-28T22:20:00.000Z');await fetchQuote('KO',{fetcher,cooldowns,now});assert.equal(calls.filter(x=>x.includes('nasdaq')).length,1);});
test('bad primary quote fails over without accepting wrong symbol',async()=>{const fetcher=async url=>url.includes('nasdaq')?Response.json(nasdaq):Response.json({chart:{result:[{meta:{symbol:'V',currency:'USD',regularMarketPrice:400,regularMarketTime:now()/1000-60}}]}});assert.equal((await fetchQuote('V',{fetcher,now})).price,400);});
test('a closed-market date is preserved without inventing a time, but partial active-session timestamps are rejected',()=>{
 const data=structuredClone(nasdaq);data.data.marketStatus='Closed';data.data.primaryData.lastTradeTimestamp='Oct 28, 2026';
 const quote=parseNasdaq(data,'KO',now());assert.equal(quote.asOf,'2026-10-28');assert.equal(quote.timePrecision,'day');assert.equal(quote.session,'Regular close');
 data.data.marketStatus='After-Hours';assert.throws(()=>parseNasdaq(data,'KO',now()),/timestamp missing/);
 data.data.marketStatus='Closed';data.data.primaryData.lastTradeTimestamp='Feb 31, 2026';assert.throws(()=>parseNasdaq(data,'KO',now()),/Invalid quote date/);
});
