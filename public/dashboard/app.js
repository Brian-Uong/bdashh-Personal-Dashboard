import {mountSeamlessSidebar} from './seamless-sidebar.mjs';
import {mountEventSearch} from './event-search.mjs';
import {localEventMatches} from './local-regions.mjs';
import {mountNews} from './news.mjs';
import {apiFetch} from './api-client.mjs';
import {canRefreshInBackground,sameSnapshot} from './background-refresh.mjs';
import {canEdit,requireOwner} from './dashboard-access.mjs';
import {createEditor} from './record-editor.mjs';
import {acceptData,refreshQuotes,isRefreshing,pull as syncPull,save as syncSave,getData as syncData,finance as syncFinance} from './synced.mjs';
import {mountPortfolioHistory} from './portfolio-history.mjs';
import {setupHoldingForm} from './holding-form.mjs';
import {sheetExportUrl} from './source-config.mjs';
import {personalSections,renderPersonal,personalSnapshot,schoolRows,plannerRows,portfolio,extraTabs,importedHoldingsFromRows,todayLA,dueSoon,isoDate,researchCandidate,holdingsRows,newsUrl} from './personal.mjs';
import {getTemplate} from './demo-data.mjs';
import {OpportunityMap} from './opportunity-map.mjs';
import {avatar as contactAvatar} from './contact-avatars.mjs';
import {contact,sortContacts,cards as contactCards,detail as contactDetail} from './networking.mjs';
import {eventIntelligenceMarkup} from './event-intelligence.mjs';
import {categoryDefinitions,categoryBadges,eventCategories} from './categories.mjs';
import {renderIllustration} from './illustrations.mjs';
import {sections,text,parseDate,records,filterEvents,monthMetrics,groupCount} from './core.mjs';
const $=id=>document.getElementById(id),esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workbook=null,sheets={},active='overview',filename='',liveMode=false,liveBusy=false,lastLiveCheck=0,drafts=0,calendar=false,calendarOffset=0,selectedRecord=null;
const navigationSections=['overview','investments','news','career','planner','Networking Tracker','Potential Events'].map(key=>key==='news'?{key:'news',name:'News',icon:'▤',title:'Your news desk',sub:'The stories you care about, ready each morning.'}:[...sections,...personalSections].find(section=>section.key===key));
const navigationKey=key=>key==='Application Tracker'?'career':key;
const geo=new OpportunityMap($('mapView'),{openContact:row=>{setSection('Networking Tracker');openRecord(row)},openEvent:row=>{setSection('Potential Events');openRecord(row)}});
let sheetUrl='',sourceGeneration=0;
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pacific=()=>todayLA();
let now=pacific();$('month').innerHTML=months.map((m,i)=>`<option value="${i}" ${i===Number(now.slice(5,7))-1?'selected':''}>${m}</option>`).join('');
const nav=()=>{
 const root=$('nav');
 // Retain the actual buttons so selection changes preserve keyboard focus.
 if(!root.childElementCount)root.innerHTML=navigationSections.map(s=>`<button type="button" class="nav-item" data-section="${esc(s.key)}"><span class="nav-icon" aria-hidden="true">${s.icon}</span>${s.name}</button>`).join('');
 for(const item of root.querySelectorAll('.nav-item')){
  const selected=item.dataset.section===navigationKey(active);
  item.classList.toggle('active',selected);
  if(selected)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
 }
};
mountSeamlessSidebar(document.querySelector('.sidebar'),$('nav'));
function tick(){const day=pacific();if(day!==now){now=day;if(backgroundViewReady()&&(active==='overview'||active==='planner'))refreshActiveData();}$('clock').textContent=new Date().toLocaleTimeString('en-GB',{timeZone:'America/Los_Angeles'})+' PT';$('date').textContent=new Date().toLocaleDateString('en-GB',{timeZone:'America/Los_Angeles',day:'2-digit',month:'short',year:'numeric'}).toUpperCase()}tick();setInterval(tick,1000);
function feedback(message,error=false){$('feedback').className=error?'error':'success';$('feedback').textContent=message}
function link(v){const s=text(v);if(/^https?:\/\/[^\s]+$/i.test(s))return `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.length>70?s.slice(0,67)+'…':s)} ↗</a>`;return esc(s)||'—'}
function empty(title,desc='Load your workbook to see your actual records and progress.'){return `<div class="empty"><strong>${title}</strong><p>${desc}</p></div>`}
function metrics(){
 const snap=personalSnapshot(sheets),apps=records(sheets,'Application Tracker').length;
 const items=[['APPLICATIONS',apps,'Career pipeline entries'],['CONTACTS',records(sheets,'Networking Tracker').length,'Networking connections'],['TODAY’S TASKS',snap.tasks,'Daily Planner rows'],['STOCK HOLDINGS',snap.holdings,'From your imported positions']];
 $('metrics').innerHTML=items.map(([label,value,note])=>`<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${workbook?value:'—'}</div><small>${workbook?note:'No data imported'}</small></div>`).join('');
}
function renderModels(){
 const positions=[[28,23],[72,23],[82,68],[50,88],[18,68]],snap=personalSnapshot(sheets);
 const modules=[
 {key:'investments',name:'INVESTMENTS',count:snap.holdings},
 {key:'career',name:'CAREER HUB',count:records(sheets,'Application Tracker').length},
 {key:'planner',name:'PLANNER',count:plannerRows(sheets).length},
 {key:'Networking Tracker',name:'NETWORK',count:records(sheets,'Networking Tracker').length},
 {key:'Potential Events',name:'EVENTS',count:records(sheets,'Potential Events').length}
 ];
 $('models').innerHTML=modules.map((m,i)=>`<button class="model" style="left:${positions[i][0]}%;top:${positions[i][1]}%" data-section="${esc(m.key)}" aria-label="Open ${esc(m.name)}"><span class="cube" aria-hidden="true"></span><strong>${esc(m.name)}</strong><small>${workbook?m.count+' RECORDS':'NO DATA'}</small></button>`).join('');
}
function readiness(){
 const m=monthMetrics(sheets,Number($('month').value)),items=[['Applications',m.applications],['New contacts',m.contacts],['Follow-ups sent',m.followups]];
 if(!workbook){$('readiness').innerHTML=empty('Your career pulse starts here.','Import your own career tracker; counts will reflect recorded activity.');return;}
 const max=Math.max(1,...items.map(i=>i[1]));
 $('readiness').innerHTML='<div class="readiness-list">'+items.map(([label,value])=>`<div class="readiness-row"><div><span>${esc(label)}</span><b>${value}</b></div><div class="track"><div class="fill" style="width:${Math.round(value/max*100)}%"></div></div></div>`).join('')+'</div>';
}
function momentum(){if(!workbook){$('momentum').innerHTML=empty('Your activity signal will appear here.','Load demo data or your own workbook.');return}const values=months.map((_,i)=>{const m=monthMetrics(sheets,i);return m.contacts+m.applications});const max=Math.max(1,...values);const bars=values.map((v,i)=>{const x=40+i*39,y=142-(v/max*112);return `<rect x="${x}" y="${y}" width="16" height="${142-y}" fill="${i===Number($('month').value)?'#63e1d1':'#5763b3'}"><title>${months[i]}: ${v} logged contacts and applications</title></rect><text x="${x+8}" y="${y-8}" text-anchor="middle">${v||''}</text><text x="${x+8}" y="164" text-anchor="middle">${months[i]}</text>`}).join('');$('momentum').innerHTML=`<svg viewBox="0 0 530 190" role="img" aria-label="Monthly count of contacts and applications. All years in workbook combined."><line x1="30" y1="142" x2="520" y2="142" stroke="#29445c"/><text x="8" y="35">${max}</text><text x="10" y="145">0</text>${bars}<text x="270" y="187" text-anchor="middle">CONTACTS + APPLICATIONS · ALL YEARS</text></svg>`}
function actions(){
 const today=todayLA(),classes=dueSoon(schoolRows(sheets)),tasks=plannerRows(sheets).filter(r=>isoDate(r.date)===today&&!/^(done|completed|cancelled)$/i.test(r.status));
 const upcoming=records(sheets,'Potential Events').filter(r=>parseDate(r.cells[1])>=today).sort((a,b)=>text(a.cells[1]).localeCompare(text(b.cells[1])));
 const next=classes[0];
 const items=[
 ['01',`${tasks.length} planner task${tasks.length===1?'':'s'} today`,tasks.length?'Open your Daily Planner to review your tasks.':'No active tasks imported for today.','planner'],
 ['02',upcoming[0]?`Event: ${text(upcoming[0].cells[0])}`:'Explore local events',upcoming[0]?`${text(upcoming[0].cells[1])} · location may need verification`:'Browse local events and explore their locations on the map.','Potential Events']
 ];
 $('actions').innerHTML=items.map(([i,title,desc,key])=>`<div class="action"><span>${i}</span><div><strong>${esc(title)}</strong><p>${esc(desc)}</p><button class="quiet" data-section="${esc(key)}">Open ${esc(key==='Potential Events'?'local events':key)} ↗</button></div></div>`).join('')
}
function dailyBrief(){
 if(syncData()){ $('dailySnapshot').innerHTML=syncFinance(true);return;}

 const c=researchCandidate(),h=holdingsRows(sheets),due=dueSoon(schoolRows(sheets))[0];
 const current=h.slice(0,6).map(r=>`<a target="_blank" rel="noopener noreferrer" href="${esc(newsUrl(r.ticker))}" title="Open today's headline search for ${esc(r.ticker)}">${esc(r.ticker)} ↗</a>`).join('');
 $('dailySnapshot').innerHTML=`<article class="pd-overview-card"><span class="pd-kicker">DAILY MARKET PULSE / ${esc(todayLA())}</span><div><h3>${esc(c.ticker)} · Research candidate</h3><span class="pd-overview-flag">NOT A BUY SIGNAL</span></div><p>${esc(c.lens)}. Risk: ${esc(c.risk)}.</p><div class="pd-overview-links">${current||'<small>Import positions to open today’s news for your holdings.</small>'}<button class="quiet" data-section="investments">Investment desk ↗</button></div></article>`;
}
function overview(){metrics();dailyBrief();renderModels();readiness();momentum();actions()}
function setSection(key){
 if(['fc-trading','sports-betting'].includes(key))key='overview';
 // Keep saved links useful after consolidating maps into Local events.
 if(key==='opportunity-map')key='Potential Events';
 if(key==='career/applications')key='Application Tracker';
 const s=navigationSections.find(s=>s.key===navigationKey(key));if(!s)return;
 geo.cancelNope();active=key;renderRecordActions(key);const personal=personalSections.some(x=>x.key===key);
 geo.root.classList.remove('geo-expanded');geo.root.querySelector('#geoFull').textContent='⛶ Expand';geo.root.querySelector('#geoFull').setAttribute('aria-label','Expand map');
 document.body.classList.toggle('event-map-active',key==='Potential Events');geo.root.classList.toggle('geo-events-context',key==='Potential Events');
 $('eventMapWrap').hidden=key!=='Potential Events';
 renderIllustration(key);nav();window.scrollTo(0,0);
 $('pageTitle').innerHTML=esc(s.title)+'<span>.</span>';$('pageSubtitle').textContent=s.sub;$('breadcrumb').textContent=s.name.toUpperCase();document.querySelector('.pageheading .eyebrow').textContent='BRIAN’S DASH / '+s.name.toUpperCase();
 $('newsView').hidden=key!=='news';document.body.classList.toggle('news-active',key==='news');
 $('overview').hidden=key!=='overview';$('personalView').hidden=!personal;$('mapView').hidden=key!=='Potential Events';
 $('sectionView').hidden=personal||key==='overview'||key==='news';
 const inCareer=navigationKey(key)==='career';
 $('careerTabs').hidden=!inCareer;
 $('careerApplicationsHeading').hidden=key!=='Application Tracker';
 for(const tab of $('careerTabs').querySelectorAll('[role="tab"]')){
  const selected=tab.dataset.section===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
 }
 for(const [id,view,label] of [['personalView','career','careerDiscoveryTab'],['sectionView','Application Tracker','careerApplicationsTab']]){
  if(key===view){$(id).setAttribute('role','tabpanel');$(id).setAttribute('aria-labelledby',label);}
  else {$(id).removeAttribute('role');$(id).removeAttribute('aria-labelledby');}
 }
 resetFilters(false);
 if(key==='overview')overview();
 else if(key==='news')mountNews();
 else if(personal){$('personalView').innerHTML=key==='investments'&&syncData()?syncFinance():renderPersonal(key,sheets,{source:filename==='FICTIONAL DEMO DATA'?'demo':'local'});}
 else setupSection();
 history.replaceState(null,'',key==='Application Tracker'?'#career/applications':'#'+encodeURIComponent(key));
 document.dispatchEvent(new CustomEvent('dashboard:sectionchange',{detail:{section:key}}));
 mountPortfolioHistory(key==='investments');
}
window.addEventListener('hashchange',()=>setSection(decodeURIComponent(location.hash.slice(1))));
document.addEventListener('career:leadtypechange',event=>{if(active==='career')renderIllustration(event.detail.tab==='recruiters'?'career/recruiters':'career');});
$('careerTabs').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const tabs=[...$('careerTabs').querySelectorAll('[role="tab"]')],index=tabs.indexOf(event.target);if(index<0)return;
 event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 tabs[next].click();tabs[next].focus();
});
function setupSection(preserveFilters=false){if(active==='news')return;const selectedStatus=preserveFilters?$('statusFilter').value:'';const s=sections.find(s=>s.key===active);$('eventsFilters').hidden=active!=='Potential Events';$('eventSearchPanel').hidden=active!=='Potential Events';$('networkControls').hidden=active!=='Networking Tracker';$('search').placeholder=`Search ${s.name.toLowerCase()}…`;$('statusFilter').hidden=!['Potential Events','Application Tracker','Networking Tracker'].includes(active);const col=active==='Potential Events'?10:active==='Application Tracker'?8:5;const options=[...new Set([...records(sheets,active).map(r=>text(r.cells[col])).filter(Boolean),...(selectedStatus?[selectedStatus]:[])])];$('statusFilter').innerHTML='<option value="">All records</option>'+options.map(v=>`<option>${esc(v)}</option>`).join('');$('statusFilter').value=selectedStatus;renderSection()}
function resetFilters(render=true){['search','statusFilter','freeFilter','beginnerFilter','companyFilter','categoryFilter','fromDate','untilDate','networkPriority','networkSource','networkDraft','eventRegion'].forEach(id=>$(id).value='');$('eventUpcoming').checked=true;if(render)renderSection()}
function filtered(){let rows=records(sheets,active);const q=$('search').value.toLowerCase();if(active==='Potential Events')return filterEvents(rows.filter(r=>localEventMatches(r.cells,{region:$('eventRegion').value,upcoming:$('eventUpcoming').checked})),{q,category:$('categoryFilter').value,free:$('freeFilter').value,beginner:$('beginnerFilter').value,company:$('companyFilter').value,status:$('statusFilter').value,from:$('fromDate').value,until:$('untilDate').value});return rows.filter(r=>(!q||r.cells.some(v=>text(v).toLowerCase().includes(q)))&&(!$('statusFilter').value||text(r.cells[active==='Application Tracker'?8:5])===$('statusFilter').value))}
function renderBars(rows,col){const g=groupCount(rows,col),max=Math.max(1,...g.map(x=>x[1]));return '<div class="section-chart">'+g.map(([l,n])=>`<div class="bar-item"><span>${esc(l)}</span><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div><b>${n}</b></div>`).join('')+'</div>'}
function renderSection(){if(active==='news')return;if(active==='Potential Events')syncEventMap();const s=sections.find(s=>s.key===active);$('sectionSummary').innerHTML='';if(!workbook){$('sectionContent').innerHTML=empty('Awaiting your workbook','Load an Excel export of your spreadsheet to explore this section.');$('recordCount').textContent='NO DATA';return}if(!sheets[active]){$('sectionContent').innerHTML=empty('Tab not found',`The imported file does not contain “${s.name}”. Use the original workbook export.`);return}if(s.raw){let rows=(sheets[active]||[]).map((cells,row)=>({cells,row})).filter(r=>r.cells.some(v=>text(v)));const q=$('search').value.toLowerCase();if(q)rows=rows.filter(r=>r.cells.some(v=>text(v).toLowerCase().includes(q)));$('recordCount').textContent=`${rows.length} ROWS`;$('sectionContent').innerHTML='<p class="data-note">Original workbook view. Formula values reflect the spreadsheet’s last saved calculations. This section is read-only.</p>'+table(rows,null,true);return}const rows=filtered();$('recordCount').textContent=`${rows.length} RECORDS`;if(active==='Potential Events'){if(calendar){renderCalendar(rows);return}$('sectionContent').innerHTML=rows.length?'<div class="record-grid">'+rows.map(eventCard).join('')+'</div>':empty('No matching events','Try clearing your filters. Events added by the owner appear here.');return}if(active==='Networking Tracker'){let contacts=sortContacts(rows.map(r=>contact(r,sheets[active][3]||[]))).filter(c=>(!$('networkPriority').value||c.priority===$('networkPriority').value)&&(!$('networkSource').value||c.source===$('networkSource').value)&&(!$('networkDraft').value||($('networkDraft').value==='ready'?!!c.follow:!c.follow)));$('recordCount').textContent=`${contacts.length} CONTACTS`;$('sectionSummary').innerHTML=`<div class="network-summary"><span><b>${contacts.filter(c=>c.priority==='High').length}</b> High priority</span><span><b>${contacts.filter(c=>c.first).length}</b> First messages ready</span><span><b>${contacts.filter(c=>c.follow).length}</b> Follow-up drafts ready</span></div><p class="data-note">Highest priority first · Agent prospects and your contacts are labelled · Import a fresh export to load the latest drafts.</p>`;$('sectionContent').innerHTML=contacts.length?contactCards(contacts):empty('No matching contacts','Change your filters or load a fresh workbook export.');return}if(['Application Tracker','Networking Tracker','Interview Practice Tracker'].includes(active))$('sectionSummary').innerHTML=renderBars(rows,active==='Application Tracker'?8:active==='Networking Tracker'?5:1);$('sectionContent').innerHTML=rows.length?table(rows,s):empty('No records to display','This section has no matching entries. Empty trackers are shown without estimated results.')}
function table(rows,s,raw=false){const headers=s?(sheets[active][s.head]||[]):Array.from({length:Math.max(1,...rows.map(r=>r.cells.length))},(_,i)=>String.fromCharCode(65+i));const width=s?headers.length:headers.length;return '<div class="table-wrap"><table><thead><tr>'+headers.map((h,i)=>`<th>${esc(h)||`Column ${i+1}`}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>`<tr ${raw?'':`data-row="${r.row}" tabindex="0" role="button" aria-label="Open record ${esc(r.cells[s.label])}"`}>${Array.from({length:width},(_,i)=>`<td>${link(r.cells[i])}</td>`).join('')}</tr>`).join('')+'</tbody></table></div>'}
function syncEventMap(){const rows=filtered();geo.allowedEventRows=new Set(rows.map(r=>r.row));geo.filter='event';geo.upcoming=false;geo.root.querySelector('#geoUpcoming').checked=false;geo.root.querySelector('#geoTitle').textContent='Event field map';geo.update(sheets);const current=geo.locations.find(x=>x.id===geo.selected);if(!current||current.type!=='event'||!geo.allowedEventRows.has(current.row)){const first=geo.visible()[0];geo.selected=first?.id||null;geo.renderList();geo.renderDossier();geo.renderMarkers();geo.drawRoute();}geo.start();}
function eventDistance(r){const location=geo.locations.find(x=>x.type==='event'&&x.row===r.row);return '<div class="event-commute">⌂ From origin · '+esc(geo.distanceLabel(location))+'</div>';}
function eventCard(r){const c=r.cells,location=geo.locations.find(x=>x.type==='event'&&x.row===r.row);return `<article class="event-operation ${geo.isSkipped(location)?'event-operation-skipped':''}"><button class="event-card" data-row="${r.row}"><div class="event-date">${esc(c[1])||'DATE UNCONFIRMED'} / ${esc(c[2])||'TIME UNCONFIRMED'}</div><h3>${esc(c[0])}</h3>${geo.isSkipped(location)?'<span class="badge nope-skip-badge">SKIPPED · BROWSER ONLY</span>':''}${categoryBadges(c)}<div class="badges">${text(c[7])==='Yes'?'<span class="badge gold-badge">FREE</span>':''}${text(c[26])==='Yes'?'<span class="badge">BEGINNER FRIENDLY</span>':''}${text(c[21])==='Yes'?'<span class="badge gold-badge">TARGET COMPANY</span>':''}</div><p>${esc(c[3])}<br>${esc(c[4])}</p>${eventDistance(r)}${eventIntelligenceMarkup(c,sheets['Potential Events']?.[3])}<div class="badges"><span class="badge">${esc(c[10])||'Not recorded'}</span>${text(c[22])?`<span class="badge">${esc(c[22])}</span>`:''}</div></button>${newsUrl(c[6])?`<a class="event-source-link" href="${esc(newsUrl(c[6]))}" target="_blank" rel="noopener noreferrer">Organizer & registration ↗</a>`:''}${geo.nopeControls(location)}</article>`}
function renderCalendar(rows){const base=new Date(now+'T12:00:00Z');base.setUTCMonth(base.getUTCMonth()+calendarOffset,1);const y=base.getUTCFullYear(),m=base.getUTCMonth(),start=base.getUTCDay(),days=new Date(Date.UTC(y,m+1,0)).getUTCDate();const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;const mapped=new Map();rows.forEach(r=>{const d=parseDate(r.cells[1]);if(d){if(!mapped.has(d))mapped.set(d,[]);mapped.get(d).push(r)}});let html=`<div class="calendar-title"><button class="quiet" id="prevMonth" aria-label="Previous month">←</button><h2>${months[m]} ${y}</h2><button class="quiet" id="nextMonth" aria-label="Next month">→</button></div><div class="calendar">`+['SUN','MON','TUE','WED','THU','FRI','SAT'].map(s=>`<div class="cal-head">${s}</div>`).join('');for(let i=0;i<start;i++)html+='<div class="cal-day"></div>';for(let d=1;d<=days;d++){const key=prefix+String(d).padStart(2,'0');html+=`<div class="cal-day"><span>${d}</span>${(mapped.get(key)||[]).map(r=>`<button data-row="${r.row}">${esc(r.cells[0])}<span class="cal-category-icons" aria-label="Categories">${eventCategories(r.cells).map(c=>`<svg viewBox="0 0 24 24" role="img" aria-label="${c.label}">${c.icon}</svg>`).join('')}</span></button>`).join('')}</div>`}html+='</div>';const unknown=rows.filter(r=>!parseDate(r.cells[1])).length;if(unknown)html+=`<p class="data-note">${unknown} events have an unconfirmed date and are available in card view.</p>`;$('sectionContent').innerHTML=html}
function viewRecord(row){
 const schema=sections.find(section=>section.key===active),cells=sheets[active]?.[row];
 if(!schema||!cells)return;
 selectedRecord={key:active,row};
 const headers=sheets[active][schema.head]||[];
 $('detailContent').innerHTML=active==='Networking Tracker'?contactDetail(contact({row,cells},headers)):`<h2>${esc(cells[schema.label]||'Record details')}</h2>${active==='Potential Events'?categoryBadges(cells)+eventIntelligenceMarkup(cells,headers):''}<dl>${headers.map((h,i)=>text(h)?`<dt>${esc(h)}</dt><dd>${link(cells[i])}</dd>`:'').join('')}</dl>`;
 $('detail').showModal();
}
function renderRecordActions(key){
 const labels={planner:['Your planner','＋ Add task','Edit tasks'],'Application Tracker':['Your applications','＋ Add application','Edit applications'],'Networking Tracker':['Your contacts','＋ Add contact','Edit contacts'],'Potential Events':['Your events','＋ Add event','Edit events']}[key];
 $('sectionActions').hidden=!canEdit||!labels;
 if(labels){$('sectionActionsTitle').textContent=labels[0];$('addRecordBtn').textContent=labels[1];$('manageRecordsBtn').textContent=labels[2];}
}
function openRecord(row){if(!canEdit){viewRecord(row);return;}if(canEdit&&['Networking Tracker','Application Tracker','Potential Events'].includes(active)){dashboardEditor.open(active,row).catch(e=>feedback(e.message,true));return;}const s=sections.find(s=>s.key===active),cells=sheets[active]?.[row];if(!cells||s.raw)return;selectedRecord={key:active,row};if(active==='Networking Tracker'){$('detailContent').innerHTML='<button class="button subtle" data-open-map="company" data-map-row="'+row+'">⌖ View company on map</button>'+contactDetail(contact({row,cells},sheets[active][3]||[]));$('detail').showModal();return}const headers=sheets[active][s.head]||[],ws=workbook.Sheets[active];const editable=active==='Potential Events'?[10,11,12,15,16,17,18]:active==='Networking Tracker'?[6,7,8,9,10]:active==='Application Tracker'?[8,9,10,11]:active==='Interview Practice Tracker'?[6,7]:[6,10,13,14,15,16,17];const safe=editable.filter(i=>headers[i]&&!ws[window.XLSX.utils.encode_cell({r:row,c:i})]?.f);$('detailContent').innerHTML=`<h2>${esc(cells[s.label])}</h2>${active==='Potential Events'?`<button class="button subtle" data-open-map="event" data-map-row="${row}">⌖ Fly to event on map</button>`:''}${active==='Potential Events'?categoryBadges(cells)+eventIntelligenceMarkup(cells,headers):''}<dl>${headers.map((h,i)=>text(h)&&!(active==='Potential Events'&&['event summary','how it helps you (suggested)','how it helps you'].includes(text(h).toLowerCase()))?`<dt>${esc(h)}</dt><dd>${link(cells[i])}</dd>`:'').join('')}</dl><div class="draft-note">Edits below change this browser’s workbook draft only. Export the workbook to keep a copy. Google Sheets is not updated.</div><form id="editForm"><div class="edit-fields">${safe.map(i=>`<label>${esc(headers[i])}<textarea name="c${i}" data-column="${i}">${esc(cells[i])}</textarea></label>`).join('')}</div><button class="button gold" type="submit">Save browser draft</button></form>`;$('detail').showModal()}
async function loadFile(file){if(!file||liveBusy)return;if(drafts&&!confirm('Replace the current workbook? Export first if you want to keep your browser drafts.'))return;const ticket=++sourceGeneration,initialDrafts=drafts;try{if(file.size>20*1024*1024)throw Error('Please choose a workbook smaller than 20 MB.');if(!window.XLSX)throw Error('The workbook reader could not load. Check your connection and reload the page.');const bytes=await file.arrayBuffer();if(ticket!==sourceGeneration||drafts!==initialDrafts||$('detail').open){feedback('Import paused because your source or edits changed. Select the file again when ready.',true);return;}const candidate=window.XLSX.read(bytes,{type:'array',cellDates:false,cellFormula:true});const names=[...sections.slice(1).map(s=>s.key),...Object.keys(extraTabs)];if(!names.some(n=>candidate.SheetNames.includes(n)))throw Error('No recognized tabs found. Download the Brian’s Dash workbook template from Data & connections.');const next={};candidate.SheetNames.forEach(n=>{next[n]=window.XLSX.utils.sheet_to_json(candidate.Sheets[n],{header:1,range:0,defval:'',raw:false,blankrows:true})});liveMode=false;sheetUrl='';sourceGeneration++;updateSourceLinks();workbook=candidate;sheets=next;filename=file.name;drafts=1;saveButton.hidden=false;$('exportBtn').disabled=false;$('connectionTitle').textContent='Workbook loaded · manual import, no live sync';$('connectionText').textContent=`${filename} · Loaded ${new Date().toLocaleString('en-GB',{timeZone:'America/Los_Angeles'})} local time. Use Save workbook to dashboard to sync this workbook across devices.`;$('dataLabel').textContent='IMPORTED WORKBOOK';$('footerState').textContent='MANUAL IMPORT · NO LIVE SYNC';feedback(`Loaded ${candidate.SheetNames.length} tabs. No data was uploaded to this website’s server.`);overview();if(personalSections.some(x=>x.key===active)){$('personalView').innerHTML=renderPersonal(active,sheets,{source:'local'});}else if(active!=='overview')setupSection()}catch(e){feedback(e.message||'The workbook could not be read.',true)}finally{$('file').value=''}}
$('loadBtn').onclick=()=>$('file').click();$('file').onchange=e=>loadFile(e.target.files[0]);$('exportBtn').onclick=()=>{if(!workbook)return;rebuildWorkbook();window.XLSX.writeFile(workbook,'Brians-Dash.xlsx');feedback('Exported your dashboard workbook with its current tabs.')};$('month').onchange=()=>{readiness();momentum()};$('resetBtn').onclick=()=>resetFilters();['search','statusFilter','freeFilter','beginnerFilter','companyFilter','categoryFilter','fromDate','untilDate','eventRegion','eventUpcoming'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',renderSection));$('viewToggle').onclick=()=>{calendar=!calendar;$('viewToggle').textContent=calendar?'Card view':'Calendar view';renderSection()};$('closeDetail').onclick=()=>$('detail').close();document.addEventListener('click',e=>{const section=e.target.closest('[data-section]');if(section)setSection(section.dataset.section);const row=e.target.closest('[data-row]');if(row&&!e.target.closest('a')&&!e.target.closest('[data-nope-launch],[data-nope-undo]'))openRecord(Number(row.dataset.row));if(e.target.closest('#prevMonth')){calendarOffset--;renderSection()}if(e.target.closest('#nextMonth')){calendarOffset++;renderSection()}});document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-row]')){e.preventDefault();openRecord(Number(e.target.dataset.row))}});document.addEventListener('submit',e=>{if(e.target.id!=='editForm')return;e.preventDefault();if(!selectedRecord)return;const {key,row}=selectedRecord,ws=workbook.Sheets[key];e.target.querySelectorAll('[data-column]').forEach(input=>{const col=Number(input.dataset.column),address=window.XLSX.utils.encode_cell({r:row,c:col});if(ws[address]?.f)return;const value=input.value.trim();if(value!==text(sheets[key][row][col])){sheets[key][row][col]=value;ws[address]={...(ws[address]||{}),t:'s',v:value};delete ws[address].w;drafts++}});$('detail').close();$('footerState').textContent=`${drafts} DRAFT CHANGES · NO LIVE SYNC`;feedback('Browser draft saved. Export a copy to keep it; Google Sheets is unchanged.');overview();renderSection()});window.addEventListener('beforeunload',e=>{if(drafts){e.preventDefault();e.returnValue=''}});nav();overview();const hash=decodeURIComponent(location.hash.slice(1));if(['opportunity-map','Application Tracker','career/applications'].includes(hash)||navigationSections.some(s=>s.key===hash))setSection(hash);else if(hash){history.replaceState(null,'','#overview');setSection('overview');}



renderIllustration(active);



$("categoryFilter").innerHTML='<option value="">All categories</option>'+categoryDefinitions.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');

['networkPriority','networkSource','networkDraft','eventRegion'].forEach(id=>$(id).addEventListener('change',renderSection));
document.addEventListener('click',async e=>{const button=e.target.closest('[data-copy-message]');if(!button||!selectedRecord)return;const {key,row}=selectedRecord,c=contact({row,cells:sheets[key][row]},sheets[key][3]||[]),value=c[button.dataset.copyMessage];if(!value)return;try{await navigator.clipboard.writeText(value);button.textContent='Copied ✓';setTimeout(()=>button.textContent='Copy message',1800)}catch{button.textContent='Select text to copy';const p=button.closest('.message-block').querySelector('.message-copy'),range=document.createRange();range.selectNodeContents(p);window.getSelection().removeAllRanges();window.getSelection().addRange(range)}});


document.addEventListener('error',e=>{if(e.target.matches?.('.company-avatar img')){e.target.closest('.company-avatar').outerHTML=contactAvatar({company:''},false)}},true);

document.addEventListener('click',e=>{const b=e.target.closest('[data-open-map]');if(!b)return;const row=Number(b.dataset.mapRow);$('detail').close();setSection('Potential Events');$('eventMapWrap').open=true;if(b.dataset.openMap!=='event')geo.allowedEventRows=null;const item=geo.locations.find(x=>b.dataset.openMap==='event'?x.type==='event'&&x.row===row:x.type==='company'&&x.contacts.some(c=>c.row===row));if(item)geo.select(item.id,true)});

document.addEventListener('commute-updated',()=>{if(active==='Potential Events'&&workbook)renderSection()});
$('eventMapWrap').addEventListener('toggle',()=>{if($('eventMapWrap').open)requestAnimationFrame(()=>geo.map?.resize())});

document.addEventListener('click',e=>{const launch=e.target.closest('[data-nope-launch]'),undo=e.target.closest('[data-nope-undo]');if(!launch&&!undo||geo.root.contains(e.target))return;if(undo){geo.markSkipped(undo.dataset.nopeUndo,false);return;}$('detail').close();$('eventMapWrap').open=true;geo.launchNope(launch.dataset.nopeLaunch)});
document.addEventListener('nope-updated',()=>{if(active==='Potential Events'&&workbook)renderSection()});

// Live read-only feed. Browser drafts and open record forms are never overwritten.
async function refreshLive(manual=false){
 if(liveBusy)return;
 if(!sheetUrl){if(manual){feedback('No spreadsheet connected. Choose your own source in Setup.');$('setup').showModal();}return;}
 if(!manual&&!backgroundViewReady())return;
 const ticket=sourceGeneration,requestUrl=sheetUrl;
 if(drafts||$('detail').open||geo.nopeBusy){if(manual)feedback('Refresh paused. Export your drafts and reload the page, or close the open record or animation first.',true);return;}
 if(!manual&&(!liveMode||document.hidden||Date.now()-lastLiveCheck<45000))return;
 liveBusy=true;lastLiveCheck=Date.now();$('refreshBtn').disabled=true;$('loadBtn').disabled=true;
 $('connectionTitle').textContent='Checking Google Sheets…';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(requestUrl+'&cachebust='+Date.now(),{signal:controller.signal,credentials:'omit',cache:'no-store'});
  if(!response.ok)throw Error('Google Sheets returned '+response.status);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>20*1024*1024)throw Error('The tracker exceeds the 20 MB limit.');
  const candidate=window.XLSX.read(bytes,{type:'array',cellDates:false,cellFormula:true});
  if(![...sections.slice(1).map(s=>s.key),...Object.keys(extraTabs)].some(name=>candidate.SheetNames.includes(name)))throw Error('No recognized Brian’s Dash tabs were found.');
  const next={};for(const name of candidate.SheetNames)next[name]=window.XLSX.utils.sheet_to_json(candidate.Sheets[name],{header:1,range:0,defval:'',raw:false,blankrows:true});
  if(ticket!==sourceGeneration||(!manual&&!backgroundViewReady()))return;
  if(sameSnapshot(sheets,next)){$('connectionTitle').textContent='Google Sheets connected';return;}
  if(drafts||$('detail').open||geo.nopeBusy){$('connectionTitle').textContent='Refresh paused while you work';return;}
  workbook=candidate;sheets=next;filename='Live Google Sheets';liveMode=true;
  $('exportBtn').disabled=false;$('dataLabel').textContent='LIVE GOOGLE SHEETS';
  $('connectionTitle').textContent='Google Sheets connected · '+candidate.SheetNames.length+' tabs';
  $('connectionText').textContent='Last refreshed '+new Date().toLocaleString('en-GB',{timeZone:'America/Los_Angeles'})+' local time. Checks every 60 seconds while visible and when you return. Edit Google Sheets to update the source; dashboard edits are browser drafts.';
  $('footerState').textContent='LIVE SHEET FEED · 60 SECOND CHECKS';
  overview();if(personalSections.some(x=>x.key===active)){$('personalView').innerHTML=renderPersonal(active,sheets,{source:'local'});}else if(active!=='overview'){const status=$('statusFilter').value;setupSection();$('statusFilter').value=status;renderSection();}
  if(manual)feedback('Latest Google Sheets data loaded.');
 }catch(error){
  if(ticket!==sourceGeneration)return;
  $('connectionTitle').textContent='Google Sheets refresh failed';
  $('connectionText').textContent=(workbook?'Showing previously loaded data, which may be stale. ':'No live data loaded. ')+(error.name==='AbortError'?'Google took too long to respond.':error.message)+ ' Use Refresh now to retry, or Load workbook as a fallback.';
  $('footerState').textContent=workbook?'STALE DATA · REFRESH FAILED':'LIVE FEED UNAVAILABLE';
 }finally{clearTimeout(timeout);liveBusy=false;$('refreshBtn').disabled=false;$('loadBtn').disabled=false;}
}
let manualRefreshBusy=false;
async function reloadSaved(){
 if(manualRefreshBusy)return;if(sheetUrl)return refreshLive(true);
 if(drafts){feedback('Save or export your imported draft before refreshing.',true);return;}
 manualRefreshBusy=true;const generation=sourceGeneration,buttons=[$('refreshBtn'),$('refreshEventsBtn')].filter(Boolean);buttons.forEach(b=>b.disabled=true);
 try{const data=await syncPull({accept:false});if(drafts||generation!==sourceGeneration){feedback('Your local changes were retained. Reload after saving them.',true);return;}applySynced(data,true);feedback('Loaded the latest saved records and daily research. This does not start a new web search.');}
 catch(error){feedback(error.message,true);}finally{manualRefreshBusy=false;buttons.forEach(b=>b.disabled=false);}
}
$('refreshBtn').onclick=reloadSaved;
$('refreshEventsBtn').onclick=reloadSaved;
setInterval(()=>refreshLive(),60000);
window.addEventListener('focus',()=>refreshLive());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive()});

function updateSourceLinks(){
 for(const id of ['sourceLink','downloadLink']){const node=$(id);node.hidden=!sheetUrl;if(sheetUrl)node.href=id==='sourceLink'?sheetUrl.replace('/export?format=xlsx','/edit'):sheetUrl;else node.removeAttribute('href');}
 $('disconnectSheet').disabled=!sheetUrl;
}
function setWorkbook(next,label){
 const candidate=window.XLSX.utils.book_new();for(const [name,rows] of Object.entries(next))window.XLSX.utils.book_append_sheet(candidate,window.XLSX.utils.aoa_to_sheet(rows),name);
 workbook=candidate;sheets=next;filename=label;drafts=1;liveMode=false;sheetUrl='';sourceGeneration++;updateSourceLinks();
 $('exportBtn').disabled=false;$('dataLabel').textContent=label;$('footerState').textContent=label+' · READ-ONLY SOURCE';
 $('connectionTitle').textContent=label;$('connectionText').textContent=label==='FICTIONAL DEMO DATA'?'Demo records are fictional and pinned only at public landmarks. No account connected.':'Blank private-ready workbook is open. Import your own file to populate it. No external account connection or automatic sync.';
 overview();if(personalSections.some(x=>x.key===active)){$('personalView').innerHTML=renderPersonal(active,sheets,{source:label==='FICTIONAL DEMO DATA'?'demo':'local'});}else if(active!=='overview')setupSection();
}
async function useTemplate(demo=true){
 if(liveBusy){feedback('Wait for the current refresh to finish.',true);return;}
 if(drafts&&!confirm('Replace browser drafts? Export them first if you need a copy.'))return;
 const ticket=++sourceGeneration,initialDrafts=drafts;
 try{if(!window.XLSX)throw Error('Workbook reader unavailable. Check your internet connection and reload.');const next=await getTemplate(demo);Object.assign(next,personalTemplate(demo));if(ticket!==sourceGeneration||drafts!==initialDrafts||$('detail').open){feedback('Demo loading paused because your source or edits changed.',true);return;}setWorkbook(next,demo?'FICTIONAL DEMO DATA':'BLANK WORKBOOK');$('setup').close();}catch(e){feedback(e.message,true);}
}
$('setupBtn').onclick=()=>$('setup').showModal();$('closeSetup').onclick=()=>$('setup').close();
$('demoBtn').onclick=()=>useTemplate(true);$('blankBtn').onclick=async()=>{if(!window.XLSX){feedback('Workbook reader unavailable.',true);return;}try{const next=await getTemplate(false),wb=window.XLSX.utils.book_new();Object.assign(next,personalTemplate(false));for(const [name,rows] of Object.entries(next))window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.aoa_to_sheet(rows),name);window.XLSX.writeFile(wb,'Brians-Dash-Blank-Template.xlsx');}catch(e){feedback(e.message,true);}};
$('ownSheetForm').onsubmit=async e=>{e.preventDefault();if(liveBusy)return;if(drafts||$('detail').open){$('setupStatus').textContent='Export your drafts and reload before switching sources.';return;}try{const url=sheetExportUrl($('sheetInput').value);if(!url)throw Error('Enter your own spreadsheet URL.');if(!$('publicConsent').checked)throw Error('Confirm that this sheet may be read without signing in.');sheetUrl=url;sourceGeneration++;liveMode=true;lastLiveCheck=0;updateSourceLinks();$('sheetInput').value='';$('publicConsent').checked=false;$('setupStatus').textContent='';$('setup').close();await refreshLive(true);}catch(e){$('setupStatus').textContent=e.message;}};
$('disconnectSheet').onclick=()=>{sheetUrl='';sourceGeneration++;liveMode=false;updateSourceLinks();$('connectionTitle').textContent='Disconnected · last loaded data retained in this tab';$('connectionText').textContent='No more sheet checks. Reload or choose Demo to remove these records from view.';$('footerState').textContent='DISCONNECTED';$('setupStatus').textContent='Spreadsheet disconnected. Reload to clear the last loaded data.';};

function personalTemplate(demo=false){
 const result=Object.fromEntries(Object.entries(extraTabs).map(([name,rows])=>[name,rows.map(r=>[...r])]));
 if(demo){const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
 result.Coursework.push(['DEMO 101','Fictional case presentation',addDays(6),'In progress','','Demo record — not a real class']);
 result['Daily Planner'].push([addDays(1),'10:00','Fictional career workshop','Career','Planned','','Demo event — not in your calendar']);
 }
 return result;
}
$('holdingsFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>4*1024*1024)throw Error('Choose a CSV or XLSX smaller than 4 MB.');
  if(!window.XLSX)throw Error('The XLSX/CSV library is not available. Check your connection and reload.');
  const bytes=await file.arrayBuffer(),raw=window.XLSX.read(bytes,{type:'array'}),first=raw.Sheets[raw.SheetNames[0]];
  if(!first)throw Error('No worksheet or CSV rows found.');
  const rows=window.XLSX.utils.sheet_to_json(first,{header:1,defval:'',raw:false,blankrows:false});
  const holdingRows=importedHoldingsFromRows(rows);
  if((sheets.Holdings?.length||0)>1&&!confirm('Replace your current Holdings tab? Unsaved imported records will be replaced.'))return;
  sheets.Holdings=holdingRows; if(!workbook)workbook=window.XLSX.utils.book_new();
  workbook.Sheets.Holdings=window.XLSX.utils.aoa_to_sheet(holdingRows);
  if(!workbook.SheetNames.includes('Holdings'))workbook.SheetNames.push('Holdings');
  drafts++;$('exportBtn').disabled=false;
  $('connectionTitle').textContent='Holdings imported · private browser draft';
  $('connectionText').textContent=`${holdingRows.length-1} position(s) imported from ${file.name}. CSV columns were mapped locally; price fields are not live. Export your workbook to keep changes.`;
  $('footerState').textContent='PRIVATE PORTFOLIO DRAFT · NO BROKERAGE SYNC';
  overview();if(active==='investments')$('personalView').innerHTML=renderPersonal('investments',sheets,{source:'local'});
  feedback('Holdings imported locally. Verify all shares and costs; activity exports are not positions snapshots.');
 }catch(error){feedback(error.message||'Holdings could not be imported.',true)}finally{$('holdingsFile').value='';}
});
document.addEventListener('click',e=>{if(e.target.closest('#holdingsImportBtn'))$('holdingsFile').click();});

updateSourceLinks();
// Server data initializes the workbook; no asynchronous blank-template replacement.

function refreshActiveData(){
 if(active==='news'){mountNews();return;}
 if(active==='overview')overview();
 else if(active==='investments'){$('personalView').innerHTML=syncFinance();mountPortfolioHistory(true);}
 else if(active==='planner')$('personalView').innerHTML=renderPersonal(active,sheets,{source:filename==='FICTIONAL DEMO DATA'?'demo':'local'});
 else if(active!=='career')setupSection(true);
 // Career's independent component owns its filters, selected tab and updates.
}
function backgroundViewReady(){
 return canRefreshInBackground({hidden:document.hidden,scrollY:window.scrollY,
  editing:!!document.querySelector('dialog[open]')||!!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'),
  expanded:!!document.querySelector('.pd-daily-briefing details[open],.stock-dialog[open],.geo-expanded'),busy:!!geo.nopeBusy});
}
function applySynced(d,loadWorkbook=false){
 d=acceptData(d);
 if(loadWorkbook&&d.sheets){sheets={...d.sheets};filename='Saved dashboard workbook';}
 sheets.Holdings=[extraTabs.Holdings[0],...d.holdings.map(h=>[h.ticker,'',h.shares,h.avgCost,d.quotes[h.ticker]?.price||'',d.quotes[h.ticker]?.asOf||'','Saved portfolio'])];rebuildWorkbook();
 $('connectionTitle').textContent=canEdit?'Your dashboard is connected':'Viewing Brian’s dashboard';$('connectionText').textContent=canEdit?'Your saved data is synced. Manage records inside each tab; workbook tools are in Owner tools.':'Read-only view. Browse the briefings, charts, records and maps; only the owner can save changes.';$('dataLabel').textContent='SYNCED DASHBOARD DATA';$('footerState').textContent='SYNCED PORTFOLIO · SAVED WORKBOOK';refreshActiveData();
 document.dispatchEvent(new CustomEvent('portfolio-synced'));
}
const saveButton=document.createElement('button');saveButton.textContent='Save imported workbook';saveButton.className='button subtle';saveButton.hidden=true;$('exportBtn').before(saveButton);saveButton.onclick=async()=>{try{requireOwner();saveButton.disabled=true;applySynced(await syncSave({sheets}));drafts=0;saveButton.hidden=true;feedback('Workbook saved across devices. Saved investment positions are managed separately in Investments.');}catch(e){feedback(e.message,true)}finally{saveButton.disabled=false}};
setupHoldingForm({onSaved:data=>applySynced(data),onNotice:message=>feedback(message)});
document.addEventListener('click',async e=>{try{if(e.target.closest('#syncReload')){if(isRefreshing())return;const btn=e.target.closest('#syncReload');btn.disabled=true;btn.textContent='Refreshing prices…';const status=$('quoteRefreshStatus');if(status)status.textContent='Fetching latest quotes…';try{applySynced(await refreshQuotes());}catch(error){if(status)status.textContent='Refresh failed. Your saved prices are unchanged. '+error.message;}finally{btn.disabled=false;btn.textContent='↻ Reload prices';}return;}}catch(e){feedback(e.message,true)}});
syncPull({accept:false}).then(d=>{if(sourceGeneration===0&&!drafts&&!liveMode)applySynced(d,true);}).catch(e=>feedback(e.message,true));
let syncPolling=false;
async function pollSavedDashboard(){
 if(syncPolling||isRefreshing()||drafts||liveMode||!backgroundViewReady())return;
 syncPolling=true;const generation=sourceGeneration;
 try{
  const next=await syncPull({accept:false});
  // Re-check after the request: the user may have scrolled, opened an editor,
  // imported a workbook or saved a newer position while the response was in flight.
  if(generation!==sourceGeneration||isRefreshing()||drafts||liveMode||!backgroundViewReady())return;
  if(sameSnapshot(syncData(),next)||Date.parse(next.updatedAt)<Date.parse(syncData()?.updatedAt))return;
  applySynced(next,true);
 }catch{/* Keep the last saved view when a background check fails. */}
 finally{syncPolling=false;}
}
setInterval(pollSavedDashboard,60000);


function rebuildWorkbook(){if(!window.XLSX)return;const next=window.XLSX.utils.book_new();for(const [name,rows] of Object.entries(sheets)){window.XLSX.utils.book_append_sheet(next,window.XLSX.utils.aoa_to_sheet(rows),name);}workbook=next;$('exportBtn').disabled=false;}
function recordSaved(d){sourceGeneration++;drafts=0;liveMode=false;sheetUrl='';applySynced(d,true);feedback('Saved — dashboard and workbook updated.');}
const dashboardEditor=createEditor({getData:syncData,pull:syncPull,onSaved:recordSaved});
const recordTab=()=>active==='planner'?'Daily Planner':active==='career'?'Application Tracker':active;
$('addRecordBtn').onclick=()=>dashboardEditor.open(recordTab()).catch(e=>feedback(e.message,true));
$('manageRecordsBtn').onclick=()=>dashboardEditor.manage(recordTab()).catch(e=>feedback(e.message,true));
document.addEventListener('click',e=>{const b=e.target.closest('[data-planner-edit]');if(b)dashboardEditor.open('Daily Planner',Number(b.dataset.plannerEdit)).catch(e=>feedback(e.message,true));});

document.addEventListener('click',e=>{if(e.target.closest('[data-add-map-place]'))dashboardEditor.open('Saved Places').catch(e=>feedback(e.message,true));if(e.target.closest('[data-add-map-event]'))dashboardEditor.open('Potential Events').catch(e=>feedback(e.message,true));if(e.target.closest('[data-edit-map-places]'))dashboardEditor.manage('Saved Places').catch(e=>feedback(e.message,true));});
document.addEventListener('map-location-saved',async e=>{try{requireOwner();const {id,value}=e.detail,x=geo.locations.find(x=>x.id===id);if(!x)return;const d=await syncPull();const tab=x.type==='event'?'Potential Events':x.type==='place'?'Saved Places':'Networking Tracker';const row=x.type==='company'?x.contacts[0]?.row:x.row;const head=tab==='Saved Places'?0:3;const baseRow=d.sheets[tab]?.[row];if(!baseRow)throw Error('Open Edit records to save this location.');const cells=baseRow.map(String),headers=d.sheets[tab][head];for(const [name,v] of [['Latitude',value.coordinates[1]],['Longitude',value.coordinates[0]],[x.type==='event'?'Location':x.type==='place'?'Address':'Office address',value.address]]){const col=headers.indexOf(name);if(col>=0){while(cells.length<=col)cells.push('');cells[col]=String(v)}}const r=await apiFetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tab,row,baseRow,cells,requestId:Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')})});const saved=await r.json();if(!r.ok)throw Error(saved.error);recordSaved(saved);geo.message('Location saved across devices.');}catch(error){geo.message('Pin is only saved in this browser: '+error.message)}});

mountEventSearch($('eventSearchPanel'),{reload:reloadSaved,canRefresh:()=>!drafts&&!sheetUrl&&!$('detail').open});
