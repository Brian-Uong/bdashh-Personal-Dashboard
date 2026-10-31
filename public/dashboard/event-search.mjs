import {apiFetch} from './api-client.mjs';
import {canEdit} from './dashboard-access.mjs';
import {openResearchPreferences} from './research-preferences.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountEventSearch(root,{reload,canRefresh}){
 root.innerHTML=`<div class="pd-panel-head"><div><span class="pd-kicker">INLAND EMPIRE + ORANGE COUNTY</span><h2>Find your next local event</h2><p>Search organizer calendars for upcoming events in the next 90 days. Your saved plans and notes stay in place.</p></div></div><form class="local-event-search"><label>Search the web calendars<input name="query" maxlength="100" type="search" placeholder="e.g. networking, AI, workshop"></label><label>Search area<select name="region"><option value="">Both regions</option><option>Inland Empire</option><option>Orange County</option></select></label><button class="button gold" type="submit" ${canEdit?'':'disabled'}>Find local events</button><button class="button subtle" type="button" data-preferences ${canEdit?'':'disabled'}>Search preferences</button></form><p data-event-search-status role="status" aria-live="polite">Loading search status…</p><details data-event-sources hidden><summary>Sources and coverage</summary><div></div></details>`;
 const form=root.querySelector('form'),status=root.querySelector('[data-event-search-status]'),details=root.querySelector('details'),button=form.querySelector('[type=submit]');let busy=false;
 const show=run=>{
  status.textContent=run?`${run.status==='failed'?'Search failed; saved events retained':run.status==='partial'?'Partial source check':run.mode==='ai'?'AI research saved':'Source check complete'} · ${run.matched} matching events · ${run.added} added · ${new Date(run.at).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})} PT`:'Ready to search current organizer calendars. The separate AI research status is available in Search preferences.';
  details.hidden=false;details.querySelector('div').innerHTML=run?.sources?.length?run.sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a> · ${esc(s.status)}${s.note?' · '+esc(s.note):''}</p>`).join(''):'<p>Greater Irvine Chamber, Orange Chamber and Corona’s chamber/community calendars, plus UC Riverside’s official calendar. This is a bounded source search, not exhaustive web coverage. Broader AI research uses your saved preferences.</p>';
 };
 root.querySelector('[data-preferences]').onclick=()=>openResearchPreferences();
 apiFetch('/api/events').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(!busy)show(d.lastRefresh);}).catch(()=>{if(!busy)status.textContent='Search history unavailable. Your saved events remain below.';});
 form.onsubmit=async e=>{
  e.preventDefault();if(!canEdit||busy)return;
  if(!canRefresh()){status.textContent='Save or export your imported workbook draft before searching.';return;}
  busy=true;button.disabled=true;button.textContent='Searching organizers…';status.textContent='Checking upcoming dates, venues and source pages. This can take up to two minutes.';
  try{const response=await apiFetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh',query:form.elements.query.value,region:form.elements.region.value}),timeoutMs:120000});const data=await response.json();if(data.lastRefresh)show(data.lastRefresh);if(!response.ok)throw Error(data.error||'Some sources were unavailable. Previous events remain saved.');await reload();}
  catch(error){status.textContent=error.message;}
  finally{busy=false;button.disabled=false;button.textContent='Find local events';}
 };
}
