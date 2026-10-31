import {privateGate,protectResponse} from './private-access.mjs';
import {ownerControlsPage} from './owner-controls-page.mjs';
const publicReads=new Set(['/api/events','/api/news','/api/access','/api/sync','/api/discovery','/api/research','/api/portfolio/history','/api/ai/status','/api/stocks/detail','/api/places/search','/api/places/nearby']);
export async function servePrivate(request,env,{routes,gate=privateGate,assets=env.ASSETS}={}){
  const url=new URL(request.url);
  if(!env.APP_HOSTNAME||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN||!env.DASHBOARD_OWNER_EMAIL)return protectResponse(new Response('Dashboard access setup is incomplete.',{status:503}));
  if(url.hostname!==env.APP_HOSTNAME)return protectResponse(new Response('Unknown host',{status:403}));
  const publicMode=env.PUBLIC_READ_ONLY==='true';
  const publicRead=publicMode&&['GET','HEAD'].includes(request.method)&&url.pathname!=='/owner'&&!url.pathname.startsWith('/owner/')&&(!url.pathname.startsWith('/api/')||publicReads.has(url.pathname));
  const hasCredentials=request.headers.has('Cf-Access-Jwt-Assertion')||/(?:^|;\s*)CF_Authorization=/.test(request.headers.get('cookie')||'');
  if(!publicRead||hasCredentials){const denied=await gate(request,env);if(denied&&!publicRead){
    if(env.OWNER_CONTROLS_ENABLED==='true'&&!publicMode&&denied.status===401&&['GET','HEAD'].includes(request.method)&&!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/owner'))return protectResponse(Response.redirect(url.origin+'/owner',302));
    return protectResponse(denied);
  }}
  if(!['GET','HEAD','POST'].includes(request.method))return protectResponse(new Response('Method not allowed',{status:405}));
  if(request.method==='POST' && (request.headers.get('origin')!==url.origin || request.headers.get('sec-fetch-site')==='cross-site'))return protectResponse(new Response('Origin rejected',{status:403}));
  try{
    if(url.pathname.startsWith('/api/')){
      const route=routes[url.pathname];if(!route)return protectResponse(Response.json({error:'Not found'},{status:404}));
      const fn=route[request.method];if(!fn)return protectResponse(Response.json({error:'Method not allowed'},{status:405}));
      return protectResponse(await fn(request));
    }
    if(!['GET','HEAD'].includes(request.method))return protectResponse(new Response('Method not allowed',{status:405}));
    if(env.OWNER_CONTROLS_ENABLED==='true'&&['/owner/settings','/owner/settings/'].includes(url.pathname))return protectResponse(new Response(request.method==='HEAD'?null:ownerControlsPage,{headers:{'Content-Type':'text/html; charset=utf-8'}}));
    if(url.pathname==='/owner'||url.pathname==='/owner/')return protectResponse(Response.redirect(url.origin+'/dashboard/',302));
    if(url.pathname==='/')return protectResponse(Response.redirect(url.origin+'/dashboard/',302));
    if(url.pathname==='/dashboard/updater-access.md')return protectResponse(new Response('Not found',{status:404}));
    let response=await assets.fetch(request);
    if((publicMode||env.OWNER_CONTROLS_ENABLED==='true')&&request.method==='GET'&&response.ok&&['/dashboard/','/dashboard/index.html'].includes(url.pathname)){
      // The checked v57 index is a bounded static asset. Keep its release
      // unchanged and route its existing owner link to the protected login.
      const size=Number(response.headers.get('content-length'));
      if(!size||size>250000)return protectResponse(new Response('Dashboard page is unavailable.',{status:503}));
      let html=await response.text();
      html=html.replace(/(<a\b[^>]*\bid="ownerSignIn"[^>]*\bhref=")[^"]*(")/,'$1/owner$2');
      if(env.OWNER_CONTROLS_ENABLED==='true')html=html.replace('<div class="owner-tools-panel">','<div class="owner-tools-panel"><a class="button subtle" href="/owner/settings">Website controls</a>');
      const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('ETag');
      response=new Response(html,{status:response.status,headers});
    }
    return protectResponse(response);
  }catch{return protectResponse(Response.json({error:'The request could not finish. Your saved data is retained.'},{status:500}));}
}
