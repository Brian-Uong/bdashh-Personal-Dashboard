import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addSavedHolding,changeSavedHolding,validateHolding,validateHoldingChange,mergeCooldowns} from '../lib/holdings.mjs';
import {portfolioStats,renderPortfolioCharts} from '../public/dashboard/portfolio-charts.mjs';
const now=()=>Date.parse('2026-10-29T03:00:00Z');
const original={holdings:[{ticker:'KO',shares:1,avgCost:80}],quotes:{KO:{price:91,asOf:'2026-10-28T22:00:00Z',currency:'USD'}},sheets:{Custom:[['Untouched']]},briefing:{asOf:'2026-10-28T22:00:00Z',text:'Saved briefing'},updatedAt:'2026-10-28T22:00:00Z'};
function bucket(seed=original){let sequence=0;const map=new Map([['dashboard.json',{data:structuredClone(seed),etag:'0'}]]);return {async get(key){const object=map.get(key);return object?{etag:object.etag,json:async()=>structuredClone(object.data)}:null},async put(key,body,{onlyIf}={}){const old=map.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++sequence);map.set(key,{data:JSON.parse(body),etag});return {etag};}};}
const input=(ticker='MSFT',requestId='request-id-00001')=>({ticker,shares:2.75,avgCost:400,requestId});
const quote=async ticker=>({price:430,asOf:'2026-10-28',timePrecision:'day',currency:'USD',source:'Test provider',company:ticker+' company'});
test('validates and normalizes a single holding without accepting bad or empty numbers',()=>{
 assert.equal(validateHolding(input(' msft ')).ticker,'MSFT');assert.equal(validateHolding({...input(),avgCost:0}).avgCost,0);
 for(const bad of [{ticker:'<script>'},{shares:0},{shares:-1},{shares:Infinity},{shares:'2'},{avgCost:-1},{avgCost:NaN},{requestId:''}])assert.throws(()=>validateHolding({...input(),...bad}));
});
test('adding a stock preserves all existing positions, custom sheets and briefing while populating its quote and workbook',async()=>{
 const store=bucket(),added=await addSavedHolding(store,input(),{lookup:quote,now});
 assert.deepEqual(added.state.holdings[0],original.holdings[0]);assert.equal(added.state.holdings[1].shares,2.75);assert.equal(added.state.quotes.MSFT.price,430);
 assert.deepEqual(added.state.briefing,original.briefing);assert.deepEqual(added.state.sheets.Custom,original.sheets.Custom);assert.equal(added.state.sheets.Holdings.at(-1)[0],'MSFT');assert.equal(added.added.quoteAvailable,true);
 const history=await (await store.get('portfolio-history-v1.json')).json();assert.equal(history.points.at(-1).value,1273.5);assert.equal(history.points.at(-1).quoteOldest,'2026-10-28');
});
test('retrying a completed request never adds twice or performs another quote lookup',async()=>{
 const store=bucket();let calls=0;const lookup=async t=>{calls++;return quote(t)};
 await addSavedHolding(store,input(),{lookup,now});const result=await addSavedHolding(store,input(),{lookup,now});assert.equal(result.state.holdings.length,2);assert.equal(result.added.replayed,true);assert.equal(calls,1);
 await assert.rejects(addSavedHolding(store,{...input(),shares:3},{lookup,now}),/different details/);
 await assert.rejects(addSavedHolding(store,input('MSFT','request-id-other'),{lookup,now}),/already in your holdings/);assert.equal(calls,1);
});
test('concurrent additions merge without losing either holding',async()=>{
 const store=bucket();await Promise.all([addSavedHolding(store,input(),{lookup:quote,now}),addSavedHolding(store,input('NVDA','request-id-00002'),{lookup:quote,now})]);
 const state=await (await store.get('dashboard.json')).json();assert.deepEqual(state.holdings.map(h=>h.ticker).sort(),['KO','MSFT','NVDA']);
});
test('unavailable market data does not discard the holding or invent a price',async()=>{
 const store=bucket();const result=await addSavedHolding(store,input(),{now,lookup:async(t,{cooldowns})=>{cooldowns.Test='2026-10-29T04:00:00Z';throw Error('Provider unavailable')}});
 assert.equal(result.state.holdings.length,2);assert.equal(result.state.quotes.MSFT,undefined);assert.equal(result.added.quoteAvailable,false);assert.equal(result.added.quoteError,'Provider unavailable');assert.equal(result.state.quoteProviderCooldowns.Test,'2026-10-29T04:00:00Z');
 assert.deepEqual(mergeCooldowns({Test:'2026-10-29T04:00:00Z'},{Test:'2026-10-29T03:00:00Z'}),{Test:'2026-10-29T04:00:00Z'});
});

