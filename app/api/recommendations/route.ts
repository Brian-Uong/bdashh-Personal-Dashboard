import {env} from 'cloudflare:workers';
import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {readRecommendations,recordRecommendations,refreshRecommendations} from '../../../lib/recommendations.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){if(!env.BUCKET)return json({error:'Storage unavailable'},503);return json(await readRecommendations(env.BUCKET));}
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 if(Number(req.headers.get('content-length')||0)>50000)return json({error:'Request too large'},413);
 const body=await req.text();if(body.length>50000)return json({error:'Request too large'},413);
 let payload;try{payload=JSON.parse(body);}catch{return json({error:'Invalid JSON'},400);}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return json({error:'Invalid request'},400);
 try{
  if(payload.action==='record')return json(await recordRecommendations(env.BUCKET,payload));
  if(payload.action==='refresh')return json(await refreshRecommendations(env.BUCKET,{ids:payload.ids}));
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:e instanceof Error?e.message:'Recommendation update failed'},/already running|elsewhere|locked/.test(String(e))?409:400);}
}
