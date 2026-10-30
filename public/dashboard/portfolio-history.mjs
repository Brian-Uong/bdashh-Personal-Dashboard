import {apiFetch} from './api-client.mjs';
import {canEdit} from './dashboard-access.mjs';
import {getData} from './synced.mjs';
import {escape as e,money,signedMoney,percent,pacificTime} from './portfolio-positions.mjs';
import {historyWindow,historySummary,historyRows} from './portfolio-history-data.mjs';
let active=null,selectedRange='1mo',selectedMode='value',saved=null;
const pending=new Map();
function loadHistory(key){
 if(saved?.key===key&&Date.now()-saved.time<60000)return Promise.resolve(saved.data);
 if(pending.has(key))return pending.get(key);
 const request=apiFetch('/api/portfolio/history',{method:canEdit?'POST':'GET',signal:AbortSignal.timeout(15000),...(canEdit?{headers:{'Content-Type':'application/json'},body:'{}'}:{})}).then(async response=>{
  const data=await response.json();if(!response.ok)throw Error(data.error||'Portfolio history unavailable');saved={key,data,time:Date.now()};return data;
 }).finally(()=>pending.delete(key));
 pending.set(key,request);return request;
}
const date=p=>new Date(p.time*1000).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',year:'numeric'});
function dispose(){if(active){active.disposed=true;active.controller.abort();active.chart?.remove();active=null;}}
function inspect(view,index){
 const p=view.visible[index];if(!p)return;
 const label=`${pacificTime(p.time*1000)} · Value ${money(p.value)} · Cost ${money(p.cost)} · Unrealized ${signedMoney(p.value-p.cost)}. Quote times: ${pacificTime(p.quoteOldest)} to ${pacificTime(p.quoteNewest)}.`;
 view.root.querySelector('.history-readout').textContent=label;
 const slider=view.root.querySelector('.history-inspector input');slider.value=index;slider.setAttribute('aria-valuetext',label);
}
function render(view){
 if(view.disposed)return;
 const root=view.root,points=view.data.points,visible=historyWindow(points,selectedRange),summary=historySummary(visible,selectedMode);view.visible=visible;
 for(const b of root.querySelectorAll('[data-history-range]'))b.setAttribute('aria-pressed',String(b.dataset.historyRange===selectedRange));
 for(const b of root.querySelectorAll('[data-history-mode]'))b.setAttribute('aria-pressed',String(b.dataset.historyMode===selectedMode));
 root.querySelector('[data-history-label]').textContent=selectedMode==='gain'?'Latest unrealized gain / loss':'Latest recorded value';
 root.querySelector('[data-history-value]').textContent=money(summary.latest);
 root.querySelector('[data-history-change-label]').textContent=selectedMode==='gain'?'Change in unrealized gain / loss':'Value change in view';
 root.querySelector('[data-history-change]').textContent=summary.change===null?'—':signedMoney(summary.change)+(summary.percent===null?'':` (${percent(summary.percent)})`);
 root.querySelector('[data-history-change]').className=summary.change===null?'':summary.change<0?'negative':'positive';
 root.querySelector('[data-history-count]').textContent=String(visible.length);
 root.querySelector('[data-history-series-label]').textContent=selectedMode==='gain'?'Unrealized gain / loss':'Holdings value';
 const costToggle=root.querySelector('[data-history-cost]');costToggle.disabled=selectedMode==='gain';costToggle.closest('label').hidden=selectedMode==='gain';
 view.series.setData(historyRows(visible,selectedMode));view.cost.setData(visible.map(p=>({time:p.time,value:p.cost})));
 view.cost.applyOptions({visible:selectedMode==='value'&&costToggle.checked});
 view.series.applyOptions({lineColor:selectedMode==='gain'?'#ff82d7':'#68e8ff',topColor:selectedMode==='gain'?'#ff82d733':'#68e8ff33',pointMarkersVisible:visible.length<=30});
 view.chart.timeScale().fitContent();
 const status=root.querySelector('.history-status');
 status.textContent=(view.data.notice?view.data.notice+' ':'')+(points.length?`Available history: ${date(points[0])} – ${date(points.at(-1))}. `:'')+(visible.length>1?`${visible.length} observations in this range. `:'')+(summary.holdingsChanged?'Holdings or purchase costs changed in this view; the value change includes those edits.':'')+(getData()?.historyWarning?' '+getData().historyWarning:'');
 const empty=root.querySelector('.history-empty');empty.hidden=visible.length>1;
 empty.innerHTML=visible.length===1?`<strong>Tracking has started</strong><p>First recorded value: ${money(visible[0].value)}.</p><p>A trend will appear after the next price or position update. Older balances were not saved, so they are not estimated here.</p>`:points.length?'<strong>No records in this range</strong><p>Choose All to see your available history.</p><button class="quiet" data-history-range="all">Show all history</button>':'<strong>Ready to track your portfolio</strong><p>Add holdings and load a complete set of prices to record the first value.</p>';
 const slider=root.querySelector('.history-inspector input');slider.disabled=!visible.length;slider.max=Math.max(0,visible.length-1);slider.value=Math.max(0,visible.length-1);
 root.querySelector('.history-readout').textContent='';if(visible.length)inspect(view,visible.length-1);
 root.querySelector('.history-table').innerHTML=visible.length?`<p>Most recent ${Math.min(visible.length,100)} observations in this range.</p><table><thead><tr><th>Recorded · Pacific</th><th>Holdings value</th><th>Cost basis</th><th>Unrealized gain / loss</th></tr></thead><tbody>${visible.slice(-100).reverse().map(p=>`<tr><td>${e(pacificTime(p.time*1000))}</td><td>${money(p.value)}</td><td>${money(p.cost)}</td><td>${signedMoney(p.value-p.cost)}</td></tr>`).join('')}</tbody></table>`:'<p>No recorded values in this range.</p>';
}
export async function mountPortfolioHistory(enabled=true){
 dispose();const root=enabled?document.getElementById('portfolioHistory'):null;if(!root)return;
 const view=active={root,controller:new AbortController(),disposed:false,chart:null,visible:[]};
 try{
  const key=getData()?.updatedAt||'';
  const [library,data]=await Promise.all([import('./vendor/lightweight-charts-5.0.9.mjs'),loadHistory(key)]);
  if(view.disposed)return;view.data=data;
  const formatTime=t=>pacificTime(Number(t)*1000);
  const tickMarkFormatter=(t,type)=>new Date(Number(t)*1000).toLocaleString('en-US',{timeZone:'America/Los_Angeles',...(type>=3?{hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',...(type===0?{year:'numeric'}:{})})});
  // The library uses a layout table internally. Isolate it from dashboard table
  // styles so price axes and canvas widths stay correct at every breakpoint.
  const host=root.querySelector('.history-plot'),shadow=host.shadowRoot||host.attachShadow({mode:'open'}),canvasHost=document.createElement('div');
  canvasHost.style.cssText='width:100%;height:100%;';shadow.replaceChildren(canvasHost);
  view.chart=library.createChart(canvasHost,{
   autoSize:true,height:340,layout:{background:{type:'solid',color:'transparent'},textColor:'#bcb9d4',attributionLogo:true,fontFamily:'Inter, system-ui, sans-serif'},
   grid:{vertLines:{color:'#b5a4ff10'},horzLines:{color:'#b5a4ff20'}},rightPriceScale:{borderColor:'#b5a4ff30'},
   timeScale:{borderColor:'#b5a4ff30',timeVisible:true,secondsVisible:false,tickMarkFormatter,lockVisibleTimeRangeOnResize:true,minBarSpacing:0.1},localization:{priceFormatter:money,timeFormatter:formatTime},
   handleScroll:{vertTouchDrag:false},crosshair:{vertLine:{color:'#b5a4ff88'},horzLine:{color:'#b5a4ff88'}}});
  view.series=view.chart.addSeries(library.AreaSeries,{lineColor:'#68e8ff',topColor:'#68e8ff33',bottomColor:'#68e8ff00',lineWidth:2,priceLineVisible:false,lastValueVisible:true,pointMarkersVisible:true,pointMarkersRadius:3});
  view.cost=view.chart.addSeries(library.LineSeries,{color:'#ff82d7',lineWidth:1,lineStyle:library.LineStyle.Dashed,priceLineVisible:false,lastValueVisible:false});
  view.chart.subscribeCrosshairMove(event=>{if(event.time!==undefined){const index=view.visible.findIndex(p=>p.time===event.time);if(index>=0)inspect(view,index);}});
  root.addEventListener('click',event=>{
   const range=event.target.closest('[data-history-range]'),mode=event.target.closest('[data-history-mode]');
   if(range){selectedRange=range.dataset.historyRange;render(view);}else if(mode){selectedMode=mode.dataset.historyMode;render(view);}else if(event.target.closest('[data-history-fit]'))view.chart.timeScale().fitContent();
  },{signal:view.controller.signal});
  root.querySelector('[data-history-cost]').addEventListener('change',()=>render(view),{signal:view.controller.signal});
  root.querySelector('.history-inspector input').addEventListener('input',event=>inspect(view,Number(event.target.value)),{signal:view.controller.signal});
  render(view);
 }catch(error){if(view.disposed||error.name==='AbortError')return;root.querySelector('.history-status').textContent='History could not load. '+error.message;root.querySelector('.history-plot-wrap').hidden=true;const retry=document.createElement('button');retry.className='quiet';retry.textContent='Retry history';retry.onclick=()=>{retry.remove();root.querySelector('.history-plot-wrap').hidden=false;mountPortfolioHistory(true);};root.append(retry);}
}
