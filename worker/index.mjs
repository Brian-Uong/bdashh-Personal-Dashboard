import * as events from '../app/api/events/route.ts';
import * as news from '../app/api/news/route.ts';
import * as access from '../app/api/access/route.ts';
import * as sync from '../app/api/sync/route.ts';
import * as records from '../app/api/records/route.ts';
import * as holdings from '../app/api/holdings/route.ts';
import * as discovery from '../app/api/discovery/route.ts';
import * as careerRefresh from '../app/api/discovery/refresh/route.ts';
import * as research from '../app/api/research/route.ts';
import * as quotes from '../app/api/quotes/refresh/route.ts';
import * as history from '../app/api/portfolio/history/route.ts';
import * as stocks from '../app/api/stocks/detail/route.ts';
import * as places from '../app/api/places/search/route.ts';
import * as nearby from '../app/api/places/nearby/route.ts';
import * as retiredSports from '../app/api/sports/nba/route.ts';
import * as retiredMarket from '../app/api/fc-market/route.ts';
import {servePrivate} from '../lib/private-router.mjs';
import {runResearch,runSchedule} from '../lib/ai-research.mjs';
import {grantVerifiedOwner} from '../lib/dashboard-access.mjs';
import {serveR2Asset} from '../lib/private-assets.mjs';
import {runStartupCheck} from '../lib/startup-check.mjs';
import {runtimeEnv,siteSettingsRoute} from '../lib/site-settings.mjs';
import {protectResponse} from '../lib/private-access.mjs';
const existing={'/api/events':events,'/api/news':news,'/api/access':access,'/api/sync':sync,'/api/records':records,'/api/holdings':holdings,'/api/discovery':discovery,'/api/discovery/refresh':careerRefresh,'/api/research':research,'/api/quotes/refresh':quotes,'/api/portfolio/history':history,'/api/stocks/detail':stocks,'/api/places/search':places,'/api/places/nearby':nearby,'/api/fc-market':retiredMarket,'/api/sports/nba':retiredSports};
export default {
  async fetch(request,env){
    if(new URL(request.url).hostname!==env.APP_HOSTNAME)return protectResponse(new Response('Unknown host',{status:403}));
    try{env=await runtimeEnv(env);}catch{return protectResponse(new Response('Website settings are temporarily unavailable. Please retry.',{status:503}));}
    const routes={...existing};
    if(env.OWNER_CONTROLS_ENABLED==='true')routes['/api/site-settings']=siteSettingsRoute(env);
    for(const kind of ['briefing','career','news'])routes['/api/ai/'+kind]={async POST(){
      try{return Response.json(await runResearch(env,kind));}
      catch(e){return Response.json({error:e.message},{status:/limit|already/.test(e.message)?429:/configured|turned off/.test(e.message)?503:502});}
    }};
    routes['/api/ai/status']={async GET(){return Response.json({configured:!!env.OPENAI_API_KEY&&!!env.OPENAI_MODEL,dailyBriefing:env.ENABLE_DAILY_BRIEFING==='true',dailyCareer:env.ENABLE_DAILY_CAREER==='true',dailyNews:env.ENABLE_DAILY_NEWS==='true'});}};
    return servePrivate(request,env,{routes,assets:{fetch:request=>serveR2Asset(request,env.ASSET_BUCKET)}});
  },
  scheduled(controller,env,ctx){ctx.waitUntil((async()=>{
    await runStartupCheck(env);
    await runSchedule(env,controller.scheduledTime,{beforeBriefing:async()=>{
    // This request is created only by Cloudflare's scheduled entry point.
    const request=new Request('https://'+env.APP_HOSTNAME+'/api/quotes/refresh',{method:'POST'});
    grantVerifiedOwner(request);const response=await quotes.POST(request);
    if(!response.ok)throw Error('Quote refresh incomplete');
    }});
  })());}
};
