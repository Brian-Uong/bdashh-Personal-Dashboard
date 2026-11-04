import {requireDashboardWrite} from './dashboard-access.mjs';
import {runResearch} from './ai-research.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export function aiRoute(env,kind,{runner=runResearch}={}){
 return async function POST(request){
  const denied=requireDashboardWrite(request,env);if(denied)return denied;
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origin rejected'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  if(Number(request.headers.get('content-length')||0)>128)return json({error:'Request too large'},413);
  const raw=await request.text();if(raw.length>128)return json({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid research request'},400);}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length)return json({error:'Research uses your saved preferences. No request fields are supported.'},400);
  if(!env.OPENAI_API_KEY||!env.OPENAI_MODEL)return json({error:'On-demand AI is not connected on this dashboard yet. Saved research and direct source searches remain available.',code:'AI_NOT_CONFIGURED'},503);
  try{return json(await runner(env,kind));}
  catch(error){return json({error:error instanceof Error?error.message:'Research could not finish. Reload saved results before retrying.'},/already running|Daily research limit|changed during/.test(error.message)?409:503);}
 };
}
