import {grantVerifiedOwner} from './dashboard-access.mjs';
// RS256 tokens are verified with Web Crypto. Headers alone never confer access.
const keys = new Map();
class AccessFailure extends Error {
  constructor(code) { super(code); this.code=code; }
}
const fail = code => { throw new AccessFailure(code); };
const decode = text => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
const parse = text => JSON.parse(new TextDecoder().decode(decode(text)));
export async function verifyAccessToken(token, env, {fetcher=fetch, now=Date.now()}={}) {
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||'') || !env.ACCESS_AUD || !env.DASHBOARD_OWNER_EMAIL) throw Error('Access is not configured');
  if (typeof token!=='string' || token.length>16000) fail('TOKEN_MISSING');
  const parts=token.split('.'); if(parts.length!==3)fail('TOKEN_FORMAT');
  let header,payload;
  try { [header,payload]=parts.slice(0,2).map(parse); } catch { fail('TOKEN_FORMAT'); }
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN,seconds=Math.floor(now/1000);
  if(!header||!payload)fail('TOKEN_FORMAT');
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||header.crit!==undefined)fail('TOKEN_ALGORITHM');
  if(payload.iss!==issuer)fail('TOKEN_ISSUER');
  if(!Array.isArray(payload.aud)||!payload.aud.includes(env.ACCESS_AUD))fail('TOKEN_AUDIENCE');
  if(!Number.isFinite(payload.exp)||payload.exp<=seconds)fail('TOKEN_EXPIRED');
  if(!Number.isFinite(payload.iat)||payload.iat>seconds+30)fail('TOKEN_ISSUED_AT');
  if(payload.nbf!==undefined&&(!Number.isFinite(payload.nbf)||payload.nbf>seconds+30))fail('TOKEN_NOT_YET_VALID');
  if(!payload.sub)fail('TOKEN_SUBJECT');
  if(typeof payload.email!=='string'||payload.email.toLowerCase()!==env.DASHBOARD_OWNER_EMAIL.trim().toLowerCase())fail('TOKEN_OWNER');
  const keyId=issuer+':'+header.kid;let cached=keys.get(keyId);
  if(!cached||cached.expires<=now){
    let response,keySet;
    // Workers supports manual/follow only. Reject redirects through the status check below.
    try { response=await fetcher(issuer+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(8000),redirect:'manual'}); }
    catch { fail('SIGNING_KEYS_FETCH'); }
    if(!response.ok)fail('SIGNING_KEYS_UNAVAILABLE');
    try { keySet=await response.json(); } catch { fail('SIGNING_KEYS_FORMAT'); }
    const jwk=keySet.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256'&&k.use==='sig');
    if(!jwk)fail('SIGNING_KEY_UNKNOWN');
    let key;
    try { key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']); }
    catch { fail('SIGNING_KEY_INVALID'); }
    cached={key,expires:now+300000};
    if(keys.size>=8)keys.clear();keys.set(keyId,cached);
  }
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',cached.key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))fail('TOKEN_SIGNATURE');
  return {email:payload.email};
}
export async function privateGate(request,env,options){
  if(!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN||!env.DASHBOARD_OWNER_EMAIL||!env.APP_HOSTNAME)return new Response('Private dashboard setup is incomplete.',{status:503});
  if(new URL(request.url).hostname!==env.APP_HOSTNAME)return new Response('Unknown host',{status:403});
  // Public paths do not receive Access's assertion header. Verify the same
  // signed application token from its HttpOnly cookie; never trust cookie
  // presence, unsigned identity headers or a token for another application.
  let token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token){
    const cookies=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('CF_Authorization='));
    if(cookies.length===1)token=cookies[0].slice('CF_Authorization='.length);
  }
  try{await verifyAccessToken(token,env,options);grantVerifiedOwner(request);return null;}
  catch(error){
    // Log only a fixed diagnostic code, never tokens, cookies, claim values or keys.
    const reason=error instanceof AccessFailure?error.code:'TOKEN_VERIFICATION';
    console.warn(JSON.stringify({event:'bdashh_access_denied',reason}));
    return new Response('Private dashboard. Your sign-in could not be verified. Reference: '+reason,{status:401});
  }
}
export function protectResponse(response){
  const headers=new Headers(response.headers);
  headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');
  headers.set('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
