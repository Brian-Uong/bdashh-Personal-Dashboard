import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseStockHistory,fetchStockHistory,cachedStockHistory,validStockTicker} from '../lib/stock-history.mjs';
const time=Date.parse('2026-10-28T21:00:00Z'),seconds=time/1000;
const payload=(symbol='KO')=>({chart:{result:[{meta:{symbol,currency:'USD',longName:'The Coca-Cola Company',regularMarketTime:seconds,regularMarketPrice:91,chartPreviousClose:80},timestamp:[seconds-86400,seconds],indicators:{quote:[{close:[90,91],volume:[100,200]}]}}]}});
const response=()=>Response.json(payload());
function bucket(seed={}){const map=new Map(Object.entries(seed)),writes=[];return {writes,map,async get(key){return map.has(key)?{json:async()=>structuredClone(map.get(key))}:null},async put(key,value){writes.push(key);map.set(key,JSON.parse(value))}};}

test('history validates identity, currency and ticker before accepting prices',async()=>{
 for(const ticker of ['../KO','A&B','KO/','',null])assert.equal(validStockTicker(ticker),false);
 assert.equal(validStockTicker('BRK.B'),true);
 assert.throws(()=>parseStockHistory(payload('K'), 'KO','1mo',time),/identity/);
 const foreign=payload();foreign.chart.result[0].meta.currency='CAD';assert.throws(()=>parseStockHistory(foreign,'KO','1mo',time),/currency/);
 assert.throws(()=>parseStockHistory(payload('SPCX'),'SPCX','1mo',time),/SPCX/);
 assert.equal(parseStockHistory(payload('BRK-B'),'BRK.B','1mo',time).symbol,'BRK-B');
 let calls=0;await assert.rejects(fetchStockHistory('KO','invalid',{fetcher:()=>{calls++}}),/Invalid/);assert.equal(calls,0);
});

test('history retains only real positive prices, deduplicates and sorts samples',()=>{
 const input=payload(),result=input.chart.result[0];
 result.timestamp=[seconds,seconds-86400,seconds-86400,seconds-100,seconds-200,seconds+3600,seconds-300];
 result.indicators.quote[0]={close:[91,89,90,null,NaN,99,0],volume:[200,null,0,90,20,100,10]};
 const parsed=parseStockHistory(input,'KO','1mo',time);
 assert.deepEqual(parsed.points,[{time:seconds-86400,close:90,volume:0},{time:seconds,close:91,volume:200}]);
 assert.equal(parsed.price,91);assert.equal(parsed.fetchedAt,new Date(time).toISOString());
 assert.equal(parsed.previousClose,undefined,'Period baseline must not be labeled yesterday’s close');
 result.timestamp=[seconds];result.indicators.quote[0].close=[null];assert.throws(()=>parseStockHistory(input,'KO','1mo',time),/Not enough/);
});

test('history cache reuses fresh data without changing holdings and labels stale fallback',async()=>{
 const store=bucket({'dashboard.json':{holdings:[{ticker:'KO',shares:2}]}});let calls=0;
 const fetcher=async()=>{calls++;return response()};
 const first=await cachedStockHistory(store,'KO','1mo',{now:()=>time,fetcher});assert.equal(first.cached,false);
 const second=await cachedStockHistory(store,'KO','1mo',{now:()=>time+60000,fetcher});assert.equal(second.cached,true);assert.equal(calls,1);
 const stale=await cachedStockHistory(store,'KO','1mo',{now:()=>time+360000,fetcher:async()=>{throw Error('Offline')}});
 assert.equal(stale.stale,true);assert.equal(stale.fetchedAt,first.fetchedAt);assert.match(stale.notice,/cached/);
 assert.deepEqual(store.writes,['stock-history/v1/KO-1mo.json']);assert.equal(store.map.get('dashboard.json').holdings[0].shares,2);
 await assert.rejects(cachedStockHistory(store,'KO','1mo',{now:()=>time+8*86400000,fetcher:async()=>{throw Error('Offline')}}),/Offline/);
});

test('provider rate limits are respected across symbols and ranges',async()=>{
 const store=bucket();let calls=0;
 const fetcher=async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'1800'}})};
 await assert.rejects(cachedStockHistory(store,'KO','1y',{now:()=>time,fetcher}),/rate limited/);
 await assert.rejects(cachedStockHistory(store,'AMZN','1d',{now:()=>time+1000,fetcher}),/rate limited/);
 assert.equal(calls,1);assert.equal(store.map.get('stock-history/provider-cooldown.json').until,time+1800000);
});

test('concurrent chart requests share a provider fetch',async()=>{
 const store=bucket();let calls=0,release;
 const gate=new Promise(resolve=>{release=resolve});
 const fetcher=async()=>{calls++;await gate;return response()};
 const a=cachedStockHistory(store,'KO','3mo',{now:()=>time,fetcher});
 const b=cachedStockHistory(store,'KO','3mo',{now:()=>time,fetcher});
 await new Promise(resolve=>setTimeout(resolve,0));release();
 const [first,second]=await Promise.all([a,b]);assert.equal(calls,1);assert.deepEqual(first,second);
});
