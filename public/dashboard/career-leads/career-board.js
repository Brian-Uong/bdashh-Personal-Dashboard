import {apiFetch} from '../api-client.mjs';
import {canRefreshInBackground,sameSnapshot} from '../background-refresh.mjs';
import {canEdit} from '../dashboard-access.mjs';
import {openResearchPreferences} from '../research-preferences.mjs';
/** Brian's Dash — Jobs & Networking add-on.
 * Standalone custom element. Does not modify existing app code or maps.
 * Public-source discovery; no LinkedIn account access. Saved leads are server-backed; bookmarks and stages remain browser-local.
 */
const BASE = new URL('.', import.meta.url);
const CSS_URL = new URL('./career-board.css', BASE).href;
const STATE_KEY = 'brians-dash-career-board-v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeUrl = value => { try { const u=new URL(String(value)); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const safeId = value => String(value ?? '').replace(/[^a-zA-Z0-9_-]/g,'');
const unique = list => [...new Set(list.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
const dateNum = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? Number(v.replaceAll('-','')) : 0;
const fmtDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
const readSaved = () => { try {return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');} catch {return {};} };
const saveState = state => {try {localStorage.setItem(STATE_KEY, JSON.stringify(state));}catch{/* private browsing/no storage */}};
const csvEscape = value => '"'+String(value??'').replaceAll('"','""')+'"';

class BriansCareerBoard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this.data={jobs:[],recruiters:[],lastCurated:''}; this.saved=readSaved();
    this.tab='jobs'; this.term=''; this.region=''; this.company=''; this.filterSaved=false;
    this.refreshing=false;this.refreshMessage='';this.tabFilters={}; this.sort='recommended'; this.loading=true; this.error=''; this.sourceMode='curated';
    this.shadowRoot.addEventListener('click',e=>this.handleClick(e));
    this.shadowRoot.addEventListener('change',e=>this.handleChange(e));
    this.shadowRoot.addEventListener('input',e=>this.handleInput(e));
    this.shadowRoot.addEventListener('keydown',e=>{if(e.target.getAttribute('role')!=='tab'||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const value=e.key==='Home'?'jobs':e.key==='End'?'recruiters':this.tab==='jobs'?'recruiters':'jobs';this.shadowRoot.querySelector(`[data-action=tab][data-value=${value}]`).click();});
  }
  connectedCallback() {this.toggleAttribute('data-owner',canEdit);if(!this.initialized){this.initialized=true;this.render();this.load();this.loadResearch();}this.poll=setInterval(()=>{if(this.isConnected&&this.sourceMode==='curated'&&this.backgroundReady())this.load(true);},60000);}
  disconnectedCallback(){clearInterval(this.poll);}
  backgroundReady(ignoreFetch=false){return canRefreshInBackground({hidden:document.hidden,scrollY:window.scrollY,busy:this.refreshing||(!ignoreFetch&&this.fetching),editing:!!this.shadowRoot.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||!!document.querySelector('dialog[open]'),expanded:!!this.shadowRoot.querySelector('details[open]')});}
  async load(background=false) {
    if(this.fetching)return;this.fetching=true;
    try {
      const url=this.getAttribute('data-src') || '/api/discovery';
      const res=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!res.ok) throw new Error('HTTP '+res.status);
      let data=await res.json();
      if(background&&(!this.isConnected||this.sourceMode!=='curated'||!this.backgroundReady(true)))return;
      this.setLeads(data,'curated');
    }catch(e){
      if(background)return;
      this.error='Saved leads could not load. Check your connection and reload; no placeholder results have been substituted.';
      this.loading=false;this.render();
    }finally{this.fetching=false;}
  }
  setLeads(obj,mode) {
    if(!obj||!Array.isArray(obj.jobs)||!Array.isArray(obj.recruiters)) throw Error('The imported JSON must include jobs[] and recruiters[] arrays.');
    // Keep only public lead fields; never upload resume data or credentials.
    const next={jobs:obj.jobs.filter(x=>x&&x.id&&safeUrl(x.url)),recruiters:obj.recruiters.filter(x=>x&&x.id&&safeUrl(x.url)),lastCurated:obj.lastCurated||'',lastRefresh:obj.lastRefresh||null};
    if(!this.loading&&!this.error&&this.sourceMode===mode&&sameSnapshot(this.data,next))return;
    this.data=next;this.sourceMode=mode;this.error='';this.loading=false;this.render();
  }
  get items() {return this.tab==='jobs'?this.data.jobs:this.data.recruiters;}
  get shown() {
    const term=this.term.toLocaleLowerCase();
    let list=this.items.filter(x=>{
      if(this.region&&x.region!==this.region)return false;
      if(this.company&&x.company!==this.company)return false;
      if(this.filterSaved&&!this.saved[x.id]?.starred)return false;
      if(term&&!Object.values(x).some(v=>typeof v==='string'&&v.toLocaleLowerCase().includes(term)))return false;
      return true;
    });
    if(this.sort==='company')list.sort((a,b)=>a.company.localeCompare(b.company)||String(a.title||a.name).localeCompare(String(b.title||b.name)));
    else if(this.sort==='newest')list.sort((a,b)=>dateNum(b.posted)-dateNum(a.posted));
    else if(this.tab==='jobs')list.sort((a,b)=>this.rank(a)-this.rank(b)||dateNum(b.posted)-dateNum(a.posted));
    else list.sort((a,b)=>a.name.localeCompare(b.name));
    return list;
  }
  rank(x){return ({'Strong fit':0,'Promising':1,'Eligibility mismatch':3})[x.priority]??2;}
  getStats(){const saved=Object.values(this.saved).filter(x=>x.starred).length;return {saved,jobs:this.data.jobs.length,people:this.data.recruiters.length};}
  pill(text,cls=''){return `<span class="bdc-pill ${cls}">${esc(text)}</span>`;}
  getStage(x){return this.saved[x.id]?.stage||(this.tab==='jobs'?'Not applied':'Not contacted');}
  stageOptions(x){return (this.tab==='jobs' ? ['Not applied','Interested','Applied','Interviewing','Rejected','Offer','Archived'] : ['Not contacted','Interested','Connection requested','Connected','Follow up','Archived'])
    .map(s=>`<option value="${esc(s)}" ${this.getStage(x)===s?'selected':''}>${esc(s)}</option>`).join('');}
  renderJob(x) {
    const saved=!!this.saved[x.id]?.starred;
    const caution=x.priority==='Eligibility mismatch';
    return `<article class="bdc-result ${caution?'bdc-warning':''}" data-row="${esc(x.id)}">
      <div class="bdc-result-top"><div class="bdc-monogram" aria-hidden="true">${esc((x.company||'?').slice(0,2).toUpperCase())}</div><div class="bdc-result-head"><div class="bdc-company">${esc(x.company)} <span>· ${esc(x.city)}, ${esc(x.state||'CA')}</span></div><h3>${esc(x.title)}</h3></div><button class="bdc-star ${saved?'active':''}" data-action="star" data-id="${esc(x.id)}" type="button" title="${saved?'Remove bookmark':'Bookmark lead'}" aria-label="${saved?'Remove bookmark':'Bookmark lead'}" aria-pressed="${saved}">${saved?'★':'☆'}</button></div>
      <div class="bdc-tags">${this.pill(x.path)}${this.pill(x.priority,caution?'warn':x.priority==='Strong fit'?'good':'')}${x.workMode?this.pill(x.workMode):''}${x.salary?this.pill(x.salary):''}</div>
      <p class="bdc-reason">${esc(x.reason)}</p>
      ${x.verificationState==='not_listed'?'<p class="bdc-note alert">Not present in the latest employer feed. Saved for your history; check the source before applying.</p>':''}${x.caution?`<p class="bdc-note ${caution?'alert':''}">${caution?'Eligibility alert: ':''}${esc(x.caution)}</p>`:''}
      <div class="bdc-meta">${x.posted?`Posted ${esc(fmtDate(x.posted))} · `:''}Source checked ${esc(fmtDate(x.lastChecked))} · ${esc(x.source)}</div>
      <div class="bdc-controls"><a class="bdc-link primary" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">Open job posting ↗</a><label class="bdc-stage-label">Status <select data-action="stage" data-id="${esc(x.id)}" aria-label="Job status for ${esc(x.title)}">${this.stageOptions(x)}</select></label></div>
    </article>`;
  }
  makeDraft(x) {
    return `Hi ${String(x.name).split(' ')[0]}, I’m completing my MS in Business Analytics at UC Irvine in June 2027, with a B.S. in Data Science and experience in healthcare engineering and statistical research. I’m exploring entry-level business and financial analytics opportunities in Southern California and was interested in your work at ${x.company}. I’d appreciate connecting and learning which teams might be a fit. Thank you!`;
  }
  renderPerson(x) {
    const saved=!!this.saved[x.id]?.starred;
    return `<article class="bdc-result" data-row="${esc(x.id)}">
      <div class="bdc-result-top"><div class="bdc-monogram bdc-person-icon" aria-hidden="true">${esc((x.name||'?').split(' ').slice(0,2).map(w=>w[0]||'').join(''))}</div><div class="bdc-result-head"><div class="bdc-company">${esc(x.company)} <span>· ${esc(x.city)}</span></div><h3>${esc(x.name)}</h3><span class="bdc-role">${esc(x.title)}</span></div><button class="bdc-star ${saved?'active':''}" data-action="star" data-id="${esc(x.id)}" type="button" aria-label="${saved?'Remove bookmark':'Bookmark lead'}" aria-pressed="${saved}">${saved?'★':'☆'}</button></div>
      <div class="bdc-tags">${this.pill(x.region)}${this.pill(x.focus)}</div><p class="bdc-reason">${esc(x.reason)}</p>
      <p class="bdc-note">${esc(x.caution)}</p>
      <div class="bdc-meta">Public profile checked ${esc(fmtDate(x.lastChecked))} · Specific vacancy ownership not assumed</div>
      <div class="bdc-controls"><a class="bdc-link primary" href="${esc(safeUrl(x.url))}" target="_blank" rel="noopener noreferrer">${/linkedin\.com/i.test(x.url)?'Open LinkedIn':'View public source'} ↗</a><button class="bdc-link" data-action="copy" data-id="${esc(x.id)}" type="button">Copy intro draft</button><label class="bdc-stage-label">Status <select data-action="stage" data-id="${esc(x.id)}" aria-label="Contact status for ${esc(x.name)}">${this.stageOptions(x)}</select></label></div>
    </article>`;
  }
  render() {
    const {jobs,people,saved}=this.getStats();
    const list=this.shown;
    const regions=unique(this.items.map(x=>x.region));
    const companies=unique(this.items.map(x=>x.company));
    const focus=this.tab==='jobs'?'jobs':'recruiters';
    const markup=`<link rel="stylesheet" href="${esc(CSS_URL)}" />
      <section class="bdc-wrap" aria-label="Brian's Jobs and Networking Hub">
        <div class="bdc-halo"></div><header class="bdc-head"><div><div class="bdc-overline">BRIAN'S DASH <span>/</span> NEON DISTRICT <span>/</span> CAREER NETWORK</div><h2>Opportunities in motion<span class="bdc-period">.</span></h2><p>Fresh opportunities for Orange County and Inland Empire, with source checks and separate AI research status.</p></div><div class="bdc-pulse"><span class="bdc-pulse-dot"></span> CAREER HUB</div></header>
        <div class="bdc-pulse-row"><div><strong>${jobs}</strong><span>JOB LEADS</span></div><div><strong>${people}</strong><span>RECRUITER PROFILES</span></div><div><strong>${saved}</strong><span>BOOKMARKED</span></div><div class="bdc-last"><span>LAST RESEARCH UPDATE</span><strong>${esc(fmtDate(this.data.lastCurated)||'Imported leads')}</strong></div></div>
        <div class="bdc-banner">Refresh jobs & recruiters checks supported public employer feeds and a recruiter directory using your role and location preferences. New matches are saved here. No API key is needed.</div>
        <div class="bdc-toolbar"><div class="bdc-tabs" role="tablist" aria-label="Lead type"><button type="button" data-action="tab" data-value="jobs" role="tab" aria-selected="${this.tab==='jobs'}" class="${this.tab==='jobs'?'selected':''}">Jobs <span>${jobs}</span></button><button type="button" data-action="tab" data-value="recruiters" role="tab" aria-selected="${this.tab==='recruiters'}" class="${this.tab==='recruiters'?'selected':''}">Recruiters <span>${people}</span></button></div><div class="bdc-file-tools"><button type="button" class="bdc-muted" data-action="refresh">${this.refreshing?'Checking sources…':'↻ Check live job sources'}</button><button type="button" class="bdc-muted" data-action="discover">Search preferences</button><label class="bdc-import">Import leads JSON<input class="bdc-file" data-action="import" type="file" accept=".json,application/json" /></label><button type="button" class="bdc-muted" data-action="export">Export saved leads ↓</button></div></div>
        ${this.refreshStatus()}<div class="bdc-filter-row"><label class="bdc-search-wrap"><span class="sr-only">Search ${focus}</span><span aria-hidden="true">⌕</span><input class="bdc-search" type="search" data-action="search" value="${esc(this.term)}" placeholder="Search ${focus}, companies, locations, skills..." autocomplete="off" /></label><label><span class="sr-only">Region</span><select data-action="region"><option value="">All locations</option>${regions.map(x=>`<option value="${esc(x)}" ${this.region===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label><span class="sr-only">Company</span><select data-action="company"><option value="">All companies</option>${companies.map(x=>`<option value="${esc(x)}" ${this.company===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label><span class="sr-only">Sort</span><select data-action="sort"><option value="recommended" ${this.sort==='recommended'?'selected':''}>${this.tab==='jobs'?'Best resume fit':'Name A-Z'}</option><option value="newest" ${this.sort==='newest'?'selected':''}>Newest dated</option><option value="company" ${this.sort==='company'?'selected':''}>Company A-Z</option></select></label><label class="bdc-bookmark-toggle"><input type="checkbox" data-action="saved" ${this.filterSaved?'checked':''}/> Saved only</label></div>
        <div class="bdc-results" role="tabpanel" id="lead-results" aria-label="${focus}">${this.loading?'<div class="bdc-empty">Loading curated leads…</div>':this.error?`<div class="bdc-empty">${esc(this.error)}</div>`:`<div class="bdc-listmeta" role="status">Showing <strong>${list.length}</strong> ${focus} · ${this.sourceMode==='curated'?'Saved research results':'Imported from local file'} · No automated account access</div><div class="bdc-list">${list.length?list.map(x=>this.tab==='jobs'?this.renderJob(x):this.renderPerson(x)).join(''):'<div class="bdc-empty">No matching leads. Try clearing filters.</div>'}</div>`}</div>
        <footer class="bdc-foot"><span>Local bookmarks and statuses stay in this browser. Export a backup if you change devices.</span><span>PUBLIC SOURCES · REVIEW BEFORE OUTREACH</span></footer>
        <div id="bdc-toast" class="bdc-toast" role="status" aria-live="polite"></div>
      </section>`;
    // Keep the stylesheet, tabs and inputs mounted. Replacing the entire shadow
    // tree on each keystroke/tab click caused flicker, focus loss and scroll jumps.
    if(!this.shadowRoot.querySelector('.bdc-wrap')) this.shadowRoot.innerHTML=markup;
    else {
      const template=document.createElement('template');template.innerHTML=markup;
      for(const selector of ['.bdc-pulse-row','.bdc-results','.bdc-refresh-status']){
        const current=this.shadowRoot.querySelector(selector),next=template.content.querySelector(selector);
        current.innerHTML=next.innerHTML;
        if(selector==='.bdc-results')current.setAttribute('aria-label',focus);
      }
      for(const current of this.shadowRoot.querySelectorAll('.bdc-filter-row [data-action]')){
        const next=template.content.querySelector(`.bdc-filter-row [data-action="${current.dataset.action}"]`);
        if(current.tagName==='SELECT'&&current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;
        if(current.type==='checkbox')current.checked=next.checked;
        else if(current.value!==next.value)current.value=next.value;
        if(current.type==='search')current.placeholder=next.placeholder;
      }
      this.shadowRoot.querySelector('.bdc-search-wrap .sr-only').textContent=`Search ${focus}`;
      for(const tab of this.shadowRoot.querySelectorAll('[role=tab]')){
        const selected=tab.dataset.value===this.tab;
        tab.classList.toggle('selected',selected);tab.setAttribute('aria-selected',String(selected));
        tab.querySelector('span').textContent=tab.dataset.value==='jobs'?jobs:people;
      }
      const refresh=this.shadowRoot.querySelector('[data-action=refresh]');
      refresh.disabled=this.refreshing;refresh.textContent=this.refreshing?'Checking sources…':'↻ Check live job sources';
    }
    for(const tab of this.shadowRoot.querySelectorAll('[role=tab]')){
      tab.tabIndex=tab.dataset.value===this.tab?0:-1;
      tab.setAttribute('aria-controls','lead-results');
    }
  }
  refreshStatus(){
    const r=this.data.lastRefresh;
    const label=this.refreshing?'Checking current employer feeds and recruiter directory…':this.refreshMessage||(!r?'Ready to check current sources.':r.status==='disabled'?'Job and people searches are disabled in your preferences.':r.status==='failed'?'Source check failed. Your previous leads are retained.':`${r.status==='partial'?'Partial refresh':'Refresh complete'}: ${r.jobsAdded} new jobs, ${r.recruitersAdded} new recruiters. ${r.jobsChecked} job matches and ${r.recruitersChecked} recruiters checked.`);
    const ai=this.aiStatus,run=this.researchInfo?.lastRun;
    const aiText=ai?(ai.dailyCareer?'Morning AI research · 7 AM Pacific':ai.configured?'AI web research available on demand':'On-demand AI is not enabled'):'AI search status unavailable';
    const runText=run?`${run.status} · ${new Date(run.finishedAt).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})} PT · ${run.counts.jobs} jobs, ${run.counts.people} people, ${run.counts.events} events`:'No AI run recorded yet.';
    return `<div class="bdc-refresh-status"><div class="bdc-ai-status"><strong>${esc(aiText)}</strong><p>${esc(runText)}</p>${ai?.onDemandReason?`<p>${esc(ai.onDemandReason)}</p>`:''}${run?`<details><summary>AI findings and limits</summary><p>${esc(run.summary)}</p>${run.issues.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:''}${canEdit&&ai?.configured?`<button type="button" class="bdc-muted" data-action="ai-search" ${this.aiBusy?'disabled':''}>${this.aiBusy?'Researching…':'Run AI web search'}</button>`:''}<p>${esc(this.aiMessage||'Live source checks below use public employer feeds. AI research also evaluates your background, availability and industries.')}</p></div><p role="status" aria-live="polite">${esc(label)}</p>${r?`<small>Last attempt: ${esc(new Date(r.at).toLocaleString('en-US',{timeZone:'America/Los_Angeles'}))} PT</small><details><summary>Sources checked</summary><ul>${r.sources.map(s=>`<li><strong>${esc(s.name)}</strong>: ${esc(s.status)} · ${s.scanned} entries scanned · ${s.matches} matches${s.error?' · '+esc(s.error):''}${s.note?' · '+esc(s.note):''}</li>`).join('')}</ul></details>`:'<small>Coverage: Fender, Anduril Industries, Esri, Brighton Jones, and Burtch Works. Role/location matching does not verify every qualification. National recruiter locations and vacancy ownership may be unconfirmed.</small>'}</div>`;
  }
  async loadResearch(){
    try{const results=await Promise.all(['/api/research','/api/ai/status'].map(async path=>{const r=await apiFetch(path);if(!r.ok)throw Error();return r.json();}));this.researchInfo=results[0];this.aiStatus=results[1];if(this.isConnected)this.render();}catch{this.aiMessage='AI status could not be verified. Live source checks remain available.';if(this.isConnected)this.render();}
  }
  async runAI(){
    if(!canEdit||this.aiBusy||!this.aiStatus?.configured)return;
    this.aiBusy=true;this.aiMessage='Searching current web sources using your saved preferences…';this.render();
    try{const r=await apiFetch('/api/ai/career',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',timeoutMs:200000});const d=await r.json();if(!r.ok)throw Error(d.error||'AI research could not finish.');this.aiMessage='Research saved. Updated jobs and people are shown below; events are in Local events.';await this.load();await this.loadResearch();}
    catch(e){this.aiMessage=e.message;}
    finally{this.aiBusy=false;this.render();}
  }
  async refreshSources(){
    if(this.refreshing)return;this.refreshing=true;this.refreshMessage='';this.render();
    try{
      const response=await apiFetch('/api/discovery/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',timeoutMs:65000});
      const data=await response.json();
      if(data.lastRefresh?.status==='failed'){this.data={...this.data,lastRefresh:data.lastRefresh};}else if(Array.isArray(data.jobs)&&Array.isArray(data.recruiters))this.setLeads(data,'curated');
      if(!response.ok)throw Error(data.error||'The sources could not be refreshed. Previous leads are retained.');
      this.refreshMessage='';
    }catch(error){this.refreshMessage=error.name==='TimeoutError'?'The request timed out. Previous leads are still available; a server update may finish shortly.':error.message;}
    finally{this.refreshing=false;this.render();}
  }
  handleInput(e){if(e.target?.dataset?.action==='search'){this.term=e.target.value;this.render();}}
  handleChange(e){if(!canEdit&&['import','stage'].includes(e.target.dataset.action))return;const action=e.target?.dataset?.action;
    if(action==='region'){this.region=e.target.value;this.render();}
    if(action==='company'){this.company=e.target.value;this.render();}
    if(action==='sort'){this.sort=e.target.value;this.render();}
    if(action==='saved'){this.filterSaved=e.target.checked;this.render();}
    if(action==='stage'){const id=e.target.dataset.id;this.saved[id]={...(this.saved[id]||{}),stage:e.target.value};saveState(this.saved);this.toast('Status saved in this browser');}
    if(action==='import'){const f=e.target.files?.[0];if(f){f.text().then(t=>{try{this.setLeads(JSON.parse(t),'imported');this.toast('Local lead list loaded; your existing dashboard is unchanged');}catch(err){this.toast('Import error: '+err.message)}});}}
  }
  async handleClick(e){const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action,id=btn.dataset.id;if(!canEdit&&['refresh','discover','star','export','import','stage'].includes(action))return;
    if(action==='ai-search'){await this.runAI();return;}
    if(action==='refresh'){await this.refreshSources();return;}
    if(action==='discover'){openResearchPreferences();return;}
    if(action==='tab'){
      if(this.tab===btn.dataset.value)return;
      this.tabFilters[this.tab]={region:this.region,company:this.company,term:this.term,sort:this.sort,filterSaved:this.filterSaved};
      this.tab=btn.dataset.value;
      Object.assign(this,this.tabFilters[this.tab]||{region:'',company:'',term:'',sort:'recommended',filterSaved:false});
      this.render();
      const selected=this.shadowRoot.querySelector('[role=tab][aria-selected=true]');selected?.focus({preventScroll:true});
      this.dispatchEvent(new CustomEvent('career:leadtypechange',{detail:{tab:this.tab},bubbles:true,composed:true}));
    }
    if(action==='star'){this.saved[id]={...(this.saved[id]||{}),starred:!this.saved[id]?.starred};saveState(this.saved);this.render();}
    if(action==='copy'){const x=this.data.recruiters.find(y=>y.id===id);if(!x)return;const draft=this.makeDraft(x);try{await navigator.clipboard.writeText(draft);this.toast('Draft copied — review before sending');}catch{this.toast('Copy unavailable; open the LinkedIn profile to draft your note.');}}
    if(action==='export'){const savedRows=[...this.data.jobs,...this.data.recruiters].filter(x=>this.saved[x.id]?.starred || this.saved[x.id]?.stage && !['Not applied','Not contacted'].includes(this.saved[x.id].stage));const headers=['type','nameOrTitle','company','city','url','status','bookmarked','source','lastChecked'];const csv=[headers.join(','),...savedRows.map(x=>[x.type,x.title||x.name,x.company,x.city,x.url,this.saved[x.id]?.stage||'',this.saved[x.id]?.starred?'Yes':'No',x.source,x.lastChecked].map(csvEscape).join(','))].join('\r\n');const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='brians-dash-career-shortlist.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);this.toast('Shortlist exported locally');}
  }
  toast(msg){const t=this.shadowRoot.getElementById('bdc-toast');if(t){t.textContent=msg;t.classList.add('show');}}
}
if(!customElements.get('brians-career-board'))customElements.define('brians-career-board',BriansCareerBoard);

/** Optional non-invasive Career page auto-mount for the 2026 Brian's Dash starter.
 * Only appends a custom element to the Career page. Never changes the application's
 * core render function or modifies existing card contents.
 */
function installCareerMount(){
  if(document.querySelector('meta[name="brians-career-board-auto-mount"][content="off"]'))return;
  const container=document.getElementById('personalView');
  if(!container) return; // Other site versions can mount the custom element manually.
  let retainedBoard=null;
  const enhance=()=>{
    if(container.hidden||container.querySelector('brians-career-board'))return;
    const hint=container.querySelector('.pd-kicker')?.textContent||'';
    const breadcrumb=document.getElementById('breadcrumb')?.textContent||'';
    if(!/career system/i.test(hint) && !/career hub/i.test(breadcrumb))return;
    const board=retainedBoard||(retainedBoard=document.createElement('brians-career-board'));
    board.setAttribute('aria-label','Jobs & networking discovery');
    container.appendChild(board);
  };
  new MutationObserver(enhance).observe(container,{childList:true});
  enhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCareerMount,{once:true});
else installCareerMount();
