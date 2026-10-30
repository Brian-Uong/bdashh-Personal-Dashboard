import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAccessToken,privateGate} from '../lib/private-access.mjs';
import {isDashboardOwner} from '../lib/dashboard-access.mjs';
import {servePrivate} from '../lib/private-router.mjs';
const now=Date.now(),seconds=Math.floor(now/1000);
const env={ACCESS_TEAM_DOMAIN:'test-owner.cloudflareaccess.com',ACCESS_AUD:'private-audience',DASHBOARD_OWNER_EMAIL:'brian@example.test',APP_HOSTNAME:'bdashh.com'};
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'private-test-key',alg:'RS256',use:'sig'};
const fetcher=async (url,init)=>{
  assert.equal(url,'https://test-owner.cloudflareaccess.com/cdn-cgi/access/certs');
  // workerd rejects redirect:'error' before any network I/O; Node's fetch accepts it.
  if(init.redirect==='error')throw TypeError('Invalid redirect value, must be follow or manual');
  assert.equal(init.redirect,'manual');
  return Response.json({keys:[jwk]});
};
const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function token(overrides={},header={}){
  const data=b64({alg:'RS256',kid:jwk.kid,...header})+'.'+b64({iss:'https://'+env.ACCESS_TEAM_DOMAIN,aud:[env.ACCESS_AUD],exp:seconds+300,iat:seconds,sub:'owner-id',email:env.DASHBOARD_OWNER_EMAIL,...overrides});
  return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url');
}
test('valid signed owner token passes; wrong identity, expired, audience, issuer and algorithms fail',async()=>{
  assert.equal((await verifyAccessToken(await token(),env,{fetcher,now})).email,env.DASHBOARD_OWNER_EMAIL);
  for(const change of [{email:'other@example.test'},{exp:seconds-1},{aud:['other']},{iss:'https://evil.example'},{iat:seconds+600},{nbf:seconds+600}]){
    const value=await token(change);await assert.rejects(()=>verifyAccessToken(value,env,{fetcher,now}));
  }
  await assert.rejects(()=>verifyAccessToken('e30.e30.fake',env,{fetcher,now}));
  const none=await token({},{alg:'none'});await assert.rejects(()=>verifyAccessToken(none,env,{fetcher,now}));
  const signed=await token();await assert.rejects(()=>verifyAccessToken(signed.slice(0,-8)+'ABCDEFGH',env,{fetcher,now}));
});
test('all page, static-data, alternate-host and API access fail closed before reading data',async()=>{
  let touched=0;const assets={fetch:async()=>{touched++;return new Response('private');}},routes={'/api/sync':{GET:()=>{touched++;return Response.json({private:true});}}};
  for(const path of ['/dashboard/','/dashboard/career-leads/leads.json','/api/sync','/']){
    const request=new Request('https://bdashh.com'+path,{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':env.DASHBOARD_OWNER_EMAIL,'X-Dashboard-Service-Authorization':'Bearer old-token'}});
    const r=await servePrivate(request,env,{assets,routes});assert.equal(r.status,401);assert.match(r.headers.get('Cache-Control'),/no-store/);
  }
  assert.equal((await servePrivate(new Request('https://bdashh.com/'),{},{assets,routes})).status,503);
  assert.equal((await servePrivate(new Request('https://other.workers.dev/'),env,{assets,routes})).status,403);
  assert.equal(touched,0);
});
test('verified owner can read assets; cross-origin and missing-origin mutations fail',async()=>{
  const jwt=await token();const gate=(request,config)=>privateGate(request,config,{fetcher,now});
  const request=new Request('https://bdashh.com/dashboard/',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
  const r=await servePrivate(request,env,{gate,assets:{fetch:async()=>new Response('owner view')},routes:{}});
  assert.equal(r.status,200);assert.equal(isDashboardOwner(request),true);
  for(const origin of ['https://evil.example',null]){
    const headers={'Cf-Access-Jwt-Assertion':jwt};if(origin)headers.origin=origin;
    const denied=await servePrivate(new Request('https://bdashh.com/api/sync',{method:'POST',headers}),env,{gate,routes:{'/api/sync':{POST:()=>{throw Error('Must not run');}}}});
    assert.equal(denied.status,403);
  }
});
test('access diagnostics identify the failing stage without exposing credentials or claim values',async()=>{
  const jwt=await token({aud:['another-private-app']});
  const messages=[],warn=console.warn;
  console.warn=message=>messages.push(message);
  try{
    const request=new Request('https://bdashh.com/dashboard/',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
    const denied=await privateGate(request,env,{fetcher,now});
    assert.equal(denied.status,401);
    assert.equal(isDashboardOwner(request),false);
    assert.equal(await denied.text(),'Private dashboard. Your sign-in could not be verified. Reference: TOKEN_AUDIENCE');
    assert.deepEqual(messages,[JSON.stringify({event:'bdashh_access_denied',reason:'TOKEN_AUDIENCE'})]);
  }finally{console.warn=warn;}
});
test('signing-key network failures deny access without returning upstream error details',async()=>{
  const jwt=await token({},{kid:'uncached-key'});
  await assert.rejects(()=>verifyAccessToken(jwt,env,{now,fetcher:async()=>{throw Error('Sensitive upstream detail');}}),error=>error.code==='SIGNING_KEYS_FETCH'&&!error.message.includes('Sensitive'));
});
test('redirected signing-key responses are rejected rather than followed or trusted',async()=>{
  const jwt=await token({},{kid:'redirect-key'});let calls=0;
  await assert.rejects(()=>verifyAccessToken(jwt,env,{now,fetcher:async(url,init)=>{
    calls++;assert.equal(url,'https://test-owner.cloudflareaccess.com/cdn-cgi/access/certs');
    assert.equal(init.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://untrusted.example/keys'}});
  }}),error=>error.code==='SIGNING_KEYS_UNAVAILABLE');
  assert.equal(calls,1);
});

test('public testing permits saved-data reads without granting owner privileges',async()=>{
  const config={...env,PUBLIC_READ_ONLY:'true'};
  const html='<a id="ownerSignIn" href="/dashboard/">Owner sign in</a>';
  const assets={fetch:async()=>new Response(html,{headers:{'Content-Type':'text/html','Content-Length':String(html.length)}})};
  const routes={'/api/access':{GET:r=>Response.json({canEdit:isDashboardOwner(r)})},'/api/sync':{GET:()=>Response.json({saved:true})}};
  const request=new Request('https://bdashh.com/dashboard/');
  const page=await servePrivate(request,config,{assets,routes});
  assert.equal(page.status,200);assert.match(await page.text(),/href="\/owner"/);assert.equal(isDashboardOwner(request),false);
  assert.match(page.headers.get('X-Robots-Tag'),/noindex/);
  assert.deepEqual(await (await servePrivate(new Request('https://bdashh.com/api/access'),config,{assets,routes})).json(),{canEdit:false});
  assert.deepEqual(await (await servePrivate(new Request('https://bdashh.com/api/sync'),config,{assets,routes})).json(),{saved:true});
});

test('public visitors cannot invoke writes, AI, owner login handlers or unapproved APIs',async()=>{
  const config={...env,PUBLIC_READ_ONLY:'true'};let touched=0;
  const routes=Object.fromEntries(['/api/sync','/api/ai/briefing','/api/ai/career','/api/holdings','/api/records'].map(p=>[p,{POST:()=>{touched++;return Response.json({ok:true});}}]));
  for(const path of Object.keys(routes)){
    const r=await servePrivate(new Request('https://bdashh.com'+path,{method:'POST',headers:{Origin:'https://bdashh.com','oai-authenticated-user-email':env.DASHBOARD_OWNER_EMAIL}}),config,{routes});
    assert.equal(r.status,401);
  }
  for(const path of ['/owner','/owner/','/api/admin','/api/ai/briefing'])assert.equal((await servePrivate(new Request('https://bdashh.com'+path),config,{routes})).status,401);
  assert.equal((await servePrivate(new Request('https://other.workers.dev/dashboard/'),config,{routes})).status,403);
  assert.equal(touched,0);
});

test('public-mode owner cookie is cryptographically verified and writes retain origin checks',async()=>{
  const config={...env,PUBLIC_READ_ONLY:'true'},jwt=await token();
  const gate=(request,c)=>privateGate(request,c,{fetcher,now});
  const routes={'/api/sync':{POST:r=>Response.json({owner:isDashboardOwner(r)})},'/api/access':{GET:r=>Response.json({canEdit:isDashboardOwner(r)})}};
  const good=new Request('https://bdashh.com/api/sync',{method:'POST',headers:{Cookie:'CF_Authorization='+jwt,Origin:'https://bdashh.com'}});
  assert.deepEqual(await (await servePrivate(good,config,{gate,routes})).json(),{owner:true});
  for(const cookie of ['CF_Authorization=fake','CF_Authorization='+await token({email:'other@example.test'}),'CF_Authorization='+await token({aud:['wrong']}),'CF_Authorization='+jwt+'; CF_Authorization=fake']){
    const r=new Request('https://bdashh.com/api/sync',{method:'POST',headers:{Cookie:cookie,Origin:'https://bdashh.com'}});
    assert.equal((await servePrivate(r,config,{gate,routes})).status,401);assert.equal(isDashboardOwner(r),false);
  }
  for(const origin of [null,'https://evil.example']){
    const headers={Cookie:'CF_Authorization='+jwt};if(origin)headers.Origin=origin;
    assert.equal((await servePrivate(new Request('https://bdashh.com/api/sync',{method:'POST',headers}),config,{gate,routes})).status,403);
  }
  const login=await servePrivate(new Request('https://bdashh.com/owner?return_to=https://evil.example',{headers:{'Cf-Access-Jwt-Assertion':jwt}}),config,{gate,routes});
  assert.equal(login.status,302);assert.equal(login.headers.get('Location'),'https://bdashh.com/dashboard/');
  const invalidRead=await servePrivate(new Request('https://bdashh.com/api/access',{headers:{Cookie:'CF_Authorization=fake'}}),config,{gate,routes});
  assert.deepEqual(await invalidRead.json(),{canEdit:false});
});

test('private mode retains owner-cookie access, redirects visitors to sign-in, and protects controls',async()=>{
  const config={...env,OWNER_CONTROLS_ENABLED:'true',PUBLIC_READ_ONLY:'false'},jwt=await token();
  const gate=(request,c)=>privateGate(request,c,{fetcher,now});
  const html='<div class="owner-tools-panel"></div><a id="ownerSignIn" href="/dashboard/">Sign in</a>';
  const options={gate,routes:{},assets:{fetch:async()=>new Response(html,{headers:{'Content-Length':String(html.length)}})}};
  for(const cookie of ['', 'CF_Authorization=expired']){
    const r=await servePrivate(new Request('https://bdashh.com/dashboard/',{headers:{Cookie:cookie}}),config,options);assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'https://bdashh.com/owner');
  }
  assert.equal((await servePrivate(new Request('https://bdashh.com/api/site-settings'),config,options)).status,401);
  assert.equal((await servePrivate(new Request('https://bdashh.com/owner/settings'),config,options)).status,401);
  const owner=()=>new Request('https://bdashh.com/owner/settings',{headers:{Cookie:'CF_Authorization='+jwt}});
  assert.match(await(await servePrivate(owner(),config,options)).text(),/Make the switch/);
  const page=await servePrivate(new Request('https://bdashh.com/dashboard/',{headers:{Cookie:'CF_Authorization='+jwt}}),config,options);assert.equal(page.status,200);assert.match(await page.text(),/Website controls/);
});
