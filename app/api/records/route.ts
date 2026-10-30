import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {env} from 'cloudflare:workers';
import {editRecord} from '../../../lib/workbook.mjs';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 const body=await req.text();if(body.length>200000)return json({error:'Record too large'},413);let op;try{op=JSON.parse(body)}catch{return json({error:'Invalid record'},400)}
 if(!op||typeof op!=='object'||Array.isArray(op))return json({error:'Invalid record'},400);
 if(typeof op.requestId!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(op.requestId))return json({error:'Missing request ID'},400);
 const b=env.BUCKET;if(!b)return json({error:'Storage unavailable'},503);
 for(let attempt=0;attempt<3;attempt++){
 const current=await b.get('dashboard.json');const state:any=current?await current.json():{holdings:[],quotes:{},sheets:{}};
 if((state.recordRequests||[]).includes(op.requestId))return json(state);
 let next;try{next=editRecord(state,op)}catch(e){return json({error:e instanceof Error?e.message:'Invalid record'},409)}
 next.recordRequests=[...(state.recordRequests||[]),op.requestId].slice(-100);next.updatedAt=new Date().toISOString();
 const saved=await b.put('dashboard.json',JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});if(saved)return json(next);
 }return json({error:'Dashboard busy. Please retry.'},409);
}
