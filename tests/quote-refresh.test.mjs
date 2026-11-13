import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {grantVerifiedOwner} from '../lib/dashboard-access.mjs';
const env={DASHBOARD_SERVICE_TOKEN:'test-afterhours-token'};
globalThis.__afterhoursTestEnv=env;
const path=new URL('../app/api/quotes/refresh/route.ts',import.meta.url);
let code=(await readFile(path,'utf8')).replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/,'const env=globalThis.__afterhoursTestEnv;');
code=code.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,relative)=>`from ${JSON.stringify(new URL(relative,path).href)}`);
const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'strip'})).toString('base64'));
const clock=Date.parse('2026-11-13T03:00:00Z');
const seed=()=>({holdings:[{ticker:'NVDA',shares:1.25,avgCost:150}],quotes:{NVDA:{price:164.44,asOf:'2026-11-12T18:52:00.000Z',session:'Regular session'}},sheets:{Custom:[['Keep my notes']]},briefing:{asOf:'2026-11-12',text:'Keep my report'},updatedAt:'2026-11-12T18:53:00Z'});
class Bucket{
 data=new Map();sequence=0;
 async get(key){const r=this.data.get(key);return r?{etag:r.etag,json:async()=>structuredClone(r.value),text:async()=>JSON.stringify(r.value)}:null;}
 async put(key,body,{onlyIf}={}){const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.sequence);this.data.set(key,{value:JSON.parse(body),etag});return {etag};}
}
const closed={data:{symbol:'NVDA',assetClass:'STOCKS',companyName:'NVIDIA',marketStatus:'Closed',primaryData:{lastSalePrice:'$166.19',netChange:'-7.54',lastTradeTimestamp:'Nov 12, 2026'}}};
const request=()=>{const req=new Request('https://dashboard.test/api/quotes/refresh',{method:'POST'});grantVerifiedOwner(req);return req;};
async function run(initial,fetcher,check){const previousFetch=globalThis.fetch,previousNow=Date.now;env.BUCKET=new Bucket();await env.BUCKET.put('dashboard.json',JSON.stringify(initial));globalThis.fetch=fetcher;Date.now=()=>clock;try{await check(await route.POST(request()),env.BUCKET);}finally{globalThis.fetch=previousFetch;Date.now=previousNow;}}
test('after closing, date-only fallback updates older intraday quotes and preserves portfolio and notes',async()=>{
 const before=seed();let calls=0;
 await run(before,async url=>{calls++;return url.includes('/info?')?Response.json(closed):new Response('',{status:503});},async(response,bucket)=>{
  assert.equal(response.status,200);const state=await response.json();assert.equal(state.quotes.NVDA.price,166.19);assert.equal(state.quotes.NVDA.asOf,'2026-11-12');assert.deepEqual(state.quoteRefresh.updated,['NVDA']);assert.deepEqual(state.quoteRefresh.failed,[]);assert.deepEqual(state.holdings,before.holdings);assert.deepEqual(state.sheets.Custom,before.sheets.Custom);assert.deepEqual(state.briefing,before.briefing);
  const checked=calls;const repeat=await (await route.POST(request())).json();assert.match(repeat.refreshNotice,/45 seconds/);assert.equal(calls,checked);assert.equal((await (await bucket.get('quote-refresh-lock.json')).json()).until,0);
 });
});
test('older provider data retains an extended-hours saved price without falsely reporting a failed refresh',async()=>{
 const before=seed();before.quotes.NVDA={price:167.82,asOf:'2026-11-13T00:59:59.000Z',session:'After-Hours'};
 await run(before,async url=>url.includes('/info?')?Response.json(closed):new Response('',{status:503}),async response=>{
  const state=await response.json();assert.deepEqual(state.quotes.NVDA,before.quotes.NVDA);assert.deepEqual(state.quoteRefresh.retained,['NVDA']);assert.deepEqual(state.quoteRefresh.failed,[]);assert.deepEqual(state.quoteRefresh.errors,{});
 });
});
test('a genuine provider outage remains a failure and does not alter saved prices',async()=>{
 const before=seed();await run(before,async()=>new Response('',{status:503}),async response=>{
  const state=await response.json();assert.deepEqual(state.quotes,before.quotes);assert.deepEqual(state.quoteRefresh.failed,['NVDA']);assert.match(state.quoteRefresh.errors.NVDA,/503/);
 });
});
test('a concurrent newer quote and note edit are retained during refresh merge',async()=>{
 const before=seed();let changed=false;
 await run(before,async url=>{if(!changed){changed=true;const latest=structuredClone(before);latest.quotes.NVDA={price:168,asOf:'2026-11-13T01:00:00Z',session:'After-Hours'};latest.sheets.Custom=[['Edited in another tab']];await env.BUCKET.put('dashboard.json',JSON.stringify(latest));}return url.includes('/info?')?Response.json(closed):new Response('',{status:503});},async response=>{
  const state=await response.json();assert.equal(state.quotes.NVDA.price,168);assert.deepEqual(state.sheets.Custom,[['Edited in another tab']]);assert.deepEqual(state.quoteRefresh.retained,['NVDA']);
 });
});
