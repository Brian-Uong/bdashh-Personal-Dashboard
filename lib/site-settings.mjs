import {requireDashboardWrite} from './dashboard-access.mjs';

export const SETTINGS_KEY='site-settings.json';
const defaults=()=>({schemaVersion:1,revision:0,publicReadOnly:false,aiEnabled:false,dailyResearchEnabled:false,updatedAt:null});
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
function decode(value){
  if(!value)return defaults();
  if(value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<0||['publicReadOnly','aiEnabled','dailyResearchEnabled'].some(k=>typeof value[k]!=='boolean'))throw Error('Website controls could not load. Access and AI remain restricted.');
  return {...defaults(),revision:value.revision,publicReadOnly:value.publicReadOnly,aiEnabled:value.aiEnabled,dailyResearchEnabled:value.aiEnabled&&value.dailyResearchEnabled,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:null};
}
async function read(bucket){
  try{const object=await bucket.get(SETTINGS_KEY);return {object,settings:decode(object?await object.json():null)};}
  catch{throw Error('Website controls could not load. Access and AI remain restricted.');}
}
export async function loadSiteSettings(env){return (await read(env.BUCKET)).settings;}
export async function runtimeEnv(env){
  if(env.OWNER_CONTROLS_ENABLED!=='true')return env;
  const settings=await loadSiteSettings(env),daily=settings.aiEnabled&&settings.dailyResearchEnabled&&env.AI_SCHEDULE_AVAILABLE==='true';
  return {...env,PUBLIC_READ_ONLY:settings.publicReadOnly?'true':'false',SITE_AI_ENABLED:settings.aiEnabled?'true':'false',OPENAI_MODEL:settings.aiEnabled?(env.CONTROLLED_AI_MODEL||'gpt-5-mini'):'',ENABLE_DAILY_BRIEFING:daily?'true':'false',ENABLE_DAILY_CAREER:daily?'true':'false'};
}
export async function researchEnv(env,kind,mode='manual'){
  const current=await runtimeEnv(env);
  if(current.OWNER_CONTROLS_ENABLED==='true'){
    if(current.SITE_AI_ENABLED!=='true')throw Error('OpenAI is turned off. Enable it in Website controls.');
    if(mode==='scheduled'&&current[kind==='briefing'?'ENABLE_DAILY_BRIEFING':'ENABLE_DAILY_CAREER']!=='true')throw Error('Daily research is turned off.');
  }
  return current;
}
function responseState(settings,env){return {...settings,aiKeyConfigured:!!env.OPENAI_API_KEY,dailyScheduleAvailable:env.AI_SCHEDULE_AVAILABLE==='true',dailyTime:'7:00 AM Pacific',maxDailyAttemptsPerTask:Math.max(1,Math.min(10,Number(env.AI_MAX_DAILY_RUNS)||3))};}
export function siteSettingsRoute(env){return {
  async GET(request){
    const denied=requireDashboardWrite(request);if(denied)return denied;
    try{return json(responseState(await loadSiteSettings(env),env));}catch{return json({error:'Website controls could not load. Please retry.'},503);}
  },
  async POST(request){
    const denied=requireDashboardWrite(request);if(denied)return denied;
    if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Origin rejected'},403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
    if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Settings request is too large'},413);
    const raw=await request.text();if(raw.length>2048)return json({error:'Settings request is too large'},413);
    let patch;try{patch=JSON.parse(raw);}catch{return json({error:'Invalid settings'},400);}
    const fields=['publicReadOnly','aiEnabled','dailyResearchEnabled'];
    if(!patch||Array.isArray(patch)||typeof patch!=='object'||!Number.isSafeInteger(patch.revision)||Object.keys(patch).some(k=>k!=='revision'&&!fields.includes(k))||!fields.some(k=>Object.hasOwn(patch,k))||fields.some(k=>Object.hasOwn(patch,k)&&typeof patch[k]!=='boolean'))return json({error:'Invalid settings'},400);
    try{
      const {object,settings}=await read(env.BUCKET);
      if(patch.revision!==settings.revision)return json({error:'Settings changed in another window. The latest settings have been loaded.'},409);
      const next={...settings};for(const k of fields)if(Object.hasOwn(patch,k))next[k]=patch[k];
      if(next.aiEnabled&&!env.OPENAI_API_KEY)return json({error:'An API key must be configured before OpenAI can be enabled.'},409);
      if(!next.aiEnabled)next.dailyResearchEnabled=false;
      if(next.dailyResearchEnabled&&env.AI_SCHEDULE_AVAILABLE!=='true')return json({error:'Daily scheduling is not configured yet.'},409);
      next.revision++;next.updatedAt=new Date().toISOString();
      const saved=await env.BUCKET.put(SETTINGS_KEY,JSON.stringify(next),{onlyIf:object?{etagMatches:object.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
      if(!saved)return json({error:'Settings changed in another window. The latest settings have been loaded.'},409);
      return json(responseState(next,env));
    }catch{return json({error:'Your change could not be saved. Reload the controls and check the current settings.'},503);}
  }
};}
