import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_KEY,siteSettingsRoute,runtimeEnv,loadSiteSettings} from '../lib/site-settings.mjs';
import {grantVerifiedOwner} from '../lib/dashboard-access.mjs';
import {runResearch,requestResearch,runSchedule} from '../lib/ai-research.mjs';
class Bucket{
  data=new Map();version=0;
  async get(key){const item=this.data.get(key);return item?{etag:item.etag,json:async()=>structuredClone(item.value)}:null;}
  async put(key,value,{onlyIf}={}){const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.version);this.data.set(key,{etag,value:JSON.parse(value)});return {etag};}
}
const initial={schemaVersion:1,revision:1,publicReadOnly:true,aiEnabled:false,dailyResearchEnabled:false,updatedAt:'2026-10-30T00:00:00Z'};
async function setup(){const BUCKET=new Bucket();await BUCKET.put(SETTINGS_KEY,JSON.stringify(initial));await BUCKET.put('dashboard.json',JSON.stringify({holdings:[{ticker:'KO',shares:1,avgCost:2}],quotes:{},sheets:{},briefing:{text:'saved'}}));return {BUCKET,OWNER_CONTROLS_ENABLED:'true',AI_SCHEDULE_AVAILABLE:'true',CONTROLLED_AI_MODEL:'gpt-5-mini',OPENAI_API_KEY:'never-expose-this-test-key',OPENAI_MODEL:'',ENABLE_DAILY_BRIEFING:'false',ENABLE_DAILY_CAREER:'false',PUBLIC_READ_ONLY:'true'};}
const request=(body,{owner=true,origin='https://bdashh.com'}={})=>{const r=new Request('https://bdashh.com/api/site-settings',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});if(owner)grantVerifiedOwner(r);return r;};