const change=(action='update',overrides={})=>({action,ticker:'KO',base:{shares:1,avgCost:80},shares:2.5,avgCost:85,requestId:'request-change-0001',...overrides});
test('editing a selected holding synchronizes cost, value, workbook and history without replacing unrelated data',async()=>{
 const seed=structuredClone(original);seed.holdings.push({ticker:'MSFT',shares:2,avgCost:400});seed.quotes.MSFT=await quote('MSFT');
 const store=bucket(seed),result=await changeSavedHolding(store,change(),{now}),state=result.state,stats=portfolioStats(state);
 assert.deepEqual(state.holdings,[{ticker:'KO',shares:2.5,avgCost:85},seed.holdings[1]]);
 assert.deepEqual(state.quotes,seed.quotes);assert.deepEqual(state.sheets.Custom,seed.sheets.Custom);assert.deepEqual(state.briefing,seed.briefing);
 assert.deepEqual(state.sheets.Holdings[1].slice(0,5),['KO','',2.5,85,91]);
 assert.equal(stats.value,1087.5);assert.equal(stats.cost,1012.5);assert.equal(stats.rows[0].gain,15);
 assert.match(renderPortfolioCharts(state),/KO market value: \$227.50/);
 const history=await (await store.get('portfolio-history-v1.json')).json();assert.equal(history.points.at(-1).value,stats.value);assert.equal(history.points.at(-1).cost,stats.cost);assert.equal(history.points[0].value,951);
});

test('adding fractional shares computes weighted cost and retrying a lost response never adds them twice',async()=>{
 const store=bucket(),input=change('add_shares',{shares:0.5,avgCost:100});
 const first=await changeSavedHolding(store,input,{now});assert.equal(first.state.holdings[0].shares,1.5);assert.ok(Math.abs(first.state.holdings[0].avgCost-130/1.5)<1e-12);
 const replay=await changeSavedHolding(store,input,{now});assert.equal(replay.changed.replayed,true);assert.deepEqual(replay.state.holdings,first.state.holdings);
 const zero=await changeSavedHolding(store,change('add_shares',{base:first.state.holdings[0],shares:0.5,avgCost:0,requestId:'request-change-0002'}),{now});
 assert.equal(zero.state.holdings[0].shares,2);assert.equal(zero.state.holdings[0].avgCost,65);
 await assert.rejects(changeSavedHolding(store,{...input,shares:5},{now}),/different details/);
 await assert.rejects(addSavedHolding(store,{...input,ticker:'NVDA'},{lookup:quote,now}),/different details/);
});

test('concurrent edits to separate positions merge while stale changes to the same stock are rejected',async()=>{
 const seed=structuredClone(original);seed.holdings.push({ticker:'MSFT',shares:2,avgCost:400});seed.quotes.MSFT=await quote('MSFT');const store=bucket(seed);
 await Promise.all([changeSavedHolding(store,change(),{now}),changeSavedHolding(store,change('update',{ticker:'MSFT',base:{shares:2,avgCost:400},shares:3,avgCost:405,requestId:'request-change-other'}),{now})]);
 const saved=await (await store.get('dashboard.json')).json();assert.deepEqual(saved.holdings.map(h=>h.shares),[2.5,3]);
 for(const action of ['update','add_shares','remove'])await assert.rejects(changeSavedHolding(store,change(action,{requestId:'request-stale-0001'}),{now}),/changed elsewhere/);
 assert.deepEqual((await (await store.get('dashboard.json')).json()).holdings,saved.holdings);
});

test('removing the last stock records zero current holdings, retains earlier history and safely replays',async()=>{
 const store=bucket(),input=change('remove');const result=await changeSavedHolding(store,input,{now});
 assert.deepEqual(result.state.holdings,[]);assert.equal(result.state.sheets.Holdings.length,1);assert.deepEqual(result.state.sheets.Custom,original.sheets.Custom);
 const history=await (await store.get('portfolio-history-v1.json')).json();assert.equal(history.points[0].value,91);assert.equal(history.points.at(-1).value,0);assert.equal(history.points.at(-1).count,0);
 const again=await changeSavedHolding(store,input,{now});assert.equal(again.changed.replayed,true);assert.deepEqual(again.state.holdings,[]);
 await assert.rejects(changeSavedHolding(store,change('remove',{requestId:'another-request-001'}),{now}),/no longer/);
 // Re-adding a removed stock does not let an old remove retry delete it again.
 await addSavedHolding(store,inputForReAdd(),{lookup:quote,now});
 const retried=await changeSavedHolding(store,input,{now});assert.equal(retried.state.holdings.length,1);
});
const inputForReAdd=()=>({ticker:'KO',shares:4,avgCost:90,requestId:'request-readd-0001'});

test('holding changes reject missing bases, invalid numbers and unknown actions before saving',async()=>{
 for(const bad of [{action:'wipe'},{base:null},{base:{shares:-1,avgCost:0}},{shares:0},{shares:'3'},{avgCost:-1},{requestId:''},{ticker:'<script>'}])assert.throws(()=>validateHoldingChange(change('update',bad)));
 const store=bucket();await assert.rejects(changeSavedHolding(store,change('add_shares',{shares:1e308,avgCost:1}),{now}),/too large/);
 assert.deepEqual((await (await store.get('dashboard.json')).json()).holdings,original.holdings);
});

test('legacy zero-share holdings can be removed or updated through their stock controls',async()=>{
 const seed={...structuredClone(original),holdings:[{ticker:'KO',shares:0,avgCost:80}]};
 for(const action of ['remove','update','add_shares']){
  const result=await changeSavedHolding(bucket(seed),change(action,{base:{shares:0,avgCost:80},shares:2,avgCost:90}),{now});
  assert.deepEqual(result.state.holdings,action==='remove'?[]:[{ticker:'KO',shares:2,avgCost:90}]);
 }
});
