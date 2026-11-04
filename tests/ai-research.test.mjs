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
  const candidate={value:{summary:'Verified career search.',jobs:[{title:'Analyst',company:'Example',city:'Irvine, CA',url}],recruiters:[{name:'Person',company:'Example',url:'https://invented.test'}],events:[]},sources:result.sources};
  const normalized=normalizeResearch('career',candidate,{preferences:DEFAULT_RESEARCH_PREFERENCES},Date.now());
  assert.equal(normalized.jobs.length,1);assert.equal(normalized.recruiters.length,0);
  assert.equal(normalizeResearch('career',candidate,{preferences:{...DEFAULT_RESEARCH_PREFERENCES,jobsEnabled:false}},Date.now()).jobs.length,0);
});
test('Pacific dates handle both standard and daylight time',()=>{
  assert.equal(pacificDate(Date.parse('2026-11-02T07:30:00Z')),'2026-11-01');
  assert.equal(pacificDate(Date.parse('2026-07-02T06:30:00Z')),'2026-07-01');
});
test('career AI rejects expired, senior and nonlocal jobs and verifies local event dates',()=>{
 const today=Date.parse('2026-10-31T03:00:00Z'),items=[
  {title:'Business Analyst',company:'Example',city:'Redlands, CA',url:'https://example.test/jobs/1'},
  {title:'Senior Business Analyst',company:'Example',city:'Irvine, CA',url:'https://example.test/jobs/2'},
  {title:'Business Analyst',company:'Example',city:'Orange County, VA',url:'https://example.test/jobs/3'},
  {title:'Business Analyst',company:'Example',city:'Irvine, CA',deadline:'2026-10-01',url:'https://example.test/jobs/4'}
 ];
 const events=[{name:'Local workshop',date:'2026-11-05',location:'Corona, CA',organizer:'Example',url:'https://example.test/events/1'},{name:'Past workshop',date:'2026-10-01',location:'Corona, CA',organizer:'Example',url:'https://example.test/events/2'}];
 const r=normalizeResearch('career',{value:{summary:'Verified career search.',jobs:items,recruiters:[],events},sources:[...items,...events].map(({url})=>({url,title:'Example'}))},{preferences:DEFAULT_RESEARCH_PREFERENCES},today);
 assert.deepEqual(r.jobs.map(x=>x.url),['https://example.test/jobs/1']);assert.equal(r.jobs[0].region,'Inland Empire');assert.equal(r.events.length,1);assert.equal(r.events[0].time,'Time unconfirmed');
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
  const future=pacificDate(Date.now()+7*86400000);
  const career={value:{summary:'Verified career search.',jobs:[{title:'Analyst',company:'Example',city:'Irvine, CA',url}],recruiters:[],events:[{name:'Meetup',date:future,location:'Irvine, CA',organizer:'Example',url}]},sources:result.sources};
  for(let i=0;i<2;i++)await runResearch(env,'career',{researcher:async()=>career});
  assert.equal((await(await env.BUCKET.get('discovery.json')).json()).jobs.length,1);
  const dashboard=await(await env.BUCKET.get('dashboard.json')).json();assert.equal(dashboard.holdings[0].ticker,'KO');
  assert.equal(dashboard.sheets['Potential Events'].length,5);
});

