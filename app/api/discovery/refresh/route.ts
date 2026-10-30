import {requireDashboardWrite} from '../../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {collectCareer,mergeRefresh} from '../../../../lib/career-refresh.mjs';
import {researchState} from '../../../../lib/research.mjs';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
// Shared Site store; writes require owner or service authorization.
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 const b=env.BUCKET;if(!b)return json({error:'Lead storage is temporarily unavailable.'},503);
 const lock=await b.get('career-refresh-lock.json');
 if(lock&&Date.now()<JSON.parse(await lock.text()).until)return json({error:'A refresh is running or has just finished. Try again in a moment.'},429);
 const lease=await b.put('career-refresh-lock.json',JSON.stringify({until:Date.now()+60000}),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});
 if(!lease)return json({error:'A refresh is already running.'},429);
 try{
  const o=await b.get('research.json'),preferences=researchState(o?await o.json():{}).preferences;
  const result=await collectCareer(preferences);
  for(let attempt=0;attempt<3;attempt++){
   const previous=await b.get('discovery.json');const state=previous?await previous.json():{jobs:[],recruiters:[]};const next=mergeRefresh(state,result);
   const saved=await b.put('discovery.json',JSON.stringify(next),{onlyIf:previous?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'}});
   if(saved)return json(next,next.lastRefresh.status==='failed'?502:200);
  }
  return json({error:'Your leads changed during refresh. Please retry.'},409);
 }catch{return json({error:'Refresh could not finish. Your saved leads are still available.'},502)}
 finally{await b.put('career-refresh-lock.json',JSON.stringify({until:Date.now()+15000}),{onlyIf:{etagMatches:lease.etag}});}
}
