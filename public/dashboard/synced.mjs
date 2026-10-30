import {apiFetch} from './api-client.mjs';
import {renderPositions,pacificTime} from './portfolio-positions.mjs';
import {historyShell} from './portfolio-history-data.mjs';
import {renderPortfolioCharts} from './portfolio-charts.mjs';
import {renderBriefing} from './briefing-cards.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const usd=x=>Number.isFinite(x)?x.toLocaleString('en-US',{style:'currency',currency:'USD'}):'—';
// A bounded preview from the saved briefing; the full text stays in Investments.
export function briefingSummary(value){
 const text=String(value??'').trim();
 const paragraphs=text.split(/\n\s*\n/).map(p=>p.replace(/^[A-Z][A-Z /—–-]{4,}\r?\n/,'').replace(/\s+/g,' ').trim());
 const preview=paragraphs.find(p=>p.length>60&&p!==p.toUpperCase())||text.replace(/\s+/g,' ');
 if(preview.length<=360)return preview;
 const cut=preview.slice(0,357).replace(/\s+\S*$/,'');
 return (cut||preview.slice(0,357))+'…';
}
let data=null;
let expandedBriefing=null;
document.addEventListener('toggle',event=>{
 const target=event.target;
 if(target?.isConnected&&target.hasAttribute?.('data-briefing-details'))expandedBriefing=target.open?target.getAttribute('data-briefing-details'):null;
},true);
let chartMode='dollars';
document.addEventListener('change',e=>{if(e.target.id==='portfolioChartMode'){chartMode=e.target.value;const root=document.getElementById('portfolioVisuals');if(root&&data)root.innerHTML=renderPortfolioCharts(data,chartMode);}});
let refreshing=false;
export const isRefreshing=()=>refreshing;
export async function refreshQuotes(){if(refreshing)return data;refreshing=true;try{const r=await apiFetch("/api/quotes/refresh",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}",timeoutMs:95000});const v=await r.json();if(!r.ok)throw Error(v.error||"Price refresh failed");return acceptData(v);}finally{refreshing=false;}}
export const getData=()=>data;
// Ignore slower responses that predate a position change already shown here.
export const acceptData=value=>{if(data&&Date.parse(value?.updatedAt)<Date.parse(data.updatedAt))return data;data=value;return data;};
export async function pull({accept=true}={}){const r=await apiFetch('/api/sync',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Could not load saved dashboard');const next=await r.json();return accept?acceptData(next):next;}
export async function save(patch){if(patch.sheets)patch={...patch,baseUpdatedAt:data?.updatedAt||null};const r=await apiFetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});const v=await r.json();if(!r.ok)throw Error(v.error||'Save failed');return acceptData(v);}
export function finance(compact=false){if(!data)return '<p>Loading saved portfolio…</p>';let value=0,cost=0,complete=true;const rows=data.holdings.map(h=>{const q=data.quotes[h.ticker],v=q?h.shares*q.price:null,c=h.shares*h.avgCost;cost+=c;if(v===null)complete=false;else value+=v;return{...h,q,v,c};});
const brief=data.briefing;const stamps=rows.filter(h=>h.q).map(h=>h.q.asOf).filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(a)-Date.parse(b));const stamp=stamps.length?pacificTime(stamps[0]):'Unavailable';
const portfolioMarkup=`<section class="pd-panel"><span class="pd-kicker">SAVED PORTFOLIO · 7 AM PACIFIC BRIEFING</span><h2>${complete?usd(value):'Incomplete valuation'}</h2><div class="pd-mini-grid"><div>Cost basis<br><strong>${usd(cost)}</strong></div><div>Unrealized gain / loss<br><strong>${complete?usd(value-cost):'—'} ${complete&&cost?'('+((value/cost-1)*100).toFixed(2)+'%)':''}</strong></div><div>Holdings<br><strong>${rows.length}</strong></div></div><p class="pd-note">Oldest included quote: ${esc(stamp)}. Reload prices checks Nasdaq first, then Yahoo if needed. Quotes may be delayed. Extended-hours prices are labeled by session. Saved prices remain in the valuation if a refresh fails; check each holding’s status below. Gains exclude dividends and realized trades.</p>${compact?'<button class="quiet" data-section="investments">Open portfolio & briefing ↗</button>':`<button class="button gold" data-add-stock>＋ Add stock</button><button class="button subtle" id="syncReload">↻ Reload prices</button><p id="quoteRefreshStatus" role="status" aria-live="polite">${esc(refreshSummary(data))}</p>${historyShell()}<div id="portfolioVisuals">${renderPortfolioCharts(data,chartMode)}</div>${renderPositions(data)}`}</section>`;
const briefingMarkup=renderBriefing(brief,{expanded:!!brief&&expandedBriefing===brief.asOf});
const summaryMarkup=renderBriefing(brief,{compact:true});
return compact?portfolioMarkup+summaryMarkup:briefingMarkup+portfolioMarkup;
}

function refreshSummary(d){const r=d.quoteRefresh;if(!r)return 'Fetch the latest available quotes for your saved holdings.';return (d.refreshNotice?d.refreshNotice+' ':'')+'Last checked '+new Date(r.checkedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' PT · '+(r.updated||[]).length+' updated · '+(r.unchanged||[]).length+' verified unchanged'+((r.failed||[]).length?' · '+r.failed.length+' could not refresh; saved prices retained.':' · All holdings checked.');}
function quoteStatus(t,d){const r=d.quoteRefresh,q=d.quotes[t];if(!q)return 'No quote available';if(r?.failed?.includes(t))return 'Refresh failed — '+(r.errors?.[t]||'saved price retained');if(r?.updated?.includes(t))return 'Updated on last check';if(r?.unchanged?.includes(t))return 'Verified — no price change';return 'Saved quote — reload to verify';}
