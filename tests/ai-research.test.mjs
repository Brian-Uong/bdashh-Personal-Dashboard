import test from 'node:test';
import assert from 'node:assert/strict';
import {runResearch,runSchedule,parseResearchResponse,normalizeResearch,pacificDate,requestResearch} from '../lib/ai-research.mjs';
import {DEFAULT_RESEARCH_PREFERENCES} from '../lib/research.mjs';
class Bucket {
  data=new Map();version=0;
  async get(key){const item=this.data.get(key);return item?{etag:item.etag,json:async()=>structuredClone(item.value)}:null;}
  async put(key,value,{onlyIf}={}){
    const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches)return null;
    if(onlyIf?.etagDoesNotMatch==='*'&&old)return null;
    const etag=String(++this.version);this.data.set(key,{etag,value:JSON.parse(value)});return {etag};
  }
}
const url='https://example.test/earnings';
const result={value:{text:'Sourced earnings briefing.',items:[{headline:'Earnings',summary:'Reported results.',url,tickers:['KO']}]},sources:[{url,title:'Company IR'}]};
async function setup(){const bucket=new Bucket();await bucket.put('dashboard.json',JSON.stringify({holdings:[{ticker:'KO',shares:10,avgCost:50}],quotes:{},briefing:{text:'old'},sheets:{}}));return {BUCKET:bucket,OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model',AI_MAX_DAILY_RUNS:'1'};}
test('research without a completed search or sources is rejected',()=>{
  assert.throws(()=>parseResearchResponse({status:'completed',output:[]}));
  assert.throws(()=>parseResearchResponse({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[]}}]}));
  assert.throws(()=>normalizeResearch('briefing',{...result,sources:[]},{tickers:['KO']},Date.now()));
});
test('AI provider redirects do not forward credentials or replace saved research',async()=>{
  const env=await setup();let calls=0;
  await assert.rejects(()=>runResearch(env,'briefing',{researcher:requestResearch,fetcher:async(target,init)=>{
    calls++;assert.equal(target,'https://api.openai.com/v1/responses');
    assert.equal(init.redirect,'manual');
    return new Response(null,{status:307,headers:{Location:'https://untrusted.example/collect'}});
  }}),/AI provider request failed \(307\)/);
  assert.equal(calls,1);
  assert.equal((await(await env.BUCKET.get('dashboard.json')).json()).briefing.text,'old');
});
test('provider quota diagnostics use only known codes and never copy provider messages',async()=>{
  for(const detail of [
    {code:'credit_balance_exhausted',type:'insufficient_quota',expected:'credit_balance_exhausted'},
    {code:'project_spend_limit_exceeded',type:'insufficient_quota',expected:'project_spend_limit_exceeded'},
    {code:'private-organization-id',type:'insufficient_quota',expected:'insufficient_quota'},
    {code:'rate_limit_exceeded',expected:'rate_limit_exceeded'},
    {code:'private-organization-id',expected:undefined}
  ]){
    const env=await setup();
    await assert.rejects(()=>runResearch(env,'briefing',{fetcher:async()=>Response.json({error:{...detail,message:'DO-NOT-EXPOSE-secret-value'}},{status:429})}),error=>{
      assert.equal(error.providerCode,detail.expected);assert.equal(error.message.includes('DO-NOT-EXPOSE'),false);assert.equal(error.message.includes('private-organization'),false);return true;
    });
    assert.equal((await(await env.BUCKET.get('dashboard.json')).json()).briefing.text,'old');
    assert.equal(JSON.stringify([...env.BUCKET.data.values()]).includes('DO-NOT-EXPOSE'),false);
  }
});
test('briefing saves to existing data, sends only tickers and enforces daily limit',async()=>{
  const env=await setup();let calls=0;
  const researcher=async(_env,kind,context)=>{calls++;assert.deepEqual(context,{tickers:['KO']});return result;};
  await runResearch(env,'briefing',{researcher});
  const state=await(await env.BUCKET.get('dashboard.json')).json();assert.equal(state.holdings[0].shares,10);assert.equal(state.briefing.text,result.value.text);
  await assert.rejects(()=>runResearch(env,'briefing',{researcher}),/Daily research limit/);assert.equal(calls,1);
});
test('failed research preserves saved briefing and still counts paid attempts',async()=>{
  const env=await setup();await assert.rejects(()=>runResearch(env,'briefing',{researcher:async()=>{throw Error('provider unavailable');}}));
  assert.equal((await(await env.BUCKET.get('dashboard.json')).json()).briefing.text,'old');
  await assert.rejects(()=>runResearch(env,'briefing',{researcher:async()=>result}),/Daily research limit/);
});
test('concurrent attempts do not issue duplicate paid requests',async()=>{
  const env=await setup();let finish,calls=0;
  const researcher=async()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const a=runResearch(env,'briefing',{researcher});
  while(!finish)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(()=>runResearch(env,'briefing',{researcher}),/already running/);finish(result);await a;assert.equal(calls,1);
});
test('career source filtering and disabled categories are enforced',()=>{
  const candidate={value:{jobs:[{title:'Analyst',company:'Example',url}],recruiters:[{name:'Person',company:'Example',url:'https://invented.test'}],events:[]},sources:result.sources};
  const normalized=normalizeResearch('career',candidate,{preferences:DEFAULT_RESEARCH_PREFERENCES},Date.now());
  assert.equal(normalized.jobs.length,1);assert.equal(normalized.recruiters.length,0);
  assert.equal(normalizeResearch('career',candidate,{preferences:{...DEFAULT_RESEARCH_PREFERENCES,jobsEnabled:false}},Date.now()).jobs.length,0);
});
test('Pacific dates handle both standard and daylight time',()=>{
  assert.equal(pacificDate(Date.parse('2026-11-02T07:30:00Z')),'2026-11-01');
  assert.equal(pacificDate(Date.parse('2026-07-02T06:30:00Z')),'2026-07-01');
});
test('schedule runs at 7 AM Pacific across daylight saving and obeys disabled flags',async()=>{
  const env={ENABLE_DAILY_BRIEFING:'true',ENABLE_DAILY_CAREER:'true'},calls=[];
  const hooks={runner:async(_env,kind)=>calls.push(kind),beforeBriefing:async()=>calls.push('quotes')};
  await runSchedule(env,Date.parse('2026-07-02T14:00:00Z'),hooks);
  await runSchedule(env,Date.parse('2026-11-02T15:00:00Z'),hooks);
  assert.deepEqual(calls,['quotes','briefing','career','quotes','briefing','career']);calls.length=0;
  await runSchedule(env,Date.parse('2026-07-02T15:00:00Z'),hooks);
  await runSchedule({},Date.parse('2026-07-02T14:00:00Z'),hooks);assert.deepEqual(calls,[]);
});
test('scheduled retries do not pay for the same task twice on one day',async()=>{
  const env=await setup();env.AI_MAX_DAILY_RUNS='3';
  await runResearch(env,'briefing',{mode:'scheduled',researcher:async()=>result});
  await assert.rejects(()=>runResearch(env,'briefing',{mode:'scheduled',researcher:async()=>result}),/already attempted/);
});
test('career persistence merges leads and adds events without erasing workbook records',async()=>{
  const env=await setup();env.AI_MAX_DAILY_RUNS='3';
  const future='2099-01-01';
  const career={value:{jobs:[{title:'Analyst',company:'Example',url}],recruiters:[],events:[{name:'Meetup',date:future,url}]},sources:result.sources};
  for(let i=0;i<2;i++)await runResearch(env,'career',{researcher:async()=>career});
  assert.equal((await(await env.BUCKET.get('discovery.json')).json()).jobs.length,1);
  const dashboard=await(await env.BUCKET.get('dashboard.json')).json();assert.equal(dashboard.holdings[0].ticker,'KO');
  assert.equal(dashboard.sheets['Potential Events'].length,5);
});
