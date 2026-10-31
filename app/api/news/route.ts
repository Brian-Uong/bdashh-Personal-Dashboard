import {env} from 'cloudflare:workers';
import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {readNews,saveNews} from '../../../lib/news.mjs';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const errorResponse=(error:any)=>json({error:error.status?error.message:'News could not be loaded or saved. Your previous news is retained.'},error.status||503);
export async function GET(){try{return json(await readNews(env.BUCKET));}catch(error){return errorResponse(error);}}
export async function POST(request:Request){
 const denied=requireDashboardWrite(request,env);if(denied)return denied;
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 if(Number(request.headers.get('content-length')||0)>96000)return json({error:'News update is too large'},413);
 const raw=await request.text();if(raw.length>96000)return json({error:'News update is too large'},413);
 let patch;try{patch=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 try{return json(await saveNews(env.BUCKET,patch));}catch(error){return errorResponse(error);}
}
