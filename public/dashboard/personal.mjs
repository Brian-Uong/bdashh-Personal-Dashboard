// Brian's Dash personal workspace. Pure data helpers and safe markup renderers.
// Workbook and CSV imports remain in tab memory. No brokerage credentials, API keys, or account access.
export const personalSections=[
 {key:'career',name:'Career hub',icon:'↗',title:'Career pipeline',sub:'Applications, networking and the next move toward analytics.'},
 {key:'investments',name:'Investments',icon:'◈',title:'Investment intelligence',sub:'Your holdings, market-news shortcuts and a daily research candidate.'},
 {key:'planner',name:'Daily planner',icon:'◷',title:'Daily planner',sub:'What matters today, this week and the next deadline.'}
];
const safe=v=>String(v??'').trim();
export const esc=v=>safe(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>safe(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const headersMap=rows=>(rows?.[0]||[]).map(x=>normalize(x));
const findHeader=(h,aliases)=>aliases.map(normalize).map(a=>h.indexOf(a)).find(x=>x>=0)??-1;
export function parseTable(sheets,tab,fields){
 const rows=sheets?.[tab]||[];if(rows.length<2)return [];
 const headers=headersMap(rows);if(!headers.some(Boolean))return [];
 const cols=Object.fromEntries(Object.entries(fields).map(([key,aliases])=>[key,findHeader(headers,aliases)]));
 return rows.slice(1).map((cells,index)=>Object.fromEntries([['__row',index+2],...Object.entries(cols).map(([key,pos])=>[key,pos<0?'':safe(cells[pos])])])).filter(x=>Object.entries(x).some(([key,val])=>key!=='__row'&&val));
}
const classFields={course:['course','class'],assignment:['assignment','task','deliverable'],due:['due date','deadline','due'],status:['status','state'],link:['link','url'],notes:['notes','details']};
const plannerFields={date:['date','day'],time:['time','start time'],task:['task','title','event'],category:['category','type'],status:['status','state'],link:['link','url'],notes:['notes','details']};
const holdingFields={ticker:['ticker','symbol','stock','instrument'],company:['company','name','description'],shares:['shares','quantity','qty','number of shares'],cost:['average cost','avg cost','average price','cost basis per share'],price:['last price','market price','price','current price'],asof:['price as of','as of','date'],notes:['notes','details']};
const researchFields={date:['date'],ticker:['ticker','symbol'],thesis:['thesis','why','research note'],risks:['risks','risk'],source:['source url','source','link']};
export const schoolRows=s=>parseTable(s,'Coursework',classFields);
export const plannerRows=s=>parseTable(s,'Daily Planner',plannerFields);
export const researchRows=s=>parseTable(s,'Stock Research',researchFields);
export function validTicker(t){const s=safe(t).toUpperCase();return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)?s:null}
export const holdingsRows=s=>parseTable(s,'Holdings',holdingFields).map(r=>({...r,ticker:validTicker(r.ticker)||''})).filter(r=>r.ticker);
export function positiveNumber(n){const s=safe(n).replace(/[$, ]/g,'');if(!s||!/^\d+(\.\d+)?$/.test(s))return null;const val=Number(s);return Number.isFinite(val)&&val>=0?val:null}
export function portfolio(s){const rows=holdingsRows(s),valued=rows.map(r=>{const q=positiveNumber(r.shares),p=positiveNumber(r.price),avg=positiveNumber(r.cost);return {...r,quantity:q,priceNumber:p,avgNumber:avg,value:q!==null&&p!==null?q*p:null}});return {rows:valued,total:valued.length&&valued.every(r=>r.value!==null)?valued.reduce((sum,r)=>sum+r.value,0):null,priced:valued.filter(r=>r.value!==null).length};}
const isoDate=v=>{const s=safe(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().startsWith(s)?s:'';}const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?isoDate(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`):'';};
export {isoDate};
export function todayLA(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
export function dueSoon(items,field='due',today=todayLA(),n=14){const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+n);const limit=end.toISOString().slice(0,10);return items.filter(r=>isoDate(r[field])>=today&&isoDate(r[field])<=limit&&!/^(done|completed|submitted|cancelled)$/i.test(r.status)).sort((a,b)=>isoDate(a[field]).localeCompare(isoDate(b[field])))}
export const usd=n=>Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}):'—';
const allowedLink=url=>/^https:\/\/[^\s<>"']+$/i.test(safe(url))?safe(url):'';
const anchor=(url,label)=>{const u=allowedLink(url);return u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:''};
const empty=(title,note)=>`<div class="pd-empty"><strong>${esc(title)}</strong><p>${esc(note)}</p></div>`;
const pill=status=>`<span class="pd-pill">${esc(status||'Not set')}</span>`;
const tile=(label,val,note)=>`<div class="pd-mini"><span>${esc(label)}</span><strong>${esc(val)}</strong><small>${esc(note)}</small></div>`;
const table=(heads,rows)=>`<div class="pd-table-wrap"><table class="pd-table"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const labelDate=v=>isoDate(v)?new Date(isoDate(v)+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'Date not set';
const notes=v=>v?`<p class="pd-notes">${esc(v)}</p>`:'';

const CANDIDATES=[
 {ticker:'MSFT',company:'Microsoft',lens:'Recurring enterprise software and cloud demand',risk:'Premium valuation and cloud-capex execution'},
 {ticker:'UNH',company:'UnitedHealth Group',lens:'Healthcare services and insurance economics',risk:'Medical-cost pressure and policy uncertainty'},
 {ticker:'TXN',company:'Texas Instruments',lens:'Industrial semiconductor cycles and cash returns',risk:'Cyclical demand and capital intensity'},
 {ticker:'COST',company:'Costco Wholesale',lens:'Membership economics and consumer resilience',risk:'High valuation and margin sensitivity'},
 {ticker:'DE',company:'Deere & Company',lens:'Equipment cycle and precision agriculture',risk:'Farm income and machinery demand'},
 {ticker:'BKNG',company:'Booking Holdings',lens:'Travel demand and platform cash generation',risk:'Travel cyclicality and regulation'},
 {ticker:'NEE',company:'NextEra Energy',lens:'Utility investment and power-demand growth',risk:'Interest-rate sensitivity and execution'},
 {ticker:'INTU',company:'Intuit',lens:'Small-business financial software retention',risk:'Competition and valuation'},
 {ticker:'SPGI',company:'S&P Global',lens:'Market data and indices business models',risk:'Capital-market issuance cyclicality'},
 {ticker:'ADP',company:'Automatic Data Processing',lens:'Recurring payroll processing demand',risk:'Labor market softness and competition'}
];
export function researchCandidate(day=todayLA()){const idx=Math.abs([...day].reduce((x,c)=>x*31+c.charCodeAt(0),0))%CANDIDATES.length;return {...CANDIDATES[idx],date:day,method:'Rotating educational candidate. Not based on live prices, news, suitability or recent financial results.'};}
export function newsUrl(ticker){const s=validTicker(ticker);return s?'https://www.google.com/search?'+new URLSearchParams({q:`${s} stock company earnings news`,tbm:'nws',tbs:'qdr:d'}):''}
export function quoteUrl(ticker){const s=validTicker(ticker);return s?'https://finance.yahoo.com/quote/'+encodeURIComponent(s)+'/news/':''}
export function renderPersonal(key,sheets,{source='none'}={}){

 const classList=schoolRows(sheets),planner=plannerRows(sheets),p=portfolio(sheets),day=todayLA(),c=researchCandidate(day),curated=researchRows(sheets).find(r=>isoDate(r.date)===day&&validTicker(r.ticker));
 const sourceNote=source==='demo'?'All sample records are fictional. Nothing here is live.':'Records are saved on this dashboard and included in workbook exports.';
 if(key==='career'){
 const app=(sheets['Application Tracker']||[]).slice(4).filter(r=>r[2]);const contacts=(sheets['Networking Tracker']||[]).slice(4).filter(r=>r[2]);
 return `<div class="pd-hero"><div><span class="pd-kicker">CAREER SYSTEM</span><h2>Turn preparation into progress.</h2><p>Keep every opportunity, relationship and interview practice session in one pipeline.</p></div><div class="pd-orb" aria-hidden="true">↗</div></div><div class="pd-mini-grid">${tile('Applications',app.length,'Saved applications')}${tile('Contacts',contacts.length,'Recorded relationships')}${tile('Next step','Review','Use application deadlines')}</div><p class="pd-note">${esc(sourceNote)}</p>`;
 }
 if(key==='school'){
 const soon=dueSoon(classList),scheduled=classList.filter(r=>isoDate(r.due));
 return `<div class="pd-hero"><div><span class="pd-kicker">02 / ACADEMIC SYSTEM</span><h2>Assignments. Without surprises.</h2><p>Coursework is loaded from the <b>Coursework</b> tab of your private workbook.</p></div><div class="pd-orb" aria-hidden="true">▤</div></div><div class="pd-mini-grid">${tile('Assignments',classList.length,'Across imported courses')}${tile('Next 14 days',soon.length,'Pending deadlines')}${tile('Dated records',scheduled.length,'Entries with a due date')}</div><section class="pd-panel"><div class="pd-panel-head"><div><span class="pd-kicker">UPCOMING</span><h3>Coursework queue</h3></div><span class="pd-small">Pacific Time</span></div>${classList.length?table(['Course','Assignment','Due','Status','Reference'],classList.slice().sort((a,b)=>(isoDate(a.due)||'9999').localeCompare(isoDate(b.due)||'9999')).map(r=>`<tr><td><b>${esc(r.course||'—')}</b></td><td>${esc(r.assignment)}${notes(r.notes)}</td><td>${esc(labelDate(r.due))}</td><td>${pill(r.status)}</td><td>${anchor(r.link,'Open')}</td></tr>`)):empty('No coursework imported','Download the blank Brian\'s Dash workbook from Setup and fill the Coursework tab.')}</section><p class="pd-note">${esc(sourceNote)} Google Calendar is not read by this static Site.</p>`;
 }
 if(key==='investments'){
 const headline=curated?`<strong>${esc(validTicker(curated.ticker))} · human-entered research</strong><p>${esc(curated.thesis||'Review business quality, valuation and risk.')}</p>${notes(curated.risks?`Risks: ${curated.risks}`:'')}${anchor(curated.source,'Read source')}`:`<strong>${esc(c.ticker)} · ${esc(c.company)}</strong><p>Research angle: ${esc(c.lens)}.</p><p>What to challenge: ${esc(c.risk)}.</p><small>${esc(c.method)}</small>`;
 const allTickers=p.rows.map(r=>r.ticker);
 return `<div class="pd-hero"><div><span class="pd-kicker">03 / MARKET DESK</span><h2>Clarity, not market noise.</h2><p>Your privately imported holdings, current-news search links and a transparent daily research candidate.</p></div><div class="pd-orb" aria-hidden="true">◈</div></div><div class="pd-mini-grid">${tile('Holdings',p.rows.length,'Imported tickers')}${tile('Valuation',p.total!==null?usd(p.total):'—',p.total!==null?'From imported prices, not live':'Requires shares + price for all')}${tile('Prices available',`${p.priced} / ${p.rows.length}`,'Not live market quotes')}</div><div class="pd-two"><section class="pd-panel"><div class="pd-panel-head"><div><span class="pd-kicker">TODAY · ${esc(day)}</span><h3>Stock research spotlight</h3></div><span class="pd-status">Research only</span></div><div class="pd-spotlight">${headline}<div class="pd-inline-links">${anchor(newsUrl(curated?curated.ticker:c.ticker),'Find today\'s news')}${anchor(quoteUrl(curated?curated.ticker:c.ticker),'Recent articles')}</div></div><p class="pd-note">This is <b>not</b> a buy recommendation or an automatically researched daily pick. A new, sourced investment idea each day needs a verified research workflow.</p></section><section class="pd-panel"><div class="pd-panel-head"><div><span class="pd-kicker">NEWS DESK</span><h3>Today's market coverage</h3></div></div>${allTickers.length?`<div class="pd-newslist">${allTickers.map(t=>`<div><b>${esc(t)}</b><span>${anchor(newsUrl(t),'Today’s headlines')} ${anchor(quoteUrl(t),'Yahoo Finance')}</span></div>`).join('')}</div>`:empty('Connect your portfolio view','Import a Holdings tab or use the “Import holdings CSV” button. Stock news links will appear per ticker.')}<p class="pd-note">News links open a current external search when clicked; this browser-only dashboard does not fetch, verify or store live headlines.</p></section></div><section class="pd-panel"><div class="pd-panel-head"><div><span class="pd-kicker">PORTFOLIO / IMPORTED VALUES</span><h3>My holdings</h3></div><button class="button subtle" id="holdingsImportBtn">Import holdings CSV</button></div>${p.rows.length?table(['Ticker','Company','Shares','Avg cost','Last imported price','Computed value','News'],p.rows.map(r=>`<tr><td><b>${esc(r.ticker)}</b></td><td>${esc(r.company||'—')}</td><td>${esc(r.shares||'—')}</td><td>${r.avgNumber===null?'—':usd(r.avgNumber)}</td><td>${r.priceNumber===null?'—':usd(r.priceNumber)}${r.asof?`<small class="pd-price-date">${esc(r.asof)}</small>`:''}</td><td>${r.value===null?'—':usd(r.value)}</td><td>${anchor(newsUrl(r.ticker),'News')}</td></tr>`)):empty('No holdings imported','You can use Robinhood holdings exports or the downloadable blank workbook. CSV imports are read locally and never uploaded by this site.')}<div class="pd-note">Shares × imported last price is shown only where supplied. Portfolio total is intentionally blank if any position has no usable price. No trading, transaction history ingestion or brokerage sync occurs.</div></section><p class="pd-note">${esc(sourceNote)}</p>`;
 }
 if(key==='planner'){
 const due=dueSoon(classList),next=planner.filter(r=>isoDate(r.date)>=day).sort((a,b)=>(isoDate(a.date)||'9999').localeCompare(isoDate(b.date)||'9999'));
 return `<div class="pd-hero"><div><span class="pd-kicker">04 / DAILY OPERATIONS</span><h2>Own the next 24 hours.</h2><p>See your agenda and tasks in Pacific Time.</p></div><div class="pd-orb" aria-hidden="true">◷</div></div><div class="pd-mini-grid">${tile('Tasks',planner.length,'Saved tasks')}${tile('Coming up',next.length,'Future dated tasks')}</div><div class="pd-two"><section class="pd-panel"><div class="pd-panel-head"><div><span class="pd-kicker">SCHEDULE</span><h3>Tasks and events</h3></div></div>${next.length?`<div class="pd-timeline">${next.slice(0,18).map(r=>`<div><span>${esc(labelDate(r.date))}<small>${esc(r.time)}</small></span><section><b>${esc(r.task||'Task')}</b>${pill(r.status)}${notes(r.notes)}${anchor(r.link,'Details')}<button class="quiet" data-planner-edit="${r.__row-1}">Edit task</button></section></div>`).join('')}</div>`:empty('Your planner is empty','Tasks added by the owner appear here.')}</section></div><p class="pd-note">${esc(sourceNote)} Calendar account syncing is not configured.</p>`;
 }
 return '';
}
export function personalSnapshot(sheets){const c=schoolRows(sheets),p=plannerRows(sheets),h=holdingsRows(sheets);return {assignments:dueSoon(c).length,tasks:p.filter(r=>isoDate(r.date)===todayLA()&&!/^(done|completed|cancelled)$/i.test(r.status)).length,holdings:h.length,coursework:c.length};}
export const extraTabs={
 'Coursework':[['Course','Assignment','Due Date','Status','Link','Notes']],
 'Daily Planner':[['Date','Time','Task','Category','Status','Link','Notes']],
 'Holdings':[['Ticker','Company','Shares','Average Cost','Last Price','Price As Of','Notes']],
 'Stock Research':[['Date','Ticker','Thesis','Risks','Source URL']]
};
// A separate parser for brokerage position CSVs. Transaction/activity exports are not position snapshots.
export function importedHoldingsFromRows(rows){if(!Array.isArray(rows)||!rows.length)throw Error('No rows were found in the file.');const i=rows.findIndex(r=>r.some(c=>['ticker','symbol'].includes(normalize(c))));if(i<0)throw Error('No Ticker/Symbol column found. Export positions or use the Holdings workbook template.');const data={'Holdings':[extraTabs.Holdings[0]]};const columns=headersMap(rows.slice(i,i+1));const idx=a=>findHeader(columns,a);const at=(row,aliases)=>{const j=idx(aliases);return j<0?'':safe(row[j])};let accepted=0;
 for(const row of rows.slice(i+1)){const ticker=validTicker(at(row,['ticker','symbol']));const qty=at(row,['shares','quantity','qty','number of shares']);if(!ticker||positiveNumber(qty)===null)continue;data.Holdings.push([ticker,at(row,['company','name','description']),qty,at(row,['average cost','avg cost','average price','cost basis per share']),at(row,['last price','market price','current price','price']),at(row,['price as of','as of','date']),'Imported locally; verify values and dates']);accepted++;}
 if(!accepted)throw Error('No valid positions with Ticker/Symbol and Shares/Quantity were found. An account-activity CSV is not a current holdings snapshot.');return data.Holdings;
}
