import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {addSavedHolding,changeSavedHolding} from '../../../lib/holdings.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 const denied=requireDashboardWrite(request,env);if(denied)return denied;
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origin rejected'},403);
 if(Number(request.headers.get('content-length')||0)>4000)return json({error:'Request too large'},413);
 const body=await request.text();if(body.length>4000)return json({error:'Request too large'},413);
 let input;try{input=JSON.parse(body)}catch{return json({error:'Invalid request'},400);}
 if(!env.BUCKET)return json({error:'Portfolio storage is unavailable. Please retry.'},503);
 try{return json(await (input?.action&&input.action!=='add'?changeSavedHolding(env.BUCKET,input):addSavedHolding(env.BUCKET,input)));}
 catch(error){const e=error as Error&{status?:number};return json({error:e.status?e.message:'Could not save the stock. Retry the same details safely.'},e.status||503);}
}
