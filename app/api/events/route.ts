import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {collectEvents,validateEvent,eventUrl,saveEvents} from '../../../lib/event-search.mjs';
import {researchState} from '../../../lib/research.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const object=await env.BUCKET.get('dashboard.json');return json({lastRefresh:object?(await object.json() as any).eventSearch||null:null});}
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const raw=await req.text();if(raw.length>64000)return json({error:'Event request is too large.'},413);
 let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid event request.'},400);}
 if(!body||!['refresh','curate'].includes(body.action))return json({error:'Choose a supported event search.'},400);
 if(body.action==='refresh'&&(!['','Orange County','Inland Empire'].includes(body.region||'')||typeof (body.query||'')!=='string'||(body.query||'').length>100))return json({error:'Invalid search filters.'},400);
 const bucket=env.BUCKET;
 const prefsObject=await bucket.get('research.json'),research=researchState(prefsObject?await prefsObject.json():{});
 if(!research.preferences.eventsEnabled)return json({error:'Local event searches are disabled in Search preferences.'},409);
 if(body.action==='curate'&&body.baseRevision!==research.revision)return json({error:'Search preferences changed. Read them again before saving research.'},409);
 const lock=await bucket.get('event-search-lock.json');
 if(lock&&(await lock.json() as any).until>Date.now())return json({error:'An event search is running or just finished. Wait a moment and reload saved events.'},429);
 const lease=await bucket.put('event-search-lock.json',JSON.stringify({until:Date.now()+150000}),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});
 if(!lease)return json({error:'An event search is already running.'},429);
 try{
  let result;
  if(body.action==='refresh')result=await collectEvents({region:body.region||'',query:(body.query||'').trim()});
  else{
   if(!Array.isArray(body.events)||body.events.length>30||!Array.isArray(body.sources)||body.sources.length>40||!Number.isFinite(Date.parse(body.checkedAt))||Date.parse(body.checkedAt)>Date.now()+300000)return json({error:'Invalid researched events.'},400);
   const sources=body.sources.map((s:any)=>({name:String(s.name||'').slice(0,150),url:eventUrl(s.url),status:'verified',scanned:1,matches:1}));
   const events=body.events.map((item:any)=>validateEvent(item));
   if(sources.some((s:any)=>!s.name||!s.url)||events.some((e:any)=>!e||!sources.some((s:any)=>s.url===e.url)))return json({error:'Every event needs a verified source, a future date within 90 days, and a venue in Inland Empire or Orange County, California.'},400);
   result={events,sources,checkedAt:body.checkedAt};
  }
  const latest=await bucket.get('research.json');
  if(researchState(latest?await latest.json():{}).revision!==research.revision)return json({error:'Preferences changed during search. Reload before searching again.'},409);
  const saved=await saveEvents(bucket,result.events,{...result,mode:body.action==='curate'?'ai':'sources'});
  return json({lastRefresh:saved.eventSearch},saved.eventSearch?.status==='failed'?502:200);
 }catch(error){return json({error:(error as any).status===409?(error as Error).message:'Event search could not finish. Your saved events are retained.'},(error as any).status||502);}
 finally{await bucket.put('event-search-lock.json',JSON.stringify({until:Date.now()+15000}),{onlyIf:{etagMatches:lease.etag}});}
}
