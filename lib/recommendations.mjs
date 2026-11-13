import {fetchQuote,compareQuotes,easternTimestamp} from './market-quotes.mjs';
import {fetchNasdaqHistory} from './stock-history.mjs';
export const RECOMMENDATIONS_KEY='recommendations-v1.json';
export const dayPT=time=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
export function referenceTime(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||new Date(day+'T12:00Z').toISOString().slice(0,10)!==day)throw Error('Invalid recommendation date');const label=new Date(day+'T12:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});return easternTimestamp(label+' 10:00 AM ET');}
const clean=(v,n=800)=>typeof v==='string'?v.trim().slice(0,n):'';
const url=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const issuer=t=>({GOOG:'GOOGL','BRK-A':'BRK','BRK-B':'BRK','BRK.A':'BRK','BRK.B':'BRK','BF-A':'BF','BF-B':'BF','BF.A':'BF','BF.B':'BF'}[t]||t);
const companyKey=s=>clean(s).toLowerCase().replace(/class\s+[a-z]\b|common stock|ordinary shares|corporation|incorporated|\binc\b|\bcorp\b|\bltd\b|\bplc\b|\bthe\b/g,'').replace(/[^a-z0-9]/g,'');
export function assertEligible(picks,dashboard){
 const held=(dashboard?.holdings||[]).filter(h=>h.shares>0),symbols=new Set(held.map(h=>issuer(h.ticker))),companies=new Set(held.map(h=>companyKey(dashboard.quotes?.[h.ticker]?.company)).filter(Boolean));
 const seen=new Set(),names=new Set();for(const p of picks){const id=issuer(p.ticker),name=companyKey(p.company);if(symbols.has(id)||name&&companies.has(name))throw Error('A recommendation is already held: '+p.ticker);if(seen.has(id)||name&&names.has(name))throw Error('Duplicate company recommendation');seen.add(id);if(name)names.add(name);}
}
export function normalizePicks(input,now){
 if(!Array.isArray(input)||input.length>3)throw Error('Use up to three recommendations per Pacific date');
 return input.map((p,i)=>{
  if(!p||!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(p.ticker))throw Error('Invalid recommendation ticker');
  const sources=(Array.isArray(p.sources)?p.sources:[]).slice(0,5).map(s=>({title:clean(s.title,180),url:url(s.url),publishedAt:clean(s.publishedAt,40)})).filter(s=>s.url&&s.title);
  if(!sources.length||!sources.some(s=>{const t=Date.parse(s.publishedAt);return Number.isFinite(t)&&t<=now&&t>=now-48*3600000;}))throw Error('Each recommendation needs a verified source published within 48 hours');
  const result={ticker:p.ticker,rank:i+1,company:clean(p.company,180),sector:clean(p.sector,80),thesis:clean(p.thesis),catalyst:clean(p.catalyst),valuation:clean(p.valuation),risk:clean(p.risk),invalidation:clean(p.invalidation),horizon:clean(p.horizon,100)||'1–3 months',sources};
  for(const key of ['company','thesis','catalyst','valuation','risk','invalidation'])if(!result[key])throw Error('Missing recommendation field: '+key);
  return result;
 });
}
export const emptyRecommendations=()=>({schemaVersion:1,records:[],editions:[],quotes:{},providerCooldowns:{},lastRefresh:null});
export async function readRecommendations(bucket){const obj=await bucket.get(RECOMMENDATIONS_KEY);return obj?await obj.json():emptyRecommendations();}
async function update(bucket,change){for(let i=0;i<4;i++){const obj=await bucket.get(RECOMMENDATIONS_KEY),state=obj?await obj.json():emptyRecommendations(),next=await change(state);if(await bucket.put(RECOMMENDATIONS_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf:obj?{etagMatches:obj.etag}:{etagDoesNotMatch:'*'}}))return next;}throw Error('Recommendation history changed. Reload and retry.');}
async function dashboard(bucket){const o=await bucket.get('dashboard.json');return o?await o.json():{holdings:[]};}
export function selectReference(points,target,source){
 const eligible=points.filter(p=>Number.isFinite(p.close)&&p.close>0&&p.time*1000<=target&&p.time*1000>=target-60000).sort((a,b)=>b.time-a.time);const p=eligible[0];
 return p?{price:p.close,asOf:new Date(p.time*1000).toISOString(),source,currency:'USD',timePrecision:'minute',session:'Regular session',kind:p.time*1000===target?'7 AM minute quote':'Nearest preceding minute'}:null;
}
export async function fetchReference(ticker,day,{now=()=>Date.now(),fetcher=fetch,cooldowns={},deadline=Infinity}={}){
 const target=Date.parse(referenceTime(day));if(now()<target)return null;
 if(deadline-now()<1500)throw Error('Refresh time budget reached');
 const errors=[];
 if(Date.parse(cooldowns.Nasdaq||'')<=now()||!cooldowns.Nasdaq){try{const h=await fetchNasdaqHistory(ticker,'1d',{fetcher,now});const q=selectReference(h.points,target,'Nasdaq');if(q)return q;}catch(e){if(e.retryAt)cooldowns.Nasdaq=new Date(e.retryAt).toISOString();errors.push(e.message);}}
 if(deadline-now()<1500||Date.parse(cooldowns['Yahoo Finance']||'')>now())return null;
 try{
  const start=Math.floor(target/1000)-3600,end=Math.min(Math.floor(now()/1000),Math.floor(target/1000)+120);
  if(end<=start)return null;
  const r=await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replaceAll('.','-'))}?interval=1m&period1=${start}&period2=${end}&includePrePost=true`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(Math.max(1,Math.min(8000,deadline-now())))});
  if(!r.ok){if(r.status===429)cooldowns['Yahoo Finance']=new Date(now()+900000).toISOString();return null;}
  const d=(await r.json())?.chart?.result?.[0];if(d?.meta?.symbol!==ticker.replaceAll('.','-')||d.meta.currency!=='USD'||d.meta.dataGranularity!=='1m')return null;
  return selectReference((d.timestamp||[]).slice(0,500).map((time,i)=>({time,close:d.indicators?.quote?.[0]?.close?.[i]})),target,'Yahoo Finance');
 }catch{return null;}
}
export async function recordRecommendations(bucket,payload,{now=()=>Date.now(),quoteFetcher=fetchQuote,referenceFetcher=fetchReference}={}){
 const created=now(),date=payload.date,target=referenceTime(date);if(date!==dayPT(created))throw Error('New recommendations must use today’s Pacific date; backdating is not allowed');
 const picks=normalizePicks(payload.picks,created),reason=clean(payload.reason,600);if(picks.length<3&&!reason)throw Error('Explain why fewer than three picks are supported');
 const current=await readRecommendations(bucket),existing=current.editions.find(e=>e.date===date);
 if(existing){if(JSON.stringify(existing.tickers)!==JSON.stringify(picks.map(p=>p.ticker)))throw Error('Today’s recommendations are locked; original picks cannot be replaced');return {...current,notice:'Today’s original recommendations are already recorded.'};}
 assertEligible(picks,await dashboard(bucket));
 // Commit research before fetching prices: failures cannot erase or rewrite a pick.
 let state=await update(bucket,async s=>{
  if(s.editions.some(e=>e.date===date))throw Error('Today’s recommendations were saved elsewhere. Reload before retrying');
  assertEligible(picks,await dashboard(bucket));
  const source=await dashboard(bucket),brief=source.briefing,recordedAt=new Date(created).toISOString();s.records.push(...picks.map(p=>({...p,...(brief?.asOf&&dayPT(brief.asOf)===date&&brief.items?.some(i=>i.kind==='Idea'&&i.tickers?.includes(p.ticker))?{originalBriefedAt:brief.asOf}:{}),id:date+':'+p.ticker,date,recordedAt,referenceAt:target,reference:null,entry:null,entryMethod:null})));
  s.editions.push({date,recordedAt,tickers:picks.map(p=>p.ticker),reason,comparison:clean(payload.comparison,1400)});s.updatedAt=new Date(now()).toISOString();return s;
 });
 if(picks.length)state=await refreshRecommendations(bucket,{ids:picks.map(p=>date+':'+p.ticker),forceInitial:true},{now,quoteFetcher,referenceFetcher});return state;
}
export async function refreshRecommendations(bucket,{ids,forceInitial=false}={}, {now=()=>Date.now(),quoteFetcher=fetchQuote,referenceFetcher=fetchReference}={}){
 const initial=await readRecommendations(bucket),started=now();
 if(!forceInitial&&started-Date.parse(initial.lastRefresh?.checkedAt)<60000)return {...initial,notice:'Prices were checked recently. Please wait one minute between checks.'};
 const lockKey='recommendation-refresh-lock.json',lock=await bucket.get(lockKey);if(lock&&JSON.parse(await lock.text()).until>started)throw Error('A recommendation refresh is already running');
 const lease=await bucket.put(lockKey,JSON.stringify({until:started+90000}),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});if(!lease)throw Error('A recommendation refresh is already running');
 try{
  if(ids!==undefined&&(!Array.isArray(ids)||ids.length>60||ids.some(x=>typeof x!=='string')))throw Error('Invalid recommendation selection');
  const selected=ids?initial.records.filter(r=>ids.includes(r.id)):[...initial.records].sort((a,b)=>(Date.parse(initial.quotes[a.ticker]?.checkedAt)||0)-(Date.parse(initial.quotes[b.ticker]?.checkedAt)||0));
  const tickers=[...new Set(selected.map(r=>r.ticker))].slice(0,20),cooldowns={...initial.providerCooldowns},quotes={},references={},errors={},deadline=started+65000;let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,tickers.length)},async()=>{while(cursor<tickers.length){const ticker=tickers[cursor++];try{quotes[ticker]=await quoteFetcher(ticker,{cooldowns,now,previous:initial.quotes[ticker],deadline});}catch(e){errors[ticker]=clean(e.message,300);}
   for(const r of selected.filter(r=>r.ticker===ticker&&!r.reference&&now()-Date.parse(r.referenceAt)<7*86400000&&Date.parse(r.referenceAt)<=now()).slice(-3)){try{references[r.id]=await referenceFetcher(ticker,r.date,{now,cooldowns,deadline});}catch{/* A missing 7 AM observation is never invented. */}}
  }}));
  return await update(bucket,s=>{
   for(const [t,q] of Object.entries(quotes))if(compareQuotes(q,s.quotes[t])>=0)s.quotes[t]=q;
   for(const r of s.records){if(!r.reference&&references[r.id])r.reference=references[r.id];if(r.entry)continue;
    const q=s.quotes[r.ticker];if(Date.parse(r.recordedAt)<=Date.parse(r.referenceAt)&&r.reference){r.entry={...r.reference};r.entryMethod='7 AM reference';}
    else if(q&&Number.isFinite(q.price)&&q.price>0&&!/^\d{4}-\d{2}-\d{2}$/.test(q.asOf)&&Date.parse(q.asOf)>=Date.parse(r.recordedAt)-60000){r.entry={...q};r.entryMethod='First quote after publication';}
   }
   s.providerCooldowns=cooldowns;s.lastRefresh={checkedAt:new Date(now()).toISOString(),checked:tickers,failed:Object.keys(errors),errors,remainingTickers:Math.max(0,new Set(selected.map(r=>r.ticker)).size-tickers.length)};s.updatedAt=new Date(now()).toISOString();return s;
  });
 }finally{await bucket.put(lockKey,JSON.stringify({until:0}),{onlyIf:{etagMatches:lease.etag}});}
}
