// Deterministic actual route + actual portfolio renderer. Never contacts providers.
import {grantVerifiedOwner} from '../lib/dashboard-access.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {nasdaq,yahoo} from '../tests/fixtures/quote-freshness.mjs';
export const expiryCases=[
 {name:'Last covered day: stale primary gets newer fallback',at:'2026-11-30T18:00:00Z',calls:['Nasdaq','Yahoo Finance'],price:102,age:2,calendar:'covered'},
 {name:'Last covered day: failed fallback stays visibly old',at:'2026-11-30T18:00:00Z',fallbackStatus:503,calls:['Nasdaq','Yahoo Finance'],price:100,age:90,calendar:'covered'},
 {name:'UTC December still covered Eastern November',at:'2026-12-01T00:30:00Z',status:'After-Hours',calls:['Nasdaq','Yahoo Finance'],price:102,age:2,calendar:'covered'},
 {name:'Last covered instant: no age fallback after session',at:'2026-12-01T04:59:59Z',status:'After-Hours',calls:['Nasdaq'],price:100,age:90,calendar:'covered'},
 {name:'First uncovered instant: calendar expires at Eastern midnight',at:'2026-12-01T05:00:00Z',calls:['Nasdaq'],price:100,age:90,calendar:'expired'},
 {name:'First uncovered trading hours: no assumed weekday session',at:'2026-12-01T18:00:00Z',calls:['Nasdaq'],price:100,age:90,calendar:'expired'},
 {name:'First uncovered day: recent quote still warns about calendar',at:'2026-12-01T18:00:00Z',primaryAge:2,calls:['Nasdaq'],price:100,age:2,calendar:'expired'},
 {name:'Expired calendar: unknown provider status stays unknown',at:'2026-12-01T18:00:00Z',status:'Unknown',calls:['Nasdaq'],price:100,age:90,calendar:'expired'},
 {name:'Expired calendar: failed primary can still use fallback',at:'2026-12-01T18:00:00Z',primaryStatus:503,calls:['Nasdaq','Yahoo Finance'],price:102,age:2,calendar:'expired'},
 {name:'Expired calendar: both providers fail, saved price retained',at:'2026-12-01T18:00:00Z',primaryStatus:503,fallbackStatus:503,calls:['Nasdaq','Yahoo Finance'],price:100,age:90,calendar:'expired'},
 {name:'Expired calendar: retain newer saved price when fallback older',at:'2026-12-01T18:00:00Z',savedAge:1,savedPrice:105,calls:['Nasdaq','Yahoo Finance'],price:105,age:1,calendar:'expired'},
 {name:'Last covered day: 429 retains quote and cooldown',at:'2026-11-30T18:00:00Z',fallbackStatus:429,calls:['Nasdaq','Yahoo Finance'],price:100,age:90,calendar:'covered'},
 {name:'Expired calendar: legacy fallback respects active cooldown',at:'2026-12-01T18:00:00Z',primaryStatus:503,cooldown:true,calls:['Nasdaq'],price:100,age:90,calendar:'expired'},
 {name:'Expired calendar: date-only close keeps date precision',at:'2026-12-01T23:00:00Z',status:'Closed',dateOnly:true,fallbackStatus:503,calls:['Nasdaq','Nasdaq extended','Yahoo Finance'],price:100,age:null,calendar:'expired'},
 {name:'Before coverage: no weekday assumption',at:'2026-10-30T17:00:00Z',calls:['Nasdaq'],price:100,age:90,calendar:'not-covered'}
];
class Bucket{
 data=new Map();sequence=0;
 async get(key){const r=this.data.get(key);return r?{etag:r.etag,json:async()=>structuredClone(r.value),text:async()=>JSON.stringify(r.value)}:null;}
 async put(key,body,{onlyIf}={}){const old=this.data.get(key);if(onlyIf?.etagMatches&&old?.etag!==onlyIf.etagMatches||onlyIf?.etagDoesNotMatch==='*'&&old)return null;const etag=String(++this.sequence);this.data.set(key,{value:JSON.parse(body),etag});return {etag};}
}
export async function observeExpiry(root,scenario){
 const at=Date.parse(scenario.at),calls=[],env={DASHBOARD_SERVICE_TOKEN:'fixture-only',BUCKET:new Bucket()};
 globalThis.__expiryTestEnv=env;
 const routePath=pathToFileURL(path.join(root,'app/api/quotes/refresh/route.ts'));
 let code=(await readFile(routePath,'utf8')).replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/,'const env=globalThis.__expiryTestEnv;');
 code=code.replace(/from\s*(['"])(\.\.?\/[^'"]+)\1/g,(_,quote,relative)=>`from ${JSON.stringify(new URL(relative,routePath).href)}`);
 const route=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'strip'})+'\n// '+scenario.name).toString('base64'));
 const ui=await import(pathToFileURL(path.join(root,'public/dashboard/portfolio-positions.mjs')));
 let currentTime=at;
 const originalDate=globalThis.Date,originalFetch=globalThis.fetch;
 class FixtureDate extends originalDate{constructor(...args){super(...(args.length?args:[currentTime]));}static now=()=>currentTime;}
 globalThis.Date=FixtureDate;
 globalThis.fetch=async url=>{
  const provider=url.includes('/info?')?'Nasdaq':url.includes('/extended-trading?')?'Nasdaq extended':url.startsWith('https://query1.finance.yahoo.com/v8/finance/chart/')?'Yahoo Finance':null;
  if(!provider)throw Error('Network forbidden: '+url);
  calls.push(provider);
  if(provider==='Nasdaq'){
   if(scenario.primaryStatus)return new Response('',{status:scenario.primaryStatus});
   const info=nasdaq(at-(scenario.primaryAge??90)*60000,scenario.status??'Open');
   if(scenario.dateOnly)info.data.primaryData.lastTradeTimestamp='Dec 1, 2026';
   return Response.json(info);
  }
  if(provider==='Nasdaq extended')return new Response('',{status:503});
  if(scenario.fallbackStatus)return new Response('',{status:scenario.fallbackStatus,headers:{'retry-after':'1200'}});
  return Response.json(yahoo(at-2*60000));
 };
 const before={holdings:[{ticker:'NVDA',shares:1.25,avgCost:95}],quotes:{NVDA:{price:scenario.savedPrice??100,asOf:new originalDate(at-(scenario.savedAge??90)*60000).toISOString(),session:'Regular session',source:'Saved fixture'}},sheets:{Custom:[['Synthetic note']]},briefing:{text:'Synthetic briefing'}};
 if(scenario.cooldown)before.quoteProviderCooldowns={'Yahoo Finance':new originalDate(at+1200000).toISOString()};
 const request=()=>{const req=new Request('https://fixture.invalid/api/quotes/refresh',{method:'POST'});grantVerifiedOwner(req);return req;};
 try{
  await env.BUCKET.put('dashboard.json',JSON.stringify(before));
  const response=await route.POST(request()),state=await response.json(),q=state.quotes.NVDA;
  const renderedHtml=ui.positionCards(state),displayedStatus=ui.refreshStatus('NVDA',state);
  const freshness=renderedHtml.match(/data-quote-freshness="NVDA"[^>]*>([^<]*)</)?.[1]??null;
  const count=calls.length;if(scenario.repeatAt)currentTime=Date.parse(scenario.repeatAt);const repeat=await (await route.POST(request())).json();
  const expected={http:200,calls:scenario.calls,price:scenario.price,asOf:scenario.dateOnly?'2026-12-01':new originalDate(at-scenario.age*60000).toISOString(),calendar:scenario.calendar,refreshGuard:true,preserved:true,visibleWarning:scenario.calendar!=='covered',oldQuoteLabel:scenario.name.includes('failed fallback')||scenario.name.includes('429')};
  const calendar=state.quoteRefresh.calendar?.status??null;
  const observed={http:response.status,calls,price:q.price,asOf:q.asOf,calendar,refreshGuard:calls.length===count&&/45 seconds/.test(repeat.refreshNotice??''),preserved:JSON.stringify(state.holdings)===JSON.stringify(before.holdings)&&JSON.stringify(state.sheets.Custom)===JSON.stringify(before.sheets.Custom)&&JSON.stringify(state.briefing)===JSON.stringify(before.briefing),visibleWarning:/Calendar (expired|unverified)/.test(freshness??''),oldQuoteLabel:/older than 20 minutes/.test(freshness??'')};
  const keys=Object.keys(expected).filter(k=>k!=='oldQuoteLabel'||expected.oldQuoteLabel);
  const passed=keys.every(k=>JSON.stringify(expected[k])===JSON.stringify(observed[k]));
  return {name:scenario.name,at:scenario.at,expected,observed,passed,displayedStatus,displayedFreshness:freshness,providerNotes:q.providerNotes??null,cooldowns:state.quoteRefresh.providerCooldowns,state,repeat,renderedHtml};
 }finally{globalThis.Date=originalDate;globalThis.fetch=originalFetch;delete globalThis.__expiryTestEnv;}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const root=path.resolve(process.argv[2]??new URL('..',import.meta.url).pathname),results=[];
 globalThis.fetch=()=>{throw Error('Unmocked network forbidden');};
 for(const c of expiryCases){const {state,repeat,renderedHtml,...result}=await observeExpiry(root,c);results.push(result);}
 const report={synthetic:true,sourceRoot:root,total:results.length,passed:results.filter(r=>r.passed).length,results};
 const output=JSON.stringify(report,null,2)+'\n';if(process.argv[3])await writeFile(process.argv[3],output);else console.log(output);
 console.log(`${report.passed}/${report.total} expiry cases passed`);process.exitCode=report.passed===report.total?0:1;
}
