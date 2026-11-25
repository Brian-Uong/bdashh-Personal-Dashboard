import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchQuote,parseNasdaqExtended,parseQuote,compareQuotes} from '../lib/market-quotes.mjs';
import {nasdaqTradingDay,nasdaqCalendarCoverage} from '../lib/nasdaq-calendar.mjs';
import {calendarCases,observe} from './fixtures/quote-calendar.mjs';
import {nasdaq,yahoo} from './fixtures/quote-freshness.mjs';

for(const scenario of calendarCases)test(scenario.name,async()=>{
 const result=await observe(fetchQuote,scenario);
 assert.deepEqual(result.observed,result.expected);
 if(scenario.name.startsWith('outside coverage'))assert.match(result.providerNotes,/outside verified 2026-11-01 to 2026-11-30/);
});

test('calendar distinguishes normal, closed, early-close and unverified dates',()=>{
 assert.deepEqual(nasdaqTradingDay('2026-11-25'),{kind:'normal',preOpen:240,regularOpen:570,regularClose:960,postClose:1200});
 assert.deepEqual(nasdaqTradingDay('2026-11-26'),{kind:'closed',reason:'Thanksgiving'});
 assert.deepEqual(nasdaqTradingDay('2026-11-27'),{kind:'early-close',preOpen:240,regularOpen:570,regularClose:780,postClose:1020});
 assert.equal(nasdaqTradingDay('2026-11-28').reason,'Weekend');
 for(const date of ['2026-10-31','2026-12-01','2027-11-26','2026-11-31','garbage'])assert.equal(nasdaqTradingDay(date),null);
 assert.equal(nasdaqCalendarCoverage.verifiedOn,'2026-11-19');
});

const at14=Date.parse('2026-11-27T19:00:00Z');
const closeInfo=()=>{const info=nasdaq(Date.parse('2026-11-27T18:00:00Z'),'Closed',100);info.data.primaryData.lastTradeTimestamp='Nov 27, 2026';return info;};
const extended=(date='Nov 27, 2026',rows=[{time:'13:58:00',price:'$102'}])=>({data:{
 lastUpdateInfo:[`Data last updated ${date} 05:00 PM ET.`,`This page will resume updating on Nov 30, 2026 04:00 PM ET.`],
 tradeDetailTable:{headers:{time:'After Hours Time (ET)'},rows}
}});

test('early-close extended feed accepts 13:58 and rejects rows beyond 17:00 exactly',()=>{
 const payload=extended('Nov 27, 2026',[{time:'17:00:01',price:'$999'},{time:'17:30:00',price:'$999'},
  {time:'12:59:59',price:'$999'},{time:'13:58:00',price:'$102'}]);
 const q=parseNasdaqExtended(payload,'NVDA',closeInfo(),'post',Date.parse('2026-11-27T23:00:00Z'));
 assert.equal(q.price,102);assert.equal(q.asOf,'2026-11-27T18:58:00.000Z');assert.equal(q.session,'After-Hours');
 const boundary=parseNasdaqExtended(extended('Nov 27, 2026',[{time:'17:00:00',price:'$103'}]),'NVDA',closeInfo(),'post',Date.parse('2026-11-27T23:00:00Z'));
 assert.equal(boundary.asOf,'2026-11-27T22:00:00.000Z');
});

test('early-close extended trade beats date-only close without requiring Yahoo',async()=>{
 const calls=[],payload=extended();payload.data.lastUpdateInfo[0]='Data last updated Nov 27, 2026 02:00 PM ET.';
 const q=await fetchQuote('NVDA',{now:()=>at14,fetcher:async url=>{
  calls.push(url.includes('/info?')?'Nasdaq':'Nasdaq extended');
  if(url.includes('/info?'))return Response.json(closeInfo());
  if(url.includes('/extended-trading?'))return Response.json(payload);
  throw Error('Unexpected Yahoo request');
 }});
 assert.equal(q.asOf,'2026-11-27T18:58:00.000Z');assert.equal(q.price,102);
 assert.deepEqual(calls,['Nasdaq','Nasdaq extended']);
 assert.equal(compareQuotes(q,{price:100,asOf:'2026-11-27',session:'Regular close'}),1);
});

