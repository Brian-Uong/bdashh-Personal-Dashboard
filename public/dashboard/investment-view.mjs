import {companyIdentity} from './company-brand.mjs';
// Only view preferences: no holdings, prices, credentials or browser storage.
let view={query:'',sort:'value'};
export const positionView=()=>({...view});
export function reconcilePositionView(previous,next){
 const before=new Set((previous?.holdings||[]).map(h=>h.ticker)),after=next?.holdings||[];
 const added=after.some(h=>!before.has(h.ticker)),changed=added||before.size!==after.length;
 if(!previous||!changed)return positionView();
 const term=view.query.trim().toLowerCase();
 const matches=after.some(h=>`${h.ticker} ${next.quotes?.[h.ticker]?.company||''} ${companyIdentity(h.ticker)?.company||''}`.toLowerCase().includes(term));
 if(added||!matches)view.query='';
 return positionView();
}
export function setPositionView(patch){view={query:typeof patch.query==='string'?patch.query:view.query,sort:['value','return','daily','ticker'].includes(patch.sort)?patch.sort:view.sort};return positionView();}
export function quoteChange(quote){
 const {price,previousClose}=quote||{};
 if(!Number.isFinite(price)||price<=0||!Number.isFinite(previousClose)||previousClose<=0)return null;
 return {dollars:price-previousClose,percent:(price/previousClose-1)*100};
}
export function investmentJumpLinks(){return '<nav class="investment-jumps" aria-label="Investment sections"><span>YOUR MARKET DESK</span>'+[['recommendationTracker','01','Daily ideas'],['investmentBriefing','02','Briefing'],['portfolioSummary','03','Portfolio'],['positionDetails','04','Holdings']].map(([id,n,label])=>`<button type="button" data-investment-jump="${id}"><small>${n}</small>${label}<span aria-hidden="true">↓</span></button>`).join('')+'</nav>';}