test('news runner researches current saved topics and saves only verified source URLs',async()=>{
 const env=await setup();const {saveNews,readNews}=await import('../lib/news.mjs');
 await saveNews(env.BUCKET,{action:'preferences',baseTopicsVersion:0,topics:['F1','Lakers']});
 const data={value:{results:[{topicId:'f1',status:'ready',items:[{headline:'Fixture update',summary:'Verified fixture source.',source:'Fixture publisher',url,publishedAt:null},{headline:'Unverified',summary:'Ignore',source:'Fixture',url:'https://example.test/not-cited'}]}]},sources:[{url,title:'Fixture publisher'}]};
 await runResearch(env,'news',{researcher:async(_env,kind,context)=>{assert.equal(kind,'news');assert.deepEqual(context.topics.map(t=>t.label),['F1','Lakers']);return data;}});
 const saved=await readNews(env.BUCKET);assert.equal(saved.briefings.f1.items.length,1);assert.equal(saved.briefings['custom-lakers'].status,'failed');
 assert.equal((await(await env.BUCKET.get('dashboard.json')).json()).briefing.text,'old');
});
test('news runner never restores a removed topic or spends on an empty selection',async()=>{
 const env=await setup();const {saveNews,readNews}=await import('../lib/news.mjs');
 await assert.rejects(()=>runResearch(env,'news',{researcher:async()=>{await saveNews(env.BUCKET,{action:'preferences',baseTopicsVersion:0,topics:[]});return {value:{results:[]},sources:[{url,title:'Fixture'}]};}}),/Topics changed/);
 let calls=0;assert.equal((await runResearch(env,'news',{researcher:async()=>{calls++;}})).status,'skipped');assert.equal(calls,0);assert.deepEqual((await readNews(env.BUCKET)).topics,[]);
});
test('news research preserves five or more verified articles per topic',()=>{
 for(const count of [4,5,10]){
  const items=Array.from({length:count},(_,i)=>({headline:`News ${i}`,summary:`Verified update ${i}.`,source:'Publisher',url:`https://example.test/news/${i}`,publishedAt:'2026-10-30'}));
  const result={value:{results:[{topicId:'nba',status:'ready',items}]},sources:items.map(({url})=>({url,title:'Publisher'}))};
  const [normalized]=normalizeResearch('news',result,{topics:[{id:'nba',label:'NBA'}]},Date.parse('2026-10-31T03:00:00Z'));
  assert.equal(normalized.items.length,count);
  assert.equal(normalized.status,count>=5?'ready':'partial');
 }
});
test('news scheduling remains at 7 AM Pacific across daylight saving changes',async()=>{
 const calls=[],env={ENABLE_DAILY_NEWS:'true'};const runner=async(_env,kind)=>calls.push(kind);
 await runSchedule(env,Date.parse('2026-10-31T14:00:00Z'),{runner});
 await runSchedule(env,Date.parse('2026-11-01T14:00:00Z'),{runner});
 await runSchedule(env,Date.parse('2026-11-01T15:00:00Z'),{runner});
 assert.deepEqual(calls,['news','news']);
});

test('career research failures report failure without replacing saved leads',async()=>{
 const env=await setup();
 const leads={jobs:[{id:'keep',url:'https://example.test/job'}],recruiters:[]};
 await env.BUCKET.put('discovery.json',JSON.stringify(leads));
 await assert.rejects(()=>runResearch(env,'career',{researcher:async()=>{throw Error('provider unavailable');}}));
 assert.deepEqual(await(await env.BUCKET.get('discovery.json')).json(),leads);
 const report=(await(await env.BUCKET.get('research.json')).json()).lastRun;
 assert.equal(report.status,'failed');assert.deepEqual(report.counts,{jobs:0,people:0,events:0});
});

test('malformed career output is a failure, not a successful empty search',async()=>{
 const env=await setup();
 await assert.rejects(()=>runResearch(env,'career',{researcher:async()=>({value:{},sources:result.sources})}),/incomplete career/i);
 assert.equal((await(await env.BUCKET.get('research.json')).json()).lastRun.status,'failed');
 assert.equal(await env.BUCKET.get('discovery.json'),null);
});

test('news with no completed topics reports failure and preserves existing articles',async()=>{
 const env=await setup();
 await assert.rejects(()=>runResearch(env,'news',{researcher:async()=>({value:{results:[]},sources:result.sources})}),/no news topic/i);
 const {readNews}=await import('../lib/news.mjs');
 const saved=await readNews(env.BUCKET);
 assert.ok(saved.topics.every(t=>saved.briefings[t.id].status==='failed'));
});

test('mixed news coverage reports partial instead of complete success',async()=>{
 const env=await setup();
 const outcome=await runResearch(env,'news',{researcher:async()=>({value:{results:[{topicId:'nba',status:'ready',items:[{headline:'Verified story',summary:'Sourced summary.',source:'Example',url}]}]},sources:result.sources})});
 assert.equal(outcome.status,'partial');
 assert.equal(outcome.counts.failed,2);assert.equal(outcome.counts.partial,1);
});
