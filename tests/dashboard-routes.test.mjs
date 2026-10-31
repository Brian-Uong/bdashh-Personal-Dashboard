import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

let reads=0,writes=0;
const objects=new Map();
globalThis.__dashboardTestEnv={DASHBOARD_OWNER_EMAIL:'owner@example.test',DASHBOARD_SERVICE_TOKEN:'test-service-token',BUCKET:{
 async get(key){reads++;const value=objects.get(key);return value?{etag:'fixture',json:async()=>structuredClone(value)}:null;},
 async put(key,value){writes++;objects.set(key,JSON.parse(value));return {etag:'fixture'};}
}};
async function route(name){
 const path=new URL(`../app/api/${name}/route.ts`,import.meta.url);
 let code=await readFile(path,'utf8');
 code=code.replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/, 'const env=globalThis.__dashboardTestEnv;');
 code=code.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,relative)=>`from ${JSON.stringify(new URL(relative,path).href)}`);
 code=stripTypeScriptTypes(code,{mode:'strip'});
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}
const paths=['news','sync','records','holdings','quotes/refresh','portfolio/history','discovery','discovery/refresh','research'];
test('retired sports requests return gone without network or storage access',async()=>{
 const api=await route('sports/nba'),previous=globalThis.fetch,beforeReads=reads,beforeWrites=writes;
 let providerCalls=0;
 globalThis.fetch=async()=>{providerCalls++;throw Error('A retired feature must not call providers');};
 try{
  for(const method of ['GET','POST']){
   for(const headers of [{},{'X-Dashboard-Service-Authorization':'Bearer test-service-token'}]){
    const response=await api[method](new Request('https://dash.example/api/sports/nba',{method,headers}));
    assert.equal(response.status,410);assert.equal((await response.json()).code,'SPORTS_BETTING_REMOVED');
   }
  }
  assert.equal(providerCalls,0);assert.equal(reads,beforeReads);assert.equal(writes,beforeWrites);
 }finally{globalThis.fetch=previous;}
});
test('retired FC market requests return gone without network or storage access',async()=>{
 const api=await route('fc-market'),previous=globalThis.fetch,beforeReads=reads,beforeWrites=writes;
 globalThis.fetch=async()=>{throw Error('A retired feature must not call providers');};
 try{
  for(const method of ['GET','POST']){
   const response=await api[method](new Request('https://dash.example/api/fc-market',{method}));
   assert.equal(response.status,410);assert.equal((await response.json()).code,'FC_MARKET_REMOVED');
  }
  assert.equal(reads,beforeReads);assert.equal(writes,beforeWrites);
 }finally{globalThis.fetch=previous;}
});
test('every saved-data writer rejects anonymous and other signed-in visitors before touching storage',async()=>{
 for(const path of paths){
  const api=await route(path);
  for(const identity of [{},{'oai-authenticated-user-id':'viewer','oai-authenticated-user-email':'viewer@example.test'}]){
   const response=await api.POST(new Request(`https://dash.example/api/${path}`,{method:'POST',headers:{...identity,'Content-Type':'application/json'},body:'{}'}));
   assert.equal(response.status,403,path);assert.equal((await response.json()).code,'DASHBOARD_OWNER_REQUIRED');
  }
 }
 assert.equal(reads,0);assert.equal(writes,0);
});
test('owner and unattended service can save a briefing, while public reads remain available',async()=>{
 const api=await route('sync');
 for(const identity of [{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'},{'X-Dashboard-Service-Authorization':'Bearer test-service-token'}]){
  const response=await api.POST(new Request('https://dash.example/api/sync',{method:'POST',headers:{...identity,'Content-Type':'application/json'},body:JSON.stringify({briefing:{asOf:'2026-10-28T14:00:00Z',text:'Fixture briefing'}})}));
  assert.equal(response.status,200);assert.equal((await response.json()).briefing.text,'Fixture briefing');
 }
 assert.equal((await (await api.GET()).json()).briefing.text,'Fixture briefing');
 assert.equal(writes,2);
});
test('malformed updates and stale whole-workbook saves are rejected without writes',async()=>{
 const api=await route('sync'),headers={'X-Dashboard-Service-Authorization':'Bearer test-service-token','Content-Type':'application/json'},count=writes;
 for(const body of ['null','[]'])assert.equal((await api.POST(new Request('https://dash.example/api/sync',{method:'POST',headers,body}))).status,400);
 const state=objects.get('dashboard.json');const response=await api.POST(new Request('https://dash.example/api/sync',{method:'POST',headers,body:JSON.stringify({sheets:state.sheets,baseUpdatedAt:'2000-01-01T00:00:00Z'})}));
 assert.equal(response.status,409);assert.equal(writes,count);
});
test('nearby café search validates coordinates and reports upstream failures without inventing results',async()=>{
 const api=await route('places/nearby');const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw Error('must not fetch invalid location');};
  assert.equal((await api.GET(new Request('https://dash.example/api/places/nearby?lat=91&lon=0'))).status,400);
  globalThis.fetch=async()=>Response.json({features:[]});
  const result=await api.GET(new Request('https://dash.example/api/places/nearby?lat=33.65&lon=-117.74'));assert.equal(result.status,200);assert.deepEqual((await result.json()).features,[]);
  globalThis.fetch=async()=>new Response('busy',{status:429});
  assert.equal((await api.GET(new Request('https://dash.example/api/places/nearby?lat=33.65&lon=-117.74'))).status,429);
 }finally{globalThis.fetch=original;}
});