test('Yahoo minute samples after the early close are labeled After-Hours',()=>{
 const payload=yahoo(Date.parse('2026-11-27T18:00:00Z'),100);
 Object.assign(payload.chart.result[0],{timestamp:[Date.parse('2026-11-27T18:58:00Z')/1000],indicators:{quote:[{close:[102]}]}});
 const q=parseQuote(payload,'NVDA',at14);
 assert.equal(q.session,'After-Hours');assert.equal(q.price,102);
 assert.equal(compareQuotes(q,{price:100,asOf:'2026-11-27',session:'Regular close'}),1);
 assert.equal(compareQuotes({price:102,asOf:q.asOf},{price:100,asOf:'2026-11-27',session:'Regular close'}),1);
});

test('holiday refresh accepts preceding-session extended trades, not holiday-dated rows',()=>{
 const info=nasdaq(Date.parse('2026-11-25T21:00:00Z'),'Closed');
 const time=Date.parse('2026-11-26T23:00:00Z');
 const previous=parseNasdaqExtended(extended('Nov 25, 2026',[{time:'16:58:00',price:'$102'}]),'NVDA',info,'post',time);
 assert.equal(previous.asOf,'2026-11-25T21:58:00.000Z');
 assert.throws(()=>parseNasdaqExtended(extended('Nov 26, 2026',[{time:'16:58:00',price:'$999'}]),'NVDA',info,'post',time),/exchange closure/);
});

test('early-close fallback 429 preserves quote and cooldown until server delay expires',async()=>{
 let time=at14,backupCalls=0;
 const cooldowns={};
 const options={now:()=>time,cooldowns,fetcher:async url=>{
  if(url.includes('/info?'))return Response.json(nasdaq(time-90*60000,'After-Hours'));
  backupCalls++;
  return backupCalls===1?new Response('',{status:429,headers:{'retry-after':'1200'}}):Response.json(yahoo(time-60000));
 }};
 const q=await fetchQuote('NVDA',options);
 assert.equal(q.price,100);assert.equal(q.asOf,'2026-11-27T17:30:00.000Z');assert.match(q.providerNotes,/429/);
 assert.equal(cooldowns['Yahoo Finance'],'2026-11-27T19:20:00.000Z');
 time=at14+1199999;await fetchQuote('NVDA',options);assert.equal(backupCalls,1);
 time++;assert.equal((await fetchQuote('NVDA',options)).source,'Yahoo Finance');assert.equal(backupCalls,2);
});

test('holiday does not disable pre-existing failure fallback or a newer saved-quote check',async()=>{
 const time=Date.parse('2026-11-26T18:00:00Z'),trade=Date.parse('2026-11-25T21:00:00Z');
 const seen=[];
 const q=await fetchQuote('NVDA',{now:()=>time,fetcher:async url=>{
  seen.push(url.includes('/info?')?'Nasdaq':'Yahoo Finance');
  return url.includes('/info?')?new Response('',{status:503}):Response.json(yahoo(trade));
 }});
 assert.deepEqual(seen,['Nasdaq','Yahoo Finance']);assert.equal(q.asOf,new Date(trade).toISOString());
 const scenario={name:'holiday with older primary than saved',config:{time,age:1500,previous:{price:101,asOf:'2026-11-25T17:59:00Z'},fallbackAge:1260},source:'Yahoo Finance',calls:['Nasdaq','Yahoo Finance']};
 const result=await observe(fetchQuote,scenario);assert.deepEqual(result.observed,result.expected);
});

test('early-close deadline prevents a fallback even when the calendar permits it',async()=>{
 let time=at14,calls=0;
 const q=await fetchQuote('NVDA',{now:()=>time,deadline:at14+1000,fetcher:async()=>{
  calls++;time+=1000;return Response.json(nasdaq(at14-90*60000,'After-Hours'));
 }});
 assert.equal(calls,1);assert.equal(q.price,100);assert.match(q.providerNotes,/budget/);
});
