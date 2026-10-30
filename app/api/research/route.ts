import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {researchState,updateResearch} from '../../../lib/research.mjs';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
// Writes are additionally authorized by requireDashboardWrite.
export async function GET(){const o=await env.BUCKET.get('research.json');return json(researchState(o?await o.json():{}));}
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 const raw=await req.text();if(raw.length>16000)return json({error:'Preferences too large'},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid research request'},400)}
 for(let n=0;n<3;n++){
  const o=await env.BUCKET.get('research.json');let next;
  try{next=updateResearch(o?await o.json():{},body)}catch(e){return json({error:e instanceof Error?e.message:'Invalid request'},(e as any).status||400)}
  const saved=await env.BUCKET.put('research.json',JSON.stringify(next),{onlyIf:o?{etagMatches:o.etag}:{etagDoesNotMatch:'*'}});if(saved)return json(next);
 }
 return json({error:'Research settings are busy. Please retry.'},409);
}
