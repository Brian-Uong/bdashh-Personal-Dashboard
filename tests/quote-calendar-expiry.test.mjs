import test from 'node:test';
import assert from 'node:assert/strict';
import {expiryCases,observeExpiry} from '../scripts/quote-expiry-evidence.mjs';
import {nasdaqCalendarState,nasdaqCalendarCoverage} from '../lib/nasdaq-calendar.mjs';
import {quoteFreshness,quoteRefreshStatus,quoteRefreshSummary,refreshQuoteStatusLabels} from '../public/dashboard/quote-status.mjs';
import {fetchQuote} from '../lib/market-quotes.mjs';
import {nasdaq,yahoo} from './fixtures/quote-freshness.mjs';
const root=new URL('..',import.meta.url).pathname;
const covered=Date.parse('2026-11-30T18:00:00Z'),expired=Date.parse('2026-12-01T18:00:00Z');
// No test in this process may accidentally contact a live endpoint.
globalThis.fetch=()=>{throw Error('Unmocked network forbidden');};
for(const scenario of expiryCases)test(scenario.name,async()=>{
 const result=await observeExpiry(root,scenario);
 assert.equal(result.passed,true,JSON.stringify(result,null,2));
 assert.doesNotMatch(result.displayedStatus,/Verified unchanged/);
 if(scenario.calendar!=='covered')assert.match(result.displayedFreshness,/Calendar (expired|unverified)/);
});

test('Eastern coverage has exact millisecond expiry and a version',()=>{
 assert.equal(nasdaqCalendarState(Date.parse('2026-12-01T04:59:59.999Z')).status,'covered');
 const after=nasdaqCalendarState(Date.parse('2026-12-01T05:00:00.000Z'));
 assert.equal(after.status,'expired');assert.equal(after.date,'2026-12-01');assert.equal(after.tradingDay,null);
 assert.equal(after.version,'nasdaq-2026-11-r1');assert.equal(after.end,'2026-11-30');
 assert.equal(nasdaqCalendarState(NaN).status,'invalid');
 assert.equal(nasdaqCalendarState(Date.parse('2026-11-01T04:00:00Z')).status,'covered');
 assert.equal(nasdaqCalendarState(Date.parse('2026-11-01T03:59:59.999Z')).status,'not-covered');
});

test('quote refresh never renews or extends the immutable calendar',async()=>{
 const before=JSON.stringify(nasdaqCalendarCoverage);
 for(const now of [covered,expired]){
  const q=await fetchQuote('NVDA',{now:()=>now,fetcher:async()=>Response.json(nasdaq(now-60000))});
  assert.equal(q.checkedAt,new Date(now).toISOString());assert.equal(q.calendar.end,'2026-11-30');
  assert.equal(q.calendar.status,now===covered?'covered':'expired');
 }
 assert.equal(JSON.stringify(nasdaqCalendarCoverage),before);assert.ok(Object.isFrozen(nasdaqCalendarCoverage));
});

test('expiry is computed from current time, ignoring cached coverage claims and checkedAt',()=>{
 const q={price:100,asOf:'2026-11-30T23:59:00Z',calendar:{status:'covered',end:'2099-01-01'},checkedAt:'2099-01-01T00:00:00Z'};
 const state={quotes:{NVDA:q},quoteRefresh:{checkedAt:q.checkedAt,calendar:q.calendar,unchanged:['NVDA']}};
 assert.match(quoteFreshness(q,expired),/Calendar expired after 2026-11-30/);
 assert.match(quoteRefreshStatus('NVDA',state,expired),/Calendar expired/);
 assert.match(quoteRefreshSummary(state,expired),/Calendar expired/);
 assert.doesNotMatch(quoteRefreshSummary(state,expired),/verified unchanged/i);
});

test('visible status updates across midnight without reload or provider traffic',()=>{
 const q={price:100,asOf:'2026-12-01T00:00:00Z'},state={quotes:{NVDA:q},quoteRefresh:{unchanged:['NVDA'],checkedAt:'2026-12-01T04:59:00Z'}};
 const ageNode={dataset:{quoteFreshness:'NVDA'},textContent:''},detail={dataset:{quoteRefreshStatus:'NVDA'},textContent:''},summary={textContent:''};
 const root={querySelectorAll:selector=>selector==='[data-quote-freshness]'?[ageNode]:[detail],querySelector:()=>summary};
 const snapshot=JSON.stringify(state);
 refreshQuoteStatusLabels(state,root,Date.parse('2026-12-01T04:59:59.999Z'));
 assert.doesNotMatch(ageNode.textContent,/Calendar expired/);
 refreshQuoteStatusLabels(state,root,Date.parse('2026-12-01T05:00:00Z'));
 for(const node of [ageNode,detail,summary])assert.match(node.textContent,/Calendar expired/);
 assert.equal(JSON.stringify(state),snapshot);
});

