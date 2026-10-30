import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {mergeLeads} from '../../../lib/career-refresh.mjs';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const o=await env.BUCKET.get('discovery.json');return json(o?await o.json():{jobs:[],recruiters:[],lastCurated:'',searchConnected:false});}
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 const raw=await req.text();if(raw.length>500000)return json({error:'Too large'},413);
 let data;try{data=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
 if(data.action==='search')return json({error:'Use the Career hub refresh endpoint.'},400);
 for(const k of ['jobs','recruiters'])if(!Array.isArray(data[k])||data[k].length>100||data[k].some((x:any)=>!x||typeof x.id!=='string'||!/^https:\/\//.test(x.url)||typeof x.company!=='string'||typeof (k==='jobs'?x.title:x.name)!=='string'))return json({error:'Invalid leads'},400);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data.lastCurated||''))return json({error:'Missing research date'},400);
 for(let n=0;n<3;n++){const o=await env.BUCKET.get('discovery.json');const old:any=o?await o.json():{jobs:[],recruiters:[]};const {next}=mergeLeads(old,data);next.lastCurated=data.lastCurated;const saved=await env.BUCKET.put('discovery.json',JSON.stringify(next),{onlyIf:o?{etagMatches:o.etag}:{etagDoesNotMatch:'*'}});if(saved)return json(next);}
 return json({error:'Busy; retry'},409);
}
