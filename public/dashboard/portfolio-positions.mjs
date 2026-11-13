import {companyMark,companyIdentity,externalArrow} from './company-brand.mjs';
import {quoteChange,positionView} from './investment-view.mjs';
import {portfolioStats} from './portfolio-charts.mjs';
import {pacificTime} from './quote-time.mjs';
export {pacificTime} from './quote-time.mjs';
export const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=x=>Number.isFinite(x)?x.toLocaleString('en-US',{style:'currency',currency:'USD'}):'—';
export const percent=x=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(2)}%`:'—';
export const signedMoney=x=>Number.isFinite(x)?`${x>0?'+':''}${money(x)}`:'—';
export const tone=x=>!Number.isFinite(x)?'neutral':x>0?'positive':x<0?'negative':'neutral';
export function refreshStatus(ticker,data){
 const refresh=data.quoteRefresh;
 if(!data.quotes?.[ticker])return 'No saved quote. Reload prices to check availability.';
 if(refresh?.failed?.includes(ticker))return 'Last refresh failed; saved quote retained.';
 if(refresh?.retained?.includes(ticker))return 'Checked; no newer quote available. Your newer saved price is retained.';
 if(refresh?.updated?.includes(ticker))return 'Updated on last price check.';
 if(refresh?.unchanged?.includes(ticker))return 'Verified unchanged on last price check.';
 return 'Saved snapshot. Reload prices to check for updates.';
}
export function positionCards(data,query='',sort='value'){
 const stats=portfolioStats(data),term=query.toLowerCase().trim();
 const rows=stats.rows.filter(row=>`${row.ticker} ${row.quote?.company||''} ${companyIdentity(row.ticker)?.company||''}`.toLowerCase().includes(term));
 const measure=r=>sort==='return'?r.returnPct:sort==='daily'?quoteChange(r.quote)?.percent:r.value;
 rows.sort(sort==='ticker'?(a,b)=>a.ticker.localeCompare(b.ticker):(a,b)=>(measure(b)??-Infinity)-(measure(a)??-Infinity)||a.ticker.localeCompare(b.ticker));
 if(!rows.length)return '<p class="position-empty">'+(stats.rows.length?'No holdings match your search.':'Add shares and purchase prices to start exploring your stocks.')+'</p>';
 return rows.map(row=>{
  const day=quoteChange(row.quote);
  const weight=stats.complete&&stats.value>0?row.value/stats.value*100:null;
  return `<article class="position-card" style="--position-color:${row.color}">
   <header><button class="position-ticker" data-stock-open="${escape(row.ticker)}" aria-label="Open ${escape(row.ticker)} stock details">${companyMark(row.ticker)}<span><strong>${escape(row.ticker)}</strong><small>${escape(row.quote?.company||'Stock details & charts')}</small></span></button><span class="position-arrow" aria-hidden="true">${externalArrow}</span></header>
   <div class="position-price"><strong>${money(row.value===null?null:row.quote.price)}</strong><span>Saved price / share${row.quote?.session?` · ${escape(row.quote.session)}`:''}</span></div>
   <time class="position-quote-time">${escape(pacificTime(row.quote?.asOf))} · ${escape(row.quote?.source||'No source')}</time>
   <div class="position-daily ${tone(day?.dollars)}"><b>${day?percent(day.percent):'—'}</b><span>${day?signedMoney(day.dollars):'Change unavailable'}</span><small>vs. prior close</small></div>
   <div class="position-return ${tone(row.gain)}"><b>${signedMoney(row.gain)}</b><span>${percent(row.returnPct)} since purchase</span></div>
   <dl class="position-numbers"><div><dt>Market value</dt><dd>${money(row.value)}</dd></div><div><dt>Shares</dt><dd>${Number(row.shares).toLocaleString('en-US',{maximumFractionDigits:6})}</dd></div><div><dt>Avg. cost</dt><dd>${money(row.avgCost)}</dd></div></dl>
   <div class="position-weight"><span>Portfolio weight</span><b>${weight===null?'—':weight.toFixed(1)+'%'}</b><div><i style="width:${weight===null?0:Math.max(0,Math.min(100,weight))}%"></i></div></div>
   <details class="position-provenance"><summary>Quote details</summary><p>Cost basis: ${money(row.cost)}<br>${escape(row.quote?.source||'No provider')} · ${escape(row.quote?.session||'Saved snapshot')}<br>${escape(pacificTime(row.quote?.asOf))}</p><p>${escape(refreshStatus(row.ticker,data))}${data.quoteRefresh?.checkedAt?`<br>Last checked: ${escape(pacificTime(data.quoteRefresh.checkedAt))}`:''}</p>${row.quote?.providerNotes?`<p>Source note: ${escape(row.quote.providerNotes)}</p>`:''}</details>
   <button class="position-open" data-stock-open="${escape(row.ticker)}">Explore ${escape(row.ticker)} ${externalArrow}</button>
   <div class="position-manage"><button type="button" data-edit-stock="${escape(row.ticker)}" aria-label="Edit ${escape(row.ticker)} position">Edit</button><button type="button" data-remove-stock="${escape(row.ticker)}" aria-label="Remove ${escape(row.ticker)} from portfolio">Remove</button></div>
  </article>`;
 }).join('');
}
export function renderPositions(data){
 const view=positionView();
 return `<section id="positionDetails" class="position-details" aria-label="Position details"><div class="positions-heading"><div><span class="pd-kicker">YOUR HOLDINGS</span><h3>Position details</h3><p>Open any ticker for market information and its price history.</p></div><div class="position-heading-actions"><span class="position-count">${data.holdings.length} holdings</span><button class="button gold" data-add-stock>＋ Add stock</button></div></div><p id="holdingsNotice" class="holdings-notice" role="status" aria-live="polite"></p>
 <div class="position-toolbar"><label><span class="sr">Search holdings</span><input id="positionSearch" value="${escape(view.query)}" type="search" placeholder="Search ticker or company…" autocomplete="off"></label><label>Sort by<select id="positionSort" aria-label="Sort by">${[['value','Market value'],['return','Return since purchase'],['daily','Change vs. prior close'],['ticker','Ticker A–Z']].map(([value,label])=>`<option value="${value}"${value===view.sort?' selected':''}>${label}</option>`).join('')}</select></label></div>
 <div id="positionCards" class="position-grid">${positionCards(data,view.query,view.sort)}</div><p class="pd-note">Values use your saved quotes. Gains exclude dividends and realized trades. Historical stock charts are available inside each holding.</p></section>`;
}

// Pure chart geometry: straight segments preserve the provider's actual samples.
export function priceGeometry(points,width=800,height=260,averageCost=null){
 const left=62,right=18,top=18,bottom=38,plotW=width-left-right,plotH=height-top-bottom;
 const prices=points.map(p=>p.close),minimum=Math.min(...prices),maximum=Math.max(...prices),pad=Math.max((maximum-minimum)*.09,maximum*.005,.01);
 const low=Math.max(0,minimum-pad),high=maximum+pad,start=points[0].time,end=points.at(-1).time;
 const x=time=>left+(time-start)/(end-start||1)*plotW;
 const y=price=>top+(high-price)/(high-low)*plotH;
 const coords=points.map(point=>[x(point.time),y(point.close)]);
 const line=coords.map(([a,b],i)=>`${i?'L':'M'}${a.toFixed(2)},${b.toFixed(2)}`).join(' ');
 return {width,height,left,right,top,bottom,plotW,plotH,low,high,coords,line,area:`${line} L${coords.at(-1)[0]},${top+plotH} L${left},${top+plotH} Z`,averageY:Number.isFinite(averageCost)&&averageCost>=low&&averageCost<=high?y(averageCost):null};
}
