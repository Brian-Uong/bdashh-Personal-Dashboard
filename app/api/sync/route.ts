import {requireDashboardWrite} from '../../../lib/dashboard-access.mjs';
import {materialize} from '../../../lib/workbook.mjs';
import {capturePortfolioHistory} from '../../../lib/portfolio-history.mjs';
import { env } from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store'}});
// Reads follow the Site audience; all writes require owner or service authorization.
export async function GET(){const b=env.BUCKET;if(!b)return json({error:'Storage unavailable'},503);const o=await b.get('dashboard.json');return json(materialize(o?await o.json():{holdings:[],quotes:{},briefing:null,sheets:null}));}
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 if(Number(req.headers.get('content-length')||0)>2000000)return json({error:'Too large'},413);
 const text=await req.text();if(text.length>2000000)return json({error:'Too large'},413);
 let patch;try{patch=JSON.parse(text)}catch{return json({error:'Invalid JSON'},400)}
 if(!patch||typeof patch!=='object'||Array.isArray(patch))return json({error:'Invalid update'},400);
 const b=env.BUCKET;if(!b)return json({error:'Storage unavailable'},503);
 const current=await b.get('dashboard.json');const state:any=current?await current.json():{holdings:[],quotes:{},briefing:null,sheets:null};
 if(patch.sheets!==undefined&&Object.hasOwn(patch,'baseUpdatedAt')&&patch.baseUpdatedAt!==(state.updatedAt||null))return json({error:'Saved data changed while this workbook was open. Export your draft, reload saved data, and reconcile before saving.'},409);
 const before=structuredClone(state);
 if(patch.holdings){if(!Array.isArray(patch.holdings)||patch.holdings.length>100||patch.holdings.some((h:any)=>!/^([A-Z][A-Z0-9.\-]{0,9})$/.test(h.ticker)||!Number.isFinite(h.shares)||h.shares<0||!Number.isFinite(h.avgCost)||h.avgCost<0)||new Set(patch.holdings.map((h:any)=>h.ticker)).size!==patch.holdings.length)return json({error:'Invalid holdings'},400);state.holdings=patch.holdings;}
 if(patch.quotes){for(const [t,q] of Object.entries(patch.quotes) as any){if(!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(Date.parse(q.asOf))||typeof q.source!=='string')return json({error:'Invalid quote'},400);const old=state.quotes?.[t];if(!old||Date.parse(q.asOf)>=Date.parse(old.asOf))state.quotes[t]=q;}}
 if(patch.briefing!==undefined){if(!patch.briefing||typeof patch.briefing.text!=='string'||!Number.isFinite(Date.parse(patch.briefing.asOf)))return json({error:'Invalid briefing'},400);state.briefing=patch.briefing;}
 if(patch.sheets!==undefined){if(!patch.sheets||typeof patch.sheets!=='object'||Array.isArray(patch.sheets))return json({error:'Invalid workbook'},400);state.sheets=patch.sheets;}
 state.sheets=materialize(state).sheets;state.updatedAt=new Date().toISOString();const saved=await b.put('dashboard.json',JSON.stringify(state),{httpMetadata:{contentType:'application/json'},onlyIf:current?{etagMatches:current.etag}:{etagDoesNotMatch:'*'}});if(!saved)return json({error:'Dashboard changed elsewhere. Reload and try again.'},409);
 const historyWarning=(patch.holdings||patch.quotes)?await capturePortfolioHistory(b,[before,state]):null;
 return json(historyWarning?{...state,historyWarning}:state);
}
