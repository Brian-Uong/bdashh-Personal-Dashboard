export const HISTORY_RANGES=[['1d','1D'],['1w','1W'],['1mo','1M'],['3mo','3M'],['1y','1Y'],['5y','5Y'],['all','All']];
export function historyWindow(points,range,now=Date.now()){
 const days=({'1d':1,'1w':7,'1mo':30,'3mo':90,'1y':365,'5y':1826})[range];
 const cutoff=days?now/1000-days*86400:-Infinity;
 return points.filter(p=>p.time>=cutoff&&p.time<=now/1000+300);
}
export function historySummary(points,mode='value'){
 if(!points.length)return {latest:null,change:null,percent:null,holdingsChanged:false};
 const first=points[0],last=points.at(-1),holdingsChanged=points.some(p=>p.holdingsKey!==first.holdingsKey);
 const measure=p=>mode==='gain'?p.value-p.cost:p.value;
 const change=points.length>1?measure(last)-measure(first):null;
 return {latest:measure(last),change,percent:mode==='value'&&!holdingsChanged&&points.length>1&&first.value>0?change/first.value*100:null,holdingsChanged};
}
export function historyRows(points,mode='value'){
 return points.map(p=>({time:p.time,value:mode==='gain'?p.value-p.cost:p.value}));
}
export function historyShell(){
 return `<section id="portfolioHistory" class="portfolio-history" aria-label="Portfolio performance over time">
  <div class="history-heading"><div><span class="pd-kicker">THE BIG PICTURE</span><h3>Your portfolio over time</h3><p>Recorded holdings value and unrealized gains, in one view.</p></div><span class="history-badge">TradingView charts</span></div>
  <div class="history-controls"><div class="history-modes" role="group" aria-label="Portfolio chart measure"><button type="button" data-history-mode="value" aria-pressed="true">Portfolio value</button><button type="button" data-history-mode="gain" aria-pressed="false">Unrealized gain / loss</button></div><div class="history-ranges" role="group" aria-label="Portfolio chart time range">${HISTORY_RANGES.map(([key,label])=>`<button type="button" data-history-range="${key}" aria-pressed="${key==='1mo'}">${label}</button>`).join('')}</div></div>
  <div class="history-stats"><div><span data-history-label>Latest recorded value</span><strong data-history-value>—</strong></div><div><span data-history-change-label>Value change in view</span><strong data-history-change>—</strong></div><div><span>Recorded snapshots</span><strong data-history-count>—</strong></div></div>
  <p class="history-status" role="status" aria-live="polite">Loading portfolio history…</p><div class="history-plot-wrap"><div class="history-plot" role="img" aria-label="Recorded portfolio values over time"></div><div class="history-empty" hidden></div></div>
  <div class="history-legend"><span><i></i><b data-history-series-label>Holdings value</b></span><label><input type="checkbox" data-history-cost checked> <i class="cost"></i> Cost basis</label><button class="quiet" data-history-fit>Reset zoom</button></div>
  <label class="history-inspector">Inspect a recorded snapshot<input type="range" min="0" max="0" value="0" step="1" aria-label="Inspect portfolio snapshot" disabled></label><output class="history-readout"></output>
  <p class="history-method">Records the saved stock holdings when prices or positions change, including daily briefing updates. Quotes can have different timestamps. Cash, dividends, fees and realized trades are excluded; value changes are not cash-flow-adjusted returns.</p>
  <details class="history-records"><summary>View recorded values</summary><div class="history-table"></div></details>
  <p class="history-credit"><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™</a> · Copyright (c) 2025 TradingView, Inc. · Portfolio data follows this dashboard’s viewing permissions.</p>
 </section>`;
}
