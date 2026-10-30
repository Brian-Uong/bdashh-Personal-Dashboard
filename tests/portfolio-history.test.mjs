import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portfolioSnapshot,mergeSnapshots,compactSnapshots,recordPortfolioStates,readPortfolioHistory} from '../lib/portfolio-history.mjs';
import {historyWindow,historySummary,historyRows,historyShell} from '../public/dashboard/portfolio-history-data.mjs';
const now=Date.parse('2026-10-28T22:00:00Z');
const state=(price=12,offset=0)=>({holdings:[{ticker:'KO',shares:2.5,avgCost:10},{ticker:'AMZN',shares:1,avgCost:15}],quotes:{KO:{price,asOf:new Date(now+offset).toISOString(),currency:'USD'},AMZN:{price:20,asOf:new Date(now+offset).toISOString(),currency:'USD'}},updatedAt:new Date(now+offset).toISOString()});
function bucket(){let seq=0;const values=new Map(),writes=[];return {writes,async get(key){const v=values.get(key);return v?{etag:v.etag,json:async()=>structuredClone(v.data)}:null;},async put(key,body,options){const old=values.get(key),condition=options?.onlyIf;if(condition?.etagMatches&&condition.etagMatches!==old?.etag||condition?.etagDoesNotMatch==='*'&&old)return null;values.set(key,{etag:String(++seq),data:JSON.parse(body)});writes.push(key);return {etag:String(seq)};}};}
test('snapshots use saved shares and complete timestamped USD quotes',async()=>{
 const p=await portfolioSnapshot(state(),now);assert.equal(p.value,50);assert.equal(p.cost,40);assert.equal(p.count,2);assert.equal(p.time,now/1000);
 const reordered=state();reordered.holdings.reverse();assert.equal((await portfolioSnapshot(reordered,now)).valuationKey,p.valuationKey);
 for(const invalid of [null,NaN,-1,0]){const d=state();d.quotes.KO.price=invalid;assert.equal(await portfolioSnapshot(d,now),null);}
 const missing=state();delete missing.quotes.AMZN;assert.equal(await portfolioSnapshot(missing,now),null);
 const foreign=state();foreign.quotes.KO.currency='CAD';assert.equal(await portfolioSnapshot(foreign,now),null);
 const empty=await portfolioSnapshot({...state(),holdings:[]},now);assert.equal(empty.value,0);assert.equal(empty.count,0);assert.equal(empty.quoteOldest,null);
});
test('unchanged snapshots do not create synthetic history; all same-second entries collapse',async()=>{
 const a=await portfolioSnapshot(state(),now),b=await portfolioSnapshot(state(13,60000),now+60000),repeat={...b,time:b.time+10};
 assert.deepEqual(mergeSnapshots([a],[b,repeat]),[a,b]);
 assert.deepEqual(mergeSnapshots([a],[{...a,value:99,valuationKey:'new'}]).map(p=>p.value),[99]);
});
test('durable history is idempotent, retains concurrent snapshots and never writes dashboard.json',async()=>{
 const store=bucket();await recordPortfolioStates(store,[state()],{now:()=>now});await recordPortfolioStates(store,[state()],{now:()=>now});assert.equal(store.writes.length,1);
 await Promise.all([recordPortfolioStates(store,[state(13,60000)],{now:()=>now+60000}),recordPortfolioStates(store,[state(14,120000)],{now:()=>now+120000})]);
 const history=await readPortfolioHistory(store);assert.equal(history.points.length,3);assert.deepEqual(history.points.map(p=>p.value),[50,52.5,55]);assert.ok(store.writes.every(k=>k==='portfolio-history-v1.json'));
});
test('compaction retains daily history and holding changes',()=>{
 const start=now/1000-60*86400;
 const points=Array.from({length:12},(_,i)=>({time:start+i*60,value:i,cost:1,holdingsKey:i<6?'a':'b',valuationKey:String(i)}));
 const compact=compactSnapshots(points,now);assert.equal(compact[0],points[0]);assert.equal(compact.at(-1),points.at(-1));assert.ok(compact.includes(points[5]));assert.ok(compact.includes(points[6]));assert.ok(compact.length<points.length);
});
test('ranges filter real history without backfilling; holding edits suppress return percentages',()=>{
 const points=[{time:now/1000-400*86400,value:100,cost:80,holdingsKey:'a'},{time:now/1000-2*86400,value:110,cost:80,holdingsKey:'a'},{time:now/1000,value:121,cost:80,holdingsKey:'a'}];
 assert.equal(historyWindow(points,'1d',now).length,1);assert.equal(historyWindow(points,'1w',now).length,2);assert.equal(historyWindow(points,'1y',now).length,2);assert.equal(historyWindow(points,'all',now).length,3);
 assert.equal(historySummary(points.slice(-2)).percent,10);assert.equal(historySummary(points.slice(-1)).change,null);
 assert.equal(historySummary([points[0],{...points[2],holdingsKey:'changed'}]).percent,null);
 assert.equal(historySummary(points,'gain').latest,41);assert.equal(historyRows(points,'gain')[0].value,20);
 assert.match(historyShell(),/TradingView/);assert.match(historyShell(),/cash-flow-adjusted/);
});
