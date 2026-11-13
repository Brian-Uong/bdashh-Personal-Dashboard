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

const closed=()=>({data:{symbol:'NVDA',assetClass:'STOCKS',companyName:'NVIDIA Corporation',marketStatus:'Closed',primaryData:{lastSalePrice:'$166.19',netChange:'-7.54',lastTradeTimestamp:'Nov 12, 2026'}}});
const extended=()=>({data:{lastUpdateInfo:['Data last updated Nov 12, 2026 08:00 PM ET.','This page will resume updating on Nov 13, 2026 04:00 PM ET.'],tradeDetailTable:{headers:{time:'After Hours Time (ET)'},rows:[{time:'19:59:59',price:'$167.82'},{time:'19:59:58',price:'$167.80'}]}}});
const late=()=>Date.parse('2026-11-13T03:00:00Z');
const quoteAt=(asOf,session='Regular session',price=160)=>({price,asOf,session});

test('closing dates sort by Eastern trading day and session without overwriting after-hours observations',async()=>{
 const {compareQuotes}=await import('../lib/market-quotes.mjs');
 const close=quoteAt('2026-11-12','Regular close');
 assert.equal(compareQuotes(close,quoteAt('2026-11-12T18:52:00Z')),1);
 assert.equal(compareQuotes(close,quoteAt('2026-11-12T12:00:00Z','Pre-Market')),1);
 assert.equal(compareQuotes(close,quoteAt('2026-11-13T00:59:59Z','After-Hours')),-1);
 assert.equal(compareQuotes(quoteAt('2026-11-13T00:59:59Z','After-Hours'),close),1);
 assert.equal(compareQuotes(quoteAt('2026-11-12T18:52:00Z'),close),-1);
 assert.equal(compareQuotes(close,quoteAt('2026-11-11T23:00:00Z','After-Hours')),1);
 assert.equal(compareQuotes(quoteAt('2026-11-13T13:00:00Z','Pre-Market'),close),1);
 assert.equal(compareQuotes(close,{...close}),0);
 assert.equal(compareQuotes(close,quoteAt('2026-11-12T21:00:00Z','Regular close')),-1);
 assert.equal(compareQuotes(quoteAt('2026-11-12T21:00:00Z','Regular close'),close),1);
 assert.equal(close.asOf,'2026-11-12');
});
test('completed after-hours session uses the actual last trade and ignores the next-resume date',async()=>{
 const {parseNasdaqExtended}=await import('../lib/market-quotes.mjs');
 const q=parseNasdaqExtended(extended(),'NVDA',closed(),'post',late());
 assert.equal(q.price,167.82);assert.equal(q.asOf,'2026-11-13T00:59:59.000Z');assert.equal(q.session,'After-Hours');
 assert.equal(q.timePrecision,'second');
 assert.throws(()=>parseNasdaqExtended(extended(),'KO',closed(),'post',late()),/identity/);
 const future=extended();future.data.lastUpdateInfo[0]='Data last updated Nov 13, 2026 08:00 PM ET.';
 assert.throws(()=>parseNasdaqExtended(future,'NVDA',closed(),'post',late()),/Invalid extended update/);
 const bad=extended();bad.data.tradeDetailTable.rows=[{time:'25:00:00',price:'$167'},{time:'19:59:59',price:'N/A'},{time:'08:00:00',price:'$170'}];
 assert.throws(()=>parseNasdaqExtended(bad,'NVDA',closed(),'post',late()),/No timestamped/);
});
test('a closed session checks its extended trades before stopping at a date-only quote',async()=>{
 const calls=[];const q=await fetchQuote('NVDA',{now:late,fetcher:async url=>{calls.push(url);if(url.includes('/info?'))return Response.json(closed());if(url.includes('/extended-trading?'))return Response.json(extended());throw Error('Yahoo should not be needed');}});
 assert.equal(q.price,167.82);assert.equal(q.asOf,'2026-11-13T00:59:59.000Z');assert.equal(calls.length,2);
});
test('a weekend refresh keeps the last actual extended-hours trade timestamp',async()=>{
 const q=await fetchQuote('NVDA',{now:()=>Date.parse('2026-11-15T18:00:00Z'),fetcher:async url=>Response.json(url.includes('/info?')?closed():extended())});
 assert.equal(q.asOf,'2026-11-13T00:59:59.000Z');assert.equal(q.checkedAt,'2026-11-15T18:00:00.000Z');
});
test('a missing extended feed still returns the genuine dated close if the backup is unavailable',async()=>{
 const cooldowns={},q=await fetchQuote('NVDA',{now:late,cooldowns,fetcher:async url=>url.includes('/info?')?Response.json(closed()):new Response('',{status:url.includes('yahoo')?429:503})});
 assert.equal(q.price,166.19);assert.equal(q.asOf,'2026-11-12');assert.match(q.providerNotes,/503/);assert.ok(cooldowns['Yahoo Finance']);
});
test('Yahoo intraday fallback includes pre/post-market samples and filters invalid final points',async()=>{
 const {parseQuote}=await import('../lib/market-quotes.mjs');
 const regular=Date.parse('2026-11-12T21:00:00Z')/1000,post=Date.parse('2026-11-13T00:59:00Z')/1000;
 const payload={chart:{result:[{meta:{symbol:'NVDA',currency:'USD',longName:'NVIDIA',regularMarketPrice:166.19,regularMarketTime:regular},timestamp:[regular,post,post+60,late()/1000+600],indicators:{quote:[{close:[166.19,167.82,null,999]}]}}]}};
 const q=parseQuote(payload,'NVDA',late());assert.equal(q.price,167.82);assert.equal(q.session,'After-Hours');assert.equal(q.asOf,'2026-11-13T00:59:00.000Z');
 const pre=structuredClone(payload),result=pre.chart.result[0];result.timestamp=[Date.parse('2026-11-13T13:00:00Z')/1000];result.indicators.quote[0].close=[168.21];
 assert.equal(parseQuote(pre,'NVDA',Date.parse('2026-11-13T14:00:00Z')).session,'Pre-Market');
 let seen='';await fetchQuote('NVDA',{now:late,fetcher:async url=>{if(url.includes('nasdaq'))return new Response('',{status:503});seen=url;return Response.json(payload);}});
 assert.equal(new URL(seen).searchParams.get('includePrePost'),'true');assert.equal(new URL(seen).searchParams.get('interval'),'1m');
});
test('an older but valid primary quote triggers the independent fallback',async()=>{
 const primary=structuredClone(nasdaq);primary.data.symbol='KO';
 let backupCalls=0;
 const q=await fetchQuote('KO',{now:late,previous:quoteAt('2026-11-12T22:00:00Z','After-Hours'),fetcher:async url=>{
  if(url.includes('nasdaq'))return Response.json(primary);backupCalls++;return Response.json({chart:{result:[{meta:{symbol:'KO',currency:'USD',regularMarketPrice:90,regularMarketTime:late()/1000-60}}]}});
 }});assert.equal(q.source,'Yahoo Finance');assert.equal(backupCalls,1);
});
test('expired overall budget starts no provider requests',async()=>{
 let calls=0;await assert.rejects(fetchQuote('KO',{now:late,deadline:late()-1,fetcher:async()=>{calls++;throw Error('must not run');}}),/budget/);assert.equal(calls,0);
});
