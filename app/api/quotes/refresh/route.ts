import {requireDashboardWrite} from '../../../../lib/dashboard-access.mjs';
import {materialize} from '../../../../lib/workbook.mjs';
import {env} from 'cloudflare:workers';
import {fetchQuote} from '../../../../lib/market-quotes.mjs';
import {capturePortfolioHistory} from '../../../../lib/portfolio-history.mjs';
import {mergeCooldowns} from '../../../../lib/holdings.mjs';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 const denied=requireDashboardWrite(req,env);if(denied)return denied;
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'Origin rejected'},403);
 const b=env.BUCKET;if(!b)return json({error:'Storage unavailable'},503);
 const o=await b.get('dashboard.json');if(!o)return json({error:'Add holdings first'},400);
 const initial:any=await o.json();
 if(initial.quoteRefresh?.version===2&&Date.now()-Date.parse(initial.quoteRefresh.checkedAt)<45000)return json({...initial,refreshNotice:'Recently checked. Please wait 45 seconds between price checks.'});
 const lock=await b.get('quote-refresh-lock.json');if(lock&&Date.now()<JSON.parse(await lock.text()).until)return json({error:'A price refresh is already running. Try again shortly.'},429);
 const lease=await b.put('quote-refresh-lock.json',JSON.stringify({until:Date.now()+90000}),{onlyIf:lock?{etagMatches:lock.etag}:{etagDoesNotMatch:'*'}});if(!lease)return json({error:'A price refresh is already running.'},429);
 try{
 const tickers=[...new Set(initial.holdings.map((h:any)=>h.ticker))] as string[];
 const quotes:any={},errors:Record<string,string>={},cooldowns=mergeCooldowns(initial.quoteRefresh?.providerCooldowns,initial.quoteProviderCooldowns);
 if(initial.quoteRefresh?.retryAfter)cooldowns['Yahoo Finance']=initial.quoteRefresh.retryAfter;
 // Up to four workers; backoff applies only to the provider that is rate limited.
 let cursor=0;await Promise.all(Array.from({length:Math.min(4,tickers.length)},async()=>{while(cursor<tickers.length){const t=tickers[cursor++];try{quotes[t]=await fetchQuote(t,{cooldowns})}catch(e){errors[t]=e instanceof Error?e.message:'Quote unavailable'}}}));
 for(let attempt=0;attempt<3;attempt++){
 const current=await b.get('dashboard.json');if(!current)return json({error:'Portfolio unavailable'},409);const state:any=await current.json();const before=structuredClone(state);state.quotes||={};const updated:string[]=[],unchanged:string[]=[],failed:string[]=[];
 for(const h of state.holdings){const q=quotes[h.ticker],old=state.quotes[h.ticker];if(q&&(!old||Date.parse(q.asOf)>=Date.parse(old.asOf))){state.quotes[h.ticker]=q;if(old?.price===q.price&&Date.parse(old.asOf)===Date.parse(q.asOf))unchanged.push(h.ticker);else updated.push(h.ticker);}else{failed.push(h.ticker);errors[h.ticker]||=q?'Provider returned an older quote; newer saved price retained.':'No quote returned.';}}
 state.quoteRefresh={version:2,checkedAt:new Date().toISOString(),providerCooldowns:cooldowns,errors,updated,unchanged,failed};state.updatedAt=new Date().toISOString();state.sheets=materialize(state).sheets;
 const saved=await b.put('dashboard.json',JSON.stringify(state),{httpMetadata:{contentType:'application/json'},onlyIf:{etagMatches:current.etag}});if(saved){const historyWarning=await capturePortfolioHistory(b,[before,state]);return json(historyWarning?{...state,historyWarning}:state);}
 }return json({error:'Dashboard changed during refresh. Please retry.'},409);
 }finally{await b.put('quote-refresh-lock.json',JSON.stringify({until:0}),{onlyIf:{etagMatches:lease.etag}});}
}
