import {apiFetch} from './api-client.mjs';
import {canEdit,requireOwner} from './dashboard-access.mjs';
import {renderRecommendationContent,recommendationsCSV} from './recommendations-data.mjs';
import {updateRecommendationView} from './recommendation-view.mjs';
import {canRefreshInBackground} from './background-refresh.mjs';
let saved=null,loading=null,busy=false,query='',limit=30,error='',active=false;
const openDetails=new Set();
const root=()=>document.getElementById('recommendationTracker');
function draw(){const el=root();if(el&&saved)updateRecommendationView(el,renderRecommendationContent(saved,{canEdit,query,limit,busy,error}),openDetails);}
async function load(){if(!root()||busy)return;if(saved)draw();if(loading)return loading;loading=(async()=>{try{const r=await apiFetch('/api/recommendations');if(!r.ok)throw Error('Could not load the recommendation journal. Reload this page to retry.');const next=await r.json();if(!saved||!(Date.parse(next.updatedAt)<Date.parse(saved.updatedAt)))saved=next;error='';draw();}catch(e){error=e.message;const el=root();if(saved)draw();else if(el)el.querySelector('[role=status]').textContent=error;}finally{loading=null;}})();return loading;}
document.addEventListener('dashboard:sectionchange',e=>{active=e.detail.section==='investments';if(active)load();});
document.addEventListener('portfolio-synced',()=>{if(active&&root())load();});
document.addEventListener('toggle',e=>{const d=e.target;if(!d?.isConnected||!d.matches?.('details[data-rec-detail]'))return;if(d.open)openDetails.add(d.dataset.recDetail);else openDetails.delete(d.dataset.recDetail);},true);
setInterval(()=>{const el=root();if(active&&el&&canRefreshInBackground({hidden:document.hidden,busy,scrollY:window.scrollY,editing:el.contains(document.activeElement),expanded:!!el.querySelector('details[open]')}))load();},60000);
document.addEventListener('input',e=>{if(e.target.id==='recSearch'){const selection=e.target.selectionStart;query=e.target.value;limit=30;draw();const input=document.getElementById('recSearch');input?.focus();input?.setSelectionRange(selection,selection);}});
document.addEventListener('click',async e=>{
 if(e.target.closest('[data-rec-more]')){limit+=30;draw();return;}
 if(e.target.closest('[data-rec-export]')&&saved){const url=URL.createObjectURL(new Blob([recommendationsCSV(saved)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Brians-Dash-recommendations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 if(!e.target.closest('[data-rec-refresh]')||busy)return;
 try{requireOwner();busy=true;error='';draw();const r=await apiFetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'refresh'}),timeoutMs:90000});const next=await r.json();if(!r.ok)throw Error(next.error||'Could not refresh recommendation prices');saved=next;}catch(e){error=e.message;}finally{busy=false;draw();}
});
