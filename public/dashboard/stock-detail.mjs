import {mountWidget,widgetConfig} from './tradingview-widget.mjs';
import {getData} from './synced.mjs';
import {portfolioStats} from './portfolio-charts.mjs';
import {escape as e,money,percent,signedMoney,tone,pacificTime,positionCards} from './portfolio-positions.mjs';
const ranges=[['1d','1D'],['1mo','1M'],['3mo','3M'],['1y','1Y'],['5y','5Y']];
let current=null;
const metric=(label,value)=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;

function updatePositions(){
 const target=document.getElementById('positionCards'),data=getData();
 if(target&&data)target.innerHTML=positionCards(data,document.getElementById('positionSearch')?.value,document.getElementById('positionSort')?.value);
}
document.addEventListener('input',event=>{if(event.target.id==='positionSearch')updatePositions();});
document.addEventListener('change',event=>{if(event.target.id==='positionSort')updatePositions();});
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-stock-open]');
 if(button)openStock(button.dataset.stockOpen,button);
});

function savedPosition(ticker){
 const data=getData(),stats=portfolioStats(data||{}),row=stats.rows.find(item=>item.ticker===ticker);
 if(!row)return '<p>This holding is no longer in your saved portfolio.</p>';
 return `<section class="stock-position"><div><span class="pd-kicker">YOUR SAVED POSITION</span><h3>${e(ticker)} in your portfolio</h3><p>Using your saved quote from ${e(pacificTime(row.quote?.asOf))}.</p></div>
 <dl class="stock-stat-grid">${metric('Shares',row.shares.toLocaleString('en-US',{maximumFractionDigits:6}))}${metric('Average cost',money(row.avgCost))}${metric('Cost basis',money(row.cost))}${metric('Saved market value',money(row.value))}<div class="${tone(row.gain)}"><dt>Unrealized gain / loss</dt><dd>${signedMoney(row.gain)} <small>${percent(row.returnPct)}</small></dd></div>${metric('Portfolio weight',stats.complete&&stats.value>0?(row.value/stats.value*100).toFixed(1)+'%':'—')}</dl><div class="position-manage"><button type="button" data-edit-stock="${e(ticker)}" aria-label="Edit ${e(ticker)} position">Edit position</button><button type="button" data-remove-stock="${e(ticker)}" aria-label="Remove ${e(ticker)} from portfolio">Remove stock</button></div></section>`;
}

// Refresh saved position metrics without reloading the market chart.
document.addEventListener('portfolio-synced',()=>{
 if(!current)return;
 const data=getData(),entry=current;
 if(!data?.holdings.some(h=>h.ticker===entry.ticker)){entry.dialog.close();return;}
 entry.dialog.querySelector('#stockSavedPosition').innerHTML=savedPosition(entry.ticker);
 entry.dialog.querySelector('#stockHolding').innerHTML=data.holdings.map(h=>`<option value="${e(h.ticker)}" ${h.ticker===entry.ticker?'selected':''}>${e(h.ticker)}</option>`).join('');
});

function paintWidget(entry,range){
 const content=entry.dialog.querySelector('#stockMarket');
 entry.cleanup?.();
 content.innerHTML=`<p class="stock-chart-status" role="status" aria-live="polite"></p><div class="stock-widget"></div><div class="stock-chart-actions"><a class="button subtle" href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(entry.ticker)}" target="_blank" rel="noopener noreferrer">Open full ${e(entry.ticker)} chart ↗</a><button class="quiet" data-stock-retry>Retry embedded chart</button></div><p class="stock-source">Chart by TradingView · Market coverage and delays vary by symbol. The direct chart opens outside the dashboard if embedded content is blocked.</p>`;
 entry.cleanup=mountWidget(content.querySelector('.stock-widget'),content.querySelector('.stock-chart-status'),widgetConfig(entry.ticker,range));

}

function loadRange(entry,range){
 entry.range=range;
 for(const button of entry.dialog.querySelectorAll('[data-stock-range]'))button.setAttribute('aria-pressed',String(button.dataset.stockRange===range));
 if(entry.ticker==='SPCX'){
  entry.dialog.querySelector('#stockMarket').innerHTML='<div class="stock-unavailable" role="status"><strong>Chart identity needs verification</strong><p>This ticker can identify different companies. A verified exchange listing is needed before displaying its chart. Your saved position is shown below.</p></div>';
  return;
 }
 paintWidget(entry,range);
}

export function openStock(ticker,trigger){
 const data=getData();if(!data?.holdings.some(h=>h.ticker===ticker))return;
 if(current)current.dialog.close();
 const dialog=document.createElement('dialog');dialog.className='stock-dialog';dialog.setAttribute('aria-labelledby','stockTitle');
 const entry=current={dialog,ticker,range:'1mo'};
 dialog.innerHTML=`<header class="stock-dialog-head"><div><span class="pd-kicker">STOCK EXPLORER</span><h2 id="stockTitle">${e(ticker)}</h2><p id="stockCompany">${e(data.quotes?.[ticker]?.company||'Price history & your position')}</p></div><button class="quiet" data-stock-close aria-label="Close stock details" autofocus>✕</button></header>
 <div class="stock-detail-controls"><label>Holding<select id="stockHolding" aria-label="Select holding">${data.holdings.map(h=>`<option value="${e(h.ticker)}" ${h.ticker===ticker?'selected':''}>${e(h.ticker)}</option>`).join('')}</select></label><div class="stock-ranges" role="group" aria-label="Chart time range">${ranges.map(([key,label])=>`<button type="button" data-stock-range="${key}" aria-pressed="${key==='1mo'}">${label}</button>`).join('')}</div></div>
 <section id="stockMarket" aria-label="Stock market information"></section><div id="stockSavedPosition">${savedPosition(ticker)}</div>
 <footer class="stock-links"><a href="https://finance.yahoo.com/quote/${encodeURIComponent(ticker.replaceAll('.','-'))}/news/" target="_blank" rel="noopener noreferrer">Company news ↗</a><a href="https://finance.yahoo.com/quote/${encodeURIComponent(ticker.replaceAll('.','-'))}/profile/" target="_blank" rel="noopener noreferrer">Company profile ↗</a></footer>`;
 dialog.addEventListener('click',event=>{
   if(event.target.closest('[data-stock-close]'))dialog.close();
   const range=event.target.closest('[data-stock-range]');if(range)loadRange(entry,range.dataset.stockRange);
   if(event.target.closest('[data-stock-retry]'))loadRange(entry,entry.range);
 });
 dialog.querySelector('#stockHolding').onchange=event=>openStock(event.target.value,trigger);
 dialog.addEventListener('close',()=>{
   entry.cleanup?.();dialog.remove();if(current===entry){current=null;document.body.classList.remove('stock-dialog-open');if(trigger?.isConnected)trigger.focus({preventScroll:true});}
 },{once:true});
 document.body.append(dialog);document.body.classList.add('stock-dialog-open');dialog.showModal();loadRange(entry,'1mo');
}