test('settings require owner identity and exact origin before touching storage',async()=>{
  let calls=0;const route=siteSettingsRoute({BUCKET:{get(){calls++;throw Error('must not read');}}});
  assert.equal((await route.GET(new Request('https://bdashh.com/api/site-settings'))).status,403);
  for(const options of [{owner:false},{origin:'https://evil.test'},{origin:null}])assert.equal((await route.POST(request({revision:1,aiEnabled:true},options))).status,403);
  assert.equal(calls,0);
});
test('privacy and AI toggles persist independently without changing saved dashboard data',async()=>{
  const env=await setup(),route=siteSettingsRoute(env),before=await(await env.BUCKET.get('dashboard.json')).json();
  let r=await route.POST(request({revision:1,publicReadOnly:false}));assert.equal(r.status,200);let s=await r.json();assert.equal(s.publicReadOnly,false);assert.equal(s.aiEnabled,false);
  r=await route.POST(request({revision:s.revision,aiEnabled:true}));s=await r.json();assert.equal(s.aiEnabled,true);assert.equal(s.dailyResearchEnabled,false);assert.equal(s.publicReadOnly,false);
  const live=await runtimeEnv(env);assert.equal(live.PUBLIC_READ_ONLY,'false');assert.equal(live.OPENAI_MODEL,'gpt-5-mini');assert.equal(live.ENABLE_DAILY_BRIEFING,'false');
  assert.deepEqual(await(await env.BUCKET.get('dashboard.json')).json(),before);
  assert.equal(JSON.stringify(s).includes(env.OPENAI_API_KEY),false);
});
test('turning AI off disables daily research and later on does not silently resume it',async()=>{
  const env=await setup(),route=siteSettingsRoute(env);let s=await(await route.POST(request({revision:1,aiEnabled:true,dailyResearchEnabled:true}))).json();
  assert.equal((await runtimeEnv(env)).ENABLE_DAILY_CAREER,'true');
  s=await(await route.POST(request({revision:s.revision,aiEnabled:false}))).json();assert.equal(s.dailyResearchEnabled,false);assert.equal((await runtimeEnv(env)).OPENAI_MODEL,'');
  s=await(await route.POST(request({revision:s.revision,aiEnabled:true}))).json();assert.equal(s.dailyResearchEnabled,false);
});
test('stale or concurrent settings saves cannot overwrite another owner window',async()=>{
  const env=await setup(),route=siteSettingsRoute(env);
  const responses=await Promise.all([route.POST(request({revision:1,publicReadOnly:false})),route.POST(request({revision:1,aiEnabled:true}))]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await loadSiteSettings(env)).revision,2);
  assert.equal((await route.POST(request({revision:1,aiEnabled:false}))).status,409);
});
test('missing or corrupt settings fail closed; malformed patches and missing capabilities are rejected',async()=>{
  const env=await setup();env.BUCKET.data.delete(SETTINGS_KEY);let e=await runtimeEnv(env);assert.equal(e.PUBLIC_READ_ONLY,'false');assert.equal(e.OPENAI_MODEL,'');
  await env.BUCKET.put(SETTINGS_KEY,JSON.stringify({...initial,publicReadOnly:'true'}));await assert.rejects(runtimeEnv(env),/could not load/);
  await env.BUCKET.put(SETTINGS_KEY,JSON.stringify(initial));const route=siteSettingsRoute(env);
  for(const patch of [{revision:1,aiEnabled:'true'},{revision:1},{revision:1,OPENAI_API_KEY:'injected'},{revision:1,publicReadOnly:true,unexpected:true}])assert.equal((await route.POST(request(patch))).status,400);
  assert.equal((await siteSettingsRoute({...env,OPENAI_API_KEY:''}).POST(request({revision:1,aiEnabled:true}))).status,409);
  assert.equal((await siteSettingsRoute({...env,AI_SCHEDULE_AVAILABLE:'false'}).POST(request({revision:1,aiEnabled:true,dailyResearchEnabled:true}))).status,409);
});
test('AI off prevents manual and scheduled provider calls, including with a stale enabled environment',async()=>{
  const env=await setup();let calls=0;const hooks={fetcher:async()=>{calls++;throw Error('must not call provider');},researcher:async()=>{calls++;throw Error('must not research');}};
  const stale={...env,OPENAI_MODEL:'gpt-5-mini',SITE_AI_ENABLED:'true',ENABLE_DAILY_BRIEFING:'true',ENABLE_DAILY_CAREER:'true'};
  for(const kind of ['briefing','career','news'])await assert.rejects(runResearch(stale,kind,hooks),/turned off/);
  await assert.rejects(requestResearch(stale,'briefing',{},hooks),/turned off/);
  await runSchedule(stale,Date.parse('2026-10-30T14:00:00Z'),{runner:async()=>calls++,beforeBriefing:async()=>calls++});
  assert.equal(calls,0);assert.equal([...env.BUCKET.data.keys()].some(k=>k.startsWith('ai-runs/')),false);
});
test('enabled manual AI reaches only the injected provider and daily research obeys its separate switch',async()=>{
  const env=await setup();await siteSettingsRoute(env).POST(request({revision:1,aiEnabled:true}));let calls=0;
  await assert.rejects(requestResearch(env,'briefing',{}, {fetcher:async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(init.body).model,'gpt-5-mini');return new Response(null,{status:503});}}),/provider request failed/);
  assert.equal(calls,1);
  await runSchedule(env,Date.parse('2026-10-30T14:00:00Z'),{runner:async()=>calls++,beforeBriefing:async()=>calls++});assert.equal(calls,1);
  await siteSettingsRoute(env).POST(request({revision:2,dailyResearchEnabled:true}));
  const kinds=[];await runSchedule(env,Date.parse('2026-10-30T14:00:00Z'),{runner:async(_env,kind)=>kinds.push(kind)});assert.deepEqual(kinds,['briefing','career','news']);
  await siteSettingsRoute(env).POST(request({revision:3,dailyResearchEnabled:false}));await assert.rejects(runResearch(env,'briefing',{mode:'scheduled'}),/Daily research is turned off/);
});