test('display distinguishes missing/date-only/future/old/recent quotes without fabricating precision',()=>{
 assert.match(quoteFreshness(null,expired),/No saved quote.*Calendar expired/);
 assert.match(quoteFreshness({asOf:'2026-12-01'},expired),/Date-only.*Calendar expired/);
 assert.match(quoteFreshness({asOf:'invalid'},expired),/time unavailable/);
 assert.match(quoteFreshness({asOf:new Date(expired+60000).toISOString()},expired),/ahead.*unverified/);
 assert.doesNotMatch(quoteFreshness({asOf:new Date(covered-20*60000).toISOString()},covered),/older than/);
 assert.match(quoteFreshness({asOf:new Date(covered-20*60000-1).toISOString()},covered),/older than 20 minutes/);
 assert.match(quoteFreshness({asOf:new Date(covered-2*60000).toISOString()},covered),/Last trade 2 min ago/);
});

test('holiday and early-close display stays calendar-aware',()=>{
 const q={asOf:'2026-11-25T21:00:00Z'};
 for(const now of ['2026-11-26T18:00:00Z','2026-11-27T22:00:00Z'])assert.match(quoteFreshness(q,Date.parse(now)),/Outside scheduled trading hours/);
 assert.match(quoteFreshness(q,Date.parse('2026-11-27T21:59:59Z')),/older than 20 minutes/);
});

test('429 cooldown crosses calendar expiry; only eligible failure fallback resumes at exact cooldown end',async()=>{
 let time=Date.parse('2026-12-01T04:55:00Z'),yahooCalls=0;const cooldowns={};
 const options={now:()=>time,cooldowns,fetcher:async url=>{
  if(url.includes('/info?'))return new Response('',{status:503});
  yahooCalls++;return yahooCalls===1?new Response('',{status:429,headers:{'retry-after':'1200'}}):Response.json(yahoo(time-60000));
 }};
 await assert.rejects(fetchQuote('NVDA',options),/HTTP 429/);
 const deadline=Date.parse(cooldowns['Yahoo Finance']);assert.equal(deadline,Date.parse('2026-12-01T05:15:00Z'));
 time=Date.parse('2026-12-01T05:00:00Z');await assert.rejects(fetchQuote('NVDA',options),/cooling down/);assert.equal(yahooCalls,1);
 time=deadline-1;await assert.rejects(fetchQuote('NVDA',options),/cooling down/);assert.equal(yahooCalls,1);
 time=deadline;const q=await fetchQuote('NVDA',options);assert.equal(yahooCalls,2);assert.equal(q.calendar.status,'expired');
 assert.equal(q.asOf,new Date(time-60000).toISOString());
});

test('request crossing expiry does not use eligibility from the request start',async()=>{
 let time=Date.parse('2026-12-01T04:59:59Z'),calls=0;
 const q=await fetchQuote('NVDA',{now:()=>time,fetcher:async()=>{
  calls++;time=Date.parse('2026-12-01T05:00:00Z');return Response.json(nasdaq(time-90*60000));
 }});
 assert.equal(calls,1);assert.equal(q.calendar.status,'expired');assert.match(q.providerNotes,/age-only fallback disabled/);
});

test('45-second cached refresh returns current calendar expiry without spending another request',async()=>{
 const result=await observeExpiry(root,{name:'cached refresh crosses midnight',at:'2026-12-01T04:59:50Z',repeatAt:'2026-12-01T05:00:00Z',calls:['Nasdaq'],price:100,age:90,calendar:'covered'});
 assert.equal(result.passed,true);assert.equal(result.state.quoteRefresh.calendar.status,'covered');
 assert.equal(result.repeat.quoteRefresh.calendar.status,'expired');
 assert.equal(result.repeat.quoteRefresh.checkedAt,result.state.quoteRefresh.checkedAt);
 assert.deepEqual(result.repeat.quotes,result.state.quotes);assert.deepEqual(result.observed.calls,['Nasdaq']);
});

test('clock repaint retains a failed refresh message while adding expiry warning',()=>{
 const summary={dataset:{refreshError:'Controlled timeout'},textContent:''};
 refreshQuoteStatusLabels({quotes:{}},{querySelectorAll:()=>[],querySelector:()=>summary},expired);
 assert.match(summary.textContent,/Refresh failed.*Controlled timeout.*Calendar expired/);
});
